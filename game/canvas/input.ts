import type { GameState, GameAction } from "../engine/types";
import type { Camera } from "./render";
import { isInAttackRange, chebyshevDistance } from "../engine/combat";

const VIEWPORT = 16;
const GRID_SIZE = 64;

function getTileSize(canvas: HTMLCanvasElement): number {
  return Math.floor(Math.min(canvas.width, canvas.height) / VIEWPORT);
}

function pixelToTile(
  e: MouseEvent,
  canvas: HTMLCanvasElement,
  camera: Camera
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  const tileSize = getTileSize(canvas);
  const tx = Math.floor(px / tileSize) + camera.x;
  const ty = Math.floor(py / tileSize) + camera.y;
  if (tx < 0 || ty < 0 || tx >= GRID_SIZE || ty >= GRID_SIZE) return null;
  return { x: tx, y: ty };
}

export function pixelToTileRaw(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  camera: Camera
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (clientX - rect.left) * scaleX;
  const py = (clientY - rect.top) * scaleY;
  const tileSize = getTileSize(canvas);
  const tx = Math.floor(px / tileSize) + camera.x;
  const ty = Math.floor(py / tileSize) + camera.y;
  if (tx < 0 || ty < 0 || tx >= GRID_SIZE || ty >= GRID_SIZE) return null;
  return { x: tx, y: ty };
}

export type InteractionMode =
  | { mode: "normal" }
  | { mode: "build"; unitId: number; structureDefId: string }
  | { mode: "demolish"; unitId: number }
  | { mode: "ability"; unitId: number; traitId: string; needsTarget: boolean };

export function canvasClickToAction(
  e: MouseEvent,
  canvas: HTMLCanvasElement,
  state: GameState,
  camera: Camera,
  interactionMode: InteractionMode = { mode: "normal" }
): GameAction | null {
  if (state.phase !== "player-turn") return null;

  const tile = pixelToTile(e, canvas, camera);
  if (!tile) return null;

  const { x, y } = tile;

  if (interactionMode.mode === "build") {
    const unit = state.units.find((u) => u.id === interactionMode.unitId);
    if (!unit) return null;
    if (chebyshevDistance(unit, { x, y }) > 1) return null;
    return { type: "BUILD", unitId: interactionMode.unitId, at: { x, y }, structureDefId: interactionMode.structureDefId };
  }

  if (interactionMode.mode === "demolish") {
    const struct = state.structures.find((s) => s.x === x && s.y === y);
    if (!struct) return null;
    return { type: "DEMOLISH", unitId: interactionMode.unitId, at: { x, y } };
  }

  if (interactionMode.mode === "ability") {
    const { unitId, traitId, needsTarget } = interactionMode;
    if (!needsTarget) {
      return { type: "USE_ABILITY", unitId, traitId };
    }
    const targetUnit = state.units.find((u) => u.x === x && u.y === y);
    return {
      type: "USE_ABILITY",
      unitId,
      traitId,
      targetUnitId: targetUnit?.id,
      targetTile: { x, y },
    };
  }

  // Normal mode
  const clickedUnit = state.units.find((u) => u.x === x && u.y === y);

  if (state.selectedUnitId !== null) {
    const selectedUnit = state.units.find((u) => u.id === state.selectedUnitId);
    if (!selectedUnit) return { type: "DESELECT" };

    if (clickedUnit && clickedUnit.faction === state.enemyFaction) {
      const ctx = { armyEffects: state.armyEffects, allUnits: state.units, structures: state.structures };
      if (isInAttackRange(selectedUnit, clickedUnit, ctx) && !selectedUnit.hasActed) {
        return { type: "ATTACK", attackerId: state.selectedUnitId, targetId: clickedUnit.id };
      }
      return null;
    }

    if (clickedUnit && clickedUnit.id === state.selectedUnitId) {
      return { type: "DESELECT" };
    }

    const canMove = !selectedUnit.hasMoved || selectedUnit.repositionMoves > 0;
    if (!clickedUnit && canMove && state.reachableTiles?.some((t) => t.x === x && t.y === y)) {
      return { type: "MOVE_UNIT", unitId: state.selectedUnitId, to: { x, y } };
    }

    return { type: "DESELECT" };
  }

  if (clickedUnit && clickedUnit.faction === state.playerFaction) {
    return { type: "SELECT_UNIT", unitId: clickedUnit.id };
  }

  return null;
}
