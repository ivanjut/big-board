import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";
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

  const db = getDb();
  const [draft] = await db`
    select num_slots, num_rounds from drafts where id = ${id}
  `;
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
  const madeRows = await db`
    select pick_number from picks
    where draft_id = ${id} and pick_number = any(${allPicks}::int[])
  `;
  const madeSet = new Set(madeRows.map((r) => r.pick_number as number));

  // Current ownership from the trade log, latest-trade-wins.
  const log = await db`
    select pick_number, to_slot, created_at from pick_trades
    where draft_id = ${id} order by created_at, id
  `;
  const owners = buildOwnerMap(
    log.map((t) => ({
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
  // aToB picks move A->B; bToA picks move B->A. One row per pick, all sharing
  // the transaction id so the board can group them into a single trade.
  const pickNums = [...aToB, ...bToA];
  const fromSlots = [...aToB.map(() => teamA), ...bToA.map(() => teamB)];
  const toSlots = [...aToB.map(() => teamB), ...bToA.map(() => teamA)];

  try {
    await db.query(
      `insert into pick_trades (draft_id, transaction_id, pick_number, from_slot, to_slot)
       select $1::uuid, $2::uuid, t.pick_number, t.from_slot, t.to_slot
       from unnest($3::int[], $4::int[], $5::int[]) as t(pick_number, from_slot, to_slot)`,
      [id, transaction_id, pickNums, fromSlots, toSlots],
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to record the trade.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Keep picks.slot (the denormalized owner of a made pick) in sync so any
  // drafted players moved in this trade now belong to their new team.
  const aMade = aToB.filter((n) => madeSet.has(n));
  const bMade = bToA.filter((n) => madeSet.has(n));
  if (aMade.length)
    await db`update picks set slot = ${teamB} where draft_id = ${id} and pick_number = any(${aMade}::int[])`;
  if (bMade.length)
    await db`update picks set slot = ${teamA} where draft_id = ${id} and pick_number = any(${bMade}::int[])`;

  return NextResponse.json({ ok: true });
}
