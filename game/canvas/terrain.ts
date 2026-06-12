import type {
  Tile,
  TileType,
  RenderType,
  MapTerrainConfig,
  RGB,
  PuzzleNode,
} from "../engine/types";
import { paintedTerrainActive } from "../engine/painted-terrain";
import { fractal } from "./noise";
import { buildPerturbArray } from "./perturb";
import {
  SpriteSet,
  SpriteKey,
  compositeSpriteIntoBuffer,
} from "./sprites";

export type TerrainBitmap = {
  canvas: HTMLCanvasElement;
  pxPerCell: number;
  width: number;
  height: number;
};

export type TerrainInput = {
  grid: Tile[][];
  terrain: MapTerrainConfig;
  puzzleNodes: PuzzleNode[];
  resourcePositions: { row: number; col: number }[];
  pxPerCell: number;
};

const GRID_SIZE = 64;
const RENDER_TYPES: RenderType[] = ["open", "ruins", "mountain", "spire_wall", "spire_floor"];
const RENDER_TYPE_ID: Record<RenderType, number> = {
  open: 0,
  ruins: 1,
  mountain: 2,
  spire_wall: 3,
  spire_floor: 4,
};

export function resolveRenderType(
  tileType: TileType,
  row: number,
  col: number,
  terrain: MapTerrainConfig
): RenderType {
  // Overrides use painter's-algorithm semantics: later regions refine
  // earlier ones (spire floors are listed after the shells containing them).
  let matched: RenderType | null = null;
  for (const override of terrain.renderTypeOverrides) {
    if (
      row >= override.rows[0] &&
      row <= override.rows[1] &&
      col >= override.cols[0] &&
      col <= override.cols[1]
    ) {
      matched = override.renderType;
    }
  }
  if (matched) return matched;
  switch (tileType) {
    case "mountain":
      return "mountain";
    case "structure":
      return terrain.structureRenderType;
    case "ruins":
      return "ruins";
    case "open":
    case "resource":
    case "objective":
    case "plains":
      return "open";
    case "water":
      return "open";
    default:
      return "open";
  }
}

function yieldToBrowser(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

async function loadPaintedTerrain(url: string): Promise<TerrainBitmap> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w !== h) { reject(new Error(`paintedImage must be square; got ${w}x${h}`)); return; }
      if (w % GRID_SIZE !== 0) {
        reject(new Error(`paintedImage size ${w} must be a multiple of grid size ${GRID_SIZE}`));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("paintedImage: cannot get 2D context")); return; }
      ctx.drawImage(img, 0, 0);
      resolve({ canvas, pxPerCell: w / GRID_SIZE, width: w, height: h });
    };
    img.onerror = () => reject(new Error(`paintedImage load failed: ${url}`));
    img.src = url;
  });
}

