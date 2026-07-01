import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { canEdit } from "@/lib/editToken";

export const runtime = "nodejs";

// POST /api/draft/[id]/pause — freeze the current pick's clock.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await canEdit(id)))
    return NextResponse.json({ error: "Not authorized to edit this draft." }, { status: 403 });

  const db = getDb();
  const [draft] = await db`select status from drafts where id = ${id}`;
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  if (draft.status !== "active")
    return NextResponse.json({ error: "Only an active draft can be paused." }, { status: 409 });

  await db`
    update drafts set status = 'paused', paused_at = ${new Date().toISOString()} where id = ${id}
  `;

  return NextResponse.json({ ok: true });
}
