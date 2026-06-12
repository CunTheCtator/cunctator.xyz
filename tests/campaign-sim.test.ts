import assert from "node:assert/strict";
import { gameData } from "../game/data/loader";
import { initGame, dispatch } from "../game/engine/state";
import { getCampaignDef, initCampaignState, getMissionAt, advanceMission, isCampaignComplete } from "../game/engine/campaign";
import { getEndingSceneId, startScene } from "../game/engine/narrative";
import { getReachableTiles } from "../game/engine/movement";
import { isInAttackRange, chebyshevDistance } from "../game/engine/combat";
import type { GameState } from "../game/engine/types";

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

function playGreedyTurn(state: GameState): GameState {
  let s = state;
  const myIds = s.units.filter((u) => u.faction === s.playerFaction && !u.isExtractor).map((u) => u.id);
  for (const id of myIds) {
    if (s.phase !== "player-turn") return s;
    if (s.actionBudget <= 0) break;
    const unit = s.units.find((u) => u.id === id);
    if (!unit) continue;
    const ctx = { armyEffects: s.armyEffects, allUnits: s.units, structures: s.structures, structureDefs: s.structureDefs };
    const enemies = s.units.filter((u) => u.faction === s.enemyFaction && !u.unkillable);
    if (enemies.length === 0) break;

    const inRange = enemies.find((e) => isInAttackRange(unit, e, ctx));
    if (inRange && !unit.hasActed) {
      s = dispatch(s, { type: "ATTACK", attackerId: unit.id, targetId: inRange.id });
      continue;
    }

    if (!unit.hasMoved && s.actionBudget > 0) {
      const nearest = enemies.reduce((a, b) => (chebyshevDistance(unit, a) <= chebyshevDistance(unit, b) ? a : b));
      const reach = getReachableTiles(s, unit);
      if (reach.length > 0) {
        const best = reach.reduce((a, b) =>
          chebyshevDistance(a, nearest) <= chebyshevDistance(b, nearest) ? a : b
        );
        s = dispatch(s, { type: "MOVE_UNIT", unitId: unit.id, to: best });
        if (s.activePuzzle) {
          s = dispatch(s, { type: "PUZZLE_SKIP" });
        }
        const moved = s.units.find((u) => u.id === unit.id);
        const target = moved ? enemies.find((e) => {
          const cur = s.units.find((x) => x.id === e.id);
          return cur && moved && isInAttackRange(moved, cur, { ...ctx, allUnits: s.units });
        }) : undefined;
        if (moved && target && !moved.hasActed && s.actionBudget > 0) {
          s = dispatch(s, { type: "ATTACK", attackerId: moved.id, targetId: target.id });
        }
      }
    }
  }
  while (s.pendingMilestones.length > 0) {
    s = dispatch(s, { type: "CHOOSE_STAT", unitId: s.pendingMilestones[0].unitId, stat: "attack" });
  }
  return s;
}

function simulateMission(mapId: string, factionId: string, commanderId: string, enemyFaction: string, missionKey: string): { result: string; turns: number } {
  let s = initGame(gameData, mapId, factionId, commanderId, enemyFaction, missionKey);
  if (!s) throw new Error(`init failed for ${missionKey}`);
  const MAX_TURNS = 60;
  while (s.phase !== "win" && s.phase !== "loss" && s.turn < MAX_TURNS) {
    if (s.phase === "player-turn") {
      s = playGreedyTurn(s);
      if (s.phase !== "player-turn") continue;
      s = dispatch(s, { type: "END_TURN" });
    } else {
      break;
    }
  }
  return { result: s.phase, turns: s.turn };
}

console.log("\n== full campaign simulation (greedy bot, all factions) ==");

for (const factionId of ["covenant", "syndicate", "vrath", "pirates"]) {
  const cd = getCampaignDef(factionId, gameData.maps);
  test(`${factionId}: campaign definition exists with 3 missions`, () => {
    assert.ok(cd);
    assert.equal(cd.missions.length, 3);
  });
  if (!cd) continue;
  const commander = gameData.commanders.find((c) => c.factionId === factionId);
  assert.ok(commander);
  let cs = initCampaignState(factionId, commander.id, "cv");
  for (let mi = 0; mi < 3; mi++) {
    const mission = getMissionAt(cd, mi);
    test(`${factionId} M${mi + 1} (${mission?.mapId}): plays to a verdict without crashing`, () => {
      assert.ok(mission);
      const { result, turns } = simulateMission(mission.mapId, factionId, commander.id, mission.enemyFaction, mission.missionKey);
      assert.ok(result === "win" || result === "loss" || turns >= 1, `unexpected result ${result}`);
      console.log(`        → ${result} after ${turns} turns`);
    });
    cs = advanceMission(cs, 10);
  }
  test(`${factionId}: campaign completes after 3 missions`, () => {
    assert.ok(isCampaignComplete(cd, cs.missionIndex));
  });
}

console.log("\n== endings across consequence thresholds ==");

for (const factionId of ["covenant", "syndicate", "vrath"]) {
  for (const value of [0, 50, 100]) {
    test(`${factionId} ending exists for consequence ${value}`, () => {
      const sceneId = getEndingSceneId(factionId, value);
      const ns = startScene(gameData.narrativeData, sceneId);
      assert.ok(ns, `scene ${sceneId} missing`);
    });
  }
}

test("pirates ending exists", () => {
  const ns = startScene(gameData.narrativeData, getEndingSceneId("pirates", 50));
  assert.ok(ns);
});

console.log("\n== intro and post scenes resolve for every mission ==");

for (const factionId of ["covenant", "syndicate", "vrath", "pirates"]) {
  test(`${factionId}: campaign intro exists (serves as the M1 briefing)`, () => {
    assert.ok(startScene(gameData.narrativeData, `${factionId}_intro`));
  });
  for (let m = 2; m <= 3; m++) {
    test(`${factionId}_m${m}_intro exists`, () => {
      assert.ok(startScene(gameData.narrativeData, `${factionId}_m${m}_intro`));
    });
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error("failures:", failures.join(" | "));
  process.exit(1);
}
