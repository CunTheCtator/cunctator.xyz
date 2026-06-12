let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let currentVolume = 0.7;
let noiseBuffer: AudioBuffer | null = null;

export function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = currentVolume * currentVolume;
    masterGain.connect(ctx.destination);
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) {
        ctx.suspend().catch(() => {});
      } else if (currentVolume > 0) {
        ctx.resume().catch(() => {});
      }
    });
  } catch (err) {
    console.error("[audio] AudioContext unavailable:", err);
    ctx = null;
  }
  return ctx;
}

export function getMaster(): GainNode | null {
  getContext();
  return masterGain;
}

export function ensureStarted(): void {
  const c = getContext();
  if (c && c.state === "suspended" && !document.hidden) {
    c.resume().catch(() => {});
  }
}

export function setVolume(volume: number): void {
  currentVolume = Math.max(0, Math.min(1, volume));
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(currentVolume * currentVolume, ctx.currentTime, 0.02);
  }
}

export function getVolume(): number {
  return currentVolume;
}

export function getNoiseBuffer(): AudioBuffer | null {
  const c = getContext();
  if (!c) return null;
  if (noiseBuffer) return noiseBuffer;
  const length = c.sampleRate * 2;
  noiseBuffer = c.createBuffer(1, length, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}
