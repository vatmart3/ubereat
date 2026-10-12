import { STATUS_META } from "@/lib/platforms";
import type { HandoverStatus } from "@/lib/types";

const TONES = {
  ok: "text-ok border-ok/40 bg-ok/10",
  warn: "text-warn border-warn/50 bg-warn/10",
  muted: "text-muted border-line bg-surface",
};

export function StatusBadge({ status }: { status: HandoverStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[2px] border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${TONES[meta.tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.tone === "ok" ? "bg-ok" : meta.tone === "warn" ? "bg-warn" : "bg-muted"}`} />
      {meta.label}
    </span>
  );
}
