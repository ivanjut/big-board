import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { setEditCookie } from "@/lib/editToken";

export const runtime = "nodejs";

// POST /api/draft  — create a new draft instance.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const slots = Number(body.numSlots);
  const rounds = Number(body.numRounds);
  const includeIdp = Boolean(body.includeIdp);
  const pickSeconds = body.pickSeconds ? Number(body.pickSeconds) : null;
  const members = Array.isArray(body.members) ? body.members : [];

  if (!name) return NextResponse.json({ error: "Draft name is required." }, { status: 400 });
  if (!password) return NextResponse.json({ error: "A password is required." }, { status: 400 });
  if (!(slots >= 2 && slots <= 32))
    return NextResponse.json({ error: "Number of slots must be between 2 and 32." }, { status: 400 });
  if (!(rounds >= 1 && rounds <= 40))
    return NextResponse.json({ error: "Number of rounds must be between 1 and 40." }, { status: 400 });
  if (pickSeconds !== null && !(pickSeconds > 0 && pickSeconds <= 3600))
    return NextResponse.json({ error: "Pick time limit must be between 1 and 3600 seconds." }, { status: 400 });

  const db = getDb();
  const password_hash = await bcrypt.hash(password, 10);

  let draftId: string;
  try {
    const [draft] = await db`
      insert into drafts (name, num_slots, num_rounds, include_idp, pick_seconds, password_hash)
      values (${name}, ${slots}, ${rounds}, ${includeIdp}, ${pickSeconds}, ${password_hash})
      returning id
    `;
    draftId = draft.id as string;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create draft.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // One member row per slot, defaulting blank names to "Team N".
  const slotNums = Array.from({ length: slots }, (_, i) => i + 1);
  const names = slotNums.map((slot, i) => {
    const m = (members[i] ?? {}) as { name?: string };
    return (m.name && String(m.name).trim()) || `Team ${slot}`;
  });
  try {
    await db.query(
      `insert into draft_members (draft_id, slot, name)
       select $1::uuid, s.slot, s.name
       from unnest($2::int[], $3::text[]) as s(slot, name)`,
      [draftId, slotNums, names],
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to add members.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // The creator (commissioner) is unlocked for editing immediately.
  await setEditCookie(draftId);
  return NextResponse.json({ id: draftId });
}
