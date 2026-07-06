"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Accepts either a bare draft id or a full draft URL and navigates to the board.
function extractId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/draft\/([0-9a-fA-F-]{36})/);
  if (match) return match[1];
  return trimmed;
}

export function JoinDraftForm() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const id = extractId(value);
    if (id) router.push(`/draft/${id}`);
  }

  return (
    <form onSubmit={go} className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Draft link or ID"
        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-[var(--bb-accent-dim)]"
      />
      <button
        type="submit"
        className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium transition hover:bg-slate-600"
      >
        Go
      </button>
    </form>
  );
}
