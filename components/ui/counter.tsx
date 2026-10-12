"use client";
import { animate, useMotionValue, useReducedMotion, useTransform, motion } from "framer-motion";
import { useEffect } from "react";

/** Compteur qui s'incrémente (tabular-nums). */
export function Counter({ value, format = (n) => String(Math.round(n)), className = "" }: { value: number; format?: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, reduce, mv]);
  return <motion.span className={`tabular ${className}`}>{text}</motion.span>;
}
