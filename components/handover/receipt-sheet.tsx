"use client";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Qr } from "@/components/ui/qr";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";

/** QR plein écran + lien copiable : le livreur scanne avec son téléphone, sans compte. */
export function ReceiptSheet({ open, onClose, token, orderRef }: { open: boolean; onClose: () => void; token: string; orderRef: string }) {
  const [url, setUrl] = useState(`/r/${token}`);
  const [size, setSize] = useState(280);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setUrl(`${window.location.origin}/r/${token}`);
    setSize(Math.min(300, window.innerWidth - 90));
  }, [token]);
  return (
    <Sheet open={open} onClose={onClose} label="Reçu livreur">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="kicker">Reçu livreur · #{orderRef}</div>
            <h2 className="display mt-1 text-[40px]">Scannez-moi</h2>
          </div>
          <button type="button" onClick={onClose} className="h-11 rounded-[3px] border border-line px-4 text-sm font-semibold">
            Fermer
          </button>
        </div>
        <p className="mt-2 text-[15px] text-muted">Le livreur scanne avec l&apos;appareil photo de son téléphone. Ce reçu le protège aussi.</p>
        <div className="on-paper mx-auto mt-5 w-fit bg-paper p-4 shadow-lg">
          <Qr value={url} size={size} />
        </div>
        <div className="mt-4 break-all rounded-[3px] border border-line bg-raise px-3 py-2 font-mono text-[12.5px]" data-testid="receipt-url">
          {url}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                haptic("check");
                setTimeout(() => setCopied(false), 1800);
              } catch {}
            }}
          >
            {copied ? "Lien copié ✓" : "Copier le lien"}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (navigator.share) void navigator.share({ title: `Reçu de remise #${orderRef}`, url }).catch(() => undefined);
              else void navigator.clipboard?.writeText(url);
            }}
          >
            Partager
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
