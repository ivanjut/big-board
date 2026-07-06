---
target: the draft board (DraftBoard.tsx)
total_score: 27
p0_count: 0
p1_count: 3
timestamp: 2026-07-05T13-18-43Z
slug: src-components-draftboard-tsx
---
Method: ⚠️ DEGRADED: single-context (sub-agent spawning is gated to explicit user request in this session; ran inline). Browser visualization unavailable: the only running dev server (:3000) serves a different app ("TierDrop"); the board requires a migrated DB + seeded live draft to render, which is out of scope for this request. Deterministic detector ran clean.

Target: the draft board — src/components/DraftBoard.tsx (+ PickTimer, PlayerSearch) rendered at src/app/draft/[id]/page.tsx.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Great live status (clock/on-the-clock/ticker); no loading skeleton, no optimistic feedback on pick/undo, 2s poll staleness uncued |
| 2 | Match System / Real World | 3 | Football + scoreboard metaphor is spot-on; icon-only Undo/Skip lean on tooltips |
| 3 | User Control and Freedom | 3 | Undo, Pause/Resume, Cancel, Esc-on-search, gated Reset; trades not obviously reversible |
| 4 | Consistency and Standards | 2 | Two visual vocabularies (bb-* scoreboard vs slate grid/modals) + two greens; identity dies below the fold |
| 5 | Error Prevention | 3 | Reset double-gated; input constraints; smart defaults |
| 6 | Recognition Rather Than Recall | 3 | Mostly visible; icon-only controls rely on recall/tooltips |
| 7 | Flexibility and Efficiency | 2 | Search keyboard-nav is excellent, but no global shortcuts and search doesn't auto-refocus across a 150-pick grind |
| 8 | Aesthetic and Minimalist Design | 3 | Scoreboard is beautiful and focused; the seam + control-dock weight competition hold it back |
| 9 | Error Recovery | 3 | Inline red banner, but generic fallback copy, shown at top not near source |
| 10 | Help and Documentation | 2 | Pending-state hint + tooltips only; no contextual help for skip/fill/trade flows |
| **Total** | | **27/40** | **Acceptable (upper end — a strong scoreboard dragged down by consistency + a11y gaps)** |

## Anti-Patterns Verdict

**LLM assessment:** This does NOT read as AI slop. The scoreboard is a committed, specific idea — a broadcast jumbotron with a 96px countdown, an on-the-clock spotlight, a live recent-picks ticker, on-deck chips, a pulsing live dot — executed with real craft (tabular-nums, blinking colon, marquee fade edges, reduced-motion fallbacks). No hero-metric template, no identical card grid, no gradient text, no eyebrow-on-every-section. It has a point of view. Where it slips is not slop but *drift*: the board's identity stops at the scoreboard and the grid/modals below revert to a plainer slate default.

**Deterministic scan:** `detect.mjs` ran on DraftBoard, page, PlayerSearch, PickTimer, page.tsx, CreateDraftForm → **0 findings (exit 0, clean)**. No side-stripe borders, gradient text, glassmorphism, or eyebrow patterns. Agrees with the LLM read: no mechanical slop tells.

**Visual overlays:** Not available. No reliable user-visible overlay was produced — the running server is a different app and the board wasn't seeded. Findings below are source-grounded (full read of every UI component) plus computed contrast, not screenshot-derived.

## Overall Impression

The scoreboard is the best thing here and it's genuinely good — it earns the "broadcast" personality instead of just claiming it. The single biggest opportunity is to make the *whole* board page feel like that scoreboard: right now there's a visible seam where the dark `--bb-*` jumbotron meets a slate-ramp table and slate modals, and a second, almost-identical green muddies the "one voice" accent. Close that seam and fix two concrete accessibility gaps (a failing muted text color, invisible keyboard focus) and this jumps from "acceptable" to "good."

## What's Working

1. **The scoreboard is a real idea, well built.** Three-column broadcast layout, 96px state-colored countdown, on-deck chips with a green "next" token, a live ticker that only animates once it has enough picks and pauses on hover. This is the identity working as intended.
2. **State vocabulary is thorough and mostly labeled.** On-the-clock (green ring + "On the clock" text), skipped (amber wash + "⏭ Skipped / click to fill"), traded (fuchsia + "⇄ Owner"), paused badge, over-time coral "+m:ss over". Status is rarely color-only.
3. **Disciplined motion + polling.** Every animation has a `prefers-reduced-motion` fallback; polling pauses on hidden tabs and refetches on refocus. That's careful, respectful engineering.

## Priority Issues

- **[P1] Muted text fails WCAG AA.** `--bb-muted-2` (`#5f6a7d`) on the scoreboard card (`#0c111b`) computes to ≈**3.46:1** — below the 4.5:1 floor for small text. It's used on the eyebrow labels ("On the clock", "On deck", "Round · Pick", "Recent picks"), the ticker `#overall` pick numbers, the "Big Board" back-link, the search icon, and the search placeholder (`placeholder:text-[var(--bb-muted-2)]`). This directly violates the WCAG 2.1 AA bar just set in PRODUCT.md.
  - **Why it matters:** the small broadcast labels are exactly the glanceable context a viewer across the room relies on; low-vision users lose them entirely.
  - **Fix:** lighten `--bb-muted-2` until small text clears 4.5:1 (≈`#8b95a8`, the existing `--bb-muted`, already passes at ~5.9:1), or promote these labels to `--bb-muted`. Re-check `text-slate-500/600` small labels in the grid header while you're there.
  - **Suggested command:** /impeccable audit (then /impeccable colorize to retune the ramp)

