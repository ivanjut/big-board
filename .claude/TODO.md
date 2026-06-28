# Big Board — Feature TODO

Working tracker for features to be implemented. v1 (offline fantasy football
draft board) is built and running; original spec in [`IDEA.md`](./IDEA.md).

Convention: `[ ]` not started · `[~]` in progress · `[x]` done (move to a
CHANGELOG or delete once shipped).

## Planned features

- [ ] **IDP data source.** FantasyPros' half-PPR cheatsheet (the import source) has no
  individual defensive players, so the IDP pool is still the curated seed list. Wire up a
  second source (e.g. FantasyPros' IDP rankings) into `scripts/import-players.mjs` so the
  IDP toggle reflects real, refreshable rankings too.

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
