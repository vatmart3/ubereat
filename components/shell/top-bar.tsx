import Link from "next/link";

export function TopBar({ restaurantName, operatorName }: { restaurantName: string; operatorName: string }) {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-2">
        <Link href="/app" className="font-display text-[26px] font-black leading-none tracking-wide" aria-label="REMIS. — registre">
          REMIS<span className="text-accent">.</span>
        </Link>
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{restaurantName}</span>
        <Link href="/app/reglages" className="flex h-10 items-center gap-2 rounded-[3px] border border-line bg-raise px-2.5 text-[13px] font-semibold" aria-label={`Opérateur : ${operatorName}. Réglages`}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink font-mono text-[11px] text-bg">{operatorName.slice(0, 1).toUpperCase()}</span>
          {operatorName}
        </Link>
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-line bg-raise" aria-label="Verrouiller (changer d'opérateur)" title="Verrouiller">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="5" y="11" width="14" height="9" rx="1" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </button>
        </form>
      </div>
    </header>
  );
}
