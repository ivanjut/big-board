"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function CreateDraftForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [numSlots, setNumSlots] = useState(12);
  const [numRounds, setNumRounds] = useState(15);
  const [includeIdp, setIncludeIdp] = useState(false);
  const [useTimer, setUseTimer] = useState(false);
  const [pickSeconds, setPickSeconds] = useState(90);
  const [password, setPassword] = useState("");
  const [members, setMembers] = useState<{ name: string }[]>(
    Array.from({ length: 12 }, () => ({ name: "" })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the member rows in sync with the slot count.
  useEffect(() => {
    setMembers((prev) => {
      const next = [...prev];
      if (numSlots > next.length) {
        while (next.length < numSlots) next.push({ name: "" });
      } else {
        next.length = numSlots;
      }
      return next;
    });
  }, [numSlots]);

  function updateMember(i: number, field: "name", value: string) {
    setMembers((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          numSlots,
          numRounds,
          includeIdp,
          pickSeconds: useTimer ? pickSeconds : null,
          password,
          members: members.map((m, i) => ({
            slot: i + 1,
            name: m.name || `Team ${i + 1}`,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create draft.");
      router.push(`/draft/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500";

  return (
    <form onSubmit={submit} className="grid gap-6">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-slate-300">Draft name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="2026 League Draft"
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
            value={numSlots}
            onChange={(e) => setNumSlots(Math.max(2, Math.min(32, Number(e.target.value) || 2)))}
            className={inputCls}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-slate-300">Rounds</span>
          <input
            type="number"
            min={1}
            max={40}
            value={numRounds}
            onChange={(e) => setNumRounds(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
            className={inputCls}
          />
        </label>
      </div>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={includeIdp}
          onChange={(e) => setIncludeIdp(e.target.checked)}
          className="h-4 w-4 accent-emerald-500"
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
            className="h-4 w-4 accent-emerald-500"
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

      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-slate-300">
          Draft password
        </span>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Shared with whoever runs the board"
          className={inputCls}
        />
      </label>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-300">
          Draft order
        </legend>
        <div className="grid gap-2">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-right text-sm text-slate-500">
                {i + 1}.
              </span>
              <input
                value={m.name}
                onChange={(e) => updateMember(i, "name", e.target.value)}
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

      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {submitting ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}
