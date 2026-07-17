import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { canEdit } from "@/lib/editToken";

export const runtime = "nodejs";

// GET /api/draft/[id]/state — full board state (never includes the password).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const [d] = await db`
    select id, name, num_slots, num_rounds, include_idp, pick_seconds,
           current_pick, current_pick_started_at, paused_at, status
    from drafts where id = ${id}
  `;

  if (!d) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  const members = await db`
    select slot, name from draft_members where draft_id = ${id} order by slot
  `;

  const picks = await db`
    select pick_number, round, slot, player_id, player_name, player_position, player_team,
           was_skipped, auto_picked
    from picks where draft_id = ${id} order by pick_number
  `;

  // Chronological so the client's buildOwnerMap resolves latest-trade-wins.
  const trades = await db`
    select transaction_id, pick_number, from_slot, to_slot, created_at
    from pick_trades where draft_id = ${id} order by created_at, id
  `;

  // Skipped-but-unfilled picks (open, returnable cells on the board).
  const skipped = await db`
    select pick_number from skipped_picks where draft_id = ${id} order by pick_number
  `;

  return NextResponse.json({
    draft: {
      id: d.id,
      name: d.name,
      numSlots: d.num_slots,
      numRounds: d.num_rounds,
      includeIdp: d.include_idp,
      pickSeconds: d.pick_seconds,
      currentPick: d.current_pick,
      currentPickStartedAt: d.current_pick_started_at,
      pausedAt: d.paused_at,
      status: d.status,
    },
    members: members.map((m) => ({
      slot: m.slot,
      name: m.name,
    })),
    picks: picks.map((p) => ({
      pickNumber: p.pick_number,
      round: p.round,
      slot: p.slot,
      playerId: p.player_id,
      playerName: p.player_name,
      playerPosition: p.player_position,
      playerTeam: p.player_team,
      wasSkipped: p.was_skipped,
      autoPicked: p.auto_picked,
    })),
    trades: trades.map((t) => ({
      transactionId: t.transaction_id,
      pickNumber: t.pick_number,
      fromSlot: t.from_slot,
      toSlot: t.to_slot,
      createdAt: t.created_at,
    })),
    skipped: skipped.map((s) => s.pick_number),
    canEdit: await canEdit(id),
  });
}
