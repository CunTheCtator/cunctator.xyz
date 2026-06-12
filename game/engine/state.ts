import type {
  GameState,
  GameAction,
  FactionData,
  UnitData,
  CommanderData,
  MapTerrainConfig,
  Tile,
  TileType,
  Unit,
  UnitTrait,
  PuzzleNode,
  ArmyEffect,
  Structure,
  RosterEntry,
  SpawnZoneRect,
  SpawnPoint,
  PendingReinforcement,
  GameEvent,
  Difficulty,
} from "./types";
import type { FlatTextGridRef } from "./types";
import type { GameDataBundle } from "../data/loader";
import { buildPerturbArray } from "../canvas/perturb";
import { paintedTerrainActive } from "./painted-terrain";
import { HELVYN_LAYOUT } from "../data/maps/helvyn-layout";
import { calculateFog } from "./fog";
import {
  pushEngineEvents,
  removeCommanderArmyEffect,
  recalcFog,
  structureVisionSources,
  triggerProximityTrap,
  applyStructureStrikes,
} from "./structure-effects";
import { calculateStartingBudget, calculateEnemyBudget, ACTION_COSTS } from "./budget";
import { getReachableTiles, isValidMove } from "./movement";
import {
  isInAttackRange,
  resolveAttack,
  applyTraitsOnAttack,
  chebyshevDistance,
  tickArmyEffects,
  tickMarkedUnits,
} from "./combat";
import { checkVictory } from "./victory";
import { runEnemyTurn } from "./ai";
import { generateCipherPuzzle, isAnswerCorrect, markFragmentUsed } from "./puzzle";

const TILE_DEFS: Record<TileType, Omit<Tile, "type">> = {
  plains:    { passable: true,  moveCost: 1 },
  open:      { passable: true,  moveCost: 1 },
  mountain:  { passable: false, moveCost: 99 },
  structure: { passable: true,  moveCost: 1 },
  objective: { passable: true,  moveCost: 1 },
  ruins:     { passable: true,  moveCost: 2 },
  water:     { passable: false, moveCost: 99 },
  resource:  { passable: true,  moveCost: 1 },
};

function buildGrid(tiles: TileType[][]): Tile[][] {
  return tiles.map((row) =>
    row.map((type) => ({ type, ...(TILE_DEFS[type] ?? TILE_DEFS.plains) }))
  );
}

function buildGridWithCharOverrides(tiles: TileType[][], chars: string[][] | null): Tile[][] {
  if (!chars) return buildGrid(tiles);
  return tiles.map((row, r) =>
    row.map((type, c) => {
      const base = { type, ...(TILE_DEFS[type] ?? TILE_DEFS.plains) };
      const ch = chars[r]?.[c];
      const ov = ch ? FLAT_TEXT_OVERRIDES[ch] : undefined;
      return ov ? { ...base, ...ov } : base;
    })
  );
}

type RegionSpecTile = { type: string; resource?: boolean };
type RegionSpec = {
  format: "region-spec";
  size: number;
  defaultTile: RegionSpecTile;
  regions: { rows: [number, number]; cols: [number, number]; tile: RegionSpecTile }[];
  tileOverrides: { row: number; col: number; tile: RegionSpecTile }[];
};

function compileRegionSpec(spec: RegionSpec): TileType[][] {
  const size = spec.size;
  const toType = (t: RegionSpecTile): TileType =>
    t.resource ? "resource" : (t.type as TileType);

  const types: TileType[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => toType(spec.defaultTile))
  );

  for (const region of spec.regions) {
    const [r0, r1] = region.rows;
    const [c0, c1] = region.cols;
    const tileType = toType(region.tile);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r < size && c < size) types[r][c] = tileType;
      }
    }
  }

  for (const ov of spec.tileOverrides) {
    if (ov.row < size && ov.col < size) types[ov.row][ov.col] = toType(ov.tile);
  }

  return types;
}

const GRID_SIZE = 64;

const FLAT_TEXT_OVERRIDES: Record<string, Partial<Tile>> = {
  W: { passable: false, moveCost: 99, blocksVision: true },
  F: { passable: true, moveCost: 1 },
};

const FLAT_TEXT_SOURCES: Record<string, string> = {
  "helvyn-layout": HELVYN_LAYOUT,
};

function parseFlatTextLayout(text: string, size: number): { tiles: TileType[][]; rawChars: string[][] } {
  const lines = text.split("\n").filter((l) => l.length > 0);
  if (lines.length !== size) throw new Error(`flat-text grid: expected ${size} lines, got ${lines.length}`);
  const tiles: TileType[][] = [];
  const rawChars: string[][] = [];
  for (let r = 0; r < size; r++) {
    const line = lines[r];
    if (line.length !== size) throw new Error(`flat-text grid: row ${r} length ${line.length}, expected ${size}`);
    const row: TileType[] = [];
    const charRow: string[] = [];
    for (let c = 0; c < size; c++) {
      const ch = line[c];
      charRow.push(ch);
      switch (ch) {
        case ".": row.push("open"); break;
        case "M": row.push("mountain"); break;
        case "R": row.push("ruins"); break;
        case "W": row.push("structure"); break;
        case "F": row.push("open"); break;
        default: throw new Error(`flat-text grid: unknown char "${ch}" at row ${r}, col ${c}`);
      }
    }
    tiles.push(row);
    rawChars.push(charRow);
  }
  return { tiles, rawChars };
}

function applyTerrainRuinsOverride(tileTypes: TileType[][], terrain: MapTerrainConfig, size: number): void {
  if (paintedTerrainActive(terrain)) return;
  const perturb = buildPerturbArray(terrain.ruinsPerturb, size, terrain.seed);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let inOverride = false;
      for (const ov of terrain.renderTypeOverrides) {
        if (r >= ov.rows[0] && r <= ov.rows[1] && c >= ov.cols[0] && c <= ov.cols[1]) {
          inOverride = true;
          break;
        }
      }
      if (inOverride) continue;
      const t = tileTypes[r][c];
      if (t !== "ruins" && t !== "open") continue;
      tileTypes[r][c] = perturb[r * size + c] === 1 ? "ruins" : "open";
    }
  }
}

function buildFlatGrid(): Tile[][] {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ type: "plains" as TileType, passable: true, moveCost: 1 }))
  );
}

function spawnCenter(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 5, y: 5 };
  const x = Math.round(points.reduce((s, p) => s + p.x, 0) / points.length);
  const y = Math.round(points.reduce((s, p) => s + p.y, 0) / points.length);
  return { x, y };
}

let nextUnitId = 1;
let nextStructureId = 1;

export function syncIdCounters(state: GameState): void {
  let maxUnit = 0;
  for (const u of state.units) maxUnit = Math.max(maxUnit, u.id);
  for (const r of state.pendingReinforcements) {
    for (const u of r.units) maxUnit = Math.max(maxUnit, u.id);
  }
  nextUnitId = maxUnit + 1;

  let maxStruct = 0;
  for (const s of state.structures) {
    const m = s.id.match(/^struct_(\d+)$/);
    if (m) maxStruct = Math.max(maxStruct, Number(m[1]));
  }
  nextStructureId = maxStruct + 1;
}

