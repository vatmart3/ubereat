"""Icônes PWA : plaque d'acier brossé, « R. » condensé, point tampon bleu."""
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
FONT = str(ROOT / "scripts/fonts/BigShouldersDisplay-Black.ttf")
OUT = ROOT / "public/icons"
OUT.mkdir(parents=True, exist_ok=True)

def steel(size, seed=4):
    rnd = random.Random(seed)
    img = Image.new("RGB", (size, size), (21, 24, 27))
    d = ImageDraw.Draw(img)
    for x in range(size):
        v = 22 + int(10 * rnd.random())
        d.line([(x, 0), (x, size)], fill=(v, v + 3, v + 6))
    return img

def icon(size, maskable=False, light=False):
    img = steel(size) if not light else Image.new("RGB", (size, size), (228, 232, 234))
    d = ImageDraw.Draw(img)
    pad = int(size * (0.2 if maskable else 0.12))
    f = ImageFont.truetype(FONT, int(size * (0.62 if maskable else 0.78)))
    text = "R"
    bbox = d.textbbox((0, 0), text, font=f)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - w) / 2 - bbox[0] - size * 0.06
    y = (size - h) / 2 - bbox[1]
    d.text((x, y), text, font=f, fill=(236, 239, 241) if not light else (21, 24, 27))
    r = size * (0.085 if maskable else 0.1)
    cx = x + bbox[2] + r * 1.1
    cy = y + bbox[3] - r
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(138, 147, 255) if not light else (47, 59, 209))
    return img

for s in (192, 512):
    icon(s).save(OUT / f"icon-{s}.png", optimize=True)
    icon(s, maskable=True).save(OUT / f"maskable-{s}.png", optimize=True)
icon(180).save(OUT / "apple-touch-icon.png", optimize=True)
icon(32).save(ROOT / "app/icon.png", optimize=True)
icon(180).save(ROOT / "app/apple-icon.png", optimize=True)
print("ok")
