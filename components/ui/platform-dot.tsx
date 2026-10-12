import { PLATFORM_META } from "@/lib/platforms";
import type { Platform } from "@/lib/types";

export function PlatformDot({ platform, size = 10 }: { platform: Platform; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full ring-2 ring-black/5"
      style={{ width: size, height: size, background: `var(--${platform})` }}
      title={PLATFORM_META[platform].label}
    />
  );
}
