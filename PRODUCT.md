# Product

## Register

product

## Users

**Fantasy football leagues running their draft in person** — a group in one room
(living room, sports bar, someone's basement) with the board shared on a TV or
laptop while everyone follows along on their phones. Two distinct roles:

- **The commissioner** drives. They enter every pick on a shared board, run the
  clock (start / pause / resume), handle undo and reset, execute pick trades, and
  edit settings mid-draft. Their context is fast and high-stakes: a room full of
  people is waiting on each action, so input has to be quick and unambiguous.
- **League members** watch. They open the draft's link in view-only mode and
  follow live via polling — checking who's on the clock, the countdown, and the
  last picks. Any member can unlock editing with the draft password if they need
  to step in. Their context is glanceable and mostly hands-off.

The job to be done: **run a smooth, legible, in-person draft** where nobody has to
ask "wait, whose pick is it?" or "who did they take?"

## Product Purpose

Big Board replaces the whiteboard, printed cheat sheet, and group text that
usually run an offline fantasy draft. One commissioner inputs picks on a shared,
password-protected board; everyone else opens the link and watches the same live
state. It handles the mechanics a real draft needs — fuzzy player search with
drafted players dropping out, a per-pick timer that runs into "over" time, pick
trades with clear ownership, and live settings edits — so the room can focus on
the draft, not the bookkeeping.

Success looks like: a draft that runs start-to-finish with no confusion about
turn order, time, or who was picked — and a board that's readable both in a
commissioner's hand and on a big screen across the room.

## Brand Personality

**Broadcast scoreboard** — live, bold, a little theatrical, like a stadium
jumbotron or an ESPN draft-night lower-third. The signature moments (a pick
landing, the countdown ticking into red, the "live" indicator, the recent-picks
ticker) should feel like live sports television. Three words: **live, confident,
sporting.**

Voice is plain and direct, never cute. The theatricality lives in the motion and
the scoreboard framing, not in the copy — labels stay short and functional so the
board reads instantly under pressure.

## Anti-references

- **Cutesy / toy-like.** No cartoonish rounding, mascots, emoji-as-UI, or
  unserious "fun" styling. This is a broadcast, not a toy. (The one football emoji
  in the wordmark is the ceiling, not a pattern to extend.)
- **Spreadsheet / dense data tool.** Not a Bloomberg-terminal wall of tiny type
  and hairline grid lines. The board carries a lot of cells, but it must stay
  glanceable from across a room, not reward leaning in with a magnifying glass.
- Also avoid the generic corporate-SaaS dashboard (muted card grids, enterprise
  chrome) and the neon gambling/DFS hype aesthetic — neither fits a friends'
  in-person league.

## Design Principles

- **Legible from across the room.** The board is often on a shared screen during a
  live draft. Who's on the clock, how much time is left, and the last pick must be
  glanceable at a distance — hierarchy and contrast beat density every time.
- **Broadcast, not spreadsheet.** Lean into live-sports framing for the moments
  that matter (the pick, the clock, going live), but never let spectacle cost
  clarity. Motion serves comprehension, not decoration.
- **Two roles, two experiences.** The commissioner needs fast, unambiguous,
  deliberately-guarded controls; members need an effortless, read-only view. Design
  each for its role instead of flattening them into one screen.
- **Trust the live state.** Everything is driven by polling in a fast-moving room.
  State must always read as true and current — never stale, never ambiguous about
  whose turn it is or what just happened.
- **Phone-first, big-screen-ready.** Both are primary surfaces: a phone in
  someone's hand and a laptop/TV across the room. A change isn't done until it
  holds up on both.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. Body text ≥4.5:1 and large/scoreboard text ≥3:1 against
its background, in both the dark default and the light theme. Honor
`prefers-reduced-motion` for every animation — the scoreboard's blinking colon,
recent-picks marquee, and pulsing live dot already have reduce fallbacks; keep
that discipline for anything new. Interactive controls must be keyboard-operable
and hit comfortable touch-target sizes for phone use during a live draft.
