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
  status: "active" | "complete";
};

export type Member = { slot: number; name: string };

export type Pick = {
  pickNumber: number;
  round: number;
  slot: number;
  playerId: number;
  playerName: string;
  playerPosition: string | null;
};

export type DraftState = {
  draft: DraftConfig;
  members: Member[];
  picks: Pick[];
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
