import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { canEdit } from "@/lib/editToken";
import { clockPick, isComplete, pickToCell, totalPicks } from "@/lib/draftLogic";

export const runtime = "nodejs";

// POST /api/draft/[id]/pick { playerId, pickNumber? } — draft a player. Without
// pickNumber the pick on the clock is filled; with it, a specific open pick
// (the one on the clock, or a previously skipped one) is filled out of order.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await canEdit(id)))
    return NextResponse.json({ error: "Not authorized to edit this draft." }, { status: 403 });

  let playerId: number;
  let targetPick: number | null;
  try {
    const body = await req.json();
    playerId = Number(body?.playerId);
    targetPick = body?.pickNumber == null ? null : Number(body.pickNumber);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!playerId) return NextResponse.json({ error: "A player is required." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: draft } = await sb
    .from("drafts")
    .select("num_slots,num_rounds,current_pick,status")
    .eq("id", id)
    .single();
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  if (draft.status === "pending")
    return NextResponse.json({ error: "Start the draft before making picks." }, { status: 409 });
  if (draft.status === "paused")
    return NextResponse.json({ error: "The draft is paused — resume to make picks." }, { status: 409 });

  const total = totalPicks(draft.num_slots, draft.num_rounds);
  const frontier = draft.current_pick;

  const { data: skippedRows } = await sb
    .from("skipped_picks")
    .select("pick_number")
    .eq("draft_id", id);
  const skipped = (skippedRows ?? []).map((s) => s.pick_number);
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

  const { data: player } = await sb
    .from("players")
    .select("id,name,position,team")
    .eq("id", playerId)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  const { round, slot: snakeSlot } = pickToCell(targetPick, draft.num_slots);

  // If this pick was traded, the team that makes it is the latest owner.
  const { data: lastTrade } = await sb
    .from("pick_trades")
    .select("to_slot")
    .eq("draft_id", id)
    .eq("pick_number", targetPick)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const slot = lastTrade?.to_slot ?? snakeSlot;

  const { error: insErr } = await sb.from("picks").insert({
    draft_id: id,
    pick_number: targetPick,
    round,
    slot,
    player_id: player.id,
    player_name: player.name,
    player_position: player.position,
    player_team: player.team,
  });
  if (insErr) {
    // Unique violation -> player already drafted, or this pick was just taken.
    const conflict = insErr.code === "23505";
    return NextResponse.json(
      { error: conflict ? "That player was already drafted." : insErr.message },
      { status: conflict ? 409 : 500 },
    );
  }

  // Clear the skipped marker if we just filled a deferred pick, and advance the
  // frontier only when the frontier pick itself was filled.
  if (skippedSet.has(targetPick)) {
    await sb
      .from("skipped_picks")
      .delete()
      .eq("draft_id", id)
      .eq("pick_number", targetPick);
    skippedSet.delete(targetPick);
  }
  const nextFrontier = targetPick === frontier ? frontier + 1 : frontier;
  const done = isComplete(nextFrontier, [...skippedSet], total);

  await sb
    .from("drafts")
    .update({
      current_pick: nextFrontier,
      current_pick_started_at: new Date().toISOString(),
      status: done ? "complete" : "active",
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
