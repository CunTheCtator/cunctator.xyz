# Claude Instructions — Personal Website

This file is read by Claude Code at session start. It contains project context, architecture decisions, and coding conventions. Do not deviate from these without explicit instruction.

---

## Project Overview

A personal website for the client. Not a recruiter portfolio — a public window into who they are. Primary audiences: technical visitors directed there to see projects, and social connections arriving out of personal interest.

**Sections:** Home, About, Projects, The Alder World (worldbuilding library), The Game, Contact.

**Full spec:** See `HANDOFF.md` for complete decisions and rationale. See `personal-website-spec-v1.1.docx` for the formal specification.

---

## Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (core utility classes only)
- **Database:** SQLite (document metadata)
- **Game rendering:** HTML5 Canvas — vanilla TypeScript, no game engine
- **Auth:** OAuth via Discord (primary), Google (fallback), GitHub (additional fallback) — no passwords stored
- **Process manager:** PM2
- **Reverse proxy:** Nginx
- **DNS / Email:** Cloudflare
- **OS:** Ubuntu 22.04 LTS

---

## Project Structure

```
/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Home
│   ├── about/page.tsx
│   ├── projects/page.tsx
│   ├── library/page.tsx    # Alder World library + showcase
│   ├── game/page.tsx
│   ├── contact/page.tsx
│   └── admin/              # Protected admin panel
│       └── page.tsx
├── components/
├── lib/
│   ├── db.ts               # SQLite connection + queries
│   └── auth.ts             # OAuth session helpers
├── game/                   # Self-contained game module
│   ├── engine/
│   ├── data/               # JSON: factions, units, maps, narrative
│   └── canvas/
├── public/
│   └── uploads/            # Uploaded HTML documents (UUID-named)
├── api/                    # Next.js API routes
└── claude.md
```

---

## Architecture Decisions

- **No separate backend** — all server logic in Next.js API routes
- **SQLite over Postgres/MySQL** — single-owner site, no multi-instance deployment, no external DB service needed
- **Local filesystem for uploads** — HTML files stored by UUID, original filename in metadata only
- **No upload size limit** — client has files up to 15MB+. Next.js bodyParser must be disabled on upload route. Nginx `client_max_body_size` must be set to `0` or explicit large value.
- **iframes for document rendering** — uploaded HTML files have their own fonts, CSS, scripts. Never inject into DOM. Always sandbox.
- **OAuth only** — no homebrew auth, no password storage. Only the client's pre-configured OAuth identity gets admin access.
- **Canvas for game** — no Phaser, no game engine. Vanilla TypeScript + HTML5 Canvas.
- **A\* pathfinding** — use a well-tested open-source implementation, wrap in a typed TypeScript interface. Do not write pathfinding from scratch.
- **Game data is JSON** — factions, units, maps, narrative, status effects all in `/game/data/`. Adding content requires no code changes.
- **No AI integration** — no Anthropic API, no OpenAI, nothing. Not in the game, not in the site.

---

## Responsive Strategy

- **Content sections** (About, Projects, Library, Contact): mobile-first
- **The Game**: desktop-first, mobile-compatible. A 64×64-map tactics game with a 16×16 viewport needs screen real estate. Mobile gets a playable experience, not a primary one.

---

## Coding Preferences

These are non-negotiable. Follow them exactly.

### General
- **No comments** unless they were present in the original code being edited
- **No type hints in standalone logic** where inference is obvious — but this is TypeScript, so type everything that needs typing; just don't over-annotate
- **No docstrings**
- **Flat, readable structure** over clever one-liners
- **Solve intent over letter-of-spec** — if the spec implies something useful that wasn't explicitly stated, add it
- **Add methods/helpers beyond spec** when clearly useful
- **Soft failures** — return `null` or an empty result over throwing, unless the failure is truly unrecoverable
- **Granular console-based error handling** — log what went wrong, where, and with what input. No silent failures.

### Naming
- **camelCase** for functions and variables
- **PascalCase** for types, interfaces, and React components
- **snake_case** for database field names and API query parameters (e.g. `user_id`, `uploaded_at`)
- **SCREAMING_SNAKE_CASE** for constants

### TypeScript
- Type everything at function boundaries
- Prefer `type` over `interface` unless the interface will be extended
- No `any` — use `unknown` and narrow it
- No non-null assertions (`!`) without a comment explaining why it's safe

### React / Next.js
- Functional components only
- Prefer server components by default; add `'use client'` only when needed
- No inline styles — Tailwind classes only
- Keep components focused — if a component is doing too much, split it

### API Routes
- All routes validate input before touching the DB or filesystem
- Auth-protected routes check session at the top, return 401 immediately if invalid
- Consistent response shape: `{ data, error }` — one is always null

### Database (SQLite)
- All queries go through `/lib/db.ts` — no raw SQL outside that file
- Parameterized queries only — no string concatenation in SQL
- Transactions for any operation that touches more than one table or makes more than one write

### Game Module
- Game state is a plain TypeScript object — no classes, no global variables
- All game logic is pure functions where possible (input → output, no side effects)
- Canvas drawing is strictly separated from game logic — the engine doesn't know about the canvas
- JSON data files are the source of truth — the engine reads them, never writes them

---

## Production Content Rules

These were settled at ship time. Do not regress them.

- **Programmer art is the production look for the board.** Terrain renders procedurally
  (noise/fractal painterly renderer); units are faction discs with the glyph-free class-mark
  shape language (■ heavy · ▲ mobile · ⊙ ranged · ✕ disrupt · ○ support · □ builder ·
  ⊗ wildcard · ★ commander · ◆ extractor). `USE_PAINTED_TERRAIN` and `USE_SPRITE_ASSETS`
  stay **false** — the AI-generated painted tile PNGs are not the shipped look.
  HUD iconography comes from the Claude-design stroke sprite at `public/game-icons.svg`.
- **No invented content anywhere.** No fictional projects, no fabricated lore excerpts,
  no made-up dates or stats. Surfaces that show library/game data must derive it from the
  real source (SQLite documents, game save, `game/data/*.json`) or show an honest empty state.
- **Real projects only:** this site and Remnant (the game). Nothing else exists publicly.
- **No dev surfaces in production.** Mission-jump buttons, cheats, and direct-deploy panels
  are gated behind `NODE_ENV === "development"`. The menu's faction rail shows real campaign
  progress from the save, never a mission select.
- **Identity values:** GitHub is `CunTheCtator`. Discord is display-only (no link).
  Email is `contact@cunctator.xyz`. The domain is `cunctator.xyz`.
- The game's public name is **Remnant** — no "working title" qualifiers.

---

## Deployment Notes

- App runs under a dedicated system user
- PM2 config at `ecosystem.config.js` in project root
- Nginx site config documents itself inline
- Full deployment steps documented in `HANDOFF.md` under Deployment section
- Cloudflare manages DNS and email routing — do not touch MX records

---

## What This Site Is Not

- Not a CV — LinkedIn handles that
- Not a recruiter portfolio
- No real-identity links in contact (no Facebook, Instagram, Gmail)
- No AI features
- No user accounts, no comment system, no social features
- No military service references anywhere on the site
