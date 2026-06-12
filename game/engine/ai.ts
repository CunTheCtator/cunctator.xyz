import type { AnimFrame, GameState, Unit } from "./types";
import { findPath } from "./pathfinding";
import {
  isInAttackRange,
  resolveAttack,
  chebyshevDistance,
  tickStatusEffects,
  tickArmyEffects,
} from "./combat";
import { calculateFog } from "./fog";
import { calculateEnemyBudget } from "./budget";
import { checkVictory } from "./victory";
import { hostileBlockerTiles, triggerProximityTrap, structureVisionSources } from "./structure-effects";

function getVisiblePlayerUnits(state: GameState, enemyUnit: Unit): Unit[] {
  return state.units.filter(
    (u) =>
      u.faction === state.playerFaction &&
      !u.isExtractor &&
      chebyshevDistance(enemyUnit, u) <= enemyUnit.visionRange
  );
}

function moveUnitAlongPath(
  unit: Unit,
  path: { x: number; y: number }[],
  budget: number,
  units: Unit[]
): { unit: Unit; budget: number } {
  let remaining = budget;
  let current = unit;

  for (const step of path) {
    if (remaining <= 0) break;
    const occupied = units.some(
      (u) => u.id !== unit.id && u.x === step.x && u.y === step.y
    );
    if (occupied) break;
    current = { ...current, x: step.x, y: step.y, hasMoved: true };
    remaining -= 1;
  }

  return { unit: current, budget: remaining };
}

function processEnemyUnit(
  state: GameState,
  enemyUnit: Unit,
  enemyBudget: number
): { state: GameState; budget: number; frames: AnimFrame[] } {
  let currentState = state;
  let budget = enemyBudget;
  const frames: AnimFrame[] = [];

  const ctx = { armyEffects: state.armyEffects, allUnits: state.units, structures: state.structures, structureDefs: state.structureDefs };
  const blockers = hostileBlockerTiles(currentState, enemyUnit.faction);
  const visible = getVisiblePlayerUnits(currentState, enemyUnit);

  const inRange = visible.filter((u) => isInAttackRange(enemyUnit, u, ctx));
  if (inRange.length > 0) {
    const killableInRange = inRange.filter((u) => !u.unkillable);
    const pool = killableInRange.length > 0 ? killableInRange : inRange;
    const weakest = pool.reduce((a, b) => (a.hp < b.hp ? a : b));

    frames.push({
      state: currentState,
      flashTiles: [
        { x: enemyUnit.x, y: enemyUnit.y },
        { x: weakest.x, y: weakest.y },
      ],
      duration: 220,
    });

    const { defenderHp } = resolveAttack(enemyUnit, weakest, ctx);
    budget -= 1;

    const updatedEnemy = { ...enemyUnit, hasActed: true };
    let updatedUnits = currentState.units.map((u) =>
      u.id === enemyUnit.id ? updatedEnemy : u
    );

    if (defenderHp <= 0) {
      updatedUnits = updatedUnits.filter((u) => u.id !== weakest.id);
    } else {
      updatedUnits = updatedUnits.map((u) =>
        u.id === weakest.id ? { ...u, hp: defenderHp } : u
      );
    }

    currentState = { ...currentState, units: updatedUnits };
    frames.push({ state: currentState, duration: 360 });
    return { state: currentState, budget, frames };
  }

  if (visible.length > 0) {
    const nearest = visible.reduce((a, b) =>
      chebyshevDistance(enemyUnit, a) <= chebyshevDistance(enemyUnit, b) ? a : b
    );

    const path = findPath(currentState.grid, currentState.units, enemyUnit, nearest, blockers);
    if (path && path.length > 0) {
      const { unit: movedUnit, budget: newBudget } = moveUnitAlongPath(
        enemyUnit,
        path,
        budget,
        currentState.units
      );
      budget = newBudget;

      let updatedUnits = currentState.units.map((u) =>
        u.id === enemyUnit.id ? movedUnit : u
      );
      currentState = triggerProximityTrap({ ...currentState, units: updatedUnits }, movedUnit.id);
      updatedUnits = currentState.units;
      frames.push({ state: currentState, duration: 380 });
      if (!currentState.units.some((u) => u.id === movedUnit.id)) {
        return { state: currentState, budget, frames };
      }

      const movedCtx = { armyEffects: currentState.armyEffects, allUnits: currentState.units, structures: currentState.structures, structureDefs: currentState.structureDefs };
      if (isInAttackRange(movedUnit, nearest, movedCtx) && budget > 0) {
        frames.push({
          state: currentState,
          flashTiles: [
            { x: movedUnit.x, y: movedUnit.y },
            { x: nearest.x, y: nearest.y },
          ],
          duration: 220,
        });

        const { defenderHp } = resolveAttack(movedUnit, nearest, movedCtx);
        budget -= 1;

        const attackedUnit = { ...movedUnit, hasActed: true };
        updatedUnits = currentState.units.map((u) =>
          u.id === enemyUnit.id ? attackedUnit : u
        );

        if (defenderHp <= 0) {
          updatedUnits = updatedUnits.filter((u) => u.id !== nearest.id);
        } else {
          updatedUnits = updatedUnits.map((u) =>
            u.id === nearest.id ? { ...u, hp: defenderHp } : u
          );
        }
        currentState = { ...currentState, units: updatedUnits };
        frames.push({ state: currentState, duration: 360 });
      }

      return { state: currentState, budget, frames };
    }
  }

  const known = currentState.lastKnownPositions[enemyUnit.id];
  if (known) {
    const path = findPath(currentState.grid, currentState.units, enemyUnit, known, blockers);
    if (path && path.length > 0) {
      const { unit: movedUnit, budget: newBudget } = moveUnitAlongPath(
        enemyUnit,
        path,
        budget,
        currentState.units
      );
      budget = newBudget;
      currentState = triggerProximityTrap(
        { ...currentState, units: currentState.units.map((u) => (u.id === enemyUnit.id ? movedUnit : u)) },
        movedUnit.id
      );
      frames.push({ state: currentState, duration: 380 });
    }
    return { state: currentState, budget, frames };
  }

  if (enemyUnit.aiMode === "attack") {
    const target = currentState.playerSpawnCenter;
    const path = findPath(currentState.grid, currentState.units, enemyUnit, target, blockers);
    if (path && path.length > 0) {
      const { unit: movedUnit, budget: newBudget } = moveUnitAlongPath(
        enemyUnit,
        path,
        budget,
        currentState.units
      );
      budget = newBudget;
      currentState = triggerProximityTrap(
        { ...currentState, units: currentState.units.map((u) => (u.id === enemyUnit.id ? movedUnit : u)) },
        movedUnit.id
      );
      frames.push({ state: currentState, duration: 380 });
    }
  }

  return { state: currentState, budget, frames };
}

