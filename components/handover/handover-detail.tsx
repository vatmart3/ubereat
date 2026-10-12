"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buildDossierText, describeEvent } from "@/lib/dossier";
import { formatDateTime, formatTime } from "@/lib/format";
import { DISPUTE_REASONS, SLOT_META, type DisputeReason } from "@/lib/platforms";
import { haptic } from "@/lib/haptics";
import type { HandoverDetail as Detail, Restaurant } from "@/lib/types";
import { HandoverTicket } from "@/components/ticket/handover-ticket";
import { InkStamp } from "@/components/ticket/ink-stamp";
import { Tilt } from "@/components/ticket/tilt";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Lightbox, type LightboxPhoto } from "./lightbox";
import { ReceiptSheet } from "./receipt-sheet";

async function postEvent(id: string, body: unknown) {
  const res = await fetch(`/api/handovers/${id}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Action impossible");
}

export function HandoverDetail({ h, urls, restaurant }: { h: Detail; urls: Record<string, string>; restaurant: Pick<Restaurant, "name" | "city" | "address"> }) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const courierPhotos = h.events
    .filter((e) => e.type === "courier_photo")
    .map((e) => e.payload as { storage_path: string; captured_at: string });

  const photos: LightboxPhoto[] = [
    ...h.photos.map((p) => ({ src: urls[p.storage_path] ?? "", label: SLOT_META[p.slot].label, caption: formatTime(p.captured_at) })),
    ...courierPhotos.map((p) => ({ src: urls[p.storage_path] ?? "", label: "Photo du livreur (hors scellé)", caption: formatTime(p.captured_at) })),
  ];

  return (
    <div className="pb-6 pt-4">
      <div className="flex items-center justify-between">
        <Link href="/app" className="kicker flex h-10 items-center gap-1 text-ink">
          ← Registre
        </Link>
        <StatusBadge status={h.status} />
      </div>
      <h1 className="display mt-2 break-all text-[64px]">#{h.order_ref}</h1>
      <p className="text-[14px] text-muted">
        Scellé le {formatDateTime(h.sealed_at)} · par {h.sealed_by_name ?? "l'équipe"}
      </p>

      <section aria-label="Photos" className="rail -mx-4 mt-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2">
        {photos.map((p, i) => (
          <button key={i} type="button" onClick={() => setLightbox(i)} className="relative h-[240px] w-[180px] shrink-0 snap-start overflow-hidden rounded-[3px] border border-line bg-surface" aria-label={`Agrandir : ${p.label}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} alt={p.label} className="h-full w-full object-cover" loading={i > 1 ? "lazy" : "eager"} />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6 text-left text-[12px] font-semibold text-white">
              {p.label}
              <span className="block font-mono text-[11px] font-normal text-white/75">{p.caption}</span>
            </span>
          </button>
        ))}
      </section>

      <Tilt className="mt-5">
        <HandoverTicket
          data={{
            restaurantName: restaurant.name,
            restaurantCity: restaurant.city,
            order_ref: h.order_ref,
            platform: h.platform,
            amount_cents: h.amount_cents,
            items_count: h.items_count,
            courier_name: h.courier_name_snapshot,
            vehicle: h.vehicle,
            pickup_code: h.pickup_code,
            photo_count: h.photos.length,
            signed: Boolean(h.signature_path),
            sealed_at: h.sealed_at,
            hash: h.hash_sha256,
            sealed_by: h.sealed_by_name,
          }}
          stamp={<InkStamp label="Remis" time={formatTime(h.sealed_at)} animated={false} size="md" />}
        />
      </Tilt>

      {h.signature_path && urls[h.signature_path] ? (
        <div className="plate mt-4 p-3">
          <div className="kicker mb-1">Signature du livreur</div>
          <div className="on-paper bg-paper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls[h.signature_path]} alt="Signature du livreur" className="h-24 w-full object-contain" />
          </div>
        </div>
      ) : null}

      <IntegrityPanel h={h} />
      <DisputePanel h={h} restaurant={restaurant} onChange={() => router.refresh()} />

      <section className="plate mt-4 p-4" aria-label="Reçu livreur">
        <div className="kicker">Reçu livreur</div>
        <p className="mt-1 text-[14px] text-muted">Le livreur garde sa preuve : il ouvre le reçu sans compte, via QR code.</p>
        <Button variant="outline" block className="mt-3" onClick={() => setReceiptOpen(true)} disabled={!h.receipt}>
          Afficher le QR du reçu
        </Button>
      </section>

      <section className="mt-6" aria-label="Historique">
        <h2 className="kicker mb-3">Historique · journal en ajout seul</h2>
        <ol className="relative ml-2 border-l-[1.5px] border-line">
          {h.events.map((e) => (
            <li key={e.id} className="relative pb-4 pl-5">
              <span className={`absolute -left-[6px] top-1 h-[11px] w-[11px] rounded-full border-2 border-bg ${e.type === "litige_open" ? "bg-warn" : e.type === "resolve" ? "bg-ok" : e.type === "seal" ? "bg-accent" : "bg-muted"}`} />
              <div className="tabular font-mono text-[12px] text-muted">{formatDateTime(e.created_at)}</div>
              <div className="text-[14.5px]">{describeEvent(e)}</div>
            </li>
          ))}
        </ol>
      </section>

      <Lightbox photos={photos} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
      {h.receipt ? <ReceiptSheet open={receiptOpen} onClose={() => setReceiptOpen(false)} token={h.receipt.public_token} orderRef={h.order_ref} /> : null}
    </div>
  );
}

