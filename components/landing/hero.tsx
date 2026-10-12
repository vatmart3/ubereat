"use client";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PRICE_EUROS, TRIAL_DAYS } from "@/lib/landing-content";

const BagScene = dynamic(() => import("./bag-scene"), { ssr: false });

const CAPTIONS = ["Le sac est fermé", "Le ticket sort", "Le tampon descend", "Scellé · 14:32:07"];

/** Affiche statique (avant chargement 3D, ou si mouvement réduit). */
function BagPoster() {
  return (
    <svg viewBox="0 0 300 300" className="h-full w-full" role="img" aria-label="Sac kraft scellé avec son ticket tamponné">
      <ellipse cx="150" cy="276" rx="92" ry="10" fill="black" opacity=".18" />
      <rect x="78" y="86" width="144" height="186" rx="3" fill="#C39A6B" />
      <rect x="76" y="80" width="148" height="22" fill="#A97F52" />
      <rect x="106" y="34" width="84" height="122" fill="#FFFFFD" />
      <text x="114" y="56" fontFamily="Arial Narrow, Arial" fontWeight="900" fontSize="16" fill="#15181B">REMIS.</text>
      <text x="113" y="82" fontFamily="Arial Narrow, Arial" fontWeight="900" fontSize="22" fill="#15181B">#UB-4821</text>
      {[96, 106, 116, 126].map((y) => (
        <rect key={y} x="114" y={y} width={y === 116 ? 48 : 66} height="3" fill="#9AA3A9" />
      ))}
      <g transform="rotate(-9 150 118)">
        <rect x="120" y="102" width="62" height="34" fill="none" stroke="#2F3BD1" strokeWidth="4" />
        <text x="151" y="125" textAnchor="middle" fontFamily="Arial Narrow, Arial" fontWeight="900" fontSize="17" fill="#2F3BD1">REMIS</text>
      </g>
      <circle cx="190" cy="200" r="17" fill="#2F3BD1" />
      <circle cx="190" cy="200" r="12" fill="none" stroke="#DFE2FF" strokeWidth="1.5" />
    </svg>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [load3d, setLoad3d] = useState(false);
  const [caption, setCaption] = useState(0);

  // La 3D n'est chargée qu'au premier geste (ou après 4 s) : le texte et le CTA s'affichent instantanément.
  useEffect(() => {
    if (reduce) return;
    const go = () => setLoad3d(true);
    const t = setTimeout(go, 4000);
    const opts = { once: true, passive: true } as const;
    window.addEventListener("scroll", go, opts);
    window.addEventListener("pointerdown", go, opts);
    window.addEventListener("touchstart", go, opts);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", go);
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("touchstart", go);
    };
  }, [reduce]);

  useMotionValueEvent(scrollYProgress, "change", (v) => setCaption(v < 0.08 ? 0 : v < 0.45 ? 1 : v < 0.68 ? 2 : 3));

  return (
    <section ref={ref} className={reduce ? "" : "h-[210svh]"} aria-labelledby="hero-title">
      <div className={`${reduce ? "min-h-svh" : "sticky top-0 h-svh"} flex flex-col overflow-hidden lg:flex-row lg:items-center`}>
        <div className="relative z-10 shrink-0 px-4 pt-[68px] lg:w-1/2 lg:pl-[max(2rem,calc((100vw-1200px)/2))] lg:pt-0">
          <div className="kicker">Preuve de remise · restaurant ↔ livreur</div>
          <h1 id="hero-title" className="display mt-2 text-[clamp(38px,10.6vw,104px)] lg:mt-3">
            Un livreur dit qu&apos;il n&apos;a rien récupéré ?<span className="mt-1 block text-accent lg:mt-2">Montrez le ticket.</span>
          </h1>
          <p className="mt-3 max-w-[30rem] text-[15px] leading-snug text-muted sm:text-[17px] lg:mt-4">
            Photo du sac, signature du livreur, scellé horodaté et vérifiable. Moins de 30 secondes au comptoir, et le dossier de litige se génère en un clic.
          </p>
          <div className="mt-4 grid grid-cols-[1.6fr_1fr] gap-2 sm:flex lg:mt-6">
            <Link href="/login" className="inline-flex h-14 items-center justify-center rounded-[3px] bg-ink px-4 text-center text-[16px] font-semibold leading-tight text-bg sm:h-16 sm:px-6 sm:text-[18px]">
              Essayer gratuitement {TRIAL_DAYS} jours
            </Link>
            <Link href="/app" className="inline-flex h-14 items-center justify-center rounded-[3px] border-[1.5px] border-ink px-4 text-[16px] font-semibold sm:h-16 sm:px-6 sm:text-[18px]">
              Voir la démo
            </Link>
          </div>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:text-[12px]">Sans carte bancaire · {PRICE_EUROS} €/mois ensuite</p>
        </div>

        <div className="relative mx-auto min-h-[200px] w-full max-w-[560px] flex-1 lg:h-[80svh] lg:w-1/2 lg:flex-none">
          {load3d ? (
            <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
              <BagScene progress={scrollYProgress} />
            </motion.div>
          ) : (
            <div className="absolute inset-0 p-4 pb-10">
              <BagPoster />
            </div>
          )}
          {!reduce ? (
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-[2px] bg-ink px-3 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-bg">
              <span className="text-[#8A93FF]">{caption + 1}/4</span> {CAPTIONS[caption]}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
