"use client";
import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { SLOT_META } from "@/lib/platforms";
import type { Slot } from "@/lib/types";

/** Viseur plein écran (getUserMedia, caméra arrière) avec déclencheur géant. */
export function Viewfinder({ slot, onCapture, onClose }: { slot: Slot; onCapture: (blob: Blob) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
      })
      .catch(() => setError("Caméra indisponible. Autorisez l'accès ou utilisez l'appareil photo du téléphone."));
    if (!navigator.mediaDevices) setError("Caméra indisponible sur ce navigateur.");
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const shoot = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    haptic("photo");
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    c.toBlob((b) => b && onCapture(b), "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-label="Viseur photo">
      <div className="safe-top flex items-center justify-between px-4 py-3">
        <span className="kicker text-white/70">{SLOT_META[slot].label}</span>
        <button type="button" onClick={onClose} className="h-11 rounded-[3px] border border-white/30 px-4 text-sm font-semibold">
          Fermer
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <p className="p-6 text-center text-white/80">{error}</p>
        ) : (
          <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-6 top-6 border border-white/25" />
        <p className="absolute inset-x-0 bottom-3 text-center font-mono text-xs text-white/80">Cadrez le sac — pas le visage du livreur</p>
        {flash ? <div className="absolute inset-0 bg-white/80" /> : null}
      </div>
      <div className="safe-bottom flex items-center justify-center py-6">
        <button
          type="button"
          onClick={shoot}
          disabled={Boolean(error)}
          aria-label="Prendre la photo"
          className="h-24 w-24 rounded-full border-[6px] border-white bg-white/20 active:scale-95 disabled:opacity-30"
        />
      </div>
    </div>
  );
}
