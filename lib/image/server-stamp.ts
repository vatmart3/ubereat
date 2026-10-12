/**
 * Tamponnage côté serveur (pur JS, sans canvas) — utilisé pour les photos du seed de démo.
 * En production, le bandeau est incrusté dans le navigateur (lib/image/stamp.ts).
 * Police bitmap 5×7 : look « imprimante thermique ».
 */
import jpeg from "jpeg-js";

const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "10001", "11001", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "·": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

export interface RawImage {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
}

export function decodeJpeg(bytes: Uint8Array): RawImage {
  const img = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { width: img.width, height: img.height, data: img.data };
}

export function encodeJpeg(img: RawImage, quality = 80): Uint8Array {
  const out = jpeg.encode({ width: img.width, height: img.height, data: img.data }, quality);
  return new Uint8Array(out.data);
}

function fillRect(img: RawImage, x0: number, y0: number, w: number, h: number, rgb: [number, number, number], alpha = 1) {
  for (let y = Math.max(0, y0); y < Math.min(img.height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(img.width, x0 + w); x++) {
      const i = (y * img.width + x) * 4;
      img.data[i] = Math.round(img.data[i]! * (1 - alpha) + rgb[0] * alpha);
      img.data[i + 1] = Math.round(img.data[i + 1]! * (1 - alpha) + rgb[1] * alpha);
      img.data[i + 2] = Math.round(img.data[i + 2]! * (1 - alpha) + rgb[2] * alpha);
    }
  }
}

function asciiUpper(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

function drawText(img: RawImage, text: string, x: number, y: number, scale: number, rgb: [number, number, number]) {
  let cx = x;
  for (const ch of asciiUpper(text)) {
    const glyph = GLYPHS[ch] ?? GLYPHS[" "]!;
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < 5; gx++) if (row[gx] === "1") fillRect(img, cx + gx * scale, y + gy * scale, scale, scale, rgb);
    });
    cx += 6 * scale;
  }
}

/** Bandeau incrusté en bas de la photo : heure · date · n° · restaurant. */
export function stampBand(img: RawImage, lines: [string, string]): RawImage {
  const copy: RawImage = { width: img.width, height: img.height, data: new Uint8Array(img.data) };
  const scale = Math.max(2, Math.round(img.width / 220));
  const lineH = 9 * scale;
  const bandH = lineH * 2 + scale * 6;
  fillRect(copy, 0, copy.height - bandH, copy.width, bandH, [21, 24, 27], 0.82);
  fillRect(copy, 0, copy.height - bandH, scale * 2, bandH, [138, 147, 255]);
  drawText(copy, lines[0], scale * 6, copy.height - bandH + scale * 3, scale, [255, 255, 253]);
  drawText(copy, lines[1], scale * 6, copy.height - bandH + scale * 3 + lineH, scale, [190, 196, 202]);
  return copy;
}

/** Réduction par moyenne de blocs (miniatures). */
export function downscale(img: RawImage, maxWidth: number): RawImage {
  if (img.width <= maxWidth) return img;
  const ratio = img.width / maxWidth;
  const w = maxWidth;
  const h = Math.max(1, Math.round(img.height / ratio));
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x * ratio);
      const sy0 = Math.floor(y * ratio);
      const sx1 = Math.min(img.width, Math.floor((x + 1) * ratio));
      const sy1 = Math.min(img.height, Math.floor((y + 1) * ratio));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * img.width + sx) * 4;
          r += img.data[i]!;
          g += img.data[i + 1]!;
          b += img.data[i + 2]!;
          n++;
        }
      }
      const o = (y * w + x) * 4;
      data[o] = r / n;
      data[o + 1] = g / n;
      data[o + 2] = b / n;
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}
