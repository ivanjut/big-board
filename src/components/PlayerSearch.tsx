"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerResult } from "@/lib/draftLogic";

// Debounced fuzzy search box. Typing "bij" or "rob" surfaces "Bijan Robinson".
export function PlayerSearch({
  draftId,
  onPick,
  disabled,
}: {
  draftId: string;
  onPick: (playerId: number) => Promise<void>;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/draft/${draftId}/search?q=${encodeURIComponent(q)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
        setActive(0);
        setOpen(true);
      }
    }, 160);
    return () => clearTimeout(t);
  }, [q, draftId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function choose(p: PlayerResult) {
    setOpen(false);
    setQ("");
    setResults([]);
    await onPick(p.id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = results[active];
      if (p) choose(p);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={q}
        disabled={disabled}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length && setOpen(true)}
        placeholder={disabled ? "Draft complete" : "Search a player to draft…"}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none focus:border-emerald-500 disabled:opacity-50"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {results.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(p)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm ${
                  i === active ? "bg-emerald-500/15" : "hover:bg-slate-800"
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span className="ml-3 shrink-0 text-xs text-slate-400">
                  {p.position}
                  {p.team ? ` · ${p.team}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
