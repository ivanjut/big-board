import { NextRequest, NextResponse } from "next/server";
import { getDb, UNIQUE_VIOLATION } from "@/lib/db";
import { canEdit } from "@/lib/editToken";
import { clockPick, isComplete, pickToCell, totalPicks } from "@/lib/draftLogic";

export const runtime = "nodejs";

// POST /api/draft/[id]/pick { playerId? | name?, pickNumber? } — draft a player.
// Pass playerId to draft a DB player, or name to write in a custom pick not in
// the player DB. Without pickNumber the pick on the clock is filled; with it, a
// specific open pick (the clock, or a previously skipped one) is filled out of
// order.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await canEdit(id)))
    return NextResponse.json({ error: "Not authorized to edit this draft." }, { status: 403 });

  let playerId: number | null;
  let customName: string | null;
  let targetPick: number | null;
  try {
    const body = await req.json();
    playerId = body?.playerId == null ? null : Number(body.playerId);
    customName = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : null;
    targetPick = body?.pickNumber == null ? null : Number(body.pickNumber);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!playerId && !customName)
    return NextResponse.json({ error: "A player is required." }, { status: 400 });

  const db = getDb();
  const [draft] = await db`
    select num_slots, num_rounds, current_pick, status from drafts where id = ${id}
  `;
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  if (draft.status === "pending")
    return NextResponse.json({ error: "Start the draft before making picks." }, { status: 409 });
  if (draft.status === "paused")
    return NextResponse.json({ error: "The draft is paused — resume to make picks." }, { status: 409 });

  const total = totalPicks(draft.num_slots, draft.num_rounds);
  const frontier = draft.current_pick;

  const skippedRows = await db`
    select pick_number from skipped_picks where draft_id = ${id}
  `;
  const skipped = skippedRows.map((s) => s.pick_number as number);
  const skippedSet = new Set(skipped);

  // A pick can be filled if it's the forward frontier (still within the draft)
  // or a previously skipped pick. Anything else is either already made or not
  // yet reached.
  const isFillable = (p: number) =>
    (p === frontier && frontier <= total) || skippedSet.has(p);

  if (targetPick == null) targetPick = clockPick(frontier, skipped, total);
  if (targetPick == null)
    return NextResponse.json({ error: "The draft is already complete." }, { status: 409 });
  if (!Number.isInteger(targetPick) || !isFillable(targetPick))
    return NextResponse.json({ error: "That pick isn't open to fill." }, { status: 409 });

  // A written-in name has no DB row; otherwise resolve the DB player so the
  // denormalized name/position/team come from the canonical record.
  let player: {
    id: number | null;
    name: string;
    position: string | null;
    team: string | null;
  };
  if (playerId) {
    const [row] = await db`
      select id, name, position, team from players where id = ${playerId}
    `;
    if (!row) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    player = { id: row.id, name: row.name, position: row.position, team: row.team };
  } else {
    player = { id: null, name: customName as string, position: null, team: null };
  }

  const { round, slot: snakeSlot } = pickToCell(targetPick, draft.num_slots);

  // If this pick was traded, the team that makes it is the latest owner.
  const [lastTrade] = await db`
    select to_slot from pick_trades
    where draft_id = ${id} and pick_number = ${targetPick}
    order by created_at desc, id desc
    limit 1
  `;
  const slot = lastTrade?.to_slot ?? snakeSlot;

  try {
    await db`
      insert into picks
        (draft_id, pick_number, round, slot, player_id, player_name, player_position, player_team, was_skipped)
      values
        (${id}, ${targetPick}, ${round}, ${slot}, ${player.id}, ${player.name}, ${player.position}, ${player.team}, ${skippedSet.has(targetPick)})
    `;
  } catch (e) {
    // Unique violation -> player already drafted, or this pick was just taken.
    const conflict = (e as { code?: string })?.code === UNIQUE_VIOLATION;
    const msg = e instanceof Error ? e.message : "Failed to record the pick.";
    return NextResponse.json(
      { error: conflict ? "That player was already drafted." : msg },
      { status: conflict ? 409 : 500 },
    );
  }

  // Clear the skipped marker if we just filled a deferred pick, and advance the
  // frontier only when the frontier pick itself was filled.
  if (skippedSet.has(targetPick)) {
    await db`
      delete from skipped_picks where draft_id = ${id} and pick_number = ${targetPick}
    `;
    skippedSet.delete(targetPick);
  }
  const nextFrontier = targetPick === frontier ? frontier + 1 : frontier;
  const done = isComplete(nextFrontier, [...skippedSet], total);

  await db`
    update drafts
    set current_pick = ${nextFrontier},
        current_pick_started_at = ${new Date().toISOString()},
        status = ${done ? "complete" : "active"}
    where id = ${id}
  `;

  return NextResponse.json({ ok: true });
}
