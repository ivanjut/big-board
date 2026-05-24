-- 0003: allow pausing a draft, which freezes the current pick's clock.
-- On resume, current_pick_started_at is shifted forward by the paused duration,
-- so the timer continues from where it stopped rather than resetting.
alter table public.drafts add column if not exists paused_at timestamptz;