const UNKILLABLE_HP = 99999;

function mapStatsToUnit(stats: { health: number; attack: number; defense: number; movementRange: number; visionRange: number; actionCost: number }) {
  const hp = stats.health === -1 ? UNKILLABLE_HP : stats.health;
  return {
    hp,
    maxHp:       hp,
    attack:      stats.attack,
    defense:     stats.defense,
    moveRange:   stats.movementRange,
    attackRange: 1,
    visionRange: stats.visionRange,
  };
}

function createUnitsFromData(
  faction: FactionData,
  unitDefs: UnitData[],
  commanderDef: CommanderData,
  spawnPoints: { x: number; y: number }[],
  gateSecondTrait: boolean,
  lockedOut: Record<number, UnitTrait>
): Unit[] {
  const units: Unit[] = [];
  let spawnIdx = 0;

  const spawn0 = spawnPoints[spawnIdx++] ?? { x: 0, y: 0 };
  units.push(instantiateUnit(specFromCommanderDef(commanderDef), faction.id, spawn0));

  for (const unitDef of unitDefs) {
    if (spawnIdx >= spawnPoints.length) break;
    const spawn = spawnPoints[spawnIdx++];
    const spec = specFromUnitDef(unitDef, gateSecondTrait);
    const unit = instantiateUnit(spec, faction.id, spawn);
    if (spec.lockedSecondTrait) lockedOut[unit.id] = spec.lockedSecondTrait;
    units.push(unit);
  }

  return units;
}

function commanderArmyEffect(commanderDef: CommanderData, commanderUnitId: number): ArmyEffect | null {
  const pe = commanderDef.passiveEffect;
  if (pe.target !== "army") return null;
  return {
    id: `passive_${commanderDef.id}`,
    effectId: pe.type,
    type: pe.type,
    magnitude: pe.magnitude,
    duration: -1,
    sourceCommander: commanderUnitId,
  };
}

type UnitSpawnSpec = {
  unitDataId: string;
  name: string;
  role: string;
  isBuilder: boolean;
  isCommander: boolean;
  isExtractor: boolean;
  unkillable: boolean;
  stats: UnitData["stats"];
  traits: UnitTrait[];
  lockedSecondTrait: UnitTrait | null;
};

function specFromUnitDef(def: UnitData, gateSecondTrait: boolean): UnitSpawnSpec {
  const gate = gateSecondTrait && def.traits.length > 1;
  return {
    unitDataId: def.id,
    name: def.name,
    role: def.role,
    isBuilder: def.isBuilder,
    isCommander: false,
    isExtractor: def.isExtractor ?? false,
    unkillable: def.unkillable ?? false,
    stats: def.stats,
    traits: gate ? def.traits.slice(0, 1) : def.traits,
    lockedSecondTrait: gate ? def.traits[1] : null,
  };
}

function specFromCommanderDef(def: CommanderData): UnitSpawnSpec {
  return {
    unitDataId: def.id,
    name: def.name,
    role: "commander",
    isBuilder: false,
    isCommander: true,
    isExtractor: false,
    unkillable: false,
    stats: def.stats,
    traits: def.traits,
    lockedSecondTrait: null,
  };
}

function instantiateUnit(spec: UnitSpawnSpec, factionId: string, pos: { x: number; y: number }): Unit {
  return {
    id: nextUnitId++,
    unitDataId: spec.unitDataId,
    faction: factionId,
    type: spec.unitDataId,
    name: spec.name,
    role: spec.role,
    isBuilder: spec.isBuilder,
    isCommander: spec.isCommander,
    isExtractor: spec.isExtractor,
    unkillable: spec.unkillable,
    extractorLevel: 1,
    xp: 0,
    kills: 0,
    aiMode: "attack",
    x: pos.x,
    y: pos.y,
    ...mapStatsToUnit(spec.stats),
    hasMoved: false,
    hasActed: false,
    movedTiles: 0,
    repositionMoves: 0,
    usedTraits: [],
    statusEffects: [],
    traits: spec.traits,
  };
}

function rectTilePoints(rect: SpawnZoneRect): SpawnPoint[] {
  const pts: SpawnPoint[] = [];
  for (let r = rect.rows[0]; r <= rect.rows[1]; r++) {
    for (let c = rect.cols[0]; c <= rect.cols[1]; c++) pts.push({ row: r, col: c });
  }
  return pts;
}

function buildSpawnPools(
  rects: SpawnZoneRect[] | undefined,
  flat: { x: number; y: number }[],
  grid: Tile[][]
): { x: number; y: number }[][] {
  if (rects && rects.length > 0) {
    return rects.map((rect) =>
      rectTilePoints(rect)
        .map((p) => ({ x: p.col, y: p.row }))
        .filter((p) => grid[p.y]?.[p.x]?.passable)
    );
  }
  return [flat.filter((p) => grid[p.y]?.[p.x]?.passable)];
}

function createUnitsFromRoster(
  factionId: string,
  roster: RosterEntry[],
  allUnitDefs: UnitData[],
  commanderDef: CommanderData | null,
  pools: { x: number; y: number }[][],
  occupied: Set<string>,
  gateSecondTrait: boolean,
  lockedOut: Record<number, UnitTrait>
): Unit[] {
  const units: Unit[] = [];

  const takeTile = (zone: number): { x: number; y: number } | null => {
    const order = [zone, ...pools.map((_, i) => i).filter((i) => i !== zone)];
    for (const zi of order) {
      const pool = pools[zi];
      if (!pool) continue;
      const tile = pool.find((p) => !occupied.has(`${p.x},${p.y}`));
      if (tile) {
        occupied.add(`${tile.x},${tile.y}`);
        return tile;
      }
    }
    return null;
  };

  let commanderPlaced = false;
  for (const entry of roster) {
    if (entry.commander && commanderDef && !commanderPlaced) {
      const tile = takeTile(entry.spawnZone);
      if (tile) {
        units.push(instantiateUnit(specFromCommanderDef(commanderDef), factionId, tile));
        commanderPlaced = true;
      }
    }
    const def = allUnitDefs.find((d) => d.id === entry.unitId);
    if (!def) {
      console.error(`[state] roster unit not found: ${entry.unitId}`);
      continue;
    }
    for (let i = 0; i < entry.count; i++) {
      const tile = takeTile(entry.spawnZone);
      if (!tile) {
        console.warn(`[state] no free spawn tile for ${entry.unitId} (zone ${entry.spawnZone})`);
        break;
      }
      const spec = specFromUnitDef(def, gateSecondTrait);
      const unit = instantiateUnit(spec, factionId, tile);
      if (spec.lockedSecondTrait) lockedOut[unit.id] = spec.lockedSecondTrait;
      units.push(unit);
    }
  }

  if (commanderDef && !commanderPlaced) {
    const tile = takeTile(0);
    if (tile) units.unshift(instantiateUnit(specFromCommanderDef(commanderDef), factionId, tile));
    else console.error(`[state] could not place commander ${commanderDef.id} — no free spawn tile`);
  }

  return units;
}

