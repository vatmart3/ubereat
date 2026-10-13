"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { formatTime, normalizeCourierName } from "@/lib/format";
import { processPhoto } from "@/lib/image/stamp";
import { clearDraft, enqueue, loadDraft, saveDraft } from "@/lib/offline/store";
import { NetworkError, submitDraft, uploadPhoto } from "@/lib/offline/submit";
import type { Draft, DraftPhoto } from "@/lib/offline/types";
import { PLATFORM_META, SLOT_META, VEHICLE_META } from "@/lib/platforms";
import { PLATFORMS, SLOTS, VEHICLES, type Courier, type Platform, type Slot } from "@/lib/types";
import { HoldButton } from "@/components/ui/hold-button";
import { SignaturePad, type SignaturePadHandle } from "@/components/ui/signature-pad";
import { Confirmation, type WizardResult } from "./confirmation";

/**
 * Remise express : un seul écran, pensé pour le rush.
 * Plateforme mémorisée → n° de commande → photo du sac → un tap sur le livreur → maintenir pour sceller.
 * Montant, articles, code et signature restent disponibles, repliés.
 */

const LAST_PLATFORM_KEY = "remis-last-platform";

function lastPlatform(): Platform {
  try {
    const v = localStorage.getItem(LAST_PLATFORM_KEY);
    if (v && (PLATFORMS as readonly string[]).includes(v)) return v as Platform;
  } catch {}
  return "uber";
}

function newDraft(platform: Platform | null = null): Draft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    step: 0,
    platform,
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

const hasContent = (d: Draft) => Boolean(d.order_ref || Object.keys(d.photos).length || d.courier_name);

export function missingFields(d: Draft, processing: boolean): string[] {
  const m: string[] = [];
  if (!d.platform) m.push("plateforme");
  if (!d.order_ref.trim()) m.push("n° de commande");
  if (!Object.keys(d.photos).length || processing) m.push("photo");
  if (!d.courier_name.trim() || !d.vehicle) m.push("livreur");
  return m;
}

export interface WizardProps {
  restaurantName: string;
  restaurantCity: string;
  retentionDays: number;
  operatorName: string;
  recentCouriers: Courier[];
}

