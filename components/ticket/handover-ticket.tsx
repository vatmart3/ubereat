import { PLATFORM_META, VEHICLE_META } from "@/lib/platforms";
import { formatDate, formatEuros, formatTime } from "@/lib/format";
import type { Platform, Vehicle } from "@/lib/types";

export interface TicketData {
  restaurantName: string;
  restaurantCity?: string;
  order_ref: string;
  platform: Platform;
  amount_cents: number | null;
  items_count: number;
  courier_name: string;
  vehicle: Vehicle;
  pickup_code: string | null;
  photo_count: number;
  signed: boolean;
  sealed_at: string | null;
  hash: string | null;
  sealed_by?: string | null;
}

function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px] text-[13px] leading-snug">
      <span className="text-paper-muted">{k}</span>
      <span className={`text-right tabular ${strong ? "font-semibold" : ""}`}>{v}</span>
    </div>
  );
}

/** Ticket thermique d'une remise. Chaque enfant direct = une « ligne » imprimée. */
export function HandoverTicket({ data, stamp, pending, className = "" }: { data: TicketData; stamp?: React.ReactNode; pending?: boolean; className?: string }) {
  const hashLines = data.hash ? [data.hash.slice(0, 32), data.hash.slice(32)] : [];
  return (
    <div className={`ticket on-paper ${className}`} data-testid="handover-ticket">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[22px] font-black tracking-wide">REMIS.</span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-paper-muted">Preuve de remise</span>
      </div>
      <div className="text-[12px] uppercase tracking-wider text-paper-muted">
        {data.restaurantName}
        {data.restaurantCity ? ` · ${data.restaurantCity}` : ""}
      </div>
      <hr className="ticket-rule" />
      <div className="text-[11px] uppercase tracking-[0.18em] text-paper-muted">Commande</div>
      <div className="font-display text-[54px] font-black uppercase leading-[0.9] tracking-tight break-all">#{data.order_ref}</div>
      <div className="mt-1 flex items-center gap-2 text-[13px] font-semibold">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PLATFORM_META[data.platform].color }} />
        {PLATFORM_META[data.platform].label}
      </div>
      <hr className="ticket-rule" />
      <Row k="Montant" v={formatEuros(data.amount_cents)} strong />
      <Row k="Articles" v={data.items_count} />
      <Row k="Livreur" v={`${data.courier_name} · ${VEHICLE_META[data.vehicle].label}`} strong />
      {data.pickup_code ? <Row k="Code retrait" v={data.pickup_code} /> : null}
      <Row k="Photos" v={`${data.photo_count} / 3`} />
      <Row k="Signature" v={data.signed ? "Oui" : "Non recueillie"} />
      <Row k="Sac fermé et complet" v="Confirmé" />
      {data.sealed_by ? <Row k="Remis par" v={data.sealed_by} /> : null}
      <hr className="ticket-rule" />
      {pending ? (
        <div className="py-1 text-[13px] font-semibold uppercase tracking-wider" style={{ color: "#A8530A" }}>
          En attente de réseau — sera scellé au retour de la connexion
        </div>
      ) : data.sealed_at ? (
        <>
          <Row k="Scellé le" v={formatDate(data.sealed_at)} />
          <div className="flex items-baseline justify-between py-[3px]">
            <span className="text-[13px] text-paper-muted">Heure serveur</span>
            <span className="font-display text-[30px] font-black tabular leading-none">{formatTime(data.sealed_at)}</span>
          </div>
        </>
      ) : null}
      {hashLines.length ? (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-paper-muted">Empreinte SHA-256</div>
          {hashLines.map((l) => (
            <div key={l} className="break-all text-[11.5px] leading-tight tracking-[0.06em]">
              {l}
            </div>
          ))}
        </div>
      ) : null}
      <hr className="ticket-rule" />
      <div className="text-center text-[10.5px] uppercase tracking-[0.16em] text-paper-muted">Preuve horodatée et vérifiable</div>
      {stamp ? <div className="pointer-events-none absolute right-3 top-[38%]">{stamp}</div> : null}
    </div>
  );
}
