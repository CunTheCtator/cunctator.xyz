import type { Tile, Unit } from "./types";

const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

export function findPath(
  grid: Tile[][],
  units: Unit[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  blockedTiles?: { x: number; y: number }[]
): { x: number; y: number }[] | null {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (to.x < 0 || to.y < 0 || to.x >= cols || to.y >= rows) return null;
  if (!grid[to.y]?.[to.x]?.passable) return null;
  if (from.x === to.x && from.y === to.y) return null;

  const blocked = new Uint8Array(rows * cols);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!grid[y][x].passable) blocked[y * cols + x] = 1;
    }
  }
  for (const unit of units) {
    if (unit.x === from.x && unit.y === from.y) continue;
    if (unit.x === to.x && unit.y === to.y) continue;
    if (unit.y >= 0 && unit.y < rows && unit.x >= 0 && unit.x < cols) {
      blocked[unit.y * cols + unit.x] = 1;
    }
  }
  if (blockedTiles) {
    for (const b of blockedTiles) {
      if (b.x === from.x && b.y === from.y) continue;
      if (b.x === to.x && b.y === to.y) continue;
      if (b.y >= 0 && b.y < rows && b.x >= 0 && b.x < cols) {
        blocked[b.y * cols + b.x] = 1;
      }
    }
  }

  // Uniform step cost, so breadth-first search yields a shortest path —
  // equivalent to A* on this grid without the dependency.
  const cameFrom = new Int32Array(rows * cols).fill(-1);
  const startIdx = from.y * cols + from.x;
  const goalIdx = to.y * cols + to.x;
  cameFrom[startIdx] = startIdx;

  const queue = new Int32Array(rows * cols);
  let head = 0;
  let tail = 0;
  queue[tail++] = startIdx;

  let found = false;
  while (head < tail) {
    const idx = queue[head++];
    if (idx === goalIdx) {
      found = true;
      break;
    }
    const cx = idx % cols;
    const cy = (idx - cx) / cols;
    for (const { dx, dy } of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nIdx = ny * cols + nx;
      if (blocked[nIdx] || cameFrom[nIdx] !== -1) continue;
      cameFrom[nIdx] = idx;
      queue[tail++] = nIdx;
    }
  }

  if (!found) return null;

  const path: { x: number; y: number }[] = [];
  let cur = goalIdx;
  while (cur !== startIdx) {
    path.push({ x: cur % cols, y: Math.floor(cur / cols) });
    cur = cameFrom[cur];
  }
  path.reverse();
  return path.length > 0 ? path : null;
}
