import type { MapTerrainConfig } from "./types";

export const USE_PAINTED_TERRAIN = false;

export function paintedTerrainActive(terrain: MapTerrainConfig): boolean {
  if (!USE_PAINTED_TERRAIN) return false;
  return Boolean(
    terrain.paintedImage ||
      (terrain.paintedTiles && Object.keys(terrain.paintedTiles).length > 0)
  );
}