export function Wizard({ restaurantName, restaurantCity, retentionDays, operatorName, recentCouriers }: WizardProps) {
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState<Draft>(() => newDraft());
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [phase, setPhase] = useState<"edit" | "sealing" | "done">("edit");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [recent, setRecent] = useState<Courier[]>(recentCouriers);
  const [otherCourier, setOtherCourier] = useState(false);
  const [more, setMore] = useState(false);
  const geo = useRef<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const orderInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pad = useRef<SignaturePadHandle>(null);

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

  // Brouillon restauré si l'app a été fermée en cours de remise ; sinon plateforme mémorisée.
  useEffect(() => {
    let alive = true;
    loadDraft().then((saved) => {
      if (!alive) return;
      if (saved && hasContent(saved)) {
        setDraft(saved);
        setRestored(true);
        setMore(Boolean(saved.amount || saved.pickup_code || saved.signature));
      } else {
        setDraft((d) => ({ ...d, platform: d.platform ?? lastPlatform() }));
      }
      setHydrated(true);
      requestAnimationFrame(() => orderInput.current?.focus());
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

  const missing = useMemo(() => missingFields(draft, processing), [draft, processing]);
  const nextSlot = SLOTS.find((s) => !draft.photos[s]);

  const pickPlatform = (platform: Platform) => {
    haptic("tap");
    update({ platform });
    try {
      localStorage.setItem(LAST_PLATFORM_KEY, platform);
    } catch {}
    // Le curseur reste sur le n° de commande : on tape directement.
    requestAnimationFrame(() => orderInput.current?.focus());
  };

  const onFile = useCallback(
    async (file: Blob) => {
      const slot = SLOTS.find((s) => !draftRef.current.photos[s]);
      if (!slot) return;
      setProcessing(true);
      haptic("photo");
      const capturedAt = new Date();
      try {
        const d = draftRef.current;
        const processed = await processPhoto(file, { orderRef: d.order_ref, restaurantName, capturedAt });
        const photo: DraftPhoto = { slot, ...processed, captured_at: capturedAt.toISOString(), stampRef: d.order_ref, uploaded: { photo: false, orig: false, thumb: false } };
        setDraft((cur) => ({ ...cur, photos: { ...cur.photos, [slot]: photo } }));
        // Upload en tâche de fond : le scellé n'aura plus qu'à vérifier. Échec silencieux (réessayé au scellé).
        uploadPhoto(d.id, photo)
          .then((uploaded) =>
            setDraft((cur) => (cur.photos[slot]?.captured_at === photo.captured_at ? { ...cur, photos: { ...cur.photos, [slot]: { ...cur.photos[slot]!, uploaded } } } : cur)),
          )
          .catch(() => undefined);
      } catch {
        setError("Photo illisible. Réessayez.");
        haptic("error");
      } finally {
        setProcessing(false);
      }
    },
    [restaurantName],
  );

  const removePhoto = (slot: Slot) => {
    haptic("tap");
    setDraft((cur) => {
      const photos = { ...cur.photos };
      delete photos[slot];
      return { ...cur, photos };
    });
  };

  const seal = useCallback(async () => {
    const d = { ...draftRef.current, photos: { ...draftRef.current.photos }, confirm_closed: true };
    if (pad.current && !pad.current.isEmpty()) d.signature = (await pad.current.toBlob()) ?? d.signature;
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
      setPhase("edit");
    }
  }, [restaurantName]);

  const reset = useCallback(() => {
    setResult(null);
    setRestored(false);
    setPhase("edit");
    setOtherCourier(false);
    setMore(false);
    setDraft(newDraft(lastPlatform()));
    requestAnimationFrame(() => orderInput.current?.focus());
  }, []);

  if (phase === "done" && result) {
    return (
      <div className="steel fixed inset-0 z-40 overflow-y-auto">
        <div className="safe-top safe-bottom mx-auto flex min-h-full max-w-md flex-col px-4 pt-4">
          <Confirmation result={result} restaurantName={restaurantName} restaurantCity={restaurantCity} onNext={reset} />
        </div>
      </div>
    );
  }

  const photoSlots = SLOTS.filter((s) => draft.photos[s]);

  return (
    <div className="steel fixed inset-0 z-40 flex flex-col" data-testid="wizard">
      <header className="safe-top border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-2.5">
          <Link href="/app" aria-label="Fermer (le brouillon est conservé)" className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-line text-xl">
            ×
          </Link>
          <div className="min-w-0 flex-1">
            <div className="kicker">Remise express</div>
            <h1 className="display text-[30px]">Nouvelle remise</h1>
          </div>
          <span className="kicker">{operatorName}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-md space-y-5 px-4 pb-8 pt-4">
          {restored ? (
            <div className="flex items-center justify-between gap-3 rounded-[3px] border border-line bg-raise px-3 py-2 text-[14px]">
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

          {/* Plateforme (mémorisée) + n° de commande */}
          <section>
            <div role="radiogroup" aria-label="Plateforme" className="rail -mx-4 flex gap-2 overflow-x-auto px-4">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={draft.platform === p}
                  data-testid={`platform-${p}`}
                  onClick={() => pickPlatform(p)}
                  className={`flex h-11 shrink-0 items-center gap-2 rounded-[3px] border-[1.5px] px-3.5 text-[15px] font-semibold ${draft.platform === p ? "border-ink bg-ink text-bg" : "border-line bg-raise"}`}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: PLATFORM_META[p].color }} />
                  {PLATFORM_META[p].short}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-stretch rounded-[3px] border-[1.5px] border-line bg-raise focus-within:border-ink">
              <span className="display flex items-center pl-3 text-[40px] text-muted">#</span>
              <input
                ref={orderInput}
                data-testid="order-ref"
                aria-label="N° de commande"
                value={draft.order_ref}
                onChange={(e) => update({ order_ref: e.target.value.toUpperCase().replace(/^#/, "").slice(0, 40) })}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  e.currentTarget.blur();
                  // Entrée : on enchaîne directement sur l'appareil photo.
                  if (!Object.keys(draftRef.current.photos).length) fileInput.current?.click();
                }}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="N° de commande"
                className="display h-[68px] w-full min-w-0 bg-transparent px-2 text-[40px] placeholder:text-[28px] placeholder:text-line focus:outline-none"
              />
            </div>
          </section>

          {/* Photo du sac */}
          <section aria-label="Photos">
            <div className="kicker mb-2">Photo · le sac, pas le visage</div>
            <input
              ref={fileInput}
              id="photo-input"
              data-testid="photo-input"
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onFile(file);
              }}
            />
            {photoSlots.length === 0 ? (
              <label htmlFor="photo-input" className="flex h-[92px] cursor-pointer items-center gap-4 rounded-[3px] border-[1.5px] border-dashed border-ink/40 bg-raise px-5 active:bg-surface" data-testid="photo-cta">
                <CameraGlyph />
                <span>
                  <span className="block text-[18px] font-semibold">{processing ? "Traitement…" : "Photo du sac"}</span>
                  <span className="text-[13px] text-muted">Un tap : l&apos;appareil photo s&apos;ouvre</span>
                </span>
              </label>
            ) : (
              <div className="flex gap-2.5">
                <AnimatePresence initial={false}>
                  {photoSlots.map((s) => (
                    <PhotoThumb key={draft.photos[s]!.captured_at} slot={s} blob={draft.photos[s]!.stamped} time={draft.photos[s]!.captured_at} onRemove={() => removePhoto(s)} reduce={Boolean(reduce)} />
                  ))}
                </AnimatePresence>
                {nextSlot ? (
                  <label htmlFor="photo-input" className="flex h-[116px] w-[92px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[3px] border-[1.5px] border-dashed border-line bg-raise text-muted">
                    <span className="text-2xl">+</span>
                    <span className="kicker">{processing ? "…" : "Autre"}</span>
                  </label>
                ) : null}
              </div>
            )}
          </section>

          {/* Livreur : un tap */}
          <section aria-label="Livreur">
            <div className="kicker mb-2">Livreur · un tap</div>
            <div className="flex flex-wrap gap-2">
              {recent.map((c) => {
                const active = !otherCourier && draft.courier_name === c.display_name;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-testid="recent-courier"
                    aria-pressed={active}
                    onClick={() => {
                      haptic("tap");
                      setOtherCourier(false);
                      update({ courier_name: c.display_name, vehicle: c.vehicle, pickup_code: c.last_code ?? "" });
                    }}
                    className={`flex h-12 items-center gap-2 rounded-[3px] border-[1.5px] px-3.5 text-[15px] font-semibold ${active ? "border-ink bg-ink text-bg" : "border-line bg-raise"}`}
                  >
                    <span aria-hidden className="text-lg">
                      {VEHICLE_META[c.vehicle].emoji}
                    </span>
                    {c.display_name}
                  </button>
                );
              })}
              <button
                type="button"
                data-testid="other-courier"
                aria-pressed={otherCourier}
                onClick={() => {
                  setOtherCourier(true);
                  update({ courier_name: "", vehicle: draft.vehicle ?? "velo", pickup_code: "" });
                }}
                className={`h-12 rounded-[3px] border-[1.5px] px-3.5 text-[15px] font-semibold ${otherCourier ? "border-ink bg-ink text-bg" : "border-dashed border-line bg-raise"}`}
              >
                + Autre
              </button>
            </div>
            {otherCourier || recent.length === 0 ? (
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input
                  data-testid="courier-name"
                  aria-label="Prénom + initiale du livreur"
                  autoFocus={otherCourier}
                  value={draft.courier_name}
                  onChange={(e) => update({ courier_name: e.target.value.slice(0, 40), vehicle: draft.vehicle ?? "velo" })}
                  onBlur={(e) => update({ courier_name: normalizeCourierName(e.target.value) })}
                  autoCapitalize="words"
                  autoComplete="off"
                  placeholder="Prénom + initiale"
                  className="h-12 min-w-0 rounded-[3px] border-[1.5px] border-line bg-raise px-3 text-[17px] font-semibold placeholder:font-normal placeholder:text-muted focus:border-ink focus:outline-none"
                />
                <div role="radiogroup" aria-label="Véhicule" className="flex gap-1">
                  {VEHICLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={draft.vehicle === v}
                      aria-label={VEHICLE_META[v].label}
                      data-testid={`vehicle-${v}`}
                      onClick={() => update({ vehicle: v })}
                      className={`h-12 w-11 rounded-[3px] border-[1.5px] text-xl ${draft.vehicle === v ? "border-ink bg-ink" : "border-line bg-raise"}`}
                    >
                      {VEHICLE_META[v].emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {/* Détails facultatifs, repliés */}
          <section>
            <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} data-testid="more-toggle" className="text-[14px] font-semibold text-muted underline decoration-dotted underline-offset-4">
              {more ? "− Moins de détails" : "+ Montant, articles, code, signature (facultatif)"}
            </button>
            {more ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <label className="flex h-14 items-center rounded-[3px] border-[1.5px] border-line bg-raise px-3 focus-within:border-ink">
                    <span className="sr-only">Montant</span>
                    <input
                      data-testid="amount"
                      value={draft.amount}
                      onChange={(e) => update({ amount: e.target.value.replace(/[^\d,.]/g, "").slice(0, 9) })}
                      inputMode="decimal"
                      placeholder="Montant 0,00"
                      className="tabular w-full min-w-0 bg-transparent font-mono text-[20px] font-semibold placeholder:text-[15px] placeholder:font-normal placeholder:text-muted focus:outline-none"
                    />
                    <span className="font-mono text-muted">€</span>
                  </label>
                  <div className="flex h-14 items-center rounded-[3px] border-[1.5px] border-line bg-raise" aria-label="Articles">
                    <button type="button" aria-label="Un article de moins" disabled={draft.items_count <= 1} onClick={() => update({ items_count: Math.max(1, draft.items_count - 1) })} className="h-full w-11 text-2xl disabled:text-line">
                      −
                    </button>
                    <output className="tabular w-8 text-center font-mono text-[20px] font-semibold">{draft.items_count}</output>
                    <button type="button" aria-label="Un article de plus" onClick={() => update({ items_count: Math.min(999, draft.items_count + 1) })} className="h-full w-11 text-2xl">
                      +
                    </button>
                  </div>
                </div>
                <input
                  aria-label="Code de retrait"
                  value={draft.pickup_code}
                  onChange={(e) => update({ pickup_code: e.target.value.slice(0, 20) })}
                  placeholder="Code de retrait"
                  autoComplete="off"
                  className="tabular h-12 w-full rounded-[3px] border-[1.5px] border-line bg-raise px-3 font-mono text-[18px] placeholder:font-sans placeholder:text-[15px] placeholder:text-muted focus:border-ink focus:outline-none"
                />
                <div className="plate overflow-hidden p-0">
                  <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                    <span className="kicker">Signature du livreur</span>
                    <button type="button" onClick={() => pad.current?.clear()} className="h-9 px-2 text-sm font-semibold text-muted underline decoration-dotted underline-offset-4">
                      Effacer
                    </button>
                  </div>
                  <div className="on-paper">
                    <SignaturePad
                      ref={pad}
                      height={130}
                      initial={draft.signature}
                      onChange={(empty) => empty && update({ signature: null })}
                      onStrokeEnd={async () => update({ signature: (await pad.current?.toBlob()) ?? null })}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {error ? (
            <p role="alert" className="rounded-[3px] border border-warn/50 bg-warn/10 px-3 py-2 text-[15px] font-semibold text-warn">
              {error}
            </p>
          ) : null}
        </div>
      </main>

      <footer className="safe-bottom border-t border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto max-w-md space-y-2 px-4 pt-3">
          {phase === "sealing" ? (
            <div className="flex h-[68px] w-full items-center justify-center rounded-[3px] border-[1.5px] border-accent bg-accent/10 font-mono text-sm font-semibold uppercase tracking-wider text-accent" role="status">
              <span className="blink mr-2">●</span> {progress || "Scellé…"}
            </div>
          ) : (
            <HoldButton disabled={missing.length > 0} onComplete={seal} hint="Appui long · sac fermé et complet" disabledHint={`Il manque : ${missing.join(", ")}`} />
          )}
          <p className="text-center text-[11.5px] leading-snug text-muted" data-testid="rgpd-notice">
            En scellant, vous confirmez le sac remis fermé et complet. Livreur informé : prénom + initiale, photos du sac, {retentionDays} jours, aucune reconnaissance faciale.
          </p>
        </div>
      </footer>
    </div>
  );
}

function PhotoThumb({ slot, blob, time, onRemove, reduce }: { slot: Slot; blob: Blob; time: string; onRemove: () => void; reduce: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return (
    <motion.div
      className="relative h-[116px] w-[92px] shrink-0 overflow-hidden rounded-[3px] bg-raise"
      initial={reduce ? { opacity: 0 } : { scale: 0.82, opacity: 0, rotate: -2 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={SLOT_META[slot].label} className="h-full w-full object-cover" data-testid={`thumb-${slot}`} /> : null}
      <span className="absolute bottom-1 left-1 rounded-[2px] bg-black/75 px-1 font-mono text-[10.5px] text-white tabular">{formatTime(time)}</span>
      <button type="button" aria-label={`Supprimer la photo ${SLOT_META[slot].label}`} onClick={onRemove} className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-lg leading-none text-white">×</span>
      </button>
    </motion.div>
  );
}

function CameraGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z" />
      <circle cx="12" cy="13.2" r="3.6" />
    </svg>
  );
}
