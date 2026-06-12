import type { RuinsPerturbConfig } from "../engine/types";
import { mulberry32 } from "./noise";

export function buildPerturbArray(
  config: RuinsPerturbConfig,
  size: number,
  seed: number
): Uint8Array {
  const initial = new Uint8Array(size * size);
  for (const region of config.regions) {
    const [r0, r1] = region.rows;
    const [c0, c1] = region.cols;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r >= 0 && r < size && c >= 0 && c < size) {
          initial[r * size + c] = 1;
        }
      }
    }
  }

  const rng = mulberry32(seed + 1);
  const out = new Uint8Array(initial);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (initial[r * size + c] !== 1) continue;
      let same = 0;
      if (r > 0 && initial[(r - 1) * size + c] === 1) same++;
      if (r + 1 < size && initial[(r + 1) * size + c] === 1) same++;
      if (c > 0 && initial[r * size + (c - 1)] === 1) same++;
      if (c + 1 < size && initial[r * size + (c + 1)] === 1) same++;
      if (same >= 2 && same < 4 && rng() < config.erodeProb) {
        out[r * size + c] = 0;
      }
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (initial[r * size + c] === 1) continue;
      let adj = 0;
      if (r > 0 && initial[(r - 1) * size + c] === 1) adj++;
      if (r + 1 < size && initial[(r + 1) * size + c] === 1) adj++;
      if (c > 0 && initial[r * size + (c - 1)] === 1) adj++;
      if (c + 1 < size && initial[r * size + (c + 1)] === 1) adj++;
      if (adj >= 2 && rng() < config.expandProb) {
        out[r * size + c] = 1;
      }
    }
  }

  for (let pass = 0; pass < 3; pass++) {
    const snapshot = new Uint8Array(out);
    let changed = false;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (snapshot[r * size + c] !== 1) continue;
        let neighbors = 0;
        if (r > 0 && snapshot[(r - 1) * size + c] === 1) neighbors++;
        if (r + 1 < size && snapshot[(r + 1) * size + c] === 1) neighbors++;
        if (c > 0 && snapshot[r * size + (c - 1)] === 1) neighbors++;
        if (c + 1 < size && snapshot[r * size + (c + 1)] === 1) neighbors++;
        if (neighbors < 2) {
          out[r * size + c] = 0;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return out;
}
