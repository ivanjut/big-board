import { neon, types, type NeonQueryFunction } from "@neondatabase/serverless";

// Postgres client for server-only use (API routes), backed by Neon over HTTP.
// Each tagged-template call is a stateless one-shot query, which is exactly what
// serverless functions want — no pooled connection to keep warm. Interpolated
// values are sent as bound parameters, so `sql`...${x}`` is injection-safe.
//
// Usage:
//   const db = getDb();
//   const rows = await db`select id from drafts where id = ${id}`;   // -> Row[]
//   await db.query("update picks set slot = $1 where id = any($2)", [slot, ids]);

// int8/bigint (OID 20) comes back as a string by default to avoid precision
// loss. Every bigint id in this app (players, picks, …) is small, so parse them
// as plain numbers — matching what the old PostgREST client returned.
types.setTypeParser(20, (v) => parseInt(v, 10));

let client: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Missing DATABASE_URL env var.");
    client = neon(url);
  }
  return client;
}

// Postgres SQLSTATE for a unique-constraint violation. Thrown as `err.code` by
// the Neon driver, same as node-postgres — used to detect double-drafts, etc.
export const UNIQUE_VIOLATION = "23505";
