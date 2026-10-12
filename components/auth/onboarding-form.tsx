"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PinPad } from "@/components/ui/pin-pad";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? "Erreur"));
  return data;
}

/** Création d'un espace en 30 s : nom, ville, prénom → PIN → c'est prêt. */
export function OnboardingForm({ mode, inviteToken }: { mode: "create" | "join"; inviteToken?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "pin">("form");
  const [form, setForm] = useState({ name: "", city: "", display_name: "" });
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") await post("/api/restaurants", form);
      else await post("/api/invites/accept", { token: inviteToken, display_name: form.display_name });
      setStep("pin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (step === "pin") {
    return (
      <div>
        <p className="text-[16px] text-muted">Dernière étape : votre PIN à 4 chiffres pour vous connecter au comptoir en 2 secondes.</p>
        <PinPad
          value={pin}
          onChange={setPin}
          disabled={busy}
          onComplete={async (v) => {
            setBusy(true);
            try {
              const me = (await fetch("/api/me").then((r) => r.json())) as { member_id: string };
              await post(`/api/members/${me.member_id}/pin`, { pin: v });
              router.push("/app");
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
              setPin("");
              setBusy(false);
            }
          }}
        />
        {error ? <p className="mt-2 text-center font-semibold text-warn">{error}</p> : null}
        <button type="button" className="mt-4 w-full text-center text-sm text-muted underline" onClick={() => router.push("/app")}>
          Plus tard
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {mode === "create" ? (
        <>
          <Field label="Nom du restaurant" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="La Cantine du Passage" autoFocus />
          <Field label="Ville" value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="Lyon" />
        </>
      ) : null}
      <Field label="Votre prénom" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} placeholder="Camille" autoFocus={mode === "join"} />
      <Button type="submit" size="xl" block disabled={busy}>
        {busy ? "Création…" : mode === "create" ? "Créer mon espace" : "Rejoindre l'équipe"}
      </Button>
      {error ? <p className="font-semibold text-warn">{error}</p> : null}
    </form>
  );
}

function Field({ label, value, onChange, placeholder, autoFocus }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="kicker">{label}</span>
      <input
        required
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={80}
        className="mt-1 h-16 w-full rounded-[3px] border-[1.5px] border-line bg-raise px-4 text-[20px] placeholder:text-line focus:border-ink focus:outline-none"
      />
    </label>
  );
}