function applyDifficultyToUnits(units: Unit[], difficulty: Difficulty): Unit[] {
  if (difficulty !== "easy") return units;
  return units.map((u) => {
    if (u.unkillable) return { ...u, attack: Math.max(0, u.attack - 1) };
    const hp = Math.max(1, Math.round(u.hp * 0.85));
    return { ...u, hp, maxHp: hp, attack: Math.max(0, u.attack - 1), defense: Math.max(0, u.defense - 1) };
  });
}

function spawnDueReinforcements(state: GameState): GameState {
  const due = state.pendingReinforcements.filter((r) => !r.spawned && r.turn <= state.turn);
  if (due.length === 0) return state;

  const units = [...state.units];
  const occupied = new Set(units.map((u) => `${u.x},${u.y}`));
  const events: Omit<GameEvent, "id">[] = [];

  for (const wave of due) {
    let placed = 0;
    for (const tmpl of wave.units) {
      const tile = wave.tiles.find((t) => {
        const key = `${t.col},${t.row}`;
        return !occupied.has(key) && state.grid[t.row]?.[t.col]?.passable;
      });
      if (!tile) {
        console.warn(`[state] no free tile for reinforcement ${tmpl.unitDataId} in wave "${wave.label}"`);
        continue;
      }
      occupied.add(`${tile.col},${tile.row}`);
      units.push({ ...tmpl, x: tile.col, y: tile.row });
      placed++;
    }
    if (placed > 0) {
      events.push({ turn: state.turn, kind: "atk", text: `*${wave.label}* — hostile reinforcements arrive (${placed}).` });
    }
  }

  const pendingReinforcements = state.pendingReinforcements.map((r) =>
    due.includes(r) ? { ...r, spawned: true } : r
  );

  let next: GameState = { ...state, units, pendingReinforcements };
  const fog = recalcFog(next, units);
  const lastKnown = { ...next.lastKnownPositions };
  for (const u of units.filter((u) => u.faction === next.enemyFaction)) {
    if (fog[u.y]?.[u.x]) lastKnown[u.id] = { x: u.x, y: u.y };
  }
  next = { ...next, fog, lastKnownPositions: lastKnown };
  return pushEngineEvents(next, events);
}


export function initGame(
  data: GameDataBundle,
  mapId: string,
  playerFactionId: string,
  commanderId: string,
  enemyFactionId: string,
  missionKey?: string,
  options?: { difficulty?: Difficulty }
): GameState | null {
  nextUnitId = 1;
  nextStructureId = 1;

  const map = data.maps.find((m) => m.id === mapId);
  if (!map) { console.error(`[state] Map not found: ${mapId}`); return null; }

  const playerFaction = data.factions.find((f) => f.id === playerFactionId);
  if (!playerFaction) { console.error(`[state] Player faction not found: ${playerFactionId}`); return null; }

  const enemyFaction = data.factions.find((f) => f.id === enemyFactionId);
  if (!enemyFaction) { console.error(`[state] Enemy faction not found: ${enemyFactionId}`); return null; }

  const playerCommanderDef =
    data.commanders.find((c) => c.id === commanderId && c.factionId === playerFactionId) ??
    data.commanders.find((c) => c.factionId === playerFactionId);
  if (!playerCommanderDef) { console.error(`[state] Commander not found: ${commanderId}`); return null; }

  const enemyCommanderDef = data.commanders.find((c) => c.factionId === enemyFactionId);
  if (!enemyCommanderDef) { console.error(`[state] No commander for enemy faction: ${enemyFactionId}`); return null; }

  const playerUnitDefs = data.units.filter((u) => u.factionId === playerFactionId);
  const enemyUnitDefs = data.units.filter((u) => u.factionId === enemyFactionId);

  const missionOverride = missionKey ? map.missionOverrides[missionKey] : null;
  const spawnOverride = missionOverride?.spawnOverride ?? null;

  const playerOverride = spawnOverride?.player;
  const enemyOverride = spawnOverride?.enemy;
  const playerSrc = Array.isArray(playerOverride) ? playerOverride : map.defaultSpawnZones.player;
  const enemySrc  = Array.isArray(enemyOverride)  ? enemyOverride  : map.defaultSpawnZones.enemy;
  if (spawnOverride?.player && !Array.isArray(playerOverride)) {
    console.warn(`[state] spawnOverride.player for ${missionKey} is a descriptor string (${JSON.stringify(playerOverride)}); using map default`);
  }
  if (spawnOverride?.enemy && !Array.isArray(enemyOverride)) {
    console.warn(`[state] spawnOverride.enemy for ${missionKey} is a descriptor string (${JSON.stringify(enemyOverride)}); using map default`);
  }
  const playerSpawns = playerSrc.map((p) => ({ x: p.col, y: p.row }));
  const enemySpawns  = enemySrc.map((p)  => ({ x: p.col, y: p.row }));

  const rawGrid = map.grid as unknown;
  let tileTypes: TileType[][];
  let flatTextChars: string[][] | null = null;
  if (!rawGrid) {
    tileTypes = null as unknown as TileType[][];
  } else if (Array.isArray(rawGrid)) {
    tileTypes = rawGrid as TileType[][];
  } else if ((rawGrid as { format?: string }).format === "flat-text") {
    const ref = rawGrid as FlatTextGridRef;
    const text = FLAT_TEXT_SOURCES[ref.source];
    if (!text) throw new Error(`flat-text grid source not registered: ${ref.source}`);
    const parsed = parseFlatTextLayout(text, GRID_SIZE);
    tileTypes = parsed.tiles;
    flatTextChars = parsed.rawChars;
  } else {
    tileTypes = compileRegionSpec(rawGrid as RegionSpec);
  }
  if (tileTypes && map.terrain) {
    applyTerrainRuinsOverride(tileTypes, map.terrain, GRID_SIZE);
  }
  if (tileTypes && map.resourceTiles) {
    for (const rt of map.resourceTiles) {
      if (rt.row >= 0 && rt.row < GRID_SIZE && rt.col >= 0 && rt.col < GRID_SIZE) {
        tileTypes[rt.row][rt.col] = "resource";
      }
    }
  }
  const grid = tileTypes ? buildGridWithCharOverrides(tileTypes, flatTextChars) : buildFlatGrid();

  const difficulty: Difficulty = options?.difficulty ?? "standard";
  const roster = missionOverride?.startingRosters ?? null;
  const hasRoster = !!roster && roster.player.length > 0 && roster.enemy.length > 0;
  const lockedSecondTraits: Record<number, UnitTrait> = {};

  let playerUnits: Unit[];
  let enemyUnits: Unit[];
  if (hasRoster && roster) {
    const occupied = new Set<string>();
    const playerPools = buildSpawnPools(missionOverride?.spawnZoneRects?.player, playerSpawns, grid);
    const enemyPools = buildSpawnPools(missionOverride?.spawnZoneRects?.enemy, enemySpawns, grid);
    playerUnits = createUnitsFromRoster(playerFactionId, roster.player, data.units, playerCommanderDef, playerPools, occupied, true, lockedSecondTraits);
    enemyUnits = createUnitsFromRoster(enemyFactionId, roster.enemy, data.units, null, enemyPools, occupied, false, lockedSecondTraits);
  } else {
    playerUnits = createUnitsFromData(playerFaction, playerUnitDefs, playerCommanderDef, playerSpawns, true, lockedSecondTraits);
    enemyUnits = createUnitsFromData(enemyFaction, enemyUnitDefs, enemyCommanderDef, enemySpawns, false, lockedSecondTraits);
  }
  enemyUnits = applyDifficultyToUnits(enemyUnits, difficulty);
  const allUnits = [...playerUnits, ...enemyUnits];

  const waveDefs = missionOverride?.reinforcements ?? [];
  const reinfEntries = roster?.reinforcements ?? [];
  const pendingReinforcements: PendingReinforcement[] = waveDefs.map((w, i) => {
    const entries = reinfEntries.filter((e) => e.spawnZone === i);
    const waveUnits: Unit[] = [];
    for (const entry of entries) {
      const def = data.units.find((d) => d.id === entry.unitId);
      if (!def) {
        console.error(`[state] reinforcement unit not found: ${entry.unitId}`);
        continue;
      }
      for (let n = 0; n < entry.count; n++) {
        waveUnits.push(instantiateUnit(specFromUnitDef(def, false), enemyFactionId, { x: -1, y: -1 }));
      }
    }
    return { turn: w.turn, label: w.label, tiles: w.tiles, units: applyDifficultyToUnits(waveUnits, difficulty), spawned: false };
  });

  const objectiveTiles = (missionOverride?.objectiveTiles ?? []).map((t) => ({ x: t.col, y: t.row, label: t.label }));

  const playerCommander = playerUnits.find((u) => u.isCommander)!;
  const armyEffect = commanderArmyEffect(playerCommanderDef, playerCommander.id);
  const armyEffects: ArmyEffect[] = armyEffect ? [armyEffect] : [];

  const fog = calculateFog(grid, allUnits, playerFactionId);

  const lastKnownPositions: Record<number, { x: number; y: number }> = {};
  for (const unit of enemyUnits) {
    if (fog[unit.y]?.[unit.x]) lastKnownPositions[unit.id] = { x: unit.x, y: unit.y };
  }

  const puzzleNodes: PuzzleNode[] = map.puzzleNodes.map((n) => ({
    id: n.id, label: n.label, x: n.col, y: n.row,
    activationRange: n.activationRange, reward: n.reward, activated: false,
  }));

  const fragmentPool = [...data.puzzleFragments.fragments];
  const puzzleDef = {
    symbols: data.puzzleFragments.symbols,
    encodedLength: data.puzzleFragments.encodedLength,
    fragmentDisplayDuration: data.puzzleFragments.mechanics.fragmentDisplayDuration,
  };

  const consequenceVarId = playerFaction.consequenceVariable?.id ?? "unknown";
  const isAmbush = missionOverride?.ambushStart ?? false;

  const partialState: GameState = {
    phase: isAmbush ? "enemy-turn" : "player-turn",
    mapId: map.id,
    grid,
    units: allUnits,
    structures: [],
    structureDefs: data.structures ?? [],
    globalCurrency: 0,
    enemyGlobalCurrency: 0,
    playerFaction: playerFactionId,
    enemyFaction: enemyFactionId,
    turn: 1,
    actionBudget: 0,
    selectedUnitId: null,
    reachableTiles: null,
    fog,
    lastKnownPositions,
    puzzleNodes,
    playerSpawnCenter: spawnCenter(playerSpawns),
    enemySpawnCenter: spawnCenter(enemySpawns),
    armyEffects,
    enemyArmyEffects: [],
    markedUnits: {},
    activePuzzle: null,
    consequenceVariable: { id: consequenceVarId, value: 0 },
    fragmentPool,
    puzzleDef,
    pendingMilestones: [],
    abilityDefs: data.abilities ?? [],
    missionKey: missionKey ?? "",
    firedTriggers: [],
    enemyCountAtStart: enemyUnits.length,
    events: [{ id: 1, turn: 1, kind: "sys", text: "Detachment deployed. Hold the Remnant site." }],
    objectiveTiles,
    pendingReinforcements,
    xpMilestones: data.economy.xp.milestones,
    lockedSecondTraits,
    pendingMove: null,
    difficulty,
  };

  const withBudget = { ...partialState, actionBudget: calculateStartingBudget(partialState) };
  if (isAmbush) return runEnemyTurn(prepareEnemyTurnState(withBudget));
  return withBudget;
}

