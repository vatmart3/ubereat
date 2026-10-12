"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { SLOT_META } from "@/lib/platforms";
import { formatTime } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { SLOTS, type Slot } from "@/lib/types";
import type { Draft } from "@/lib/offline/types";
import { StepTitle } from "./field";
import { Viewfinder } from "./viewfinder";

export function StepPhotos({
  draft,
  processing,
  onFile,
  onRemove,
}: {
  draft: Draft;
  processing: Partial<Record<Slot, boolean>>;
  onFile: (slot: Slot, file: Blob) => void;
  onRemove: (slot: Slot) => void;
}) {
  const reduce = useReducedMotion();
  const [viewfinderPref, setViewfinderPref] = useState(false);
  const [viewfinderSlot, setViewfinderSlot] = useState<Slot | null>(null);

  useEffect(() => {
    try {
      setViewfinderPref(localStorage.getItem("remis-viewfinder") === "on");
    } catch {}
  }, []);

  const urls = useMemo(() => {
    const out: Partial<Record<Slot, string>> = {};
    for (const slot of SLOTS) {
      const p = draft.photos[slot];
      if (p) out[slot] = URL.createObjectURL(p.stamped);
    }
    return out;
  }, [draft.photos]);
  useEffect(() => () => Object.values(urls).forEach((u) => u && URL.revokeObjectURL(u)), [urls]);

  const count = Object.keys(draft.photos).length;

  return (
    <div>
      <StepTitle index={1} title="Les photos" hint="Une photo minimum. Photographiez le sac, pas le visage." />
      <div className="grid grid-cols-3 gap-2.5">
        {SLOTS.map((slot) => {
          const photo = draft.photos[slot];
          const busy = processing[slot];
          const inputId = `photo-${slot}`;
          return (
            <div key={slot} className="flex flex-col">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[3px] border-[1.5px] border-dashed border-line bg-raise">
                <AnimatePresence initial={false}>
                  {photo && urls[slot] ? (
                    <motion.div
                      key={photo.captured_at}
                      className="absolute inset-0"
                      initial={reduce ? { opacity: 0 } : { scale: 0.82, opacity: 0, rotate: -2 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 420, damping: 22 }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urls[slot]} alt={SLOT_META[slot].label} className="h-full w-full object-cover" data-testid={`thumb-${slot}`} />
                      <span className="absolute bottom-1 left-1 rounded-[2px] bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white tabular">{formatTime(photo.captured_at)}</span>
                      <button
                        type="button"
                        aria-label={`Supprimer la photo ${SLOT_META[slot].label}`}
                        onClick={() => {
                          haptic("tap");
                          onRemove(slot);
                        }}
                        className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1.5"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-lg leading-none text-white">×</span>
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                {!photo ? (
                  viewfinderPref ? (
                    <button type="button" onClick={() => setViewfinderSlot(slot)} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
                      <CameraGlyph />
                      <span className="kicker">Viseur</span>
                    </button>
                  ) : (
                    <label htmlFor={inputId} className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 text-muted active:bg-surface">
                      <CameraGlyph />
                      <span className="kicker">Photo</span>
                    </label>
                  )
                ) : null}
                {busy ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-raise/80">
                    <span className="kicker blink">Traitement…</span>
                  </div>
                ) : null}
                <input
                  id={inputId}
                  data-testid={`input-${slot}`}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) onFile(slot, file);
                  }}
                />
              </div>
              <div className="mt-1.5 text-[13px] font-semibold leading-tight">{SLOT_META[slot].label}</div>
              <div className="text-[11.5px] leading-tight text-muted">{SLOT_META[slot].hint}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="kicker tabular" aria-live="polite">
          {count}/3 photo{count > 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = !viewfinderPref;
            setViewfinderPref(next);
            try {
              localStorage.setItem("remis-viewfinder", next ? "on" : "off");
            } catch {}
          }}
          className="text-sm font-semibold text-muted underline decoration-dotted underline-offset-4"
        >
          {viewfinderPref ? "Utiliser l'appareil photo du téléphone" : "Viseur plein écran"}
        </button>
      </div>

      {viewfinderSlot ? (
        <Viewfinder
          slot={viewfinderSlot}
          onClose={() => setViewfinderSlot(null)}
          onCapture={(blob) => {
            const current = viewfinderSlot;
            onFile(current, blob);
            const nextEmpty = SLOTS.find((s) => s !== current && !draft.photos[s]);
            setViewfinderSlot(nextEmpty ?? null);
          }}
        />
      ) : null}
    </div>
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
