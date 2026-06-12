export const MOTION = {
  tick: 120,
  move: 280,
  strike: 300,
  cast: 350,
  beat: 380,
  drain: 450,
  drainHold: 150,
  fall: 600,
  rise: 700,
  moment: 900,
} as const;

export const EASE = {
  out: (t: number): number => 1 - Math.pow(1 - t, 3),
  fall: (t: number): number => t * t,
  linear: (t: number): number => t,
} as const;

export type FloaterKind = "dmg" | "crit" | "down" | "label" | "heal";

export type Floater = {
  x: number;
  y: number;
  text: string;
  kind: FloaterKind;
  t0: number;
};

export type DyingEcho = {
  x: number;
  y: number;
  color: string;
  isStructure: boolean;
  t0: number;
};

export type HpGhost = {
  fromRatio: number;
  toRatio: number;
  t0: number;
};

export type RenderFx = {
  floaters: Floater[];
  dying: DyingEcho[];
  hpGhosts: Record<number, HpGhost>;
  pendingMoveGhost: { x: number; y: number; color: string } | null;
  nowMs: number;
  reducedMotion: boolean;
};

export function pruneFx(fx: RenderFx, nowMs: number): void {
  fx.floaters = fx.floaters.filter((f) => nowMs - f.t0 < MOTION.rise + 250);
  fx.dying = fx.dying.filter((d) => nowMs - d.t0 < MOTION.fall + 100);
  for (const key of Object.keys(fx.hpGhosts)) {
    const g = fx.hpGhosts[Number(key)];
    if (nowMs - g.t0 > MOTION.drainHold + MOTION.drain + 100) delete fx.hpGhosts[Number(key)];
  }
}
