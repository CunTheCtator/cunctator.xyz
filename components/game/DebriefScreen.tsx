"use client";

import type { GameState } from "@/game/engine/types";
import FactionSigil from "./FactionSigil";

export type DebriefIntent = "victory" | "defeat" | "game-over";

type Props = {
  state: GameState;
  intent: DebriefIntent;
  missionLabel: string;
  unitsLost: string[];
  fragmentsRecovered: number;
  fragmentsTotal: number;
  codexCount: number;
  continueLabel: string | null;
  onContinue: () => void;
  onRetry: () => void;
  onMenu: () => void;
};

const KICKERS: Record<DebriefIntent, string> = {
  victory: "// OBJECTIVE SECURED",
  defeat: "// FORCES LOST",
  "game-over": "// COMMANDER DOWN",
};

export default function DebriefScreen({
  state,
  intent,
  missionLabel,
  unitsLost,
  fragmentsRecovered,
  fragmentsTotal,
  codexCount,
  continueLabel,
  onContinue,
  onRetry,
  onMenu,
}: Props) {
  const playerUnits = state.units.filter((u) => u.faction === state.playerFaction);
  const xpEarned = playerUnits.reduce((s, u) => s + u.xp, 0);
  const topEarner = playerUnits.reduce<{ name: string; xp: number } | null>(
    (best, u) => (u.xp > 0 && (!best || u.xp > best.xp) ? { name: u.name, xp: u.xp } : best),
    null
  );

  const title =
    intent === "victory" ? missionLabel || "Objective secured" :
    intent === "defeat" ? "Mission failed" :
    "The commander has fallen";

  const summary =
    intent === "victory"
      ? "The detachment holds the field. Earned experience carries forward on this world."
      : "Retry restarts the mission clean. Nothing earned this attempt is kept.";

  return (
    <div className="rm-overlay rm-overlay--debrief" data-intent={intent} role="dialog" aria-modal="true" aria-label="Mission debrief">
      <div className="rm-overlay__scan" />
      <div className="rm-debrief">
        <div className="rm-debrief__sigil">
          <FactionSigil id={state.playerFaction} />
        </div>
        <div className="rm-mcard__kick">{KICKERS[intent]}</div>
        <h2 className="rm-debrief__title">{title}</h2>
        <p className="rm-debrief__sum">{summary}</p>

        <div className="rm-debrief__stats">
          <div className="rm-debrief__stat">
            <b>{String(state.turn).padStart(2, "0")}</b>
            <span>TURNS</span>
          </div>
          <div className="rm-debrief__stat" data-danger={unitsLost.length > 0 ? "1" : "0"}>
            <b>{unitsLost.length}</b>
            <span>UNITS LOST</span>
            {unitsLost.length > 0 && <em>{unitsLost.join(" · ")}</em>}
          </div>
          <div className="rm-debrief__stat" data-gold="1">
            <b>{xpEarned.toFixed(1)}</b>
            <span>XP EARNED</span>
            {topEarner && <em>top: {topEarner.name}</em>}
          </div>
          <div className="rm-debrief__stat" data-gold={fragmentsRecovered > 0 ? "1" : "0"}>
            <b>{fragmentsRecovered}/{fragmentsTotal}</b>
            <span>FRAGMENTS</span>
            {fragmentsRecovered > 0 && <em>→ codex {codexCount}/40</em>}
          </div>
        </div>

        <div className="rm-debrief__actions">
          {intent === "victory" && continueLabel && (
            <button type="button" className="rm-mbtn rm-mbtn--solid" onClick={onContinue}>
              {continueLabel}
            </button>
          )}
          {intent !== "victory" && (
            <button type="button" className="rm-mbtn rm-mbtn--solid" onClick={onRetry}>
              Retry mission
            </button>
          )}
          {intent === "victory" && (
            <button type="button" className="rm-mbtn" onClick={onRetry}>
              Replay mission
            </button>
          )}
          <button type="button" className="rm-mbtn" onClick={onMenu}>
            Faction select
          </button>
        </div>
      </div>
    </div>
  );
}
