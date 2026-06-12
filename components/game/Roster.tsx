"use client";

import type { Unit, GameState } from "@/game/engine/types";

type Props = {
  state: GameState;
  selectedId: number | null;
  onPick: (unit: Unit) => void;
};

function glyphFor(u: Unit): string {
  if (u.isCommander) return "★";
  if (u.isExtractor) return "€";
  return (u.type[0] ?? "?").toUpperCase();
}

export default function Roster({ state, selectedId, onPick }: Props) {
  const players = state.units.filter((u) => u.faction === state.playerFaction && u.hp > 0);
  const isPlayerTurn = state.phase === "player-turn";

  return (
    <div className="rm-roster">
      {players.map((u) => {
        const spent = u.hasMoved && u.hasActed;
        const ready = isPlayerTurn && !spent && !u.isExtractor;
        const low = !u.unkillable && u.hp / u.maxHp <= 0.35;
        const hpLabel = u.unkillable ? "·" : `${Math.max(0, Math.round(u.hp))}/${u.maxHp}`;
        return (
          <button
            key={u.id}
            type="button"
            className="rm-runit"
            data-sel={u.id === selectedId ? "1" : "0"}
            data-spent={spent ? "1" : "0"}
            data-cmdr={u.isCommander ? "1" : "0"}
            onClick={() => onPick(u)}
          >
            <span className="rm-runit__tok">{glyphFor(u)}</span>
            <span className="rm-runit__main">
              <span className="rm-runit__name">
                {u.name}
                <span>{hpLabel}</span>
              </span>
              {!u.isExtractor && (
                <span className="rm-runit__bar">
                  <i data-low={low ? "1" : "0"} style={{ width: Math.max(0, (u.hp / u.maxHp) * 100) + "%" }} />
                </span>
              )}
            </span>
            <span className="rm-runit__flag" data-ready={ready ? "1" : "0"}>
              {u.isExtractor ? "¤" : ready ? "READY" : "SPENT"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
