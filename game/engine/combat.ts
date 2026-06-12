import type { Unit, UnitStats, StatusEffect, ArmyEffect, EffectContext } from "./types";

export function chebyshevDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function traitTypeToStatKey(type: string): keyof Omit<UnitStats, "hp" | "maxHp"> | null {
  switch (type) {
    case "attack":      return "attack";
    case "defense":     return "defense";
    case "movement":    return "moveRange";
    case "attack_range": return "attackRange";
    case "vision":      return "visionRange";
    default:            return null;
  }
}

function applyAuraBonus(unit: Unit, ctx: EffectContext): {
  attack: number; defense: number; moveRange: number; attackRange: number; visionRange: number;
} {
  const bonus = { attack: 0, defense: 0, moveRange: 0, attackRange: 0, visionRange: 0 };
  const { allUnits, structures } = ctx;

  if (allUnits) {
    for (const source of allUnits) {
      if (source.id === unit.id || source.hp <= 0) continue;
      const dist = chebyshevDistance(source, unit);
      if (dist > 1) continue;

      for (const trait of source.traits) {
        const { type, target, magnitude, condition } = trait.effect;
        const key = traitTypeToStatKey(type);
        if (!key) continue;

        const isAllyAura =
          target === "adjacent_allies" &&
          source.faction === unit.faction &&
          (condition === null ||
            condition === "keeper_alive" ||
            condition === "witness_alive");

        const isEnemyAura =
          target === "adjacent_enemies" &&
          source.faction !== unit.faction &&
          (condition === null || condition === "suppressor_alive");

        if (isAllyAura || isEnemyAura) {
          bonus[key] = (bonus[key] ?? 0) + magnitude;
        }
      }
    }
  }

  // Architect's sanctified ground: structures within 1 tile of the unit give +1 defense
  if (structures) {
    for (const struct of structures) {
      if (struct.factionId !== unit.faction) continue;
      if (chebyshevDistance({ x: struct.x, y: struct.y }, unit) > 1) continue;
      if (struct.builtBy.includes("architect")) {
        bonus.defense += 1;
      }
    }
  }

  if (structures && ctx.structureDefs) {
    for (const struct of structures) {
      const def = ctx.structureDefs.find((d) => d.id === struct.structureDefId);
      if (!def) continue;
      const eff = def.effect as { type?: string; stat?: string; magnitude?: number; range?: number; coverBonus?: number };
      if (eff.type === "stat_aura" && struct.factionId === unit.faction) {
        const range = eff.range ?? 1;
        if (chebyshevDistance({ x: struct.x, y: struct.y }, unit) <= range) {
          const key = traitTypeToStatKey(eff.stat ?? "");
          if (key) bonus[key] += eff.magnitude ?? 0;
        }
      }
      if (
        eff.type === "block_movement" &&
        struct.factionId === unit.faction &&
        struct.x === unit.x &&
        struct.y === unit.y
      ) {
        bonus.defense += eff.coverBonus ?? 1;
      }
    }
  }

  return bonus;
}

export function getEffectiveStats(unit: Unit, ctx?: EffectContext): UnitStats {
  let attack = unit.attack;
  let defense = unit.defense;
  let moveRange = unit.moveRange;
  let attackRange = unit.attackRange;
  let visionRange = unit.visionRange;

  for (const effect of unit.statusEffects) {
    const m = effect.modifier;
    if (m.attack      !== undefined) attack      += m.attack;
    if (m.defense     !== undefined) defense     += m.defense;
    if (m.moveRange   !== undefined) moveRange   += m.moveRange;
    if (m.attackRange !== undefined) attackRange += m.attackRange;
    if (m.visionRange !== undefined) visionRange += m.visionRange;
  }

  for (const trait of unit.traits) {
    const { condition, target, type, magnitude } = trait.effect;
    if (target !== "self") continue;

    const key = traitTypeToStatKey(type);
    if (!key) continue;

    let applies = false;
    if (condition === null) {
      applies = true;
    } else if (condition === "no_movement_this_turn") {
      applies = !unit.hasMoved;
    }

    if (!applies) continue;

    switch (key) {
      case "attack":      attack      += magnitude; break;
      case "defense":     defense     += magnitude; break;
      case "moveRange":   moveRange   += magnitude; break;
      case "attackRange": attackRange += magnitude; break;
      case "visionRange": visionRange += magnitude; break;
    }
  }

  if (ctx?.armyEffects) {
    for (const ae of ctx.armyEffects) {
      const key = traitTypeToStatKey(ae.type);
      if (!key) continue;
      switch (key) {
        case "attack":      attack      += ae.magnitude; break;
        case "defense":     defense     += ae.magnitude; break;
        case "moveRange":   moveRange   += ae.magnitude; break;
        case "attackRange": attackRange += ae.magnitude; break;
        case "visionRange": visionRange += ae.magnitude; break;
      }
    }
  }

  if (ctx) {
    const aura = applyAuraBonus(unit, ctx);
    attack      += aura.attack;
    defense     += aura.defense;
    moveRange   += aura.moveRange;
    attackRange += aura.attackRange;
    visionRange += aura.visionRange;
  }

  return {
    hp:         unit.hp,
    maxHp:      unit.maxHp,
    attack:     Math.max(0, attack),
    defense:    Math.max(0, defense),
    moveRange:  Math.max(0, moveRange),
    attackRange: Math.max(1, attackRange),
    visionRange: Math.max(1, visionRange),
  };
}

