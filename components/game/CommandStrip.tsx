"use client";

import type { GameState } from "@/game/engine/types";
import { gameData } from "@/game/data/loader";
import FactionSigil from "./FactionSigil";

type Props = {
  state: GameState;
  factionId: string;
  commanderName?: string | null;
  mapName: string;
  mapRegion: string;
};

const EFFECT_LABELS: Record<string, string> = {
  inspired: "INSPIRED",
  rallied: "RALLIED",
  fortified: "FORTIFIED",
  blinded: "BLINDED",
  famine: "FAMINE",
  marked: "MARKED",
};

export default function CommandStrip({ state, factionId, commanderName, mapName, mapRegion }: Props) {
  const faction = gameData.factions.find((f) => f.id === factionId);
  const facName = faction?.name ?? factionId;
  const phaseLabel = state.phase === "player-turn" ? "Your turn" : state.phase === "enemy-turn" ? "Enemy turn" : state.phase.toUpperCase();
  const phaseTag = state.phase === "player-turn" ? "player" : state.phase === "enemy-turn" ? "enemy" : "player";

  const map = gameData.maps.find((m) => m.id === state.mapId);
  const objective = state.missionKey ? map?.missionOverrides[state.missionKey]?.objectiveLabel ?? null : null;

  const armyChips = state.armyEffects
    .filter((e) => e.duration !== -1 || !e.id.startsWith("passive_"))
    .map((e) => ({
      key: e.id,
      effectId: e.effectId,
      label: EFFECT_LABELS[e.effectId] ?? e.effectId.toUpperCase(),
      turns: e.duration,
      hostile: false,
    }))
    .concat(
      state.enemyArmyEffects.map((e) => ({
        key: `enemy_${e.id}`,
        effectId: e.effectId,
        label: EFFECT_LABELS[e.effectId] ?? e.effectId.toUpperCase(),
        turns: e.duration,
        hostile: true,
      }))
    );

  return (
    <div className="rm-cmd">
      <div className="rm-cmd__sigil">
        <FactionSigil id={factionId} />
      </div>
      <div>
        <div className="rm-cmd__op">
          <b>{facName.toUpperCase()}</b> DETACHMENT
        </div>
        <div className="rm-cmd__sub">
          OP. {mapName.toUpperCase()} · {mapRegion.toUpperCase()}
          {commanderName ? ` · ${commanderName}` : ""}
        </div>
      </div>
      {objective && (
        <div className="rm-cmd__obj" title={objective}>
          <span className="rm-cmd__objk">OBJ</span>
          <span className="rm-cmd__objt">{objective}</span>
        </div>
      )}
      {armyChips.length > 0 && (
        <div className="rm-cmd__chips">
          {armyChips.map((c) => (
            <span className="rm-cmd__chip" data-hostile={c.hostile ? "1" : "0"} key={c.key}>
              {EFFECT_LABELS[c.effectId] !== undefined && (
                <svg width="11" height="11" aria-hidden="true">
                  <use href={`/game-icons.svg#ic-status-${c.effectId}`} />
                </svg>
              )}
              {c.label}
              {c.turns > 0 && <b>{c.turns}T</b>}
            </span>
          ))}
        </div>
      )}
      <div className="rm-cmd__tele">
        <span className="rm-tele">
          TURN <b>{String(state.turn).padStart(2, "0")}</b>
        </span>
        <span className="rm-tele rm-tele--ap">
          ACTIONS <b>{state.actionBudget}</b>
        </span>
        <span className="rm-tele">
          ¤ <b>{state.globalCurrency}</b>
        </span>
        <span className="rm-turnflag" data-phase={phaseTag}>
          {phaseLabel}
        </span>
        <span className="rm-uplink">UPLINK LIVE</span>
      </div>
    </div>
  );
}
