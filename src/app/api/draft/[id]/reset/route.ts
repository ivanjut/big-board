import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { canEdit } from "@/lib/editToken";

export const runtime = "nodejs";

// POST /api/draft/[id]/reset — clear all picks and return to pick 1.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await canEdit(id)))
    return NextResponse.json({ error: "Not authorized to edit this draft." }, { status: 403 });

  const sb = supabaseAdmin();
  await sb.from("picks").delete().eq("draft_id", id);
  await sb
    .from("drafts")
    .update({
      current_pick: 1,
      current_pick_started_at: new Date().toISOString(),
      status: "active",
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
