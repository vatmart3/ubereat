"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { processPhoto } from "@/lib/image/stamp";
import { clearDraft, enqueue, loadDraft, saveDraft } from "@/lib/offline/store";
import { NetworkError, submitDraft, uploadPhoto } from "@/lib/offline/submit";
import type { Draft, DraftPhoto } from "@/lib/offline/types";
import type { Courier, Slot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { HoldButton } from "@/components/ui/hold-button";
import { StepOrder } from "./step-order";
import { StepPhotos } from "./step-photos";
import { StepCourier } from "./step-courier";
import { StepSeal } from "./step-seal";
import { Confirmation, type WizardResult } from "./confirmation";

const STEP_NAMES = ["Commande", "Photos", "Livreur", "Scellé"];

function newDraft(): Draft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    step: 0,
    platform: null,
    order_ref: "",
    amount: "",
    items_count: 1,
    photos: {},
    courier_name: "",
    vehicle: null,
    pickup_code: "",
    signature: null,
    confirm_closed: false,
    started_at: now,
    updated_at: now,
  };
}

const hasContent = (d: Draft) => Boolean(d.platform || d.order_ref || Object.keys(d.photos).length || d.courier_name);

export interface WizardProps {
  restaurantName: string;
  restaurantCity: string;
  retentionDays: number;
  operatorName: string;
  recentCouriers: Courier[];
}

