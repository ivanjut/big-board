import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { canEdit } from "@/lib/editToken";

export const runtime = "nodejs";

// POST /api/draft/[id]/undo — remove the most recent pick.
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
    .order("pick_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) return NextResponse.json({ ok: true, nothingToUndo: true });

  await sb.from("picks").delete().eq("id", last.id);
  await sb
    .from("drafts")
    .update({
      current_pick: last.pick_number,
      current_pick_started_at: new Date().toISOString(),
      status: "active",
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
