import { gameData } from "../game/data/loader";
import { initGame, prepareEnemyTurnState } from "../game/engine/state";
import { runEnemyTurn } from "../game/engine/ai";
import { findPath } from "../game/engine/pathfinding";

function bench(label: string, iterations: number, fn: () => void): void {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const ms = (performance.now() - t0) / iterations;
  console.log(`${label}: ${ms.toFixed(2)} ms avg over ${iterations} runs`);
}

console.log("\n== performance bench (64×64 engine) ==");

for (const map of gameData.maps) {
  const missionKey = Object.keys(map.missionOverrides)[0];
  const faction = missionKey.split("_")[0];
  const commander = gameData.commanders.find((c) => c.factionId === faction);
  bench(`initGame ${map.id}`, 5, () => {
    initGame(gameData, map.id, faction, commander?.id ?? "", map.missionOverrides[missionKey].enemyFaction, missionKey);
  });
}

const state = initGame(gameData, "helvyn", "covenant", "covenant_confessor", "syndicate", "covenant_m1");
if (state) {
  bench("full enemy AI turn (helvyn covenant_m1)", 10, () => {
    runEnemyTurn(prepareEnemyTurnState(state));
  });

  bench("findPath corner-to-corner on helvyn", 200, () => {
    findPath(state.grid, state.units, { x: 1, y: 30 }, { x: 57, y: 30 });
  });
}

console.log("\ntargets: AI turn well under one animation beat (380 ms); pathfinding under 1 ms");
