import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { canEdit } from "@/lib/editToken";

export const runtime = "nodejs";

// POST /api/draft/[id]/resume — unfreeze the clock, continuing from where it stopped.
// Shifts current_pick_started_at forward by the paused duration so no time is lost.
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
    .select("status,current_pick_started_at,paused_at")
    .eq("id", id)
    .single();
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  if (draft.status !== "paused")
    return NextResponse.json({ error: "The draft isn't paused." }, { status: 409 });

  const pausedMs = draft.paused_at ? new Date(draft.paused_at).getTime() : Date.now();
  const startedMs = new Date(draft.current_pick_started_at).getTime();
  const pauseDuration = Math.max(0, Date.now() - pausedMs);
  const shiftedStart = new Date(startedMs + pauseDuration).toISOString();

  await sb
    .from("drafts")
    .update({ status: "active", current_pick_started_at: shiftedStart, paused_at: null })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
