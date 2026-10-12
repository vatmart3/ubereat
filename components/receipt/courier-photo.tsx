"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { processPhoto } from "@/lib/image/stamp";
import { haptic } from "@/lib/haptics";

/** Le livreur ajoute sa propre photo de prise en charge (événement séparé, hors contenu scellé). */
export function CourierPhoto({ token, orderRef, restaurantName, remaining }: { token: string; orderRef: string; restaurantName: string; remaining: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");
  if (remaining <= 0) return null;
  return (
    <div>
      <label className={`flex h-14 w-full cursor-pointer items-center justify-center rounded-[3px] border-[1.5px] border-ink bg-raise font-semibold ${state === "busy" ? "opacity-60" : ""}`}>
        {state === "busy" ? "Envoi…" : state === "done" ? "Photo ajoutée ✓ — en ajouter une autre" : "Ajouter ma photo de prise en charge"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={state === "busy"}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setState("busy");
            haptic("photo");
            try {
              const capturedAt = new Date();
              const { stamped } = await processPhoto(file, { orderRef, restaurantName: `${restaurantName} · LIVREUR`, capturedAt });
              const form = new FormData();
              form.set("file", stamped, "livreur.jpg");
              form.set("captured_at", capturedAt.toISOString());
              const res = await fetch(`/api/r/${token}/photo`, { method: "POST", body: form });
              if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Envoi impossible");
              setState("done");
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
              setState("error");
            }
          }}
        />
      </label>
      {state === "error" ? <p className="mt-2 text-[14px] font-semibold text-warn">{error}</p> : null}
      <p className="mt-2 text-[12.5px] text-muted">Votre photo est ajoutée au journal de la remise. Elle ne modifie pas la preuve scellée par le restaurant.</p>
    </div>
  );
}
