import { z } from "zod";

export const uuidSchema = z.string().uuid();

/** Données envoyées par le comptoir au moment du scellé (les chemins sont dérivés côté serveur). */
export const sealRequestSchema = z.object({
  id: uuidSchema,
  order_ref: z.string().trim().min(1).max(40),
  platform: z.enum(["uber", "deliveroo", "justeat", "direct"]),
  amount_cents: z.number().int().min(0).max(10_000_000).nullable(),
  items_count: z.number().int().min(1).max(999),
  courier_name: z.string().trim().min(1).max(40),
  vehicle: z.enum(["velo", "scooter", "voiture", "pied"]),
  pickup_code: z.string().trim().max(20).nullable(),
  client_captured_at: z.string().datetime({ offset: true }),
  offline: z.boolean().default(false),
  geo: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().optional() }).nullable().default(null),
  photos: z
    .array(z.object({ slot: z.enum(["sac", "ticket", "remise"]), captured_at: z.string().datetime({ offset: true }) }))
    .min(1, "Une photo minimum")
    .max(3),
  has_signature: z.boolean(),
  confirm_closed: z.literal(true, { errorMap: () => ({ message: "Confirmez que le sac est fermé et complet" }) }),
});

export type SealRequest = z.infer<typeof sealRequestSchema>;

export const eventRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("litige_open"),
    payload: z.object({
      reason: z.enum(["non_recu", "article_manquant", "abimee", "mauvaise_adresse", "livreur_conteste"]),
      note: z.string().max(1000).default(""),
    }),
  }),
  z.object({ type: z.literal("note"), payload: z.object({ note: z.string().trim().min(1).max(1000) }) }),
  z.object({ type: z.literal("resolve"), payload: z.object({ note: z.string().max(1000).default("") }) }),
  z.object({ type: z.literal("export"), payload: z.object({ format: z.enum(["pdf", "texte"]) }) }),
]);
