"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function Qr({ value, size = 260, className = "" }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#15181B", light: "#FFFFFD" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [value]);
  return (
    <div
      role="img"
      aria-label="QR code du reçu livreur"
      className={`bg-paper ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
