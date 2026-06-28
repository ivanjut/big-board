-- 0009: give players a stable external key and an overall ranking so the pool
-- can be refreshed from a live source (FantasyPros) at any time without
-- breaking the picks.player_id foreign key.
--
-- fantasypros_id is the upsert key used by scripts/import-players.mjs: re-running
-- the import updates existing rows in place (ids stay stable, picks keep working)
-- instead of inserting duplicates. It is nullable so curated/seed players that
-- have no FantasyPros id (e.g. IDPs) can coexist; multiple NULLs are allowed.
alter table public.players
  add column if not exists fantasypros_id bigint,
  add column if not exists rank int;

alter table public.players
  drop constraint if exists players_fantasypros_id_key;
alter table public.players
  add constraint players_fantasypros_id_key unique (fantasypros_id);

-- rank ascending = best players first; used to order search results now that the
-- pool is hundreds deep rather than a curated shortlist.
create index if not exists players_rank_idx on public.players (rank);
