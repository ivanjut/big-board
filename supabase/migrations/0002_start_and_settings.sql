-- 0002: draft "Start" gating, per-member position, and editable settings support.

-- New drafts begin in a "pending" state until the commissioner presses Start,
-- which starts the clock for pick 1. (Existing drafts keep their current status.)
alter table public.drafts alter column status set default 'pending';

-- Store member position in its own column instead of folding it into the name.
alter table public.draft_members add column if not exists position text;