export function prepareEnemyTurnState(state: GameState): GameState {
  const resetUnits = state.units.map((u) =>
    u.faction === state.enemyFaction
      ? { ...u, hasMoved: false, hasActed: false, movedTiles: 0, repositionMoves: 0 }
      : u
  );
  let next: GameState = {
    ...state,
    units: resetUnits,
    phase: "enemy-turn",
    selectedUnitId: null,
    reachableTiles: null,
    turn: state.turn + 1,
    actionBudget: calculateEnemyBudget(state),
    pendingMove: null,
  };
  next = spawnDueReinforcements(next);
  next = applyStructureStrikes(next);
  return next;
}

function buildCtx(state: GameState) {
  return { armyEffects: state.armyEffects, allUnits: state.units, structures: state.structures, structureDefs: state.structureDefs };
}

export function dispatch(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SELECT_UNIT": {
      const unit = state.units.find((u) => u.id === action.unitId && u.faction === state.playerFaction);
      if (!unit) return state;
      const reachableTiles = (unit.hasMoved && unit.repositionMoves === 0) ? [] : getReachableTiles(state, unit);
      return { ...state, selectedUnitId: action.unitId, reachableTiles };
    }

    case "DESELECT":
      return { ...state, selectedUnitId: null, reachableTiles: null };

    case "MOVE_UNIT": {
      if (state.actionBudget < ACTION_COSTS.MOVE_UNIT) return state;
      const unit = state.units.find((u) => u.id === action.unitId);
      if (!unit || unit.faction !== state.playerFaction) return state;
      if (unit.hasMoved && unit.repositionMoves === 0) return state;
      if (!isValidMove(state, unit, action.to)) return state;

      const dist = chebyshevDistance(unit, action.to);
      const movedUnit: Unit = {
        ...unit,
        x: action.to.x,
        y: action.to.y,
        hasMoved: true,
        movedTiles: unit.movedTiles + dist,
        repositionMoves: 0,
      };
      const updatedUnits = state.units.map((u) => (u.id === action.unitId ? movedUnit : u));
      const fog = recalcFog({ ...state, units: updatedUnits }, updatedUnits);

      const newLastKnown = { ...state.lastKnownPositions };
      for (const u of updatedUnits.filter((u) => u.faction === state.enemyFaction)) {
        if (fog[u.y]?.[u.x]) newLastKnown[u.id] = { x: u.x, y: u.y };
      }

      let newState: GameState = {
        ...state,
        units: updatedUnits,
        fog,
        lastKnownPositions: newLastKnown,
        actionBudget: state.actionBudget - ACTION_COSTS.MOVE_UNIT,
        selectedUnitId: action.unitId,
        reachableTiles: null,
        pendingMove: unit.repositionMoves === 0
          ? { unitId: unit.id, fromX: unit.x, fromY: unit.y, movedTiles: unit.movedTiles }
          : null,
      };

      newState = triggerProximityTrap(newState, action.unitId);
      const survivor = newState.units.find((u) => u.id === action.unitId);
      if (!survivor) {
        newState = { ...newState, selectedUnitId: null, pendingMove: null };
        const trapVictory = checkVictory(newState);
        return trapVictory ? { ...newState, phase: trapVictory } : newState;
      }
      if (newState.structures !== state.structures) {
        newState = { ...newState, pendingMove: null };
      }

      // Check puzzle activation — also respect puzzle_range trait
      const puzzleRange = movedUnit.traits.find(
        (t) => t.effect.type === "puzzle_range" && t.effect.target === "self" && t.effect.condition === null
      )?.effect.magnitude ?? 0;

      const activatingNode = newState.puzzleNodes.find(
        (n) =>
          !n.activated &&
          chebyshevDistance(action.to, { x: n.x, y: n.y }) <= n.activationRange + puzzleRange
      );

      if (activatingNode) {
        const puzzle = generateCipherPuzzle(activatingNode.id, newState);
        newState = { ...newState, activePuzzle: puzzle, pendingMove: null };
      }

      const victory = checkVictory(newState);
      return victory ? { ...newState, phase: victory } : newState;
    }

    case "UNDO_MOVE": {
      const pm = state.pendingMove;
      if (!pm) return state;
      if (state.activePuzzle) return state;
      const unit = state.units.find((u) => u.id === pm.unitId && u.faction === state.playerFaction);
      if (!unit || unit.hasActed) return { ...state, pendingMove: null };
      if (state.units.some((u) => u.id !== unit.id && u.x === pm.fromX && u.y === pm.fromY)) return state;

      const restored: Unit = { ...unit, x: pm.fromX, y: pm.fromY, hasMoved: pm.movedTiles > 0, movedTiles: pm.movedTiles, repositionMoves: 0 };
      const updatedUnits = state.units.map((u) => (u.id === pm.unitId ? restored : u));
      const fog = recalcFog({ ...state, units: updatedUnits }, updatedUnits);

      const undone: GameState = {
        ...state,
        units: updatedUnits,
        fog,
        actionBudget: state.actionBudget + ACTION_COSTS.MOVE_UNIT,
        selectedUnitId: pm.unitId,
        reachableTiles: null,
        pendingMove: null,
      };
      return { ...undone, reachableTiles: getReachableTiles(undone, restored) };
    }

    case "ATTACK": {
      if (state.actionBudget < ACTION_COSTS.ATTACK) return state;
      const attacker = state.units.find((u) => u.id === action.attackerId && u.faction === state.playerFaction);
      const defender = state.units.find((u) => u.id === action.targetId && u.faction === state.enemyFaction);
      if (!attacker || !defender || attacker.hasActed) return state;
      if (!isInAttackRange(attacker, defender, buildCtx(state))) return state;

      const ctx = buildCtx(state);
      const { defenderHp } = resolveAttack(attacker, defender, ctx);
      const { targetEffects, attackerMoves, enemyBudgetDebuff } = applyTraitsOnAttack(attacker, defender);

      const damageDealt = defender.hp - Math.max(0, defenderHp);
      const defenderDied = defender.unkillable ? false : defenderHp <= 0;
      const actualDefenderHp = defender.unkillable ? Math.max(1, defenderHp) : defenderHp;

      const xpGain = defenderDied
        ? 1
        : Math.min(1, damageDealt / defender.maxHp);

      const prevXp = attacker.xp;
      const newXp = prevXp + xpGain;
      const ms = state.xpMilestones;

      const statChoiceMilestone = newXp >= ms.statIncrease && prevXp < ms.statIncrease
        ? [{ unitId: attacker.id, type: "stat_choice" as const }]
        : [];

      const autoUnlockTraits = [...attacker.traits];
      let newLockedSecondTraits = state.lockedSecondTraits;
      if (newXp >= ms.secondTrait && prevXp < ms.secondTrait) {
        const locked = state.lockedSecondTraits[attacker.id];
        if (locked && !autoUnlockTraits.some((t) => t.id === locked.id)) {
          autoUnlockTraits.push(locked);
          newLockedSecondTraits = { ...state.lockedSecondTraits };
          delete newLockedSecondTraits[attacker.id];
        }
      }
      for (const { threshold, slot } of [{ threshold: ms.ability1Unlock, slot: 1 }, { threshold: ms.ability2Unlock, slot: 2 }]) {
        if (newXp >= threshold && prevXp < threshold) {
          const abilityDef = state.abilityDefs.find((a) => a.unitId === attacker.unitDataId && a.slot === slot);
          if (abilityDef && !autoUnlockTraits.some((t) => t.id === abilityDef.id)) {
            const eff = abilityDef.effect as Record<string, unknown>;
            autoUnlockTraits.push({
              id: abilityDef.id,
              name: abilityDef.name,
              description: abilityDef.description,
              effect: {
                type: (eff.type as string) ?? "unknown",
                target: (eff.target as string) ?? "self",
                magnitude: (eff.magnitude as number) ?? 0,
                duration: (eff.duration as number) ?? 1,
                condition: "on_activate",
              },
            });
          }
        }
      }

      const attackedUnit: Unit = {
        ...attacker,
        hasActed: attackerMoves > 0 ? false : true,
        repositionMoves: attackerMoves,
        xp: newXp,
        kills: defenderDied ? attacker.kills + 1 : attacker.kills,
        traits: autoUnlockTraits,
      };

      let updatedUnits = state.units.map((u) => (u.id === action.attackerId ? attackedUnit : u));
      let newStructures = state.structures;

      // Shatter: Breaker destroys enemy structures when attacking
      const hasShatter = attacker.traits.some((t) => t.id === "trait_shatter");
      if (hasShatter) {
        const enemyStruct = state.structures.find((s) => s.x === defender.x && s.y === defender.y && s.factionId !== state.playerFaction);
        if (enemyStruct) {
          newStructures = newStructures.filter((s) => s.id !== enemyStruct.id);
          const structDef = state.structureDefs.find((d) => d.id === enemyStruct.structureDefId);
          const destroyDamage = (structDef?.effect as { destroyDamage?: number } | undefined)?.destroyDamage ?? 0;
          if (destroyDamage > 0) {
            updatedUnits = updatedUnits.map((u) =>
              u.id === action.attackerId && !u.unkillable ? { ...u, hp: u.hp - destroyDamage } : u
            );
            updatedUnits = updatedUnits.filter((u) => u.id !== action.attackerId || u.hp > 0);
          }
        }
      }

      if (defenderDied) {
        updatedUnits = updatedUnits.filter((u) => u.id !== action.targetId);

        // on_kill: Relentless — grant another attack
        const hasRelentless = attacker.traits.some(
          (t) => t.effect.condition === "on_kill" && t.effect.type === "action-budget" && t.effect.target === "self" && t.effect.magnitude > 0
        );
        if (hasRelentless) {
          updatedUnits = updatedUnits.map((u) => (u.id === action.attackerId ? { ...u, hasActed: false } : u));
        }
      } else {
        updatedUnits = updatedUnits.map((u) => {
          if (u.id !== action.targetId) return u;
          return { ...u, hp: actualDefenderHp, statusEffects: [...u.statusEffects, ...targetEffects] };
        });
      }

      let newEnemyArmyEffects = state.enemyArmyEffects;
      if (enemyBudgetDebuff) {
        newEnemyArmyEffects = [
          ...newEnemyArmyEffects,
          {
            id: `debuff_${Date.now()}`,
            effectId: "action-budget-debuff",
            type: "action-budget",
            magnitude: enemyBudgetDebuff.magnitude,
            duration: enemyBudgetDebuff.duration,
          },
        ];
      }

      // Retaliation: if defender survived and attacker is within defender's attack range
      const defenderUnit = updatedUnits.find((u) => u.id === action.targetId);
      if (defenderUnit && !defenderDied) {
        const retCtx = { ...ctx, allUnits: updatedUnits };
        if (isInAttackRange(defenderUnit, attackedUnit, retCtx)) {
          const { defenderHp: retAttackerHp } = resolveAttack(defenderUnit, attackedUnit, retCtx);
          const retAttackerDied = attackedUnit.unkillable ? false : retAttackerHp <= 0;
          const actualRetHp = attackedUnit.unkillable ? Math.max(1, retAttackerHp) : retAttackerHp;
          if (retAttackerDied) {
            updatedUnits = updatedUnits.filter((u) => u.id !== action.attackerId);
          } else {
            updatedUnits = updatedUnits.map((u) =>
              u.id === action.attackerId ? { ...u, hp: actualRetHp } : u
            );
          }
        }
      }

      const fog = recalcFog({ ...state, units: updatedUnits, structures: newStructures }, updatedUnits);
      const newLastKnown = { ...state.lastKnownPositions };
      if (defenderDied) delete newLastKnown[action.targetId];
      if (!updatedUnits.find((u) => u.id === action.attackerId)) delete newLastKnown[action.attackerId];

      let newState: GameState = {
        ...state,
        units: updatedUnits,
        structures: newStructures,
        fog,
        lastKnownPositions: newLastKnown,
        enemyArmyEffects: newEnemyArmyEffects,
        actionBudget: state.actionBudget - ACTION_COSTS.ATTACK,
        selectedUnitId: attackerMoves > 0 && updatedUnits.find((u) => u.id === action.attackerId) ? action.attackerId : null,
        reachableTiles: attackerMoves > 0 && updatedUnits.find((u) => u.id === action.attackerId)
          ? getReachableTiles({ ...state, units: updatedUnits }, attackedUnit)
          : null,
        pendingMilestones: [...state.pendingMilestones, ...statChoiceMilestone],
        lockedSecondTraits: newLockedSecondTraits,
        pendingMove: null,
      };

      if (defenderDied) newState = removeCommanderArmyEffect(newState, action.targetId);

      const victory = checkVictory(newState);
      return victory ? { ...newState, phase: victory } : newState;
    }

    case "BUILD": {
      const unit = state.units.find((u) => u.id === action.unitId && u.faction === state.playerFaction);
      if (!unit || !unit.isBuilder || unit.hasActed) return state;

      if (chebyshevDistance(unit, action.at) > 1) return state;

      const tile = state.grid[action.at.y]?.[action.at.x];
      if (!tile?.passable) return state;
      if (state.units.some((u) => u.x === action.at.x && u.y === action.at.y)) return state;

      const isForwardWallUpgrade =
        action.structureDefId === "fortified_wall" &&
        state.structures.some((s) => s.x === action.at.x && s.y === action.at.y && s.structureDefId === "barrier" && s.factionId === unit.faction);

      if (!isForwardWallUpgrade && state.structures.some((s) => s.x === action.at.x && s.y === action.at.y)) return state;

      const hasEfficientConstruction = unit.traits.some((t) => t.id === "trait_efficient_construction");
      const actualActionCost = hasEfficientConstruction ? Math.max(0, ACTION_COSTS.BUILD - 1) : ACTION_COSTS.BUILD;
      if (state.actionBudget < actualActionCost) return state;

      const structureDef = state.structureDefs.find((d) => d.id === action.structureDefId);
      const baseDurability = structureDef?.durability ?? 30;

      const FORTIFIED_WALL_UPGRADE_COST = 70;
      const currencyCost = isForwardWallUpgrade ? FORTIFIED_WALL_UPGRADE_COST : (structureDef?.currencyCost ?? 50);

      if (state.globalCurrency < currencyCost) {
        console.warn(`[BUILD] Insufficient currency: have ${state.globalCurrency}, need ${currencyCost}`);
        return state;
      }

      const hasReinforced = unit.traits.some((t) => t.id === "trait_reinforced_construction");
      const structureHp = hasReinforced ? baseDurability * 2 : baseDurability;

      const newStructure: Structure = {
        id: `struct_${nextStructureId++}`,
        structureDefId: action.structureDefId,
        name: structureDef?.name ?? "Structure",
        x: action.at.x,
        y: action.at.y,
        factionId: unit.faction,
        builtBy: unit.unitDataId,
        hp: structureHp,
        maxHp: structureHp,
        currencyCost,
      };

      const structuresAfterUpgrade = isForwardWallUpgrade
        ? state.structures.filter((s) => !(s.x === action.at.x && s.y === action.at.y && s.structureDefId === "barrier"))
        : state.structures;

      return {
        ...state,
        units: state.units.map((u) => (u.id === unit.id ? { ...u, hasActed: true } : u)),
        structures: [...structuresAfterUpgrade, newStructure],
        globalCurrency: state.globalCurrency - currencyCost,
        actionBudget: state.actionBudget - actualActionCost,
        selectedUnitId: null,
        reachableTiles: null,
        pendingMove: null,
      };
    }

    case "DEMOLISH": {
      const unit = state.units.find((u) => u.id === action.unitId && u.faction === state.playerFaction);
      if (!unit || unit.hasActed) return state;
      if (state.actionBudget < ACTION_COSTS.DEMOLISH) return state;

      const structure = state.structures.find((s) => s.x === action.at.x && s.y === action.at.y);
      if (!structure) return state;
      if (chebyshevDistance(unit, action.at) > 1) return state;

      let updatedUnits = state.units.map((u) => (u.id === unit.id ? { ...u, hasActed: true } : u));

      // Booby trap: Rigger's enemy structures damage the demolisher
      const isEnemyRigger = structure.factionId !== state.playerFaction && structure.builtBy.includes("rigger");
      if (isEnemyRigger) {
        const boobyTrapTrait = state.units
          .find((u) => u.unitDataId === structure.builtBy)
          ?.traits.find((t) => t.id === "trait_booby_trap");
        const trapDamage = boobyTrapTrait?.effect.magnitude ?? 8;
        updatedUnits = updatedUnits.map((u) => {
          if (u.id !== unit.id) return u;
          return { ...u, hp: Math.max(0, u.hp - trapDamage) };
        });
        updatedUnits = updatedUnits.filter((u) => u.id !== unit.id || u.hp > 0);
      }

      // Spike wall: demolishing an enemy spike wall wounds the demolisher
      if (structure.factionId !== state.playerFaction) {
        const structDef = state.structureDefs.find((d) => d.id === structure.structureDefId);
        const destroyDamage = (structDef?.effect as { destroyDamage?: number } | undefined)?.destroyDamage ?? 0;
        if (destroyDamage > 0) {
          updatedUnits = updatedUnits.map((u) =>
            u.id === unit.id && !u.unkillable ? { ...u, hp: u.hp - destroyDamage } : u
          );
          updatedUnits = updatedUnits.filter((u) => u.id !== unit.id || u.hp > 0);
        }
      }

      const stateForFog = { ...state, units: updatedUnits, structures: state.structures.filter((s) => s.id !== structure.id) };
      const fog = recalcFog(stateForFog, updatedUnits);
      const victory = checkVictory({ ...state, units: updatedUnits });

      const newState: GameState = {
        ...state,
        units: updatedUnits,
        structures: state.structures.filter((s) => s.id !== structure.id),
        fog,
        actionBudget: state.actionBudget - ACTION_COSTS.DEMOLISH,
        selectedUnitId: null,
        reachableTiles: null,
        pendingMove: null,
      };

      return victory ? { ...newState, phase: victory } : newState;
    }

    case "USE_ABILITY": {
      const unit = state.units.find((u) => u.id === action.unitId && u.faction === state.playerFaction);
      if (!unit) return state;

      const trait = unit.traits.find((t) => t.id === action.traitId);
      if (!trait) return state;

      const { condition, target, type, magnitude, duration } = trait.effect;

      if (condition === "once_per_mission" && unit.usedTraits.includes(trait.id)) return state;
      if (unit.statusEffects.some((e) => e.id === `${trait.id}_cooldown`)) return state;

      if (state.actionBudget < ACTION_COSTS.USE_ABILITY) return state;

      const abilityDef = state.abilityDefs.find((a) => a.id === trait.id);
      if (abilityDef && abilityDef.currencyCost > 0 && state.globalCurrency < abilityDef.currencyCost) {
        console.warn(`[USE_ABILITY] Insufficient currency: have ${state.globalCurrency}, need ${abilityDef.currencyCost}`);
        return state;
      }

      const cooldownDuration = abilityDef?.cooldown ?? (condition === "once_per_turn" ? 1 : 0);

      let updatedUnits = state.units.map((u) => {
        if (u.id !== unit.id) return u;
        const newUsed = condition === "once_per_mission" ? [...u.usedTraits, trait.id] : u.usedTraits;
        const cooldownEffect = cooldownDuration > 0
          ? [{ id: `${trait.id}_cooldown`, duration: cooldownDuration, modifier: {} }]
          : [];
        return { ...u, usedTraits: newUsed, statusEffects: [...u.statusEffects, ...cooldownEffect] };
      });

      let newEnemyArmyEffects = state.enemyArmyEffects;
      const newMarkedUnits = { ...state.markedUnits };

      if (target === "enemy_army") {
        newEnemyArmyEffects = [
          ...newEnemyArmyEffects,
          {
            id: `ability_${trait.id}_${Date.now()}`,
            effectId: type,
            type,
            magnitude,
            duration,
          },
        ];
      }

      if (target === "enemy_unit" && action.targetUnitId !== undefined) {
        if (type === "vision") {
          newMarkedUnits[action.targetUnitId] = duration;
          updatedUnits = updatedUnits.map((u) => {
            if (u.id !== action.targetUnitId) return u;
            return { ...u, statusEffects: [...u.statusEffects, { id: trait.id, duration, modifier: { defense: -1 } }] };
          });
        }
      }

      if (target === "area" && action.targetTile) {
        const statKeys: (keyof { attack: number; defense: number; moveRange: number })[] = ["attack", "defense", "moveRange"];
        const debuffKey = statKeys[Math.floor(Math.random() * statKeys.length)];
        updatedUnits = updatedUnits.map((u) => {
          if (chebyshevDistance(u, action.targetTile!) > magnitude) return u;
          return {
            ...u,
            statusEffects: [
              ...u.statusEffects,
              { id: `chaos_${u.id}`, duration: 2, modifier: { [debuffKey]: -2 } as Record<string, number> },
            ],
          };
        });
      }

      const fog = calculateFog(state.grid, updatedUnits, state.playerFaction, newMarkedUnits, structureVisionSources(state, state.playerFaction));

      return {
        ...state,
        units: updatedUnits,
        enemyArmyEffects: newEnemyArmyEffects,
        markedUnits: newMarkedUnits,
        fog,
        globalCurrency: abilityDef ? state.globalCurrency - abilityDef.currencyCost : state.globalCurrency,
        actionBudget: state.actionBudget - ACTION_COSTS.USE_ABILITY,
        selectedUnitId: null,
        reachableTiles: null,
        pendingMove: null,
      };
    }

    case "PUZZLE_SUBMIT": {
      const puzzle = state.activePuzzle;
      if (!puzzle) return state;

      const node = state.puzzleNodes.find((n) => n.id === puzzle.nodeId);
      if (!node) return { ...state, activePuzzle: null };

      if (!isAnswerCorrect({ ...puzzle, answer: action.answer })) {
        return {
          ...state,
          activePuzzle: null,
          puzzleNodes: state.puzzleNodes.map((n) => (n.id === node.id ? { ...n, activated: true } : n)),
        };
      }

      let newFragmentPool = state.fragmentPool;
      let showingPuzzle: typeof state.activePuzzle = null;

      if (puzzle.fragment) {
        newFragmentPool = markFragmentUsed(state.fragmentPool, puzzle.fragment.id);
        showingPuzzle = { ...puzzle, answer: action.answer, showingFragment: true };
      }

      const activatedNodes = state.puzzleNodes.map((n) => (n.id === node.id ? { ...n, activated: true } : n));
      const armyBuff = applyPuzzleReward(state, node.reward.effectId);

      return {
        ...state,
        puzzleNodes: activatedNodes,
        activePuzzle: showingPuzzle,
        fragmentPool: newFragmentPool,
        armyEffects: armyBuff ? [...state.armyEffects, armyBuff] : state.armyEffects,
      };
    }

    case "PUZZLE_SKIP": {
      const puzzle = state.activePuzzle;
      if (!puzzle) return state;
      return {
        ...state,
        activePuzzle: null,
        puzzleNodes: state.puzzleNodes.map((n) => (n.id === puzzle.nodeId ? { ...n, activated: true } : n)),
      };
    }

    case "CONSEQUENCE_DELTA":
      return {
        ...state,
        consequenceVariable: {
          ...state.consequenceVariable,
          value: state.consequenceVariable.value + action.delta,
        },
      };

    case "CHOOSE_STAT": {
      const unit = state.units.find((u) => u.id === action.unitId && u.faction === state.playerFaction);
      if (!unit) return state;
      const hasMilestone = state.pendingMilestones.some((m) => m.unitId === action.unitId && m.type === "stat_choice");
      if (!hasMilestone) return state;

      const statDelta: Partial<Unit> = {};
      if (action.stat === "attack")    { statDelta.attack = unit.attack + 2; }
      if (action.stat === "defense")   { statDelta.defense = unit.defense + 2; }
      if (action.stat === "hp")        { statDelta.hp = unit.hp + 2; statDelta.maxHp = unit.maxHp + 2; }
      if (action.stat === "moveRange") { statDelta.moveRange = unit.moveRange + 1; }

      return {
        ...state,
        units: state.units.map((u) => u.id === action.unitId ? { ...u, ...statDelta } : u),
        pendingMilestones: state.pendingMilestones.filter(
          (m) => !(m.unitId === action.unitId && m.type === "stat_choice")
        ),
      };
    }

    case "UPGRADE_EXTRACTOR": {
      if (state.actionBudget < ACTION_COSTS.UPGRADE_EXTRACTOR) return state;
      const builder = state.units.find((u) => u.id === action.unitId && u.faction === state.playerFaction && u.isBuilder);
      const extractor = state.units.find((u) => u.id === action.extractorId && u.faction === state.playerFaction && u.isExtractor);
      if (!builder || !extractor) return state;
      if (chebyshevDistance(builder, extractor) > 1) return state;
      if (extractor.extractorLevel >= 3) return state;

      const UPGRADE_COSTS: Record<number, number> = { 1: 200, 2: 400 };
      const cost = UPGRADE_COSTS[extractor.extractorLevel];
      if (cost === undefined) return state;
      if (state.globalCurrency < cost) {
        console.warn(`[UPGRADE_EXTRACTOR] Insufficient currency: have ${state.globalCurrency}, need ${cost}`);
        return state;
      }

      return {
        ...state,
        units: state.units.map((u) =>
          u.id === action.extractorId ? { ...u, extractorLevel: u.extractorLevel + 1 } : u
        ),
        globalCurrency: state.globalCurrency - cost,
        actionBudget: state.actionBudget - ACTION_COSTS.UPGRADE_EXTRACTOR,
        pendingMove: null,
      };
    }

    case "REPAIR_STRUCTURE": {
      if (state.actionBudget < ACTION_COSTS.REPAIR_STRUCTURE) return state;
      const builder = state.units.find((u) => u.id === action.unitId && u.faction === state.playerFaction && u.isBuilder);
      if (!builder) return state;
      const structure = state.structures.find((s) => s.x === action.at.x && s.y === action.at.y && s.factionId === state.playerFaction);
      if (!structure) return state;
      if (chebyshevDistance(builder, action.at) > 1) return state;
      if (structure.hp >= structure.maxHp) return state;

      const COST_PER_POINT = 2;
      const MAX_REPAIR = 10;
      const points = Math.min(MAX_REPAIR, structure.maxHp - structure.hp);
      const totalCost = points * COST_PER_POINT;
      if (state.globalCurrency < totalCost) {
        console.warn(`[REPAIR_STRUCTURE] Insufficient currency: have ${state.globalCurrency}, need ${totalCost}`);
        return state;
      }

      return {
        ...state,
        structures: state.structures.map((s) =>
          s.id === structure.id ? { ...s, hp: Math.min(s.maxHp, s.hp + points) } : s
        ),
        globalCurrency: state.globalCurrency - totalCost,
        actionBudget: state.actionBudget - ACTION_COSTS.REPAIR_STRUCTURE,
        units: state.units.map((u) => u.id === action.unitId ? { ...u, hasActed: true } : u),
        pendingMove: null,
      };
    }

    case "END_TURN": {
      const tickedMarked = tickMarkedUnits(state.markedUnits);
      const tickedEnemyEffects = tickArmyEffects(state.enemyArmyEffects);

      const { playerIncome, enemyIncome } = computeExtractorIncome(state);

      return runEnemyTurn(prepareEnemyTurnState({
        ...state,
        markedUnits: tickedMarked,
        enemyArmyEffects: tickedEnemyEffects,
        globalCurrency: state.globalCurrency + playerIncome,
        enemyGlobalCurrency: state.enemyGlobalCurrency + enemyIncome,
      }));
    }

    default:
      return state;
  }
}

