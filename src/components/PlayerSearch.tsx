"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerResult } from "@/lib/draftLogic";

// Debounced fuzzy search box. Typing "bij" or "rob" surfaces "Bijan Robinson".
export function PlayerSearch({
  draftId,
  onPick,
  disabled,
  pending,
}: {
  draftId: string;
  onPick: (playerId: number) => Promise<void>;
  disabled?: boolean;
  // True while a pick is being submitted; shows a pending affordance and drives
  // the auto-refocus after the pick lands.
  pending?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevPending = useRef(false);

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

  // "/" focuses the search from anywhere on the board (unless the user is
  // already typing in a field) — the commissioner's fast path to the next pick.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || disabled) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [disabled]);

  // Refocus the box the moment a pick finishes (pending true -> false) so the
  // commissioner can type the next player without reaching for the mouse.
  useEffect(() => {
    if (prevPending.current && !pending && !disabled) {
      inputRef.current?.focus();
    }
    prevPending.current = !!pending;
  }, [pending, disabled]);

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
      {pending ? (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 animate-spin text-[var(--bb-accent-text)] motion-reduce:animate-none"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[var(--bb-muted-2)]"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      )}
      <input
        ref={inputRef}
        value={q}
        disabled={disabled || pending}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length && setOpen(true)}
        placeholder={
          disabled
            ? "Draft complete"
            : pending
              ? "Drafting…"
              : "Search a player to draft…"
        }
        className="w-full rounded-[11px] border border-[var(--bb-stroke)] bg-[var(--bb-card)] py-3 pl-11 pr-4 text-[15px] text-[var(--bb-text)] transition-colors placeholder:text-[var(--bb-muted-2)] focus:border-[var(--bb-accent-dim)] disabled:opacity-50"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-[11px] border border-[var(--bb-stroke)] bg-[var(--bb-card)] shadow-xl">
          {results.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(p)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-[var(--bb-text)] ${
                  i === active
                    ? "bg-[rgba(63,224,129,0.12)]"
                    : "hover:bg-[var(--bb-card-2)]"
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span className="ml-3 shrink-0 text-xs text-[var(--bb-muted)]">
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
