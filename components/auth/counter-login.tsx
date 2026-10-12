"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Member } from "@/lib/types";
import { PinPad } from "@/components/ui/pin-pad";
import { haptic } from "@/lib/haptics";

/** Connexion rapide au comptoir : on touche son prénom, on tape son PIN. */
export function CounterLogin({ members, next }: { members: Member[]; next: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Member | null>(members.length === 1 ? members[0]! : null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member_id: selected.id, pin: value }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string; remaining?: number };
    if (res.ok) {
      haptic("check");
      router.replace(next);
      router.refresh();
      return;
    }
    haptic("error");
    setError(data.remaining !== undefined ? `${data.error} · ${data.remaining} essai${data.remaining > 1 ? "s" : ""} restant${data.remaining > 1 ? "s" : ""}` : (data.error ?? "Erreur"));
    setPin("");
    setBusy(false);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qui est au comptoir ?">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={selected?.id === m.id}
            onClick={() => {
              haptic("tap");
              setSelected(m);
              setPin("");
              setError(null);
            }}
            className={`flex h-16 items-center gap-3 rounded-[3px] border-[1.5px] px-3 text-left ${selected?.id === m.id ? "border-ink bg-ink text-bg" : "border-line bg-raise"}`}
            data-testid={`member-${m.display_name}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono font-semibold ${selected?.id === m.id ? "bg-bg text-ink" : "bg-ink text-bg"}`}>{m.display_name.slice(0, 1)}</span>
            <span className="truncate text-[17px] font-semibold">{m.display_name}</span>
          </button>
        ))}
      </div>
      {selected ? (
        <div className="mt-4">
          <PinPad value={pin} onChange={setPin} onComplete={submit} disabled={busy} />
          {error ? (
            <p role="alert" className="mt-3 text-center font-semibold text-warn">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
