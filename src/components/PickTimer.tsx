"use client";

import { useEffect, useState } from "react";

// Split into minutes / seconds so the colon can blink independently, matching
// the scoreboard design.
const parts = (s: number) => ({
  m: Math.floor(s / 60),
  ss: String(s % 60).padStart(2, "0"),
});

// A "m:ss" clock with the separator blinking (design's `.colon`).
function Clock({ seconds, className }: { seconds: number; className: string }) {
  const { m, ss } = parts(seconds);
  return (
    <span className={`tabular-nums font-bold ${className}`}>
      {m}
      <span className="bb-colon">:</span>
      {ss}
    </span>
  );
}

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
    return <Clock seconds={elapsed} className="text-[var(--bb-accent)]" />;
  }

  const remaining = seconds - elapsed;

  // Over the limit: keep counting, show how far over.
  if (remaining <= 0) {
    const { m, ss } = parts(-remaining);
    return (
      <span className="tabular-nums font-bold text-[var(--bb-danger)]">
        +{m}
        <span className="bb-colon">:</span>
        {ss}
        <span className="ml-3 align-middle text-2xl font-semibold uppercase tracking-[0.12em]">
          over
        </span>
      </span>
    );
  }

  return (
    <Clock
      seconds={remaining}
      className={
        remaining <= 10 ? "text-[var(--bb-amber)]" : "text-[var(--bb-accent)]"
      }
    />
  );
}
