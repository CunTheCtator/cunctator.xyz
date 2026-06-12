import assert from "node:assert/strict";
import { gameData } from "../game/data/loader";
import { initGame, dispatch, prepareEnemyTurnState, computeExtractorIncome, syncIdCounters } from "../game/engine/state";
import { findPath } from "../game/engine/pathfinding";
import { resolveAttack, getEffectiveStats, tickStatusEffects } from "../game/engine/combat";
import { checkVictory } from "../game/engine/victory";
import { getReachableTiles } from "../game/engine/movement";
import { calculateStartingBudget } from "../game/engine/budget";
import { runEnemyTurn } from "../game/engine/ai";
import type { GameState, Tile, Unit, Structure } from "../game/engine/types";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed++;
    failures.push(name);
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err instanceof Error ? err.message : err}`);
  }
}

function freshState(missionKey = "covenant_m1", opts?: { difficulty?: "standard" | "easy" }): GameState {
  const state = initGame(gameData, "helvyn", "covenant", "covenant_confessor", "syndicate", missionKey, opts);
  if (!state) throw new Error("initGame returned null");
  return state;
}

function playerUnits(s: GameState): Unit[] {
  return s.units.filter((u) => u.faction === s.playerFaction);
}

function enemyUnits(s: GameState): Unit[] {
  return s.units.filter((u) => u.faction === s.enemyFaction);
}

function openTileNear(s: GameState, x: number, y: number): { x: number; y: number } {
  for (let r = 0; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        const tile = s.grid[ty]?.[tx];
        if (!tile?.passable) continue;
        if (s.units.some((u) => u.x === tx && u.y === ty)) continue;
        if (s.structures.some((st) => st.x === tx && st.y === ty)) continue;
        return { x: tx, y: ty };
      }
    }
  }
  throw new Error("no open tile found");
}

function placeUnit(s: GameState, unit: Unit, x: number, y: number): GameState {
  return { ...s, units: s.units.map((u) => (u.id === unit.id ? { ...u, x, y } : u)) };
}

function makeStructure(defId: string, factionId: string, x: number, y: number): Structure {
  const def = gameData.structures.find((d) => d.id === defId);
  if (!def) throw new Error(`no structure def ${defId}`);
  return {
    id: `struct_test_${defId}_${x}_${y}`,
    structureDefId: defId,
    name: def.name,
    x,
    y,
    factionId,
    builtBy: "test",
    hp: def.durability,
    maxHp: def.durability,
    currencyCost: def.currencyCost,
  };
}

console.log("\n== pathfinding ==");

const flat: Tile[][] = Array.from({ length: 8 }, () =>
  Array.from({ length: 8 }, () => ({ type: "open" as const, passable: true, moveCost: 1 }))
);

test("straight path has manhattan length", () => {
  const p = findPath(flat, [], { x: 0, y: 0 }, { x: 5, y: 0 });
  assert.ok(p);
  assert.equal(p.length, 5);
  assert.deepEqual(p[p.length - 1], { x: 5, y: 0 });
});

test("wall forces a detour", () => {
  const walled = flat.map((row) => row.map((t) => ({ ...t })));
  for (let y = 0; y < 7; y++) walled[y][3].passable = false;
  const p = findPath(walled, [], { x: 0, y: 0 }, { x: 6, y: 0 });
  assert.ok(p);
  assert.ok(p.length > 6);
  assert.ok(p.every((step) => walled[step.y][step.x].passable));
});

test("fully sealed goal returns null", () => {
  const sealed = flat.map((row) => row.map((t) => ({ ...t })));
  for (let y = 0; y < 8; y++) sealed[y][3].passable = false;
  assert.equal(findPath(sealed, [], { x: 0, y: 0 }, { x: 6, y: 0 }), null);
});

test("blockedTiles parameter blocks", () => {
  const blockers = Array.from({ length: 8 }, (_, y) => ({ x: 3, y }));
  assert.equal(findPath(flat, [], { x: 0, y: 0 }, { x: 6, y: 0 }, blockers), null);
});

console.log("\n== combat math ==");

test("damage is max(1, atk - def)", () => {
  const s = freshState();
  const a = playerUnits(s).find((u) => !u.isExtractor && !u.isCommander);
  const d = enemyUnits(s).find((u) => !u.isExtractor);
  assert.ok(a && d);
  const effA = getEffectiveStats(a);
  const effD = getEffectiveStats(d);
  const { defenderHp } = resolveAttack(a, d);
  assert.equal(d.hp - defenderHp, Math.max(1, effA.attack - effD.defense));
});

test("status modifier changes effective stats", () => {
  const s = freshState();
  const u = playerUnits(s)[1];
  const debuffed: Unit = { ...u, statusEffects: [{ id: "slowed", duration: 2, modifier: { moveRange: -2 } }] };
  assert.equal(getEffectiveStats(debuffed).moveRange, Math.max(0, u.moveRange - 2));
});

test("war totem aura buffs attack within range 4", () => {
  const s = freshState();
  const u = { ...playerUnits(s)[1], faction: "vrath" };
  const totem = makeStructure("vrath_war_totem", "vrath", u.x + 2, u.y);
  const ctx = { structures: [totem], structureDefs: gameData.structures, allUnits: [u] };
  const base = getEffectiveStats(u).attack;
  const buffed = getEffectiveStats(u, ctx).attack;
  assert.equal(buffed, base + 3);
});

test("cover bonus when standing on own barrier", () => {
  const s = freshState();
  const u = playerUnits(s)[1];
  const barrier = makeStructure("barrier", u.faction, u.x, u.y);
  const ctx = { structures: [barrier], structureDefs: gameData.structures, allUnits: [u] };
  assert.equal(getEffectiveStats(u, ctx).defense, getEffectiveStats(u).defense + 1);
});

test("status effects tick down and expire", () => {
  const s = freshState();
  const u = playerUnits(s)[1];
  const withStatus = s.units.map((x) =>
    x.id === u.id ? { ...x, statusEffects: [{ id: "t", duration: 1, modifier: {} }, { id: "t2", duration: 2, modifier: {} }] } : x
  );
  const ticked = tickStatusEffects(withStatus, s.playerFaction);
  const after = ticked.find((x) => x.id === u.id);
  assert.ok(after);
  assert.equal(after.statusEffects.length, 1);
  assert.equal(after.statusEffects[0].duration, 1);
});

console.log("\n== XP and milestones ==");

test("kill grants exactly 1 XP and a stat milestone fires at threshold", () => {
  let s = freshState();
  const ms = s.xpMilestones;
  const attacker = playerUnits(s).find((u) => !u.isExtractor && !u.isCommander);
  const victim = enemyUnits(s).find((u) => !u.isExtractor);
  assert.ok(attacker && victim);
  const spot = openTileNear(s, attacker.x, attacker.y);
  s = placeUnit(s, victim, spot.x, spot.y);
  s = {
    ...s,
    units: s.units.map((u) => {
      if (u.id === victim.id) return { ...u, x: spot.x, y: spot.y, hp: 1, defense: 0 };
      if (u.id === attacker.id) return { ...u, xp: ms.statIncrease - 1 };
      return u;
    }),
  };
  const after = dispatch(s, { type: "ATTACK", attackerId: attacker.id, targetId: victim.id });
  const a = after.units.find((u) => u.id === attacker.id);
  assert.ok(a);
  assert.equal(a.xp, ms.statIncrease);
  assert.equal(a.kills, 1);
  assert.ok(!after.units.some((u) => u.id === victim.id));
  assert.ok(after.pendingMilestones.some((m) => m.unitId === attacker.id && m.type === "stat_choice"));
});

test("wound grants damage/maxHp XP", () => {
  let s = freshState();
  const attacker = playerUnits(s).find((u) => !u.isExtractor && !u.isCommander);
  const victim = enemyUnits(s).find((u) => !u.isExtractor);
  assert.ok(attacker && victim);
  const spot = openTileNear(s, attacker.x, attacker.y);
  s = {
    ...s,
    units: s.units.map((u) =>
      u.id === victim.id ? { ...u, x: spot.x, y: spot.y, hp: u.maxHp } : u
    ),
  };
  const before = s.units.find((u) => u.id === victim.id);
  assert.ok(before);
  const after = dispatch(s, { type: "ATTACK", attackerId: attacker.id, targetId: victim.id });
  const v = after.units.find((u) => u.id === victim.id);
  const a = after.units.find((u) => u.id === attacker.id);
  assert.ok(v && a);
  const dmg = before.hp - v.hp;
  assert.ok(Math.abs(a.xp - Math.min(1, dmg / before.maxHp)) < 1e-9);
});

test("second trait is gated at spawn and unlocks at the milestone", () => {
  let s = freshState();
  const ms = s.xpMilestones;
  const gated = playerUnits(s).find((u) => s.lockedSecondTraits[u.id]);
  assert.ok(gated, "expected at least one player unit with a locked second trait");
  const lockedTrait = s.lockedSecondTraits[gated.id];
  assert.ok(!gated.traits.some((t) => t.id === lockedTrait.id));

  const victim = enemyUnits(s).find((u) => !u.isExtractor);
  assert.ok(victim);
  const spot = openTileNear(s, gated.x, gated.y);
  s = {
    ...s,
    units: s.units.map((u) => {
      if (u.id === victim.id) return { ...u, x: spot.x, y: spot.y, hp: 1, defense: 0 };
      if (u.id === gated.id) return { ...u, xp: ms.secondTrait - 1 };
      return u;
    }),
  };
  const after = dispatch(s, { type: "ATTACK", attackerId: gated.id, targetId: victim.id });
  const g = after.units.find((u) => u.id === gated.id);
  assert.ok(g);
  assert.ok(g.traits.some((t) => t.id === lockedTrait.id), "second trait should be unlocked");
  assert.ok(!after.lockedSecondTraits[gated.id]);
});

test("enemy units spawn with all their traits (no gating)", () => {
  const s = freshState();
  for (const e of enemyUnits(s)) {
    const def = gameData.units.find((d) => d.id === e.unitDataId);
    if (def) assert.equal(e.traits.length, def.traits.length);
  }
});

test("ability unlocks appear at ability1/ability2 thresholds", () => {
  let s = freshState();
  const ms = s.xpMilestones;
  const attacker = playerUnits(s).find((u) => !u.isExtractor && !u.isCommander && gameData.abilities.some((a) => a.unitId === u.unitDataId && a.slot === 1));
  const victim = enemyUnits(s).find((u) => !u.isExtractor);
  assert.ok(attacker && victim);
  const abilityDef = gameData.abilities.find((a) => a.unitId === attacker.unitDataId && a.slot === 1);
  assert.ok(abilityDef);
  const spot = openTileNear(s, attacker.x, attacker.y);
  s = {
    ...s,
    units: s.units.map((u) => {
      if (u.id === victim.id) return { ...u, x: spot.x, y: spot.y, hp: 1, defense: 0 };
      if (u.id === attacker.id) return { ...u, xp: ms.ability1Unlock - 1 };
      return u;
    }),
  };
  const after = dispatch(s, { type: "ATTACK", attackerId: attacker.id, targetId: victim.id });
  const a = after.units.find((u) => u.id === attacker.id);
  assert.ok(a);
  assert.ok(a.traits.some((t) => t.id === abilityDef.id));
});

console.log("\n== win / loss ==");

test("no enemies and no pending waves is a win", () => {
  const s = freshState();
  const cleared = { ...s, units: s.units.filter((u) => u.faction !== s.enemyFaction), pendingReinforcements: [] };
  assert.equal(checkVictory(cleared), "win");
});

test("victory is withheld while a wave is unspawned", () => {
  const s = freshState("covenant_m2");
  assert.ok(s.pendingReinforcements.length > 0);
  const cleared = { ...s, units: s.units.filter((u) => u.faction !== s.enemyFaction) };
  assert.equal(checkVictory(cleared), null);
});

test("dead commander is a loss", () => {
  const s = freshState();
  const noCommander = { ...s, units: s.units.filter((u) => !(u.faction === s.playerFaction && u.isCommander)) };
  assert.equal(checkVictory(noCommander), "loss");
});

console.log("\n== undo ==");

test("undo restores position, flag, and budget; dies after acting", () => {
  let s = freshState();
  const u = playerUnits(s).find((x) => !x.isExtractor && !x.hasMoved);
  assert.ok(u);
  const reach = getReachableTiles(s, u);
  assert.ok(reach.length > 0);
  const dest = reach[0];
  const budgetBefore = s.actionBudget;
  s = dispatch(s, { type: "SELECT_UNIT", unitId: u.id });
  s = dispatch(s, { type: "MOVE_UNIT", unitId: u.id, to: dest });
  const moved = s.units.find((x) => x.id === u.id);
  assert.ok(moved && moved.x === dest.x && moved.y === dest.y && moved.hasMoved);
  assert.ok(s.pendingMove && s.pendingMove.unitId === u.id);

  const undone = dispatch(s, { type: "UNDO_MOVE" });
  const restored = undone.units.find((x) => x.id === u.id);
  assert.ok(restored);
  assert.equal(restored.x, u.x);
  assert.equal(restored.y, u.y);
  assert.equal(restored.hasMoved, false);
  assert.equal(undone.actionBudget, budgetBefore);
  assert.equal(undone.pendingMove, null);
});

test("acting clears the undo snapshot", () => {
  let s = freshState();
  const attacker = playerUnits(s).find((u) => !u.isExtractor && !u.isCommander);
  const victim = enemyUnits(s).find((u) => !u.isExtractor);
  assert.ok(attacker && victim);
  const reach = getReachableTiles(s, attacker);
  s = dispatch(s, { type: "MOVE_UNIT", unitId: attacker.id, to: reach[0] });
  assert.ok(s.pendingMove);
  const movedAttacker = s.units.find((u) => u.id === attacker.id);
  assert.ok(movedAttacker);
  const spot = openTileNear(s, movedAttacker.x, movedAttacker.y);
  s = { ...s, units: s.units.map((u) => (u.id === victim.id ? { ...u, x: spot.x, y: spot.y } : u)) };
  s = dispatch(s, { type: "ATTACK", attackerId: attacker.id, targetId: victim.id });
  assert.equal(s.pendingMove, null);
  assert.equal(dispatch(s, { type: "UNDO_MOVE" }), s);
});

console.log("\n== structures in play ==");

test("hostile barrier blocks movement, friendly does not", () => {
  const s = freshState();
  const u = playerUnits(s).find((x) => !x.isExtractor);
  assert.ok(u);
  const spot = openTileNear(s, u.x, u.y);
  const hostile = { ...s, structures: [makeStructure("barrier", s.enemyFaction, spot.x, spot.y)] };
  assert.ok(!getReachableTiles(hostile, u).some((t) => t.x === spot.x && t.y === spot.y));
  const friendly = { ...s, structures: [makeStructure("barrier", s.playerFaction, spot.x, spot.y)] };
  assert.ok(getReachableTiles(friendly, u).some((t) => t.x === spot.x && t.y === spot.y));
});

test("booby trap detonates on entry", () => {
  let s = freshState();
  const u = playerUnits(s).find((x) => !x.isExtractor && !x.isCommander);
  assert.ok(u);
  const reach = getReachableTiles(s, u);
  const dest = reach[reach.length - 1];
  const trap = makeStructure("pirates_booby_trap", s.enemyFaction, dest.x, dest.y);
  s = { ...s, structures: [trap] };
  const hpBefore = u.hp;
  const after = dispatch(s, { type: "MOVE_UNIT", unitId: u.id, to: dest });
  const moved = after.units.find((x) => x.id === u.id);
  if (moved) {
    assert.equal(moved.hp, hpBefore - 20);
  }
  assert.ok(!after.structures.some((st) => st.id === trap.id), "trap should be consumed");
});

test("turret fires at the nearest enemy at enemy-turn start", () => {
  let s = freshState();
  const target = playerUnits(s).find((u) => !u.isExtractor && !u.unkillable);
  assert.ok(target);
  const isolated = openTileNear(s, 30, 55);
  s = placeUnit(s, target, isolated.x, isolated.y);
  const turret = makeStructure("turret", s.enemyFaction, isolated.x + 1, isolated.y);
  s = { ...s, structures: [turret] };
  const hpBefore = target.hp;
  const prepared = prepareEnemyTurnState(s);
  const after = prepared.units.find((u) => u.id === target.id);
  assert.ok(after);
  assert.equal(after.hp, hpBefore - 3);
});

test("sanctified ground burns adjacent enemies each round", () => {
  let s = freshState();
  const victim = enemyUnits(s).find((u) => !u.isExtractor && !u.unkillable);
  assert.ok(victim);
  const ground = makeStructure("covenant_sanctified_ground", s.playerFaction, victim.x + 1, victim.y);
  s = { ...s, structures: [ground] };
  const hpBefore = victim.hp;
  const prepared = prepareEnemyTurnState(s);
  const after = prepared.units.find((u) => u.id === victim.id);
  assert.ok(after);
  assert.equal(after.hp, hpBefore - 2);
});

console.log("\n== economy ==");

test("extractor income scales with adjacent resource tiles", () => {
  const s = freshState();
  const extractor = playerUnits(s).find((u) => u.isExtractor);
  assert.ok(extractor);
  const grid = s.grid.map((row) => row.map((t) => ({ ...t })));
  grid[extractor.y][extractor.x + 1] = { type: "resource", passable: true, moveCost: 1 };
  grid[extractor.y][extractor.x - 1] = { type: "resource", passable: true, moveCost: 1 };
  const { playerIncome } = computeExtractorIncome({ ...s, grid });
  assert.equal(playerIncome, 100);
});

test("standing on a friendly structure grants +1 budget", () => {
  const s = freshState();
  const u = playerUnits(s)[1];
  const base = calculateStartingBudget(s);
  const boosted = calculateStartingBudget({ ...s, structures: [makeStructure("barrier", s.playerFaction, u.x, u.y)] });
  assert.equal(boosted, base + 1);
});

console.log("\n== difficulty ==");

test("easy mode softens enemy stats", () => {
  const std = freshState("covenant_m1", { difficulty: "standard" });
  const easy = freshState("covenant_m1", { difficulty: "easy" });
  const stdEnemy = enemyUnits(std).find((u) => !u.unkillable);
  const easyEnemy = enemyUnits(easy).find((u) => u.unitDataId === stdEnemy?.unitDataId);
  assert.ok(stdEnemy && easyEnemy);
  assert.equal(easyEnemy.attack, Math.max(0, stdEnemy.attack - 1));
  assert.ok(easyEnemy.maxHp < stdEnemy.maxHp);
});

console.log("\n== save roundtrip ==");

test("state survives JSON roundtrip and keeps playing", () => {
  const s = freshState();
  const revived = JSON.parse(JSON.stringify(s)) as GameState;
  syncIdCounters(revived);
  const u = revived.units.find((x) => x.faction === revived.playerFaction && !x.isExtractor);
  assert.ok(u);
  const selected = dispatch(revived, { type: "SELECT_UNIT", unitId: u.id });
  assert.equal(selected.selectedUnitId, u.id);
  const afterTurn = runEnemyTurn(prepareEnemyTurnState(selected));
  assert.ok(afterTurn.turn === revived.turn + 1);
});

test("reinforcement wave spawns exactly on its turn", () => {
  let s = freshState("covenant_m2");
  const wave = s.pendingReinforcements[0];
  assert.ok(wave);
  while (s.turn < wave.turn - 1) {
    s = { ...s, phase: "player-turn" };
    s = prepareEnemyTurnState(s);
    s = { ...s, phase: "player-turn" };
  }
  assert.ok(!s.pendingReinforcements[0].spawned);
  s = prepareEnemyTurnState(s);
  assert.ok(s.pendingReinforcements[0].spawned);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error("failures:", failures.join(" | "));
  process.exit(1);
}
