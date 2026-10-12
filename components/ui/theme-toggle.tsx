"use client";
import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";
const LABELS: Record<Theme, string> = { auto: "Auto", light: "Jour", dark: "Soir" };

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("auto");
  useEffect(() => {
    try {
      const t = localStorage.getItem("remis-theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {}
  }, []);
  const apply = (t: Theme) => {
    setTheme(t);
    try {
      if (t === "auto") {
        localStorage.removeItem("remis-theme");
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem("remis-theme", t);
        document.documentElement.dataset.theme = t;
      }
    } catch {}
  };
  if (compact) {
    const next: Theme = theme === "auto" ? "dark" : theme === "dark" ? "light" : "auto";
    return (
      <button type="button" onClick={() => apply(next)} className="kicker h-9 rounded-[3px] border border-line px-2.5 text-ink hover:border-ink" aria-label={`Thème : ${LABELS[theme]}. Changer.`}>
        {theme === "dark" ? "◐" : theme === "light" ? "○" : "◑"} {LABELS[theme]}
      </button>
    );
  }
  return (
    <div role="radiogroup" aria-label="Thème" className="inline-flex rounded-[3px] border border-line bg-raise p-0.5">
      {(Object.keys(LABELS) as Theme[]).map((t) => (
        <button
          key={t}
          role="radio"
          aria-checked={theme === t}
          type="button"
          onClick={() => apply(t)}
          className={`h-10 min-w-16 rounded-[2px] px-3 text-sm font-semibold ${theme === t ? "bg-ink text-bg" : "text-muted"}`}
        >
          {LABELS[t]}
        </button>
      ))}
    </div>
  );
}
