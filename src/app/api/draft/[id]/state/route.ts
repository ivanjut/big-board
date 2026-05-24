import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { canEdit } from "@/lib/editToken";

export const runtime = "nodejs";

// GET /api/draft/[id]/state — full board state (never includes the password).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: d } = await sb
    .from("drafts")
    .select(
      "id,name,num_slots,num_rounds,include_idp,pick_seconds,current_pick,current_pick_started_at,status",
    )
    .eq("id", id)
    .single();

  if (!d) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  const { data: members } = await sb
    .from("draft_members")
    .select("slot,name")
    .eq("draft_id", id)
    .order("slot");

  const { data: picks } = await sb
    .from("picks")
    .select("pick_number,round,slot,player_id,player_name,player_position")
    .eq("draft_id", id)
    .order("pick_number");

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
      status: d.status,
    },
    members: members ?? [],
    picks: (picks ?? []).map((p) => ({
      pickNumber: p.pick_number,
      round: p.round,
      slot: p.slot,
      playerId: p.player_id,
      playerName: p.player_name,
      playerPosition: p.player_position,
    })),
    canEdit: await canEdit(id),
  });
}