function IntegrityPanel({ h }: { h: Detail }) {
  const groups = h.hash_sha256.match(/.{1,8}/g) ?? [];
  return (
    <section className="plate rivets mt-4 p-4 pt-5" aria-label="Intégrité">
      <div className="flex items-center justify-between">
        <div className="kicker">Intégrité</div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">SHA-256 · horloge {h.timestamp_provider === "server" ? "serveur" : h.timestamp_provider}</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-1 font-mono text-[13px] tracking-wider" data-testid="hash">
        {groups.map((g, i) => (
          <span key={i}>{g}</span>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-muted">Empreinte calculée au scellé sur les données, l&apos;heure serveur, chaque photo et la signature. Une seule modification la change entièrement.</p>
      <Link href={`/app/remises/${h.id}/verifier`} className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-[3px] border-[1.5px] border-ink font-semibold" data-testid="verify-link">
        Vérifier la preuve
      </Link>
    </section>
  );
}

function DisputePanel({ h, restaurant, onChange }: { h: Detail; restaurant: Pick<Restaurant, "name" | "city" | "address">; onChange: () => void }) {
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  // Après ouverture/résolution, on repart de l'état replié (et on vide la note).
  useEffect(() => {
    setOpen(false);
    setNote("");
    setReason(null);
  }, [h.status]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      haptic("error");
    } finally {
      setBusy(false);
    }
  };

  const copyDossier = () =>
    run(async () => {
      const receiptUrl = h.receipt ? `${window.location.origin}/r/${h.receipt.public_token}` : null;
      await navigator.clipboard.writeText(buildDossierText(h, restaurant, receiptUrl));
      setCopied(true);
      haptic("check");
      setTimeout(() => setCopied(false), 2000);
      await postEvent(h.id, { type: "export", payload: { format: "texte" } });
    });

  return (
    <section className={`mt-4 border-[1.5px] p-4 ${h.status === "litige" ? "border-warn bg-warn/5" : "plate border-line"}`} aria-label="Litige" data-testid="dispute-panel">
      <div className="flex items-center justify-between">
        <div className="kicker" style={h.status === "litige" ? { color: "var(--warn)" } : undefined}>
          Litige
        </div>
        {h.status === "resolu" ? <span className="font-mono text-[12px] font-semibold uppercase text-ok">Résolu</span> : null}
      </div>

      {h.status !== "litige" && !open ? (
        <>
          <p className="mt-1 text-[14px] text-muted">{h.status === "resolu" ? "Le litige est clos. Vous pouvez le rouvrir si la plateforme relance." : "Une réclamation sur cette commande ? Ouvrez un litige pour préparer le dossier."}</p>
          <Button variant="danger" block className="mt-3" onClick={() => setOpen(true)} data-testid="open-dispute">
            {h.status === "resolu" ? "Rouvrir le litige" : "Ouvrir un litige"}
          </Button>
        </>
      ) : null}

      {h.status !== "litige" && open ? (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Motif">
            {DISPUTE_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={reason === r.id}
                onClick={() => setReason(r.id)}
                className={`min-h-11 rounded-[3px] border px-3 text-[14px] font-semibold ${reason === r.id ? "border-warn bg-warn text-white" : "border-line bg-raise"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="kicker">Note (facultatif)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="Ce que dit la plateforme ou le client…" className="mt-1 w-full rounded-[3px] border-[1.5px] border-line bg-raise p-3 text-[16px] focus:border-ink focus:outline-none" />
          </label>
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" disabled={!reason || busy} onClick={() => run(() => postEvent(h.id, { type: "litige_open", payload: { reason, note } }))} data-testid="confirm-dispute">
              Passer en litige
            </Button>
          </div>
        </div>
      ) : null}

      {h.status === "litige" ? (
        <div className="mt-2 space-y-2">
          <p className="text-[14px]">Envoyez le dossier au support de la plateforme : texte prêt à coller, ou PDF complet (ticket, photos, empreinte, historique).</p>
          <Button variant="primary" block onClick={copyDossier} disabled={busy} data-testid="copy-dossier">
            {copied ? "Dossier copié ✓" : "Copier le dossier"}
          </Button>
          <a
            href={`/api/handovers/${h.id}/pdf`}
            onClick={() => setTimeout(onChange, 1500)}
            className="inline-flex h-14 w-full items-center justify-center rounded-[3px] border-[1.5px] border-ink bg-raise font-semibold"
            data-testid="download-pdf"
          >
            Télécharger le PDF
          </a>
          <label className="block pt-2">
            <span className="kicker">Note de clôture (facultatif)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="ex. Remboursement refusé par la plateforme" className="mt-1 h-12 w-full rounded-[3px] border-[1.5px] border-line bg-raise px-3 focus:border-ink focus:outline-none" />
          </label>
          <Button variant="outline" block disabled={busy} onClick={() => run(() => postEvent(h.id, { type: "resolve", payload: { note } }))} data-testid="resolve-dispute">
            Marquer résolu
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-[14px] font-semibold text-warn">
          {error}
        </p>
      ) : null}
    </section>
  );
}
