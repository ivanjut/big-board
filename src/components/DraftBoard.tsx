"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  cellToPick,
  pickToCell,
  totalPicks,
  type DraftState,
} from "@/lib/draftLogic";
import { PlayerSearch } from "./PlayerSearch";
import { PickTimer } from "./PickTimer";
import { DraftSettingsModal } from "./DraftSettingsModal";

export function DraftBoard({ draftId }: { draftId: string }) {
  const [state, setState] = useState<DraftState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showUnlock, setShowUnlock] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const makePick = useCallback(
    async (playerId: number) => {
      await post("pick", { playerId });
    },
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
  const pending = draft.status === "pending";
  const complete = draft.status === "complete" || draft.currentPick > total;
  const paused = draft.status === "paused" && !complete;
  const active = draft.status === "active" && !complete;
  const inProgress = !pending && !complete; // active or paused
  const onClock = inProgress ? pickToCell(draft.currentPick, draft.numSlots) : null;
  const onClockMember = onClock
    ? members.find((m) => m.slot === onClock.slot)
    : null;

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
        {pending ? (
          <span className="text-sm text-slate-300">
            {canEdit
              ? "Draft hasn't started — press Start when everyone's ready."
              : "Waiting for the commissioner to start the draft."}
          </span>
        ) : complete ? (
          <span className="font-semibold text-emerald-400">Draft complete 🎉</span>
        ) : (
          <>
            <span className="text-sm text-slate-400">On the clock</span>
            <span className="text-lg font-bold">
              {onClockMember ? onClockMember.name : `Slot ${onClock!.slot}`}
            </span>
            <span className="text-sm text-slate-400">
              Round {onClock!.round} · Pick {draft.currentPick}
            </span>
            <span className="ml-auto flex items-center gap-2 text-sm text-slate-400">
              {paused && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  ⏸ Paused
                </span>
              )}
              ⏱{" "}
              <PickTimer
                startedAt={draft.currentPickStartedAt}
                seconds={draft.pickSeconds}
                pausedAt={draft.pausedAt}
                key={draft.currentPick}
              />
            </span>
          </>
        )}
      </div>

      {/* Controls (only when unlocked) */}
      {canEdit && (
        <div className="mt-3 grid gap-2">
          {pending ? (
            <button
              onClick={() => post("start")}
              className="rounded-xl bg-emerald-500 px-6 py-3 text-center font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              ▶ Start draft
            </button>
          ) : (
            <PlayerSearch
              draftId={draftId}
              onPick={makePick}
              disabled={complete || paused}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {active && (
              <button
                onClick={() => post("pause")}
                className="rounded-lg border border-amber-700/60 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/10"
              >
                ⏸ Pause
              </button>
            )}
            {paused && (
              <button
                onClick={() => post("resume")}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
              >
                ▶ Resume
              </button>
            )}
            <button
              onClick={() => post("undo")}
              disabled={pending || paused}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-40"
            >
              ↩ Undo
            </button>
            <button
              onClick={() => setShowReset(true)}
              className="rounded-lg border border-red-900/60 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
            >
              Reset draft
            </button>
          </div>
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
                      inProgress && pickNumber === draft.currentPick;
                    return (
                      <td
                        key={m.slot}
                        className={`relative h-14 border-l border-t border-slate-800 px-2 py-1 align-top ${
                          isOnClock
                            ? "bg-emerald-500/15 ring-2 ring-inset ring-emerald-500"
                            : pick
                              ? "bg-slate-900/40"
                              : ""
                        }`}
                      >
                        <span className="absolute right-1 top-0.5 text-[10px] text-slate-600">
                          {pickNumber}
                        </span>
                        {pick ? (
                          <span className="block pr-4 pt-1 text-xs font-medium leading-tight text-slate-100">
                            {pick.playerName}
                          </span>
                        ) : isOnClock ? (
                          <span className="block pt-2 text-[10px] font-semibold uppercase text-emerald-400">
                            On the clock
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
