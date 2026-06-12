# DATA_SCHEMA.md — Game Data Files

Reference for every file in `game/data/`. These JSON files are the source of truth for the
tactics game — adding content (units, abilities, maps, narrative) means editing JSON, not code.
The engine reads them; it never writes them.

Loaded at startup via [`loader.ts`](./loader.ts) into a `GameDataBundle`. Maps are compiled to a
64×64 tile grid at runtime in [`../engine/state.ts`](../engine/state.ts).

Convention: object keys in data use the same `id` strings the engine joins on
(`factionId`, `unitId`, `factionId_unitname`, etc.). IDs are stable — renaming one means updating
every reference.

---

## factions.json

Root: **array** of 4 factions (`covenant`, `syndicate`, `vrath`, `pirates`).

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable faction key; referenced by `factionId` everywhere |
| `name` | string | Display name |
| `species` | string | Human / alien species label |
| `color` | string | Hex accent for faction UI |
| `playStyle` | string | One-line design summary |
| `remnantRelation` | string | Lore: relationship to the Remnant |
| `amplificationType` | string | Faction-specific amplification flavor |
| `consequenceVariable` | object | `{ id, label, description, lowThreshold, highThreshold }` — the hidden per-campaign variable; thresholds gate which ending plays |

---

## units.json

Root: **array** of 24 units (6 per faction × 4 factions).

| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `covenant_keeper` |
| `factionId` | string | FK → `factions.id` |
| `name` | string | Display name |
| `role` | string | Tactical role label |
| `isBuilder` | boolean | Builder units place/repair structures (weaker combat) |
| `stats` | object | `{ health, attack, defense, movementRange, visionRange, actionCost }` |
| `traits` | array | 2 per unit: `{ id, name, description, effect }` |

The Extractor unit lives here too (flagged by role/stats, not a separate file): unkillable,
no attack, movement 1.

---

## commanders.json

Root: **array** of 8 commanders (2 per faction).

| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `covenant_aeathas` |
| `factionId` | string | FK → `factions.id` |
| `passiveLabel` / `passiveDescription` | string | Army-wide passive shown in select screen |
| `passiveEffect` | object | `{ type, target, magnitude, condition }` — applied to all friendly units while the commander lives, removed on death |
| `stats` | object | Same shape as unit `stats` |
| `traits` | array | `{ id, name, description, effect }` |

Commanders get **3** ability slots (units get 2). See `abilities.json`.

---

## abilities.json

Root: **array** of 72 abilities. Keyed to a unit or commander by `unitId`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Ability key |
| `unitId` | string | FK → `units.id` or `commanders.id` |
| `slot` | number | 1–2 for units, 1–3 for commanders |
| `name` / `description` | string | |
| `xpUnlock` | number | XP threshold before the ability can be purchased |
| `currencyCost` | number | Currency to unlock for use |
| `cooldown` | number | Turns between uses; `-1` = once per mission (`oncePer: "mission"`) |
| `effect` | object | `{ type, target, redirectTo?, duration? }` |

---

## status-effects.json

Root: **array** of 10 effects (6 unit-level, 4 army-level).

| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `slowed`, `famine` |
| `name` | string | |
| `level` | string | `"unit"` or `"army"` |
| `description` | string | |
| `duration` | number | Turns; counts down per turn |
| `type` | string | Effect category |
| `magnitude` | number | Strength |
| `stackable` | boolean | |
| `curable` | boolean | |
| `source` | string | What applies it |

Rule enforced in engine, not data: at most **one army-level debuff** active on a force at a time.

---

## structures.json

Root: **array** of 13 structures (5 shared + 2 per faction).

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `name` | string | |
| `faction` | string | Faction key, or shared marker |
| `category` | string | Structure class |
| `currencyCost` | number | Build cost (Builder only) |
| `durability` | number | Base HP; repair cannot exceed it |
| `repairCostPerPoint` | number | Currency per durability point |
| `description` | string | |
| `effect` | object | `{ type, ... }` — e.g. `coverBonus` for walls |

---

## economy.json

Root: **object**. Central tuning file.

| Key | Shape | Notes |
|---|---|---|
| `xp` | `{ milestones: { statIncrease, secondTrait, ability1Unlock, ability2Unlock }, statIncreaseAmount, statIncreasePlayerChoice, statIncreaseOptions[3], system: { killBonus, damageShareFormula, killerReceivesDamageShare, carryOverSamePlanet, carryOverDifferentPlanet, globalCurrencyCarriesOverAlways } }` | Milestones are kill counts (2/4/6/7). `statIncreaseOptions` = attack/defense/movementRange |
| `resourceTiles` | `{ baseOutputPerTurn, relayPostBonus, supplyCacheBonusPerTurn, extractorUpgrades[{ level, cost, outputMultiplier, label }], note }` | Extractor income tuning |
| `unitReplacementCosts` | `{ <unitId>: number, …, commanders: number }` | Per-unit respawn cost. Extractor entries are strings (non-numeric / special) |
| `structureCosts` | object | Per-structure build costs |
| `structureRepair` | `{ actionCostPerRepair, durabilityRestoredPerAction, currencyCostPerPoint, requiresAdjacentBuilder, cannotExceedBaseDurability }` | |
| `cooldownDefaults` | object | Fallback cooldowns |
| `balanceNotes` | — | Free-text design notes |