function buildEnemyTurnFrames(state: GameState): {
  frames: AnimFrame[];
  finalState: GameState;
} {
  let currentState = state;
  let budget = calculateEnemyBudget(state);
  const frames: AnimFrame[] = [];

  const enemyUnits = currentState.units
    .filter((u) => u.faction === currentState.enemyFaction)
    .sort((a, b) => {
      if (a.isBuilder !== b.isBuilder) return a.isBuilder ? -1 : 1;
      return 0;
    });

  for (const enemyUnit of enemyUnits) {
    if (budget <= 0) break;

    const current = currentState.units.find((u) => u.id === enemyUnit.id);
    if (!current || current.hp <= 0) continue;

    const result = processEnemyUnit(currentState, current, budget);
    frames.push(...result.frames);
    currentState = result.state;
    budget = result.budget;

    const updatedFog = calculateFog(
      currentState.grid,
      currentState.units,
      currentState.playerFaction,
      currentState.markedUnits,
      structureVisionSources(currentState, currentState.playerFaction)
    );
    const newLastKnown = { ...currentState.lastKnownPositions };
    for (const unit of currentState.units.filter((u) => u.faction === currentState.enemyFaction)) {
      if (updatedFog[unit.y]?.[unit.x]) newLastKnown[unit.id] = { x: unit.x, y: unit.y };
    }
    currentState = { ...currentState, fog: updatedFog, lastKnownPositions: newLastKnown };
  }

  const tickedUnits = tickStatusEffects(currentState.units, currentState.playerFaction);
  const resetUnits = tickedUnits.map((u) =>
    u.faction === currentState.playerFaction
      ? { ...u, hasMoved: false, hasActed: false, movedTiles: 0, repositionMoves: 0 }
      : u
  );
  const tickedArmyEffects = tickArmyEffects(currentState.armyEffects);
  currentState = { ...currentState, units: resetUnits, armyEffects: tickedArmyEffects };

  const victory = checkVictory(currentState);
  const finalState = victory
    ? { ...currentState, phase: victory as GameState["phase"] }
    : { ...currentState, phase: "player-turn" as GameState["phase"] };

  return { frames, finalState };
}

export function runEnemyTurnSteps(state: GameState): AnimFrame[] {
  const { frames, finalState } = buildEnemyTurnFrames(state);
  frames.push({ state: finalState, duration: 0 });
  return frames;
}

export function runEnemyTurn(state: GameState): GameState {
  return buildEnemyTurnFrames(state).finalState;
}
