import { NextRequest, NextResponse } from "next/server";
import { getDb, UNIQUE_VIOLATION } from "@/lib/db";
import { canEdit } from "@/lib/editToken";
import { clockPick, isComplete, pickToCell, totalPicks } from "@/lib/draftLogic";

export const runtime = "nodejs";

// How far past the pick being filled the auto-pick reaches: a random undrafted
// player whose rank sits ADP_MIN_AHEAD..ADP_MAX_AHEAD spots after this pick. The
// `rank` column (FantasyPros ECR) is the app's ADP proxy — the same value search
// orders by — so "ADP 20–30 spots out" means rank in [pick+20, pick+30].
const ADP_MIN_AHEAD = 20;
const ADP_MAX_AHEAD = 30;

// POST /api/draft/[id]/autopick { pickNumber? } — draft a random undrafted player
// whose ADP falls 20–30 picks after the target pick. Like the manual /pick route
// but it chooses the player itself; without pickNumber it fills the pick on the
// clock, with it a specific open (skipped) pick out of order.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await canEdit(id)))
    return NextResponse.json({ error: "Not authorized to edit this draft." }, { status: 403 });

  // An auto-pick from the action dock sends no body — default to the clock pick.
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  let targetPick: number | null =
    body?.pickNumber == null ? null : Number(body.pickNumber);

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

  // Same fillable rule as /pick: the forward frontier, or a previously skipped pick.
  const isFillable = (p: number) =>
    (p === frontier && frontier <= total) || skippedSet.has(p);

  if (targetPick == null) targetPick = clockPick(frontier, skipped, total);
  if (targetPick == null)
    return NextResponse.json({ error: "The draft is already complete." }, { status: 409 });
  if (!Number.isInteger(targetPick) || !isFillable(targetPick))
    return NextResponse.json({ error: "That pick isn't open to fill." }, { status: 409 });

  // Candidate pool: undrafted, ranked players in the ADP window, chosen at
  // random. IDPs carry no rank, so `rank between` excludes them naturally.
  const minRank = targetPick + ADP_MIN_AHEAD;
  const maxRank = targetPick + ADP_MAX_AHEAD;
  const [player] = await db`
    select id, name, position, team from players
    where rank between ${minRank} and ${maxRank}
      and id not in (select player_id from picks where draft_id = ${id})
    order by random()
    limit 1
  `;
  if (!player)
    return NextResponse.json(
      {
        error: `No undrafted player with an ADP ${ADP_MIN_AHEAD}–${ADP_MAX_AHEAD} picks out — draft one manually.`,
      },
      { status: 409 },
    );

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
        (draft_id, pick_number, round, slot, player_id, player_name, player_position, player_team)
      values
        (${id}, ${targetPick}, ${round}, ${slot}, ${player.id}, ${player.name}, ${player.position}, ${player.team})
    `;
  } catch (e) {
    // Unique violation -> the picked player was drafted (or the pick was taken)
    // in a race between our random select and insert. Ask the caller to retry.
    const conflict = (e as { code?: string })?.code === UNIQUE_VIOLATION;
    const msg = e instanceof Error ? e.message : "Failed to record the pick.";
    return NextResponse.json(
      { error: conflict ? "That pick was just taken — try again." : msg },
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

  return NextResponse.json({ ok: true, player: { id: player.id, name: player.name } });
}
