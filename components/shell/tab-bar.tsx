"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function Tab({ href, label, active, badge }: { href: string; label: string; active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${active ? "text-ink" : "text-muted"}`}
    >
      <span className={`h-[3px] w-6 rounded-[1px] ${active ? "bg-accent" : "bg-transparent"}`} />
      {label}
      {badge ? (
        <span className="absolute right-[calc(50%-34px)] top-1.5 min-w-5 rounded-[2px] bg-warn px-1 text-center font-mono text-[11px] leading-5 text-white tabular" data-testid="disputes-badge">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Barre d'onglets du bas + bouton central « + Nouvelle remise », toujours accessible au pouce. */
export function TabBar({ openDisputes }: { openDisputes: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/92 backdrop-blur">
      <div className="mx-auto flex max-w-md items-end px-2">
        <Tab href="/app" label="Registre" active={pathname === "/app" || pathname.startsWith("/app/remises")} />
        <div className="relative flex w-[150px] shrink-0 justify-center">
          <Link
            href="/app/nouvelle"
            data-testid="fab-new"
            className="absolute -top-9 flex h-[68px] w-[146px] flex-col items-center justify-center rounded-[4px] border-[1.5px] border-ink bg-ink text-bg shadow-[0_10px_24px_-8px_rgba(0,0,0,.55)] active:translate-y-px"
          >
            <span className="font-display text-[30px] font-black leading-[0.8]">+</span>
            <span className="font-display text-[17px] font-black uppercase leading-none tracking-wide">Nouvelle remise</span>
          </Link>
        </div>
        <Tab href="/app/litiges" label="Litiges" active={pathname.startsWith("/app/litiges")} badge={openDisputes} />
      </div>
    </nav>
  );
}
