"use client";
import { ContactShadows, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** Textures procédurales (canvas) : aucun asset réseau. */
function useCanvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d")!, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function kraft(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#c39a6b";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4200; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? "rgba(255,240,215,.08)" : "rgba(80,50,20,.09)";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1);
  }
  ctx.strokeStyle = "rgba(90,60,30,.18)";
  for (let y = 40; y < h; y += 90 + Math.random() * 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + (Math.random() - 0.5) * 12);
    ctx.stroke();
  }
}

function ticket(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#fffffd";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#15181b";
  ctx.font = "900 46px 'Arial Narrow', Arial, sans-serif";
  ctx.fillText("REMIS.", 28, 70);
  ctx.font = "500 20px ui-monospace, monospace";
  ctx.fillStyle = "#5b656c";
  ctx.fillText("PREUVE DE REMISE", 28, 104);
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "#9aa3a9";
  ctx.beginPath();
  ctx.moveTo(28, 128);
  ctx.lineTo(w - 28, 128);
  ctx.stroke();
  ctx.fillStyle = "#15181b";
  ctx.font = "900 92px 'Arial Narrow', Arial, sans-serif";
  ctx.fillText("#UB-4821", 24, 228);
  ctx.font = "500 24px ui-monospace, monospace";
  const rows = [
    ["Uber Eats", "3 art."],
    ["Montant", "24,50 €"],
    ["Livreur", "Karim B."],
    ["Photos", "2 / 3"],
    ["Heure serveur", "14:32:07"],
  ];
  rows.forEach(([k, v], i) => {
    ctx.fillStyle = "#5b656c";
    ctx.fillText(k!, 28, 290 + i * 42);
    ctx.fillStyle = "#15181b";
    ctx.fillText(v!, w - 28 - ctx.measureText(v!).width, 290 + i * 42);
  });
  ctx.beginPath();
  ctx.moveTo(28, 520);
  ctx.lineTo(w - 28, 520);
  ctx.stroke();
  ctx.font = "500 17px ui-monospace, monospace";
  ctx.fillStyle = "#5b656c";
  ctx.fillText("4735728f06d8b29eb5c26d3b771b7c6c", 28, 556);
  ctx.fillText("17e02df227538aaa351dfab8c2f971b4", 28, 580);
}

function inkStamp(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.16);
  ctx.strokeStyle = "#2f3bd1";
  ctx.fillStyle = "#2f3bd1";
  ctx.lineWidth = 12;
  ctx.strokeRect(-w * 0.42, -h * 0.34, w * 0.84, h * 0.68);
  ctx.lineWidth = 4;
  ctx.strokeRect(-w * 0.46, -h * 0.4, w * 0.92, h * 0.8);
  ctx.font = "900 120px 'Arial Narrow', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("REMIS", 0, 30);
  ctx.font = "600 46px ui-monospace, monospace";
  ctx.fillText("14:32:07", 0, 92);
  // usure de l'encre
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 1600; i++) ctx.fillRect((Math.random() - 0.5) * w, (Math.random() - 0.5) * h, 2 + Math.random() * 3, 2);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

function Bag({ progress }: { progress: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null);
  const ticketRef = useRef<THREE.Group>(null);
  const stampRef = useRef<THREE.Group>(null);
  const markRef = useRef<THREE.MeshBasicMaterial>(null);
  const kraftTex = useCanvasTexture(kraft, 512, 512);
  const ticketTex = useCanvasTexture(ticket, 400, 620);
  const markTex = useCanvasTexture(inkStamp, 400, 280);

  useFrame((state, delta) => {
    const p = progress.get();
    const g = group.current;
    if (g) {
      // Rotation lente, qui se fige face caméra au moment du tampon.
      const spin = 1 - ease((p - 0.15) / 0.35);
      g.rotation.y += delta * 0.35 * spin;
      if (spin < 1) g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.round(g.rotation.y / (Math.PI * 2)) * Math.PI * 2 - 0.25, 1 - spin);
      g.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.03;
    }
    const out = ease((p - 0.05) / 0.35);
    if (ticketRef.current) {
      ticketRef.current.position.y = THREE.MathUtils.lerp(0.55, 1.75, out);
      ticketRef.current.rotation.z = THREE.MathUtils.lerp(0, -0.05, out);
    }
    const down = (p - 0.5) / 0.22;
    const press = down < 1 ? ease(down) : 1 - ease((p - 0.75) / 0.2) * 0.9;
    if (stampRef.current) stampRef.current.position.y = THREE.MathUtils.lerp(3.8, 2.06, press);
    if (markRef.current) markRef.current.opacity = clamp01((p - 0.68) / 0.06) * 0.92;
  });

  const front = useMemo(() => new THREE.MeshStandardMaterial({ map: kraftTex, roughness: 0.92, metalness: 0 }), [kraftTex]);
  return (
    <group ref={group} position={[0, -0.55, 0]}>
      {/* Corps du sac */}
      <RoundedBox args={[1.5, 1.9, 0.8]} radius={0.03} smoothness={2} material={front} castShadow />
      {/* Rabat replié */}
      <mesh position={[0, 1.02, 0.02]} rotation={[0.08, 0, 0]} material={front}>
        <boxGeometry args={[1.52, 0.22, 0.86]} />
      </mesh>
      <mesh position={[0, 0.9, 0.42]}>
        <boxGeometry args={[1.5, 0.012, 0.01]} />
        <meshStandardMaterial color="#8a6238" />
      </mesh>
      {/* Pastille de scellé */}
      <mesh position={[0.42, 0.05, 0.405]}>
        <circleGeometry args={[0.17, 40]} />
        <meshStandardMaterial color="#2f3bd1" roughness={0.5} />
      </mesh>
      <mesh position={[0.42, 0.05, 0.407]}>
        <ringGeometry args={[0.12, 0.135, 40]} />
        <meshBasicMaterial color="#dfe2ff" />
      </mesh>
      {/* Ticket qui sort du sac */}
      <group ref={ticketRef} position={[-0.05, 0.55, 0.12]}>
        <mesh>
          <planeGeometry args={[0.82, 1.27]} />
          <meshBasicMaterial map={ticketTex} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh position={[0.05, -0.08, 0.004]}>
          <planeGeometry args={[0.64, 0.45]} />
          <meshBasicMaterial ref={markRef} map={markTex} transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {/* Tampon encreur */}
      <group ref={stampRef} position={[0, 3.8, 0.18]}>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.66, 0.08, 0.46]} />
          <meshStandardMaterial color="#1b1f2a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.7, 0.2, 0.5]} />
          <meshStandardMaterial color="#b7bec4" metalness={0.75} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.45, 24]} />
          <meshStandardMaterial color="#2a2f35" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <sphereGeometry args={[0.17, 28, 20]} />
          <meshStandardMaterial color="#2f3bd1" roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

export default function BagScene({ progress }: { progress: MotionValue<number> }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.05, 6.6], fov: 38 }} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }} shadows={false}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#8a93ff" />
      <Bag progress={progress} />
      <ContactShadows position={[0, -1.51, 0]} opacity={0.45} scale={6} blur={2.6} far={3} resolution={256} frames={1} />
    </Canvas>
  );
}
