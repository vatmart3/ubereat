import { disputeLabel, PLATFORM_META, SLOT_META, VEHICLE_META } from "./platforms";
import { formatDateTime, formatEuros, formatTime } from "./format";
import type { HandoverDetail, HandoverEvent, Restaurant } from "./types";

export function describeEvent(e: HandoverEvent): string {
  const who = e.actor_name ?? (e.actor === "livreur" ? "Livreur" : "Équipe");
  const p = e.payload as Record<string, string | undefined>;
  switch (e.type) {
    case "seal":
      return `Remise scellée par ${who}${p.offline ? " (saisie hors ligne, scellée au retour du réseau)" : ""}`;
    case "litige_open":
      return `Litige ouvert par ${who} — ${disputeLabel(p.reason)}${p.note ? ` : ${p.note}` : ""}`;
    case "note":
      return `Note de ${who} : ${p.note ?? ""}`;
    case "resolve":
      return `Litige marqué résolu par ${who}${p.note ? ` : ${p.note}` : ""}`;
    case "export":
      return `Dossier exporté (${p.format === "pdf" ? "PDF" : "texte"}) par ${who}`;
    case "courier_photo":
      return "Photo de prise en charge ajoutée par le livreur depuis son reçu";
    default:
      return e.type;
  }
}

/** Texte prêt à coller dans le formulaire du support de la plateforme. */
export function buildDossierText(h: HandoverDetail, restaurant: Pick<Restaurant, "name" | "city" | "address">, receiptUrl: string | null): string {
  const platform = PLATFORM_META[h.platform].label;
  const lastDispute = [...h.events].reverse().find((e) => e.type === "litige_open");
  const lines = [
    `DOSSIER DE CONTESTATION — commande #${h.order_ref} (${platform})`,
    "",
    `Restaurant : ${restaurant.name}, ${restaurant.address ?? restaurant.city}`,
    `Commande : #${h.order_ref} · ${platform} · ${h.items_count} article${h.items_count > 1 ? "s" : ""}${h.amount_cents !== null ? ` · ${formatEuros(h.amount_cents)}` : ""}`,
    `Remise au livreur : ${h.courier_name_snapshot} (${VEHICLE_META[h.vehicle].label.toLowerCase()})${h.pickup_code ? ` · code de retrait ${h.pickup_code}` : ""}`,
    `Heure de remise (horodatage serveur, Europe/Paris) : ${formatDateTime(h.sealed_at)}`,
    `Remis par : ${h.sealed_by_name ?? "équipe du restaurant"}`,
    `Sac remis fermé et complet : confirmé au moment de la remise`,
    `Signature du livreur : ${h.signature_path ? "oui" : "non recueillie"}`,
    "",
    `Photos (${h.photos.length}) :`,
    ...h.photos.map((p) => `  - ${SLOT_META[p.slot].label}, prise à ${formatTime(p.captured_at)} — SHA-256 ${p.sha256}`),
    "",
    `Empreinte de la preuve (SHA-256) : ${h.hash_sha256}`,
    receiptUrl ? `Reçu vérifiable en ligne : ${receiptUrl}` : null,
    "",
    lastDispute ? `Motif de la réclamation : ${disputeLabel((lastDispute.payload as { reason?: string }).reason)}` : null,
    "",
    "Historique :",
    ...h.events.map((e) => `  - ${formatDateTime(e.created_at)} — ${describeEvent(e)}`),
    "",
    "La commande a été remise fermée et complète au livreur à l'heure indiquée. Cette preuve est horodatée côté serveur et vérifiable : toute modification d'une donnée ou d'une photo change l'empreinte SHA-256 ci-dessus. Photos et PDF du dossier disponibles sur demande.",
  ];
  return lines.filter((l): l is string => l !== null).join("\n").replace(/\n{3,}/g, "\n\n");
}
