"use client";
import { useEffect, useState } from "react";
import { formatTime } from "@/lib/format";

export function LiveClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <time className={`tabular font-mono ${className}`} suppressHydrationWarning aria-live="off">
      {now ? formatTime(now) : "--:--:--"}
    </time>
  );
}
