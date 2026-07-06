"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  effectiveOwnerSlot,
  pickToCell,
  type Member,
  type Pick,
  type PickTrade,
} from "@/lib/draftLogic";

type TradePayload = {
  teamA: number;
  teamB: number;
  aToB: number[];
  bToA: number[];
};

// A scrollable checkbox column of one team's tradeable picks.
function PickColumn({
  title,
  picks,
  selected,
  renderItem,
  onToggle,
}: {
  title: string;
  picks: number[];
  selected: Set<number>;
  renderItem: (n: number) => ReactNode;
  onToggle: (n: number) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-800">
      <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="max-h-56 overflow-y-auto p-1">
        {picks.length === 0 ? (
          <p className="px-2 py-3 text-sm text-slate-500">Nothing to trade.</p>
        ) : (
          picks.map((n) => (
            <label
              key={n}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={selected.has(n)}
                onChange={() => onToggle(n)}
                className="h-4 w-4 shrink-0 accent-[var(--bb-accent)]"
              />
              <span className="min-w-0 flex-1">{renderItem(n)}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

// Modal for swapping picks between two teams. The commissioner picks two teams,
// checks which of each team's upcoming picks to send the other way, and records
// the whole swap as one trade. Everyone can read the grouped history below.
export function TradeDialog({
  members,
  trades,
  picks,
  owners,
  numSlots,
  total,
  currentPick,
  canEdit,
  onTrade,
  onClose,
}: {
  members: Member[];
  trades: PickTrade[];
  picks: Pick[];
  owners: Map<number, number>;
  numSlots: number;
  total: number;
  currentPick: number;
  canEdit: boolean;
  onTrade: (payload: TradePayload) => Promise<boolean>;
  onClose: () => void;
}) {
  const memberName = (slot: number) =>
    members.find((m) => m.slot === slot)?.name ?? `Slot ${slot}`;

  // pick number -> the player drafted with it (if it has been made), so the
  // history can show what a traded pick ultimately became.
  const playerByPick = useMemo(() => {
    const m = new Map<number, Pick>();
    for (const p of picks) m.set(p.pickNumber, p);
    return m;
  }, [picks]);

  // Next drafting team after `slot` (by slot order, wrapping) — the default
  // counterparty to trade with.
  const nextSlotAfter = (slot: number) => {
    const slots = members.map((m) => m.slot); // ascending (state orders by slot)
    return slots.find((s) => s > slot) ?? slots.find((s) => s !== slot) ?? slot;
  };

  // Open with the team currently on the clock as A, and the next team as B.
  const onClockSlot =
    currentPick >= 1 && currentPick <= total
      ? effectiveOwnerSlot(currentPick, numSlots, owners)
      : members[0]?.slot ?? 1;
  const initialA = members.some((m) => m.slot === onClockSlot)
    ? onClockSlot
    : members[0]?.slot ?? 1;

  const [teamA, setTeamA] = useState(initialA);
  const [teamB, setTeamB] = useState(nextSlotAfter(initialA));
  const [selA, setSelA] = useState<Set<number>>(new Set());
  const [selB, setSelB] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Every pick a team currently owns — both drafted players (made picks) and
  // upcoming picks. Made picks have lower numbers, so they sort first and a
  // team's column reads as its roster followed by its remaining picks.
  const picksOwnedBy = useMemo(() => {
    return (slot: number) => {
      const out: number[] = [];
      for (let n = 1; n <= total; n++) {
        if (effectiveOwnerSlot(n, numSlots, owners) === slot) out.push(n);
      }
      return out;
    };
  }, [total, owners, numSlots]);

  const aPicks = useMemo(() => picksOwnedBy(teamA), [picksOwnedBy, teamA]);
  const bPicks = useMemo(() => picksOwnedBy(teamB), [picksOwnedBy, teamB]);

  function chooseA(slot: number) {
    setTeamA(slot);
    if (slot === teamB) setTeamB(nextSlotAfter(slot));
    setSelA(new Set());
    setSelB(new Set());
    setDone(false);
  }
  function chooseB(slot: number) {
    setTeamB(slot);
    if (slot === teamA) setTeamA(nextSlotAfter(slot));
    setSelA(new Set());
    setSelB(new Set());
    setDone(false);
  }
  function toggle(set: Set<number>, setter: (s: Set<number>) => void, n: number) {
    const next = new Set(set);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setter(next);
    setDone(false);
  }

  function pickLabel(n: number) {
    const { round } = pickToCell(n, numSlots);
    const inRound = ((n - 1) % numSlots) + 1;
    return `#${n} · R${round}·P${inRound}`;
  }

  // A row in a team's tradeable list: a drafted player shows its name and
  // position (with the pick tag as secondary); an unmade pick shows just the tag.
  function itemContent(n: number): ReactNode {
    const player = playerByPick.get(n);
    if (player) {
      return (
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-medium text-slate-100">
            {player.playerName}
          </span>
          {player.playerPosition && (
            <span className="shrink-0 text-[11px] uppercase text-slate-500">
              {player.playerPosition}
            </span>
          )}
          <span className="ml-auto shrink-0 text-[11px] text-slate-600">
            {pickLabel(n)}
          </span>
        </span>
      );
    }
    return <span className="text-slate-300">{pickLabel(n)}</span>;
  }

  const count = selA.size + selB.size;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (count === 0) return;
    setError(null);
    setSaving(true);
    const ok = await onTrade({
      teamA,
      teamB,
      aToB: [...selA],
      bToA: [...selB],
    });
    setSaving(false);
    if (ok) {
      setSelA(new Set());
      setSelB(new Set());
      setDone(true);
    } else {
      setError("Couldn't record that trade — a pick may have just been made.");
    }
  }

  // Group the log into transactions (preserving chronological order).
  const transactions = useMemo(() => {
    const order: string[] = [];
    const byTxn = new Map<string, PickTrade[]>();
    for (const t of trades) {
      if (!byTxn.has(t.transactionId)) {
        byTxn.set(t.transactionId, []);
        order.push(t.transactionId);
      }
      byTxn.get(t.transactionId)!.push(t);
    }
    return order.map((txn) => {
      const rows = byTxn.get(txn)!;
      const teams = [...new Set(rows.flatMap((r) => [r.fromSlot, r.toSlot]))];
      return { txn, rows, teams };
    });
  }, [trades]);

  const selectCls =
    "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-[var(--bb-accent-dim)]";

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8">
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Trade picks</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {canEdit && (
          <form onSubmit={submit} className="grid gap-4">
            {/* Team pickers */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <select
                value={teamA}
                onChange={(e) => chooseA(Number(e.target.value))}
                className={selectCls}
              >
                {members.map((m) => (
                  <option key={m.slot} value={m.slot}>
                    {m.name}
                  </option>
                ))}
              </select>
              <span className="text-lg text-slate-500">⇄</span>
              <select
                value={teamB}
                onChange={(e) => chooseB(Number(e.target.value))}
                className={selectCls}
              >
                {members.map((m) => (
                  <option key={m.slot} value={m.slot}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Pick selection columns */}
            <div className="grid grid-cols-2 gap-3">
              <PickColumn
                title={`${memberName(teamA)} sends →`}
                picks={aPicks}
                selected={selA}
                renderItem={itemContent}
                onToggle={(n) => toggle(selA, setSelA, n)}
              />
              <PickColumn
                title={`${memberName(teamB)} sends →`}
                picks={bPicks}
                selected={selB}
                renderItem={itemContent}
                onToggle={(n) => toggle(selB, setSelB, n)}
              />
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
              {count === 0 ? (
                "Select picks from either team to build a trade."
              ) : (
                <span>
                  <span className="font-semibold text-emerald-300 light:text-emerald-700">
                    {memberName(teamB)}
                  </span>{" "}
                  gets {selA.size || 0} ·{" "}
                  <span className="font-semibold text-emerald-300 light:text-emerald-700">
                    {memberName(teamA)}
                  </span>{" "}
                  gets {selB.size || 0}
                </span>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            {done && !error && (
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                Trade recorded.
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || count === 0}
                className="rounded-lg bg-[var(--bb-accent)] px-5 py-2 text-sm font-semibold text-[#04120a] hover:bg-[var(--bb-accent-dim)] disabled:opacity-50"
              >
                {saving ? "Recording…" : "Record trade"}
              </button>
            </div>
          </form>
        )}

        {/* History */}
        <div className="mt-5 border-t border-slate-800 pt-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            History
          </div>
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500">No trades yet.</p>
          ) : (
            <ul className="grid gap-2">
              {transactions
                .slice()
                .reverse()
                .map(({ txn, rows, teams }) => (
                  <li
                    key={txn}
                    className="rounded-lg border border-slate-800 px-3 py-2 text-sm"
                  >
                    <div className="font-medium text-slate-300">
                      {teams.map((s) => memberName(s)).join(" ⇄ ")}
                    </div>
                    <div className="mt-1 grid gap-0.5 text-xs text-slate-400">
                      {rows.map((r, i) => {
                        const player = playerByPick.get(r.pickNumber);
                        return (
                          <div key={i}>
                            <span className="font-semibold text-emerald-300 light:text-emerald-700">
                              {memberName(r.toSlot)}
                            </span>{" "}
                            gets {pickLabel(r.pickNumber)}{" "}
                            <span className="text-slate-500">
                              (from {memberName(r.fromSlot)})
                            </span>
                            {player && (
                              <span className="text-slate-300">
                                {" "}
                                →{" "}
                                <span className="font-medium">
                                  {player.playerName}
                                </span>
                                {player.playerPosition
                                  ? ` (${player.playerPosition})`
                                  : ""}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
