---
name: Big Board
description: A broadcast-style scoreboard for running offline fantasy football drafts
colors:
  scoreboard-green: "#3fe081"
  scoreboard-green-dim: "#2ba85f"
  scoreboard-green-text: "#3fe081"
  action-emerald: "#10b981"
  action-emerald-hover: "#34d399"
  green-ink: "#04120a"
  scoreboard-surface: "#0c111b"
  scoreboard-surface-raised: "#0e1522"
  scoreboard-stroke: "#1b2433"
  scoreboard-stroke-strong: "#263041"
  scoreboard-text: "#e8edf5"
  scoreboard-muted: "#8b95a8"
  scoreboard-muted-deep: "#7a8699"
  scoreboard-pill: "#182233"
  amber-signal: "#f0a13a"
  danger-red: "#f2726e"
  page-night: "#020617"
  panel-slate: "#0f172a"
  hairline-slate: "#1e293b"
  pos-qb: "#6ee7b7"
  pos-rb: "#93c5fd"
  pos-wr: "#fde047"
  pos-te: "#fdba74"
  pos-def: "#fca5a5"
  pick-traded: "#f0abfc"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "96px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.13em"
rounded:
  sm: "5px"
  md: "8px"
  chip: "9px"
  field: "11px"
  lg: "12px"
  panel: "16px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  "2xl": "24px"
components:
  button-primary:
    backgroundColor: "{colors.scoreboard-green}"
    textColor: "{colors.green-ink}"
    rounded: "{rounded.chip}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.scoreboard-green-dim}"
    textColor: "{colors.green-ink}"
  button-create:
    backgroundColor: "{colors.scoreboard-green}"
    textColor: "{colors.green-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.scoreboard-surface}"
    textColor: "{colors.scoreboard-text}"
    rounded: "{rounded.chip}"
    padding: "8px 12px"
  button-icon:
    backgroundColor: "{colors.scoreboard-surface}"
    textColor: "{colors.scoreboard-muted}"
    rounded: "{rounded.field}"
    height: "44px"
    width: "44px"
  button-danger:
    backgroundColor: "{colors.danger-red}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input-field:
    backgroundColor: "{colors.scoreboard-surface}"
    textColor: "{colors.scoreboard-text}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
  input-form:
    backgroundColor: "{colors.page-night}"
    textColor: "{colors.scoreboard-text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  badge-position:
    backgroundColor: "{colors.scoreboard-pill}"
    textColor: "{colors.pos-wr}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
---

# Design System: Big Board

## 1. Overview

**Creative North Star: "The Living-Room Jumbotron"**

Big Board is a stadium scoreboard that happens to run in a browser. When a league
gathers in one room for its draft — board thrown up on a TV, everyone else
following on a phone — the interface should carry the charge of live sports
broadcast: a giant countdown, a team spotlighted "on the clock," a recent-picks
ticker crawling along the bottom, a pulsing live dot. The identity is **dark by
default** because the reference is a broadcast lower-third and a jumbotron in a
dim room, not a document. A light theme exists and the scoreboard **adapts with
it** — the `--bb-*` ramp flips to a warm **beige "sand" card** (a distinct warm
stage on the cool-light page), rather than staying a dark jumbotron on a light
document or a plain white panel. The accent green stays bright for
fills (buttons, checkboxes, the live dot) in both themes; greens, ambers, and reds
used as text, icons, or rings darken in light mode (via `--bb-accent-text` and the
light-mode `--bb-amber`/`--bb-danger`) so they stay legible on the beige card.

Density is deliberately low where it counts. The scoreboard trades information per
pixel for legibility across a room: 96px numerals, 52px team names, generous
padding. The draft grid underneath is the one place density is welcome — it's a
box score, and box scores are meant to be scanned. Everything else breathes. The
palette is a near-black blue-slate carrying a single electric green as the voice
of "go / live / your turn," with amber for caution (paused, low clock) and a
coral red for "over time." Color on the grid is functional, not decorative: each
position owns a hue so a filled board reads as a heat map of who took what.

This system explicitly rejects two things. It is **not cute** — no cartoon
rounding, no mascots, no emoji-as-UI (the one football glyph in the wordmark is
the ceiling, not a pattern). And it is **not a spreadsheet** — no Bloomberg-terminal
wall of hairline gridlines and 10px type that rewards leaning in. The board holds
a lot of cells, but it must stay glanceable from the couch.

