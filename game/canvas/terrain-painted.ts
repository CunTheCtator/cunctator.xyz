import type {
  Tile,
  TileType,
  RenderType,
  MapTerrainConfig,
} from "../engine/types";
import type { TerrainBitmap, TerrainInput } from "./terrain";
import { resolveRenderType } from "./terrain";
import {
  SpriteSet,
  SpriteKey,
  compositeSpriteIntoBuffer,
} from "./sprites";

const GRID_SIZE = 64;
const RENDER_TYPES: RenderType[] = ["open", "ruins", "mountain", "spire_wall", "spire_floor"];
const DEFAULT_BLUR_SIGMA: Record<RenderType, number> = {
  open: 5,
  ruins: 5,
  mountain: 5,
  spire_wall: 0,
  spire_floor: 0,
};

export type PaintedTileData = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
};

export type PaintedTileSet = Partial<Record<RenderType, PaintedTileData>>;

async function loadTilePng(url: string): Promise<PaintedTileData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error(`tile decode: cannot get 2D context (${url})`));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, w, h);
      resolve({ width: w, height: h, rgba: imageData.data });
    };
    img.onerror = () => reject(new Error(`tile load failed: ${url}`));
    img.src = url;
  });
}

export async function loadPaintedTiles(
  urls: Partial<Record<RenderType, string>>
): Promise<PaintedTileSet> {
  const entries = Object.entries(urls) as [RenderType, string][];
  const out: PaintedTileSet = {};
  await Promise.all(
    entries.map(async ([rt, url]) => {
      out[rt] = await loadTilePng(url);
    })
  );
  return out;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function buildTerrainMasks(
  grid: Tile[][],
  terrain: MapTerrainConfig,
  outSize: number
): Record<RenderType, Float32Array> {
  const cellPx = Math.floor(outSize / GRID_SIZE);
  const masks: Record<RenderType, Float32Array> = {
    open: new Float32Array(outSize * outSize),
    ruins: new Float32Array(outSize * outSize),
    mountain: new Float32Array(outSize * outSize),
    spire_wall: new Float32Array(outSize * outSize),
    spire_floor: new Float32Array(outSize * outSize),
  };
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tile = grid[r]?.[c];
      const t: TileType = tile ? tile.type : "open";
      const rt = resolveRenderType(t, r, c, terrain);
      const mask = masks[rt];
      const y0 = r * cellPx;
      const x0 = c * cellPx;
      for (let y = y0; y < y0 + cellPx; y++) {
        const rowBase = y * outSize;
        for (let x = x0; x < x0 + cellPx; x++) {
          mask[rowBase + x] = 1;
        }
      }
    }
  }
  return masks;
}

function buildGaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  const sigma2 = 2 * sigma * sigma;
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    const w = Math.exp(-(x * x) / sigma2);
    kernel[i] = w;
    sum += w;
  }
  const inv = 1 / sum;
  for (let i = 0; i < size; i++) kernel[i] *= inv;
  return kernel;
}

function gaussianBlur1D(
  src: Float32Array,
  width: number,
  height: number,
  sigma: number,
  axis: "horizontal" | "vertical",
  dst: Float32Array
): void {
  const kernel = buildGaussianKernel(sigma);
  const radius = (kernel.length - 1) >> 1;
  if (axis === "horizontal") {
    for (let y = 0; y < height; y++) {
      const rowBase = y * width;
      for (let x = 0; x < width; x++) {
        let acc = 0;
        for (let k = 0; k < kernel.length; k++) {
          let sx = x + k - radius;
          if (sx < 0) sx = 0;
          else if (sx >= width) sx = width - 1;
          acc += src[rowBase + sx] * kernel[k];
        }
        dst[rowBase + x] = acc;
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let acc = 0;
        for (let k = 0; k < kernel.length; k++) {
          let sy = y + k - radius;
          if (sy < 0) sy = 0;
          else if (sy >= height) sy = height - 1;
          acc += src[sy * width + x] * kernel[k];
        }
        dst[y * width + x] = acc;
      }
    }
  }
}

