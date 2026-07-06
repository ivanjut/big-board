# Big Board

A web app for running **offline (in-person) fantasy football drafts**. A commissioner
inputs picks on a shared board; everyone else opens the draft's link and watches live
in view-only mode. Next.js (App Router, TS) + Tailwind CSS v4 + Neon Postgres, deployed
on Vercel. See `README.md` for setup and the full feature list.

## Design Context

Two root docs define the design and should be read before any UI work:

- **`PRODUCT.md`** — strategic: register (`product`), users (in-person leagues; commissioner
  drives, members watch), purpose, brand personality (**broadcast scoreboard** — live,
  confident, sporting), anti-references (not cutesy, not a spreadsheet), design principles,
  and the accessibility bar (**WCAG 2.1 AA + reduced motion**).
- **`DESIGN.md`** — visual system (Stitch/DESIGN.md spec): the dark `--bb-*` "Living-Room
  Jumbotron" scoreboard palette, Space Grotesk type scale, flat/tonal elevation, and the
  component + do's/don'ts guardrails. Machine-readable tokens live in its frontmatter;
  `.impeccable/design.json` is the render sidecar.

**Key guardrails:** one accent green — Scoreboard Green `#3fe081` (the home/create surfaces
still use a legacy `emerald-500 #10b981`; converge toward Scoreboard Green). Color on the
grid is functional (position/state), never decoration. Motion is status only and every
animation needs a `prefers-reduced-motion` fallback.

The impeccable design skill reads both files automatically; run `/impeccable <command>` for
design work (e.g. `critique`, `polish`, `craft`).
