"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { GameState, CampaignState, CampaignDef, Unit } from "@/game/engine/types";
import { initGame, dispatch, prepareEnemyTurnState, computeExtractorIncome } from "@/game/engine/state";
import { runEnemyTurnSteps } from "@/game/engine/ai";
import { renderGame, type MovingUnit, type RenderOverlay, type Camera } from "@/game/canvas/render";
import { precomputeTerrain, deriveResourcePositions, type TerrainBitmap } from "@/game/canvas/terrain";
import {
  loadSpriteSet,
  buildPlaceholderSpriteSet,
  USE_SPRITE_ASSETS,
  type SpriteSet,
  type SpriteKey,
} from "@/game/canvas/sprites";
import { canvasClickToAction, pixelToTileRaw, type InteractionMode } from "@/game/canvas/input";
import { chebyshevDistance, isInAttackRange } from "@/game/engine/combat";
import { MOTION, pruneFx, type RenderFx } from "@/game/canvas/motion";
import ForecastPanel from "@/components/game/ForecastPanel";
import { drawPuzzleOverlay, drawFragmentFlash, puzzleOverlayHitTest, type PuzzleHitAreas } from "@/game/canvas/puzzle-overlay";
import { puzzleAddSymbol, puzzleRemoveLast } from "@/game/engine/puzzle";
import { getCampaignDef, initCampaignState, getMissionAt, advanceMission, isCampaignComplete } from "@/game/engine/campaign";
import { startScene, applyChoice, getEndingSceneId, evaluateMidMissionTriggers } from "@/game/engine/narrative";
import type { NarrativeState, MidMissionEvaluationState } from "@/game/engine/narrative";
import { gameData } from "@/game/data/loader";
import NarrativeScene from "@/components/NarrativeScene";
import UnitPanel from "@/components/game/UnitPanel";
import Roster from "@/components/game/Roster";
import EventLog from "@/components/game/EventLog";
import ActionBar from "@/components/game/ActionBar";
import CommandStrip from "@/components/game/CommandStrip";
import LevelUpOverlay from "@/components/game/LevelUpOverlay";
import CommanderPortrait from "@/components/game/CommanderPortrait";
import FactionSigil from "@/components/game/FactionSigil";
import { isPirateUnlocked, unlockPirates, setPirateFlag, checkCovenantCondition, checkSyndicateCondition, checkAllPirateConditions } from "@/lib/pirate-unlock";
import { syncIdCounters } from "@/game/engine/state";
import {
  loadSave,
  saveMissionSnapshot,
  saveCampaignCheckpoint,
  clearRun,
  recordCodexEntry,
  getCodex,
  setSettings as persistSettings,
  markAdvisorySeen,
  setAdvisoriesMuted,
  restoreAdvisories,
  type GameSettings,
  type CodexRecord,
} from "@/lib/game-save";
import { nextAdvisory, type ActiveAdvisory, type AdvisoryDef } from "@/game/engine/advisories";
import { ensureStarted, setVolume } from "@/game/audio/audio";
import { playSfx } from "@/game/audio/sfx";
import { startAmbient, stopAmbient } from "@/game/audio/ambient";
import advisoriesRaw from "@/game/data/advisories.json";
import PauseOverlay from "@/components/game/PauseOverlay";
import SettingsOverlay from "@/components/game/SettingsOverlay";
import DebriefScreen from "@/components/game/DebriefScreen";
import CodexOverlay from "@/components/game/CodexOverlay";
import CoachMark from "@/components/game/CoachMark";
import FieldManual from "@/components/game/FieldManual";
import type { CSSProperties } from "react";
import type { GameEvent } from "@/game/engine/types";

const ADVISORY_DEFS = advisoriesRaw as AdvisoryDef[];

const CANVAS_SIZE = 1152;
const VIEWPORT = 16;
const GRID_SIZE = 64;
const MAX_CAMERA = GRID_SIZE - VIEWPORT;
const MOVE_DURATION = 280;
const DRAG_THRESHOLD = 4;

function clampCamera(x: number, y: number): Camera {
  return {
    x: Math.max(0, Math.min(MAX_CAMERA, Math.round(x))),
    y: Math.max(0, Math.min(MAX_CAMERA, Math.round(y))),
  };
}

function buildFactionColors(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const f of gameData.factions) result[f.id] = f.color;
  return result;
}

const factionColors = buildFactionColors();

type AnimState = {
  movingUnits: MovingUnit[];
  flashTiles: { x: number; y: number }[] | null;
  vfxTiles: { x: number; y: number }[] | null;
  levelUpUnitIds: Set<number>;
};

function diffCombatFx(
  before: GameState,
  after: GameState,
  fx: RenderFx,
  factionColorOf: (factionId: string) => string,
  now: number
): void {
  let stagger = 0;
  let hits = 0;
  let deaths = 0;
  for (const prev of before.units) {
    const cur = after.units.find((u) => u.id === prev.id);
    if (!cur) {
      if (!prev.unkillable) {
        fx.dying.push({ x: prev.x, y: prev.y, color: factionColorOf(prev.faction), isStructure: false, t0: now });
        fx.floaters.push({ x: prev.x, y: prev.y, text: `−${prev.hp}`, kind: "crit", t0: now + stagger });
        fx.floaters.push({ x: prev.x, y: prev.y, text: "DOWN", kind: "down", t0: now + stagger + 180 });
        stagger += 60;
        deaths++;
      }
      continue;
    }
    if (cur.hp < prev.hp) {
      fx.floaters.push({ x: cur.x, y: cur.y, text: `−${prev.hp - cur.hp}`, kind: "dmg", t0: now + stagger });
      fx.hpGhosts[cur.id] = { fromRatio: prev.hp / prev.maxHp, toRatio: cur.hp / cur.maxHp, t0: now };
      stagger += 60;
      hits++;
    } else if (cur.hp > prev.hp) {
      fx.floaters.push({ x: cur.x, y: cur.y, text: `+${cur.hp - prev.hp}`, kind: "heal", t0: now + stagger });
      stagger += 60;
    }
    if (cur.traits.length > prev.traits.length) {
      fx.floaters.push({ x: cur.x, y: cur.y, text: "UNLOCKED", kind: "label", t0: now + 120 });
    }
  }
  let structureFell = false;
  for (const prevStruct of before.structures) {
    const still = after.structures.some((s) => s.id === prevStruct.id);
    if (!still) {
      fx.dying.push({ x: prevStruct.x, y: prevStruct.y, color: "rgba(140,150,160,0.7)", isStructure: true, t0: now });
      structureFell = true;
    }
  }
  const arrivals = after.units.filter((u) => !before.units.some((b) => b.id === u.id)).length;

  if (deaths > 0) playSfx("down");
  else if (hits > 0) playSfx("hit");
  if (structureFell) playSfx("structureFall");
  if (arrivals > 0) playSfx("reinforce");
}

type ViewState =
  | { view: "select" }
  | { view: "commander_select"; factionId: string }
  | { view: "narrative"; afterComplete: "start_mission" | "next_mission_intro" | "campaign_end" | "commander_select" | "resume_mission" }
  | { view: "game" }
  | { view: "campaign-end" };

function getActiveAbilityTraits(unit: Unit) {
  return unit.traits.filter((t) => {
    const { condition } = t.effect;
    return (
      condition === "once_per_mission" ||
      condition === "once_per_turn" ||
      condition === "on_activate"
    );
  });
}

function isTraitOnCooldown(unit: Unit, traitId: string): boolean {
  const trait = unit.traits.find((t) => t.id === traitId);
  if (!trait) return true;
  if (trait.effect.condition === "once_per_mission" && unit.usedTraits.includes(traitId)) return true;
  if (unit.statusEffects.some((e) => e.id === `${traitId}_cooldown`)) return true;
  return false;
}

