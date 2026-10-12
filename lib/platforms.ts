import type { HandoverStatus, Platform, Slot, Vehicle } from "./types";

export const PLATFORM_META: Record<Platform, { label: string; short: string; color: string }> = {
  uber: { label: "Uber Eats", short: "Uber", color: "#06C167" },
  deliveroo: { label: "Deliveroo", short: "Deliveroo", color: "#00CCBC" },
  justeat: { label: "Just Eat", short: "Just Eat", color: "#FF8000" },
  direct: { label: "Livraison directe", short: "Direct", color: "#15181B" },
};

export const VEHICLE_META: Record<Vehicle, { label: string; emoji: string }> = {
  velo: { label: "Vélo", emoji: "🚲" },
  scooter: { label: "Scooter", emoji: "🛵" },
  voiture: { label: "Voiture", emoji: "🚗" },
  pied: { label: "À pied", emoji: "🚶" },
};

export const SLOT_META: Record<Slot, { label: string; hint: string }> = {
  sac: { label: "Sac fermé", hint: "Le sac scellé, agrafe visible" },
  ticket: { label: "Ticket ou étiquette", hint: "Le n° de commande lisible" },
  remise: { label: "Remise au livreur", hint: "Le sac dans ses mains — pas son visage" },
};

export const STATUS_META: Record<HandoverStatus, { label: string; tone: "ok" | "warn" | "muted" }> = {
  remis: { label: "Remis", tone: "ok" },
  litige: { label: "Litige", tone: "warn" },
  resolu: { label: "Résolu", tone: "muted" },
};

export const DISPUTE_REASONS = [
  { id: "non_recu", label: "Client « non reçu »" },
  { id: "article_manquant", label: "Article manquant" },
  { id: "abimee", label: "Commande abîmée" },
  { id: "mauvaise_adresse", label: "Mauvaise adresse" },
  { id: "livreur_conteste", label: "Livreur conteste" },
] as const;

export type DisputeReason = (typeof DISPUTE_REASONS)[number]["id"];

export function disputeLabel(id: unknown): string {
  return DISPUTE_REASONS.find((r) => r.id === id)?.label ?? "Autre motif";
}
