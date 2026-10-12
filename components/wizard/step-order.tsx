"use client";
import { useRef } from "react";
import { PLATFORM_META } from "@/lib/platforms";
import { haptic } from "@/lib/haptics";
import { PLATFORMS, type Platform } from "@/lib/types";
import type { Draft } from "@/lib/offline/types";
import { FieldLabel, StepTitle } from "./field";

export function StepOrder({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  const orderInput = useRef<HTMLInputElement>(null);
  const pick = (platform: Platform) => {
    haptic("tap");
    update({ platform });
    requestAnimationFrame(() => orderInput.current?.focus());
  };
  return (
    <div>
      <StepTitle index={0} title="La commande" />
      <div role="radiogroup" aria-label="Plateforme" className="grid grid-cols-2 gap-2.5">
        {PLATFORMS.map((p) => {
          const active = draft.platform === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`platform-${p}`}
              onClick={() => pick(p)}
              className={`relative flex h-[76px] items-center gap-3 rounded-[3px] border-[1.5px] px-4 text-left transition-colors ${active ? "border-ink bg-ink text-bg" : "border-line bg-raise text-ink hover:border-ink"}`}
            >
              <span className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white/40" style={{ background: PLATFORM_META[p].color }} />
              <span className="text-[17px] font-semibold leading-tight">{PLATFORM_META[p].label}</span>
              {active ? <span className="absolute right-3 top-2 font-mono text-xs">✓</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <FieldLabel htmlFor="order_ref">N° de commande</FieldLabel>
        <div className="flex items-stretch rounded-[3px] border-[1.5px] border-line bg-raise focus-within:border-ink">
          <span className="display flex items-center pl-3 text-[44px] text-muted">#</span>
          <input
            ref={orderInput}
            id="order_ref"
            data-testid="order-ref"
            value={draft.order_ref}
            onChange={(e) => update({ order_ref: e.target.value.toUpperCase().replace(/^#/, "").slice(0, 40) })}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="A1B2"
            className="display h-[76px] w-full min-w-0 bg-transparent px-2 text-[48px] placeholder:text-line focus:outline-none"
            style={{ fontSize: 48 }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
        <div>
          <FieldLabel htmlFor="amount" optional>
            Montant
          </FieldLabel>
          <div className="flex h-16 items-center rounded-[3px] border-[1.5px] border-line bg-raise px-3 focus-within:border-ink">
            <input
              id="amount"
              data-testid="amount"
              value={draft.amount}
              onChange={(e) => update({ amount: e.target.value.replace(/[^\d,.]/g, "").slice(0, 9) })}
              inputMode="decimal"
              enterKeyHint="next"
              placeholder="0,00"
              className="tabular w-full min-w-0 bg-transparent font-mono text-[26px] font-semibold placeholder:text-line focus:outline-none"
            />
            <span className="font-mono text-xl text-muted">€</span>
          </div>
        </div>
        <div>
          <FieldLabel>Articles</FieldLabel>
          <div className="flex h-16 items-center rounded-[3px] border-[1.5px] border-line bg-raise">
            <button
              type="button"
              aria-label="Un article de moins"
              onClick={() => {
                haptic("tap");
                update({ items_count: Math.max(1, draft.items_count - 1) });
              }}
              className="h-full w-14 text-3xl font-light text-ink disabled:text-line"
              disabled={draft.items_count <= 1}
            >
              −
            </button>
            <output aria-live="polite" className="tabular w-10 text-center font-mono text-[26px] font-semibold" data-testid="items-count">
              {draft.items_count}
            </output>
            <button
              type="button"
              aria-label="Un article de plus"
              onClick={() => {
                haptic("tap");
                update({ items_count: Math.min(999, draft.items_count + 1) });
              }}
              className="h-full w-14 text-3xl font-light text-ink"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
