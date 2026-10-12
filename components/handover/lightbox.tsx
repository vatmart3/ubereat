"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

export interface LightboxPhoto {
  src: string;
  label: string;
  caption: string;
}

/** Plein écran zoomable : pincer, double-tap (2,5×), molette ; glisser pour changer de photo. */
export function Lightbox({ photos, index, onClose, onIndex }: { photos: LightboxPhoto[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ d0: number; s0: number; x0: number; y0: number; px: number; py: number; swipeX: number } | null>(null);
  const lastTap = useRef(0);

  const reset = useCallback(() => setT({ s: 1, x: 0, y: 0 }), []);
  useEffect(reset, [index, reset]);

  const go = useCallback(
    (dir: number) => {
      if (index === null) return;
      const next = index + dir;
      if (next >= 0 && next < photos.length) onIndex(next);
    },
    [index, photos.length, onIndex],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose, go]);

  const photo = index !== null ? photos[index] : null;

  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  return (
    <AnimatePresence>
      {photo ? (
        <motion.div className="fixed inset-0 z-[80] flex flex-col bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-label={`Photo : ${photo.label}`}>
          <div className="safe-top flex items-center justify-between px-4 py-3 text-white">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">
                {index! + 1} / {photos.length} · {photo.caption}
              </div>
              <div className="font-semibold">{photo.label}</div>
            </div>
            <button type="button" onClick={onClose} className="h-11 rounded-[3px] border border-white/30 px-4 text-sm font-semibold" autoFocus>
              Fermer
            </button>
          </div>
          <div
            className="relative flex-1 touch-none overflow-hidden"
            onWheel={(e) => setT((p) => ({ ...p, s: Math.min(5, Math.max(1, p.s * (e.deltaY < 0 ? 1.12 : 0.89))) }))}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              gesture.current = { d0: dist(), s0: t.s, x0: t.x, y0: t.y, px: e.clientX, py: e.clientY, swipeX: 0 };
              const now = Date.now();
              if (pointers.current.size === 1 && now - lastTap.current < 280) {
                setT((p) => (p.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }));
                lastTap.current = 0;
              } else lastTap.current = now;
            }}
            onPointerMove={(e) => {
              if (!pointers.current.has(e.pointerId) || !gesture.current) return;
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              const g = gesture.current;
              if (pointers.current.size === 2) {
                if (!g.d0) g.d0 = dist();
                const s = Math.min(5, Math.max(1, g.s0 * (dist() / g.d0)));
                setT((p) => ({ ...p, s }));
              } else if (t.s > 1) {
                setT({ s: t.s, x: g.x0 + (e.clientX - g.px), y: g.y0 + (e.clientY - g.py) });
              } else {
                g.swipeX = e.clientX - g.px;
              }
            }}
            onPointerUp={(e) => {
              pointers.current.delete(e.pointerId);
              const g = gesture.current;
              if (g && t.s === 1 && Math.abs(g.swipeX) > 60) go(g.swipeX < 0 ? 1 : -1);
              if (pointers.current.size === 0) gesture.current = null;
              if (t.s <= 1.02) reset();
            }}
            onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              alt={photo.label}
              draggable={false}
              className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain transition-transform duration-75"
              style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}
            />
          </div>
          <div className="safe-bottom flex items-center justify-between px-4 py-3 text-white">
            <button type="button" onClick={() => go(-1)} disabled={index === 0} className="h-12 w-20 rounded-[3px] border border-white/30 text-xl disabled:opacity-25" aria-label="Photo précédente">
              ←
            </button>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">Pincer pour zoomer</span>
            <button type="button" onClick={() => go(1)} disabled={index === photos.length - 1} className="h-12 w-20 rounded-[3px] border border-white/30 text-xl disabled:opacity-25" aria-label="Photo suivante">
              →
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
