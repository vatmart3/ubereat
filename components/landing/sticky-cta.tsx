"use client";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { TRIAL_DAYS } from "@/lib/landing-content";

/** CTA collant (mobile) : apparaît après le hero, disparaît sur le CTA final. */
export function StickyCta() {
  const { scrollY } = useScroll();
  const [show, setShow] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    const end = document.getElementById("cta-final")?.getBoundingClientRect().top ?? Infinity;
    setShow(y > window.innerHeight * 1.2 && end > window.innerHeight);
  });
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur md:hidden"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 320 }}
        >
          <Link href="/login" className="flex h-14 items-center justify-center rounded-[3px] bg-ink text-[17px] font-semibold text-bg">
            Essayer gratuitement {TRIAL_DAYS} jours
          </Link>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
