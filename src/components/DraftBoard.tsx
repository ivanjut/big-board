"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  buildOwnerMap,
  cellToPick,
  clockPick,
  effectiveOwnerSlot,
  pickToCell,
  totalPicks,
  type DraftState,
} from "@/lib/draftLogic";
import { boardToCsv, boardToXlsx, slugifyName } from "@/lib/exportBoard";
import { PlayerSearch } from "./PlayerSearch";
import { PickTimer } from "./PickTimer";
import { DraftSettingsModal } from "./DraftSettingsModal";
import { TradeDialog } from "./TradeDialog";

// ── Lucide-style line/solid icons matching the Big Board scoreboard design ──
const strokeProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
type IconProps = { className?: string };
const ShareIcon = ({ className }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);
const DownloadIcon = ({ className }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const SettingsIcon = ({ className }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const UndoIcon = ({ className }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
  </svg>
);
const TradesIcon = ({ className }: IconProps) => (
  <svg className={className} {...strokeProps}>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);
const PauseIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const PlayIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const SkipIcon = ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 5l8 7-8 7V5z" />
    <path d="M13 5l8 7-8 7V5z" />
  </svg>
);

// Shared button treatments from the design's `.cbtn` / `.ibtn` / `.trades`.
const CBTN =
  "inline-flex min-h-11 items-center gap-1.5 rounded-[9px] border border-[var(--bb-stroke)] bg-[var(--bb-card)] px-3 py-2 text-sm font-medium text-[var(--bb-text)] transition-colors hover:border-[var(--bb-stroke-2)] hover:bg-[var(--bb-card-2)]";
const IBTN =
  "flex h-11 w-11 items-center justify-center rounded-[11px] border border-[var(--bb-stroke)] bg-[var(--bb-card)] text-[var(--bb-muted)] transition-colors hover:border-[var(--bb-stroke-2)] hover:bg-[var(--bb-card-2)] hover:text-[var(--bb-text)] disabled:pointer-events-none disabled:opacity-40";

// Small position tag used in the recent-picks ticker. Colors intentionally match
// the board's own position palette (see POSITION_STYLES) so a position reads the
// same hue in the ticker and on the grid.
const TICKER_POS_TEXT: Record<string, string> = {
  QB: "text-emerald-300 light:text-emerald-700",
  RB: "text-blue-300 light:text-blue-700",
  WR: "text-yellow-300 light:text-yellow-700",
  TE: "text-orange-300 light:text-orange-700",
  DST: "text-red-300 light:text-red-700",
  DEF: "text-red-300 light:text-red-700",
  IDP: "text-red-300 light:text-red-700",
  DL: "text-red-300 light:text-red-700",
  LB: "text-red-300 light:text-red-700",
  DB: "text-red-300 light:text-red-700",
};
function tickerPosText(pos: string | null | undefined): string {
  return (pos && TICKER_POS_TEXT[pos.toUpperCase()]) || "text-[var(--bb-muted)]";
}

// Upcoming clock picks after the current one, in the order the clock reaches
// them: forward frontier first, then deferred (skipped) picks ascending. Used to
// render the on-deck chips. `order[0]` is the pick on the clock, so the on-deck
// list is the next `count` entries.
function upcomingPicks(
  currentPick: number,
  skipped: number[],
  total: number,
  count: number,
): number[] {
  const order: number[] = [];
  for (let p = Math.max(currentPick, 1); p <= total; p++) order.push(p);
  for (const s of [...skipped].sort((a, b) => a - b)) {
    if (s < currentPick) order.push(s);
  }
  return order.slice(1, 1 + count);
}

// Per-position color coding for drafted cells: a cell-background tint and a
// matching name color (with a `light:` shade so it stays legible in light mode).
type PosStyle = { cell: string; text: string };
// Team defense (DST) and individual defensive players (DL/LB/DB/…) all share red.
const DEF_STYLE: PosStyle = {
  cell: "bg-red-500/20",
  text: "text-red-300 light:text-red-700",
};
const POSITION_STYLES: Record<string, PosStyle> = {
  QB: { cell: "bg-emerald-500/20", text: "text-emerald-300 light:text-emerald-700" },
  RB: { cell: "bg-blue-500/20", text: "text-blue-300 light:text-blue-700" },
  WR: { cell: "bg-yellow-500/20", text: "text-yellow-300 light:text-yellow-700" },
  TE: { cell: "bg-orange-500/20", text: "text-orange-300 light:text-orange-700" },
  DST: DEF_STYLE,
  DEF: DEF_STYLE,
  IDP: DEF_STYLE,
  DL: DEF_STYLE,
  LB: DEF_STYLE,
  DB: DEF_STYLE,
};
function posStyle(pos: string | null | undefined): PosStyle | null {
  return pos ? POSITION_STYLES[pos.toUpperCase()] ?? null : null;
}

// Split a player's name into a small first-name line and a larger last-name
// line. A trailing generational suffix (Jr., III, …) stays with the last name.
const NAME_SUFFIXES = new Set(["JR", "JR.", "SR", "SR.", "II", "III", "IV", "V"]);
function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first: "", last: full.trim() };
  const lastCount = NAME_SUFFIXES.has(parts[parts.length - 1].toUpperCase()) ? 2 : 1;
  return {
    first: parts.slice(0, parts.length - lastCount).join(" "),
    last: parts.slice(parts.length - lastCount).join(" "),
  };
}

