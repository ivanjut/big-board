"use client";

import { useEffect, useMemo } from "react";
import {
  buildOwnerMap,
  effectiveOwnerSlot,
  type Member,
  type Pick,
  type PickTrade,
} from "@/lib/draftLogic";

// End-of-draft recap: thanks the league, summarizes how the board came together
// (auto-picks, picks filled after a skip, trades), and offers the board export.
export function DraftCompleteModal({
  draftName,
  numSlots,
  members,
  picks,
  trades,
  onDownload,
  onClose,
}: {
  draftName: string;
  numSlots: number;
  members: Member[];
  picks: Pick[];
  trades: PickTrade[];
  onDownload: (format: "csv" | "xlsx") => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ownerMap = useMemo(() => buildOwnerMap(trades), [trades]);
  const memberName = (slot: number) =>
    members.find((m) => m.slot === slot)?.name ?? `Slot ${slot}`;
  // The team a pick belongs to = its current owner after trades.
  const pickTeam = (p: Pick) =>
    memberName(effectiveOwnerSlot(p.pickNumber, numSlots, ownerMap));

  const byPickNumber = (a: Pick, b: Pick) => a.pickNumber - b.pickNumber;
  const autoPicks = picks.filter((p) => p.autoPicked).sort(byPickNumber);
  // Every pick filled after being skipped; the stat counts them all, but ones
  // that were auto-picked are listed under Auto-picks, not twice.
  const skipFillCount = picks.filter((p) => p.wasSkipped).length;
  const skipFills = picks
    .filter((p) => p.wasSkipped && !p.autoPicked)
    .sort(byPickNumber);

  // Group the trade log into transactions, each summarized as who received
  // which picks (mirrors TradeDialog's grouping).
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
      const received = new Map<number, number[]>();
      for (const r of rows) {
        if (!received.has(r.toSlot)) received.set(r.toSlot, []);
        received.get(r.toSlot)!.push(r.pickNumber);
      }
      return { txn, received: [...received.entries()] };
    });
  }, [trades]);

  const uneventful =
    autoPicks.length === 0 && skipFills.length === 0 && transactions.length === 0;

  const stat = (value: number, label: string) => (
    <div className="rounded-lg bg-slate-950/60 px-3 py-2 text-center">
      <div className="text-xl font-bold tabular-nums text-slate-100">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </div>
    </div>
  );

  const pickLine = (p: Pick) => (
    <li
      key={p.pickNumber}
      className="flex items-baseline gap-2 px-3 py-1.5 text-sm"
    >
      <span className="font-semibold tabular-nums text-slate-500">
        #{p.pickNumber}
      </span>
      <span className="text-slate-400">{pickTeam(p)}</span>
      <span className="ml-auto text-right font-medium text-slate-100">
        {p.playerName}
        {p.playerPosition && (
          <span className="ml-1.5 text-xs font-normal text-slate-500">
            {p.playerPosition.toUpperCase()}
          </span>
        )}
      </span>
    </li>
  );

  const section = (title: string, items: React.ReactNode) => (
    <div>
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </h4>
      <ul className="divide-y divide-slate-800 rounded-lg bg-slate-950/60 py-0.5">
        {items}
      </ul>
    </div>
  );

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-complete-title"
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5"
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 id="draft-complete-title" className="text-lg font-semibold">
            That&apos;s a wrap! 🎉
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-slate-400">
          Thanks for drafting with Big Board — every pick of{" "}
          <span className="font-medium text-slate-200">{draftName}</span> is in
          the books. Here&apos;s how the board came together.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat(picks.length, "Picks")}
          {stat(autoPicks.length, "Auto-picks")}
          {stat(skipFillCount, "Skip fills")}
          {stat(transactions.length, "Trades")}
        </div>

        <div className="mt-4 grid gap-4">
          {uneventful && (
            <p className="rounded-lg bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
              A clean draft — every pick was made on the clock, with no
              auto-picks, skips, or trades.
            </p>
          )}
          {autoPicks.length > 0 &&
            section("Auto-picks", autoPicks.map(pickLine))}
          {skipFills.length > 0 &&
            section("Filled after a skip", skipFills.map(pickLine))}
          {transactions.length > 0 &&
            section(
              "Trades",
              transactions.map((t) => (
                <li key={t.txn} className="px-3 py-1.5 text-sm text-slate-400">
                  {t.received.map(([slot, pickNums], i) => (
                    <span key={slot}>
                      {i > 0 && <span className="text-slate-600"> · </span>}
                      <span className="font-medium text-slate-100">
                        {memberName(slot)}
                      </span>{" "}
                      got{" "}
                      <span className="tabular-nums">
                        {pickNums
                          .sort((a, b) => a - b)
                          .map((n) => `#${n}`)
                          .join(", ")}
                      </span>
                    </span>
                  ))}
                </li>
              )),
            )}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onDownload("xlsx")}
            className="flex flex-1 items-center justify-center rounded-[11px] bg-[var(--bb-accent)] px-4 py-2.5 text-sm font-semibold text-[#04120a] transition-colors hover:bg-[var(--bb-accent-dim)]"
          >
            Download Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => onDownload("csv")}
            className="flex flex-1 items-center justify-center rounded-[11px] border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800"
          >
            Download CSV
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] leading-snug text-slate-500">
          Only the Excel export keeps the position colors — a CSV is plain text.
        </p>
      </div>
    </div>
  );
}
