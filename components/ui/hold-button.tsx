"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";

/**
 * « Maintenir pour sceller » : appui long (0,7 s par défaut), remplissage de gauche à droite.
 * Relâcher avant la fin annule (évite les scellés accidentels). Clavier : maintenir Espace ou Entrée.
 */
export function HoldButton({
  onComplete,
  disabled,
  duration = 700,
  label = "Maintenir pour sceller",
  doneLabel = "Scellé",
  hint = "Appui long · 1 s",
  disabledHint = "Complétez la remise",
}: {
  onComplete: () => void;
  disabled?: boolean;
  duration?: number;
  label?: string;
  doneLabel?: string;
  hint?: string;
  disabledHint?: string;
}) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const frame = useRef<number | null>(null);
  const start = useRef<number | null>(null);
  const holding = useRef(false);

  const stop = useCallback(() => {
    holding.current = false;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    start.current = null;
    if (!done) setProgress(0);
  }, [done]);

  const tick = useCallback(
    (t: number) => {
      if (!holding.current) return;
      start.current ??= t;
      const p = Math.min(1, (t - start.current) / duration);
      setProgress(p);
      if (p >= 1) {
        holding.current = false;
        setDone(true);
        haptic("seal");
        onComplete();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    },
    [duration, onComplete],
  );

  const begin = useCallback(() => {
    if (disabled || done || holding.current) return;
    holding.current = true;
    haptic("tap");
    frame.current = requestAnimationFrame(tick);
  }, [disabled, done, tick]);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
  }, []);
  useEffect(() => {
    if (disabled) setDone(false);
  }, [disabled]);

  return (
    <button
      type="button"
      data-testid="hold-to-seal"
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={`${label} (maintenir 1 seconde)`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        begin();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") stop();
      }}
      className="relative h-[68px] w-full touch-none overflow-hidden rounded-[3px] border-[1.5px] border-ink bg-raise text-ink disabled:border-line disabled:text-muted"
      style={{ WebkitTouchCallout: "none" }}
    >
      <span
        aria-hidden
        className="hold-fill absolute inset-0 bg-accent"
        style={{ transform: `scaleX(${progress})`, transition: progress === 0 ? "transform 220ms ease-out" : "none" }}
      />
      <span className="relative z-10 flex items-center justify-center gap-3 font-display text-[26px] font-black uppercase tracking-wide">
        <span style={{ color: progress > 0.5 ? "var(--accent-ink)" : undefined }}>{done ? doneLabel : label}</span>
      </span>
      <span aria-hidden className="absolute inset-x-3 bottom-1.5 z-10 truncate text-center font-mono text-[10px] uppercase tracking-[0.1em] opacity-70" style={{ color: progress > 0.5 ? "var(--accent-ink)" : undefined }}>
        {disabled ? disabledHint : hint}
      </span>
    </button>
  );
}
