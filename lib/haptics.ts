/** Retour haptique court (désactivable dans les réglages). */
export type HapticKind = "tap" | "photo" | "check" | "seal" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  photo: 18,
  check: 12,
  seal: [30, 40, 70],
  error: [40, 60, 40],
};

export function haptic(kind: HapticKind = "tap") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    if (localStorage.getItem("remis-haptics") === "off") return;
  } catch {
    /* stockage indisponible */
  }
  navigator.vibrate(PATTERNS[kind]);
}
