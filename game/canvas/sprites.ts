export type SpriteData = {
  width: number;
  height: number;
  rgb: Float32Array;
  alpha: Float32Array;
};

export type SpriteKey = "boulder" | "crevasse" | "resource" | "puzzle";

export type SpriteSet = Partial<Record<SpriteKey, SpriteData>>;

export const USE_SPRITE_ASSETS = false;

const PLACEHOLDER_SIZE = 64;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function buildResourcePlaceholder(): SpriteData {
  const size = PLACEHOLDER_SIZE;
  const n = size * size;
  const rgb = new Float32Array(n * 3);
  const alpha = new Float32Array(n);
  const c = (size - 1) / 2;
  const radius = size * 0.34;
  const soft = size * 0.05;
  const rimWidth = size * 0.1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.abs(x - c) + Math.abs(y - c);
      const a = clamp01((radius - d) / soft);
      if (a <= 0) continue;
      const i = y * size + x;
      const rim = clamp01((d - (radius - rimWidth)) / rimWidth);
      rgb[i * 3] = 217 - rim * 67;
      rgb[i * 3 + 1] = 184 - rim * 66;
      rgb[i * 3 + 2] = 119 - rim * 57;
      alpha[i] = a;
    }
  }
  return { width: size, height: size, rgb, alpha };
}

function buildPuzzlePlaceholder(): SpriteData {
  const size = PLACEHOLDER_SIZE;
  const n = size * size;
  const rgb = new Float32Array(n * 3);
  const alpha = new Float32Array(n);
  const c = (size - 1) / 2;
  const ringRadius = size * 0.3;
  const ringWidth = size * 0.07;
  const dotRadius = size * 0.1;
  const soft = size * 0.04;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const ring = clamp01((ringWidth - Math.abs(d - ringRadius)) / soft);
      const dot = clamp01((dotRadius - d) / soft);
      const a = Math.max(ring, dot);
      if (a <= 0) continue;
      const i = y * size + x;
      rgb[i * 3] = 255;
      rgb[i * 3 + 1] = 224;
      rgb[i * 3 + 2] = 102;
      alpha[i] = a;
    }
  }
  return { width: size, height: size, rgb, alpha };
}

export function buildPlaceholderSpriteSet(
  keys: SpriteKey[],
  resourceAlphaScale: number
): SpriteSet {
  const out: SpriteSet = {};
  for (const key of keys) {
    if (key === "resource") out.resource = buildResourcePlaceholder();
    if (key === "puzzle") out.puzzle = buildPuzzlePlaceholder();
  }
  if (out.resource) {
    for (let i = 0; i < out.resource.alpha.length; i++) {
      out.resource.alpha[i] *= resourceAlphaScale;
    }
  }
  return out;
}

async function loadPng(url: string): Promise<SpriteData> {
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
        reject(new Error("Cannot get 2D context for sprite decode"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      const n = w * h;
      const rgb = new Float32Array(n * 3);
      const alpha = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        rgb[i * 3] = data[i * 4];
        rgb[i * 3 + 1] = data[i * 4 + 1];
        rgb[i * 3 + 2] = data[i * 4 + 2];
        alpha[i] = data[i * 4 + 3] / 255;
      }
      resolve({ width: w, height: h, rgb, alpha });
    };
    img.onerror = () => reject(new Error(`Failed to load sprite: ${url}`));
    img.src = url;
  });
}

export async function loadSpriteSet(
  urls: Partial<Record<SpriteKey, string>>,
  resourceAlphaScale: number
): Promise<SpriteSet> {
  const entries = Object.entries(urls) as [SpriteKey, string][];
  const loaded = await Promise.all(
    entries.map(async ([key, url]) => [key, await loadPng(url)] as const)
  );
  const out: SpriteSet = {};
  for (const [key, data] of loaded) out[key] = data;
  if (out.resource) {
    for (let i = 0; i < out.resource.alpha.length; i++) {
      out.resource.alpha[i] *= resourceAlphaScale;
    }
  }
  return out;
}

export function compositeSpriteIntoBuffer(
  canvas: Uint8ClampedArray,
  canvasW: number,
  sprite: SpriteData,
  destX: number,
  destY: number,
  destSize: number,
  rotationDeg: 0 | 90 | 180 | 270
): void {
  const sW = sprite.width;
  const sH = sprite.height;
  const rgbSrc = sprite.rgb;
  const alphaSrc = sprite.alpha;

  for (let dy = 0; dy < destSize; dy++) {
    for (let dx = 0; dx < destSize; dx++) {
      const tx = dx / destSize;
      const ty = dy / destSize;

      let rx: number;
      let ry: number;
      if (rotationDeg === 90) {
        rx = ty;
        ry = 1 - tx;
      } else if (rotationDeg === 180) {
        rx = 1 - tx;
        ry = 1 - ty;
      } else if (rotationDeg === 270) {
        rx = 1 - ty;
        ry = tx;
      } else {
        rx = tx;
        ry = ty;
      }

      const sx = rx * (sW - 1);
      const sy = ry * (sH - 1);
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1 < sW ? x0 + 1 : sW - 1;
      const y1 = y0 + 1 < sH ? y0 + 1 : sH - 1;
      const fx = sx - x0;
      const fy = sy - y0;
      const ifx = 1 - fx;
      const ify = 1 - fy;

      const i00 = y0 * sW + x0;
      const i01 = y0 * sW + x1;
      const i10 = y1 * sW + x0;
      const i11 = y1 * sW + x1;

      const a =
        ify * (ifx * alphaSrc[i00] + fx * alphaSrc[i01]) +
        fy * (ifx * alphaSrc[i10] + fx * alphaSrc[i11]);
      if (a < 0.01) continue;

      const r =
        ify * (ifx * rgbSrc[i00 * 3] + fx * rgbSrc[i01 * 3]) +
        fy * (ifx * rgbSrc[i10 * 3] + fx * rgbSrc[i11 * 3]);
      const g =
        ify * (ifx * rgbSrc[i00 * 3 + 1] + fx * rgbSrc[i01 * 3 + 1]) +
        fy * (ifx * rgbSrc[i10 * 3 + 1] + fx * rgbSrc[i11 * 3 + 1]);
      const b =
        ify * (ifx * rgbSrc[i00 * 3 + 2] + fx * rgbSrc[i01 * 3 + 2]) +
        fy * (ifx * rgbSrc[i10 * 3 + 2] + fx * rgbSrc[i11 * 3 + 2]);

      const cIdx = ((destY + dy) * canvasW + (destX + dx)) * 4;
      const inv = 1 - a;
      canvas[cIdx] = canvas[cIdx] * inv + r * a;
      canvas[cIdx + 1] = canvas[cIdx + 1] * inv + g * a;
      canvas[cIdx + 2] = canvas[cIdx + 2] * inv + b * a;
      canvas[cIdx + 3] = 255;
    }
  }
}