- **[P1] Keyboard focus is invisible.** Inputs set `outline-none` and only shift a 1px border to `--bb-accent-dim` on focus; the CBTN/IBTN buttons (Share, Download, Settings, Pause, Undo, Skip, ⋯) define hover styles but **no `:focus-visible`** at all. A keyboard-only user can't see where focus is.
  - **Why it matters:** the commissioner may well drive by keyboard; a viewer tabbing to "Unlock" gets no focus cue. Fails the AA "operable/visible focus" bar.
  - **Fix:** add a visible `:focus-visible` ring (e.g. `outline: 2px solid var(--bb-accent); outline-offset: 2px`) to every button and input; don't rely on border-color alone. (The DESIGN.md component snippets already model this.)
  - **Suggested command:** /impeccable harden (a11y states)

- **[P1] The identity dies below the fold — two vocabularies, two greens.** The scoreboard runs on `--bb-*` (surface `#0c111b`, stroke `#1b2433`); the draft grid directly beneath uses the slate ramp (`bg-slate-900`, `border-slate-800`), and the Reset/Settings/Trade modals use a third slate-panel skin. There's a literal seam where `--bb-stroke` borders meet `slate-800` borders. Compounding it, primary buttons use `--bb-accent #3fe081` on the board but `emerald-500 #10b981` on home/create — two greens a hair apart.
  - **Why it matters:** consistency is the product's cheapest trust signal; the jumbotron-bolted-onto-a-spreadsheet seam is the one thing that reads as unfinished.
  - **Fix:** extend the `--bb-*` surface/stroke ramp down into the grid table and the dialogs so the whole page is one dark stage; converge every green on `--bb-accent` per DESIGN.md's One Green Rule.
  - **Suggested command:** /impeccable colorize (then /impeccable polish)

- **[P2] The 150-pick grind isn't optimized for the commissioner.** The player search has excellent in-widget keyboard nav (↑/↓/Enter/Esc), but there are no global shortcuts (focus-search, undo, pause) and the search doesn't re-focus itself after a pick — so every one of ~150 picks costs an extra click back into the box. There's also no optimistic/loading feedback during the pick round-trip.
  - **Why it matters:** the commissioner is the one person who touches this hundreds of times under room pressure; small frictions compound into a slog.
  - **Fix:** auto-refocus the search after each successful pick; add a "/" (or Enter-from-anywhere) to focus search and a visible pending state on submit.
  - **Suggested command:** /impeccable harden (interaction states) — the refocus/shortcut wiring is a logic change to pair with it.

- **[P2] Loading and overflow edges are unfinished.** The load state is a bare centered "Loading…" (not a scoreboard skeleton, which product guidance calls for), and the 52px on-the-clock team name has no truncation — a long league team name will overflow/wrap the left panel on a phone.
  - **Why it matters:** first paint and real-world team names ("The Team With A Really Long Name") both hit these paths regularly.
  - **Fix:** skeleton the scoreboard shell while state loads; clamp/`truncate` the on-the-clock name and test real roster names at 360px.
  - **Suggested command:** /impeccable adapt (breakpoints/overflow) + /impeccable onboard (loading/empty states)

## Persona Red Flags

**Sam (Accessibility-Dependent):** `--bb-muted-2` labels fail contrast (~3.46:1). Keyboard focus is invisible on all chrome buttons and inputs (`outline-none`, hover-only). Low-time is signaled by a green→amber clock color with no non-color cue until the "over" text appears at 0. Will struggle to operate the board by keyboard and to read the broadcast labels.

**Casey (Distracted Mobile):** Mostly served well — scoreboard stacks to one column, 72px mobile countdown, 44px icon targets, sticky round column on the horizontally-scrolling grid. Risks: the CBTN chrome buttons are ~36px tall (under the 44px target); the on-the-clock name can overflow at phone width; a returning viewer gets no "last updated" cue beyond the decorative pulse.

**The Commissioner (project-specific — power user, running a live room):** No global keyboard shortcuts and no search auto-refocus make the 150-pick core loop click-heavy. Icon-only Undo/Skip rely on tooltips they can't hover on a phone. No optimistic feedback after a pick, so under fast entry they may double-check whether the pick landed. Reset being twice-gated is the right call and works for them.

**The Viewer (project-specific — glancing member):** Well served. The scoreboard is genuinely glanceable, the ticker answers "who just got taken?", and view-only is effortless. Only nit: "Unlock to edit" is the single discoverability path if they need to step in, and the 2s poll can lag the room's live pick call by a beat.

## Minor Observations

- Icon-only Undo/Skip/Pause depend on `title`/`aria-label`; fine for SR and desktop hover, invisible affordance on touch.
- Grid uses `text-slate-500`/`text-slate-600` for the "Rd" header, round numbers, and the tiny per-cell pick number — borderline AA at that size; verify against the dark cell.
- The action-error fallback copy is generic ("Something went wrong."); prefer the server message or a specific recovery hint.
- `--bb-muted` (`#8b95a8`, ~5.9:1) is fine — the failure is specifically `--bb-muted-2`; the ramp just needs one nudge, not a rework.

## Questions to Consider

- What if the `--bb-*` dark stage ran the full height of the page — grid and modals included — so it's one scoreboard, not a jumbotron sitting on a slate table?
- What would make the 150-pick loop feel effortless — could the entire pick cycle be keyboard-only, search staying focused pick after pick?
- Does a viewer ever doubt they're seeing the live board? Is a pulsing dot enough, or should "live" mean an explicit "updated 1s ago"?
