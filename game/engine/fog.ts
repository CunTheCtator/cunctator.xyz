import type { Tile, Unit } from "./types";

export type VisionSource = { x: number; y: number; radius: number };

export function calculateFog(
  grid: Tile[][],
  units: Unit[],
  playerFaction: string,
  markedUnits?: Record<number, number>,
  extraVision?: VisionSource[]
): boolean[][] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const fog: boolean[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(false)
  );

  const sources: VisionSource[] = units
    .filter((u) => u.faction === playerFaction)
    .map((u) => ({ x: u.x, y: u.y, radius: u.visionRange }))
    .concat(extraVision ?? []);

  for (const source of sources) {
    const { x, y, radius } = source;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= radius) {
          fog[ty][tx] = true;
        }
      }
    }
  }

  if (markedUnits) {
    for (const unit of units) {
      if (!markedUnits[unit.id]) continue;
      if (unit.y >= 0 && unit.y < rows && unit.x >= 0 && unit.x < cols) {
        fog[unit.y][unit.x] = true;
      }
    }
  }

  return fog;
}
