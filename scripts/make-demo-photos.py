"""Génère les photos de démonstration (sac kraft, ticket, remise) — illustrations, pas de visages."""
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "supabase" / "seed-assets"
OUT.mkdir(parents=True, exist_ok=True)
W, H = 600, 800
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MONO_B = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

def font(path, size):
    from PIL import ImageFont
    return ImageFont.truetype(path, size)

def steel(seed):
    rnd = random.Random(seed)
    img = Image.new("RGB", (W, H), (170, 176, 180))
    d = ImageDraw.Draw(img)
    for x in range(W):
        v = 160 + int(18 * rnd.random()) + (8 if x % 3 == 0 else 0)
        d.line([(x, 0), (x, H)], fill=(v, v + 5, v + 8))
    # Lumière douce
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([-200, -300, W + 100, H // 2], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img = Image.composite(Image.new("RGB", (W, H), (235, 238, 240)), img, glow)
    return img

def kraft_texture(w, h, seed, base=(196, 154, 108)):
    rnd = random.Random(seed)
    tex = Image.new("RGB", (w, h), base)
    d = ImageDraw.Draw(tex)
    for _ in range(w * h // 30):
        x, y = rnd.randrange(w), rnd.randrange(h)
        k = rnd.randint(-22, 14)
        d.point((x, y), fill=(base[0] + k, base[1] + k, base[2] + k))
    for _ in range(18):
        y = rnd.randrange(h)
        d.line([(0, y), (w, y + rnd.randint(-6, 6))], fill=(base[0] - 14, base[1] - 14, base[2] - 12), width=1)
    return tex.filter(ImageFilter.GaussianBlur(0.6))

def shadow(img, box, radius=26, offset=(14, 22), alpha=110):
    sh = Image.new("L", (W, H), 0)
    x0, y0, x1, y1 = box
    ImageDraw.Draw(sh).rectangle([x0 + offset[0], y0 + offset[1], x1 + offset[0], y1 + offset[1]], fill=alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(radius))
    return Image.composite(Image.new("RGB", (W, H), (40, 44, 48)), img, sh)

def receipt(w, h, lines, seed):
    r = Image.new("RGBA", (w, h), (252, 252, 247, 255))
    d = ImageDraw.Draw(r)
    f = font(MONO, 15)
    fb = font(MONO_B, 22)
    d.text((14, 12), lines[0], fill=(30, 30, 30), font=fb)
    y = 46
    for line in lines[1:]:
        d.text((14, y), line, fill=(55, 55, 55), font=f)
        y += 22
    # bord dentelé bas
    for x in range(0, w, 12):
        d.polygon([(x, h), (x + 6, h - 7), (x + 12, h)], fill=(0, 0, 0, 0))
    return r

def bag(seed, label_lines, variant=0):
    img = steel(seed)
    bx0, by0, bx1, by1 = 110, 170, 490, 740
    img = shadow(img, (bx0, by0, bx1, by1))
    tex = kraft_texture(bx1 - bx0, by1 - by0, seed, base=(198, 156, 108) if variant == 0 else (186, 142, 96))
    img.paste(tex, (bx0, by0))
    d = ImageDraw.Draw(img)
    # pli du haut + rabat
    d.rectangle([bx0, by0, bx1, by0 + 70], fill=(170, 128, 84))
    d.line([(bx0, by0 + 70), (bx1, by0 + 70)], fill=(140, 102, 66), width=3)
    for i in range(3):
        d.line([(bx0, by0 + 22 + i * 18), (bx1, by0 + 22 + i * 18)], fill=(156, 116, 76), width=1)
    # côtés soufflet
    d.polygon([(bx0, by0 + 70), (bx0 + 26, by0 + 120), (bx0 + 26, by1), (bx0, by1)], fill=(176, 134, 90))
    d.polygon([(bx1, by0 + 70), (bx1 - 26, by0 + 120), (bx1 - 26, by1), (bx1, by1)], fill=(176, 134, 90))
    # ticket agrafé
    rc = receipt(230, 250, label_lines, seed)
    rc = rc.rotate(-3 if variant == 0 else 4, expand=True, resample=Image.BICUBIC)
    mask = rc.getchannel("A")
    img = shadow(img, (185, by0 + 40, 185 + rc.size[0], by0 + 40 + rc.size[1]), radius=10, offset=(5, 8), alpha=90)
    img.paste(rc.convert("RGB"), (185, by0 + 40), mask)
    d = ImageDraw.Draw(img)
    # agrafes
    for sx in (240, 330):
        d.rectangle([sx, by0 + 50, sx + 36, by0 + 55], fill=(205, 210, 214), outline=(120, 124, 128))
    # autocollant scellé
    d.ellipse([360, by0 + 300, 450, by0 + 390], fill=(47, 59, 209))
    d.ellipse([368, by0 + 308, 442, by0 + 382], outline=(230, 232, 255), width=3)
    d.text((381, by0 + 335), "SCELLÉ", fill=(240, 242, 255), font=font(MONO_B, 13))
    return img

def ticket_closeup(seed, lines):
    img = steel(seed)
    img = shadow(img, (90, 90, 510, 720), radius=18)
    rc = receipt(420, 630, lines, seed)
    d = ImageDraw.Draw(rc)
    f = font(MONO, 15)
    y = 300
    for row in ["1x  Burger maison     14,50", "1x  Frites fraîches     4,00", "1x  Limonade           3,50", "--------------------------", "TOTAL               22,00 €"]:
        d.text((18, y), row, fill=(45, 45, 45), font=f)
        y += 26
    for x in range(0, 420, 6):
        d.rectangle([x, 560, x + 3, 610], fill=(20, 20, 20) if random.Random(x + seed).random() > 0.4 else (252, 252, 247))
    rc = rc.rotate(1.5, expand=True, resample=Image.BICUBIC)
    img.paste(rc, (85, 85), rc.getchannel("A"))
    return img

def handoff(seed, lines):
    img = bag(seed, lines, variant=1)
    d = ImageDraw.Draw(img)
    # main gantée (forme abstraite), on cadre le sac, jamais le visage
    glove = (40, 46, 54)
    d.rounded_rectangle([400, 520, 600, 640], radius=40, fill=glove)
    for i in range(4):
        d.rounded_rectangle([380 - i * 6, 520 + i * 26, 440, 544 + i * 26], radius=12, fill=(52, 58, 66))
    d.rounded_rectangle([0, 560, 150, 660], radius=40, fill=(30, 34, 40))
    return img

lines_a = ["#UB-4821", "LA CANTINE DU PASSAGE", "Uber Eats · 3 articles", "Retrait : 4821"]
lines_b = ["#DR-0937", "LA CANTINE DU PASSAGE", "Deliveroo · 2 articles", "Retrait : 0937"]
bag(11, lines_a).save(OUT / "sac-a.jpg", quality=68, optimize=True, progressive=True)
bag(23, lines_b, variant=1).save(OUT / "sac-b.jpg", quality=68, optimize=True, progressive=True)
ticket_closeup(5, ["#JE-5512", "LA CANTINE DU PASSAGE", "Just Eat · commande 5512", "12 rue du Passage, Lyon"]).save(OUT / "ticket.jpg", quality=68, optimize=True, progressive=True)
handoff(31, lines_a).save(OUT / "remise.jpg", quality=68, optimize=True, progressive=True)
print("ok")

def signature(seed, path):
    rnd = random.Random(seed)
    img = Image.new("RGBA", (480, 180), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x, y = 40, 110
    pts = []
    for i in range(46):
        x += rnd.randint(6, 11)
        y = 100 + int(45 * __import__("math").sin(i * 0.55 + seed)) + rnd.randint(-8, 8)
        pts.append((x, y))
    d.line(pts, fill=(21, 24, 27, 255), width=4, joint="curve")
    d.line([(60, 140), (x - 20, 132)], fill=(21, 24, 27, 255), width=3)
    img.save(path, optimize=True)

signature(3, OUT / "signature-a.png")
signature(8, OUT / "signature-b.png")
