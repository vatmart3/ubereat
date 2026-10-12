import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { disputeLabel, PLATFORM_META } from "@/lib/platforms";
import { formatDateTime, formatEuros } from "@/lib/format";
import { PlatformDot } from "@/components/ui/platform-dot";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Litiges" };

export default async function DisputesPage() {
  const store = getStore();
  const actor = await store.getActor();
  if (!actor) redirect("/comptoir");
  const items = (await store.listHandovers(actor, 500)).filter((h) => h.status !== "remis");
  const open = items.filter((h) => h.status === "litige");
  const closed = items.filter((h) => h.status === "resolu");
  // Motif du dernier litige ouvert (une requête par litige ouvert : peu nombreux).
  const details = await Promise.all(open.map((h) => store.getHandover(actor, h.id)));
  const reasons = new Map(details.flatMap((d) => (d ? [[d.id, [...d.events].reverse().find((e) => e.type === "litige_open")?.payload.reason]] : [])));

  return (
    <div className="pb-6 pt-5">
      <div className="kicker">Réclamations plateformes</div>
      <h1 className="display text-[56px]">Litiges</h1>
      <p className="mt-1 text-[15px] text-muted">
        {open.length === 0 ? "Aucun litige ouvert. Le passe est propre." : `${open.length} litige${open.length > 1 ? "s" : ""} à traiter : copiez le dossier ou téléchargez le PDF depuis la fiche.`}
      </p>

      <ul className="mt-5 space-y-2">
        {open.map((h) => (
          <li key={h.id}>
            <Link href={`/app/remises/${h.id}`} className="block border-[1.5px] border-warn bg-raise p-3" data-testid="dispute-row">
              <div className="flex items-start justify-between gap-2">
                <div className="font-display text-[34px] font-black uppercase leading-none">#{h.order_ref}</div>
                <StatusBadge status={h.status} />
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[14px] text-muted">
                <PlatformDot platform={h.platform} size={8} /> {PLATFORM_META[h.platform].label} · {h.courier_name_snapshot} · {formatEuros(h.amount_cents)}
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-[12.5px]">
                <span className="font-semibold text-warn">{disputeLabel(reasons.get(h.id))}</span>
                <span className="text-muted">{formatDateTime(h.sealed_at)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {closed.length ? (
        <>
          <h2 className="kicker mb-2 mt-8">Résolus</h2>
          <ul className="space-y-2">
            {closed.map((h) => (
              <li key={h.id}>
                <Link href={`/app/remises/${h.id}`} className="stub flex items-center justify-between py-3 pl-[92px] pr-3">
                  <span className="font-display text-[24px] font-black uppercase">#{h.order_ref}</span>
                  <StatusBadge status={h.status} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