**Key Characteristics:**
- Broadcast-first: the scoreboard is the hero; the countdown is the loudest element on screen.
- Dark, near-black blue-slate surfaces with one electric-green accent for "live / go / your turn."
- Position-as-color: QB/RB/WR/TE/DEF each own a hue so the grid reads as a heat map.
- Space Grotesk throughout, tabular numerals everywhere numbers move.
- Motion is status, not decoration: blinking colon, crawling ticker, pulsing live dot — all with reduced-motion fallbacks.
- Two surfaces, one voice: a phone in the hand and a TV across the room are both primary.

## 2. Colors

A near-black blue-slate stage lit by a single electric green, with amber and coral reserved for time pressure.

### Primary
- **Scoreboard Green** (`#3fe081`): The voice of the system — "live, go, your turn." Carries the running countdown, the on-the-clock accents, the primary board buttons (Start, Unlock), the live dot, and the QB position. Used sparingly against the dark stage so it always reads as *active*.
- **Scoreboard Green Dim** (`#2ba85f`): The pressed/hover partner for Scoreboard Green, and the focus-border color on scoreboard inputs.
- **Scoreboard Green (text)** — the `--bb-accent-text` token, `#3fe081` in dark mode, **`#166534` in light mode** (deep green, tuned to read on the beige card). Fills stay bright Scoreboard Green in both themes (a bright green button reads on a light page); but the same green drawn as *text, an icon, or a selection ring* (the countdown, the "On the clock" labels, the on-deck token, the focus ring, the on-clock cell ring) would wash out on the light card, so it darkens. One green, two lightnesses, split by whether it's a fill or a mark.
- **Action Emerald** (`#10b981`): *Retired.* A second, cooler green inherited from Tailwind's `emerald-500` that used to carry the home/join/create/settings/trade actions. As of the convergence pass, every action, focus border, and checkbox uses Scoreboard Green; this token is kept only to document what was removed. See **The One Green Rule**. (The QB position tint is a *separate* emerald-family color in the functional grid palette and is intentionally untouched.)
- **Green Ink** (`#04120a`): The near-black green used for text *on* green buttons. Never a page color; it exists only so labels on the accent read with full contrast.

