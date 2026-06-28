// Shared types and snake-draft math used on both server and client.

export type DraftConfig = {
  id: string;
  name: string;
  numSlots: number;
  numRounds: number;
  includeIdp: boolean;
  pickSeconds: number | null;
  currentPick: number;
  currentPickStartedAt: string;
  pausedAt: string | null;
  status: "pending" | "active" | "paused" | "complete";
};

export type Member = { slot: number; name: string };

export type Pick = {
  pickNumber: number;
  round: number;
  slot: number;
  playerId: number;
  playerName: string;
  playerPosition: string | null;
  playerTeam: string | null;
};

// One pick movement in a draft's trade log: pick `pickNumber` moved from one
// drafting slot to another. Movements sharing a `transactionId` are one trade
// (a two-team swap of several picks). Ordered chronologically by `createdAt`.
export type PickTrade = {
  transactionId: string;
  pickNumber: number;
  fromSlot: number;
  toSlot: number;
  createdAt: string;
};

export type DraftState = {
  draft: DraftConfig;
  members: Member[];
  picks: Pick[];
  trades: PickTrade[];
  // Overall pick numbers that were skipped (deferred) and not yet filled.
  skipped: number[];
  canEdit: boolean;
};

export type PlayerResult = {
  id: number;
  name: string;
  position: string;
  team: string | null;
  isIdp: boolean;
};

export const totalPicks = (numSlots: number, numRounds: number) =>
  numSlots * numRounds;

// Overall pick number (1-indexed) -> board cell, for a SNAKE (serpentine) draft.
// Round 1 runs slots 1..N, round 2 runs N..1, and so on.
export function pickToCell(
  pickNumber: number,
  numSlots: number,
): { round: number; slot: number } {
  const round = Math.ceil(pickNumber / numSlots);
  const indexInRound = ((pickNumber - 1) % numSlots) + 1; // 1..N
  const slot = round % 2 === 1 ? indexInRound : numSlots - indexInRound + 1;
  return { round, slot };
}

// Inverse of pickToCell: which overall pick belongs to (round, slot).
export function cellToPick(
  round: number,
  slot: number,
  numSlots: number,
): number {
  const base = (round - 1) * numSlots;
  const indexInRound = round % 2 === 1 ? slot : numSlots - slot + 1;
  return base + indexInRound;
}

// The pick currently on the clock, given the forward frontier (current_pick),
// the set of skipped-but-unfilled picks, and the draft size. The clock marches
// forward through the frontier; skipped picks stay open and returnable off the
// clock until the frontier runs off the end, at which point the clock falls back
// to the earliest still-open skipped pick so deferred picks get filled. Returns
// null when every pick has been made (the draft is complete).
export function clockPick(
  currentPick: number,
  skipped: number[],
  total: number,
): number | null {
  if (currentPick <= total) return currentPick;
  return skipped.length ? Math.min(...skipped) : null;
}

// The pick that lands on the clock once the current one is resolved (used for
// the "next" indicator). Mirrors clockPick's ordering: remaining forward picks
// first, then skipped picks ascending.
export function nextClockPick(
  currentPick: number,
  skipped: number[],
  total: number,
): number | null {
  if (currentPick < total) return currentPick + 1;
  // currentPick === total: after this pick, only skipped picks remain.
  // currentPick > total: clock is the smallest skipped pick, so "next" is the
  // second smallest.
  const sorted = [...skipped].sort((a, b) => a - b);
  return currentPick === total ? (sorted[0] ?? null) : (sorted[1] ?? null);
}

// True once the frontier has run off the end and no skipped picks remain.
export function isComplete(
  currentPick: number,
  skipped: number[],
  total: number,
): boolean {
  return currentPick > total && skipped.length === 0;
}

// Collapse a trade log into pick_number -> current owner slot. Later trades win,
// so the input must be in chronological order (oldest first).
export function buildOwnerMap(trades: PickTrade[]): Map<number, number> {
  const owners = new Map<number, number>();
  for (const t of trades) owners.set(t.pickNumber, t.toSlot);
  return owners;
}

// Current owner of a pick: the latest trade's destination slot, or — if the pick
// has never been traded — the original snake slot it falls on.
export function effectiveOwnerSlot(
  pickNumber: number,
  numSlots: number,
  owners: Map<number, number>,
): number {
  return owners.get(pickNumber) ?? pickToCell(pickNumber, numSlots).slot;
}
