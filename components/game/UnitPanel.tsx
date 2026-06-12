"use client";

import type { Unit, GameState } from "@/game/engine/types";
import { getEffectiveStats } from "@/game/engine/combat";
import { gameData } from "@/game/data/loader";
import StatusChips from "./StatusChips";

type Props = { unit: Unit | null; state: GameState };

const ms = gameData.economy.xp.milestones;
const XP_MILESTONES = [ms.statIncrease, ms.secondTrait, ms.ability1Unlock, ms.ability2Unlock];
const XP_MILESTONE_LABELS: Record<number, string> = {
  [ms.statIncrease]: "+STAT",
  [ms.secondTrait]: "TRAIT",
  [ms.ability1Unlock]: "ABL 1",
  [ms.ability2Unlock]: "ABL 2",
};

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function xpProgress(xp: number): { current: number; next: number; label: string | null } {
  const next = XP_MILESTONES.find((t) => xp < t);
  if (next === undefined) return { current: 1, next: 1, label: null };
  const idx = XP_MILESTONES.indexOf(next);
  const prev = idx > 0 ? XP_MILESTONES[idx - 1] : 0;
  return { current: xp - prev, next: next - prev, label: XP_MILESTONE_LABELS[next] ?? null };
}

export default function UnitPanel({ unit, state }: Props) {
  if (!unit) {
    return (
      <div className="rm-empty">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
        No unit selected.<br />Click a unit on the board<br />or in the roster.
      </div>
    );
  }

  const ctx = { armyEffects: state.armyEffects, allUnits: state.units, structures: state.structures, structureDefs: state.structureDefs };
  const eff = getEffectiveStats(unit, ctx);
  const low = !unit.unkillable && unit.hp / unit.maxHp <= 0.35;
  const side = unit.faction === state.playerFaction ? "player" : "enemy";

  const ROLE_MARKS: Record<string, string> = {
    heavy: "■", mobile: "▲", ranged: "⊙", disrupt: "✕", support: "○", builder: "□", wildcard: "⊗",
  };
  const glyph = unit.isCommander ? "★" : unit.isExtractor ? "◆" : ROLE_MARKS[unit.role] ?? "●";

  const stats: [string, number | string][] = [
    ["ATK", eff.attack],
    ["DEF", eff.defense],
    ["MOV", eff.moveRange],
    ["RNG", eff.attackRange || "·"],
    ["VIS", eff.visionRange],
    ["LVL", Math.floor(unit.xp / 2) + 1],
  ];

  const xp = xpProgress(unit.xp);
  const xpPct = xp.next > 0 ? (xp.current / xp.next) * 100 : 100;

  const abilityDefs = gameData.abilities;
  const passive = unit.isCommander
    ? gameData.commanders.find((c) => c.id === unit.unitDataId)
    : null;

  return (
    <div className="rm-uc" data-side={side}>
      <div className="rm-uc__top">
        <div className="rm-uc__port">{glyph}</div>
        <div>
          <div className="rm-uc__name">{unit.name}</div>
          <div className="rm-uc__role">
            {roleLabel(unit.role)}
            {unit.isCommander ? " · Commander" : ""}
          </div>
        </div>
      </div>

      {!unit.isExtractor ? (
        <div className="rm-uc__hpbar">
          <div className="rm-hpline">
            <span>HEALTH</span>
            <b>{Math.max(0, Math.round(unit.hp))}/{unit.maxHp}</b>
          </div>
          <div className="rm-bar">
            <i data-low={low ? "1" : "0"} style={{ width: Math.max(0, (unit.hp / unit.maxHp) * 100) + "%" }} />
          </div>
          <div className="rm-hpline" style={{ marginTop: 8 }}>
            <span>XP · NEXT{xp.label ? `: ${xp.label}` : " MILESTONE"}</span>
            <b>{xp.current.toFixed(1)}/{xp.next}</b>
          </div>
          <div className="rm-bar rm-bar--xp">
            <i style={{ width: Math.min(100, xpPct) + "%" }} />
          </div>
        </div>
      ) : (
        <div className="rm-uc__hpbar">
          <div className="rm-hpline">
            <span>STATUS</span>
            <b style={{ color: "var(--gold)" }}>Unkillable · draws ¤</b>
          </div>
        </div>
      )}

      <div className="rm-stats">
        {stats.map(([l, v]) => (
          <div className="rm-stat" key={l}>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>

      {passive && (
        <>
          <div className="rm-sub">Army passive</div>
          <div className="rm-trait" style={{ borderTop: "none", paddingTop: 0 }}>
            <div className="rm-trait__n">
              {passive.passiveLabel}
              <span className="rm-trait__tag">passive</span>
            </div>
            <div className="rm-trait__d">{passive.passiveDescription}</div>
          </div>
        </>
      )}

      {unit.traits.length > 0 && (
        <>
          <div className="rm-sub">Traits</div>
          {unit.traits.map((t) => {
            const isOnce = t.effect.condition === "once_per_mission" || t.effect.condition === "once_per_turn";
            const onceLabel = t.effect.condition === "once_per_mission" ? "mission" : t.effect.condition === "once_per_turn" ? "turn" : null;
            const abilityCost = abilityDefs.find((a) => a.id === t.id)?.currencyCost ?? 0;
            return (
              <div className="rm-trait" key={t.id}>
                <div className="rm-trait__n">
                  {t.name}
                  {isOnce && onceLabel && <span className="rm-trait__tag">once / {onceLabel}</span>}
                  {abilityCost > 0 && <span className="rm-trait__tag">¤{abilityCost}</span>}
                </div>
                <div className="rm-trait__d">{t.description}</div>
              </div>
            );
          })}
        </>
      )}

      {unit.statusEffects.length > 0 && (
        <>
          <div className="rm-sub">Active effects</div>
          <StatusChips statuses={unit.statusEffects} />
        </>
      )}
    </div>
  );
}
