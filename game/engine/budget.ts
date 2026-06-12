import type { GameState, GameAction } from "./types";

export const ACTION_COSTS: Record<GameAction["type"], number> = {
  MOVE_UNIT:        1,
  ATTACK:           1,
  BUILD:            1,
  DEMOLISH:         1,
  USE_ABILITY:      1,
  END_TURN:         0,
  SELECT_UNIT:      0,
  DESELECT:         0,
  PUZZLE_SUBMIT:    0,
  PUZZLE_SKIP:      0,
  CONSEQUENCE_DELTA: 0,
  CHOOSE_STAT:       0,
  UPGRADE_EXTRACTOR: 2,
  REPAIR_STRUCTURE:  1,
  UNDO_MOVE:         0,
};

const BASE_BUDGET = 4;

export function calculateStartingBudget(state: GameState): number {
  let budget = BASE_BUDGET;

  for (const unit of state.units.filter((u) => u.faction === state.playerFaction)) {
    if (state.structures.some((s) => s.x === unit.x && s.y === unit.y && s.factionId === state.playerFaction)) {
      budget += 1;
    }
  }

  return Math.max(1, budget);
}

export function calculateEnemyBudget(state: GameState): number {
  let budget = BASE_BUDGET;

  for (const unit of state.units.filter((u) => u.faction === state.enemyFaction)) {
    if (state.structures.some((s) => s.x === unit.x && s.y === unit.y && s.factionId === state.enemyFaction)) {
      budget += 1;
    }
  }

  for (const effect of state.enemyArmyEffects) {
    if (effect.type === "action-budget") budget += effect.magnitude;
  }

  return Math.max(1, budget);
}
