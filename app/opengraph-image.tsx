import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "REMIS. — Un livreur dit qu'il n'a rien récupéré ? Montrez le ticket.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const [display, mono] = await Promise.all([
    readFile(join(process.cwd(), "app/fonts/BigShoulders-Black.ttf")),
    readFile(join(process.cwd(), "app/fonts/IBMPlexMono-SemiBold.ttf")),
  ]);
  const lines = Array.from({ length: 120 }, (_, i) => i);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0E1113", color: "#ECEFF1", position: "relative", fontFamily: "Display" }}>
        {lines.map((i) => (
          <div key={i} style={{ position: "absolute", left: i * 10, top: 0, bottom: 0, width: 1, background: i % 3 ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.05)" }} />
        ))}
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 0 64px 72px", width: 720 }}>
          <div style={{ display: "flex", fontSize: 56, letterSpacing: 2 }}>
            REMIS<span style={{ color: "#8A93FF" }}>.</span>
          </div>
          <div style={{ fontSize: 92, lineHeight: 0.9, marginTop: 40, textTransform: "uppercase" }}>Un livreur dit qu&apos;il n&apos;a rien récupéré ?</div>
          <div style={{ fontSize: 92, lineHeight: 0.9, marginTop: 14, textTransform: "uppercase", color: "#8A93FF" }}>Montrez le ticket.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", position: "absolute", right: 70, top: 70, width: 340, height: 490, background: "#FFFFFD", color: "#15181B", padding: 28, fontFamily: "Mono", transform: "rotate(3deg)" }}>
          <div style={{ fontFamily: "Display", fontSize: 34 }}>REMIS.</div>
          <div style={{ fontSize: 15, color: "#5B656C" }}>PREUVE DE REMISE</div>
          <div style={{ fontFamily: "Display", fontSize: 76, marginTop: 24 }}>#UB-4821</div>
          {[
            ["Uber Eats", "3 art."],
            ["Livreur", "Karim B."],
            ["Photos", "2 / 3"],
            ["Heure serveur", "14:32:07"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 19, marginTop: 12 }}>
              <span style={{ color: "#5B656C" }}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
          <div style={{ fontSize: 13, color: "#5B656C", marginTop: 26 }}>4735728f06d8b29eb5c26d3b771b7c6c</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", right: 30, top: 150, border: "6px solid #2F3BD1", color: "#2F3BD1", padding: "6px 16px", transform: "rotate(-12deg)", fontFamily: "Display" }}>
            <span style={{ fontSize: 54, lineHeight: 1 }}>REMIS</span>
            <span style={{ fontFamily: "Mono", fontSize: 20 }}>14:32:07</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Display", data: display, weight: 900 }, { name: "Mono", data: mono, weight: 600 }] },
  );
}
