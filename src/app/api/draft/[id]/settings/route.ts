import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { canEdit } from "@/lib/editToken";
import { totalPicks } from "@/lib/draftLogic";

export const runtime = "nodejs";

type MemberInput = { slot: number; name?: string };

// PATCH /api/draft/[id]/settings — update a live draft's configuration.
// Scalar fields are always editable; structural changes (slot count) are blocked
// once picks exist, and rounds can't shrink below the deepest drafted round.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await canEdit(id)))
    return NextResponse.json({ error: "Not authorized to edit this draft." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: draft } = await sb
    .from("drafts")
    .select("num_slots,num_rounds,current_pick,status")
    .eq("id", id)
    .single();
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  const { data: picks } = await sb
    .from("picks")
    .select("round")
    .eq("draft_id", id);
  const pickCount = picks?.length ?? 0;
  const maxDraftedRound = picks?.reduce((m, p) => Math.max(m, p.round), 0) ?? 0;

  const update: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Draft name can't be empty." }, { status: 400 });
    update.name = name;
  }

  if (typeof body.includeIdp === "boolean") update.include_idp = body.includeIdp;

  if ("pickSeconds" in body) {
    const ps = body.pickSeconds === null ? null : Number(body.pickSeconds);
    if (ps !== null && !(ps > 0 && ps <= 3600))
      return NextResponse.json({ error: "Pick time limit must be 1–3600 seconds." }, { status: 400 });
    update.pick_seconds = ps;
  }

  let finalRounds = draft.num_rounds;
  if (body.numRounds != null) {
    const rounds = Number(body.numRounds);
    if (!(rounds >= 1 && rounds <= 40))
      return NextResponse.json({ error: "Rounds must be between 1 and 40." }, { status: 400 });
    if (rounds < maxDraftedRound)
      return NextResponse.json(
        { error: `Can't set rounds below ${maxDraftedRound} — picks already exist there.` },
        { status: 409 },
      );
    finalRounds = rounds;
    update.num_rounds = rounds;
  }

  let finalSlots = draft.num_slots;
  if (body.numSlots != null) {
    const slots = Number(body.numSlots);
    if (!(slots >= 2 && slots <= 32))
      return NextResponse.json({ error: "Slots must be between 2 and 32." }, { status: 400 });
    if (slots !== draft.num_slots && pickCount > 0)
      return NextResponse.json(
        { error: "Can't change the number of slots after picks have been made." },
        { status: 409 },
      );
    finalSlots = slots;
    update.num_slots = slots;
  }

  // Drop any skipped picks that fall outside a now-smaller board so they don't
  // keep the draft from ever completing.
  const total = totalPicks(finalSlots, finalRounds);
  await sb.from("skipped_picks").delete().eq("draft_id", id).gt("pick_number", total);
  const { count: openSkips } = await sb
    .from("skipped_picks")
    .select("id", { count: "exact", head: true })
    .eq("draft_id", id);

  // Keep status consistent if the board size changed for a started draft.
  // (Leave 'pending' and 'paused' drafts in their current state.) The draft is
  // only complete once the frontier has run off the end and no skips remain.
  if (draft.status === "active" || draft.status === "complete") {
    update.status =
      draft.current_pick > total && (openSkips ?? 0) === 0 ? "complete" : "active";
  }

  if (Object.keys(update).length > 0) {
    const { error } = await sb.from("drafts").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Members: upsert names by slot, then drop any beyond the slot count.
  if (Array.isArray(body.members)) {
    const rows = (body.members as MemberInput[])
      .filter((m) => Number(m.slot) >= 1 && Number(m.slot) <= finalSlots)
      .map((m, i) => ({
        draft_id: id,
        slot: Number(m.slot),
        name: (m.name && String(m.name).trim()) || `Team ${m.slot ?? i + 1}`,
      }));
    if (rows.length) {
      const { error } = await sb
        .from("draft_members")
        .upsert(rows, { onConflict: "draft_id,slot" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await sb.from("draft_members").delete().eq("draft_id", id).gt("slot", finalSlots);
  }

  return NextResponse.json({ ok: true });
}
