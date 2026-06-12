import { getContext, getMaster, getNoiseBuffer, getVolume } from "./audio";

export type SfxName =
  | "select"
  | "move"
  | "stage"
  | "hit"
  | "down"
  | "structureFall"
  | "build"
  | "repair"
  | "income"
  | "levelup"
  | "puzzleSolve"
  | "puzzleFail"
  | "fragment"
  | "enemyTurn"
  | "playerTurn"
  | "reinforce"
  | "victory"
  | "defeat"
  | "undo"
  | "uiTick";

type ToneStep = {
  freq: number;
  freqEnd?: number;
  type?: OscillatorType;
  at: number;
  dur: number;
  gain: number;
};

type NoiseStep = {
  at: number;
  dur: number;
  gain: number;
  filter?: { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number };
};

function playTones(steps: ToneStep[]): void {
  const ctx = getContext();
  const master = getMaster();
  if (!ctx || !master || getVolume() === 0) return;
  const now = ctx.currentTime;
  for (const s of steps) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = s.type ?? "sine";
    osc.frequency.setValueAtTime(s.freq, now + s.at);
    if (s.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, s.freqEnd), now + s.at + s.dur);
    }
    g.gain.setValueAtTime(0, now + s.at);
    g.gain.linearRampToValueAtTime(s.gain, now + s.at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + s.at + s.dur);
    osc.connect(g);
    g.connect(master);
    osc.start(now + s.at);
    osc.stop(now + s.at + s.dur + 0.05);
  }
}

function playNoise(steps: NoiseStep[]): void {
  const ctx = getContext();
  const master = getMaster();
  const buffer = getNoiseBuffer();
  if (!ctx || !master || !buffer || getVolume() === 0) return;
  const now = ctx.currentTime;
  for (const s of steps) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now + s.at);
    g.gain.linearRampToValueAtTime(s.gain, now + s.at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + s.at + s.dur);
    let node: AudioNode = src;
    if (s.filter) {
      const f = ctx.createBiquadFilter();
      f.type = s.filter.type;
      f.frequency.setValueAtTime(s.filter.freq, now + s.at);
      if (s.filter.freqEnd !== undefined) {
        f.frequency.exponentialRampToValueAtTime(Math.max(40, s.filter.freqEnd), now + s.at + s.dur);
      }
      if (s.filter.q !== undefined) f.Q.value = s.filter.q;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(master);
    src.start(now + s.at, Math.random() * 1.5);
    src.stop(now + s.at + s.dur + 0.05);
  }
}

const RECIPES: Record<SfxName, () => void> = {
  uiTick: () => playTones([{ freq: 660, at: 0, dur: 0.04, gain: 0.1 }]),
  select: () => playTones([{ freq: 392, freqEnd: 440, type: "triangle", at: 0, dur: 0.07, gain: 0.16 }]),
  move: () =>
    playNoise([{ at: 0, dur: 0.15, gain: 0.14, filter: { type: "bandpass", freq: 900, freqEnd: 380, q: 1.2 } }]),
  stage: () => playTones([{ freq: 523, at: 0, dur: 0.05, gain: 0.1 }]),
  hit: () => {
    playNoise([{ at: 0, dur: 0.1, gain: 0.4, filter: { type: "lowpass", freq: 1400, freqEnd: 300 } }]);
    playTones([{ freq: 130, freqEnd: 70, type: "triangle", at: 0, dur: 0.13, gain: 0.34 }]);
  },
  down: () => {
    playTones([{ freq: 165, freqEnd: 50, type: "triangle", at: 0, dur: 0.3, gain: 0.38 }]);
    playNoise([{ at: 0, dur: 0.18, gain: 0.26, filter: { type: "lowpass", freq: 700, freqEnd: 150 } }]);
  },
  structureFall: () =>
    playNoise([{ at: 0, dur: 0.32, gain: 0.32, filter: { type: "lowpass", freq: 420, freqEnd: 90 } }]),
  build: () =>
    playNoise([
      { at: 0, dur: 0.05, gain: 0.3, filter: { type: "bandpass", freq: 900, q: 2 } },
      { at: 0.09, dur: 0.05, gain: 0.26, filter: { type: "bandpass", freq: 700, q: 2 } },
    ]),
  repair: () =>
    playNoise([
      { at: 0, dur: 0.03, gain: 0.18, filter: { type: "bandpass", freq: 1300, q: 3 } },
      { at: 0.08, dur: 0.03, gain: 0.18, filter: { type: "bandpass", freq: 1300, q: 3 } },
      { at: 0.16, dur: 0.03, gain: 0.18, filter: { type: "bandpass", freq: 1500, q: 3 } },
    ]),
  income: () => playTones([{ freq: 880, freqEnd: 1320, at: 0, dur: 0.08, gain: 0.09 }]),
  levelup: () =>
    playTones([
      { freq: 523, type: "triangle", at: 0, dur: 0.1, gain: 0.22 },
      { freq: 784, type: "triangle", at: 0.1, dur: 0.16, gain: 0.22 },
    ]),
  puzzleSolve: () =>
    playTones([
      { freq: 392, at: 0, dur: 0.09, gain: 0.2 },
      { freq: 523, at: 0.09, dur: 0.09, gain: 0.2 },
      { freq: 659, at: 0.18, dur: 0.2, gain: 0.22 },
    ]),
  puzzleFail: () => playTones([{ freq: 116, type: "square", at: 0, dur: 0.2, gain: 0.14 }]),
  fragment: () =>
    playTones([
      { freq: 659, at: 0, dur: 0.1, gain: 0.12 },
      { freq: 880, at: 0.12, dur: 0.26, gain: 0.12 },
    ]),
  enemyTurn: () => playTones([{ freq: 440, freqEnd: 220, at: 0, dur: 0.26, gain: 0.16 }]),
  playerTurn: () => playTones([{ freq: 330, freqEnd: 392, at: 0, dur: 0.12, gain: 0.14 }]),
  reinforce: () =>
    playTones([
      { freq: 311, type: "triangle", at: 0, dur: 0.12, gain: 0.2 },
      { freq: 415, type: "triangle", at: 0.14, dur: 0.12, gain: 0.2 },
      { freq: 311, type: "triangle", at: 0.3, dur: 0.12, gain: 0.16 },
    ]),
  victory: () =>
    playTones([
      { freq: 392, type: "triangle", at: 0, dur: 0.14, gain: 0.22 },
      { freq: 494, type: "triangle", at: 0.13, dur: 0.14, gain: 0.22 },
      { freq: 587, type: "triangle", at: 0.26, dur: 0.14, gain: 0.22 },
      { freq: 784, type: "triangle", at: 0.39, dur: 0.4, gain: 0.24 },
    ]),
  defeat: () =>
    playTones([
      { freq: 392, type: "triangle", at: 0, dur: 0.18, gain: 0.2 },
      { freq: 311, type: "triangle", at: 0.18, dur: 0.18, gain: 0.2 },
      { freq: 233, type: "triangle", at: 0.36, dur: 0.18, gain: 0.2 },
      { freq: 196, type: "triangle", at: 0.54, dur: 0.5, gain: 0.22 },
    ]),
  undo: () =>
    playNoise([{ at: 0, dur: 0.13, gain: 0.12, filter: { type: "bandpass", freq: 420, freqEnd: 1100, q: 1.2 } }]),
};

export function playSfx(name: SfxName): void {
  try {
    RECIPES[name]();
  } catch (err) {
    console.error(`[audio] sfx ${name} failed:`, err);
  }
}
