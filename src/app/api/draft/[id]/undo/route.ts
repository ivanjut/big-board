import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
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

  const db = getDb();
  const [last] = await db`
    select id, pick_number from picks where draft_id = ${id} order by id desc limit 1
  `;

  if (!last) return NextResponse.json({ ok: true, nothingToUndo: true });

  const [draft] = await db`select current_pick from drafts where id = ${id}`;
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  await db`delete from picks where id = ${last.id}`;

  // If this pick was the last one on the forward frontier (nothing was reached
  // beyond it), retreat the frontier so it's back on the clock. Otherwise it was
  // filled out of order — return it to the open/skipped state instead of yanking
  // the clock backwards.
  if (last.pick_number === draft.current_pick - 1) {
    await db`
      update drafts
      set current_pick = ${last.pick_number},
          current_pick_started_at = ${new Date().toISOString()},
          status = 'active'
      where id = ${id}
    `;
  } else {
    await db`
      insert into skipped_picks (draft_id, pick_number)
      values (${id}, ${last.pick_number})
      on conflict (draft_id, pick_number) do nothing
    `;
    await db`
      update drafts
      set current_pick_started_at = ${new Date().toISOString()}, status = 'active'
      where id = ${id}
    `;
  }

  return NextResponse.json({ ok: true });
}
