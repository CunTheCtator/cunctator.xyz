import type { GameState, Unit } from "./types";

export function getReachableTiles(
  state: GameState,
  unit: Unit
): { x: number; y: number }[] {
  const { grid, units } = state;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  const effectiveMoveRange = unit.repositionMoves > 0 ? unit.repositionMoves : unit.moveRange;

  const occupied = new Set(
    units
      .filter((u) => u.id !== unit.id)
      .map((u) => `${u.x},${u.y}`)
  );

  const blocked = new Set(
    state.structures
      .filter((s) => {
        if (s.factionId === unit.faction) return false;
        const def = state.structureDefs.find((d) => d.id === s.structureDefId);
        const eff = def?.effect as { type?: string } | undefined;
        return eff?.type === "block_movement";
      })
      .map((s) => `${s.x},${s.y}`)
  );

  const reachable: { x: number; y: number }[] = [];
  const visited = new Map<string, number>();
  const queue: { x: number; y: number; cost: number }[] = [
    { x: unit.x, y: unit.y, cost: 0 },
  ];
  visited.set(`${unit.x},${unit.y}`, 0);

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const { dx, dy } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;

      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;

      const tile = grid[ny][nx];
      if (!tile.passable) continue;
      if (blocked.has(key)) continue;

      const newCost = current.cost + tile.moveCost;
      if (newCost > effectiveMoveRange) continue;

      const prev = visited.get(key);
      if (prev !== undefined && prev <= newCost) continue;

      visited.set(key, newCost);

      if (!occupied.has(key)) {
        reachable.push({ x: nx, y: ny });
      }

      queue.push({ x: nx, y: ny, cost: newCost });
    }
  }

  return reachable;
}

export function isValidMove(
  state: GameState,
  unit: Unit,
  to: { x: number; y: number }
): boolean {
  const reachable = getReachableTiles(state, unit);
  return reachable.some((t) => t.x === to.x && t.y === to.y);
}