export function Wizard({ restaurantName, restaurantCity, retentionDays, operatorName, recentCouriers }: WizardProps) {
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [direction, setDirection] = useState(1);
  const [processing, setProcessing] = useState<Partial<Record<Slot, boolean>>>({});
  const [phase, setPhase] = useState<"edit" | "sealing" | "done">("edit");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [recent, setRecent] = useState<Courier[]>(recentCouriers);
  const geo = useRef<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Livreurs récents : cache local pour le mode hors ligne.
  useEffect(() => {
    try {
      if (recentCouriers.length) localStorage.setItem("remis-recent-couriers", JSON.stringify(recentCouriers));
      else setRecent(JSON.parse(localStorage.getItem("remis-recent-couriers") ?? "[]") as Courier[]);
    } catch {}
  }, [recentCouriers]);

  // Position du comptoir : uniquement si le restaurant l'a activée (consentement explicite dans les réglages).
  useEffect(() => {
    try {
      if (localStorage.getItem("remis-geo") !== "on" || !navigator.geolocation) return;
    } catch {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => (geo.current = { lat: Number(p.coords.latitude.toFixed(5)), lng: Number(p.coords.longitude.toFixed(5)), accuracy: Math.round(p.coords.accuracy) }),
      () => undefined,
      { maximumAge: 10 * 60_000, timeout: 8000 },
    );
  }, []);

  // Brouillon : restauré si l'app a été fermée en cours de remise.
  useEffect(() => {
    let alive = true;
    loadDraft().then((saved) => {
      if (!alive) return;
      if (saved && hasContent(saved)) {
        setDraft(saved);
        setRestored(true);
      }
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || phase !== "edit") return;
    const t = setTimeout(() => void saveDraft(draft), 250);
    return () => clearTimeout(t);
  }, [draft, hydrated, phase]);

  const update = useCallback((patch: Partial<Draft>) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const valid = useMemo(
    () => [
      Boolean(draft.platform && draft.order_ref.trim()),
      Object.keys(draft.photos).length > 0 && !Object.values(processing).some(Boolean),
      Boolean(draft.courier_name.trim() && draft.vehicle),
      draft.confirm_closed,
    ],
    [draft.platform, draft.order_ref, draft.photos, draft.courier_name, draft.vehicle, draft.confirm_closed, processing],
  );
  const step = draft.step;

  const go = useCallback((to: number) => {
    setDirection(to > draftRef.current.step ? 1 : -1);
    setDraft((d) => ({ ...d, step: to }));
    if (typeof window !== "undefined") document.getElementById("wizard-scroll")?.scrollTo({ top: 0 });
  }, []);

  const next = useCallback(() => {
    if (!valid[step] || step >= 3) {
      if (!valid[step]) haptic("error");
      return;
    }
    haptic("tap");
    (document.activeElement as HTMLElement | null)?.blur?.();
    go(step + 1);
  }, [valid, step, go]);

  const onFile = useCallback(
    async (slot: Slot, file: Blob) => {
      setProcessing((p) => ({ ...p, [slot]: true }));
      haptic("photo");
      const capturedAt = new Date();
      try {
        const d = draftRef.current;
        const processed = await processPhoto(file, { orderRef: d.order_ref, restaurantName, capturedAt });
        const photo: DraftPhoto = {
          slot,
          ...processed,
          captured_at: capturedAt.toISOString(),
          stampRef: d.order_ref,
          uploaded: { photo: false, orig: false, thumb: false },
        };
        setDraft((cur) => ({ ...cur, photos: { ...cur.photos, [slot]: photo } }));
        // Upload en tâche de fond : le scellé sera plus rapide. Échec silencieux (réessayé au scellé).
        uploadPhoto(d.id, photo)
          .then((uploaded) =>
            setDraft((cur) => (cur.photos[slot]?.captured_at === photo.captured_at ? { ...cur, photos: { ...cur.photos, [slot]: { ...cur.photos[slot]!, uploaded } } } : cur)),
          )
          .catch(() => undefined);
      } catch {
        setError("Photo illisible. Réessayez.");
        haptic("error");
      } finally {
        setProcessing((p) => ({ ...p, [slot]: false }));
      }
    },
    [restaurantName],
  );

  const onRemove = useCallback((slot: Slot) => {
    setDraft((cur) => {
      const photos = { ...cur.photos };
      delete photos[slot];
      return { ...cur, photos };
    });
  }, []);

  const seal = useCallback(async () => {
    const d = { ...draftRef.current, photos: { ...draftRef.current.photos } };
    setPhase("sealing");
    setError(null);
    const clientCapturedAt = new Date().toISOString();
    try {
      const sealResult = await submitDraft(d, { restaurantName, clientCapturedAt, offline: false, geo: geo.current, onProgress: setProgress });
      await clearDraft();
      setResult({ kind: "sealed", seal: sealResult, draft: d });
      setPhase("done");
    } catch (e) {
      if (e instanceof NetworkError) {
        try {
          await enqueue({ id: d.id, draft: d, client_captured_at: clientCapturedAt, queued_at: new Date().toISOString(), attempts: 1, last_error: e.message });
          await clearDraft();
          setResult({ kind: "queued", draft: d });
          setPhase("done");
          return;
        } catch {
          /* stockage indisponible : on garde la saisie à l'écran */
        }
      }
      haptic("error");
      setError(e instanceof Error ? e.message : "Scellé impossible");
      setDraft((cur) => ({ ...cur, confirm_closed: false }));
      setPhase("edit");
    }
  }, [restaurantName]);

  const reset = useCallback(() => {
    setResult(null);
    setRestored(false);
    setPhase("edit");
    setDirection(1);
    setDraft(newDraft());
  }, []);

  // Entrée = étape suivante (hors boutons, qui gèrent leur propre activation).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || phase !== "edit") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.tagName === "TEXTAREA" || target.closest("[data-testid=hold-to-seal]")) return;
    e.preventDefault();
    next();
  };

  const variants = {
    enter: (dir: number) => (reduce ? { opacity: 0 } : { x: dir * 48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => (reduce ? { opacity: 0 } : { x: dir * -48, opacity: 0 }),
  };

  if (phase === "done" && result) {
    return (
      <div className="steel fixed inset-0 z-40 overflow-y-auto">
        <div className="safe-top safe-bottom mx-auto flex min-h-full max-w-md flex-col px-4 pt-4">
          <Confirmation result={result} restaurantName={restaurantName} restaurantCity={restaurantCity} onNext={reset} />
        </div>
      </div>
    );
  }

  return (
    <div className="steel fixed inset-0 z-40 flex flex-col" onKeyDown={onKeyDown} data-testid="wizard">
      <header className="safe-top border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-2.5">
          <Link href="/app" aria-label="Fermer (le brouillon est conservé)" className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-line text-xl">
            ×
          </Link>
          <ol className="flex flex-1 gap-1" aria-label="Progression">
            {STEP_NAMES.map((name, i) => (
              <li key={name} className="flex-1">
                <button
                  type="button"
                  disabled={i > step && !valid.slice(0, i).every(Boolean)}
                  onClick={() => i !== step && go(i)}
                  aria-current={i === step ? "step" : undefined}
                  className="block w-full py-2"
                  aria-label={`Étape ${i + 1} : ${name}`}
                >
                  <span className={`block h-1.5 rounded-[1px] transition-colors ${i < step ? "bg-ink" : i === step ? "bg-accent" : "bg-line"}`} />
                </button>
              </li>
            ))}
          </ol>
          <span className="kicker w-16 text-right">{operatorName}</span>
        </div>
      </header>

      <main id="wizard-scroll" className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-md px-4 pb-8 pt-5">
          {restored ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-[3px] border border-line bg-raise px-3 py-2 text-[14px]">
              <span>Brouillon restauré{draft.order_ref ? ` · #${draft.order_ref}` : ""}</span>
              <button
                type="button"
                className="h-9 font-semibold text-warn underline decoration-dotted underline-offset-4"
                onClick={() => {
                  void clearDraft();
                  reset();
                }}
              >
                Recommencer
              </button>
            </div>
          ) : null}
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div key={step} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}>
              {step === 0 ? <StepOrder draft={draft} update={update} /> : null}
              {step === 1 ? <StepPhotos draft={draft} processing={processing} onFile={onFile} onRemove={onRemove} /> : null}
              {step === 2 ? <StepCourier draft={draft} update={update} recent={recent} /> : null}
              {step === 3 ? <StepSeal draft={draft} update={update} restaurantName={restaurantName} retentionDays={retentionDays} /> : null}
            </motion.div>
          </AnimatePresence>
          {error ? (
            <p role="alert" className="mt-4 rounded-[3px] border border-warn/50 bg-warn/10 px-3 py-2 text-[15px] font-semibold text-warn">
              {error}
            </p>
          ) : null}
        </div>
      </main>

      <footer className="safe-bottom border-t border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2.5 px-4 pt-3">
          {step > 0 ? (
            <Button variant="outline" size="xl" onClick={() => go(step - 1)} aria-label="Étape précédente" className="w-16 shrink-0 px-0" disabled={phase === "sealing"}>
              ←
            </Button>
          ) : null}
          {step < 3 ? (
            <Button size="xl" block onClick={next} disabled={!valid[step]} data-testid="next-step">
              Suivant <span aria-hidden>→</span>
            </Button>
          ) : phase === "sealing" ? (
            <div className="flex h-[68px] w-full items-center justify-center rounded-[3px] border-[1.5px] border-accent bg-accent/10 font-mono text-sm font-semibold uppercase tracking-wider text-accent" role="status">
              <span className="blink mr-2">●</span> {progress || "Scellé…"}
            </div>
          ) : (
            <HoldButton disabled={!valid[3]} onComplete={seal} />
          )}
        </div>
      </footer>
    </div>
  );
}
