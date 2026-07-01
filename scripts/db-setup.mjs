// Apply the Big Board schema to a Neon (or any) Postgres database, then seed the
// players table if it's empty.
//
// Usage:
//   node scripts/db-setup.mjs              # create tables (idempotent), seed if empty
//   node scripts/db-setup.mjs --reset      # drop every app table first, then recreate + seed
//   node scripts/db-setup.mjs --skip-seed  # schema only, don't touch players
//
// Reads DATABASE_URL from .env.local (or the environment). Uses the Neon
// WebSocket client so a whole multi-statement .sql file runs in one call.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Node < 22 has no global WebSocket; the Neon socket client needs one.
neonConfig.webSocketConstructor = ws;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESET = process.argv.includes("--reset");
const SKIP_SEED = process.argv.includes("--skip-seed");

// App tables in dependency order (children first) for a clean --reset drop.
const TABLES = ["pick_trades", "skipped_picks", "picks", "draft_members", "drafts", "players"];

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

async function main() {
  const env = { ...loadEnv(), ...process.env };
  const url = env.DATABASE_URL;
  if (!url) {
    console.error("Missing DATABASE_URL (set it in .env.local or the environment).");
    process.exit(1);
  }

  const schema = readFileSync(join(ROOT, "db", "schema.sql"), "utf8");
  const seed = readFileSync(join(ROOT, "db", "seed.sql"), "utf8");

  const client = new Client(url);
  await client.connect();
  try {
    if (RESET) {
      console.log("Dropping existing tables (--reset) ...");
      await client.query(`drop table if exists ${TABLES.join(", ")} cascade`);
    }

    console.log("Applying db/schema.sql ...");
    await client.query(schema);

    if (SKIP_SEED) {
      console.log("--skip-seed: leaving players untouched.");
    } else {
      const { rows } = await client.query("select count(*)::int as n from players");
      if (rows[0].n > 0) {
        console.log(`players already has ${rows[0].n} rows — skipping seed.`);
      } else {
        console.log("Seeding players from db/seed.sql ...");
        await client.query(seed);
        const { rows: after } = await client.query("select count(*)::int as n from players");
        console.log(`Seeded ${after[0].n} players.`);
      }
    }
    console.log("Done.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
