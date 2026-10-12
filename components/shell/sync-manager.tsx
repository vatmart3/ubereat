"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { listQueue, QUEUE_EVENT, removeQueued, updateQueued } from "@/lib/offline/store";
import { NetworkError, RejectedError, submitDraft } from "@/lib/offline/submit";

/**
 * Synchronise la file d'attente hors ligne au retour du réseau.
 * `client_captured_at` d'origine est conservé ; le `sealed_at` serveur fait foi.
 */
export function SyncManager({ restaurantName }: { restaurantName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [online, setOnline] = useState(true);
  const running = useRef(false);

  const refreshCount = useCallback(async () => {
    const q = await listQueue();
    setPending(q.length);
    setFailed(q.filter((i) => i.last_error?.startsWith("Refusé")).length);
  }, []);

  const flush = useCallback(async () => {
    if (running.current || !navigator.onLine) return;
    running.current = true;
    let sealedAny = false;
    try {
      for (const item of await listQueue()) {
        try {
          await submitDraft(item.draft, { restaurantName, clientCapturedAt: item.client_captured_at, offline: true });
          await removeQueued(item.id);
          sealedAny = true;
        } catch (e) {
          if (e instanceof RejectedError && e.status === 409) {
            // Déjà scellée (réponse perdue lors d'un précédent essai) : rien à refaire.
            await removeQueued(item.id);
            sealedAny = true;
          } else if (e instanceof NetworkError) {
            await updateQueued({ ...item, attempts: item.attempts + 1, last_error: e.message });
            break;
          } else {
            await updateQueued({ ...item, attempts: item.attempts + 1, last_error: `Refusé : ${e instanceof Error ? e.message : "erreur"}` });
          }
        }
      }
    } finally {
      running.current = false;
      await refreshCount();
      if (sealedAny) router.refresh();
    }
  }, [restaurantName, refreshCount, router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshCount().then(flush);
    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    const onQueue = () => void refreshCount();
    const onVisible = () => document.visibilityState === "visible" && void flush();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(QUEUE_EVENT, onQueue);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => void flush(), 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(QUEUE_EVENT, onQueue);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [flush, refreshCount]);

  if (online && pending === 0) return null;
  return (
    <div role="status" className={`border-b px-4 py-2 text-center font-mono text-[12px] font-semibold uppercase tracking-wider ${online ? "border-accent/30 bg-accent/10 text-accent" : "border-warn/40 bg-warn/15 text-warn"}`}>
      {!online ? "Hors ligne · les remises restent sur ce téléphone" : null}
      {online && pending > 0 ? (
        <button type="button" onClick={() => void flush()} className="uppercase">
          {pending} remise{pending > 1 ? "s" : ""} en attente de scellé{failed ? ` · ${failed} refusée${failed > 1 ? "s" : ""}` : ""} · réessayer
        </button>
      ) : null}
      {!online && pending > 0 ? ` · ${pending} en attente` : null}
    </div>
  );
}