function abilityNeedsTarget(traitId: string): boolean {
  const data = gameData.units.flatMap((u) => u.traits).concat(gameData.commanders.flatMap((c) => c.traits));
  const trait = data.find((t) => t.id === traitId);
  if (!trait) return false;
  const { target } = trait.effect;
  return target === "enemy_unit" || target === "area";
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameStateReact] = useState<GameState | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animRef = useRef<AnimState>({ movingUnits: [], flashTiles: null, vfxTiles: null, levelUpUnitIds: new Set() });
  const animCancelRef = useRef<() => void>(() => {});
  const puzzleHitAreasRef = useRef<PuzzleHitAreas | null>(null);
  const fragmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fxRef = useRef<RenderFx>({
    floaters: [],
    dying: [],
    hpGhosts: {},
    pendingMoveGhost: null,
    nowMs: 0,
    reducedMotion: false,
  });
  const [stagedAttack, setStagedAttack] = useState<{ attackerId: number; targetId: number } | null>(null);
  const stagedAttackRef = useRef<typeof stagedAttack>(null);
  const setStaged = useCallback((v: { attackerId: number; targetId: number } | null) => {
    stagedAttackRef.current = v;
    setStagedAttack(v);
  }, []);
  const [hoverTargetId, setHoverTargetId] = useState<number | null>(null);

  const [overlayView, setOverlayView] = useState<"none" | "pause" | "settings" | "codex" | "manual">("none");
  const overlayViewRef = useRef(overlayView);
  overlayViewRef.current = overlayView;
  const pendingPauseRef = useRef(false);
  const [settings, setSettingsState] = useState<GameSettings>({ reducedMotion: "system", advisoriesMuted: false, difficulty: "standard", volume: 0.7 });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [codex, setCodex] = useState<Record<string, CodexRecord>>({});
  const [advisory, setAdvisory] = useState<ActiveAdvisory | null>(null);
  const advisoryRef = useRef<ActiveAdvisory | null>(null);
  advisoryRef.current = advisory;
  const seenAdvisoriesRef = useRef<Record<string, number>>({});
  const [advisoriesMutedState, setAdvisoriesMutedState] = useState(false);
  const [hasResume, setHasResume] = useState(false);
  const [savedProgress, setSavedProgress] = useState<{ factionId: string; missionIndex: number } | null>(null);
  const missionStartRosterRef = useRef<{ id: number; name: string }[]>([]);
  const fragmentsThisMissionRef = useRef(0);

  useEffect(() => {
    const save = loadSave();
    setSettingsState(save.settings);
    setCodex(save.codex);
    seenAdvisoriesRef.current = { ...save.advisories.seen };
    setAdvisoriesMutedState(save.advisories.muted || save.settings.advisoriesMuted);
    setHasResume(save.campaign !== null);
    setSavedProgress(save.campaign ? { factionId: save.campaign.factionId, missionIndex: save.campaign.missionIndex } : null);
    setVolume(save.settings.volume);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const pref = settingsRef.current.reducedMotion;
      fxRef.current.reducedMotion = pref === "on" ? true : pref === "off" ? false : mq.matches;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings]);

  const [viewState, setViewState] = useState<ViewState>({ view: "select" });
  const [campaignState, setCampaignState] = useState<CampaignState | null>(null);

  useEffect(() => {
    if (viewState.view === "game" && gameStateRef.current) {
      startAmbient(gameStateRef.current.mapId);
    } else if (viewState.view === "select" || viewState.view === "campaign-end") {
      stopAmbient();
    }
  }, [viewState, gameState]);

  const lastPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    const phase = gameState?.phase ?? null;
    if (phase !== lastPhaseRef.current) {
      if (phase === "win") playSfx("victory");
      else if (phase === "loss") playSfx("defeat");
      lastPhaseRef.current = phase;
    }
  }, [gameState]);
  const campaignStateRef = useRef<CampaignState | null>(null);
  const pendingFactionIdRef = useRef<string | null>(null);
  const pendingPostUnlockRef = useRef<boolean>(false);
  const pendingPostSceneRef = useRef<string | null>(null);
  const [campaignDef, setCampaignDef] = useState<CampaignDef | null>(null);
  const [narrativeState, setNarrativeState] = useState<NarrativeState | null>(null);
  const [pirateUnlocked, setPirateUnlocked] = useState(() => isPirateUnlocked());
  const [interactionMode, setInteractionMode] = useState<InteractionMode>({ mode: "normal" });
  const interactionModeRef = useRef<InteractionMode>(interactionMode);
  interactionModeRef.current = interactionMode;
  const [showStructurePicker, setShowStructurePicker] = useState(false);
  const [terrainLoading, setTerrainLoading] = useState(false);
  const terrainBitmapRef = useRef<TerrainBitmap | null>(null);
  const spritesCacheRef = useRef<Record<string, SpriteSet>>({});

  const [camera, setCameraReact] = useState<Camera>({ x: 0, y: 0 });
  const cameraRef = useRef<Camera>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; camX: number; camY: number; dragging: boolean } | null>(null);

  const setCamera = useCallback((cam: Camera) => {
    cameraRef.current = cam;
    setCameraReact(cam);
  }, []);

  const playableFactions = useMemo(
    () => gameData.factions.filter((f) => f.id !== "pirates" || pirateUnlocked),
    [pirateUnlocked]
  );

  const [selectedFactionId, setSelectedFactionId] = useState(() =>
    gameData.factions.find((f) => f.id !== "pirates")?.id ?? ""
  );
  const [selectedCommanderId, setSelectedCommanderId] = useState("");
  const currentFactionCommanders = gameData.commanders.filter((c) => c.factionId === selectedFactionId);

  useEffect(() => {
    const first = currentFactionCommanders[0];
    setSelectedCommanderId(first?.id ?? "");
  }, [selectedFactionId]);

  const setGameState = useCallback((state: GameState | null) => {
    gameStateRef.current = state;
    setGameStateReact(state);
  }, []);

  const appendEvents = useCallback((state: GameState, entries: Omit<GameEvent, "id">[]): GameState => {
    if (entries.length === 0) return state;
    let nextId = state.events.reduce((m, e) => Math.max(m, e.id), 0);
    const next: GameEvent[] = entries.map((e) => ({ ...e, id: ++nextId }));
    const all = [...state.events, ...next];
    const capped = all.length > 200 ? all.slice(all.length - 200) : all;
    return { ...state, events: capped };
  }, []);

  const renderOverlay = useMemo((): RenderOverlay => {
    const gs = gameStateRef.current;
    if (!gs || interactionMode.mode === "normal") return {};

    if (interactionMode.mode === "build") {
      const unit = gs.units.find((u) => u.id === interactionMode.unitId);
      if (!unit) return {};
      const candidates: { x: number; y: number }[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const tx = unit.x + dx;
          const ty = unit.y + dy;
          if (tx < 0 || ty < 0 || tx >= GRID_SIZE || ty >= GRID_SIZE) continue;
          const tile = gs.grid[ty]?.[tx];
          if (!tile?.passable) continue;
          if (gs.units.some((u) => u.x === tx && u.y === ty)) continue;
          if (gs.structures.some((s) => s.x === tx && s.y === ty)) continue;
          candidates.push({ x: tx, y: ty });
        }
      }
      return { buildTargets: candidates };
    }

    if (interactionMode.mode === "demolish") {
      const unit = gs.units.find((u) => u.id === interactionMode.unitId);
      if (!unit) return {};
      const targets = gs.structures.filter((s) => chebyshevDistance(unit, { x: s.x, y: s.y }) <= 1);
      return { demolishTargets: targets.map((s) => ({ x: s.x, y: s.y })) };
    }

    if (interactionMode.mode === "ability" && interactionMode.needsTarget) {
      const targets: { x: number; y: number }[] = [];
      for (const u of gs.units) {
        if (u.faction === gs.enemyFaction && gs.fog[u.y]?.[u.x]) {
          targets.push({ x: u.x, y: u.y });
        }
      }
      return { abilityTargets: targets };
    }

    return {};
  }, [interactionMode, gameState]);

  useEffect(() => {
    let lastTime = performance.now();
    let rafId: number;

    function loop(now: number) {
      const dt = Math.min(now - lastTime, 100);
      lastTime = now;

      const anim = animRef.current;
      for (const mu of anim.movingUnits) {
        mu.progress = Math.min(1, mu.progress + dt / MOVE_DURATION);
      }
      anim.movingUnits = anim.movingUnits.filter((mu) => mu.progress < 1);

      const canvas = canvasRef.current;
      const state = gameStateRef.current;
      if (canvas && state) {
        if (state.activePuzzle?.showingFragment && state.activePuzzle.fragment) {
          const codexCount = Object.keys(getCodex()).length;
          drawFragmentFlash(
            canvas,
            state.activePuzzle.fragment.text,
            `ADDED TO CODEX · ${codexCount}/${gameData.puzzleFragments.fragments.length}`
          );
        } else if (state.activePuzzle) {
          const hits = drawPuzzleOverlay(canvas, state.activePuzzle, state);
          puzzleHitAreasRef.current = hits;
        } else {
          puzzleHitAreasRef.current = null;
          const fx = fxRef.current;
          fx.nowMs = now;
          pruneFx(fx, now);
          const pm = state.pendingMove;
          const pmUnit = pm ? state.units.find((u) => u.id === pm.unitId) : null;
          fx.pendingMoveGhost = pm && pmUnit && !pmUnit.hasActed
            ? { x: pm.fromX, y: pm.fromY, color: factionColors[pmUnit.faction] ?? "#888" }
            : null;
          renderGame(
            canvas,
            state,
            factionColors,
            cameraRef.current,
            anim.flashTiles ?? undefined,
            anim.movingUnits.length > 0 ? anim.movingUnits : undefined,
            { ...renderOverlay, advisoryTile: advisoryRef.current?.tile ?? null },
            anim.vfxTiles ?? undefined,
            anim.levelUpUnitIds.size > 0 ? anim.levelUpUnitIds : undefined,
            terrainBitmapRef.current,
            fx
          );
        }
      }

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [renderOverlay]);

  useEffect(() => {
    function onWindowPointerUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointerup", onWindowPointerUp);
    return () => window.removeEventListener("pointerup", onWindowPointerUp);
  }, []);

  const keyHandlersRef = useRef({
    endTurn: () => {},
    cancel: () => {},
    ability: () => {},
    build: () => {},
    undo: () => {},
  });

  const acknowledgeAdvisory = useCallback(() => {
    const active = advisoryRef.current;
    if (!active) return;
    const gs = gameStateRef.current;
    seenAdvisoriesRef.current = { ...seenAdvisoriesRef.current, [active.def.id]: gs?.turn ?? 0 };
    markAdvisorySeen(active.def.id, gs?.turn ?? 0);
    setAdvisory(null);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (viewState.view !== "game") return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;

      const overlay = overlayViewRef.current;
      if (overlay !== "none") {
        if (e.key === "Escape") {
          e.preventDefault();
          if (overlay === "pause") setOverlayView("none");
          else if (overlay === "settings" || overlay === "manual") setOverlayView("pause");
          else if (overlay === "codex") setOverlayView("pause");
        }
        return;
      }

      const gs = gameStateRef.current;
      if (!gs) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (gs.phase === "player-turn") {
          if (stagedAttackRef.current || gs.activePuzzle) {
            keyHandlersRef.current.cancel();
          } else {
            const im = interactionModeRef.current;
            if (im.mode !== "normal") {
              keyHandlersRef.current.cancel();
            } else {
              setOverlayView("pause");
            }
          }
        } else if (gs.phase === "enemy-turn") {
          pendingPauseRef.current = true;
        }
        return;
      }

      if (e.key === "?" && gs.phase !== "win" && gs.phase !== "loss") {
        e.preventDefault();
        setOverlayView("manual");
        return;
      }

      if (e.key === " " && advisoryRef.current) {
        e.preventDefault();
        acknowledgeAdvisory();
        return;
      }

      if (gs.phase !== "player-turn") return;
      if (e.key === "Enter") {
        e.preventDefault();
        keyHandlersRef.current.endTurn();
      } else if (e.key === "3") {
        e.preventDefault();
        keyHandlersRef.current.ability();
      } else if (e.key === "4") {
        e.preventDefault();
        keyHandlersRef.current.build();
      } else if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        keyHandlersRef.current.undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewState, acknowledgeAdvisory]);

  const loadTerrainFor = useCallback((mapId: string, state: GameState) => {
    terrainBitmapRef.current = null;
    const map = gameData.maps.find((m) => m.id === mapId);
    if (!map?.terrain) {
      setTerrainLoading(false);
      return;
    }
    const terrainCfg = map.terrain;
    setTerrainLoading(true);
    (async () => {
      try {
        let sprites = spritesCacheRef.current[mapId];
        if (!sprites) {
          sprites = USE_SPRITE_ASSETS
            ? await loadSpriteSet(terrainCfg.spriteAssets, terrainCfg.resourceAlphaScale)
            : buildPlaceholderSpriteSet(
                Object.keys(terrainCfg.spriteAssets) as SpriteKey[],
                terrainCfg.resourceAlphaScale
              );
          spritesCacheRef.current[mapId] = sprites;
        }
        const bitmap = await precomputeTerrain({
          grid: state.grid,
          terrain: terrainCfg,
          puzzleNodes: state.puzzleNodes,
          resourcePositions: deriveResourcePositions(state.grid),
          pxPerCell: 48,
        }, sprites);
        terrainBitmapRef.current = bitmap;
      } catch (err) {
        console.error("[GameCanvas] terrain precompute failed:", err);
        terrainBitmapRef.current = null;
      } finally {
        setTerrainLoading(false);
      }
    })();
  }, []);

  const enterMissionView = useCallback((state: GameState, camera: Camera) => {
    setGameState(state);
    setInteractionMode({ mode: "normal" });
    setShowStructurePicker(false);
    setStaged(null);
    setHoverTargetId(null);
    setOverlayView("none");
    setAdvisory(null);
    pendingPauseRef.current = false;
    fxRef.current.floaters = [];
    fxRef.current.dying = [];
    fxRef.current.hpGhosts = {};
    setCamera(camera);
    setViewState({ view: "game" });
  }, [setGameState, setCamera, setStaged]);

  const startMission = useCallback((cs: CampaignState, cd: CampaignDef) => {
    const mission = getMissionAt(cd, cs.missionIndex);
    if (!mission) return;
    const state = initGame(
      gameData, mission.mapId, cs.factionId, cs.commanderId, mission.enemyFaction, mission.missionKey,
      { difficulty: settingsRef.current.difficulty }
    );
    if (!state) { console.error("[GameCanvas] Failed to initialize mission"); return; }
    missionStartRosterRef.current = state.units
      .filter((u) => u.faction === cs.factionId)
      .map((u) => ({ id: u.id, name: u.name }));
    fragmentsThisMissionRef.current = 0;
    const spawnFocus = state.units.find((u) => u.faction === cs.factionId && u.isCommander) ?? state.units[0];
    enterMissionView(state, spawnFocus
      ? clampCamera(spawnFocus.x - Math.floor(VIEWPORT / 2), spawnFocus.y - Math.floor(VIEWPORT / 2))
      : { x: 0, y: 0 });
    saveMissionSnapshot(state, cameraRef.current, cs);
    setHasResume(true);
    loadTerrainFor(mission.mapId, state);
  }, [enterMissionView, loadTerrainFor]);

  const resumeFromSave = useCallback(() => {
    const save = loadSave();
    if (!save.campaign) return;
    const cd = getCampaignDef(save.campaign.factionId, gameData.maps);
    if (!cd) { console.error("[GameCanvas] resume: no campaign def"); clearRun(); setHasResume(false); return; }
    campaignStateRef.current = save.campaign;
    setCampaignState(save.campaign);
    setCampaignDef(cd);
    setNarrativeState(null);
    if (save.mission) {
      syncIdCounters(save.mission.state);
      missionStartRosterRef.current = save.mission.state.units
        .filter((u) => u.faction === save.campaign?.factionId)
        .map((u) => ({ id: u.id, name: u.name }));
      fragmentsThisMissionRef.current = 0;
      enterMissionView(save.mission.state, save.mission.camera);
      loadTerrainFor(save.mission.state.mapId, save.mission.state);
    } else {
      startMission(save.campaign, cd);
    }
  }, [enterMissionView, loadTerrainFor, startMission]);

  useEffect(() => {
    if (viewState.view !== "game") {
      if (advisoryRef.current) setAdvisory(null);
      return;
    }
    if (!gameState || advisoryRef.current) return;
    if (overlayView !== "none") return;
    if (advisoriesMutedState || settings.advisoriesMuted) return;
    if (gameState.phase !== "player-turn") return;
    const missionIndex = campaignStateRef.current?.missionIndex ?? 0;
    const next = nextAdvisory(ADVISORY_DEFS, gameState, missionIndex, seenAdvisoriesRef.current, false);
    if (next) setAdvisory(next);
  }, [gameState, viewState, overlayView, advisoriesMutedState, settings]);

  const handleMidMissionTriggerCheck = useCallback((newState: GameState): boolean => {
    const cs = campaignStateRef.current;
    if (!cs) return false;
    const triggers = gameData.narrativeData.midMissionTriggers?.[newState.missionKey];
    if (!triggers || triggers.length === 0) return false;
    const evalState: MidMissionEvaluationState = {
      units: newState.units.map((u) => ({
        faction: u.faction,
        x: u.x,
        y: u.y,
        hp: u.hp,
        maxHp: u.maxHp,
        unitDataId: u.unitDataId,
      })),
      playerFaction: newState.playerFaction,
      enemyFaction: newState.enemyFaction,
      turn: newState.turn,
      enemyCountAtStart: newState.enemyCountAtStart,
      firedTriggers: newState.firedTriggers,
      consequenceValue: cs.consequenceVariable.value,
    };
    const triggered = evaluateMidMissionTriggers(evalState, triggers, cs.choiceHistory);
    if (!triggered) return false;

    let sceneToPlay = triggered.sceneId;
    let unlockOnEnd = false;
    if (triggered.pirateAltSceneId && checkAllPirateConditions(cs.factionId, cs.missionIndex, cs.consequenceVariable.value)) {
      sceneToPlay = triggered.pirateAltSceneId;
      if (triggered.postUnlockPirates) unlockOnEnd = true;
    }
    const ns = startScene(gameData.narrativeData, sceneToPlay);
    if (!ns) return false;

    const updated: GameState = { ...newState, firedTriggers: [...newState.firedTriggers, triggered.id] };
    setGameState(updated);
    setNarrativeState(ns);
    pendingPostUnlockRef.current = unlockOnEnd;
    pendingPostSceneRef.current = triggered.postSceneId ?? null;
    setViewState({ view: "narrative", afterComplete: "resume_mission" });
    return true;
  }, [setGameState]);

  const handleNarrativeComplete = useCallback(() => {
    if (viewState.view !== "narrative") return;
    const cs = campaignStateRef.current;
    const cd = campaignDef;

    if (viewState.afterComplete === "start_mission") {
      if (cs && cd) startMission(cs, cd);
    } else if (viewState.afterComplete === "next_mission_intro") {
      if (!cs || !cd) return;
      const introSceneId = `${cs.factionId}_m${cs.missionIndex + 1}_intro`;
      const nextNs = startScene(gameData.narrativeData, introSceneId);
      if (nextNs) {
        setNarrativeState(nextNs);
        setViewState({ view: "narrative", afterComplete: "start_mission" });
      } else {
        startMission(cs, cd);
      }
    } else if (viewState.afterComplete === "campaign_end") {
      setViewState({ view: "campaign-end" });
    } else if (viewState.afterComplete === "commander_select") {
      const factionId = pendingFactionIdRef.current;
      pendingFactionIdRef.current = null;
      if (factionId) {
        setSelectedFactionId(factionId);
        setViewState({ view: "commander_select", factionId });
      } else {
        setViewState({ view: "select" });
      }
    } else if (viewState.afterComplete === "resume_mission") {
      if (pendingPostUnlockRef.current) {
        unlockPirates();
        setPirateUnlocked(true);
        pendingPostUnlockRef.current = false;
      }
      const chained = pendingPostSceneRef.current;
      pendingPostSceneRef.current = null;
      if (chained) {
        const ns = startScene(gameData.narrativeData, chained);
        if (ns) {
          setNarrativeState(ns);
          setViewState({ view: "narrative", afterComplete: "resume_mission" });
          return;
        }
      }
      setNarrativeState(null);
      setViewState({ view: "game" });
    }
  }, [viewState, campaignDef, startMission]);

  const handleNarrativeAdvance = useCallback((next: NarrativeState | null) => {
    if (next === null) {
      handleNarrativeComplete();
    } else {
      setNarrativeState(next);
    }
  }, [handleNarrativeComplete]);

  const handleChoice = useCallback((optionIndex: number) => {
    const ns = narrativeState;
    if (!ns) return;
    const cs = campaignStateRef.current;
    const result = applyChoice(gameData.narrativeData, ns, optionIndex, cs?.choiceHistory ?? {});

    if (cs) {
      const newExtras = { ...cs.extraVariables };
      for (const [k, v] of Object.entries(result.extraDeltas)) {
        newExtras[k] = (newExtras[k] ?? 0) + v;
      }
      const newCs: CampaignState = {
        ...cs,
        consequenceVariable: { ...cs.consequenceVariable, value: cs.consequenceVariable.value + result.delta },
        extraVariables: newExtras,
        choiceHistory: result.choiceId
          ? { ...cs.choiceHistory, [result.choiceId]: result.optionKey ?? "" }
          : cs.choiceHistory,
      };
      campaignStateRef.current = newCs;
      setCampaignState(newCs);
    } else if (result.optionKey) {
      pendingFactionIdRef.current = result.optionKey;
    }

    if (result.next === null) {
      handleNarrativeComplete();
    } else {
      setNarrativeState(result.next);
    }
  }, [narrativeState, handleNarrativeComplete]);

  const handleBegin = useCallback(() => {
    const ns = startScene(gameData.narrativeData, "sheifport_hub");
    if (ns) {
      setNarrativeState(ns);
      setViewState({ view: "narrative", afterComplete: "commander_select" });
    } else {
      setViewState({ view: "commander_select", factionId: playableFactions[0]?.id ?? "covenant" });
    }
  }, [playableFactions]);

  const handleDevSkipToMission = useCallback((factionId: string, missionIndex: number) => {
    const cd = getCampaignDef(factionId, gameData.maps);
    if (!cd) { console.error("[GameCanvas] No campaign for faction:", factionId); return; }
    const faction = gameData.factions.find((f) => f.id === factionId);
    const consequenceVarId = faction?.consequenceVariable?.id ?? "unknown";
    const commanderId = gameData.commanders.find((c) => c.factionId === factionId)?.id ?? "";
    const cs: CampaignState = { ...initCampaignState(factionId, commanderId, consequenceVarId), missionIndex };
    campaignStateRef.current = cs;
    setCampaignState(cs);
    setCampaignDef(cd);
    setNarrativeState(null);
    startMission(cs, cd);
  }, [startMission]);

  const handleDeploy = useCallback(() => {
    const factionId = viewState.view === "commander_select" ? viewState.factionId : selectedFactionId;
    const cd = getCampaignDef(factionId, gameData.maps);
    if (!cd) { console.error("[GameCanvas] No campaign for faction:", factionId); return; }

    const faction = gameData.factions.find((f) => f.id === factionId);
    const consequenceVarId = faction?.consequenceVariable?.id ?? "unknown";
    const cs = initCampaignState(factionId, selectedCommanderId, consequenceVarId);

    campaignStateRef.current = cs;
    setCampaignState(cs);
    setCampaignDef(cd);

    const introSceneId = `${factionId}_intro`;
    const ns = startScene(gameData.narrativeData, introSceneId);
    if (ns) {
      setNarrativeState(ns);
      setViewState({ view: "narrative", afterComplete: "start_mission" });
    } else {
      startMission(cs, cd);
    }
  }, [viewState, selectedFactionId, selectedCommanderId, startMission]);

  const handleMissionEnd = useCallback((won: boolean) => {
    if (!won || !campaignStateRef.current || !campaignDef) return;
    const cs = campaignStateRef.current;
    const consequenceDelta = gameStateRef.current?.consequenceVariable.value ?? 0;
    const newCs = advanceMission(cs, consequenceDelta);
    campaignStateRef.current = newCs;
    setCampaignState(newCs);
    saveCampaignCheckpoint(newCs);

    if (isCampaignComplete(campaignDef, newCs.missionIndex)) {
      clearRun();
      setHasResume(false);
      if (cs.factionId === "covenant" && checkCovenantCondition(newCs.choiceHistory)) {
        setPirateFlag("covenant");
      }
      if (cs.factionId === "syndicate" && checkSyndicateCondition(newCs.choiceHistory)) {
        setPirateFlag("syndicate");
      }
      const endingSceneId = getEndingSceneId(cs.factionId, newCs.consequenceVariable.value);
      const ns = startScene(gameData.narrativeData, endingSceneId);
      if (ns) {
        setNarrativeState(ns);
        setViewState({ view: "narrative", afterComplete: "campaign_end" });
      } else {
        setViewState({ view: "campaign-end" });
      }
    } else {
      const postSceneId = `${cs.factionId}_m${cs.missionIndex + 1}_post`;
      const ns = startScene(gameData.narrativeData, postSceneId);
      if (ns) {
        setNarrativeState(ns);
        setViewState({ view: "narrative", afterComplete: "next_mission_intro" });
      } else {
        const introSceneId = `${cs.factionId}_m${newCs.missionIndex + 1}_intro`;
        const introNs = startScene(gameData.narrativeData, introSceneId);
        if (introNs) {
          setNarrativeState(introNs);
          setViewState({ view: "narrative", afterComplete: "start_mission" });
        } else {
          startMission(newCs, campaignDef);
        }
      }
    }
  }, [campaignDef, startMission]);

  const handleMouseDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    ensureStarted();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      camX: cameraRef.current.x,
      camY: cameraRef.current.y,
      dragging: false,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      if (e.pointerType !== "mouse") return;
      const gs = gameStateRef.current;
      const canvas = canvasRef.current;
      if (!gs || !canvas || gs.phase !== "player-turn" || gs.activePuzzle || gs.selectedUnitId === null) {
        if (hoverTargetId !== null) setHoverTargetId(null);
        return;
      }
      const tile = pixelToTileRaw(e.clientX, e.clientY, canvas, cameraRef.current);
      const attacker = gs.units.find((u) => u.id === gs.selectedUnitId);
      const target = tile ? gs.units.find((u) => u.x === tile.x && u.y === tile.y && u.faction === gs.enemyFaction) : null;
      const ctx = { armyEffects: gs.armyEffects, allUnits: gs.units, structures: gs.structures, structureDefs: gs.structureDefs };
      const valid =
        attacker && target && !attacker.hasActed && gs.fog[target.y]?.[target.x] && isInAttackRange(attacker, target, ctx)
          ? target.id
          : null;
      if (valid !== hoverTargetId) setHoverTargetId(valid);
      return;
    }
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.dragging && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
    drag.dragging = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const tileSize = Math.floor(Math.min(canvas.width, canvas.height) / VIEWPORT);
    if (stagedAttackRef.current && Math.sqrt(dx * dx + dy * dy) > tileSize * VIEWPORT * 0.25) {
      setStaged(null);
    }
    const newCam = clampCamera(
      drag.camX - dx / tileSize,
      drag.camY - dy / tileSize
    );
    setCamera(newCam);
  }, [setCamera, hoverTargetId, setStaged]);

  const handleMouseUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag?.dragging) return;

      const gs = gameStateRef.current;
      if (!gs || !canvasRef.current) return;

      if (gs.activePuzzle?.showingFragment) {
        if (fragmentTimerRef.current) clearTimeout(fragmentTimerRef.current);
        setGameState({ ...gs, activePuzzle: null });
        return;
      }

      if (gs.activePuzzle) {
        const hits = puzzleHitAreasRef.current;
        if (!hits) return;
        const result = puzzleOverlayHitTest(e.nativeEvent, canvasRef.current, hits);
        if (!result) return;

        if (result.type === "symbol") {
          setGameState({ ...gs, activePuzzle: puzzleAddSymbol(gs.activePuzzle, result.glyph) });
          return;
        }

        if (result.type === "button") {
          if (result.action === "backspace") {
            setGameState({ ...gs, activePuzzle: puzzleRemoveLast(gs.activePuzzle) });
            return;
          }
          if (result.action === "submit") {
            const newState = dispatch(gs, { type: "PUZZLE_SUBMIT", answer: gs.activePuzzle.answer });
            playSfx(newState.armyEffects.length > gs.armyEffects.length ? "puzzleSolve" : "puzzleFail");
            if (newState.activePuzzle?.showingFragment) {
              const frag = newState.activePuzzle.fragment;
              if (frag) {
                const map = gameData.maps.find((m) => m.id === gs.mapId);
                recordCodexEntry(frag.id, {
                  world: map?.world ?? gs.mapId,
                  mission: gs.missionKey,
                  turn: gs.turn,
                  node: newState.activePuzzle.nodeId,
                  recoveredAt: new Date().toISOString(),
                });
                setCodex(getCodex());
                fragmentsThisMissionRef.current += 1;
              }
              setGameState(newState);
              fragmentTimerRef.current = setTimeout(() => {
                setGameState({ ...newState, activePuzzle: null });
              }, gs.puzzleDef.fragmentDisplayDuration * 3);
            } else {
              setGameState(newState);
            }
            return;
          }
          if (result.action === "skip") {
            playSfx("uiTick");
            setGameState(dispatch(gs, { type: "PUZZLE_SKIP" }));
            return;
          }
        }
        return;
      }

      const action = canvasClickToAction(e.nativeEvent, canvasRef.current, gs, cameraRef.current, interactionMode);
      if (!action) {
        setStaged(null);
        return;
      }

      if (action.type === "ATTACK") {
        const staged = stagedAttackRef.current;
        if (!staged || staged.attackerId !== action.attackerId || staged.targetId !== action.targetId) {
          setStaged({ attackerId: action.attackerId, targetId: action.targetId });
          playSfx("stage");
          return;
        }
        setStaged(null);
      } else if (action.type !== "SELECT_UNIT") {
        setStaged(null);
      }

      if (action.type === "SELECT_UNIT") playSfx("select");
      else if (action.type === "MOVE_UNIT") playSfx("move");
      else if (action.type === "BUILD") playSfx("build");
      else if (action.type === "REPAIR_STRUCTURE") playSfx("repair");
      else if (action.type === "UPGRADE_EXTRACTOR") playSfx("build");
      else if (action.type === "DEMOLISH") playSfx("structureFall");

      if (action.type === "BUILD" || action.type === "DEMOLISH" || action.type === "USE_ABILITY") {
        setInteractionMode({ mode: "normal" });
        setShowStructurePicker(false);
      }

      if (action.type === "MOVE_UNIT") {
        const unit = gs.units.find((u) => u.id === action.unitId);
        if (unit) {
          animRef.current.movingUnits = animRef.current.movingUnits.filter((m) => m.id !== unit.id);
          animRef.current.movingUnits.push({ id: unit.id, fromX: unit.x, fromY: unit.y, progress: 0 });
        }
      }

      if (action.type === "ATTACK") {
        const attacker = gs.units.find((u) => u.id === action.attackerId);
        const defender = gs.units.find((u) => u.id === action.targetId);
        if (attacker && defender) {
          animRef.current.flashTiles = [{ x: attacker.x, y: attacker.y }, { x: defender.x, y: defender.y }];
          setTimeout(() => { animRef.current.flashTiles = null; }, 300);
        }
      }

      if (action.type === "USE_ABILITY") {
        const caster = gs.units.find((u) => u.id === action.unitId);
        const vfxTiles: { x: number; y: number }[] = caster ? [{ x: caster.x, y: caster.y }] : [];
        if (action.targetTile) {
          vfxTiles.push(action.targetTile);
        } else if (action.targetUnitId !== undefined) {
          const targetUnit = gs.units.find((u) => u.id === action.targetUnitId);
          if (targetUnit) vfxTiles.push({ x: targetUnit.x, y: targetUnit.y });
        }
        if (vfxTiles.length > 0) {
          animRef.current.vfxTiles = vfxTiles;
          setTimeout(() => { animRef.current.vfxTiles = null; }, 350);
        }
      }

      if (action.type === "SELECT_UNIT" || action.type === "DESELECT") {
        setInteractionMode({ mode: "normal" });
        setShowStructurePicker(false);
      }

      const dispatched = dispatch(gs, action);
      diffCombatFx(gs, dispatched, fxRef.current, (f) => factionColors[f] ?? "#888", performance.now());

      const evts: Omit<GameEvent, "id">[] = [];
      const turn = dispatched.turn;
      if (action.type === "MOVE_UNIT") {
        const u = dispatched.units.find((x) => x.id === action.unitId);
        if (u) evts.push({ turn, kind: "you", text: `*${u.name}* advances to (${action.to.x},${action.to.y}).` });
      } else if (action.type === "ATTACK") {
        const a = gs.units.find((x) => x.id === action.attackerId);
        const d = gs.units.find((x) => x.id === action.targetId);
        const dAfter = dispatched.units.find((x) => x.id === action.targetId);
        if (a && d) {
          const dmg = dAfter ? Math.max(0, d.hp - dAfter.hp) : d.hp;
          evts.push({ turn, kind: "you", text: `*${a.name}* strikes *${d.name}* for ${dmg}.` });
          if (!dAfter) evts.push({ turn, kind: "atk", text: `*${d.name}* is down.` });
        }
      } else if (action.type === "BUILD") {
        const u = gs.units.find((x) => x.id === action.unitId);
        const def = gs.structureDefs.find((s) => s.id === action.structureDefId);
        if (u && def) evts.push({ turn, kind: "ok", text: `*${u.name}* builds a *${def.name}* at (${action.at.x},${action.at.y}). ¤${def.currencyCost} spent.` });
      } else if (action.type === "DEMOLISH") {
        const struct = gs.structures.find((s) => s.x === action.at.x && s.y === action.at.y);
        if (struct) evts.push({ turn, kind: "sys", text: `Structure *${struct.name}* demolished.` });
      } else if (action.type === "USE_ABILITY") {
        const a = gs.units.find((x) => x.id === action.unitId);
        const trait = a?.traits.find((t) => t.id === action.traitId);
        if (a && trait) evts.push({ turn, kind: "you", text: `*${a.name}* triggers *${trait.name}*.` });
      } else if (action.type === "UPGRADE_EXTRACTOR") {
        evts.push({ turn, kind: "ok", text: "Extractor upgraded." });
      } else if (action.type === "REPAIR_STRUCTURE") {
        evts.push({ turn, kind: "ok", text: "Structure repaired." });
      }
      const newState = appendEvents(dispatched, evts);
      setGameState(newState);

      if (action.type === "ATTACK" && newState.pendingMilestones.length > gs.pendingMilestones.length) {
        const newMilestone = newState.pendingMilestones.find(
          (m) => !gs.pendingMilestones.some((old) => old.unitId === m.unitId)
        );
        if (newMilestone) {
          animRef.current.levelUpUnitIds = new Set([...animRef.current.levelUpUnitIds, newMilestone.unitId]);
          setTimeout(() => {
            animRef.current.levelUpUnitIds = new Set(
              [...animRef.current.levelUpUnitIds].filter((id) => id !== newMilestone.unitId)
            );
          }, 1200);
        }
      }

      if (action.type === "MOVE_UNIT") {
        const movedUnit = newState.units.find((u) => u.id === action.unitId);
        if (movedUnit) {
          const cam = cameraRef.current;
          const inView =
            movedUnit.x >= cam.x && movedUnit.x < cam.x + VIEWPORT &&
            movedUnit.y >= cam.y && movedUnit.y < cam.y + VIEWPORT;
          if (!inView) {
            setCamera(clampCamera(
              movedUnit.x - Math.floor(VIEWPORT / 2),
              movedUnit.y - Math.floor(VIEWPORT / 2)
            ));
          }
        }
      }

      if (newState.phase !== "win" && newState.phase !== "loss") {
        handleMidMissionTriggerCheck(newState);
      }
    },
    [setGameState, interactionMode, setCamera, handleMidMissionTriggerCheck, appendEvents, setStaged]
  );

  const handleNextMission = useCallback(() => {
    animCancelRef.current();
    animRef.current.flashTiles = null;
    animRef.current.movingUnits = [];
    animRef.current.vfxTiles = null;
    animRef.current.levelUpUnitIds = new Set();
    handleMissionEnd(true);
  }, [handleMissionEnd]);

  const handleEndTurn = useCallback(() => {
    const gs = gameStateRef.current;
    if (!gs) return;

    setInteractionMode({ mode: "normal" });
    setShowStructurePicker(false);
    setStaged(null);
    setHoverTargetId(null);
    animCancelRef.current();

    const { playerIncome, enemyIncome } = computeExtractorIncome(gs);
    const gsWithIncome = {
      ...gs,
      globalCurrency: gs.globalCurrency + playerIncome,
      enemyGlobalCurrency: gs.enemyGlobalCurrency + enemyIncome,
    };

    const turnEntries: Omit<GameEvent, "id">[] = [
      { turn: gs.turn, kind: "sys", text: "· Enemy turn ·" },
    ];
    if (playerIncome > 0) {
      turnEntries.unshift({ turn: gs.turn, kind: "ok", text: `Extractor draws *¤${playerIncome}* from the deposit.` });
      playSfx("income");
    }
    playSfx("enemyTurn");
    const startState = appendEvents(prepareEnemyTurnState(gsWithIncome), turnEntries);
    setGameState(startState);

    const frames = runEnemyTurnSteps(startState);
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let prevFrameState = startState;

    animCancelRef.current = () => {
      cancelled = true;
      clearTimeout(timeoutId);
      animRef.current.flashTiles = null;
      animRef.current.movingUnits = [];
    };

    let i = 0;
    function playNext() {
      if (cancelled || i >= frames.length) return;
      const frame = frames[i++];

      for (const unit of frame.state.units) {
        const prev = prevFrameState.units.find((u) => u.id === unit.id);
        if (prev && (prev.x !== unit.x || prev.y !== unit.y)) {
          animRef.current.movingUnits = animRef.current.movingUnits.filter((m) => m.id !== unit.id);
          animRef.current.movingUnits.push({ id: unit.id, fromX: prev.x, fromY: prev.y, progress: 0 });
        }
      }

      diffCombatFx(prevFrameState, frame.state, fxRef.current, (f) => factionColors[f] ?? "#888", performance.now());
      const unitDied = frame.state.units.length < prevFrameState.units.length;

      animRef.current.flashTiles = frame.flashTiles ?? null;
      prevFrameState = frame.state;
      setGameState(frame.state);

      if (frame.duration > 0 && i < frames.length) {
        timeoutId = setTimeout(playNext, unitDied ? Math.max(frame.duration, MOTION.fall) : frame.duration);
      } else {
        animRef.current.flashTiles = null;
        if (frame.state.phase === "player-turn") {
          playSfx("playerTurn");
          const turned = appendEvents(frame.state, [{ turn: frame.state.turn, kind: "sys", text: "· Your turn ·" }]);
          setGameState(turned);
          saveMissionSnapshot(turned, cameraRef.current, campaignStateRef.current);
          if (pendingPauseRef.current) {
            pendingPauseRef.current = false;
            setOverlayView("pause");
          }
        }
        if (frame.state.phase !== "win" && frame.state.phase !== "loss") {
          handleMidMissionTriggerCheck(frame.state);
        }
      }
    }

    timeoutId = setTimeout(playNext, 180);
  }, [setGameState, handleMidMissionTriggerCheck, appendEvents, setStaged]);

  const handleRestart = useCallback(() => {
    if (fragmentTimerRef.current) clearTimeout(fragmentTimerRef.current);
    animCancelRef.current();
    animRef.current.flashTiles = null;
    animRef.current.movingUnits = [];
    animRef.current.vfxTiles = null;
    animRef.current.levelUpUnitIds = new Set();
    setStaged(null);
    setHoverTargetId(null);
    fxRef.current.floaters = [];
    fxRef.current.dying = [];
    fxRef.current.hpGhosts = {};
    campaignStateRef.current = null;
    pendingFactionIdRef.current = null;
    setCampaignState(null);
    setCampaignDef(null);
    setNarrativeState(null);
    setGameState(null);
    setInteractionMode({ mode: "normal" });
    setShowStructurePicker(false);
    setCamera({ x: 0, y: 0 });
    setViewState({ view: "select" });
    setOverlayView("none");
    setAdvisory(null);
    pendingPauseRef.current = false;
    const save = loadSave();
    setHasResume(save.campaign !== null);
    setSavedProgress(save.campaign ? { factionId: save.campaign.factionId, missionIndex: save.campaign.missionIndex } : null);
  }, [setGameState, setCamera, setStaged]);

  const handleRetryMission = useCallback(() => {
    const cs = campaignStateRef.current;
    const cd = campaignDef;
    if (!cs || !cd) {
      handleRestart();
      return;
    }
    if (fragmentTimerRef.current) clearTimeout(fragmentTimerRef.current);
    animCancelRef.current();
    animRef.current.flashTiles = null;
    animRef.current.movingUnits = [];
    animRef.current.vfxTiles = null;
    animRef.current.levelUpUnitIds = new Set();
    setOverlayView("none");
    startMission(cs, cd);
  }, [campaignDef, startMission, handleRestart]);

  const handleQuitToMenu = useCallback(() => {
    saveCampaignCheckpoint(campaignStateRef.current);
    handleRestart();
  }, [handleRestart]);

  // ── Non-game screens ──────────────────────────────────────────────────────

  if (!gameState || viewState.view !== "game") {
    if (viewState.view === "narrative" && narrativeState) {
      const narFactionId = campaignState?.factionId ?? pendingFactionIdRef.current ?? null;
      return (
        <NarrativeScene
          narrativeData={gameData.narrativeData}
          state={narrativeState}
          choiceHistory={campaignState?.choiceHistory ?? {}}
          factionId={narFactionId}
          onAdvance={handleNarrativeAdvance}
          onChoice={handleChoice}
          onAbandon={handleRestart}
        />
      );
    }

    if (viewState.view === "campaign-end") {
      const endedFaction = gameData.factions.find((f) => f.id === campaignState?.factionId);
      const endedCodexCount = Object.keys(codex).length;
      return (
        <div className="rm-campend" style={{ "--fac": endedFaction?.color ?? "var(--accent)" } as CSSProperties}>
          <div className="rm-debrief" style={{ margin: "48px auto" }}>
            <div className="rm-debrief__sigil">
              <FactionSigil id={campaignState?.factionId ?? "covenant"} />
            </div>
            <div className="rm-mcard__kick">{"// CAMPAIGN COMPLETE"}</div>
            <h2 className="rm-debrief__title">
              {endedFaction ? `The ${endedFaction.name.replace(/^The\s+/, "")} campaign is over.` : "The campaign is over."}
            </h2>
            <p className="rm-debrief__sum">
              The ending you saw was shaped by every choice you made along the way. Other
              commanders, other choices, other endings.
            </p>
            {endedCodexCount > 0 && (
              <p className="rm-debrief__sum" style={{ color: "var(--gold)" }}>
                {endedCodexCount}/40 fragments recovered. They stay with you.
              </p>
            )}
            <div className="rm-debrief__actions">
              <button onClick={handleRestart} className="rm-mbtn rm-mbtn--solid">
                Return to the table
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (viewState.view === "commander_select") {
      const factionCommanders = gameData.commanders.filter((c) => c.factionId === viewState.factionId);
      const faction = gameData.factions.find((f) => f.id === viewState.factionId);
      const facColor = faction?.color ?? "var(--accent)";
      return (
        <div
          className="rm-cmsel"
          style={{
            "--fac": facColor,
            "--fac-soft": `color-mix(in oklch, ${facColor} 16%, transparent)`,
            "--fac-line": `color-mix(in oklch, ${facColor} 45%, transparent)`,
          } as CSSProperties}
        >
          <div className="rm-cmsel__head">
            <div className="rm-kick">
              {(faction?.name ?? viewState.factionId).toUpperCase()} · {(faction?.species ?? "").toUpperCase()}
            </div>
            <h2 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 34, letterSpacing: "-0.02em", margin: "8px 0 4px" }}>
              Choose your commander
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 14.5, maxWidth: 560, lineHeight: 1.5, margin: 0 }}>
              Each commander carries an army-wide passive and a unique trait. Your pick colours the entire campaign: roster temperament, mid-mission beats, and the ending.
            </p>
          </div>

          <div className="rm-cmsel__body">
            {factionCommanders.map((c) => {
              const stats: [string, number][] = [
                ["HP", c.stats.health],
                ["ATK", c.stats.attack],
                ["DEF", c.stats.defense],
                ["MOV", c.stats.movementRange],
                ["VIS", c.stats.visionRange],
              ];
              const trait = c.traits[0];
              const traitTag = trait?.effect?.condition === "once_per_mission" ? "once / mission" : trait?.effect?.condition === "once_per_turn" ? "once / turn" : null;
              return (
                <div
                  key={c.id}
                  className="rm-cmcard"
                  data-on={selectedCommanderId === c.id ? "1" : "0"}
                  onClick={() => setSelectedCommanderId(c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedCommanderId(c.id); }}
                >
                  <div className="rm-cmcard__top">
                    <CommanderPortrait commanderId={c.id} commanderName={c.name} />
                    <div>
                      <div className="rm-cmcard__name">{c.name}</div>
                      <div className="rm-cmcard__pass">{c.passiveLabel}</div>
                    </div>
                  </div>
                  <div className="rm-cmcard__passd">{c.passiveDescription}</div>
                  <div className="rm-cmcard__stats">
                    {stats.map(([l, v]) => (
                      <div className="rm-cmcard__stat" key={l}>
                        <b>{v}</b>
                        <span>{l}</span>
                      </div>
                    ))}
                  </div>
                  {trait && (
                    <div className="rm-cmcard__trait">
                      <div className="rm-cmcard__traitn">
                        {trait.name}
                        {traitTag && <span className="rm-trait__tag">{traitTag}</span>}
                      </div>
                      <div className="rm-cmcard__traitd">{trait.description}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rm-cmsel__foot">
            <button type="button" className="rm-cmsel__back" onClick={handleRestart}>
              ◂ Back to menu
            </button>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="rm-act rm-act--end"
              disabled={!selectedCommanderId}
              onClick={handleDeploy}
            >
              Deploy detachment
              <svg width="15" height="11" viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 5.5h13M10 1l4 4.5-4 4.5" />
              </svg>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="rm-menu">
        <div className="rm-menu__left">
          <div className="rm-field" />
          <div className="rm-menu__eyebrow">
            <span className="rm-menu__tag">FIELD COMMAND · TURN-BASED TACTICS</span>
          </div>
          <h1 className="rm-menu__title">
            Remnant<span className="dot">.</span><span className="car" />
          </h1>
          <p className="rm-menu__lead">
            Three powers, one buried technology that turns soldiers into something more.
          </p>
          <p className="rm-menu__sub">
            Take a contract, take a commander, and fight a three-mission campaign. Fog of war,
            a real opposing AI, and choices that bend the ending. Nothing holds your hand,
            and you choose your side at the table, not from a menu.
          </p>
          <div className="rm-menu__cta">
            <button type="button" className="rm-act rm-act--end" onClick={handleBegin}>
              Begin operation
              <svg width="15" height="11" viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 5.5h13M10 1l4 4.5-4 4.5" />
              </svg>
            </button>
            {hasResume && (
              <button type="button" className="rm-act" onClick={resumeFromSave} style={{ marginLeft: 10 }}>
                Resume operation
              </button>
            )}
          </div>
          {process.env.NODE_ENV === "development" && (
            <div className="rm-menu__dev">
              <h4>[DEV] Direct deploy</h4>
              {!pirateUnlocked && (
                <div className="rm-menu__devrow">
                  <span>Pirates</span>
                  <button type="button" onClick={() => { unlockPirates(); setPirateUnlocked(true); }}>
                    Unlock
                  </button>
                </div>
              )}
              {playableFactions.map((f) => (
                <div key={f.id} className="rm-menu__devrow">
                  <span title={f.name}>{f.name.replace(/^The\s+/, "")}</span>
                  {[0, 1, 2].map((mi) => (
                    <button
                      key={mi}
                      type="button"
                      onClick={() => handleDevSkipToMission(f.id, mi)}
                    >
                      M{mi + 1}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rm-menu__right">
          <div className="rm-prog__h">
            <span>Order of battle</span>
            <span>{playableFactions.length} campaigns available</span>
          </div>
          <div className="rm-prog__overall">Operator dossier</div>
          {playableFactions.map((f) => {
            const cc = f.color;
            const inProgress = savedProgress?.factionId === f.id;
            const progressIndex = inProgress ? savedProgress.missionIndex : -1;
            return (
              <div
                key={f.id}
                className="rm-camp"
                style={{
                  "--cc": cc,
                  "--ccl": `color-mix(in oklch, ${cc} 45%, transparent)`,
                } as CSSProperties}
              >
                <div className="rm-camp__top">
                  <div className="rm-camp__sig">
                    <FactionSigil id={f.id} />
                  </div>
                  <div>
                    <div className="rm-camp__name">{f.name}</div>
                    <div className="rm-camp__species">{f.species}</div>
                  </div>
                  <div className="rm-camp__state" data-on={inProgress ? "1" : "0"}>
                    {inProgress ? `In progress · M${progressIndex + 1}` : "Available"}
                  </div>
                </div>
                <div className="rm-camp__missions">
                  {[0, 1, 2].map((mi) => {
                    const markState = !inProgress ? "idle" : mi < progressIndex ? "done" : mi === progressIndex ? "current" : "idle";
                    const markLabel = markState === "done" ? "✓" : `M${mi + 1}`;
                    return (
                      <div key={mi} className="rm-camp__m" data-state={markState} style={{ cursor: "default" }}>
                        {markLabel}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!pirateUnlocked && (
            <div
              className="rm-camp rm-camp--locked"
              style={{ "--cc": "var(--dim)", "--ccl": "var(--line-strong)" } as CSSProperties}
            >
              <div className="rm-camp__top">
                <div className="rm-camp__sig">
                  <FactionSigil id="locked" />
                </div>
                <div>
                  <div className="rm-camp__name" style={{ color: "var(--dim)" }}>A fourth power</div>
                  <div className="rm-camp__species">Classification withheld</div>
                </div>
                <div className="rm-camp__state">Locked</div>
              </div>
              <div className="rm-camp__missions">
                {[0, 1, 2].map((mi) => (
                  <div key={mi} className="rm-camp__m" style={{ cursor: "default" }}>M{mi + 1}</div>
                ))}
              </div>
            </div>
          )}
          <div className="rm-prog__foot">
            Outcomes are revealed in the field, not on this screen.
          </div>
        </div>
      </div>
    );
  }

  // ── Game screen ───────────────────────────────────────────────────────────

  const isOver = gameState.phase === "win" || gameState.phase === "loss";
  const isPlayerTurn = gameState.phase === "player-turn";

  const commanderAlive = gameState.units.some((u) => u.faction === gameState.playerFaction && u.isCommander);
  const debriefIntent = gameState.phase === "win" ? "victory" as const : commanderAlive ? "defeat" as const : "game-over" as const;
  const unitsLost = missionStartRosterRef.current
    .filter((r) => !gameState.units.some((u) => u.id === r.id))
    .map((r) => r.name);
  const codexCount = Object.keys(codex).length;
  const codexTotal = gameData.puzzleFragments.fragments.length;
  const nextMissionIndex = (campaignState?.missionIndex ?? 0) + 1;
  const campaignDone = campaignDef ? isCampaignComplete(campaignDef, nextMissionIndex) : true;
  const continueLabel = campaignDef && campaignState
    ? campaignDone ? "Campaign complete" : `Continue · Mission ${nextMissionIndex + 1}`
    : null;

  const handleSettingsChange = (s: GameSettings) => {
    const advisoryMuteChanged = s.advisoriesMuted !== settings.advisoriesMuted;
    setSettingsState(s);
    persistSettings(s);
    setVolume(s.volume);
    if (advisoryMuteChanged) {
      setAdvisoriesMuted(s.advisoriesMuted);
      setAdvisoriesMutedState(s.advisoriesMuted);
      if (s.advisoriesMuted) setAdvisory(null);
    }
  };

  const handleRestoreAdvisories = () => {
    restoreAdvisories();
    seenAdvisoriesRef.current = {};
    setAdvisoriesMutedState(false);
    const next = { ...settings, advisoriesMuted: false };
    setSettingsState(next);
    persistSettings(next);
  };

  const handleMuteAllAdvisories = () => {
    setAdvisoriesMuted(true);
    setAdvisoriesMutedState(true);
    setAdvisory(null);
  };
  const selectedUnit = gameState.selectedUnitId !== null
    ? gameState.units.find((u) => u.id === gameState.selectedUnitId) ?? null
    : null;

  const activeAbilityTraits = selectedUnit ? getActiveAbilityTraits(selectedUnit) : [];
  const canBuild = selectedUnit?.isBuilder && !selectedUnit.hasActed && isPlayerTurn;
  const hasAdjacentStructures = selectedUnit
    ? gameState.structures.some((s) => chebyshevDistance(selectedUnit, { x: s.x, y: s.y }) <= 1)
    : false;
  const canDemolish = selectedUnit && !selectedUnit.hasActed && isPlayerTurn && hasAdjacentStructures;

  const pendingMilestone = gameState.pendingMilestones[0] ?? null;
  const milestoneUnit = pendingMilestone
    ? gameState.units.find((u) => u.id === pendingMilestone.unitId) ?? null
    : null;

  const adjacentExtractor = selectedUnit?.isBuilder && isPlayerTurn
    ? gameState.units.find(
        (u) => u.faction === gameState.playerFaction && u.isExtractor && chebyshevDistance(selectedUnit, u) <= 1 && u.extractorLevel < 3
      ) ?? null
    : null;

  const UPGRADE_COSTS: Record<number, number> = { 1: 200, 2: 400 };
  const extractorUpgradeCost = adjacentExtractor ? UPGRADE_COSTS[adjacentExtractor.extractorLevel] ?? null : null;

  const adjacentDamagedStructure = selectedUnit?.isBuilder && isPlayerTurn
    ? gameState.structures.find(
        (s) => s.factionId === gameState.playerFaction && chebyshevDistance(selectedUnit, { x: s.x, y: s.y }) <= 1 && s.hp < s.maxHp
      ) ?? null
    : null;

  const COST_PER_REPAIR_POINT = 2;
  const repairPoints = adjacentDamagedStructure
    ? Math.min(10, adjacentDamagedStructure.maxHp - adjacentDamagedStructure.hp)
    : 0;
  const repairCost = repairPoints * COST_PER_REPAIR_POINT;

  const availableStructures = selectedUnit
    ? gameState.structureDefs.filter((d) => d.faction === "shared" || d.faction === gameState.playerFaction)
    : [];

  const playerFaction = gameData.factions.find((f) => f.id === gameState.playerFaction);
  const facColor: string = playerFaction?.color ?? "var(--accent)";
  const activeMap = gameData.maps.find((m) => m.id === gameState.mapId);
  const mapNameParts = (activeMap?.name ?? gameState.mapId).split(" — ");
  const mapName = mapNameParts[0] ?? gameState.mapId;
  const mapRegion = mapNameParts[1] ?? "";
  const activeCommander = gameState.units.find((u) => u.faction === gameState.playerFaction && u.isCommander);
  const commanderName = activeCommander?.name ?? null;

  const firstActiveAbility = activeAbilityTraits.find((t) => !isTraitOnCooldown(selectedUnit!, t.id)) ?? null;

  const activateFirstAbility = () => {
    if (!selectedUnit || !firstActiveAbility) return;
    const isActive = interactionMode.mode === "ability" && interactionMode.traitId === firstActiveAbility.id;
    if (isActive) { setInteractionMode({ mode: "normal" }); return; }
    const needsTarget = abilityNeedsTarget(firstActiveAbility.id);
    if (!needsTarget) {
      const gs = gameStateRef.current;
      if (!gs) return;
      const newState = dispatch(gs, { type: "USE_ABILITY", unitId: selectedUnit.id, traitId: firstActiveAbility.id });
      setGameState(newState);
      setInteractionMode({ mode: "normal" });
      animRef.current.vfxTiles = [{ x: selectedUnit.x, y: selectedUnit.y }];
      setTimeout(() => { animRef.current.vfxTiles = null; }, 350);
    } else {
      setInteractionMode({ mode: "ability", unitId: selectedUnit.id, traitId: firstActiveAbility.id, needsTarget: true });
    }
  };

  const onCancelMode = () => {
    setInteractionMode({ mode: "normal" });
    setShowStructurePicker(false);
    setStaged(null);
  };

  const pendingMoveUnit = gameState.pendingMove
    ? gameState.units.find((u) => u.id === gameState.pendingMove?.unitId) ?? null
    : null;
  const undoAvailable = !!pendingMoveUnit && !pendingMoveUnit.hasActed && isPlayerTurn && !gameState.activePuzzle;

  const handleUndo = () => {
    const gs = gameStateRef.current;
    if (!gs || !gs.pendingMove) return;
    setStaged(null);
    playSfx("undo");
    setGameState(dispatch(gs, { type: "UNDO_MOVE" }));
  };

  keyHandlersRef.current = {
    endTurn: handleEndTurn,
    cancel: onCancelMode,
    ability: activateFirstAbility,
    undo: handleUndo,
    build: () => {
      if (!canBuild) return;
      if (interactionMode.mode === "build") {
        setInteractionMode({ mode: "normal" });
        setShowStructurePicker(false);
      } else {
        setShowStructurePicker((v) => !v);
      }
    },
  };

  const stagedTarget = stagedAttack
    ? gameState.units.find((u) => u.id === stagedAttack.targetId) ?? null
    : null;
  const stagedAttacker = stagedAttack
    ? gameState.units.find((u) => u.id === stagedAttack.attackerId) ?? null
    : null;
  const hoverTarget = !stagedAttack && hoverTargetId !== null
    ? gameState.units.find((u) => u.id === hoverTargetId) ?? null
    : null;
  const forecastAttacker = stagedAttacker ?? selectedUnit;
  const forecastDefender = stagedTarget ?? hoverTarget;
  const showForecast =
    isPlayerTurn &&
    !gameState.activePuzzle &&
    forecastAttacker !== null &&
    forecastDefender !== null &&
    !forecastAttacker.hasActed &&
    forecastAttacker.faction === gameState.playerFaction;

  return (
    <div
      className="rm-hud"
      style={{ "--fac": facColor } as CSSProperties}
    >
      <CommandStrip
        state={gameState}
        factionId={gameState.playerFaction}
        commanderName={commanderName}
        mapName={mapName}
        mapRegion={mapRegion}
      />

      <div className="rm-hud__body">
        <div className="rm-side">
          <div className="rm-panel__h">
            <span>Unit detail</span>
            <span className="c">{selectedUnit ? selectedUnit.role : "·"}</span>
          </div>
          <UnitPanel unit={selectedUnit} state={gameState} />
        </div>

        <div className="rm-boardwrap">
          <span className="rm-bracket tl" />
          <span className="rm-bracket tr" />
          <span className="rm-bracket bl" />
          <span className="rm-bracket br" />
          <div className="rm-canvaswrap" style={{ position: "relative", maxWidth: "100%", maxHeight: "100%" }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onPointerDown={handleMouseDown}
              onPointerMove={handleMouseMove}
              onPointerUp={handleMouseUp}
              onPointerLeave={() => setHoverTargetId(null)}
              className="cursor-pointer block"
              style={{ maxWidth: "100%", maxHeight: "100%", height: "auto", touchAction: "none" }}
            />
            {showForecast && forecastAttacker && forecastDefender && (
              <ForecastPanel
                state={gameState}
                attacker={forecastAttacker}
                defender={forecastDefender}
                camera={camera}
                staged={!!stagedAttack}
              />
            )}
          </div>

          {terrainLoading && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(5,8,11,0.85)", zIndex: 20 }}
            >
              <p className="text-xl font-medium text-white tracking-wide">Generating terrain...</p>
            </div>
          )}

          {advisory && overlayView === "none" && !isOver && !gameState.activePuzzle && (
            <CoachMark
              advisory={advisory}
              index={Math.min(ADVISORY_DEFS.length, Object.keys(seenAdvisoriesRef.current).length + 1)}
              total={ADVISORY_DEFS.length}
              onAcknowledge={acknowledgeAdvisory}
              onMuteAll={handleMuteAllAdvisories}
            />
          )}
        </div>

        <div className="rm-right">
          <div className="rm-panel">
            <div className="rm-panel__h">
              <span>Roster</span>
              <span className="c">
                {gameState.units.filter((u) => u.faction === gameState.playerFaction && u.hp > 0).length} active
              </span>
            </div>
            <Roster
              state={gameState}
              selectedId={gameState.selectedUnitId}
              onPick={(u) => {
                const gs = gameStateRef.current;
                if (!gs) return;
                setInteractionMode({ mode: "normal" });
                setShowStructurePicker(false);
                setGameState(dispatch(gs, { type: "SELECT_UNIT", unitId: u.id }));
                const cam = cameraRef.current;
                const inView =
                  u.x >= cam.x && u.x < cam.x + VIEWPORT &&
                  u.y >= cam.y && u.y < cam.y + VIEWPORT;
                if (!inView) {
                  setCamera(clampCamera(
                    u.x - Math.floor(VIEWPORT / 2),
                    u.y - Math.floor(VIEWPORT / 2)
                  ));
                }
              }}
            />
          </div>
          <div className="rm-logbox rm-panel">
            <div className="rm-panel__h">
              <span>Event log</span>
              <span className="c">live</span>
            </div>
            <EventLog events={gameState.events} />
          </div>
        </div>
      </div>

      {!isOver && (
        <>
          {canBuild && showStructurePicker && interactionMode.mode !== "build" && (
            <div className="rm-actionbar" style={{ borderTop: "1px solid var(--line)", padding: "10px 18px", gap: 6, flexWrap: "wrap" }}>
              <span className="rm-actionbar__hint" style={{ fontStyle: "normal", color: "var(--muted)" }}>Choose a structure:</span>
              {availableStructures.map((def) => {
                const canAfford = gameState.globalCurrency >= def.currencyCost;
                return (
                  <button
                    key={def.id}
                    type="button"
                    disabled={!canAfford}
                    onClick={() => {
                      if (!selectedUnit) return;
                      setInteractionMode({ mode: "build", unitId: selectedUnit.id, structureDefId: def.id });
                      setShowStructurePicker(false);
                    }}
                    className="rm-act"
                    title={`${def.description} (${def.durability} dur)`}
                  >
                    {def.name} ¤{def.currencyCost}
                  </button>
                );
              })}
              <button type="button" className="rm-act" onClick={() => setShowStructurePicker(false)}>
                Cancel
              </button>
            </div>
          )}

          {(adjacentExtractor || adjacentDamagedStructure || canDemolish) && (
            <div className="rm-actionbar" style={{ borderTop: "1px solid var(--line)", padding: "10px 18px", gap: 8, flexWrap: "wrap" }}>
              {canDemolish && (
                <button
                  type="button"
                  className="rm-act"
                  data-on={interactionMode.mode === "demolish" ? "1" : "0"}
                  onClick={() => {
                    if (!selectedUnit) return;
                    if (interactionMode.mode === "demolish") {
                      setInteractionMode({ mode: "normal" });
                    } else {
                      setInteractionMode({ mode: "demolish", unitId: selectedUnit.id });
                    }
                  }}
                >
                  Demolish
                </button>
              )}
              {adjacentExtractor && extractorUpgradeCost !== null && (
                <button
                  type="button"
                  className="rm-act"
                  disabled={gameState.globalCurrency < extractorUpgradeCost}
                  onClick={() => {
                    const gs = gameStateRef.current;
                    if (!gs || !adjacentExtractor || !selectedUnit) return;
                    setGameState(dispatch(gs, { type: "UPGRADE_EXTRACTOR", unitId: selectedUnit.id, extractorId: adjacentExtractor.id }));
                  }}
                  title={`Upgrade extractor to level ${adjacentExtractor.extractorLevel + 1}`}
                >
                  Upgrade Extractor ¤{extractorUpgradeCost}
                </button>
              )}
              {adjacentDamagedStructure && repairPoints > 0 && (
                <button
                  type="button"
                  className="rm-act"
                  disabled={gameState.globalCurrency < repairCost}
                  onClick={() => {
                    const gs = gameStateRef.current;
                    if (!gs || !adjacentDamagedStructure || !selectedUnit) return;
                    setGameState(dispatch(gs, { type: "REPAIR_STRUCTURE", unitId: selectedUnit.id, at: { x: adjacentDamagedStructure.x, y: adjacentDamagedStructure.y } }));
                  }}
                  title={`Repair ${adjacentDamagedStructure.name}: +${repairPoints} HP`}
                >
                  Repair +{repairPoints}HP ¤{repairCost}
                </button>
              )}
            </div>
          )}

          <ActionBar
            state={gameState}
            unit={selectedUnit}
            mode={interactionMode}
            onMove={() => { /* implicit: board click moves the selected unit */ }}
            onAttack={() => { /* implicit: board click attacks an in-range enemy */ }}
            onAbility={activateFirstAbility}
            onBuild={() => {
              if (interactionMode.mode === "build") {
                setInteractionMode({ mode: "normal" });
                setShowStructurePicker(false);
              } else {
                setShowStructurePicker((v) => !v);
              }
            }}
            onCancel={onCancelMode}
            onEndTurn={handleEndTurn}
            onUndo={handleUndo}
            undoAvailable={undoAvailable}
            abilityAvailable={!!firstActiveAbility}
            buildAvailable={!!canBuild}
          />

          {isPlayerTurn && pendingMilestone && milestoneUnit && (
            <LevelUpOverlay
              unit={milestoneUnit}
              onChoose={(stat) => {
                const gs = gameStateRef.current;
                if (!gs) return;
                setGameState(dispatch(gs, { type: "CHOOSE_STAT", unitId: pendingMilestone.unitId, stat }));
              }}
            />
          )}

          {process.env.NODE_ENV === "development" && (
            <details className="px-4 py-2" style={{ borderTop: "1px solid var(--line)", background: "#0a0f15" }}>
              <summary style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dim)", cursor: "pointer" }}>
                [DEV] Cheats
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    const gs = gameStateRef.current;
                    if (!gs) return;
                    setGameState({ ...gs, globalCurrency: gs.globalCurrency + 500 });
                  }}
                  className="rounded px-2 py-0.5 text-xs border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition-colors"
                >
                  +500¤
                </button>
                <button
                  onClick={() => {
                    const gs = gameStateRef.current;
                    if (!gs || !selectedUnit) return;
                    setGameState({ ...gs, pendingMilestones: [...gs.pendingMilestones, { unitId: selectedUnit.id, type: "stat_choice" }] });
                  }}
                  disabled={!selectedUnit}
                  className="rounded px-2 py-0.5 text-xs border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Trigger stat choice milestone for selected unit"
                >
                  Stat Milestone
                </button>
                <button
                  onClick={() => {
                    const gs = gameStateRef.current;
                    if (!gs || !selectedUnit) return;
                    const unit = gs.units.find((u) => u.id === selectedUnit.id);
                    if (!unit) return;
                    const slot = unit.traits.some((t) => gs.abilityDefs.find((a) => a.id === t.id && a.slot === 1)) ? 2 : 1;
                    const abilityDef = gs.abilityDefs.find((a) => a.unitId === unit.unitDataId && a.slot === slot);
                    if (!abilityDef || unit.traits.some((t) => t.id === abilityDef.id)) return;
                    const eff = abilityDef.effect as Record<string, unknown>;
                    const newTrait = {
                      id: abilityDef.id, name: abilityDef.name, description: abilityDef.description,
                      effect: {
                        type: (eff.type as string) ?? "unknown",
                        target: (eff.target as string) ?? "self",
                        magnitude: (eff.magnitude as number) ?? 0,
                        duration: (eff.duration as number) ?? 1,
                        condition: "on_activate" as const,
                      },
                    };
                    setGameState({ ...gs, units: gs.units.map((u) => u.id === unit.id ? { ...u, traits: [...u.traits, newTrait] } : u) });
                  }}
                  disabled={!selectedUnit}
                  className="rounded px-2 py-0.5 text-xs border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Inject next ability slot into selected unit"
                >
                  Unlock Ability
                </button>
                <button
                  onClick={() => {
                    const gs = gameStateRef.current;
                    if (!gs || !selectedUnit) return;
                    const unit = gs.units.find((u) => u.id === selectedUnit.id);
                    if (!unit) return;
                    const prevXp = unit.xp;
                    const newXp = prevXp + 10;
                    const statMilestone = newXp >= 2 && prevXp < 2
                      ? [{ unitId: unit.id, type: "stat_choice" as const }]
                      : [];
                    const newTraits = [...unit.traits];
                    for (const { threshold, slot } of [{ threshold: 6, slot: 1 }, { threshold: 7, slot: 2 }]) {
                      if (newXp >= threshold && prevXp < threshold) {
                        const abilityDef = gs.abilityDefs.find((a) => a.unitId === unit.unitDataId && a.slot === slot);
                        if (abilityDef && !newTraits.some((t) => t.id === abilityDef.id)) {
                          const eff = abilityDef.effect as Record<string, unknown>;
                          newTraits.push({
                            id: abilityDef.id, name: abilityDef.name, description: abilityDef.description,
                            effect: {
                              type: (eff.type as string) ?? "unknown",
                              target: (eff.target as string) ?? "self",
                              magnitude: (eff.magnitude as number) ?? 0,
                              duration: (eff.duration as number) ?? 1,
                              condition: "on_activate" as const,
                            },
                          });
                        }
                      }
                    }
                    setGameState({
                      ...gs,
                      units: gs.units.map((u) => u.id === unit.id ? { ...u, xp: newXp, traits: newTraits } : u),
                      pendingMilestones: [...gs.pendingMilestones, ...statMilestone],
                    });
                  }}
                  disabled={!selectedUnit}
                  className="rounded px-2 py-0.5 text-xs border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Add 10 XP to selected unit"
                >
                  +10 XP
                </button>
                <button
                  onClick={() => {
                    const gs = gameStateRef.current;
                    if (!gs) return;
                    const withDamage = {
                      ...gs,
                      units: gs.units.map((u) =>
                        u.faction === gs.enemyFaction && !u.unkillable ? { ...u, hp: Math.ceil(u.hp / 2) } : u
                      ),
                    };
                    setGameState(withDamage);
                  }}
                  className="rounded px-2 py-0.5 text-xs border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition-colors"
                  title="Halve HP of all killable enemy units"
                >
                  Half Enemy HP
                </button>
                <button
                  onClick={() => {
                    const gs = gameStateRef.current;
                    if (!gs) return;
                    const afterKill = {
                      ...gs,
                      units: gs.units.filter((u) => u.faction !== gs.enemyFaction),
                    };
                    const victory = afterKill.units.length !== gs.units.length ? "win" : null;
                    setGameState(victory ? { ...afterKill, phase: "win" } : afterKill);
                  }}
                  className="rounded px-2 py-0.5 text-xs border border-red-900 text-red-600 hover:border-red-700 hover:text-red-400 transition-colors"
                  title="Remove all enemy units (instant win)"
                >
                  Kill All Enemies
                </button>
                <button
                  onClick={() => {
                    const gs = gameStateRef.current;
                    if (!gs) return;
                    const friendly = gs.structures.find((s) => s.factionId === gs.playerFaction && s.hp < s.maxHp);
                    const target = friendly ?? gs.structures.find((s) => s.factionId === gs.playerFaction);
                    if (!target) return;
                    setGameState({
                      ...gs,
                      structures: gs.structures.map((s) =>
                        s.id === target.id ? { ...s, hp: Math.max(1, Math.floor(s.maxHp / 2)) } : s
                      ),
                    });
                  }}
                  className="rounded px-2 py-0.5 text-xs border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition-colors"
                  title="Damage a friendly structure (to test repair)"
                >
                  Damage Structure
                </button>
              </div>
            </details>
          )}
        </>
      )}

      {isOver && (
        <DebriefScreen
          state={gameState}
          intent={debriefIntent}
          missionLabel={gameData.maps.find((m) => m.id === gameState.mapId)?.missionOverrides[gameState.missionKey]?.objectiveLabel ?? ""}
          unitsLost={unitsLost}
          fragmentsRecovered={fragmentsThisMissionRef.current}
          fragmentsTotal={activeMap?.puzzleNodes.length ?? 0}
          codexCount={codexCount}
          continueLabel={continueLabel}
          onContinue={handleNextMission}
          onRetry={handleRetryMission}
          onMenu={handleQuitToMenu}
        />
      )}

      {overlayView === "pause" && !isOver && (
        <PauseOverlay
          state={gameState}
          codexCount={codexCount}
          codexTotal={codexTotal}
          onResume={() => setOverlayView("none")}
          onRestartMission={handleRetryMission}
          onOpenSettings={() => setOverlayView("settings")}
          onOpenCodex={() => setOverlayView("codex")}
          onOpenManual={() => setOverlayView("manual")}
          onQuit={handleQuitToMenu}
        />
      )}

      {overlayView === "settings" && (
        <SettingsOverlay
          settings={settings}
          onChange={handleSettingsChange}
          onRestoreAdvisories={handleRestoreAdvisories}
          onBack={() => setOverlayView("pause")}
        />
      )}

      {overlayView === "codex" && <CodexOverlay codex={codex} onClose={() => setOverlayView("pause")} />}

      {overlayView === "manual" && (
        <FieldManual
          advisoryDefs={ADVISORY_DEFS}
          seenAdvisories={seenAdvisoriesRef.current}
          advisoriesMuted={advisoriesMutedState}
          onRestoreAdvisories={handleRestoreAdvisories}
          onClose={() => setOverlayView("pause")}
        />
      )}
    </div>
  );
}
