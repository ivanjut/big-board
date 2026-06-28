import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { canEdit } from "@/lib/editToken";
import { totalPicks } from "@/lib/draftLogic";

export const runtime = "nodejs";

// POST /api/draft/[id]/skip — defer the pick on the clock. The frontier advances
// past it; the skipped pick stays open and can be filled out of order later.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await canEdit(id)))
    return NextResponse.json({ error: "Not authorized to edit this draft." }, { status: 403 });

  const sb = supabaseAdmin();
  const { data: draft } = await sb
    .from("drafts")
    .select("num_slots,num_rounds,current_pick,status")
    .eq("id", id)
    .single();
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  if (draft.status === "pending")
    return NextResponse.json({ error: "Start the draft before skipping picks." }, { status: 409 });
  if (draft.status === "paused")
    return NextResponse.json({ error: "The draft is paused — resume to skip." }, { status: 409 });

  const total = totalPicks(draft.num_slots, draft.num_rounds);
  const frontier = draft.current_pick;
  // Only the forward frontier can be skipped. Once it has run off the end the
  // clock is parked on already-skipped picks, which are filled by clicking the
  // cell rather than skipped again.
  if (frontier > total)
    return NextResponse.json({ error: "No pick to skip." }, { status: 409 });

  const { error: insErr } = await sb
    .from("skipped_picks")
    .insert({ draft_id: id, pick_number: frontier });
  // Unique violation just means it's already marked; treat as success.
  if (insErr && insErr.code !== "23505")
    return NextResponse.json({ error: insErr.message }, { status: 500 });

  // A skip always leaves an open pick behind, so the draft can never complete here.
  await sb
    .from("drafts")
    .update({
      current_pick: frontier + 1,
      current_pick_started_at: new Date().toISOString(),
      status: "active",
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
