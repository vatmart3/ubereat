"use client";
import { formatDate, formatTime } from "../format";

const MAX_SIDE = 1600;
const QUALITY = 0.8;
const THUMB_WIDTH = 240;

export interface ProcessedPhoto {
  original: Blob;
  stamped: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

function monoFamily(): string {
  if (typeof document === "undefined") return "monospace";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
  return value ? `${value}, ui-monospace, monospace` : "ui-monospace, monospace";
}

function toBlob(canvas: HTMLCanvasElement | OffscreenCanvas, quality: number): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/jpeg", quality });
  return new Promise((resolve, reject) =>
    (canvas as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error("Encodage JPEG impossible"))), "image/jpeg", quality),
  );
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* repli <img> (Safari ancien) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Bandeau incrusté : heure · date / n° de commande · restaurant. */
export function drawBand(ctx: CanvasRenderingContext2D, w: number, h: number, lines: [string, string]) {
  const fontSize = Math.max(14, Math.round(w * 0.028));
  const pad = Math.round(fontSize * 0.8);
  const bandH = fontSize * 2 + pad * 2 + Math.round(fontSize * 0.35);
  ctx.save();
  ctx.fillStyle = "rgba(21, 24, 27, 0.82)";
  ctx.fillRect(0, h - bandH, w, bandH);
  ctx.fillStyle = "#8A93FF";
  ctx.fillRect(0, h - bandH, Math.max(4, Math.round(w * 0.006)), bandH);
  const family = monoFamily();
  ctx.textBaseline = "top";
  ctx.fillStyle = "#FFFFFD";
  ctx.font = `600 ${fontSize}px ${family}`;
  ctx.fillText(lines[0], pad * 1.4, h - bandH + pad, w - pad * 2.8);
  ctx.fillStyle = "#C3C9CE";
  ctx.font = `500 ${fontSize}px ${family}`;
  ctx.fillText(lines[1], pad * 1.4, h - bandH + pad + fontSize * 1.3, w - pad * 2.8);
  ctx.restore();
}

export function bandLines(capturedAt: Date, orderRef: string, restaurantName: string): [string, string] {
  return [`${formatTime(capturedAt)} · ${formatDate(capturedAt)}`, `#${orderRef || "—"} · ${restaurantName}`.toUpperCase()];
}

/**
 * Redimensionne (1600 px max, JPEG 0,8), produit l'original non tamponné, la version tamponnée
 * et une miniature. Le ré-encodage canvas supprime les métadonnées EXIF (dont la position GPS).
 */
export async function processPhoto(
  file: Blob,
  info: { orderRef: string; restaurantName: string; capturedAt: Date; alreadyProcessed?: boolean },
): Promise<ProcessedPhoto> {
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.load(`600 20px ${monoFamily()}`).catch(() => undefined);
  }
  const source = await decode(file);
  const sw = "naturalWidth" in source ? source.naturalWidth : source.width;
  const sh = "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);

  const base = makeCanvas(w, h);
  const bctx = base.getContext("2d")!;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(source, 0, 0, w, h);
  if ("close" in source) source.close();

  const original = info.alreadyProcessed ? file : await toBlob(base, QUALITY);

  const stampedCanvas = makeCanvas(w, h);
  const sctx = stampedCanvas.getContext("2d")!;
  sctx.drawImage(base, 0, 0);
  drawBand(sctx, w, h, bandLines(info.capturedAt, info.orderRef, info.restaurantName));
  const stamped = await toBlob(stampedCanvas, QUALITY);

  const tw = Math.min(THUMB_WIDTH, w);
  const th = Math.round((h * tw) / w);
  const thumbCanvas = makeCanvas(tw, th);
  const tctx = thumbCanvas.getContext("2d")!;
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(stampedCanvas, 0, 0, tw, th);
  const thumb = await toBlob(thumbCanvas, 0.7);

  return { original, stamped, thumb, width: w, height: h };
}
