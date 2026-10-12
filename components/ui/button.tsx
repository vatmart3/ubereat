"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { haptic } from "@/lib/haptics";

type Variant = "primary" | "accent" | "ghost" | "outline" | "danger";
type Size = "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-bg border-ink hover:brightness-110 active:translate-y-px",
  accent: "bg-accent text-accent-ink border-accent hover:brightness-110 active:translate-y-px",
  ghost: "bg-transparent text-ink border-transparent hover:bg-surface",
  outline: "bg-raise text-ink border-line hover:border-ink active:translate-y-px",
  danger: "bg-raise text-warn border-warn/50 hover:border-warn",
};

const SIZES: Record<Size, string> = {
  md: "h-11 px-4 text-[15px]",
  lg: "h-14 px-5 text-base",
  xl: "h-16 px-6 text-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "lg", block, className = "", onClick, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      onClick={(e) => {
        haptic("tap");
        onClick?.(e);
      }}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-[3px] border-[1.5px] font-semibold tracking-tight transition-[filter,transform,border-color,background-color] duration-150 disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
});
