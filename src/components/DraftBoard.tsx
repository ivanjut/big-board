"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  buildOwnerMap,
  cellToPick,
  clockPick,
  effectiveOwnerSlot,
  nextClockPick,
  pickToCell,
  totalPicks,
  type DraftState,
} from "@/lib/draftLogic";
import { PlayerSearch } from "./PlayerSearch";
import { PickTimer } from "./PickTimer";
import { DraftSettingsModal } from "./DraftSettingsModal";
import { TradeDialog } from "./TradeDialog";

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
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-lg leading-none text-slate-400 hover:bg-slate-800 hover:text-slate-200"
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

  // Realtime: any pick change for this draft refreshes the board immediately.
  useEffect(() => {
    const sb = supabaseBrowser();
    const channel = sb
      .channel(`draft-${draftId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "picks",
          filter: `draft_id=eq.${draftId}`,
        },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pick_trades",
          filter: `draft_id=eq.${draftId}`,
        },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "skipped_picks",
          filter: `draft_id=eq.${draftId}`,
        },
        () => refetch(),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [draftId, refetch]);

  // Light polling so viewers also pick up draft-row changes (start, settings),
  // which aren't broadcast over Realtime (the drafts table is server-only).
  useEffect(() => {
    const t = setInterval(refetch, 5000);
    return () => clearInterval(t);
  }, [refetch]);

  const post = useCallback(
    async (path: string, body?: unknown) => {
      setActionError(null);
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
    },
    [draftId, refetch],
  );

  const trade = useCallback(
    (payload: { teamA: number; teamB: number; aToB: number[]; bToA: number[] }) =>
      post("trade", payload),
    [post],
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
        <Link href="/" className="mt-4 inline-block text-emerald-400">
          ← Home
        </Link>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="px-5 py-20 text-center text-slate-400">Loading…</main>
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
  // "Next" — current owner of the pick that lands on the clock after this one.
  const nextNum = inProgress
    ? nextClockPick(draft.currentPick, state.skipped, total)
    : null;
  const nextSlot =
    nextNum != null
      ? effectiveOwnerSlot(nextNum, draft.numSlots, ownerMap)
      : null;
  const nextMember = nextSlot
    ? members.find((m) => m.slot === nextSlot)
    : null;

  // The pick a search selection fills: a returned-to skipped pick if one is
  // targeted (and still open), otherwise the pick on the clock.
  const activeFill =
    fillTarget != null && skippedSet.has(fillTarget) ? fillTarget : clockNum;
  const makePick = async (playerId: number) => {
    if (activeFill == null) return;
    if (await post("pick", { playerId, pickNumber: activeFill }))
      setFillTarget(null);
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

  // Trade entry point — sits beside the ⋯ menu, above the board.
  const tradesButton = (
    <button
      type="button"
      onClick={() => setShowTrades(true)}
      aria-label="Trade picks"
      title="Trade picks"
      className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-sm leading-none text-slate-300 hover:bg-slate-800 hover:text-slate-200"
    >
      ⇄ Trades
      {tradeCount > 0 && (
        <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-200">
          {tradeCount}
        </span>
      )}
    </button>
  );

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5">
      {/* Header (pr clears the fixed theme toggle in the top-right corner) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pr-12">
        <div>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
            Big Board
          </Link>
          <h1 className="text-xl font-bold sm:text-2xl">{draft.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
          >
            {copied ? "Copied!" : "Share link"}
          </button>
          {canEdit && (
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
            >
              ⚙ Settings
            </button>
          )}
          {!canEdit && (
            <button
              onClick={() => setShowUnlock((s) => !s)}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
            >
              Unlock to edit
            </button>
          )}
        </div>
      </div>

      {/* Unlock form */}
      {!canEdit && showUnlock && (
        <form onSubmit={unlock} className="mt-3 flex gap-2">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Draft password"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:max-w-xs"
          />
          <button className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400">
            Unlock
          </button>
        </form>
      )}

      {/* Status banner */}
      {pending || complete ? (
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 light:bg-slate-900">
          {pending ? (
            <span className="text-sm text-slate-300">
              {canEdit
                ? "Draft hasn't started — press Start when everyone's ready."
                : "Waiting for the commissioner to start the draft."}
            </span>
          ) : (
            <span className="font-semibold text-emerald-400">Draft complete 🎉</span>
          )}
        </div>
      ) : (
        /* Scoreboard: team on the clock · big timer · round/pick */
        <div className="mt-3 grid grid-cols-1 items-center gap-5 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-5 light:bg-slate-900 sm:grid-cols-[1fr_auto_1fr]">
          {/* Left — current team, with the on-deck team beneath it */}
          <div className="text-center sm:text-left">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              On the clock
            </div>
            <div className="mt-0.5 text-3xl font-bold leading-none sm:text-4xl">
              {onClockMember ? onClockMember.name : `Slot ${onClockSlot}`}
            </div>
            {nextSlot && (
              <div className="mt-3 text-sm text-slate-400">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Next
                </span>{" "}
                <span className="font-semibold text-slate-300">
                  {nextMember ? nextMember.name : `Slot ${nextSlot}`}
                </span>
              </div>
            )}
          </div>

          {/* Center — prominent monospace countdown */}
          <div className="text-center">
            <div className="font-mono text-6xl font-semibold leading-none tabular-nums sm:text-7xl">
              <PickTimer
                startedAt={draft.currentPickStartedAt}
                seconds={draft.pickSeconds}
                pausedAt={draft.pausedAt}
                key={clockNum ?? draft.currentPick}
              />
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest text-slate-500">
              {paused && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold normal-case tracking-normal text-amber-300">
                  ⏸ Paused
                </span>
              )}
              <span>{draft.pickSeconds == null ? "elapsed" : "time remaining"}</span>
            </div>
          </div>

          {/* Right — round · pick, plus the overall pick number */}
          <div className="text-center sm:text-right">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Round · Pick
            </div>
            <div className="mt-0.5 text-3xl font-bold leading-none sm:text-4xl">
              {onClock!.round}
              <span className="px-1 text-slate-500">·</span>
              {pickInRound}
            </div>
            <div className="mt-3 text-sm text-slate-400">
              {onFrontier ? "Overall pick" : "Returning to pick"}{" "}
              <span className="font-semibold text-slate-300">#{clockNum}</span>
            </div>
          </div>
        </div>
      )}

      {/* Controls (only when unlocked) — option C: inline dock + guarded reset */}
      {canEdit &&
        (pending ? (
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => post("start")}
              className="flex-1 rounded-xl bg-emerald-500 px-6 py-3 text-center font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              ▶ Start draft
            </button>
            {tradesButton}
            <MoreMenu onReset={() => setShowReset(true)} />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
            {/* Dock — Pause/Resume + Undo as icon buttons, left of the search */}
            <div className="flex gap-2 rounded-xl border border-slate-700 p-1.5">
              {paused ? (
                <button
                  onClick={() => post("resume")}
                  aria-label="Resume draft"
                  title="Resume draft"
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-lg leading-none text-emerald-950 hover:bg-emerald-400"
                >
                  ▶
                </button>
              ) : (
                <button
                  onClick={() => post("pause")}
                  disabled={!active}
                  aria-label="Pause draft"
                  title="Pause draft"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-700/60 text-lg leading-none text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
                >
                  ⏸
                </button>
              )}
              <button
                onClick={() => post("undo")}
                disabled={paused}
                aria-label="Undo last pick"
                title="Undo last pick"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-lg leading-none text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                ↩
              </button>
              <button
                onClick={() => post("skip")}
                disabled={!active || !onFrontier}
                aria-label="Skip this pick"
                title={
                  onFrontier
                    ? "Skip this pick (return to it later)"
                    : "This pick was skipped — fill it from the board"
                }
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-lg leading-none text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                ⏭
              </button>
            </div>

            {/* Centered search */}
            <div className="mx-auto w-full max-w-lg">
              <PlayerSearch
                draftId={draftId}
                onPick={makePick}
                disabled={complete || paused}
              />
            </div>

            {/* Trades + guarded reset behind a ⋯ menu */}
            <div className="flex items-center gap-2">
              {tradesButton}
              <MoreMenu onReset={() => setShowReset(true)} />
            </div>
          </div>
        ))}

      {/* Viewers can still open the trade history/board (read-only). */}
      {!canEdit && (
        <div className="mt-3 flex justify-end">{tradesButton}</div>
      )}

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
                            ? "bg-emerald-500/15 ring-2 ring-inset ring-emerald-500"
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
                          <span className="block pt-2 text-[10px] font-semibold uppercase text-emerald-400">
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
