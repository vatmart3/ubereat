"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { haptic } from "@/lib/haptics";

/** Tampon encreur : s'écrase avec rebond, puis une onde d'encre se diffuse. */
export function InkStamp({
  label = "Remis",
  time,
  delay = 0,
  animated = true,
  tone = "accent",
  className = "",
  size = "lg",
}: {
  label?: string;
  time?: string;
  delay?: number;
  animated?: boolean;
  tone?: "accent" | "warn" | "muted";
  className?: string;
  size?: "md" | "lg";
}) {
  const reduce = useReducedMotion();
  const play = animated && !reduce;
  const color = tone === "accent" ? undefined : tone === "warn" ? "var(--warn)" : "var(--muted)";

  useEffect(() => {
    if (!animated) return;
    const t = setTimeout(() => haptic("seal"), (delay + 0.12) * 1000);
    return () => clearTimeout(t);
  }, [animated, delay]);

  return (
    <div className={`pointer-events-none relative inline-block ${className}`} data-testid="ink-stamp">
      {play ? (
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 h-24 w-40 rounded-[50%]"
          style={{
            background: `radial-gradient(closest-side, color-mix(in srgb, ${color ?? "#2F3BD1"} 35%, transparent), transparent)`,
            animation: `ink-ripple 700ms cubic-bezier(.2,.7,.3,1) ${delay + 0.16}s both`,
          }}
        />
      ) : null}
      <motion.div
        className="stamp"
        style={color ? ({ "--stamp-color": color } as React.CSSProperties) : undefined}
        initial={play ? { scale: 2.6, opacity: 0, rotate: -22, y: -30 } : { rotate: -8, opacity: 0.92 }}
        animate={{ scale: 1, opacity: 0.92, rotate: -8, y: 0 }}
        transition={play ? { delay, type: "spring", stiffness: 560, damping: 17, mass: 0.9 } : { duration: 0 }}
      >
        <span className={size === "lg" ? "text-[44px] leading-none" : "text-[26px] leading-none"}>{label}</span>
        {time ? <span className={`font-mono font-semibold tabular ${size === "lg" ? "text-[18px]" : "text-[12px]"}`}>{time}</span> : null}
      </motion.div>
    </div>
  );
}