---

## puzzle-fragments.json

Root: **object** for the positional-cipher puzzle nodes.

| Key | Shape | Notes |
|---|---|---|
| `symbols` | array `{ id, glyph, label }` | The 5 cipher symbols |
| `encodedLength` | number | Length of the encoded string |
| `keySize` | number | Symbols in the rotating key |
| `mechanics` | `{ activationRange, timeLimit, penaltyOnFailure, nodeDeactivatesOnSkip, fragmentDisplayDuration }` | `penaltyOnFailure: false` — skipping is safe |
| `fragments` | array `{ id, text, used }` × 40 | Lore reward pool. `used` flag resets on **campaign** start (not mission) |

---

## maps/*.json

Five maps: `helvyn`, `karadun`, `saren-volyn`, `yelvar`, `ac-411`. Common shape:

| Field | Type | Notes |
|---|---|---|
| `id`, `name`, `world`, `description`, `ambientRegister` | string | Metadata / flavor |
| `usedInMissions` | array `{ campaign, mission, side }` | Which campaign missions reuse this map |
| `grid` | object | Tile layout — **two formats**, see below |
| `resourceTiles` | array `{ row, col }` | (Helvyn) explicit resource tiles; region-spec maps embed resources via tile `resource: true` |
| `keyFeatures` | array `{ id, type, label, description }` | Named landmarks |
| `defaultSpawnZones` | `{ player: [...], enemy: [...] }` | Default deploy areas |
| `puzzleNodes` | array `{ id, label, row, col, activationRange, note, reward }` | Puzzle node placements |
| `missionOverrides` | object keyed by `<campaign>_m<n>` | `{ objectiveLabel, enemyFaction, ambushStart, spawnOverride, conditionalElements }` per mission that uses this map |
| `terrain` | object | Renderer config (palette, perturbation, painted-tile assets). Helvyn is fully painted; others use procedural fields |

### grid formats

**flat-text** (Helvyn):
```json
"grid": { "format": "flat-text", "source": "helvyn-layout" }
```
`source` maps to a registered 64×64 string array (`game/data/maps/helvyn-layout.ts`, `HELVYN_LAYOUT`).
Chars: `M`=mountain, `R`=ruins, `.`=open, `W`=structure, `F`=open(spire floor). Parsed by
`parseFlatTextLayout` in `state.ts`.

**region-spec** (Karadun, Saren-Volyn, Yelvar, AC-411):
```json
"grid": {
  "format": "region-spec",
  "size": 64,
  "implementation": "Apply regions in order. Then apply tileOverrides. Build final 64x64 array.",
  "defaultTile": { "type": "open", "movementCost": 1, "blocksVision": false, "destructible": false, "resource": false },
  "regions": [{ "label": "...", "rows": [r0, r1], "cols": [c0, c1], "tile": { ... } }],
  "tileOverrides": [{ "row": n, "col": n, "label": "...", "tile": { ... } }]
}
```
Compiled by `compileRegionSpec` in `state.ts`: fill with `defaultTile`, apply each region rectangle
in order, then apply per-cell `tileOverrides`. A tile with `resource: true` becomes a resource tile.

---

## narrative.json

Root: **object** with two keys: `scenes` and `midMissionTriggers`.

### scenes
Map of `sceneId` → scene. ~40 scenes: per campaign there are `_intro`, `_m{n}_intro`, `_m{n}_post`,
`_ending[_low|_mid|_high]`, plus the shared `sheifport_hub` and named mid-mission scenes.

Scene shape:
```json
{ "initialBackground": "...", "initialLeft": "spriteId|null", "initialRight": {...}|null, "beats": [ ... ] }
```

### beats
Ordered array. `type` determines the shape:

| `type` | Fields | Meaning |
|---|---|---|
| `dialogue` | `{ speaker, text }` | A spoken line; click/tap to advance |
| `set_sprites` | `{ left, right }` | Swap character sprites (`null` clears a side) |
| `set_background` | `{ background }` | Change background |
| `choice` | `{ options: [{ text, delta, choiceId, optionKey }] }` | Player choice. `delta` adjusts the campaign consequence variable; `choiceId` + `optionKey` are recorded (and read by `lib/pirate-unlock.ts`) |

### midMissionTriggers
Map of trigger key → array of `{ id, sceneId, conditions: [...] }` — fires a scene mid-mission when
conditions are met (from `missionOverrides.conditionalElements`).

---

## Authoring rules (from CLAUDE.md / HANDOFF)

- **Caevyn:** no pronouns in any displayed `text`. Gender is never established.
- **Commander:** never appears on screen — no `set_sprites` may show the player's commander.
- IDs are foreign keys. Renaming a faction/unit/ability id means updating every reference
  (units → factions, abilities → units, maps `missionOverrides.enemyFaction`, narrative `speaker`).
- Adding content = adding JSON entries. No engine changes required for new units, abilities,
  structures, status effects, fragments, or narrative beats.
