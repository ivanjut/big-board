"use client";

import { useEffect, useState } from "react";

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

// Clock for the current pick, anchored to the server-provided `startedAt` so all
// viewers see the same time. With a limit it counts down, then keeps counting as
// red "over" time once it expires. With no limit it just shows elapsed time.
// When `pausedAt` is set, the clock freezes at the elapsed time it was paused.
export function PickTimer({
  startedAt,
  seconds,
  pausedAt,
}: {
  startedAt: string;
  seconds: number | null;
  pausedAt?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // While paused, freeze the reference time at the moment of pausing.
  const reference = pausedAt ? new Date(pausedAt).getTime() : now;
  const elapsed = Math.max(
    0,
    Math.floor((reference - new Date(startedAt).getTime()) / 1000),
  );

  // No limit: show elapsed time on the clock.
  if (seconds == null) {
    return <span className="tabular-nums font-semibold text-slate-300">{fmt(elapsed)}</span>;
  }

  const remaining = seconds - elapsed;

  // Over the limit: keep counting, show how far over.
  if (remaining <= 0) {
    return (
      <span className="tabular-nums font-semibold text-red-400">
        +{fmt(-remaining)} over
      </span>
    );
  }

  return (
    <span
      className={`tabular-nums font-semibold ${
        remaining <= 10 ? "text-amber-300" : "text-slate-100"
      }`}
    >
      {fmt(remaining)}
    </span>
  );
}
