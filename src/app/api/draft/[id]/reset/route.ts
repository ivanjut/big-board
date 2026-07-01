import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { canEdit } from "@/lib/editToken";

export const runtime = "nodejs";

// POST /api/draft/[id]/reset — clear all picks and skips, return to pick 1.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await canEdit(id)))
    return NextResponse.json({ error: "Not authorized to edit this draft." }, { status: 403 });

  const db = getDb();
  await db`delete from picks where draft_id = ${id}`;
  await db`delete from skipped_picks where draft_id = ${id}`;
  await db`
    update drafts
    set current_pick = 1, current_pick_started_at = ${new Date().toISOString()}, status = 'active'
    where id = ${id}
  `;

  return NextResponse.json({ ok: true });
}
