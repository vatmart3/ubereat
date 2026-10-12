"use client";
import { useEffect } from "react";
import { haptic } from "@/lib/haptics";

/** Pavé PIN 4 chiffres, gros boutons au pouce. Clavier physique accepté. */
export function PinPad({ value, onChange, onComplete, disabled }: { value: string; onChange: (v: string) => void; onComplete: (v: string) => void; disabled?: boolean }) {
  const press = (d: string) => {
    if (disabled || value.length >= 4) return;
    haptic("tap");
    const next = value + d;
    onChange(next);
    if (next.length === 4) onComplete(next);
  };
  const back = () => !disabled && onChange(value.slice(0, -1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div>
      <div className="flex justify-center gap-4 py-4" aria-label={`${value.length} chiffre(s) saisi(s) sur 4`} role="status">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 border-ink transition-colors ${i < value.length ? "bg-ink" : ""}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} disabled={disabled} className="tabular h-[68px] rounded-[3px] border-[1.5px] border-line bg-raise font-mono text-[28px] font-semibold active:bg-ink active:text-bg" data-testid={`pin-${d}`}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press("0")} disabled={disabled} className="tabular h-[68px] rounded-[3px] border-[1.5px] border-line bg-raise font-mono text-[28px] font-semibold active:bg-ink active:text-bg" data-testid="pin-0">
          0
        </button>
        <button type="button" onClick={back} disabled={disabled} aria-label="Effacer un chiffre" className="h-[68px] rounded-[3px] font-mono text-[22px] text-muted">
          ⌫
        </button>
      </div>
    </div>
  );
}
