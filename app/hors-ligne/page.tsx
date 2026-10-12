import Link from "next/link";

export const metadata = { title: "Hors ligne" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <div className="kicker">Pas de réseau</div>
      <h1 className="display text-[64px]">Hors ligne</h1>
      <p className="mt-3 text-[16px] text-muted">Cette page n&apos;est pas encore en cache. Les remises en cours sont gardées sur ce téléphone et seront scellées au retour du réseau.</p>
      <Link href="/app/nouvelle" className="mt-6 inline-flex h-16 items-center justify-center rounded-[3px] bg-ink text-lg font-semibold text-bg">
        + Nouvelle remise
      </Link>
    </main>
  );
}
