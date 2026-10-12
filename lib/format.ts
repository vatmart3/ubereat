const TZ = "Europe/Paris";

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ });
const shortTimeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
const longDateFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });
const euroFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export const formatTime = (iso: string | Date) => timeFmt.format(new Date(iso));
export const formatShortTime = (iso: string | Date) => shortTimeFmt.format(new Date(iso));
export const formatDate = (iso: string | Date) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string | Date) => `${formatDate(iso)} ${formatTime(iso)}`;

export function formatEuros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return euroFmt.format(cents / 100).replace(/ | /g, " ");
}

/** "12,50" | "12.5" | "12" → 1250. Renvoie null si vide, NaN-safe. */
export function parseEuros(input: string): number | null {
  const cleaned = input.replace(/\s|€/g, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d{0,6}(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = Math.round(Number.parseFloat(cleaned) * 100);
  return Number.isFinite(value) ? value : null;
}

/** Clé de jour (fuseau Paris) : "2026-10-12". */
export const dayKey = (iso: string | Date) => dayKeyFmt.format(new Date(iso));

export function dayLabel(iso: string | Date, now: Date = new Date()): string {
  const key = dayKey(iso);
  if (key === dayKey(now)) return "Aujourd'hui";
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (key === dayKey(yesterday)) return "Hier";
  const label = longDateFmt.format(new Date(iso));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function groupByDay<T extends { sealed_at: string }>(items: T[], now: Date = new Date()) {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const key = dayKey(item.sealed_at);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: dayLabel(item.sealed_at, now), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export const shortHash = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-8)}`;

/** "karim b" → "Karim B." */
export function normalizeCourierName(raw: string): string {
  const parts = raw.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]!;
  const firstName = first.charAt(0).toLocaleUpperCase("fr-FR") + first.slice(1).toLocaleLowerCase("fr-FR");
  const initialSource = parts[1];
  if (!initialSource) return firstName.slice(0, 40);
  const initial = initialSource.replace(/\.$/, "").charAt(0).toLocaleUpperCase("fr-FR");
  return `${firstName} ${initial}.`.slice(0, 40);
}

export function normalizeOrderRef(raw: string): string {
  return raw.trim().replace(/^#/, "").replace(/\s+/g, " ").toUpperCase().slice(0, 40);
}
