-- 0004: drop the per-member "position" field.
-- Drafting teams are identified by name and slot only; the position label
-- (added in 0002) is no longer used by the app.
alter table public.draft_members drop column if exists position;
