# 🏈 Big Board

A web app for running **offline (in-person) fantasy football drafts**. A commissioner
inputs picks on a shared draft board; everyone else opens the draft's link and watches
live in view-only mode. Works on desktop and phone.

## Features

- **Create a draft** — name, slots, rounds, IDP toggle, optional per-pick timer, and an
  ordered member list with positions. Password-protected.
- **Draft board** — members across the top, one row per round, pick numbers in every
  cell, on-the-clock cell highlighted; horizontally scrollable on mobile.
- **Fuzzy player search** — e.g. `bij` / `rob` → Bijan Robinson. IDPs hidden unless
  enabled; drafted players drop out of results.
- **Run the draft** — Start, Pause/Resume (freezes the clock), Pick, Undo, and Reset.
  The pick timer counts down and then into red "over" time.
- **Trade picks** — the commissioner can swap any not-yet-made picks between two teams in
  a single transaction. The board shows each pick under its current owner (with a "traded"
  badge), the on-the-clock team follows the effective owner, and a grouped trade history is
  available to everyone.
- **Edit settings live** — the commissioner can adjust name, rounds, timer, IDPs, and
  member names/positions mid-draft (with guards once picks exist).
- **Live sharing** — view-only board that refreshes by polling; editing is unlocked with
  the draft password (server-checked, signed cookie).

## Tech stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) + Tailwind CSS
- [Neon](https://neon.tech) Postgres (serverless driver, `@neondatabase/serverless`),
  provisioned through the [Vercel](https://vercel.com) Marketplace
- Deployed on Vercel

All writes go through Next.js API routes over a single privileged Neon connection; the
browser only reads (via those routes) and polls `/api/draft/[id]/state` for live updates.
There is no separate realtime service.

## Local development

Requires **Node 20+** and a **Neon Postgres database** (create one free via the Vercel
dashboard → Storage → Neon, or at [neon.tech](https://neon.tech)).

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local (see .env.example) and paste your Neon connection string:
#      DATABASE_URL="postgresql://…@ep-….neon.tech/neondb?sslmode=require"   (Pooled)
#      EDIT_TOKEN_SECRET="<random hex>"   (node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 3. Create the schema and seed a sample player pool
npm run db:setup

# 4. Load real player rankings (FantasyPros half-PPR). Optional — db:setup seeds a
#    sample pool — but recommended for a real, current player list.
npm run import:players

# 5. Run the dev server
npm run dev          # http://localhost:3000
```

`.env.local` is gitignored; `.env.example` documents the required variables.

**Schema management.** `npm run db:setup` applies [`db/schema.sql`](./db/schema.sql) and
seeds [`db/seed.sql`](./db/seed.sql) if the players table is empty. It's idempotent
(safe to re-run). Use `npm run db:setup -- --reset` for a clean slate (drops every app
table first — wipes drafts) or `-- --skip-seed` to leave players untouched. You can also
apply the schema directly with `psql "$DATABASE_URL" -f db/schema.sql`.

> **Refreshing the player pool.** `npm run import:players` pulls the current
> [FantasyPros half-PPR rankings](https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php)
> and upserts them into `players` (keyed by a stable FantasyPros id, so re-running
> updates ranks/teams in place rather than duplicating). Run it any time to refresh. It
> prunes players who fell off the rankings, but keeps anyone already drafted so in-progress
> drafts never break. For a pristine pool with no leftover sample rows, run
> `npm run db:setup -- --reset && npm run import:players` (this wipes drafts). Add
> `--dry-run` to preview without writing. IDPs aren't in the half-PPR source, so the
> curated IDP list from the seed is left untouched.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel (**New Project**).
2. In the project's **Storage** tab, create/attach a **Neon** database. Vercel injects
   `DATABASE_URL` into the project's environment automatically.
3. Add **`EDIT_TOKEN_SECRET`** under **Settings → Environment Variables** (a random hex
   string). Redeploy so it takes effect.
4. Run the schema against the production database once — either
   `DATABASE_URL="<prod url>" npm run db:setup` locally, or `psql "<prod url>" -f
   db/schema.sql`. Optionally `npm run import:players` with the prod URL for live rankings.

## Troubleshooting

**`POST /api/draft` (or any API route) returns 500.** Usually `DATABASE_URL` is missing
or wrong. Confirm it's set in `.env.local` (local) or the Vercel project (prod), that it's
the **Pooled** Neon connection string, and that the schema has been applied
(`npm run db:setup`). Quick connectivity check:

```bash
node -e "import('@neondatabase/serverless').then(({neon})=>neon(process.env.DATABASE_URL)\`select 1 as ok\`.then(r=>console.log(r)).catch(e=>console.error(e.message)))"
```

## Roadmap

See [`.claude/TODO.md`](./.claude/TODO.md) — notably a configurable draft type (snake vs.
auction) and a real player-data source (the current player list is a curated sample).
