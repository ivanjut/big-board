-- 0008: skip picks and return to them later.
-- A pick is "made" once it has a picks row. A skipped pick was on the clock but
-- deferred: drafts.current_pick (the forward frontier) advances past it, and it
-- stays here as an open/returnable cell until it's filled out of order (which
-- deletes the row), undone back onto the clock, or the draft is reset.
create table public.skipped_picks (
  id          bigint generated always as identity primary key,
  draft_id    uuid not null references public.drafts(id) on delete cascade,
  pick_number int  not null,      -- overall pick that was deferred, 1-indexed
  created_at  timestamptz not null default now(),
  unique (draft_id, pick_number)
);

create index skipped_picks_draft_idx on public.skipped_picks (draft_id);

-- Same access shape as picks / pick_trades: public read (for the board +
-- Realtime), no client writes (skips go through the commissioner-only API route).
alter table public.skipped_picks enable row level security;
create policy "skipped_picks are readable" on public.skipped_picks
  for select using (true);

-- Realtime: clients subscribe to skip changes to refresh open cells on the board.
alter table public.skipped_picks replica identity full;
alter publication supabase_realtime add table public.skipped_picks;
