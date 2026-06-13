-- 0006: trade draft picks.
-- A pick's owner is otherwise implicit (the snake slot). This log decouples it:
-- the current owner of a not-yet-made pick is the latest trade's to_slot,
-- falling back to the original snake slot when the pick has never been traded.
create table public.pick_trades (
  id          bigint generated always as identity primary key,
  draft_id    uuid not null references public.drafts(id) on delete cascade,
  pick_number int  not null,      -- overall pick being reassigned, 1-indexed
  from_slot   int  not null,      -- owner before this trade
  to_slot     int  not null,      -- owner after this trade
  created_at  timestamptz not null default now()
);

create index pick_trades_draft_idx on public.pick_trades (draft_id);

-- Same access shape as picks: public read (for the board + Realtime), no client
-- writes (trades go through the commissioner-only API route).
alter table public.pick_trades enable row level security;
create policy "pick_trades are readable" on public.pick_trades
  for select using (true);

-- Realtime: clients subscribe to trade changes to refresh ownership on the board.
alter table public.pick_trades replica identity full;
alter publication supabase_realtime add table public.pick_trades;
