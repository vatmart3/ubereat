"use client";
import { useRef } from "react";
import { haptic } from "@/lib/haptics";
import { formatEuros, parseEuros } from "@/lib/format";
import { PLATFORM_META, VEHICLE_META } from "@/lib/platforms";
import type { Draft } from "@/lib/offline/types";
import { SignaturePad, type SignaturePadHandle } from "@/components/ui/signature-pad";
import { StepTitle } from "./field";

export function StepSeal({ draft, update, restaurantName, retentionDays }: { draft: Draft; update: (patch: Partial<Draft>) => void; restaurantName: string; retentionDays: number }) {
  const pad = useRef<SignaturePadHandle>(null);
  const photoCount = Object.keys(draft.photos).length;

  return (
    <div>
      <StepTitle index={3} title="Signer et sceller" />

      <div className="mb-4 border-l-[3px] border-accent bg-surface px-3 py-2.5 text-[13px] leading-snug text-muted" data-testid="rgpd-notice">
        <strong className="text-ink">Information livreur.</strong> {restaurantName} conserve votre prénom, initiale, signature et les photos du sac pendant {retentionDays} jours, uniquement pour prouver la
        remise en cas de litige. Aucune reconnaissance faciale. Vous recevez votre propre reçu.
      </div>

      <div className="plate overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="kicker">Signature du livreur · facultative</span>
          <button type="button" onClick={() => pad.current?.clear()} className="h-9 px-2 text-sm font-semibold text-muted underline decoration-dotted underline-offset-4">
            Effacer
          </button>
        </div>
        <div className="on-paper relative">
          <SignaturePad
            ref={pad}
            initial={draft.signature}
            onChange={(empty) => empty && update({ signature: null })}
            onStrokeEnd={async () => {
              const blob = await pad.current?.toBlob();
              update({ signature: blob ?? null });
            }}
          />
          <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-black/20" />
          <span className="pointer-events-none absolute bottom-2 left-6 font-mono text-[10px] uppercase tracking-[0.2em] text-black/35">Signez ici avec le doigt</span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-y border-dashed border-line py-3 font-mono text-[13px]">
        <dt className="text-muted">Commande</dt>
        <dd className="text-right font-semibold">#{draft.order_ref}</dd>
        <dt className="text-muted">Plateforme</dt>
        <dd className="text-right">{draft.platform ? PLATFORM_META[draft.platform].label : "—"}</dd>
        <dt className="text-muted">Montant · articles</dt>
        <dd className="tabular text-right">
          {formatEuros(parseEuros(draft.amount))} · {draft.items_count}
        </dd>
        <dt className="text-muted">Livreur</dt>
        <dd className="text-right">
          {draft.courier_name} {draft.vehicle ? VEHICLE_META[draft.vehicle].emoji : ""}
        </dd>
        <dt className="text-muted">Photos</dt>
        <dd className="tabular text-right">{photoCount}/3</dd>
      </dl>

      <label
        className={`mt-4 flex min-h-[72px] cursor-pointer items-center gap-4 rounded-[3px] border-[1.5px] px-4 py-3 ${draft.confirm_closed ? "border-ok bg-ok/10" : "border-ink bg-raise"}`}
        data-testid="confirm-closed"
      >
        <input
          type="checkbox"
          className="peer sr-only"
          checked={draft.confirm_closed}
          onChange={(e) => {
            haptic("check");
            update({ confirm_closed: e.target.checked });
          }}
        />
        <span
          aria-hidden
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] border-2 text-xl font-bold peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-accent ${draft.confirm_closed ? "border-ok bg-ok text-white" : "border-ink"}`}
        >
          {draft.confirm_closed ? "✓" : ""}
        </span>
        <span className="text-[18px] font-semibold leading-tight">
          Sac remis fermé et complet
          <span className="block text-[13px] font-normal text-muted">Obligatoire pour sceller</span>
        </span>
      </label>
    </div>
  );
}
