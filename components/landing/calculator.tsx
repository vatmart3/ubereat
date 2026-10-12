"use client";
import { useState } from "react";
import { Counter } from "@/components/ui/counter";
import { PRICE_EUROS } from "@/lib/landing-content";

const euro = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ")} €`;

/** Coût de l'inaction : X litiges / mois × panier moyen × 12. */
export function Calculator() {
  const [disputes, setDisputes] = useState(8);
  const [basket, setBasket] = useState(27);
  const yearly = disputes * basket * 12;
  const cost = PRICE_EUROS * 12;
  const breakEven = Math.max(1, Math.ceil(cost / 12 / basket));

  return (
    <div className="plate rivets grid gap-6 p-5 pt-7 md:grid-cols-2 md:p-8">
      <div className="space-y-6">
        <Slider label="Litiges perdus par mois" value={disputes} min={1} max={40} onChange={setDisputes} suffix="" />
        <Slider label="Panier moyen" value={basket} min={10} max={80} onChange={setBasket} suffix=" €" />
        <p className="text-[13.5px] text-muted">« Non reçu », « article manquant », « sac ouvert » : sans preuve, la plateforme rembourse le client… et vous débite.</p>
      </div>
      <div className="flex flex-col justify-between border-t border-dashed border-line pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0">
        <div>
          <div className="kicker">Perdu par an, aujourd&apos;hui</div>
          <div className="display mt-1 text-[clamp(64px,18vw,112px)] text-warn" aria-live="polite">
            <Counter value={yearly} format={euro} />
          </div>
          <p className="mt-1 font-mono text-[13px] text-muted tabular">
            {disputes} × {basket} € × 12 mois
          </p>
        </div>
        <p className="mt-5 text-[16px] leading-snug">
          REMIS. coûte <strong className="tabular">{cost} €</strong> par an. Il est remboursé dès <strong className="tabular">{breakEven} litige{breakEven > 1 ? "s" : ""} gagné{breakEven > 1 ? "s" : ""} par mois</strong>.
        </p>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange, suffix }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix: string }) {
  const id = label.replace(/\W+/g, "-");
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="kicker">
          {label}
        </label>
        <span className="display text-[40px] tabular">
          {value}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-10 w-full cursor-pointer accent-[var(--accent)]"
      />
    </div>
  );
}