export async function precomputeTerrain(
  input: TerrainInput,
  sprites: SpriteSet
): Promise<TerrainBitmap> {
  const { grid, terrain, puzzleNodes, resourcePositions, pxPerCell } = input;

  if (paintedTerrainActive(terrain) && terrain.paintedImage) {
    try { return await loadPaintedTerrain(terrain.paintedImage); }
    catch (err) { console.error("[terrain] paintedImage failed; falling through:", err); }
  }

  if (paintedTerrainActive(terrain) && terrain.paintedTiles && Object.keys(terrain.paintedTiles).length > 0) {
    try {
      const { composePaintedTerrain, loadPaintedTiles } = await import("./terrain-painted");
      const tiles = await loadPaintedTiles(terrain.paintedTiles);
      return await composePaintedTerrain(input, sprites, tiles);
    } catch (err) {
      console.error("[terrain] painted compositor failed; falling through to noise:", err);
    }
  }

  const size = GRID_SIZE;
  const H = size * pxPerCell;
  const W = size * pxPerCell;

  const renderTypeByCell = new Uint8Array(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const tile = grid[r]?.[c];
      const t: TileType = tile ? tile.type : "open";
      renderTypeByCell[r * size + c] = RENDER_TYPE_ID[resolveRenderType(t, r, c, terrain)];
    }
  }

  const fineCfg = terrain.fractal.fine;
  const mediumCfg = terrain.fractal.medium;
  const warpXCfg = terrain.fractal.warpX;
  const warpYCfg = terrain.fractal.warpY;
  const mix = terrain.fractal.fineMediumMix;

  const fine = fractal(H, W, terrain.seed + fineCfg.seedOffset, fineCfg.baseScale, fineCfg.octaves);
  await yieldToBrowser();
  const medium = fractal(H, W, terrain.seed + mediumCfg.seedOffset, mediumCfg.baseScale, mediumCfg.octaves);
  await yieldToBrowser();

  const noise = new Float32Array(H * W);
  for (let i = 0; i < noise.length; i++) noise[i] = mix[0] * fine[i] + mix[1] * medium[i];

  const warpX = fractal(H, W, terrain.seed + warpXCfg.seedOffset, warpXCfg.baseScale, warpXCfg.octaves);
  const warpY = fractal(H, W, terrain.seed + warpYCfg.seedOffset, warpYCfg.baseScale, warpYCfg.octaves);
  await yieldToBrowser();

  const perturb = buildPerturbArray(terrain.ruinsPerturb, size, terrain.seed);

  const ruinsMask = new Uint8Array(H * W);
  const warpStrength = terrain.warpStrength;
  for (let y = 0; y < H; y++) {
    const baseR = y / pxPerCell;
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      const wy = baseR + (warpY[idx] - 0.5) * warpStrength;
      const wx = x / pxPerCell + (warpX[idx] - 0.5) * warpStrength;
      const wr = wy < 0 ? 0 : wy >= size ? size - 1 : Math.floor(wy);
      const wc = wx < 0 ? 0 : wx >= size ? size - 1 : Math.floor(wx);
      ruinsMask[idx] = perturb[wr * size + wc];
    }
  }
  await yieldToBrowser();

  const canvas = new Uint8ClampedArray(H * W * 4);

  const palette = terrain.palette;
  const amplitude = terrain.amplitude;
  const blockingIds = new Set<number>(terrain.blockingRenderTypes.map((t) => RENDER_TYPE_ID[t]));
  const ruinsRGB: RGB = palette.ruins;
  const ruinsAmp = amplitude.ruins;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const rtId = renderTypeByCell[r * size + c];
      const baseName: RenderType = rtId === RENDER_TYPE_ID.ruins ? "open" : RENDER_TYPES[rtId];
      const base = palette[baseName];
      const amp = amplitude[baseName];
      const py0 = r * pxPerCell;
      const py1 = py0 + pxPerCell;
      const px0 = c * pxPerCell;
      const px1 = px0 + pxPerCell;
      const baseR = base[0];
      const baseG = base[1];
      const baseB = base[2];
      for (let y = py0; y < py1; y++) {
        const rowBase = y * W;
        for (let x = px0; x < px1; x++) {
          const idx = rowBase + x;
          const n = noise[idx] - 0.5;
          const cIdx = idx * 4;
          canvas[cIdx] = baseR + n * amp;
          canvas[cIdx + 1] = baseG + n * amp;
          canvas[cIdx + 2] = baseB + n * amp;
          canvas[cIdx + 3] = 255;
        }
      }
    }
  }
  await yieldToBrowser();

  const pixelRenderTypeId = new Uint8Array(H * W);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const rtId = renderTypeByCell[r * size + c];
      const py0 = r * pxPerCell;
      const px0 = c * pxPerCell;
      for (let y = py0; y < py0 + pxPerCell; y++) {
        const rowBase = y * W;
        for (let x = px0; x < px0 + pxPerCell; x++) {
          pixelRenderTypeId[rowBase + x] = rtId;
        }
      }
    }
  }

  for (let y = 0; y < H; y++) {
    const cellR = Math.floor(y / pxPerCell);
    const rowBase = y * W;
    for (let x = 0; x < W; x++) {
      const idx = rowBase + x;
      if (!ruinsMask[idx]) continue;
      const cellC = Math.floor(x / pxPerCell);
      const cellRt = renderTypeByCell[cellR * size + cellC];
      if (blockingIds.has(cellRt)) continue;
      const n = noise[idx] - 0.5;
      const cIdx = idx * 4;
      canvas[cIdx] = ruinsRGB[0] + n * ruinsAmp;
      canvas[cIdx + 1] = ruinsRGB[1] + n * ruinsAmp;
      canvas[cIdx + 2] = ruinsRGB[2] + n * ruinsAmp;
      canvas[cIdx + 3] = 255;
      pixelRenderTypeId[idx] = RENDER_TYPE_ID.ruins;
    }
  }
  await yieldToBrowser();

  const lightStrength = 0.14;
  const invHm1 = 1 / Math.max(1, H - 1);
  const invWm1 = 1 / Math.max(1, W - 1);
  for (let y = 0; y < H; y++) {
    const yFactor = y * invHm1;
    const rowBase = y * W;
    for (let x = 0; x < W; x++) {
      const xFactor = x * invWm1;
      const dist = (xFactor + yFactor) * 0.5;
      const light = 1 + (0.5 - dist) * 2 * lightStrength;
      const cIdx = (rowBase + x) * 4;
      canvas[cIdx] = canvas[cIdx] * light;
      canvas[cIdx + 1] = canvas[cIdx + 1] * light;
      canvas[cIdx + 2] = canvas[cIdx + 2] * light;
    }
  }
  await yieldToBrowser();

  const rotHashA = terrain.rotationHash[0];
  const rotHashB = terrain.rotationHash[1];
  const compositeAt = (key: SpriteKey, row: number, col: number) => {
    if (row < 0 || row >= size || col < 0 || col >= size) return;
    const cellRt = renderTypeByCell[row * size + col];
    if (blockingIds.has(cellRt)) return;
    const sprite = sprites[key];
    if (!sprite) return;
    let rot: 0 | 90 | 180 | 270 = 0;
    if (key === "boulder" || key === "crevasse") {
      const k = (row * rotHashA + col * rotHashB) % 4;
      rot = ([0, 90, 180, 270] as const)[k];
    }
    compositeSpriteIntoBuffer(
      canvas,
      W,
      sprite,
      col * pxPerCell,
      row * pxPerCell,
      pxPerCell,
      rot
    );
  };

  for (const pos of terrain.decorations.boulder) compositeAt("boulder", pos.row, pos.col);
  for (const pos of terrain.decorations.crevasse) compositeAt("crevasse", pos.row, pos.col);
  for (const pos of resourcePositions) compositeAt("resource", pos.row, pos.col);
  for (const node of puzzleNodes) compositeAt("puzzle", node.y, node.x);
  await yieldToBrowser();

  const aaStrength = terrain.boundaryAntiAliasStrength;
  const inv = 1 - aaStrength;
  const original = new Uint8ClampedArray(canvas);
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let y = 0; y < H; y++) {
    const rowBase = y * W;
    for (let x = 0; x < W; x++) {
      const idx = rowBase + x;
      const cIdx = idx * 4;
      const myId = pixelRenderTypeId[idx];
      let r = original[cIdx];
      let g = original[cIdx + 1];
      let b = original[cIdx + 2];
      for (let d = 0; d < 4; d++) {
        const ny = y + dirs[d][0];
        const nx = x + dirs[d][1];
        if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue;
        const nIdx = ny * W + nx;
        if (pixelRenderTypeId[nIdx] === myId) continue;
        const nCIdx = nIdx * 4;
        r = r * inv + original[nCIdx] * aaStrength;
        g = g * inv + original[nCIdx + 1] * aaStrength;
        b = b * inv + original[nCIdx + 2] * aaStrength;
      }
      canvas[cIdx] = r;
      canvas[cIdx + 1] = g;
      canvas[cIdx + 2] = b;
    }
  }
  await yieldToBrowser();

  const outCanvas = document.createElement("canvas");
  outCanvas.width = W;
  outCanvas.height = H;
  const ctx = outCanvas.getContext("2d");
  if (!ctx) throw new Error("terrain.ts: cannot get 2D context for output canvas");
  const imageData = new ImageData(canvas, W, H);
  ctx.putImageData(imageData, 0, 0);

  return { canvas: outCanvas, pxPerCell, width: W, height: H };
}

export function deriveResourcePositions(grid: Tile[][]): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c].type === "resource") out.push({ row: r, col: c });
    }
  }
  return out;
}