### Secondary (time-pressure signals)
- **Amber Signal** (`#f0a13a` dark / **`#96490a` light**): Caution. The Paused badge, the clock in its final ten seconds, the Pause control, and skipped-pick cells and banners. Darkens in light mode (it's used as clock text and icon color, and must read on the beige card).
- **Danger Red** (`#f2726e` dark / **`#dc2626` light** on the scoreboard; Tailwind `red-500 #ef4444` for the destructive Reset button): "Over time" on the clock, destructive actions, and inline error messages. Darkens in light mode.

### Tertiary (position palette — grid only)
Functional color coding for drafted cells. Each renders as a ~20%-opacity cell tint plus a saturated name color (with a darker `light:` shade for light mode).
- **QB Green** (`#6ee7b7`) · **RB Blue** (`#93c5fd`) · **WR Yellow** (`#fde047`) · **TE Orange** (`#fdba74`) · **DEF/IDP Red** (`#fca5a5`, shared by team defenses and all individual defensive players).
- **Traded Fuchsia** (`#f0abfc`): A pick that now belongs to another team — a faint `fuchsia-500/5` cell wash plus a "⇄ Owner" badge.

### Neutral
The scoreboard runs on its own `--bb-*` ramp, which flips for light mode (a full light-theme override of every `--bb-*` token, parallel to the slate remap). Dark-mode values:
- **Scoreboard Surface** (`#0c111b`): The scoreboard card, board buttons, and inputs.
- **Scoreboard Surface Raised** (`#0e1522`): Hover/raised state and on-deck chips.
- **Scoreboard Stroke** (`#1b2433`) → **Stroke Strong** (`#263041`): Default and hover borders.
- **Scoreboard Text** (`#e8edf5`): Primary text on the scoreboard.
- **Scoreboard Muted** (`#8b95a8`) → **Muted Deep** (`#7a8699`): Secondary and tertiary/label text. Muted Deep is the floor — it's tuned to clear WCAG AA (≥4.5:1) on the scoreboard surface, so labels stay legible; do not take tertiary text any dimmer.
- **Scoreboard Pill** (`#182233`): Count badges and number chips (including the ticker position badge).

In **light mode** the same tokens become a warm **beige** card: surface `#f5efe1`, raised `#ece3cf`, strokes `#e4dbc7`/`#d3c8ae`, text `#0f172a`, muted `#475569` → muted-deep `#566172` (darkened from the white-card value so it still clears ≥4.5:1 on the sand), pill `#e8dfca`. The card carries no shadow — a 1px warm stroke and its warmth against the cool-light page separate it (the Flat-Signage Rule holds in both themes).

The draft grid, the create/join/home forms, and the dialogs run on Tailwind's **slate** ramp, which the light theme remaps in OKLCH (`page-night #020617` bg → `panel-slate #0f172a` cards/table headers → `hairline-slate #1e293b` borders → slate-500 muted → slate-100 text). This is a *deliberate second stage*, not drift — see The Two-Stage Rule.

### Named Rules
**The Two-Stage Rule.** The app has two intentional surfaces: the **broadcast stage** (the scoreboard, on its dark `--bb-*` ramp) is the hero; the **utility stage** (the draft grid box score, the forms, the dialogs, on the slate ramp) is the workhorse. Keep them distinct — the scoreboard is meant to feel like signage the room looks up at, the grid like a box score you scan. Do **not** merge the two by pushing `--bb-*` surfaces into the grid or dialogs. The one thing that must be shared across both stages is the accent green (see below) and the type system.

**The One Green Rule.** The system has one accent green: **Scoreboard Green** (`#3fe081`). The `action-emerald` (`#10b981`) on the home/join/create surfaces is a legacy Tailwind default that predates the scoreboard identity — treat every new green as Scoreboard Green and migrate old emerald toward it. Two greens that are *almost* the same hue is the tell of a system that drifted; converge.

**The Functional-Color Rule.** Saturated color on the grid is never decoration — a hue *means a position* or *means a state* (on-the-clock green ring, skipped amber, traded fuchsia). If a color isn't encoding position or state, it doesn't belong on the board.

## 3. Typography

**Display / Body / Label Font:** Space Grotesk (with `system-ui, -apple-system, "Segoe UI", sans-serif`)

**Character:** One family does everything, in three weights (500 / 600 / 700). Space Grotesk is a geometric grotesque with just enough quirk (the distinctive `a`, `g`, and tabular figures) to feel sporting and modern without tipping into novelty. Its tabular numerals are the reason it's here: every number that moves — the countdown, pick numbers, round·pick — sits in `tabular-nums` so digits don't jitter as they tick.

### Hierarchy
- **Display** (700, 96px desktop / 72px mobile, line-height 1, tabular-nums): The pick countdown only. The single loudest element on screen — visible across a room. Color-coded by state (green → amber under 10s → coral "over").
- **Headline** (700, 52px desktop / 36px mobile, line-height ~1, letter-spacing −0.02em): "On the clock" team name and the Round · Pick readout, flanking the countdown.
- **Title** (700, 30px, letter-spacing −0.01em): The draft name (`h1`) in the top chrome.
- **Body** (500, 14–15px, line-height 1.5): Search input, list rows, banners, dialog copy, form fields. Prose stays ≤65–75ch; data rows may run denser.
- **Label** (600, 11–12px, uppercase, letter-spacing 0.12–0.16em): The scoreboard eyebrows ("On the clock", "On deck", "Round · Pick", "Recent picks") and small metadata. Their wide tracking is what makes them read as broadcast supers rather than headings.

### Named Rules
**The Tabular Rule.** Anything that counts, ticks, or gets scanned column-against-column uses `tabular-nums` — the clock, overall pick numbers, round·pick, on-deck chip numbers. Proportional figures on a live clock are forbidden; the width shift reads as a glitch.

## 4. Elevation

Big Board is **flat by default**, built on tonal layering, not shadow. Depth comes from stepping the surface ramp (`scoreboard-surface #0c111b` → `surface-raised #0e1522`, or `page-night` → `panel-slate`) and from 1px strokes that brighten on hover (`stroke #1b2433` → `stroke-strong #263041`). The scoreboard, banners, and board grid cast no shadow at all — they're signage, and signage is flat.

Shadow appears in exactly one role: **temporary layers that float above the board.** State is expressed by rings and tints, never by lifting a resting surface.

### Shadow Vocabulary
- **Floating menu** (`box-shadow: 0 20px 25px -5px rgba(0,0,0,0.25), 0 8px 10px -6px rgba(0,0,0,0.25)` — Tailwind `shadow-xl`): Search-results dropdown, the ⋯ overflow menu, the Download split menu. The only shadow in the system.
- **Modal scrim** (`background: rgba(0,0,0,0.6)`): Full-screen backdrop behind the Reset confirm, Settings, and Trade dialogs. A dim, not a blur.

### Named Rules
**The Flat-Signage Rule.** Resting surfaces are flat. If you're reaching for a shadow to separate two panels, step the tonal ramp or add a 1px stroke instead. Shadow is reserved for things that genuinely float *over* the board (menus, popovers) — nothing else.

**The State-By-Ring Rule.** Selection and status are shown with inset rings and background tints, never elevation. On-the-clock = `ring-2 ring-inset ring-scoreboard-green` + green wash; fill-target = amber ring; focus = border color shift to green. A raised shadow to mean "selected" is prohibited.

## 5. Components

### Buttons
- **Shape:** Chip-radius (9px) for scoreboard text buttons, field-radius (11px) for icon buttons, 12px for the large home/create actions. Never fully pill except for on-deck chips.
- **Primary (board):** Scoreboard Green fill, Green Ink text, 9px radius, `~8px 14px` padding (Start draft, Unlock). Hover → Green Dim. This is the "go" button.
- **Primary (home/create):** Scoreboard Green fill, Green Ink text, 12px radius, larger `12px 24px` padding (Create a draft, Create draft; the "Go" join action stays a muted slate button). Same green as the board per The One Green Rule.
- **Secondary (`CBTN`):** Surface fill, full-strength text, 1px stroke, 9px radius, `8px 12px` (Share link, Download, Settings). Hover brightens both border (→ stroke-strong) and fill (→ surface-raised). Transitions are `transition-colors` only.
- **Icon (`IBTN`):** 44×44px, surface fill, muted icon, 11px radius, stroke border (Pause/Resume, Undo, Skip, ⋯). Hover brightens border, fill, and icon together. Disabled → `opacity-40`, pointer-events off. The 44px floor is a deliberate touch target for phone use.
- **Contextual accent icon buttons:** Resume wears a green-tinted skin (`rgba(63,224,129,0.1)` fill, green border/icon); Pause wears an amber-tinted skin. The control's color *is* its meaning.
- **Danger:** Reset uses a solid red fill with white text, and only ever appears behind the ⋯ menu **and** a confirm dialog — destructive actions are twice-gated.

### Inputs / Fields
Two input skins exist, matching the two surfaces:
- **Scoreboard input (`input-field`):** Surface fill, 11px radius, 1px stroke, `12px 16px` padding, muted-deep placeholder. Focus shifts the border to Green Dim — no glow, no ring. The player search adds a leading 17px search glyph and `pl-11` room for it.
- **Form input (`input-form`):** On the home/create/join surfaces — `page-night` fill, slate-700 stroke, 8px radius, smaller `8px 12px` padding, focus border → emerald-500. Checkboxes use `accent-emerald-500`.

### Search + Dropdown (signature)
Debounced fuzzy search (`bij` → Bijan Robinson) with a floating results list: 11px radius, surface fill, `shadow-xl`, max-height ~288px, keyboard-navigable (↑/↓/Enter/Esc). The active row is a green wash (`rgba(63,224,129,0.12)`), hovered rows go to surface-raised. Selecting a player drafts them into the active pick.

### The Scoreboard (signature)
The centerpiece — a `16px`-radius surface card, three-column on desktop (`1fr auto 1fr`), stacked on mobile:
- **Left:** "ON THE CLOCK" label → 52px team name → an "On deck" strip of pill chips, the first chip green-numbered as the immediate next pick.
- **Center:** the 96px `PickTimer` countdown with a blinking colon, colored by state (green / amber ≤10s / coral over-time), and a "Remaining / Elapsed / ⏸ Paused" sub-label.
- **Right:** "ROUND · PICK" label → 52px `round · pick` → overall pick number.
- **Bottom:** the **recent-picks ticker** — a live dot + "RECENT PICKS", then a marquee of the last 12 picks (`#overall · team · player · POS-badge`), auto-scrolling (32s loop) only once ≥5 picks exist, and pausing on hover.

### Draft Grid (signature)
The box score: sticky round-label column, one column per member, `border-collapse` with slate hairlines. Each 56px cell shows a small first-name line over a bold last-name line, position-tinted background and text, an overall pick number top-right, and team·position metadata bottom-right. State cells: on-the-clock (green ring + wash), skipped (amber wash, clickable to fill), traded (fuchsia wash + "⇄ Owner" badge). Horizontally scrollable on phones. This is the one place density is a feature.

### Chips & Badges
- **On-deck chip:** `rounded-full`, surface-raised fill, 1px stroke, a small round pick-number token (green for the immediate next, muted pill otherwise).
- **Position badge (ticker):** `5px` radius, dark `#141c2a` fill, position-colored bold 10px text.
- **Count badge (Trades):** `rounded-md`, scoreboard-pill fill, muted semibold text.

### Dialogs
Centered over a `rgba(0,0,0,0.6)` scrim, `panel-slate` fill, slate-700 border, 12px radius. Used for Reset confirm, Settings, and Trades. Reset pairs a neutral Cancel (bordered) with a red confirm.

### Navigation
Minimal. A small muted "Big Board" back-link above the draft title; a fixed theme toggle top-right (bordered, `backdrop-blur`, moon/sun swapped by the `light:` variant). No global nav bar — the product is one board at a time.

## 6. Do's and Don'ts

### Do:
- **Do** keep the two stages distinct (The Two-Stage Rule): the scoreboard on the dark `--bb-*` ramp is the broadcast hero; the draft grid, forms, and dialogs stay on the slate ramp as the utility stage. The only things that cross the seam are the accent green and the type system.
- **Do** make the countdown the loudest thing on screen. The 96px clock and 52px team name are the point — never shrink them to fit more chrome around them.
- **Do** let the scoreboard adapt to light mode. Both `:root` (dark) and `html.light` define every `--bb-*` token; a new `--bb-*` color must be set in *both* blocks. Keep fills bright (`--bb-accent`) and use `--bb-accent-text` / the light-mode amber and danger for anything drawn as text, an icon, or a ring so it stays ≥4.5:1 (≥3:1 for the large clock digits and rings) on the beige card.
- **Do** use `tabular-nums` on every number that moves or aligns (clock, pick numbers, round·pick, on-deck chips).
- **Do** encode position and state with color — green ring for on-the-clock, amber for skipped/paused, coral for over-time, fuchsia for traded, and the QB/RB/WR/TE/DEF hue set on the grid.
- **Do** hold a 44px minimum touch target on icon controls, and give every interactive control its default / hover / focus / disabled states.
- **Do** keep motion as status: blinking colon, crawling ticker, pulsing live dot — and always ship the `prefers-reduced-motion: reduce` fallback (already wired in `globals.css`).
- **Do** twice-gate destructive actions (Reset lives behind the ⋯ menu *and* a confirm dialog).

### Don't:
- **Don't** go cute. No cartoon rounding, mascots, or emoji-as-UI. The lone football glyph in the wordmark is the ceiling — do not extend it into a pattern.
- **Don't** turn the board into a spreadsheet — no Bloomberg-terminal hairline density or sub-10px type that only reads when you lean in. Glanceable-from-the-couch beats information-per-pixel everywhere except inside the grid cells.
- **Don't** introduce a third green, and don't add new UI in `action-emerald` — converge on Scoreboard Green (`#3fe081`) per The One Green Rule.
- **Don't** use shadow to separate resting surfaces. Step the tonal ramp or add a 1px stroke. Shadow is only for menus/popovers that float over the board.
- **Don't** use a colored `border-left`/`border-right` stripe as an accent on cards, cells, or banners. Use full borders, background tints, or rings.
- **Don't** use gradient text or `background-clip: text`. Emphasis comes from weight, size, and the one green — never a gradient.
- **Don't** let a long team name or player name overflow its cell or the on-the-clock slot; the grid is min-width `120px` per column and names truncate — test real roster names at phone width.
- **Don't** lean on glassmorphism. The one `backdrop-blur` (theme toggle) is the exception, not a license.
