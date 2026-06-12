import type { GameState, GameEvent, Unit } from "./types";
import { calculateFog } from "./fog";
import { chebyshevDistance } from "./combat";

export function pushEngineEvents(state: GameState, entries: Omit<GameEvent, "id">[]): GameState {
  if (entries.length === 0) return state;
  let nextId = state.events.reduce((m, e) => Math.max(m, e.id), 0);
  const events = [...state.events, ...entries.map((e) => ({ ...e, id: ++nextId }))];
  return { ...state, events: events.length > 220 ? events.slice(events.length - 220) : events };
}

export function removeCommanderArmyEffect(state: GameState, deadUnitId: number): GameState {
  const effect = state.armyEffects.find((e) => e.sourceCommander === deadUnitId);
  if (!effect) return state;
  return { ...state, armyEffects: state.armyEffects.filter((e) => e.sourceCommander !== deadUnitId) };
}

export function removeDeadUnits(state: GameState, deadIds: number[]): GameState {
  if (deadIds.length === 0) return state;
  let next = state;
  for (const id of deadIds) next = removeCommanderArmyEffect(next, id);
  const units = next.units.filter((u) => !deadIds.includes(u.id));
  const lastKnown = { ...next.lastKnownPositions };
  for (const id of deadIds) delete lastKnown[id];
  return { ...next, units, lastKnownPositions: lastKnown };
}

export function structureVisionSources(state: GameState, factionId: string): { x: number; y: number; radius: number }[] {
  const sources: { x: number; y: number; radius: number }[] = [];
  for (const s of state.structures) {
    if (s.factionId !== factionId) continue;
    const def = state.structureDefs.find((d) => d.id === s.structureDefId);
    const eff = def?.effect as { type?: string; radius?: number } | undefined;
    if (eff?.type === "vision") sources.push({ x: s.x, y: s.y, radius: eff.radius ?? 3 });
  }
  return sources;
}

export function recalcFog(state: GameState, units: Unit[]): boolean[][] {
  return calculateFog(state.grid, units, state.playerFaction, state.markedUnits, structureVisionSources(state, state.playerFaction));
}

export function triggerProximityTrap(state: GameState, unitId: number): GameState {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return state;
  const trap = state.structures.find((s) => {
    if (s.factionId === unit.faction) return false;
    if (s.x !== unit.x || s.y !== unit.y) return false;
    const def = state.structureDefs.find((d) => d.id === s.structureDefId);
    const eff = def?.effect as { type?: string } | undefined;
    return eff?.type === "proximity_trap";
  });
  if (!trap) return state;
  const def = state.structureDefs.find((d) => d.id === trap.structureDefId);
  const eff = def?.effect as { damage?: number } | undefined;
  const damage = eff?.damage ?? 20;

  let next: GameState = { ...state, structures: state.structures.filter((s) => s.id !== trap.id) };
  const events: Omit<GameEvent, "id">[] = [
    { turn: next.turn, kind: "atk", text: `*${unit.name}* triggers a booby trap — ${damage} damage.` },
  ];
  if (!unit.unkillable && unit.hp - damage <= 0) {
    events.push({ turn: next.turn, kind: "atk", text: `*${unit.name}* is down.` });
    next = removeDeadUnits(next, [unit.id]);
  } else {
    const newHp = unit.unkillable ? Math.max(1, unit.hp - damage) : unit.hp - damage;
    next = { ...next, units: next.units.map((u) => (u.id === unit.id ? { ...u, hp: newHp } : u)) };
  }
  return pushEngineEvents(next, events);
}

export function hostileBlockerTiles(state: GameState, faction: string): { x: number; y: number }[] {
  return state.structures
    .filter((s) => {
      if (s.factionId === faction) return false;
      const def = state.structureDefs.find((d) => d.id === s.structureDefId);
      const eff = def?.effect as { type?: string } | undefined;
      return eff?.type === "block_movement";
    })
    .map((s) => ({ x: s.x, y: s.y }));
}

export function fireTurrets(state: GameState): GameState {
  let next = state;
  const events: Omit<GameEvent, "id">[] = [];

  for (const s of next.structures) {
    const def = next.structureDefs.find((d) => d.id === s.structureDefId);
    const eff = def?.effect as { type?: string; damage?: number; range?: number; malfunctionChance?: number } | undefined;
    if (!eff || eff.type !== "auto_attack") continue;
    if (eff.malfunctionChance && Math.random() < eff.malfunctionChance) {
      events.push({ turn: next.turn, kind: "sys", text: `*${def?.name ?? "Turret"}* misfires.` });
      continue;
    }
    const range = eff.range ?? 3;
    const targets = next.units.filter(
      (u) => u.faction !== s.factionId && !u.unkillable && u.hp > 0 && chebyshevDistance({ x: s.x, y: s.y }, u) <= range
    );
    if (targets.length === 0) continue;
    const nearest = targets.reduce((a, b) =>
      chebyshevDistance({ x: s.x, y: s.y }, a) <= chebyshevDistance({ x: s.x, y: s.y }, b) ? a : b
    );
    const damage = eff.damage ?? 3;
    const newHp = nearest.hp - damage;
    events.push({ turn: next.turn, kind: "atk", text: `*${def?.name ?? "Turret"}* fires on *${nearest.name}* for ${damage}.` });
    if (newHp <= 0) {
      events.push({ turn: next.turn, kind: "atk", text: `*${nearest.name}* is down.` });
      next = removeDeadUnits(next, [nearest.id]);
    } else {
      next = { ...next, units: next.units.map((u) => (u.id === nearest.id ? { ...u, hp: newHp } : u)) };
    }
  }

  if (events.length === 0) return next;
  return pushEngineEvents(next, events);
}

export function applyDotAuras(state: GameState): GameState {
  let next = state;
  const events: Omit<GameEvent, "id">[] = [];

  for (const s of next.structures) {
    const def = next.structureDefs.find((d) => d.id === s.structureDefId);
    const eff = def?.effect as { type?: string; damage?: number; radius?: number; affectsEnemies?: boolean } | undefined;
    if (!eff || eff.type !== "dot_aura" || !eff.affectsEnemies) continue;
    const radius = eff.radius ?? 1;
    const damage = eff.damage ?? 2;
    const victims = next.units.filter(
      (u) => u.faction !== s.factionId && !u.unkillable && u.hp > 0 && chebyshevDistance({ x: s.x, y: s.y }, u) <= radius
    );
    const dead: number[] = [];
    let units = next.units;
    for (const v of victims) {
      const newHp = v.hp - damage;
      events.push({ turn: next.turn, kind: "atk", text: `*${v.name}* burns on sanctified ground for ${damage}.` });
      if (newHp <= 0) {
        dead.push(v.id);
        events.push({ turn: next.turn, kind: "atk", text: `*${v.name}* is down.` });
      } else {
        units = units.map((u) => (u.id === v.id ? { ...u, hp: newHp } : u));
      }
    }
    next = { ...next, units };
    if (dead.length > 0) next = removeDeadUnits(next, dead);
  }

  if (events.length === 0) return next;
  return pushEngineEvents(next, events);
}

export function applyStructureStrikes(state: GameState): GameState {
  let next = fireTurrets(state);
  next = applyDotAuras(next);
  if (next === state) return state;
  return { ...next, fog: recalcFog(next, next.units) };
}
