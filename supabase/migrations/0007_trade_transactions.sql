-- 0007: group pick movements into a single trade transaction.
-- A trade between two teams can move several picks both ways; rows sharing a
-- transaction_id are one trade. Existing rows each become their own transaction.
alter table public.pick_trades
  add column if not exists transaction_id uuid not null default gen_random_uuid();

create index if not exists pick_trades_txn_idx on public.pick_trades (transaction_id);