// "⋯" overflow menu that guards the destructive Reset behind a click (which
// then still goes through the usual confirmation dialog).
function MoreMenu({ onReset }: { onReset: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More draft actions"
        title="More draft actions"
        className="flex h-11 w-11 items-center justify-center rounded-[11px] border border-[var(--bb-stroke)] bg-[var(--bb-card)] text-xl leading-none text-[var(--bb-muted)] transition-colors hover:border-[var(--bb-stroke-2)] hover:text-[var(--bb-text)]"
      >
        ⋯
      </button>
      {open && (
        <>
          {/* click-anywhere-to-close backdrop */}
          <div
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onReset();
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
            >
              Reset draft…
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// "Download" split menu: pick CSV (plain) or Excel (.xlsx, keeps colors). The
// footer note spells out the difference between the two formats.
function DownloadMenu({
  onDownload,
}: {
  onDownload: (format: "csv" | "xlsx") => void;
}) {
  const [open, setOpen] = useState(false);
  const item =
    "block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-800";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Download board"
        className={CBTN}
      >
        <DownloadIcon className="h-[15px] w-[15px] opacity-80" />
        Download
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDownload("xlsx");
              }}
              className={item}
            >
              <span className="font-medium text-slate-100">Excel (.xlsx)</span>
              <span className="block text-xs text-slate-500">
                Round × team grid with the position colors. Opens in Excel &
                Google Sheets.
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDownload("csv");
              }}
              className={item}
            >
              <span className="font-medium text-slate-100">CSV</span>
              <span className="block text-xs text-slate-500">
                Same grid as plain text — opens anywhere.
              </span>
            </button>
            <p className="border-t border-slate-800 px-3 py-2 text-[11px] leading-snug text-slate-500">
              Only the Excel export keeps the QB/RB/WR/TE/DEF cell colors — a CSV
              is plain text and can&apos;t store them.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export function DraftBoard({ draftId }: { draftId: string }) {
  const [state, setState] = useState<DraftState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showUnlock, setShowUnlock] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTrades, setShowTrades] = useState(false);
  const [copied, setCopied] = useState(false);
  // In-flight flag for any commissioner action (pick, undo, skip, pause…) — used
  // to disable the controls so a fast double-tap can't fire the same action twice.
  const [busy, setBusy] = useState(false);
  // Narrower flag: true only while a pick is being submitted, so the search shows
  // its "Drafting…" pending state (and refocuses when it clears).
  const [picking, setPicking] = useState(false);
  // When set, the next pick fills this specific (skipped) pick out of order
  // instead of the one on the clock.
  const [fillTarget, setFillTarget] = useState<number | null>(null);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/draft/${draftId}/state`, { cache: "no-store" });
    if (res.status === 404) return setLoadError("Draft not found.");
    if (!res.ok) return setLoadError("Failed to load this draft.");
    setState(await res.json());
  }, [draftId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Polling keeps every viewer's board fresh — picks, trades, skips, and
  // draft-row changes (start, settings) all show up on the next tick. This is
  // the sole live-update mechanism now that the app is off Supabase Realtime;
  // 2s trades a little latency for zero extra infra. Skip while the tab is
  // hidden so backgrounded viewers don't poll needlessly.
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) refetch();
    }, 2000);
    // Refresh immediately when a hidden tab is brought back to the foreground.
    const onVisible = () => {
      if (!document.hidden) refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetch]);

  const post = useCallback(
    async (path: string, body?: unknown) => {
      setActionError(null);
      setBusy(true);
      try {
        const res = await fetch(`/api/draft/${draftId}/${path}`, {
          method: "POST",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setActionError(data.error ?? "Something went wrong.");
          return false;
        }
        await refetch();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [draftId, refetch],
  );

  const trade = useCallback(
    (payload: { teamA: number; teamB: number; aToB: number[]; bToA: number[] }) =>
      post("trade", payload),
    [post],
  );

  // Build the board export client-side and trigger a download. CSV is plain
  // text; .xlsx is a real colored workbook that opens cleanly in Excel & Sheets.
  const downloadBoard = useCallback(
    (format: "csv" | "xlsx") => {
      if (!state) return;
      const blob =
        format === "csv"
          ? // Leading BOM so Excel reads the UTF-8 CSV (positions) correctly.
            new Blob(["\uFEFF" + boardToCsv(state)], {
              type: "text/csv;charset=utf-8",
            })
          : new Blob([boardToXlsx(state)], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugifyName(state.draft.name)}-board.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [state],
  );

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (await post("unlock", { password })) {
      setPassword("");
      setShowUnlock(false);
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  // Map pick number -> pick for O(1) cell lookup.
  const picksByNumber = useMemo(() => {
    const m = new Map<number, DraftState["picks"][number]>();
    state?.picks.forEach((p) => m.set(p.pickNumber, p));
    return m;
  }, [state]);

  // Current owner of each traded pick (pickNumber -> slot); other picks fall back
  // to their snake slot via effectiveOwnerSlot.
  const ownerMap = useMemo(() => buildOwnerMap(state?.trades ?? []), [state]);

  if (loadError) {
    return (
      <main className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-lg text-slate-300">{loadError}</p>
        <Link href="/" className="mt-4 inline-block text-[var(--bb-accent-text)]">
          ← Home
        </Link>
      </main>
    );
  }

  if (!state) {
    // Skeleton shaped like the real scoreboard so first paint reads as "the board
    // is coming", not "nothing here". Mirrors the top chrome + scoreboard layout.
    return (
      <main
        className="mx-auto max-w-[1800px] px-3 py-4 sm:px-6"
        aria-busy="true"
        aria-label="Loading draft"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 px-1.5 pb-5 pr-12">
          <div className="space-y-2">
            <div className="bb-skel h-3.5 w-20" />
            <div className="bb-skel h-8 w-56" />
          </div>
          <div className="flex gap-2.5">
            <div className="bb-skel h-9 w-28 rounded-[9px]" />
            <div className="bb-skel h-9 w-28 rounded-[9px]" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[var(--bb-stroke)] bg-[var(--bb-card)]">
          <div className="grid grid-cols-1 items-center gap-6 px-6 py-8 sm:grid-cols-[1fr_auto_1fr] sm:gap-7 sm:px-8">
            <div className="space-y-3 text-center sm:text-left">
              <div className="bb-skel mx-auto h-3 w-24 sm:mx-0" />
              <div className="bb-skel mx-auto h-12 w-52 sm:mx-0" />
            </div>
            <div className="bb-skel mx-auto h-20 w-48 rounded-xl" />
            <div className="space-y-3 text-center sm:text-right">
              <div className="bb-skel mx-auto h-3 w-24 sm:ml-auto sm:mr-0" />
              <div className="bb-skel mx-auto h-12 w-32 sm:ml-auto sm:mr-0" />
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-[var(--bb-stroke)] px-4 py-3">
            <div className="bb-skel h-2.5 w-24" />
            <div className="bb-skel h-2.5 flex-1" />
          </div>
        </div>
        <span className="sr-only">Loading draft…</span>
      </main>
    );
  }

  const { draft, members, canEdit } = state;
  const total = totalPicks(draft.numSlots, draft.numRounds);
  const skippedSet = new Set(state.skipped);
  const pending = draft.status === "pending";
  // The pick on the clock — null once every pick has been made.
  const clockNum = clockPick(draft.currentPick, state.skipped, total);
  const complete = draft.status === "complete" || clockNum === null;
  const paused = draft.status === "paused" && !complete;
  const active = draft.status === "active" && !complete;
  const inProgress = !pending && !complete; // active or paused
  // Whether the pick on the clock is the forward frontier (vs. a returned-to
  // skipped pick); only the frontier can be skipped.
  const onFrontier = clockNum != null && clockNum === draft.currentPick;
  const onClock =
    inProgress && clockNum != null
      ? pickToCell(clockNum, draft.numSlots)
      : null;
  // Team on the clock = current owner of this pick (after any trades), not the
  // raw snake slot.
  const onClockSlot =
    onClock && clockNum != null
      ? effectiveOwnerSlot(clockNum, draft.numSlots, ownerMap)
      : null;
  const onClockMember = onClockSlot
    ? members.find((m) => m.slot === onClockSlot)
    : null;
  // Pick within the current round (1..numSlots), distinct from the overall pick number.
  const pickInRound =
    onClock && clockNum != null ? ((clockNum - 1) % draft.numSlots) + 1 : null;

  // The pick a search selection fills: a returned-to skipped pick if one is
  // targeted (and still open), otherwise the pick on the clock.
  const activeFill =
    fillTarget != null && skippedSet.has(fillTarget) ? fillTarget : clockNum;
  const makePick = async (playerId: number) => {
    if (activeFill == null) return;
    setPicking(true);
    try {
      if (await post("pick", { playerId, pickNumber: activeFill }))
        setFillTarget(null);
    } finally {
      setPicking(false);
    }
  };
  const fillTargetMember =
    fillTarget != null && skippedSet.has(fillTarget)
      ? members.find(
          (m) =>
            m.slot === effectiveOwnerSlot(fillTarget, draft.numSlots, ownerMap),
        )
      : null;

  // Count of trade transactions (not individual picks exchanged).
  const tradeCount = new Set(state.trades.map((t) => t.transactionId)).size;

  // On-deck chips: the next few teams to pick after the one on the clock, each
  // resolved to its current owner (after trades).
  const onDeck = inProgress
    ? upcomingPicks(draft.currentPick, state.skipped, total, 3).map((pn) => {
        const slot = effectiveOwnerSlot(pn, draft.numSlots, ownerMap);
        const m = members.find((mm) => mm.slot === slot);
        return { pick: pn, name: m ? m.name : `Slot ${slot}` };
      })
    : [];

  // Recent-picks ticker feed: the 12 most recent picks, ordered the way they were
  // made so they read left-to-right (oldest of the batch first, newest last),
  // resolved to the drafting team (current owner of that pick). Only animates once
  // there are enough to fill the strip; below that it renders static so it doesn't
  // crawl awkwardly.
  const recentPicks = [...state.picks]
    .sort((a, b) => a.pickNumber - b.pickNumber)
    .slice(-12)
    .map((p) => {
      const slot = effectiveOwnerSlot(p.pickNumber, draft.numSlots, ownerMap);
      const m = members.find((mm) => mm.slot === slot);
      return {
        overall: p.pickNumber,
        team: m ? m.name : `Slot ${slot}`,
        player: p.playerName,
        pos: p.playerPosition,
      };
    });
  const tickerScrolls = recentPicks.length >= 5;

  // Trade entry point — sits beside the ⋯ menu, above the board.
  const tradesButton = (
    <button
      type="button"
      onClick={() => setShowTrades(true)}
      aria-label="Trade picks"
      title="Trade picks"
      className="inline-flex h-11 items-center gap-2 rounded-[11px] border border-[var(--bb-stroke)] bg-[var(--bb-card)] px-3.5 text-sm font-medium leading-none text-[var(--bb-text)] transition-colors hover:border-[var(--bb-stroke-2)] hover:bg-[var(--bb-card-2)]"
    >
      <TradesIcon className="h-4 w-4 opacity-85" />
      Trades
      {tradeCount > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--bb-pk)] px-1.5 text-xs font-semibold text-[var(--bb-muted)]">
          {tradeCount}
        </span>
      )}
    </button>
  );

  return (
    <main className="mx-auto max-w-[1800px] px-3 py-4 sm:px-6">
      {/* Top chrome (pr clears the fixed theme toggle in the top-right corner) */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-1.5 pb-5 pr-12">
        <div>
          <Link
            href="/"
            className="text-[13px] tracking-[0.02em] text-[var(--bb-muted-2)] hover:text-[var(--bb-muted)]"
          >
            Big Board
          </Link>
          <h1 className="mt-0.5 text-3xl font-bold tracking-[-0.01em] text-[var(--bb-text)]">
            {draft.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={copyLink} className={CBTN}>
            <ShareIcon className="h-[15px] w-[15px] opacity-80" />
            {copied ? "Copied!" : "Share link"}
          </button>
          <DownloadMenu onDownload={downloadBoard} />
          {canEdit && (
            <button onClick={() => setShowSettings(true)} className={CBTN}>
              <SettingsIcon className="h-[15px] w-[15px] opacity-80" />
              Settings
            </button>
          )}
          {!canEdit && (
            <button
              onClick={() => setShowUnlock((s) => !s)}
              className="inline-flex items-center rounded-[9px] bg-[var(--bb-accent)] px-3.5 py-2 text-sm font-semibold text-[#04120a] transition-colors hover:bg-[var(--bb-accent-dim)]"
            >
              Unlock to edit
            </button>
          )}
        </div>
      </div>

      {/* Unlock form */}
      {!canEdit && showUnlock && (
        <form onSubmit={unlock} className="mb-3 flex gap-2">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Draft password"
            className="min-w-0 flex-1 rounded-[11px] border border-[var(--bb-stroke)] bg-[var(--bb-card)] px-3.5 py-2.5 text-sm text-[var(--bb-text)] transition-colors focus:border-[var(--bb-accent-dim)] sm:max-w-xs"
          />
          <button className="rounded-[11px] bg-[var(--bb-accent)] px-4 py-2.5 text-sm font-semibold text-[#04120a] transition-colors hover:bg-[var(--bb-accent-dim)]">
            Unlock
          </button>
        </form>
      )}

      {/* Status banner */}
      {pending || complete ? (
        <div className="rounded-2xl border border-[var(--bb-stroke)] bg-[var(--bb-card)] px-5 py-4">
          {pending ? (
            <span className="text-sm text-[var(--bb-muted)]">
              {canEdit
                ? "Draft hasn't started — press Start when everyone's ready."
                : "Waiting for the commissioner to start the draft."}
            </span>
          ) : (
            <span className="font-semibold text-[var(--bb-accent-text)]">
              Draft complete 🎉
            </span>
          )}
        </div>
      ) : (
        /* Scoreboard: team on the clock · big timer · round/pick, with a live
           recent-picks ticker along the bottom. */
        <div className="overflow-hidden rounded-2xl border border-[var(--bb-stroke)] bg-[var(--bb-card)] text-[var(--bb-text)]">
          <div className="grid grid-cols-1 items-center gap-6 px-6 py-6 sm:grid-cols-[1fr_auto_1fr] sm:gap-7 sm:px-8">
            {/* Left — team on the clock, with the on-deck strip beneath it */}
            <div className="min-w-0 text-center sm:text-left">
              <div className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--bb-muted-2)]">
                On the clock
              </div>
              <div className="mt-1 line-clamp-2 text-4xl font-bold leading-[1.02] tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[52px]">
                {onClockMember ? onClockMember.name : `Slot ${onClockSlot}`}
              </div>
              {onDeck.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--bb-muted-2)]">
                    On deck
                  </span>
                  {onDeck.map((od, i) => (
                    <div key={od.pick} className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-1 pl-1.5 pr-2.5 text-[13px] font-medium ${
                          i === 0
                            ? "border-[var(--bb-stroke-2)] bg-[var(--bb-card-2)] text-[var(--bb-text)]"
                            : "border-[var(--bb-stroke)] bg-[var(--bb-card-2)] text-[var(--bb-muted)]"
                        }`}
                      >
                        <span
                          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                            i === 0
                              ? "bg-[rgba(63,224,129,0.14)] text-[var(--bb-accent-text)]"
                              : "bg-[var(--bb-pk)] text-[var(--bb-muted)]"
                          }`}
                        >
                          {od.pick}
                        </span>
                        {od.name}
                      </span>
                      {i === 0 && onDeck.length > 1 && (
                        <span className="text-xs text-[var(--bb-muted-2)]">→</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Center — prominent countdown (color/blink handled by PickTimer) */}
            <div className="text-center">
              <div className="text-7xl font-bold leading-none tracking-[-0.02em] tabular-nums sm:text-[96px]">
                <PickTimer
                  startedAt={draft.currentPickStartedAt}
                  seconds={draft.pickSeconds}
                  pausedAt={draft.pausedAt}
                  key={clockNum ?? draft.currentPick}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--bb-muted-2)]">
                {paused && (
                  <span className="rounded bg-[rgba(240,161,58,0.14)] px-2 py-0.5 text-xs font-semibold normal-case tracking-normal text-[var(--bb-amber)]">
                    ⏸ Paused
                  </span>
                )}
                <span>{draft.pickSeconds == null ? "Elapsed" : "Remaining"}</span>
              </div>
            </div>

            {/* Right — round · pick, plus the overall pick number */}
            <div className="text-center sm:text-right">
              <div className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--bb-muted-2)]">
                Round · Pick
              </div>
              <div className="mt-1 text-4xl font-bold leading-[1.02] tracking-[-0.01em] tabular-nums sm:text-[52px]">
                {onClock!.round}
                <span className="mx-1 text-[var(--bb-muted-2)]">·</span>
                {pickInRound}
              </div>
              <div className="mt-3 text-sm text-[var(--bb-muted)]">
                {onFrontier ? "Overall pick" : "Returning to pick"}{" "}
                <span className="font-semibold text-[var(--bb-text)]">
                  #{clockNum}
                </span>
              </div>
            </div>
          </div>

          {/* Recent-picks ticker */}
          {recentPicks.length > 0 && (
            <div className="bb-ticker flex items-stretch border-t border-[var(--bb-stroke)]">
              <div className="inline-flex flex-shrink-0 items-center gap-2.5 border-r border-[var(--bb-stroke)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--bb-muted)]">
                <span className="bb-live-dot" />
                Recent picks
              </div>
              <div className="bb-ticker-view flex-1">
                <div
                  className={
                    tickerScrolls ? "bb-marquee" : "flex items-center"
                  }
                >
                  {(tickerScrolls
                    ? [...recentPicks, ...recentPicks]
                    : recentPicks
                  ).map((p, i) => (
                    <div
                      key={`${p.overall}-${i}`}
                      className="inline-flex items-center gap-2.5 whitespace-nowrap border-r border-[var(--bb-stroke)] px-5 py-3 text-sm"
                    >
                      <span className="font-semibold tabular-nums text-[var(--bb-muted-2)]">
                        #{p.overall}
                      </span>
                      <span className="text-xs text-[var(--bb-muted)]">
                        {p.team}
                      </span>
                      <span className="font-medium text-[var(--bb-text)]">
                        {p.player}
                      </span>
                      {p.pos && (
                        <span
                          className={`rounded-[5px] bg-[var(--bb-pk)] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.04em] ${tickerPosText(
                            p.pos,
                          )}`}
                        >
                          {p.pos.toUpperCase()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controls (only when unlocked) — inline dock + centered search + guarded reset */}
      {canEdit &&
        (pending ? (
          <div className="mt-5 flex items-center gap-2.5">
            <button
              onClick={() => post("start")}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-[11px] bg-[var(--bb-accent)] px-6 py-3 text-center font-semibold text-[#04120a] transition-colors hover:bg-[var(--bb-accent-dim)] disabled:pointer-events-none disabled:opacity-60"
            >
              <PlayIcon className="h-4 w-4" />
              Start draft
            </button>
            {tradesButton}
            <MoreMenu onReset={() => setShowReset(true)} />
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            {/* Search — full-width on top for phones, centered in the middle
                column on desktop. Kept off the cramped 3-across mobile row. */}
            <div className="order-first w-full sm:order-none sm:col-start-2 sm:row-start-1 sm:mx-auto sm:max-w-[480px]">
              <PlayerSearch
                draftId={draftId}
                onPick={makePick}
                disabled={complete || paused}
                pending={picking}
              />
            </div>

            {/* Controls row — dock on the left, trades/reset on the right. On a
                phone it's one row under the search; on desktop `sm:contents`
                flattens it so the two clusters land in the outer grid columns. */}
            <div className="flex items-center justify-between gap-2 sm:contents">
              {/* Dock — Pause/Resume + Undo + Skip */}
              <div className="flex gap-2 sm:col-start-1 sm:row-start-1">
                {paused ? (
                  <button
                    onClick={() => post("resume")}
                    disabled={busy}
                    aria-label="Resume draft"
                    title="Resume draft"
                    className="flex h-11 w-11 items-center justify-center rounded-[11px] border border-[var(--bb-accent-dim)] bg-[rgba(63,224,129,0.1)] text-[var(--bb-accent-text)] transition-colors hover:bg-[rgba(63,224,129,0.16)] disabled:pointer-events-none disabled:opacity-40"
                  >
                    <PlayIcon className="h-[18px] w-[18px]" />
                  </button>
                ) : (
                  <button
                    onClick={() => post("pause")}
                    disabled={!active || busy}
                    aria-label="Pause draft"
                    title="Pause draft"
                    className="flex h-11 w-11 items-center justify-center rounded-[11px] border border-[rgba(240,161,58,0.4)] bg-[rgba(240,161,58,0.08)] text-[var(--bb-amber)] transition-colors hover:bg-[rgba(240,161,58,0.14)] disabled:pointer-events-none disabled:opacity-40"
                  >
                    <PauseIcon className="h-[18px] w-[18px]" />
                  </button>
                )}
                <button
                  onClick={() => post("undo")}
                  disabled={paused || busy}
                  aria-label="Undo last pick"
                  title="Undo last pick"
                  className={IBTN}
                >
                  <UndoIcon className="h-[18px] w-[18px]" />
                </button>
                <button
                  onClick={() => post("skip")}
                  disabled={!active || !onFrontier || busy}
                  aria-label="Skip this pick"
                  title={
                    onFrontier
                      ? "Skip this pick (return to it later)"
                      : "This pick was skipped — fill it from the board"
                  }
                  className={IBTN}
                >
                  <SkipIcon className="h-[18px] w-[18px]" />
                </button>
              </div>

              {/* Trades + guarded reset behind a ⋯ menu */}
              <div className="flex items-center gap-2 sm:col-start-3 sm:row-start-1">
                {tradesButton}
                <MoreMenu onReset={() => setShowReset(true)} />
              </div>
            </div>
          </div>
        ))}

      {/* Viewers can still open the trade history/board (read-only). */}
      {!canEdit && <div className="mt-5 flex justify-end">{tradesButton}</div>}

      {/* Returning to a skipped pick — the search now fills this one. */}
      {canEdit && fillTarget != null && skippedSet.has(fillTarget) && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-amber-700/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <span>
            Filling skipped pick{" "}
            <span className="font-semibold">#{fillTarget}</span>
            {fillTargetMember ? ` — ${fillTargetMember.name}` : ""}. Search to
            draft a player into it.
          </span>
          <button
            onClick={() => setFillTarget(null)}
            className="shrink-0 rounded-md border border-amber-700/60 px-2 py-1 text-xs hover:bg-amber-500/20"
          >
            Cancel
          </button>
        </div>
      )}

      {actionError && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      )}

      {/* Board */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky-col bg-slate-900 px-2 py-2 text-xs font-medium text-slate-500">
                Rd
              </th>
              {members.map((m) => (
                <th
                  key={m.slot}
                  className="min-w-[120px] border-l border-slate-800 bg-slate-900 px-2 py-2 text-center text-xs font-semibold text-slate-200"
                >
                  <span className="block">{m.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: draft.numRounds }, (_, r) => r + 1).map(
              (round) => (
                <tr key={round}>
                  <td className="sticky-col bg-slate-900 px-2 py-1 text-center text-xs font-medium text-slate-500">
                    {round}
                  </td>
                  {members.map((m) => {
                    const pickNumber = cellToPick(
                      round,
                      m.slot,
                      draft.numSlots,
                    );
                    const pick = picksByNumber.get(pickNumber);
                    const isOnClock =
                      inProgress && clockNum != null && pickNumber === clockNum;
                    // An open cell: skipped (deferred) and not yet filled.
                    const isSkipped = !pick && skippedSet.has(pickNumber);
                    const isFillTarget = isSkipped && fillTarget === pickNumber;
                    // The commissioner can click an open, off-clock cell to
                    // return to it and fill it out of order.
                    const returnable =
                      canEdit && isSkipped && !isOnClock && !paused && !complete;
                    const ps = pick ? posStyle(pick.playerPosition) : null;
                    const name = pick ? splitName(pick.playerName) : null;
                    const meta = pick
                      ? [pick.playerTeam, pick.playerPosition]
                          .filter(Boolean)
                          .join(" · ")
                      : "";
                    // A traded pick belongs to a team other than this column.
                    const ownerSlot = effectiveOwnerSlot(
                      pickNumber,
                      draft.numSlots,
                      ownerMap,
                    );
                    const traded = ownerSlot !== m.slot;
                    const ownerName = traded
                      ? members.find((mm) => mm.slot === ownerSlot)?.name ??
                        `Slot ${ownerSlot}`
                      : null;
                    return (
                      <td
                        key={m.slot}
                        onClick={
                          returnable
                            ? () => setFillTarget(pickNumber)
                            : undefined
                        }
                        title={returnable ? "Click to fill this skipped pick" : undefined}
                        className={`relative h-14 border-l border-t border-slate-800 px-2 py-1 align-top ${
                          isOnClock
                            ? "bg-[rgba(63,224,129,0.15)] ring-2 ring-inset ring-[var(--bb-accent-text)]"
                            : pick
                              ? ps?.cell ?? "bg-slate-900/40 light:bg-slate-900"
                              : isFillTarget
                                ? "bg-amber-500/20 ring-2 ring-inset ring-amber-500"
                                : isSkipped
                                  ? `bg-amber-500/10${returnable ? " cursor-pointer hover:bg-amber-500/20" : ""}`
                                  : traded
                                    ? "bg-fuchsia-500/5"
                                    : ""
                        }`}
                      >
                        <span className="absolute right-1 top-0.5 text-[10px] text-slate-600">
                          {pickNumber}
                        </span>
                        {traded && (
                          <span
                            title={`Traded to ${ownerName}`}
                            className="absolute bottom-0.5 left-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-fuchsia-500/25 px-1 text-[9px] font-semibold uppercase tracking-wide text-fuchsia-200 light:text-fuchsia-800"
                          >
                            ⇄ {ownerName}
                          </span>
                        )}
                        {meta && (
                          <span className="absolute bottom-0.5 right-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                            {meta}
                          </span>
                        )}
                        {pick && name ? (
                          <span
                            className={`block pr-4 pt-0.5 uppercase leading-tight ${
                              ps?.text ?? "text-slate-100"
                            }`}
                          >
                            {name.first && (
                              <span className="block text-[10px] font-medium opacity-80">
                                {name.first}
                              </span>
                            )}
                            <span className="block text-sm font-bold leading-none">
                              {name.last}
                            </span>
                          </span>
                        ) : isOnClock ? (
                          <span className="block pt-2 text-[10px] font-semibold uppercase text-[var(--bb-accent-text)]">
                            On the clock
                          </span>
                        ) : isSkipped ? (
                          <span className="block pt-2 text-[10px] font-semibold uppercase text-amber-400">
                            ⏭ Skipped
                            {returnable && (
                              <span className="block text-[9px] font-medium normal-case text-amber-300/80">
                                click to fill
                              </span>
                            )}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {/* Trade dialog (history for everyone; commissioner-only builder) */}
      {showTrades && (
        <TradeDialog
          members={members}
          trades={state.trades}
          picks={state.picks}
          owners={ownerMap}
          numSlots={draft.numSlots}
          total={total}
          currentPick={draft.currentPick}
          canEdit={canEdit}
          onTrade={trade}
          onClose={() => setShowTrades(false)}
        />
      )}

      {/* Settings modal */}
      {showSettings && canEdit && (
        <DraftSettingsModal
          draftId={draftId}
          draft={draft}
          members={members}
          hasPicks={state.picks.length > 0}
          maxDraftedRound={state.picks.reduce((m, p) => Math.max(m, p.round), 0)}
          onClose={() => setShowSettings(false)}
          onSaved={async () => {
            setShowSettings(false);
            await refetch();
          }}
        />
      )}

      {/* Reset confirmation */}
      {showReset && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-5">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold">Reset the entire draft?</h3>
            <p className="mt-2 text-sm text-slate-400">
              This permanently clears every pick and returns to pick 1. This
              cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowReset(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowReset(false);
                  await post("reset");
                }}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400"
              >
                Reset draft
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
