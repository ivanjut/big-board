import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
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

  const db = getDb();
  const [draft] = await db`
    select num_slots, num_rounds, current_pick, status from drafts where id = ${id}
  `;
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

  // A unique violation just means it's already marked; on conflict do nothing
  // treats that as success.
  try {
    await db`
      insert into skipped_picks (draft_id, pick_number)
      values (${id}, ${frontier})
      on conflict (draft_id, pick_number) do nothing
    `;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to skip the pick.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // A skip always leaves an open pick behind, so the draft can never complete here.
  await db`
    update drafts
    set current_pick = ${frontier + 1},
        current_pick_started_at = ${new Date().toISOString()},
        status = 'active'
    where id = ${id}
  `;

  return NextResponse.json({ ok: true });
}
