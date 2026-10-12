"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Member, Restaurant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PinPad } from "@/components/ui/pin-pad";
import { Qr } from "@/components/ui/qr";
import { Sheet } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(data.error ?? "Erreur"));
  return data;
}

export function SettingsView({ restaurant, members, me, isOwner, demo }: { restaurant: Restaurant; members: Member[]; me: string; isOwner: boolean; demo: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: restaurant.name, city: restaurant.city, address: restaurant.address ?? "", retention_days: restaurant.retention_days });
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [pinFor, setPinFor] = useState<Member | null>(null);
  const [pin, setPin] = useState("");
  const [haptics, setHaptics] = useState(true);
  const [geo, setGeo] = useState(false);

  useEffect(() => {
    try {
      setHaptics(localStorage.getItem("remis-haptics") !== "off");
      setGeo(localStorage.getItem("remis-geo") === "on");
    } catch {}
  }, []);

  const save = async () => {
    setError(null);
    try {
      await api("/api/restaurants", "PATCH", { ...form, address: form.address || null });
      setSaved("Enregistré");
      router.refresh();
      setTimeout(() => setSaved(null), 1600);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-4 pb-8 pt-5">
      <div>
        <div className="kicker">{restaurant.name}</div>
        <h1 className="display text-[56px]">Réglages</h1>
      </div>

      <section className="plate p-4" aria-label="Établissement">
        <h2 className="kicker mb-3">Établissement</h2>
        <div className="space-y-3">
          {(["name", "city", "address"] as const).map((k) => (
            <label key={k} className="block">
              <span className="text-[13px] font-semibold text-muted">{k === "name" ? "Nom" : k === "city" ? "Ville" : "Adresse (sur les dossiers)"}</span>
              <input
                disabled={!isOwner}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="mt-1 h-12 w-full rounded-[3px] border-[1.5px] border-line bg-raise px-3 focus:border-ink focus:outline-none disabled:opacity-60"
              />
            </label>
          ))}
          <label className="block">
            <span className="text-[13px] font-semibold text-muted">Durée de conservation des preuves (RGPD)</span>
            <select
              disabled={!isOwner}
              value={form.retention_days}
              onChange={(e) => setForm({ ...form, retention_days: Number(e.target.value) })}
              className="mt-1 h-12 w-full rounded-[3px] border-[1.5px] border-line bg-raise px-3 disabled:opacity-60"
            >
              {[30, 60, 90, 180, 365].map((d) => (
                <option key={d} value={d}>
                  {d} jours{d === 90 ? " (recommandé)" : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[12.5px] text-muted">Purge automatique chaque nuit : photos, signatures et reçus au-delà de cette durée sont effacés.</span>
          </label>
          {isOwner ? (
            <Button block onClick={save}>
              {saved ?? "Enregistrer"}
            </Button>
          ) : null}
          {error ? <p className="text-[14px] font-semibold text-warn">{error}</p> : null}
        </div>
      </section>

      <section className="plate p-4" aria-label="Équipe">
        <h2 className="kicker mb-3">Équipe · connexion par PIN au comptoir</h2>
        <ul className="divide-y divide-line border-y border-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <div className="font-semibold">
                  {m.display_name} {m.id === me ? <span className="text-muted">(vous)</span> : null}
                </div>
                <div className="font-mono text-[11.5px] uppercase tracking-wider text-muted">
                  {m.role === "owner" ? "Propriétaire" : "Équipier"} · {m.has_pin ? "PIN défini" : "sans PIN"}
                </div>
              </div>
              {m.id === me || isOwner ? (
                <Button variant="outline" size="md" onClick={() => setPinFor(m)}>
                  {m.has_pin ? "Changer le PIN" : "Définir un PIN"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {isOwner ? (
          <Button
            variant="primary"
            block
            className="mt-3"
            onClick={async () => {
              try {
                const data = await api("/api/invites", "POST", { role: "staff" });
                setInvite(String(data.url));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Inviter un équipier par lien
          </Button>
        ) : null}
      </section>

      <section className="plate p-4" aria-label="Ce téléphone">
        <h2 className="kicker mb-3">Ce téléphone</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[15px]">Thème</span>
          <ThemeToggle />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[15px]">Vibrations</span>
          <button
            type="button"
            role="switch"
            aria-checked={haptics}
            onClick={() => {
              const next = !haptics;
              setHaptics(next);
              try {
                localStorage.setItem("remis-haptics", next ? "on" : "off");
              } catch {}
            }}
            className={`h-10 w-20 rounded-[3px] border-[1.5px] font-mono text-[12px] font-semibold uppercase ${haptics ? "border-ink bg-ink text-bg" : "border-line text-muted"}`}
          >
            {haptics ? "Oui" : "Non"}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[15px]">
            Joindre la position du comptoir
            <span className="block text-[12.5px] text-muted">Facultatif · position du téléphone du restaurant, jamais celle du livreur</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={geo}
            onClick={() => {
              const next = !geo;
              setGeo(next);
              try {
                localStorage.setItem("remis-geo", next ? "on" : "off");
              } catch {}
              if (next) navigator.geolocation?.getCurrentPosition(() => undefined, () => undefined);
            }}
            className={`h-10 w-20 shrink-0 rounded-[3px] border-[1.5px] font-mono text-[12px] font-semibold uppercase ${geo ? "border-ink bg-ink text-bg" : "border-line text-muted"}`}
          >
            {geo ? "Oui" : "Non"}
          </button>
        </div>
        <p className="mt-3 text-[13px] text-muted">Ce téléphone est rattaché à {restaurant.name} : l&apos;équipe se connecte avec son PIN, sans e-mail. Le cadenas en haut verrouille la session.</p>
        {demo ? <p className="mt-2 font-mono text-[12px] text-accent">Mode démo · PIN Camille 1234 · Yanis 2580</p> : null}
      </section>

      <Sheet open={Boolean(invite)} onClose={() => setInvite(null)} label="Invitation">
        <div className="px-5 pb-5 pt-5">
          <div className="kicker">Invitation · valable 7 jours</div>
          <h2 className="display mt-1 text-[36px]">Rejoindre {restaurant.name}</h2>
          <div className="on-paper mx-auto mt-4 w-fit bg-paper p-3">{invite ? <Qr value={invite} size={220} /> : null}</div>
          <div className="mt-3 break-all rounded-[3px] border border-line bg-raise p-2 font-mono text-[12px]">{invite}</div>
          <Button block className="mt-3" onClick={() => invite && navigator.clipboard?.writeText(invite)}>
            Copier le lien
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={Boolean(pinFor)}
        onClose={() => {
          setPinFor(null);
          setPin("");
        }}
        label="Code PIN"
      >
        <div className="px-5 pb-5 pt-5">
          <div className="kicker">PIN de {pinFor?.display_name}</div>
          <h2 className="display mt-1 text-[36px]">4 chiffres</h2>
          <PinPad
            value={pin}
            onChange={setPin}
            onComplete={async (v) => {
              try {
                await api(`/api/members/${pinFor!.id}/pin`, "POST", { pin: v });
                setPinFor(null);
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setPin("");
              }
            }}
          />
          {error ? <p className="mt-2 text-center text-[14px] font-semibold text-warn">{error}</p> : null}
        </div>
      </Sheet>
    </div>
  );
}
