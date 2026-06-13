# Big Board — Feature TODO

Working tracker for features to be implemented. v1 (offline fantasy football
draft board) is built and running; original spec in [`IDEA.md`](./IDEA.md).

Convention: `[ ]` not started · `[~]` in progress · `[x]` done (move to a
CHANGELOG or delete once shipped).

## Planned features

- [x] **Trade draft picks.** Let the commissioner reassign ownership of not-yet-made
  picks between teams, keep a log of every trade, and reflect current ownership on
  the board. Today a pick's owner is implicit — the board derives it from the snake
  slot (`cellToPick(round, slot, numSlots)` for cells, `pickToCell(currentPick, …)`
  for the clock) — so ownership has to be decoupled from the original slot.
  - **Data:** a `pick_trades` log table (`draft_id`, `pick_number`, `from_slot`,
    `to_slot`, `created_at`) and an effective-owner lookup — current owner of a pick =
    latest trade for it, falling back to the original snake slot.
  - **API:** a commissioner-only trade endpoint that rejects already-made picks and
    records the trade; include the owner map + trade log in the `state` response.
  - **Board (`DraftBoard.tsx`):** show each pick under the team that currently owns
    it, visibly mark traded picks (e.g. "from Team X" badge), and base the
    "on the clock" team on the effective owner of `currentPick` rather than the raw
    slot.
  - **Trade log UI:** a drawer/panel listing trades (who sent which pick to whom).

- [ ] **Real player data instead of the seeded sample.** v1 ships ~130 curated players in
  `supabase/seed.sql`. Replace with a live/authoritative source.
  - Pick a source (e.g. a fantasy/NFL stats API or a maintained dataset) and add an
    import/refresh script that upserts into `public.players`.
  - Keep the `is_idp` flag and positions in sync so the IDP toggle and search still work.
  - Consider periodic refresh + handling of player team changes.

## Follow-ups from the draft-header rework

- [ ] **Color-code the player-search dropdown by position.** The board cells are
  color-coded (QB/RB/WR/TE/DEF); apply the same mapping to `PlayerSearch` result
  rows for consistency. Factor the position→color map out of `DraftBoard.tsx` so
  both share it.
- [ ] **Include team in draft cell.** In addition to name and position, the drafted player cell should also include the team.
- [ ] **Keyboard shortcuts for controls.** The design dock hinted at them
  (Space = pause/resume, ⌘Z = undo). Wire these up for the commissioner view.
- [ ] **Timer font fidelity.** Optionally load JetBrains Mono (per the wireframe)
  for the scoreboard countdown instead of the system monospace stack.

## Backlog / nice-to-have

- [ ] **Per-team roster view.** A way to see a single team's drafted players
  (column emphasis, filter, or a per-team panel).
- [ ] **Export draft results.** Download the completed board as CSV/JSON. Put this as a button to be used at any point in the draft.
- [ ] **Draft-order randomizer.** Shuffle the member slots at creation time.
- [ ] **Configurable draft type (snake vs. auction).** v1 only supports a snake draft
  (the board math in `src/lib/draftLogic.ts` hardcodes a serpentine order: round 1
  slots 1→N, round 2 N→1, …). Add an auction format as the only other option.
  - Add a `draft_type: 'snake' | 'auction'` column to `drafts` (migration) and a
    selector in `src/components/CreateDraftForm.tsx`.
  - **Snake** — keep the existing `pickToCell` / `cellToPick` round×slot board.
  - **Auction** — a different mechanic, not just a reordering: teams have a budget and
    bid on nominated players, highest bid wins. Needs:
    - a per-team budget at creation (e.g. $200) and a `winning_bid` amount stored on
      each pick (migration), with budget tracking + validation in the pick API.
    - a nomination/bid flow replacing the snake "on the clock" pick; the board
      becomes a per-team roster grid (with remaining budget) rather than round×slot
      cells.
  - Thread `draft_type` through the API routes and `DraftBoard` so the UI switches
    between the snake board and the auction view.
