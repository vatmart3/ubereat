"use client";
import { useReducedMotion } from "framer-motion";
import { useRef } from "react";

/** Léger tilt 3D CSS au survol (pointeur fin uniquement — pas de coût sur mobile). */
export function Tilt({ children, max = 7, className = "" }: { children: React.ReactNode; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const set = (rx: number, ry: number, glare: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    el.style.setProperty("--glare", String(glare));
  };
  return (
    <div className={`[perspective:900px] ${className}`}>
      <div
        ref={ref}
        className="relative transition-transform duration-200 ease-out [transform-style:preserve-3d]"
        onPointerMove={(e) => {
          if (reduce || e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          set(-py * max, px * max, 0.12 + Math.abs(px) * 0.2);
        }}
        onPointerLeave={() => set(0, 0, 0)}
      >
        {children}
      </div>
    </div>
  );
}
