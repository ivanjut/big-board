// Refresh the player pool from FantasyPros rankings.
//
// Pulls the half-point-PPR draft cheatsheet, which embeds its data as a
// `var ecrData = {...}` blob, and upserts every player into public.players keyed
// by their FantasyPros id. Re-running updates teams/positions/ranks in place
// (ids stay stable, so existing picks keep working) and prunes players who have
// dropped off the rankings — except any that are already drafted, which are kept
// so the foreign key from picks never breaks. Curated IDP rows (is_idp = true)
// are left untouched; FantasyPros' half-PPR cheatsheet doesn't include them.
//
// Usage:
//   node scripts/import-players.mjs            # refresh from the default source
//   node scripts/import-players.mjs --dry-run  # fetch + report, write nothing
//   FANTASYPROS_URL=... node scripts/import-players.mjs   # override the source
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

// Minimal PostgREST client over fetch. Using the REST API directly (instead of
// @supabase/supabase-js) keeps this script free of the realtime/WebSocket
// dependency that supabase-js needs but Node < 22 doesn't provide natively.
function makeRest(supabaseUrl, key) {
  const base = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  const headers = (extra = {}) => ({
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  });
  return {
    // Paginated read that walks past PostgREST's max-rows cap.
    async getAll(path) {
      const page = 1000;
      const all = [];
      for (let from = 0; ; from += page) {
        const res = await fetch(`${base}/${path}`, {
          headers: headers({ Range: `${from}-${from + page - 1}`, "Range-Unit": "items" }),
        });
        if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}: ${await res.text()}`);
        const batch = await res.json();
        all.push(...batch);
        if (batch.length < page) return all;
      }
    },
    async upsert(table, rows, onConflict) {
      const res = await fetch(`${base}/${table}?on_conflict=${onConflict}`, {
        method: "POST",
        headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error(`Upsert ${table} -> HTTP ${res.status}: ${await res.text()}`);
    },
    async deleteIn(table, col, ids) {
      const res = await fetch(`${base}/${table}?${col}=in.(${ids.join(",")})`, {
        method: "DELETE",
        headers: headers({ Prefer: "return=minimal" }),
      });
      if (!res.ok) throw new Error(`Delete ${table} -> HTTP ${res.status}: ${await res.text()}`);
    },
    async count(table) {
      const res = await fetch(`${base}/${table}?select=id`, {
        headers: headers({ Prefer: "count=exact", Range: "0-0" }),
      });
      const cr = res.headers.get("content-range");
      return cr ? Number(cr.split("/")[1]) : null;
    },
  };
}

async function main() {
  const env = { ...loadEnv(), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set them in .env.local).",
    );
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

  const rest = makeRest(url, key);

  // Upsert in chunks, keyed by the stable FantasyPros id.
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await rest.upsert("players", chunk, "fantasypros_id");
    upserted += chunk.length;
  }
  console.log(`Upserted ${upserted} players.`);

  // Prune stale non-IDP players: any without a current FantasyPros id (old seed
  // rows, or players who fell off the rankings) that aren't already drafted.
  const importedIds = new Set(rows.map((r) => r.fantasypros_id));
  const referenced = new Set((await rest.getAll("picks?select=player_id")).map((r) => r.player_id));
  const existing = await rest.getAll("players?select=id,fantasypros_id&is_idp=eq.false");

  const toDelete = existing
    .filter((p) => !(p.fantasypros_id != null && importedIds.has(Number(p.fantasypros_id))))
    .filter((p) => !referenced.has(p.id))
    .map((p) => p.id);

  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    await rest.deleteIn("players", "id", toDelete.slice(i, i + CHUNK));
    deleted += Math.min(CHUNK, toDelete.length - i);
  }
  console.log(`Pruned ${deleted} stale non-IDP players (drafted players kept).`);

  console.log(`Done. players now holds ${await rest.count("players")} rows.`);
}

main().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
