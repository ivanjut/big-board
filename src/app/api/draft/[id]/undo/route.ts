import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { canEdit } from "@/lib/editToken";

export const runtime = "nodejs";

// POST /api/draft/[id]/undo — reverse the most recently made pick.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await canEdit(id)))
    return NextResponse.json({ error: "Not authorized to edit this draft." }, { status: 403 });

  const sb = supabaseAdmin();
  const { data: last } = await sb
    .from("picks")
    .select("id,pick_number")
    .eq("draft_id", id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) return NextResponse.json({ ok: true, nothingToUndo: true });

  const { data: draft } = await sb
    .from("drafts")
    .select("current_pick")
    .eq("id", id)
    .single();
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  await sb.from("picks").delete().eq("id", last.id);

  // If this pick was the last one on the forward frontier (nothing was reached
  // beyond it), retreat the frontier so it's back on the clock. Otherwise it was
  // filled out of order — return it to the open/skipped state instead of yanking
  // the clock backwards.
  if (last.pick_number === draft.current_pick - 1) {
    await sb
      .from("drafts")
      .update({
        current_pick: last.pick_number,
        current_pick_started_at: new Date().toISOString(),
        status: "active",
      })
      .eq("id", id);
  } else {
    await sb
      .from("skipped_picks")
      .upsert(
        { draft_id: id, pick_number: last.pick_number },
        { onConflict: "draft_id,pick_number", ignoreDuplicates: true },
      );
    await sb
      .from("drafts")
      .update({ current_pick_started_at: new Date().toISOString(), status: "active" })
      .eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
