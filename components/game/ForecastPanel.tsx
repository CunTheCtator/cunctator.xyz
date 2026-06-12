"use client";

import type { GameState, Unit } from "@/game/engine/types";
import { getEffectiveStats, resolveAttack, chebyshevDistance } from "@/game/engine/combat";
import type { CSSProperties } from "react";

const VIEWPORT = 16;

type Props = {
  state: GameState;
  attacker: Unit;
  defender: Unit;
  camera: { x: number; y: number };
  staged: boolean;
};

function milestoneNote(xp: number, next: number | undefined, label: string | null): string | null {
  if (next === undefined || label === null) return null;
  return `next ${label} at ${next}`;
}

export default function ForecastPanel({ state, attacker, defender, camera, staged }: Props) {
  const ctx = { armyEffects: state.armyEffects, allUnits: state.units, structures: state.structures, structureDefs: state.structureDefs };
  const effA = getEffectiveStats(attacker, ctx);
  const effD = getEffectiveStats(defender, ctx);

  const { defenderHp } = resolveAttack(attacker, defender, ctx);
  const baseDamage = Math.max(1, effA.attack - effD.defense);
  const totalDamage = defender.hp - defenderHp;
  const bonus = totalDamage - baseDamage;

  const defenderDies = !defender.unkillable && defenderHp <= 0;
  const resultDefHp = defender.unkillable ? Math.max(1, defenderHp) : Math.max(0, defenderHp);

  let retaliation: number | null = null;
  let retalReason = "";
  let attackerHpAfter = attacker.hp;
  let attackerDies = false;
  if (defenderDies) {
    retalReason = "NO RETALIATION · TARGET DOWN";
  } else {
    const dist = chebyshevDistance(attacker, defender);
    if (dist > effD.attackRange) {
      retalReason = `NO RETALIATION · RNG ${effD.attackRange} < DIST ${dist}`;
    } else {
      const retal = resolveAttack(defender, attacker, ctx);
      retaliation = attacker.hp - retal.defenderHp;
      attackerHpAfter = attacker.unkillable ? Math.max(1, retal.defenderHp) : Math.max(0, retal.defenderHp);
      attackerDies = !attacker.unkillable && retal.defenderHp <= 0;
    }
  }

  const xpGain = defenderDies ? 1 : Math.min(1, totalDamage / defender.maxHp);
  const ms = state.xpMilestones;
  const thresholds: [number, string][] = [
    [ms.statIncrease, "+STAT"],
    [ms.secondTrait, "TRAIT"],
    [ms.ability1Unlock, "ABL 1"],
    [ms.ability2Unlock, "ABL 2"],
  ];
  const newXp = attacker.xp + xpGain;
  const nextEntry = thresholds.find(([t]) => attacker.xp < t);
  const crossed = thresholds.find(([t]) => attacker.xp < t && newXp >= t);

  const tx = defender.x - camera.x;
  const ty = defender.y - camera.y;
  const placeRight = attacker.x <= defender.x ? tx < VIEWPORT - 6 : tx <= 5;
  const clampedTy = Math.max(1.4, Math.min(VIEWPORT - 3.2, ty));
  const cell = 100 / VIEWPORT;

  const style: CSSProperties = {
    position: "absolute",
    top: `${clampedTy * cell}%`,
    transform: "translateY(-30%)",
    ...(placeRight
      ? { left: `${(tx + 1) * cell}%`, marginLeft: 14 }
      : { right: `${(VIEWPORT - tx) * cell}%`, marginRight: 14 }),
    zIndex: 24,
  };

  return (
    <div className="rm-fc" data-staged={staged ? "1" : "0"} style={style}>
      <div className="rm-fc__head">
        <span>COMBAT FORECAST</span>
        <span className="rm-fc__hint">{staged ? "CLICK AGAIN TO COMMIT · ESC ABORTS" : "CLICK TO STAGE"}</span>
      </div>

      <div className="rm-fc__row">
        <div className="rm-fc__side">
          <div className="rm-fc__name">{attacker.name}</div>
          <div className="rm-fc__stat">ATK {effA.attack}</div>
          <div className="rm-fc__hp" data-dead={attackerDies ? "1" : "0"}>
            {attacker.unkillable ? "∞" : `${attacker.hp} → ${attackerHpAfter}/${attacker.maxHp}`}
            {attackerDies && <span className="rm-fc__down">DOWN</span>}
          </div>
        </div>
        <div className="rm-fc__mid">
          {bonus > 0 && <div className="rm-fc__bonus">+{bonus} TRAIT</div>}
          <div className="rm-fc__dmg">−{totalDamage}</div>
          <div className="rm-fc__arrow">▸</div>
        </div>
        <div className="rm-fc__side rm-fc__side--target">
          <div className="rm-fc__name">{defender.name}</div>
          <div className="rm-fc__stat">DEF {effD.defense}</div>
          <div className="rm-fc__hp" data-dead={defenderDies ? "1" : "0"}>
            {defender.unkillable
              ? `→ ${resultDefHp} · UNKILLABLE`
              : `${defender.hp} → ${resultDefHp}/${defender.maxHp}`}
            {defenderDies && <span className="rm-fc__down">DOWN</span>}
          </div>
        </div>
      </div>

      <div className="rm-fc__line" data-warn={retaliation !== null ? "1" : "0"}>
        {retaliation !== null ? `RETALIATION −${retaliation}` : retalReason}
      </div>

      {!attacker.isExtractor && (
        <div className="rm-fc__line rm-fc__line--xp">
          {defenderDies ? "+1.00 KILL BONUS" : `+${xpGain.toFixed(2)} DAMAGE SHARE · ${totalDamage}/${defender.maxHp}`}
          {" · "}
          {attacker.xp.toFixed(2)} → {newXp.toFixed(2)}
          {crossed
            ? ` · ${crossed[1]} UNLOCKED`
            : nextEntry
            ? ` · ${milestoneNote(attacker.xp, nextEntry[0], nextEntry[1])}`
            : ""}
        </div>
      )}
    </div>
  );
}
