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
- **Live sharing** — view-only via Supabase Realtime; editing is unlocked with the draft
  password (server-checked, signed cookie).

## Tech stack

- [Next.js](https://nextjs.org) (App Router, TypeScript) + Tailwind CSS
- [Supabase](https://supabase.com) (Postgres + Realtime), run locally via the Supabase CLI + Docker

All writes go through Next.js API routes using the Supabase service role; the browser
only reads and subscribes to Realtime.

## Local development

Requires **Node 20+**, the **Supabase CLI**, and **Docker**.

```bash
# 1. Install dependencies
npm install

# 2. Start the local Supabase stack (Postgres + Realtime)
supabase start

# 3. Create .env.local from the printed credentials
supabase status -o env   # copy API URL + anon/service keys into .env.local
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#   SUPABASE_SERVICE_ROLE_KEY, and a random EDIT_TOKEN_SECRET

# 4. Apply the schema and seed the player database
supabase db reset

# 5. Run the dev server
npm run dev          # http://localhost:3000
```

`.env.local` is gitignored.

## Roadmap

See [`.claude/TODO.md`](./.claude/TODO.md) — notably a configurable draft type (snake vs.
auction) and a real player-data source (the current player list is a curated sample).
