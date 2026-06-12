import { getContext, getMaster, getNoiseBuffer, getVolume } from "./audio";

type AmbientHandle = {
  nodes: AudioNode[];
  sources: AudioScheduledSourceNode[];
  timers: ReturnType<typeof setInterval>[];
  gain: GainNode;
};

let active: AmbientHandle | null = null;
let activeMapId: string | null = null;

const AMBIENT_LEVEL = 0.1;

function makeNoiseBed(
  ctx: AudioContext,
  out: AudioNode,
  filterType: BiquadFilterType,
  freq: number,
  q: number,
  level: number,
  lfoRate: number,
  lfoDepth: number
): { nodes: AudioNode[]; sources: AudioScheduledSourceNode[] } {
  const buffer = getNoiseBuffer();
  if (!buffer) return { nodes: [], sources: [] };
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = level;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = lfoRate;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = lfoDepth;
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(0, Math.random() * 1.5);
  lfo.start();
  return { nodes: [filter, g, lfoGain], sources: [src, lfo] };
}

function makeHum(ctx: AudioContext, out: AudioNode, freq: number, level: number): { nodes: AudioNode[]; sources: AudioScheduledSourceNode[] } {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = level;
  osc.connect(g);
  g.connect(out);
  osc.start();
  return { nodes: [g], sources: [osc] };
}

function chirpTimer(ctx: AudioContext, out: AudioNode, minMs: number, maxMs: number, freqLo: number, freqHi: number, level: number): ReturnType<typeof setInterval> {
  return setInterval(() => {
    if (getVolume() === 0 || document.hidden) return;
    if (Math.random() < 0.45) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const freq = freqLo + Math.random() * (freqHi - freqLo);
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.8, now + 0.12);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(level, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + 0.25);
  }, minMs + Math.random() * (maxMs - minMs));
}

function buildWorldBed(ctx: AudioContext, out: GainNode, mapId: string): AmbientHandle {
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const timers: ReturnType<typeof setInterval>[] = [];
  const add = (part: { nodes: AudioNode[]; sources: AudioScheduledSourceNode[] }) => {
    nodes.push(...part.nodes);
    sources.push(...part.sources);
  };

  switch (mapId) {
    case "helvyn":
      add(makeNoiseBed(ctx, out, "lowpass", 550, 0.7, 0.55, 0.07, 0.3));
      break;
    case "karadun":
      add(makeNoiseBed(ctx, out, "highpass", 4200, 0.6, 0.1, 0.05, 0.05));
      add(makeHum(ctx, out, 55, 0.22));
      break;
    case "saren-volyn":
      add(makeNoiseBed(ctx, out, "bandpass", 1400, 2.5, 0.3, 0.03, 0.18));
      add(makeHum(ctx, out, 82, 0.12));
      break;
    case "yelvar":
      add(makeNoiseBed(ctx, out, "lowpass", 320, 0.7, 0.5, 0.05, 0.2));
      timers.push(chirpTimer(ctx, out, 4000, 9000, 1500, 2600, 0.05));
      break;
    case "ac-411":
      add(makeNoiseBed(ctx, out, "lowpass", 260, 0.8, 0.55, 0.12, 0.35));
      timers.push(chirpTimer(ctx, out, 5000, 11000, 180, 320, 0.08));
      break;
    default:
      add(makeNoiseBed(ctx, out, "lowpass", 500, 0.7, 0.4, 0.06, 0.2));
  }

  return { nodes, sources, timers, gain: out };
}

export function startAmbient(mapId: string): void {
  if (activeMapId === mapId && active) return;
  stopAmbient();
  const ctx = getContext();
  const master = getMaster();
  if (!ctx || !master) return;
  try {
    const bed = ctx.createGain();
    bed.gain.value = 0;
    bed.connect(master);
    bed.gain.setTargetAtTime(AMBIENT_LEVEL, ctx.currentTime, 1.2);
    active = buildWorldBed(ctx, bed, mapId);
    activeMapId = mapId;
  } catch (err) {
    console.error("[audio] ambient start failed:", err);
    active = null;
    activeMapId = null;
  }
}

export function stopAmbient(): void {
  if (!active) return;
  const ctx = getContext();
  const handle = active;
  active = null;
  activeMapId = null;
  for (const t of handle.timers) clearInterval(t);
  if (ctx) {
    handle.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setTimeout(() => {
      for (const s of handle.sources) {
        try {
          s.stop();
        } catch {}
      }
      handle.gain.disconnect();
    }, 1600);
  }
}
