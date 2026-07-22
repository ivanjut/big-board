-- Big Board schema (Neon / plain Postgres).
--
-- This is the consolidated, final schema — the flattened result of what used to
-- live under supabase/migrations. There is no row-level security or realtime
-- here: every table is reached only by the Next.js API routes over a single
-- privileged Neon connection, and the browser never talks to Postgres directly.
--
-- Apply with `npm run db:setup` (runs this file, then seeds an empty players
-- table) or `psql "$DATABASE_URL" -f db/schema.sql`.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- players: the searchable player database
--   fantasypros_id is the stable upsert key used by scripts/import-players.mjs;
--   nullable so curated IDP rows (no FantasyPros id) can coexist. rank ascending
--   = best players first, used to order search results.
-- ---------------------------------------------------------------------------
create table if not exists players (
  id             bigint generated always as identity primary key,
  name           text    not null,
  position       text    not null,
  team           text,
  is_idp         boolean not null default false,
  fantasypros_id bigint unique,
  rank           int
);

create index if not exists players_name_trgm_idx on players using gin (name gin_trgm_ops);
create index if not exists players_rank_idx on players (rank);

-- ---------------------------------------------------------------------------
-- drafts: one row per draft instance. New drafts start 'pending' until the
-- commissioner presses Start; status then moves active -> paused/complete.
-- ---------------------------------------------------------------------------
create table if not exists drafts (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  num_slots               int  not null check (num_slots between 2 and 32),
  num_rounds              int  not null check (num_rounds between 1 and 40),
  include_idp             boolean not null default false,
  pick_seconds            int,                          -- null = no time limit
  password_hash           text not null,
  current_pick            int  not null default 1,      -- overall pick number on the clock
  current_pick_started_at timestamptz not null default now(),
  paused_at               timestamptz,                  -- set while status = 'paused'
  status                  text not null default 'pending', -- pending | active | paused | complete
  created_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- draft_members: drafting slots/positions for a draft
-- ---------------------------------------------------------------------------
create table if not exists draft_members (
  id       bigint generated always as identity primary key,
  draft_id uuid not null references drafts(id) on delete cascade,
  slot     int  not null check (slot >= 1),  -- draft position, 1..num_slots
  name     text not null,
  unique (draft_id, slot)
);

-- ---------------------------------------------------------------------------
-- picks: every selection made in a draft. player_name/position/team are
-- denormalized for fast board rendering; slot is the (possibly traded) owner.
-- ---------------------------------------------------------------------------
create table if not exists picks (
  id              bigint generated always as identity primary key,
  draft_id        uuid not null references drafts(id) on delete cascade,
  pick_number     int  not null,      -- overall pick, 1-indexed
  round           int  not null,
  slot            int  not null,      -- which drafting slot made the pick
  player_id       bigint references players(id), -- null for a written-in custom name
  player_name     text not null,
  player_position text,
  player_team     text,
  was_skipped     boolean not null default false, -- filled after being skipped (deferred)
  auto_picked     boolean not null default false, -- made by the auto-pick action
  created_at      timestamptz not null default now(),
  unique (draft_id, pick_number),
  unique (draft_id, player_id)        -- a player can only be drafted once per draft
);

-- Bring pre-existing databases up to the current shape (idempotent).
alter table picks add column if not exists was_skipped boolean not null default false;
alter table picks add column if not exists auto_picked boolean not null default false;
-- player_id is nullable so a commissioner can write in a name not in the DB.
alter table picks alter column player_id drop not null;

create index if not exists picks_draft_idx on picks (draft_id);

-- ---------------------------------------------------------------------------
-- pick_trades: log of pick ownership changes. The current owner of a not-yet-
-- made pick is the latest trade's to_slot, falling back to the snake slot.
-- Rows sharing a transaction_id are one trade.
-- ---------------------------------------------------------------------------
create table if not exists pick_trades (
  id             bigint generated always as identity primary key,
  draft_id       uuid not null references drafts(id) on delete cascade,
  pick_number    int  not null,      -- overall pick being reassigned, 1-indexed
  from_slot      int  not null,      -- owner before this trade
  to_slot        int  not null,      -- owner after this trade
  transaction_id uuid not null default gen_random_uuid(),
  created_at     timestamptz not null default now()
);

create index if not exists pick_trades_draft_idx on pick_trades (draft_id);
create index if not exists pick_trades_txn_idx on pick_trades (transaction_id);

-- ---------------------------------------------------------------------------
-- skipped_picks: picks that were on the clock but deferred. They stay open
-- (returnable cells) until filled out of order, undone, or the draft is reset.
-- ---------------------------------------------------------------------------
create table if not exists skipped_picks (
  id          bigint generated always as identity primary key,
  draft_id    uuid not null references drafts(id) on delete cascade,
  pick_number int  not null,      -- overall pick that was deferred, 1-indexed
  created_at  timestamptz not null default now(),
  unique (draft_id, pick_number)
);

create index if not exists skipped_picks_draft_idx on skipped_picks (draft_id);