export function isInAttackRange(attacker: Unit, defender: Unit, ctx?: EffectContext): boolean {
  return chebyshevDistance(attacker, defender) <= getEffectiveStats(attacker, ctx).attackRange;
}

export function resolveAttack(
  attacker: Unit,
  defender: Unit,
  ctx?: EffectContext
): { attackerHp: number; defenderHp: number } {
  const eff = getEffectiveStats(attacker, ctx);
  const def = getEffectiveStats(defender, ctx);
  let damage = Math.max(1, eff.attack - def.defense);

  for (const trait of attacker.traits) {
    const { condition, target, type, magnitude } = trait.effect;
    if (target !== "enemy_unit" || type !== "damage") continue;
    if (condition === "moved_3_or_more" && attacker.movedTiles >= 3) damage += magnitude;
    if (condition === "target_below_half_health" && defender.hp < defender.maxHp / 2) damage += magnitude;
  }

  return {
    attackerHp: attacker.hp,
    defenderHp: Math.max(0, defender.hp - damage),
  };
}

export type AttackTraitResults = {
  targetEffects: StatusEffect[];
  attackerMoves: number;
  enemyBudgetDebuff: { magnitude: number; duration: number } | null;
};

export function applyTraitsOnAttack(attacker: Unit, _defender: Unit): AttackTraitResults {
  const targetEffects: StatusEffect[] = [];
  let attackerMoves = 0;
  let enemyBudgetDebuff: { magnitude: number; duration: number } | null = null;

  for (const trait of attacker.traits) {
    const { condition, target, type, magnitude, duration } = trait.effect;
    if (condition !== "on_attack") continue;

    if (target === "enemy_unit") {
      const key = traitTypeToStatKey(type);
      if (key) {
        targetEffects.push({
          id: trait.id,
          duration,
          modifier: { [key]: magnitude } as Partial<UnitStats>,
        });
      } else if (type === "action-budget") {
        enemyBudgetDebuff = { magnitude, duration };
      }
    } else if (target === "self" && type === "movement") {
      attackerMoves = magnitude;
    }
  }

  return { targetEffects, attackerMoves, enemyBudgetDebuff };
}

export function tickStatusEffects(units: Unit[], faction: string): Unit[] {
  return units.map((u) => {
    if (u.faction !== faction) return u;
    const updated = u.statusEffects
      .map((e) => ({ ...e, duration: e.duration - 1 }))
      .filter((e) => e.duration > 0);
    return { ...u, statusEffects: updated };
  });
}

export function tickArmyEffects(armyEffects: ArmyEffect[]): ArmyEffect[] {
  return armyEffects
    .filter((e) => e.duration === -1 || e.duration > 1)
    .map((e) => (e.duration === -1 ? e : { ...e, duration: e.duration - 1 }));
}

export function tickMarkedUnits(marked: Record<number, number>): Record<number, number> {
  const result: Record<number, number> = {};
  for (const [idStr, turns] of Object.entries(marked)) {
    if (turns > 1) result[Number(idStr)] = turns - 1;
  }
  return result;
}
