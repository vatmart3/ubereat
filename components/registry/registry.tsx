"use client";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEuros, formatShortTime, groupByDay } from "@/lib/format";
import { PLATFORM_META, VEHICLE_META } from "@/lib/platforms";
import { PLATFORMS, type HandoverListItem, type Platform, type RegistryStats } from "@/lib/types";
import { Counter } from "@/components/ui/counter";
import { LiveClock } from "@/components/ui/live-clock";
import { PlatformDot } from "@/components/ui/platform-dot";
import { StatusBadge } from "@/components/ui/status-badge";

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function Registry({ items, stats, thumbs, now }: { items: HandoverListItem[]; stats: RegistryStats; thumbs: Record<string, string>; now: string }) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Platform | "all">("all");

  const filtered = useMemo(() => {
    const q = normalize(query.trim().replace(/^#/, ""));
    return items.filter((h) => {
      if (platform !== "all" && h.platform !== platform) return false;
      if (!q) return true;
      return [h.order_ref, h.courier_name_snapshot, PLATFORM_META[h.platform].label, h.pickup_code ?? ""].some((v) => normalize(v).includes(q));
    });
  }, [items, query, platform]);

  const groups = groupByDay(filtered, new Date(now));

  return (
    <div>
      <section className="pt-5" aria-label="Aujourd'hui">
        <div className="flex items-end justify-between">
          <div>
            <div className="kicker">Registre des remises</div>
            <h1 className="display text-[56px]">Le passe</h1>
          </div>
          <LiveClock className="pb-1 text-[22px] font-semibold" />
        </div>
        <div className="mt-4 grid grid-cols-3 border-y-[1.5px] border-ink">
          <Stat label="Remises du jour" testId="stat-today">
            <Counter value={stats.today_count} />
          </Stat>
          <Stat label="Montant couvert">
            <Counter value={stats.today_amount_cents} format={(n) => formatEuros(Math.round(n)).replace(/,\d\d/, "")} />
          </Stat>
          <Stat label="Litiges ouverts" warn={stats.open_disputes > 0}>
            <Counter value={stats.open_disputes} />
          </Stat>
        </div>
      </section>

      <div className="sticky top-[57px] z-20 -mx-4 mt-4 border-b border-line bg-bg/92 px-4 pb-3 pt-2 backdrop-blur">
        <label className="flex h-12 items-center gap-2 rounded-[3px] border-[1.5px] border-line bg-raise px-3 focus-within:border-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted" aria-hidden>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <span className="sr-only">Rechercher</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="N° de commande, livreur, plateforme"
            className="w-full min-w-0 bg-transparent text-[16px] placeholder:text-muted/70 focus:outline-none"
            data-testid="registry-search"
          />
        </label>
        <div className="rail -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4" role="radiogroup" aria-label="Filtrer par plateforme">
          <Chip active={platform === "all"} onClick={() => setPlatform("all")}>
            Toutes
          </Chip>
          {PLATFORMS.map((p) => (
            <Chip key={p} active={platform === p} onClick={() => setPlatform(p)}>
              <PlatformDot platform={p} size={8} /> {PLATFORM_META[p].short}
            </Chip>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="py-16 text-center">
          <p className="display text-[34px] text-muted">{items.length ? "Aucun résultat" : "Rien au passe"}</p>
          <p className="mt-2 text-muted">{items.length ? "Essayez un autre n° ou un autre livreur." : "Touchez « + Nouvelle remise » au prochain livreur."}</p>
        </div>
      ) : null}

      {groups.map((g) => (
        <section key={g.key} className="mt-5" aria-label={g.label}>
          <h2 className="kicker mb-2 flex items-center gap-2">
            <span>{g.label}</span>
            <span className="h-px flex-1 bg-line" />
            <span className="tabular">{g.items.length}</span>
          </h2>
          <ul className="space-y-2">
            {g.items.map((h, i) => (
              <motion.li key={h.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                <Link href={`/app/remises/${h.id}`} className="stub flex min-h-[84px] items-center gap-3 py-2 pl-2 pr-3 active:bg-surface" data-testid="registry-row">
                  <div className="h-[68px] w-[60px] shrink-0 overflow-hidden rounded-[2px] bg-surface">
                    {h.thumb_path && thumbs[h.thumb_path] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbs[h.thumb_path]} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="ml-3 min-w-0 flex-1">
                    <div className="font-display text-[30px] font-black uppercase leading-[0.95] tracking-tight">#{h.order_ref}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 truncate text-[13.5px] text-muted">
                      <PlatformDot platform={h.platform} size={8} />
                      <span className="truncate">
                        {PLATFORM_META[h.platform].short} · {h.courier_name_snapshot} {VEHICLE_META[h.vehicle].emoji}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="tabular font-mono text-[17px] font-semibold">{formatShortTime(h.sealed_at)}</span>
                    <StatusBadge status={h.status} />
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Stat({ label, children, warn, testId }: { label: string; children: React.ReactNode; warn?: boolean; testId?: string }) {
  return (
    <div className="border-r border-line px-2 py-3 last:border-r-0" data-testid={testId}>
      <div className={`font-display text-[38px] font-black leading-none ${warn ? "text-warn" : ""}`}>{children}</div>
      <div className="mt-1 text-[11.5px] leading-tight text-muted">{label}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-[3px] border px-3.5 text-[14px] font-semibold ${active ? "border-ink bg-ink text-bg" : "border-line bg-raise text-ink"}`}
    >
      {children}
    </button>
  );
}
