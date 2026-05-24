-- 0005: denormalize the player's team onto picks, so the board can show a
-- team abbreviation without re-joining the players table on every render.
-- (Matches the existing player_name / player_position denormalization.)
alter table public.picks add column if not exists player_team text;
