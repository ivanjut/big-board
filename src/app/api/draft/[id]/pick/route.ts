import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { canEdit } from "@/lib/editToken";
import { pickToCell, totalPicks } from "@/lib/draftLogic";

export const runtime = "nodejs";

// POST /api/draft/[id]/pick { playerId } — draft a player at the current pick.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await canEdit(id)))
    return NextResponse.json({ error: "Not authorized to edit this draft." }, { status: 403 });

  let playerId: number;
  try {
    playerId = Number((await req.json())?.playerId);
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
  const pickNumber = draft.current_pick;
  if (pickNumber > total)
    return NextResponse.json({ error: "The draft is already complete." }, { status: 409 });

  const { data: player } = await sb
    .from("players")
    .select("id,name,position,team")
    .eq("id", playerId)
    .single();
  if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  const { round, slot } = pickToCell(pickNumber, draft.num_slots);

  const { error: insErr } = await sb.from("picks").insert({
    draft_id: id,
    pick_number: pickNumber,
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

  const nextPick = pickNumber + 1;
  await sb
    .from("drafts")
    .update({
      current_pick: nextPick,
      current_pick_started_at: new Date().toISOString(),
      status: nextPick > total ? "complete" : "active",
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
