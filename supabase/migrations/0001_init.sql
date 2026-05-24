-- ff-draft initial schema
-- Tables: players (seeded, public read), drafts (server-only), draft_members, picks (public read + realtime).
-- All client-side writes are blocked by RLS; mutations go through Next.js API routes using the service role.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- players: the searchable player database
-- ---------------------------------------------------------------------------
create table public.players (
  id        bigint generated always as identity primary key,
  name      text    not null,
  position  text    not null,
  team      text,
  is_idp    boolean not null default false
);

create index players_name_trgm_idx on public.players using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- drafts: one row per draft instance (never exposed directly to the browser)
-- ---------------------------------------------------------------------------
create table public.drafts (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  num_slots               int  not null check (num_slots between 2 and 32),
  num_rounds              int  not null check (num_rounds between 1 and 40),
  include_idp             boolean not null default false,
  pick_seconds            int,                          -- null = no time limit
  password_hash           text not null,
  current_pick            int  not null default 1,      -- overall pick number on the clock
  current_pick_started_at timestamptz not null default now(),
  status                  text not null default 'active', -- active | complete
  created_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- draft_members: drafting slots/positions for a draft
-- ---------------------------------------------------------------------------
create table public.draft_members (
  id       bigint generated always as identity primary key,
  draft_id uuid not null references public.drafts(id) on delete cascade,
  slot     int  not null check (slot >= 1),  -- draft position, 1..num_slots
  name     text not null,
  unique (draft_id, slot)
);

-- ---------------------------------------------------------------------------
-- picks: every selection made in a draft
-- ---------------------------------------------------------------------------
create table public.picks (
  id              bigint generated always as identity primary key,
  draft_id        uuid not null references public.drafts(id) on delete cascade,
  pick_number     int  not null,      -- overall pick, 1-indexed
  round           int  not null,
  slot            int  not null,      -- which drafting slot made the pick
  player_id       bigint not null references public.players(id),
  player_name     text not null,      -- denormalized for fast board rendering
  player_position text,
  created_at      timestamptz not null default now(),
  unique (draft_id, pick_number),
  unique (draft_id, player_id)        -- a player can only be drafted once per draft
);

create index picks_draft_idx on public.picks (draft_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--   players : public read
--   picks   : public read (needed for realtime); no client writes
--   drafts  / draft_members : no client access at all (served via API)
-- ---------------------------------------------------------------------------
alter table public.players       enable row level security;
alter table public.drafts        enable row level security;
alter table public.draft_members enable row level security;
alter table public.picks         enable row level security;

create policy "players are readable" on public.players
  for select using (true);

create policy "picks are readable" on public.picks
  for select using (true);

-- ---------------------------------------------------------------------------
-- Realtime: clients subscribe to picks changes to refresh the board
-- ---------------------------------------------------------------------------
alter table public.picks replica identity full;
alter publication supabase_realtime add table public.picks;
