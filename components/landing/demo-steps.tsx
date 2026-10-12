"use client";
import { motion, useReducedMotion } from "framer-motion";

const STEPS = [
  { n: "01", title: "Photo", time: "8 s", text: "Un tap ouvre la caméra arrière. Le sac fermé, le ticket : l'heure et le n° de commande sont incrustés dans l'image." },
  { n: "02", title: "Signature", time: "10 s", text: "Le livreur signe au doigt sur le téléphone posé au comptoir. Facultatif, mais imparable." },
  { n: "03", title: "Scellé", time: "5 s", text: "On maintient le bouton : l'heure serveur et l'empreinte SHA-256 verrouillent la preuve. Plus rien n'est modifiable." },
];

function Illustration({ index }: { index: number }) {
  const reduce = useReducedMotion();
  const view = { once: true, amount: 0.6 } as const;
  if (index === 0)
    return (
      <svg viewBox="0 0 160 110" className="h-full w-full" aria-hidden>
        <rect x="52" y="22" width="56" height="74" fill="#C39A6B" />
        <rect x="64" y="12" width="32" height="40" fill="#FFFFFD" />
        {([[14, 8], [146, 8], [14, 102], [146, 102]] as const).map(([x, y], i) => (
          <path key={i} d={`M${x} ${y + (y < 50 ? 14 : -14)}V${y}H${x + (x < 80 ? 14 : -14)}`} stroke="currentColor" strokeWidth="3" fill="none" />
        ))}
        <motion.rect x="0" y="0" width="160" height="110" fill="white" initial={{ opacity: 0 }} whileInView={reduce ? undefined : { opacity: [0, 0.9, 0] }} viewport={view} transition={{ duration: 0.5, delay: 0.4 }} />
        <rect x="0" y="94" width="160" height="16" fill="#15181B" opacity=".85" />
        <text x="8" y="105" fontFamily="monospace" fontSize="8" fill="#fff">14:31:52 · #UB-4821</text>
      </svg>
    );
  if (index === 1)
    return (
      <svg viewBox="0 0 160 110" className="h-full w-full" aria-hidden>
        <rect x="8" y="10" width="144" height="90" fill="#FFFFFD" />
        <line x1="20" y1="82" x2="140" y2="82" stroke="#9AA3A9" strokeDasharray="4 4" />
        <motion.path
          d="M24 70 C 34 30, 44 30, 50 66 S 66 92, 74 52 S 92 26, 98 64 S 120 80, 136 46"
          fill="none"
          stroke="#15181B"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={view}
          transition={{ duration: 1.2, ease: "easeInOut", delay: 0.2 }}
        />
      </svg>
    );
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="on-paper flex h-[86%] w-[70%] flex-col gap-1.5 bg-paper p-3">
        {[90, 60, 75, 50].map((w, i) => (
          <span key={i} className="h-1.5 bg-black/15" style={{ width: `${w}%` }} />
        ))}
      </div>
      <motion.div
        className="stamp absolute"
        style={{ "--stamp-color": "#2F3BD1", mixBlendMode: "multiply" } as React.CSSProperties}
        initial={reduce ? { rotate: -8 } : { scale: 2.4, opacity: 0, rotate: -20 }}
        whileInView={{ scale: 1, opacity: 0.92, rotate: -8 }}
        viewport={view}
        transition={{ type: "spring", stiffness: 520, damping: 16, delay: 0.3 }}
      >
        <span className="text-[30px] leading-none">Remis</span>
        <span className="font-mono text-[12px] font-semibold">14:32:07</span>
      </motion.div>
    </div>
  );
}

export function DemoSteps() {
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {STEPS.map((s, i) => (
        <li key={s.n} className="plate flex flex-col overflow-hidden">
          <div className="flex h-[150px] items-center justify-center border-b border-line bg-bg p-4 text-ink">
            <Illustration index={i} />
          </div>
          <div className="p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[12px] text-muted">{s.n}</span>
              <span className="font-mono text-[12px] font-semibold text-accent tabular">{s.time}</span>
            </div>
            <h3 className="display mt-1 text-[40px]">{s.title}</h3>
            <p className="mt-1 text-[15px] leading-snug text-muted">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
