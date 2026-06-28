import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// GET /api/draft/[id]/search?q=... — fuzzy player search scoped to a draft.
// Filters out IDPs when the draft excludes them and players already drafted.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const raw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  // Strip SQL-LIKE wildcards so user input can't change the match semantics.
  const q = raw.replace(/[%_]/g, "");
  if (q.length < 2) return NextResponse.json({ results: [] });

  const sb = supabaseAdmin();
  const { data: draft } = await sb
    .from("drafts")
    .select("include_idp")
    .eq("id", id)
    .single();
  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  const { data: drafted } = await sb
    .from("picks")
    .select("player_id")
    .eq("draft_id", id);
  const draftedIds = new Set((drafted ?? []).map((d) => d.player_id));

  // Order by rank in the query so the limited window keeps the best-ranked
  // matches (the pool is hundreds deep). Unranked players (e.g. IDPs) sort last.
  let query = sb
    .from("players")
    .select("id,name,position,team,is_idp,rank")
    .ilike("name", `%${q}%`)
    .order("rank", { ascending: true, nullsFirst: false })
    .limit(40);
  if (!draft.include_idp) query = query.eq("is_idp", false);

  const { data: players, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lower = q.toLowerCase();
  const results = (players ?? [])
    .filter((p) => !draftedIds.has(p.id))
    .sort((a, b) => {
      // Prefer names that start with the query, then better (lower) rank, then
      // shorter names as a final tiebreak.
      const aStarts = a.name.toLowerCase().startsWith(lower) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(lower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      const ar = a.rank ?? Number.MAX_SAFE_INTEGER;
      const br = b.rank ?? Number.MAX_SAFE_INTEGER;
      if (ar !== br) return ar - br;
      return a.name.length - b.name.length;
    })
    .slice(0, 12)
    .map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      team: p.team,
      isIdp: p.is_idp,
    }));

  return NextResponse.json({ results });
}
