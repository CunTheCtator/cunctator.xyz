export type DialogueBeat = {
  type: "dialogue";
  speaker: string | null;
  text: string;
  condition?: { choiceId: string; value: string };
};

export type ChoiceOption = {
  text: string;
  delta: number;
  extraDeltas?: Record<string, number>;
  choiceId?: string;
  optionKey?: string;
};

export type ChoiceBeat = {
  type: "choice";
  options: ChoiceOption[];
};

export type SetSpritesBeat = {
  type: "set_sprites";
  left: string | null;
  right: string | null;
};

export type SetBgBeat = {
  type: "set_background";
  background: string;
};

export type Beat = DialogueBeat | ChoiceBeat | SetSpritesBeat | SetBgBeat;

export type Scene = {
  initialBackground: string;
  initialLeft?: string | null;
  initialRight?: string | null;
  beats: Beat[];
};

export type MidMissionCondition =
  | { type: "objective_tile_reached"; at: { x: number; y: number } }
  | { type: "enemy_unit_hp_pct"; unitDataId: string; threshold: number }
  | { type: "enemy_count_pct"; threshold: number }
  | { type: "turn"; turn: number }
  | { type: "choice_history"; choiceId: string; value: string }
  | { type: "consequence_range"; min: number; max: number };

export type MidMissionTrigger = {
  id: string;
  sceneId: string;
  conditions: MidMissionCondition[];
  pirateAltSceneId?: string;
  postUnlockPirates?: boolean;
  postSceneId?: string;
};

export type NarrativeData = {
  scenes: Record<string, Scene>;
  midMissionTriggers?: Record<string, MidMissionTrigger[]>;
};

export type MidMissionEvaluationState = {
  units: { faction: string; x: number; y: number; hp: number; maxHp: number; unitDataId?: string }[];
  playerFaction: string;
  enemyFaction: string;
  turn: number;
  enemyCountAtStart: number;
  firedTriggers: string[];
  consequenceValue: number;
};

function evaluateCondition(
  cond: MidMissionCondition,
  state: MidMissionEvaluationState,
  choiceHistory: Record<string, string>
): boolean {
  switch (cond.type) {
    case "objective_tile_reached":
      return state.units.some(
        (u) => u.faction === state.playerFaction && u.x === cond.at.x && u.y === cond.at.y
      );
    case "enemy_unit_hp_pct": {
      const enemy = state.units.find(
        (u) => u.unitDataId === cond.unitDataId && u.faction === state.enemyFaction
      );
      if (!enemy || enemy.maxHp <= 0) return false;
      return enemy.hp / enemy.maxHp < cond.threshold;
    }
    case "enemy_count_pct": {
      const current = state.units.filter((u) => u.faction === state.enemyFaction).length;
      if (state.enemyCountAtStart <= 0) return false;
      return current / state.enemyCountAtStart < cond.threshold;
    }
    case "turn":
      return state.turn === cond.turn;
    case "choice_history":
      return choiceHistory[cond.choiceId] === cond.value;
    case "consequence_range":
      return state.consequenceValue >= cond.min && state.consequenceValue <= cond.max;
  }
}

export function evaluateMidMissionTriggers(
  state: MidMissionEvaluationState,
  triggers: MidMissionTrigger[],
  choiceHistory: Record<string, string>
): MidMissionTrigger | null {
  for (const trig of triggers) {
    if (state.firedTriggers.includes(trig.id)) continue;
    if (trig.conditions.every((c) => evaluateCondition(c, state, choiceHistory))) {
      return trig;
    }
  }
  return null;
}

export type NarrativeState = {
  sceneId: string;
  beatIndex: number;
  background: string;
  leftSprite: string | null;
  rightSprite: string | null;
};

export type ChoiceResult = {
  next: NarrativeState | null;
  delta: number;
  extraDeltas: Record<string, number>;
  choiceId?: string;
  optionKey?: string;
};

