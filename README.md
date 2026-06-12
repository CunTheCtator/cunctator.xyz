# cunctator.

Personal site — a public window, not a CV. Projects, the Alder World writing library,
and **Remnant**, a browser turn-based tactics game, all in one Next.js app.

## What's inside

| Surface | Where | Notes |
|---|---|---|
| Home / About / Projects / Contact | `app/` | Server components, console × atlas register |
| Library | `app/library` | Uploaded HTML documents rendered in sandboxed iframes, exactly as written |
| The game | `app/game` + `game/` | 64×64 tactics engine, vanilla TypeScript + HTML5 Canvas, no game engine |
| Admin | `app/admin` | OAuth-gated upload + metadata management |

## Stack

Next.js (App Router) · TypeScript · Tailwind (core utilities) · SQLite (better-sqlite3) ·
NextAuth (Discord / Google / GitHub OAuth, no passwords) · HTML5 Canvas · PM2 + Nginx in production.

## The game

A self-contained module under `game/`:

- `game/engine/` — pure game logic. Plain state objects, pure functions, no canvas knowledge.
- `game/canvas/` — rendering, terrain generation, input. Strictly separated from logic.
- `game/data/` — factions, units, commanders, abilities, structures, status effects,
  maps, narrative, puzzle fragments. All JSON; adding content requires no code changes.
  Schemas in `game/data/DATA_SCHEMA.md`.

Four factions, three-mission campaigns, fog of war, designed per-mission rosters and
reinforcement waves, deterministic combat with a pre-commit forecast, an XP economy,
structures, cipher puzzles that unlock lore fragments, and endings that bend to your choices.

**Accessibility:** the board is pointer-first (mouse or touch) with keyboard shortcuts for
every verb (1-4, U undo, Enter end turn, Esc pause, ? manual). Unit identity never relies
on color alone (each class has a distinct shape mark), the palette is tuned for
deuteranopia, and interface motion respects `prefers-reduced-motion`. Full keyboard board
navigation is not supported yet.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in OAuth credentials
npm run dev
```

`npm run build` for production, `npm run typecheck` and `npm run lint` for checks.

## License

MIT — see [LICENSE](LICENSE). Font attribution in [NOTICE](NOTICE).
