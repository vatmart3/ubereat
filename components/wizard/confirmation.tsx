"use client";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { parseEuros, formatTime } from "@/lib/format";
import type { Draft, SealResult } from "@/lib/offline/types";
import { HandoverTicket } from "@/components/ticket/handover-ticket";
import { InkStamp } from "@/components/ticket/ink-stamp";
import { Button } from "@/components/ui/button";
import { ReceiptSheet } from "@/components/handover/receipt-sheet";

export type WizardResult = { kind: "sealed"; seal: SealResult; draft: Draft } | { kind: "queued"; draft: Draft };

const PRINT_MS = 700;

export function Confirmation({ result, restaurantName, restaurantCity, onNext }: { result: WizardResult; restaurantName: string; restaurantCity: string; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const d = result.draft;
  const sealed = result.kind === "sealed" ? result.seal : null;
  const stampDelay = reduce ? 0 : PRINT_MS / 1000 + 0.15;

  return (
    <div className="flex min-h-full flex-col" data-testid="confirmation">
      <div className="kicker mb-2 flex items-center justify-between">
        <span>{sealed ? "Remise scellée" : "Enregistrée hors ligne"}</span>
        <span className="tabular">{sealed ? `#${sealed.order_ref}` : `#${d.order_ref}`}</span>
      </div>

      {/* Fente de l'imprimante thermique */}
      <div className="relative">
        <div className="relative z-10 h-3 rounded-[2px] bg-ink shadow-[inset_0_-3px_0_rgba(255,255,255,.12)]" aria-hidden />
        <div className="relative -mt-1 overflow-hidden px-2 pb-6">
          <div
            className={reduce ? "" : "printing"}
            style={{ "--print-duration": `${PRINT_MS}ms`, "--print-steps": 12 } as React.CSSProperties}
          >
            <HandoverTicket
              pending={!sealed}
              data={{
                restaurantName,
                restaurantCity,
                order_ref: sealed?.order_ref ?? d.order_ref,
                platform: d.platform!,
                amount_cents: parseEuros(d.amount),
                items_count: d.items_count,
                courier_name: sealed?.courier_name ?? d.courier_name,
                vehicle: d.vehicle!,
                pickup_code: d.pickup_code || null,
                photo_count: Object.keys(d.photos).length,
                signed: Boolean(d.signature),
                sealed_at: sealed?.sealed_at ?? null,
                hash: sealed?.hash_sha256 ?? null,
              }}
              stamp={
                sealed ? (
                  <InkStamp label="Remis" time={formatTime(sealed.sealed_at)} delay={stampDelay} />
                ) : (
                  <InkStamp label="En file" tone="warn" delay={stampDelay} size="md" />
                )
              }
            />
          </div>
        </div>
      </div>

      <motion.div
        className="mt-auto space-y-2.5 pt-2"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : stampDelay + 0.35, duration: 0.25 }}
      >
        {!sealed ? (
          <p className="rounded-[3px] border border-warn/40 bg-warn/10 px-3 py-2 text-[14px] text-ink">
            Pas de réseau : la remise est gardée sur ce téléphone et sera scellée automatiquement au retour de la connexion. L&apos;heure du serveur fera foi.
          </p>
        ) : null}
        <Button size="xl" block onClick={onNext} autoFocus data-testid="next-handover">
          + Remise suivante
        </Button>
        <div className="grid grid-cols-2 gap-2.5">
          {sealed ? (
            <Link href={`/app/remises/${sealed.id}`} className="inline-flex h-14 items-center justify-center rounded-[3px] border-[1.5px] border-line bg-raise font-semibold hover:border-ink">
              Voir la fiche
            </Link>
          ) : (
            <Link href="/app" className="inline-flex h-14 items-center justify-center rounded-[3px] border-[1.5px] border-line bg-raise font-semibold hover:border-ink">
              Registre
            </Link>
          )}
          <Button variant="accent" disabled={!sealed} onClick={() => setReceiptOpen(true)} data-testid="send-receipt">
            Reçu livreur
          </Button>
        </div>
      </motion.div>

      {sealed ? <ReceiptSheet open={receiptOpen} onClose={() => setReceiptOpen(false)} token={sealed.public_token} orderRef={sealed.order_ref} /> : null}
    </div>
  );
}
