"use client";

import type { StatusEffect } from "@/game/engine/types";
import { gameData } from "@/game/data/loader";

type Props = { statuses: StatusEffect[] };

function isBuff(def: { magnitude: number }): boolean {
  return def.magnitude >= 0;
}

export default function StatusChips({ statuses }: Props) {
  if (!statuses || statuses.length === 0) return null;
  return (
    <div className="rm-statuschips">
      {statuses.map((s, i) => {
        const def = gameData.statusEffects.find((e) => e.id === s.id);
        const name = def?.name ?? s.id;
        const buff = def ? isBuff({ magnitude: def.magnitude }) : false;
        const tooltip = `${name}${def ? " · " + (def.description ?? "") : ""}${s.duration > 0 ? ` · ${s.duration}t` : ""}`;
        const hasIcon = !!def;
        return (
          <span
            key={`${s.id}-${i}`}
            className="rm-chip"
            data-buff={buff ? "1" : "0"}
            title={tooltip}
          >
            {hasIcon ? (
              <svg width="12" height="12" aria-hidden="true">
                <use href={`/game-icons.svg#ic-status-${def.id}`} />
              </svg>
            ) : (
              <i />
            )}
            {name}
            {s.duration > 0 ? ` ${s.duration}t` : ""}
          </span>
        );
      })}
    </div>
  );
}
