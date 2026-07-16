"use client";

import { useEffect, useMemo, useState } from "react";
import type { DraftConfig, Member } from "@/lib/draftLogic";

type Row = { name: string };

// Commissioner-only modal to edit a live draft's settings.
export function DraftSettingsModal({
  draftId,
  draft,
  members,
  hasPicks,
  maxDraftedRound,
  onClose,
  onSaved,
  onReset,
}: {
  draftId: string;
  draft: DraftConfig;
  members: Member[];
  hasPicks: boolean;
  maxDraftedRound: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  // Opens the guarded reset flow (confirmation dialog lives in DraftBoard).
  onReset: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [numSlots, setNumSlots] = useState(draft.numSlots);
  const [numRounds, setNumRounds] = useState(draft.numRounds);
  const [includeIdp, setIncludeIdp] = useState(draft.includeIdp);
  const [useTimer, setUseTimer] = useState(draft.pickSeconds != null);
  const [pickSeconds, setPickSeconds] = useState(draft.pickSeconds ?? 90);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialRows = useMemo(() => {
    const bySlot = new Map(members.map((m) => [m.slot, m]));
    return Array.from({ length: draft.numSlots }, (_, i) => {
      const m = bySlot.get(i + 1);
      return { name: m?.name ?? "" };
    });
  }, [members, draft.numSlots]);

  const [rows, setRows] = useState<Row[]>(initialRows);

  // Resize member rows when slot count changes (only possible before any picks).
  useEffect(() => {
    setRows((prev) => {
      const next = [...prev];
      if (numSlots > next.length) {
        while (next.length < numSlots) next.push({ name: "" });
      } else {
        next.length = numSlots;
      }
      return next;
    });
  }, [numSlots]);

  const minRounds = Math.max(1, maxDraftedRound);

  function updateRow(i: number, field: keyof Row, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/draft/${draftId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          numSlots,
          numRounds,
          includeIdp,
          pickSeconds: useTimer ? pickSeconds : null,
          members: rows.map((r, i) => ({
            slot: i + 1,
            name: r.name || `Team ${i + 1}`,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save settings.");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-[var(--bb-accent-dim)] disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8">
      <form
        onSubmit={save}
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Draft settings</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-5">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-300">Draft name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-300">Draft slots</span>
              <input
                type="number"
                min={2}
                max={32}
                disabled={hasPicks}
                value={numSlots}
                onChange={(e) =>
                  setNumSlots(Math.max(2, Math.min(32, Number(e.target.value) || 2)))
                }
                className={inputCls}
              />
              {hasPicks && (
                <span className="text-xs text-slate-500">
                  Locked — picks already made.
                </span>
              )}
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-slate-300">Rounds</span>
              <input
                type="number"
                min={minRounds}
                max={40}
                value={numRounds}
                onChange={(e) =>
                  setNumRounds(
                    Math.max(minRounds, Math.min(40, Number(e.target.value) || minRounds)),
                  )
                }
                className={inputCls}
              />
              {maxDraftedRound > 0 && (
                <span className="text-xs text-slate-500">
                  Can&apos;t go below {minRounds}.
                </span>
              )}
            </label>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={includeIdp}
              onChange={(e) => setIncludeIdp(e.target.checked)}
              className="h-4 w-4 accent-[var(--bb-accent)]"
            />
            <span className="text-sm text-slate-300">
              Include individual defensive players (IDPs)
            </span>
          </label>

          <div className="grid gap-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={useTimer}
                onChange={(e) => setUseTimer(e.target.checked)}
                className="h-4 w-4 accent-[var(--bb-accent)]"
              />
              <span className="text-sm text-slate-300">Time limit per pick</span>
            </label>
            {useTimer && (
              <div className="flex items-center gap-2 pl-7">
                <input
                  type="number"
                  min={5}
                  max={3600}
                  value={pickSeconds}
                  onChange={(e) => setPickSeconds(Number(e.target.value) || 0)}
                  className={`${inputCls} w-24`}
                />
                <span className="text-sm text-slate-400">seconds</span>
              </div>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium text-slate-300">
              Draft order
            </legend>
            <div className="grid max-h-60 gap-2 overflow-y-auto pr-1">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-right text-sm text-slate-500">
                    {i + 1}.
                  </span>
                  <input
                    value={r.name}
                    onChange={(e) => updateRow(i, "name", e.target.value)}
                    placeholder={`Team ${i + 1}`}
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                </div>
              ))}
            </div>
          </fieldset>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--bb-danger)] transition-colors hover:bg-red-500/10"
            >
              Reset draft…
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[var(--bb-accent)] px-5 py-2 text-sm font-semibold text-[#04120a] hover:bg-[var(--bb-accent-dim)] disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