function applyStageDirections(scene: Scene, fromIndex: number, ns: NarrativeState): NarrativeState {
  let state = { ...ns };
  for (let i = fromIndex; i < scene.beats.length; i++) {
    const beat = scene.beats[i];
    if (beat.type === "set_background") {
      state = { ...state, background: beat.background };
    } else if (beat.type === "set_sprites") {
      state = { ...state, leftSprite: beat.left ?? null, rightSprite: beat.right ?? null };
    } else {
      break;
    }
  }
  return state;
}

export function startScene(data: NarrativeData, sceneId: string): NarrativeState | null {
  const scene = data.scenes[sceneId];
  if (!scene) return null;

  let ns: NarrativeState = {
    sceneId,
    beatIndex: 0,
    background: scene.initialBackground,
    leftSprite: scene.initialLeft ?? null,
    rightSprite: scene.initialRight ?? null,
  };

  ns = applyStageDirections(scene, 0, ns);

  const firstVisible = scene.beats.findIndex((b) => b.type === "dialogue" || b.type === "choice");
  if (firstVisible !== -1) ns = { ...ns, beatIndex: firstVisible };

  return ns;
}

export function currentVisibleBeat(
  data: NarrativeData,
  ns: NarrativeState,
  choiceHistory: Record<string, string>
): DialogueBeat | ChoiceBeat | null {
  const scene = data.scenes[ns.sceneId];
  if (!scene) return null;

  for (let i = ns.beatIndex; i < scene.beats.length; i++) {
    const beat = scene.beats[i];
    if (beat.type === "set_background" || beat.type === "set_sprites") continue;
    if (beat.type === "dialogue" && beat.condition) {
      if (choiceHistory[beat.condition.choiceId] !== beat.condition.value) continue;
    }
    return beat;
  }
  return null;
}

export function advanceBeat(
  data: NarrativeData,
  ns: NarrativeState,
  choiceHistory: Record<string, string>
): NarrativeState | null {
  const scene = data.scenes[ns.sceneId];
  if (!scene) return null;

  let state = { ...ns };
  let i = ns.beatIndex + 1;

  while (i < scene.beats.length) {
    const beat = scene.beats[i];
    if (beat.type === "set_background") {
      state = { ...state, background: beat.background, beatIndex: i };
      i++;
      continue;
    }
    if (beat.type === "set_sprites") {
      state = { ...state, leftSprite: beat.left ?? null, rightSprite: beat.right ?? null, beatIndex: i };
      i++;
      continue;
    }
    if (beat.type === "dialogue" && beat.condition) {
      if (choiceHistory[beat.condition.choiceId] !== beat.condition.value) {
        i++;
        continue;
      }
    }
    return { ...state, beatIndex: i };
  }

  return null;
}

export function applyChoice(
  data: NarrativeData,
  ns: NarrativeState,
  optionIndex: number,
  choiceHistory: Record<string, string>
): ChoiceResult {
  const scene = data.scenes[ns.sceneId];
  const beat = scene?.beats[ns.beatIndex];
  if (!beat || beat.type !== "choice") {
    return { next: null, delta: 0, extraDeltas: {} };
  }

  const option = beat.options[optionIndex];
  if (!option) return { next: null, delta: 0, extraDeltas: {} };

  const next = advanceBeat(data, ns, choiceHistory);
  return {
    next,
    delta: option.delta,
    extraDeltas: option.extraDeltas ?? {},
    choiceId: option.choiceId,
    optionKey: option.optionKey,
  };
}

const ENDING_THRESHOLDS: Record<string, { low: number; high: number }> = {
  covenant:  { low: 30,  high: 70 },
  syndicate: { low: 30,  high: 70 },
  vrath:     { low: 30,  high: 70 },
};

export function getEndingSceneId(factionId: string, cv: number): string {
  const t = ENDING_THRESHOLDS[factionId];
  if (!t) return `${factionId}_ending`;
  if (factionId === "syndicate") return `${factionId}_ending`;
  if (cv < t.low)  return `${factionId}_ending_low`;
  if (cv > t.high) return `${factionId}_ending_high`;
  return `${factionId}_ending_mid`;
}
