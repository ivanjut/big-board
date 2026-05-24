import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseServer";
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

  const sb = supabaseAdmin();
  const password_hash = await bcrypt.hash(password, 10);

  const { data: draft, error } = await sb
    .from("drafts")
    .insert({
      name,
      num_slots: slots,
      num_rounds: rounds,
      include_idp: includeIdp,
      pick_seconds: pickSeconds,
      password_hash,
    })
    .select("id")
    .single();

  if (error || !draft) {
    return NextResponse.json({ error: error?.message ?? "Failed to create draft." }, { status: 500 });
  }

  const memberRows = Array.from({ length: slots }, (_, i) => {
    const m = (members[i] ?? {}) as { name?: string };
    return {
      draft_id: draft.id as string,
      slot: i + 1,
      name: (m.name && String(m.name).trim()) || `Team ${i + 1}`,
    };
  });

  const { error: mErr } = await sb.from("draft_members").insert(memberRows);
  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  // The creator (commissioner) is unlocked for editing immediately.
  await setEditCookie(draft.id as string);
  return NextResponse.json({ id: draft.id });
}
