import type { GameState } from "./types";

export type AdvisoryAnchor =
  | "board"
  | "unit"
  | "node"
  | "commander"
  | "hud-act"
  | "hud-end"
  | "hud-currency"
  | "hud-objective"
  | "hud-inspector";

export type AdvisoryDef = {
  id: string;
  scope: "first-mission" | "second-mission" | "any";
  anchor: AdvisoryAnchor;
  title: string;
  copy: string;
  action: string;
};

export type ActiveAdvisory = {
  def: AdvisoryDef;
  tile: { x: number; y: number } | null;
};

function scopeMatches(def: AdvisoryDef, missionIndex: number): boolean {
  if (def.scope === "any") return true;
  if (def.scope === "first-mission") return missionIndex === 0;
  return missionIndex === 1;
}

function anchorTile(def: AdvisoryDef, state: GameState): { x: number; y: number } | null {
  switch (def.id) {
    case "m1_select": {
      const u = state.units.find((x) => x.faction === state.playerFaction && !x.isExtractor);
      return u ? { x: u.x, y: u.y } : null;
    }
    case "m1_move": {
      const u = state.units.find((x) => x.id === state.selectedUnitId);
      return u ? { x: u.x, y: u.y } : null;
    }
    case "m1_node": {
      const n = state.puzzleNodes.find((p) => !p.activated && state.fog[p.y]?.[p.x]);
      return n ? { x: n.x, y: n.y } : null;
    }
    case "m1_commander": {
      const u = state.units.find((x) => x.faction === state.playerFaction && x.isCommander);
      return u ? { x: u.x, y: u.y } : null;
    }
    case "c_reposition": {
      const u = state.units.find((x) => x.faction === state.playerFaction && x.repositionMoves > 0);
      return u ? { x: u.x, y: u.y } : null;
    }
    case "c_turret": {
      const t = state.structures.find((s) => {
        if (s.factionId === state.playerFaction) return false;
        const def2 = state.structureDefs.find((d) => d.id === s.structureDefId);
        const eff = def2?.effect as { type?: string } | undefined;
        return eff?.type === "auto_attack" && state.fog[s.y]?.[s.x];
      });
      return t ? { x: t.x, y: t.y } : null;
    }
    case "m1_status": {
      const u = state.units.find((x) => x.statusEffects.length > 0 && state.fog[x.y]?.[x.x]);
      return u ? { x: u.x, y: u.y } : null;
    }
    case "m2_repair": {
      const s = state.structures.find((x) => x.factionId === state.playerFaction && x.hp < x.maxHp);
      return s ? { x: s.x, y: s.y } : null;
    }
    default:
      return null;
  }
}

function triggerFires(def: AdvisoryDef, state: GameState): boolean {
  const playerUnits = state.units.filter((u) => u.faction === state.playerFaction);
  switch (def.id) {
    case "m1_select":
      return state.turn === 1 && state.selectedUnitId === null && !playerUnits.some((u) => u.hasMoved);
    case "m1_move":
      return state.selectedUnitId !== null && (state.reachableTiles?.length ?? 0) > 0;
    case "m1_budget":
      return playerUnits.some((u) => u.hasMoved);
    case "m1_endturn":
      return state.actionBudget <= 1 && playerUnits.some((u) => u.hasMoved);
    case "m1_fog":
      return state.turn >= 2;
    case "m1_income":
      return state.globalCurrency > 0;
    case "m1_forecast": {
      return playerUnits.some((u) => {
        if (u.hasActed || u.isExtractor) return false;
        return state.units.some(
          (e) =>
            e.faction === state.enemyFaction &&
            state.fog[e.y]?.[e.x] &&
            Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= u.attackRange
        );
      });
    }
    case "m1_status":
      return state.units.some((u) => u.statusEffects.length > 0 && state.fog[u.y]?.[u.x]);
    case "m1_xp":
      return playerUnits.some((u) => u.kills > 0);
    case "m1_node":
      return state.puzzleNodes.some((n) => !n.activated && state.fog[n.y]?.[n.x]);
    case "m1_objective": {
      if (state.turn < 8) return false;
      const objective = state.objectiveTiles[0];
      if (!objective) return false;
      return !playerUnits.some((u) => Math.max(Math.abs(u.x - objective.x), Math.abs(u.y - objective.y)) <= 12);
    }
    case "m1_commander": {
      const cmd = playerUnits.find((u) => u.isCommander);
      return !!cmd && cmd.hp < cmd.maxHp;
    }
    case "c_reposition":
      return playerUnits.some((u) => u.repositionMoves > 0);
    case "c_turret":
      return state.structures.some((s) => {
        if (s.factionId === state.playerFaction) return false;
        const d = state.structureDefs.find((x) => x.id === s.structureDefId);
        const eff = d?.effect as { type?: string } | undefined;
        return eff?.type === "auto_attack" && state.fog[s.y]?.[s.x];
      });
    case "m2_build":
      return playerUnits.some((u) => u.isBuilder);
    case "m2_structure_budget":
      return state.structures.some((s) => s.factionId === state.playerFaction);
    case "m2_repair":
      return state.structures.some((s) => s.factionId === state.playerFaction && s.hp < s.maxHp);
    case "m2_upgrade":
      return state.globalCurrency >= 200;
    case "m2_armychips":
      return state.armyEffects.some((e) => e.duration !== -1) || state.enemyArmyEffects.length > 0;
    default:
      return false;
  }
}

export function nextAdvisory(
  defs: AdvisoryDef[],
  state: GameState,
  missionIndex: number,
  seen: Record<string, number>,
  muted: boolean
): ActiveAdvisory | null {
  if (muted) return null;
  if (state.phase !== "player-turn") return null;
  if (state.activePuzzle) return null;

  for (const def of defs) {
    if (seen[def.id] !== undefined) continue;
    if (!scopeMatches(def, missionIndex)) continue;
    if (!triggerFires(def, state)) continue;
    return { def, tile: anchorTile(def, state) };
  }
  return null;
}
