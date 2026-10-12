import { describe, expect, it } from "vitest";
import { dayLabel, formatEuros, groupByDay, normalizeCourierName, normalizeOrderRef, parseEuros } from "@/lib/format";
import { startOfDayParis } from "@/lib/data/time";

describe("montants", () => {
  it.each([
    ["24,50", 2450],
    ["24.5", 2450],
    ["24", 2400],
    ["0,99 €", 99],
    ["", null],
    ["abc", null],
    ["12,345", null],
  ])("parseEuros(%j) = %j", (input, expected) => {
    expect(parseEuros(input)).toBe(expected);
  });

  it("formate en euros", () => {
    expect(formatEuros(2450)).toBe("24,50 €");
    expect(formatEuros(null)).toBe("—");
  });
});

describe("saisie au comptoir", () => {
  it("normalise le livreur en prénom + initiale", () => {
    expect(normalizeCourierName("karim bensaïd")).toBe("Karim B.");
    expect(normalizeCourierName("  LÉA   m ")).toBe("Léa M.");
    expect(normalizeCourierName("Inès")).toBe("Inès");
    expect(normalizeCourierName("")).toBe("");
  });

  it("normalise le n° de commande", () => {
    expect(normalizeOrderRef(" #ub-4821 ")).toBe("UB-4821");
  });
});

describe("jours (fuseau Paris)", () => {
  const now = new Date("2026-10-12T10:00:00Z");
  it("libelle Aujourd'hui / Hier / date", () => {
    expect(dayLabel("2026-10-12T06:00:00Z", now)).toBe("Aujourd'hui");
    expect(dayLabel("2026-10-11T21:30:00Z", now)).toBe("Hier");
    expect(dayLabel("2026-10-09T12:00:00Z", now)).toMatch(/^Vendredi 9 octobre/);
  });

  it("23h30 UTC le 11 = 12 octobre à Paris", () => {
    expect(dayLabel("2026-10-11T22:30:00Z", now)).toBe("Aujourd'hui");
  });

  it("regroupe par jour en gardant l'ordre", () => {
    const groups = groupByDay(
      [{ sealed_at: "2026-10-12T09:00:00Z" }, { sealed_at: "2026-10-12T08:00:00Z" }, { sealed_at: "2026-10-11T08:00:00Z" }],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ["Aujourd'hui", 2],
      ["Hier", 1],
    ]);
  });

  it("minuit à Paris (heure d'été : UTC+2)", () => {
    expect(startOfDayParis(new Date("2026-10-12T10:00:00Z")).toISOString()).toBe("2026-10-11T22:00:00.000Z");
    expect(startOfDayParis(new Date("2026-12-12T10:00:00Z")).toISOString()).toBe("2026-12-11T23:00:00.000Z");
  });
});
