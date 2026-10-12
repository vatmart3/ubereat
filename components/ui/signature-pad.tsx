"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface SignaturePadHandle {
  clear(): void;
  isEmpty(): boolean;
  toBlob(): Promise<Blob | null>;
}

/** Pad de signature au doigt : pointer events, `touch-action: none`, tracé lissé. */
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange?: (empty: boolean) => void; onStrokeEnd?: () => void; initial?: Blob | null; height?: number }>(
  function SignaturePad({ onChange, onStrokeEnd, initial, height = 168 }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const points = useRef<{ x: number; y: number }[]>([]);
    const drawing = useRef(false);
    const [empty, setEmpty] = useState(true);

    const ctx = () => canvas.current?.getContext("2d") ?? null;

    const setup = useCallback(() => {
      const c = canvas.current;
      if (!c) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = c.getBoundingClientRect();
      c.width = Math.round(rect.width * ratio);
      c.height = Math.round(rect.height * ratio);
      const g = c.getContext("2d")!;
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      g.lineCap = "round";
      g.lineJoin = "round";
      g.strokeStyle = "#15181B";
      g.lineWidth = 2.6;
    }, []);

    useEffect(() => {
      setup();
      if (initial) {
        const url = URL.createObjectURL(initial);
        const img = new Image();
        img.onload = () => {
          const c = canvas.current;
          if (!c) return;
          const rect = c.getBoundingClientRect();
          ctx()?.drawImage(img, 0, 0, rect.width, rect.height);
          setEmpty(false);
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pos = (e: React.PointerEvent) => {
      const rect = canvas.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const markDirty = () => {
      if (empty) {
        setEmpty(false);
        onChange?.(false);
      }
    };

    useImperativeHandle(ref, () => ({
      clear() {
        const c = canvas.current;
        if (!c) return;
        ctx()?.clearRect(0, 0, c.width, c.height);
        setEmpty(true);
        onChange?.(true);
      },
      isEmpty: () => empty,
      toBlob: () =>
        new Promise((resolve) => {
          if (empty || !canvas.current) return resolve(null);
          canvas.current.toBlob((b) => resolve(b), "image/png");
        }),
    }));

    return (
      <canvas
        ref={canvas}
        data-testid="signature-pad"
        aria-label="Zone de signature : signez avec le doigt"
        role="img"
        className="block w-full cursor-crosshair rounded-[2px] bg-paper"
        style={{ height, touchAction: "none" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const p = pos(e);
          points.current = [p];
          const g = ctx();
          if (g) {
            g.beginPath();
            g.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
            g.fillStyle = "#15181B";
            g.fill();
          }
          markDirty();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const g = ctx();
          if (!g) return;
          const events = "getCoalescedEvents" in e.nativeEvent ? e.nativeEvent.getCoalescedEvents() : [];
          const list = events.length ? events.map((ev) => ({ x: ev.clientX - canvas.current!.getBoundingClientRect().left, y: ev.clientY - canvas.current!.getBoundingClientRect().top })) : [pos(e)];
          for (const p of list) {
            const pts = points.current;
            pts.push(p);
            if (pts.length < 3) continue;
            const [a, b, c] = pts.slice(-3) as [typeof p, typeof p, typeof p];
            g.beginPath();
            g.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
            g.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
            g.stroke();
          }
        }}
        onPointerUp={() => {
          drawing.current = false;
          onStrokeEnd?.();
        }}
        onPointerCancel={() => (drawing.current = false)}
      />
    );
  },
);
