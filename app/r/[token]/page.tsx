import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/data";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { SLOT_META } from "@/lib/platforms";
import { HandoverTicket } from "@/components/ticket/handover-ticket";
import { InkStamp } from "@/components/ticket/ink-stamp";
import { CourierPhoto } from "@/components/receipt/courier-photo";

export const metadata: Metadata = { title: "Reçu de remise", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CourierReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound();
  const store = getStore();
  const r = await store.getReceipt(token);
  if (!r) notFound();
  const h = r.handover;
  const urls = await store.fileUrls([...r.photos.map((p) => p.storage_path), ...r.courier_events.map((e) => e.payload.storage_path)], { receiptToken: token });

  return (
    <main className="safe-top safe-bottom mx-auto max-w-md px-4 pb-10 pt-5">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[28px] font-black leading-none">
          REMIS<span className="text-accent">.</span>
        </span>
        <span className="kicker">Reçu livreur</span>
      </div>

      <h1 className="display mt-6 text-[52px]">Votre preuve</h1>
      <p className="mt-2 border-l-[3px] border-accent pl-3 text-[17px] leading-snug" data-testid="courier-message">
        Ce reçu prouve que vous avez récupéré la commande <strong>#{h.order_ref}</strong> fermée, chez {r.restaurant.name}, le {formatDate(h.sealed_at)} à{" "}
        <strong className="tabular">{formatTime(h.sealed_at)}</strong>.
      </p>

      <div className="mt-5">
        <HandoverTicket
          data={{
            restaurantName: r.restaurant.name,
            restaurantCity: r.restaurant.city,
            order_ref: h.order_ref,
            platform: h.platform,
            amount_cents: h.amount_cents,
            items_count: h.items_count,
            courier_name: h.courier_name,
            vehicle: h.vehicle,
            pickup_code: h.pickup_code,
            photo_count: r.photos.length,
            signed: Boolean(h.signature_path),
            sealed_at: h.sealed_at,
            hash: h.hash_sha256,
          }}
          stamp={<InkStamp label="Remis" time={formatTime(h.sealed_at)} delay={0.2} size="md" />}
        />
      </div>

      <section className="mt-5" aria-label="Photos">
        <h2 className="kicker mb-2">Photos du restaurant</h2>
        <div className="rail -mx-4 flex gap-2 overflow-x-auto px-4">
          {r.photos.map((p) => (
            <figure key={p.slot} className="w-[150px] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[p.storage_path]} alt={SLOT_META[p.slot].label} className="h-[200px] w-full rounded-[3px] border border-line object-cover" />
              <figcaption className="mt-1 text-[12px]">
                {SLOT_META[p.slot].label} · <span className="tabular font-mono">{formatTime(p.captured_at)}</span>
              </figcaption>
            </figure>
          ))}
          {r.courier_events.map((e, i) => (
            <figure key={i} className="w-[150px] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[e.payload.storage_path]} alt="Votre photo" className="h-[200px] w-full rounded-[3px] border-2 border-accent object-cover" />
              <figcaption className="mt-1 text-[12px]">
                Votre photo · <span className="tabular font-mono">{formatTime(e.payload.captured_at)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <div className="mt-6 space-y-3">
        <a href={`/api/r/${token}/pdf`} className="inline-flex h-16 w-full items-center justify-center rounded-[3px] bg-ink text-lg font-semibold text-bg" data-testid="save-proof">
          Enregistrer ma preuve
        </a>
        <CourierPhoto token={token} orderRef={h.order_ref} restaurantName={r.restaurant.name} remaining={3 - r.courier_events.length} />
      </div>

      <footer className="mt-8 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
        <p>
          Preuve horodatée et vérifiable : l&apos;heure est celle du serveur, et l&apos;empreinte SHA-256 change si une donnée ou une photo est modifiée. Reçu disponible jusqu&apos;au{" "}
          {formatDateTime(r.expires_at)}.
        </p>
        <p className="mt-2">Vos données (prénom + initiale, signature, photos du sac) ne servent qu&apos;à prouver la remise en cas de litige. Aucune reconnaissance faciale.</p>
      </footer>
    </main>
  );
}