export function computeExtractorIncome(state: GameState): { playerIncome: number; enemyIncome: number } {
  const BASE_OUTPUT = 50;
  const RELAY_BONUS = 25;

  function incomeForFaction(factionId: string): number {
    const extractor = state.units.find((u) => u.faction === factionId && u.isExtractor);
    if (!extractor) return 0;

    const adjacentOffsets = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    let resourceTileCount = 0;
    for (const [dx, dy] of adjacentOffsets) {
      const tile = state.grid[extractor.y + dy]?.[extractor.x + dx];
      if (tile?.type === "resource") resourceTileCount++;
    }
    if (resourceTileCount === 0) return 0;

    const multipliers = [1.0, 1.25, 1.5];
    const outputMultiplier = multipliers[extractor.extractorLevel - 1] ?? 1.0;

    const relayPosts = state.structures.filter(
      (s) => s.factionId === factionId &&
      s.structureDefId === "relay_post" &&
      Math.abs(s.x - extractor.x) + Math.abs(s.y - extractor.y) <= 4
    );

    return Math.floor(
      resourceTileCount * BASE_OUTPUT * outputMultiplier +
      relayPosts.length * RELAY_BONUS
    );
  }

  const SUPPLY_CACHE_BONUS = 20;
  const SUPPLY_CACHE_ID = "syndicate_supply_cache";

  const playerSupplyCaches = state.structures.filter(
    (s) => s.structureDefId === SUPPLY_CACHE_ID && s.factionId === state.playerFaction
  );
  const enemySupplyCaches = state.structures.filter(
    (s) => s.structureDefId === SUPPLY_CACHE_ID && s.factionId === state.enemyFaction
  );

  return {
    playerIncome: incomeForFaction(state.playerFaction) + playerSupplyCaches.length * SUPPLY_CACHE_BONUS,
    enemyIncome: incomeForFaction(state.enemyFaction) + enemySupplyCaches.length * SUPPLY_CACHE_BONUS,
  };
}

function applyPuzzleReward(state: GameState, effectId: string): ArmyEffect | null {
  if (state.armyEffects.some((e) => e.effectId === effectId)) return null;
  const durations: Record<string, number> = {
    inspired: 2, rallied: 2, fortified: 2, marked: 3, blinded: 2, famine: 2,
  };
  return {
    id: `puzzle_${effectId}_${Date.now()}`,
    effectId,
    type: effectId,
    magnitude: 1,
    duration: durations[effectId] ?? 2,
  };
}
