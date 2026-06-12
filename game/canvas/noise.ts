export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function valueNoise(height: number, width: number, scale: number, seed: number): Float32Array {
  const srcH = Math.floor(height / scale) + 2;
  const srcW = Math.floor(width / scale) + 2;
  const rng = mulberry32(seed);
  const src = new Float32Array(srcH * srcW);
  for (let i = 0; i < src.length; i++) src[i] = rng();

  const out = new Float32Array(width * height);
  const syScale = (srcH - 1) / Math.max(1, height - 1);
  const sxScale = (srcW - 1) / Math.max(1, width - 1);

  for (let y = 0; y < height; y++) {
    const sy = y * syScale;
    const y0 = Math.floor(sy);
    const y1 = y0 + 1 < srcH ? y0 + 1 : srcH - 1;
    const fy = sy - y0;
    const ifY = 1 - fy;
    const row0 = y0 * srcW;
    const row1 = y1 * srcW;
    const outRow = y * width;
    for (let x = 0; x < width; x++) {
      const sx = x * sxScale;
      const x0 = Math.floor(sx);
      const x1 = x0 + 1 < srcW ? x0 + 1 : srcW - 1;
      const fx = sx - x0;
      const ifX = 1 - fx;
      const a = src[row0 + x0];
      const b = src[row0 + x1];
      const c = src[row1 + x0];
      const d = src[row1 + x1];
      out[outRow + x] = ifY * (ifX * a + fx * b) + fy * (ifX * c + fx * d);
    }
  }

  return out;
}

export function fractal(
  height: number,
  width: number,
  seed: number,
  baseScale: number,
  octaves: number
): Float32Array {
  const total = new Float32Array(width * height);
  let amp = 1.0;
  let scale = baseScale;
  let totalWeight = 0;
  for (let i = 0; i < octaves; i++) {
    const layer = valueNoise(height, width, scale, seed + i * 77);
    for (let j = 0; j < total.length; j++) total[j] += amp * layer[j];
    totalWeight += amp;
    amp *= 0.5;
    scale = scale * 2 < 2 ? 2 : scale * 2;
  }
  if (totalWeight > 0) {
    const inv = 1 / totalWeight;
    for (let j = 0; j < total.length; j++) total[j] *= inv;
  }
  return total;
}
