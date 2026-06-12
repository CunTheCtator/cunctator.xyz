import type { GameState, CampaignState, Difficulty } from "@/game/engine/types";

const KEY = "remnant_save_v1";

export type CodexRecord = {
  world: string;
  mission: string;
  turn: number;
  node: string;
  recoveredAt: string;
};

export type ReducedMotionSetting = "system" | "on" | "off";

export type GameSettings = {
  reducedMotion: ReducedMotionSetting;
  advisoriesMuted: boolean;
  difficulty: Difficulty;
  volume: number;
};

export type MissionSnapshot = {
  state: GameState;
  camera: { x: number; y: number };
  savedAt: string;
};

export type SaveData = {
  version: 1;
  campaign: CampaignState | null;
  mission: MissionSnapshot | null;
  codex: Record<string, CodexRecord>;
  advisories: { muted: boolean; seen: Record<string, number> };
  settings: GameSettings;
};

function defaultSave(): SaveData {
  return {
    version: 1,
    campaign: null,
    mission: null,
    codex: {},
    advisories: { muted: false, seen: {} },
    settings: { reducedMotion: "system", advisoriesMuted: false, difficulty: "standard", volume: 0.7 },
  };
}

export function loadSave(): SaveData {
  const base = defaultSave();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1) return base;
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...parsed.settings },
      advisories: { ...base.advisories, ...parsed.advisories },
    };
  } catch (err) {
    console.error("[game-save] failed to load save:", err);
    return base;
  }
}

function persist(save: SaveData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save));
  } catch (err) {
    console.error("[game-save] failed to persist save:", err);
  }
}

export function updateSave(patch: Partial<SaveData>): SaveData {
  const next = { ...loadSave(), ...patch };
  persist(next);
  return next;
}

export function saveMissionSnapshot(state: GameState, camera: { x: number; y: number }, campaign: CampaignState | null): void {
  updateSave({
    mission: { state, camera, savedAt: new Date().toISOString() },
    campaign,
  });
}

export function saveCampaignCheckpoint(campaign: CampaignState | null): void {
  updateSave({ campaign, mission: null });
}

export function clearRun(): void {
  updateSave({ campaign: null, mission: null });
}

export function recordCodexEntry(fragId: string, record: CodexRecord): void {
  const save = loadSave();
  if (save.codex[fragId]) return;
  updateSave({ codex: { ...save.codex, [fragId]: record } });
}

export function getCodex(): Record<string, CodexRecord> {
  return loadSave().codex;
}

export function getSettings(): GameSettings {
  return loadSave().settings;
}

export function setSettings(settings: GameSettings): void {
  updateSave({ settings });
}

export function getAdvisoryState(): { muted: boolean; seen: Record<string, number> } {
  return loadSave().advisories;
}

export function markAdvisorySeen(id: string, turn: number): void {
  const save = loadSave();
  updateSave({ advisories: { ...save.advisories, seen: { ...save.advisories.seen, [id]: turn } } });
}

export function setAdvisoriesMuted(muted: boolean): void {
  const save = loadSave();
  updateSave({ advisories: { ...save.advisories, muted } });
}

export function restoreAdvisories(): void {
  updateSave({ advisories: { muted: false, seen: {} } });
}
