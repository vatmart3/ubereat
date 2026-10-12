import Link from "next/link";

export function AuthFrame({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6">
      <Link href="/" className="font-display text-[30px] font-black leading-none tracking-wide">
        REMIS<span className="text-accent">.</span>
      </Link>
      <div className="mt-10">
        <div className="kicker">{kicker}</div>
        <h1 className="display mt-1 text-[clamp(48px,15vw,68px)]">{title}</h1>
      </div>
      <div className="mt-6 flex-1">{children}</div>
    </main>
  );
}
