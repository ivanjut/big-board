import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { canEdit } from "@/lib/editToken";
import { buildOwnerMap, effectiveOwnerSlot, totalPicks } from "@/lib/draftLogic";

export const runtime = "nodejs";

// POST /api/draft/[id]/trade
//   { teamA, teamB, aToB: number[], bToA: number[] }
// Swap a set of not-yet-made picks between two teams, recorded as one trade.
// aToB are picks team A currently owns that go to B; bToA the reverse.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await canEdit(id)))
    return NextResponse.json({ error: "Not authorized to edit this draft." }, { status: 403 });

  let teamA: number;
  let teamB: number;
  let aToB: number[];
  let bToA: number[];
  try {
    const body = await req.json();
    teamA = Number(body?.teamA);
    teamB = Number(body?.teamB);
    aToB = (Array.isArray(body?.aToB) ? body.aToB : []).map(Number);
    bToA = (Array.isArray(body?.bToA) ? body.bToA : []).map(Number);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Number.isInteger(teamA) || !Number.isInteger(teamB))
    return NextResponse.json({ error: "Two teams are required." }, { status: 400 });
  if (teamA === teamB)
    return NextResponse.json({ error: "Pick two different teams." }, { status: 400 });
  if (!aToB.every(Number.isInteger) || !bToA.every(Number.isInteger))
    return NextResponse.json({ error: "Invalid pick selection." }, { status: 400 });
  if (aToB.length + bToA.length === 0)
    return NextResponse.json({ error: "Select at least one pick to trade." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: draft } = await sb
    .from("drafts")
    .select("num_slots,num_rounds")
    .eq("id", id)
    .single();
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  if (teamA < 1 || teamA > draft.num_slots || teamB < 1 || teamB > draft.num_slots)
    return NextResponse.json({ error: "That team doesn't exist." }, { status: 400 });

  const total = totalPicks(draft.num_slots, draft.num_rounds);
  const allPicks = [...aToB, ...bToA];
  if (new Set(allPicks).size !== allPicks.length)
    return NextResponse.json({ error: "A pick can't be on both sides of a trade." }, { status: 400 });
  if (allPicks.some((n) => n < 1 || n > total))
    return NextResponse.json({ error: "A selected pick is out of range." }, { status: 400 });

  // Drafted players trade too: a made pick is reassigned the same way (its pick
  // number moves teams). Track which selected picks are already made so we can
  // keep the denormalized picks.slot owner column in sync below.
  const { data: madeRows } = await sb
    .from("picks")
    .select("pick_number")
    .eq("draft_id", id)
    .in("pick_number", allPicks);
  const madeSet = new Set((madeRows ?? []).map((r) => r.pick_number));

  // Current ownership from the trade log, latest-trade-wins.
  const { data: log } = await sb
    .from("pick_trades")
    .select("pick_number,to_slot,created_at")
    .eq("draft_id", id)
    .order("created_at")
    .order("id");
  const owners = buildOwnerMap(
    (log ?? []).map((t) => ({
      transactionId: "",
      pickNumber: t.pick_number,
      fromSlot: 0,
      toSlot: t.to_slot,
      createdAt: t.created_at,
    })),
  );
  const ownerOf = (n: number) => effectiveOwnerSlot(n, draft.num_slots, owners);

  // Each pick must currently belong to the team sending it.
  if (aToB.some((n) => ownerOf(n) !== teamA) || bToA.some((n) => ownerOf(n) !== teamB))
    return NextResponse.json(
      { error: "A selected pick is no longer owned by that team." },
      { status: 409 },
    );

  const transaction_id = crypto.randomUUID();
  const rows = [
    ...aToB.map((pick_number) => ({
      draft_id: id,
      transaction_id,
      pick_number,
      from_slot: teamA,
      to_slot: teamB,
    })),
    ...bToA.map((pick_number) => ({
      draft_id: id,
      transaction_id,
      pick_number,
      from_slot: teamB,
      to_slot: teamA,
    })),
  ];

  const { error: insErr } = await sb.from("pick_trades").insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Keep picks.slot (the denormalized owner of a made pick) in sync so any
  // drafted players moved in this trade now belong to their new team.
  const aMade = aToB.filter((n) => madeSet.has(n));
  const bMade = bToA.filter((n) => madeSet.has(n));
  if (aMade.length)
    await sb.from("picks").update({ slot: teamB }).eq("draft_id", id).in("pick_number", aMade);
  if (bMade.length)
    await sb.from("picks").update({ slot: teamA }).eq("draft_id", id).in("pick_number", bMade);

  return NextResponse.json({ ok: true });
}