function blurMask(mask: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma <= 0) return mask;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  gaussianBlur1D(mask, w, h, sigma, "horizontal", tmp);
  gaussianBlur1D(tmp, w, h, sigma, "vertical", out);
  return out;
}

function normalizeMasks(masks: Record<RenderType, Float32Array>, size: number): void {
  const total = size * size;
  for (let i = 0; i < total; i++) {
    let sum = 0;
    for (const rt of RENDER_TYPES) sum += masks[rt][i];
    if (sum <= 0) continue;
    const inv = 1 / sum;
    for (const rt of RENDER_TYPES) masks[rt][i] *= inv;
  }
}

function weightedTileSum(
  masks: Record<RenderType, Float32Array>,
  tiles: PaintedTileSet,
  outSize: number
) {
  const total = outSize * outSize;
  const out = new Uint8ClampedArray(total * 4);

  const tileAccessors: { rt: RenderType; rgba: Uint8ClampedArray; w: number; h: number }[] = [];
  for (const rt of RENDER_TYPES) {
    const tile = tiles[rt];
    if (tile) tileAccessors.push({ rt, rgba: tile.rgba, w: tile.width, h: tile.height });
  }

  for (let y = 0; y < outSize; y++) {
    for (let x = 0; x < outSize; x++) {
      const idx = y * outSize + x;
      let r = 0;
      let g = 0;
      let b = 0;
      for (const t of tileAccessors) {
        const m = masks[t.rt][idx];
        if (m <= 0) continue;
        const tx = x % t.w;
        const ty = y % t.h;
        const tIdx = (ty * t.w + tx) * 4;
        r += t.rgba[tIdx] * m;
        g += t.rgba[tIdx + 1] * m;
        b += t.rgba[tIdx + 2] * m;
      }
      const cIdx = idx * 4;
      out[cIdx] = r;
      out[cIdx + 1] = g;
      out[cIdx + 2] = b;
      out[cIdx + 3] = 255;
    }
  }
  return out;
}

export async function composePaintedTerrain(
  input: TerrainInput,
  sprites: SpriteSet,
  tiles: PaintedTileSet
): Promise<TerrainBitmap> {
  const { grid, terrain, puzzleNodes, resourcePositions } = input;
  const outSize = terrain.paintedOutputSize ?? 1024;
  if (outSize % GRID_SIZE !== 0) {
    throw new Error(`paintedOutputSize ${outSize} must be a multiple of grid size ${GRID_SIZE}`);
  }
  const pxPerCell = outSize / GRID_SIZE;

  const masks = buildTerrainMasks(grid, terrain, outSize);
  await yieldToBrowser();

  const blurCfg = terrain.paintedBlurSigma ?? {};
  for (const rt of RENDER_TYPES) {
    const sigma = blurCfg[rt] ?? DEFAULT_BLUR_SIGMA[rt];
    masks[rt] = blurMask(masks[rt], outSize, outSize, sigma);
  }
  await yieldToBrowser();

  normalizeMasks(masks, outSize);
  await yieldToBrowser();

  const canvas = weightedTileSum(masks, tiles, outSize);
  await yieldToBrowser();

  const compositeAt = (key: SpriteKey, row: number, col: number) => {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
    const sprite = sprites[key];
    if (!sprite) return;
    compositeSpriteIntoBuffer(
      canvas,
      outSize,
      sprite,
      col * pxPerCell,
      row * pxPerCell,
      pxPerCell,
      0
    );
  };

  for (const pos of resourcePositions) compositeAt("resource", pos.row, pos.col);
  for (const node of puzzleNodes) compositeAt("puzzle", node.y, node.x);
  await yieldToBrowser();

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outSize;
  outCanvas.height = outSize;
  const ctx = outCanvas.getContext("2d");
  if (!ctx) throw new Error("composePaintedTerrain: cannot get 2D context for output canvas");
  ctx.putImageData(new ImageData(canvas, outSize, outSize), 0, 0);

  return { canvas: outCanvas, pxPerCell, width: outSize, height: outSize };
}
