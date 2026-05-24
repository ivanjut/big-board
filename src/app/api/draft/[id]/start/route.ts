import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { canEdit } from "@/lib/editToken";

export const runtime = "nodejs";

// POST /api/draft/[id]/start — begin the draft and start the clock for pick 1.
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
    .select("status")
    .eq("id", id)
    .single();
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  if (draft.status !== "pending")
    return NextResponse.json({ error: "The draft has already started." }, { status: 409 });

  await sb
    .from("drafts")
    .update({ status: "active", current_pick_started_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
