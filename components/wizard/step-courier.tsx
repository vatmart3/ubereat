"use client";
import { haptic } from "@/lib/haptics";
import { normalizeCourierName } from "@/lib/format";
import { VEHICLE_META } from "@/lib/platforms";
import { VEHICLES, type Courier } from "@/lib/types";
import type { Draft } from "@/lib/offline/types";
import { FieldLabel, StepTitle } from "./field";

export function StepCourier({ draft, update, recent }: { draft: Draft; update: (patch: Partial<Draft>) => void; recent: Courier[] }) {
  return (
    <div>
      <StepTitle index={2} title="Le livreur" />
      {recent.length > 0 ? (
        <div className="mb-5">
          <div className="kicker mb-2">Livreurs récents · un tap</div>
          <div className="rail -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {recent.map((c) => {
              const active = draft.courier_name === c.display_name;
              return (
                <button
                  key={c.id}
                  type="button"
                  data-testid="recent-courier"
                  onClick={() => {
                    haptic("tap");
                    update({ courier_name: c.display_name, vehicle: c.vehicle, pickup_code: c.last_code ?? "" });
                  }}
                  className={`flex h-14 shrink-0 items-center gap-2 rounded-[3px] border-[1.5px] px-4 text-[16px] font-semibold ${active ? "border-ink bg-ink text-bg" : "border-line bg-raise"}`}
                >
                  <span aria-hidden className="text-xl">
                    {VEHICLE_META[c.vehicle].emoji}
                  </span>
                  {c.display_name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <FieldLabel htmlFor="courier_name">Prénom + initiale</FieldLabel>
      <input
        id="courier_name"
        data-testid="courier-name"
        value={draft.courier_name}
        onChange={(e) => update({ courier_name: e.target.value.slice(0, 40) })}
        onBlur={(e) => update({ courier_name: normalizeCourierName(e.target.value) })}
        autoCapitalize="words"
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="next"
        placeholder="Karim B."
        className="h-16 w-full rounded-[3px] border-[1.5px] border-line bg-raise px-4 text-[24px] font-semibold placeholder:text-line focus:border-ink focus:outline-none"
      />

      <div className="mt-5">
        <FieldLabel>Véhicule</FieldLabel>
        <div role="radiogroup" aria-label="Véhicule" className="grid grid-cols-4 gap-2">
          {VEHICLES.map((v) => {
            const active = draft.vehicle === v;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`vehicle-${v}`}
                onClick={() => {
                  haptic("tap");
                  update({ vehicle: v });
                }}
                className={`flex h-[84px] flex-col items-center justify-center gap-1 rounded-[3px] border-[1.5px] ${active ? "border-ink bg-ink text-bg" : "border-line bg-raise"}`}
              >
                <span aria-hidden className="text-[30px] leading-none">
                  {VEHICLE_META[v].emoji}
                </span>
                <span className="text-[12.5px] font-semibold">{VEHICLE_META[v].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel htmlFor="pickup_code" optional>
          Code de retrait
        </FieldLabel>
        <input
          id="pickup_code"
          value={draft.pickup_code}
          onChange={(e) => update({ pickup_code: e.target.value.slice(0, 20) })}
          autoComplete="off"
          autoCapitalize="characters"
          enterKeyHint="next"
          inputMode="text"
          placeholder="ex. 4821"
          className="tabular h-14 w-full rounded-[3px] border-[1.5px] border-line bg-raise px-4 font-mono text-[22px] placeholder:text-line focus:border-ink focus:outline-none"
        />
      </div>
    </div>
  );
}
