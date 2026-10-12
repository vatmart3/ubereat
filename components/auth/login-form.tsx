"use client";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        const supabase = createBrowserSupabase();
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (err) {
          setError(err.message);
          setState("error");
        } else setState("sent");
      }}
      className="space-y-3"
    >
      {state === "sent" ? (
        <div className="plate p-4">
          <div className="kicker">Lien envoyé</div>
          <p className="mt-1 text-[16px]">
            Ouvrez l&apos;e-mail envoyé à <strong>{email}</strong> sur ce téléphone et touchez le lien. Vous pourrez ensuite définir un PIN pour vous reconnecter en 2 secondes.
          </p>
        </div>
      ) : (
        <>
          <label className="block">
            <span className="kicker">E-mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@restaurant.fr"
              className="mt-1 h-16 w-full rounded-[3px] border-[1.5px] border-line bg-raise px-4 text-[20px] focus:border-ink focus:outline-none"
            />
          </label>
          <Button type="submit" size="xl" block disabled={state === "sending"}>
            {state === "sending" ? "Envoi…" : "Recevoir le lien de connexion"}
          </Button>
          {state === "error" ? <p className="font-semibold text-warn">{error}</p> : null}
        </>
      )}
    </form>
  );
}
