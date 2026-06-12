import type { GameState } from "./types";

export function checkVictory(state: GameState): "win" | "loss" | null {
  const playerUnits = state.units.filter((u) => u.faction === state.playerFaction);
  const enemyUnits = state.units.filter((u) => u.faction === state.enemyFaction);

  const playerCombatUnits = playerUnits.filter((u) => !u.isExtractor);
  const enemyCombatUnits = enemyUnits.filter((u) => !u.isExtractor);

  if (playerCombatUnits.length === 0) return "loss";

  const playerCommander = playerUnits.find((u) => u.isCommander);
  if (!playerCommander || playerCommander.hp <= 0) return "loss";

  if (enemyCombatUnits.length === 0) {
    const unspawnedWave = state.pendingReinforcements.some((r) => !r.spawned && r.units.length > 0);
    return unspawnedWave ? null : "win";
  }

  return null;
}
