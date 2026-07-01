// Refresh the player pool from FantasyPros rankings.
//
// Pulls the half-point-PPR draft cheatsheet, which embeds its data as a
// `var ecrData = {...}` blob, and upserts every player into the players table
// keyed by their FantasyPros id. Re-running updates teams/positions/ranks in
// place (ids stay stable, so existing picks keep working) and prunes players who
// have dropped off the rankings — except any that are already drafted, which are
// kept so the foreign key from picks never breaks. Curated IDP rows (is_idp =
// true) are left untouched; FantasyPros' half-PPR cheatsheet doesn't include them.
//
// Usage:
//   node scripts/import-players.mjs            # refresh from the default source
//   node scripts/import-players.mjs --dry-run  # fetch + report, write nothing
//   FANTASYPROS_URL=... node scripts/import-players.mjs   # override the source
//
// Reads DATABASE_URL from .env.local (or the environment).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon, types } from "@neondatabase/serverless";

// Parse int8/bigint (OID 20) as a plain number; every id here is small.
types.setTypeParser(20, (v) => parseInt(v, 10));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_URL =
  process.env.FANTASYPROS_URL ||
  "https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php";
const DRY_RUN = process.argv.includes("--dry-run");

// Below this many parsed players we assume the fetch was blocked or truncated
// and bail out rather than wiping the pool with partial data.
const MIN_EXPECTED = 100;
const CHUNK = 500;

function loadEnv() {
  const out = {};
  let text;
  try {
    text = readFileSync(join(ROOT, ".env.local"), "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

// FantasyPros serves an empty body to header-less clients, so look like a browser.
async function fetchEcrData(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status} from ${url}`);
  const html = await res.text();
  const marker = "var ecrData";
  const start = html.indexOf(marker);
  if (start === -1)
    throw new Error(
      "Could not find `var ecrData` in the page — the source format may have changed or the request was blocked.",
    );
  // Walk from the first `{` after the marker, balancing braces (and skipping
  // string literals) so values containing braces can't truncate the match.
  const open = html.indexOf("{", start);
  let depth = 0,
    inStr = false,
    quote = "",
    esc = false,
    end = -1;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) inStr = false;
    } else if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      end = i + 1;
      break;
    }
  }
  if (end === -1) throw new Error("Could not parse the ecrData object (unbalanced braces).");
  return JSON.parse(html.slice(open, end));
}

function toRows(ecr) {
  const seen = new Set();
  const rows = [];
  for (const p of ecr.players ?? []) {
    const fpId = Number(p.player_id);
    const name = (p.player_name ?? "").trim();
    const position = (p.player_position_id ?? "").trim().toUpperCase();
    if (!fpId || !name || !position || seen.has(fpId)) continue;
    seen.add(fpId);
    const team = p.player_team_id && p.player_team_id !== "FA" ? p.player_team_id : null;
    const rank = Number(p.rank_ecr) || null;
    rows.push({ fantasypros_id: fpId, name, position, team, rank, is_idp: false });
  }
  return rows;
}

// Upsert a chunk of players by their stable FantasyPros id, updating name/team/
// position/rank in place. Columns are passed as parallel arrays and zipped with
// unnest, so it's a single round-trip per chunk.
async function upsertChunk(sql, chunk) {
  await sql.query(
    `insert into players (fantasypros_id, name, position, team, rank, is_idp)
     select * from unnest(
       $1::bigint[], $2::text[], $3::text[], $4::text[], $5::int[], $6::boolean[]
     )
     on conflict (fantasypros_id) do update set
       name = excluded.name,
       position = excluded.position,
       team = excluded.team,
       rank = excluded.rank`,
    [
      chunk.map((r) => r.fantasypros_id),
      chunk.map((r) => r.name),
      chunk.map((r) => r.position),
      chunk.map((r) => r.team),
      chunk.map((r) => r.rank),
      chunk.map((r) => r.is_idp),
    ],
  );
}

async function main() {
  const env = { ...loadEnv(), ...process.env };
  const url = env.DATABASE_URL;
  if (!url) {
    console.error("Missing DATABASE_URL (set it in .env.local or the environment).");
    process.exit(1);
  }

  console.log(`Fetching ${SOURCE_URL} ...`);
  const ecr = await fetchEcrData(SOURCE_URL);
  const rows = toRows(ecr);
  const byPos = rows.reduce((m, r) => ((m[r.position] = (m[r.position] || 0) + 1), m), {});
  console.log(
    `Parsed ${rows.length} players (${ecr.scoring ?? "?"} ${ecr.year ?? "?"}, updated ${ecr.last_updated ?? "?"}).`,
  );
  console.log("By position:", byPos);

  if (rows.length < MIN_EXPECTED)
    throw new Error(
      `Only ${rows.length} players parsed (<${MIN_EXPECTED}); refusing to overwrite the pool.`,
    );

  if (DRY_RUN) {
    console.log("--dry-run: no database changes made.");
    return;
  }

  const sql = neon(url);

  // Upsert in chunks, keyed by the stable FantasyPros id.
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await upsertChunk(sql, chunk);
    upserted += chunk.length;
  }
  console.log(`Upserted ${upserted} players.`);

  // Prune stale non-IDP players: any without a current FantasyPros id (old seed
  // rows, or players who fell off the rankings) that aren't already drafted.
  const importedIds = new Set(rows.map((r) => r.fantasypros_id));
  const referenced = new Set((await sql`select player_id from picks`).map((r) => r.player_id));
  const existing = await sql`select id, fantasypros_id from players where is_idp = false`;

  const toDelete = existing
    .filter((p) => !(p.fantasypros_id != null && importedIds.has(Number(p.fantasypros_id))))
    .filter((p) => !referenced.has(p.id))
    .map((p) => p.id);

  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const chunk = toDelete.slice(i, i + CHUNK);
    await sql.query(`delete from players where id = any($1::bigint[])`, [chunk]);
    deleted += chunk.length;
  }
  console.log(`Pruned ${deleted} stale non-IDP players (drafted players kept).`);

  const [{ n }] = await sql`select count(*)::int as n from players`;
  console.log(`Done. players now holds ${n} rows.`);
}

main().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
