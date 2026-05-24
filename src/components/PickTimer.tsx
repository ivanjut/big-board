"use client";

import { useEffect, useState } from "react";

// Counts down from `seconds`, anchored to the server-provided `startedAt`, so all
// viewers see the same clock regardless of when they loaded the page.
export function PickTimer({
  startedAt,
  seconds,
}: {
  startedAt: string;
  seconds: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  const remaining = seconds - elapsed;
  const expired = remaining <= 0;
  const mm = Math.floor(Math.max(remaining, 0) / 60);
  const ss = Math.max(remaining, 0) % 60;

  return (
    <span
      className={`tabular-nums font-semibold ${
        expired
          ? "text-red-400"
          : remaining <= 10
            ? "text-amber-300"
            : "text-slate-100"
      }`}
    >
      {expired ? "Time!" : `${mm}:${String(ss).padStart(2, "0")}`}
    </span>
  );
}
