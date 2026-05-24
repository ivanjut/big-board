# Big Board — Plan / TODO

Roadmap of planned work. v1 (offline fantasy football draft board) is built and running;
see `.claude/IDEA.md` for the original spec.

## Planned enhancements

- [ ] **Configurable draft order (snake vs. linear).** v1 hardcodes a snake/serpentine
  order (round 1: slots 1→N, round 2: N→1, …). Make this a draft-creation parameter
  (e.g. `draft_type: 'snake' | 'linear'`).
  - Add a `draft_type` column to `drafts` (migration) and a selector in
    `src/components/CreateDraftForm.tsx`.
  - Generalize `pickToCell` / `cellToPick` in `src/lib/draftLogic.ts` to branch on the
    chosen order (linear = slot is constant per column each round).
  - Thread the value through the API routes and `DraftBoard` rendering.

- [ ] **Real player data instead of the seeded sample.** v1 ships ~130 curated players in
  `supabase/seed.sql`. Replace with a live/authoritative source.
  - Pick a source (e.g. a fantasy/NFL stats API or a maintained dataset) and add an
    import/refresh script that upserts into `public.players`.
  - Keep the `is_idp` flag and positions in sync so the IDP toggle and search still work.
  - Consider periodic refresh + handling of player team changes.
