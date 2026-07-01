import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { setEditCookie } from "@/lib/editToken";

export const runtime = "nodejs";

// POST /api/draft/[id]/unlock — verify the draft password and grant edit access.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let password = "";
  try {
    password = String((await req.json())?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const db = getDb();
  const [draft] = await db`select password_hash from drafts where id = ${id}`;

  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  const ok = await bcrypt.compare(password, draft.password_hash as string);
  if (!ok) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });

  await setEditCookie(id);
  return NextResponse.json({ ok: true });
}
