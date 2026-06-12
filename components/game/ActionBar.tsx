"use client";

import type { Unit, GameState } from "@/game/engine/types";
import type { InteractionMode } from "@/game/canvas/input";

type Props = {
  state: GameState;
  unit: Unit | null;
  mode: InteractionMode;
  onMove: () => void;
  onAttack: () => void;
  onAbility: () => void;
  onBuild: () => void;
  onCancel: () => void;
  onEndTurn: () => void;
  onUndo: () => void;
  undoAvailable: boolean;
  abilityAvailable: boolean;
  buildAvailable: boolean;
};

export default function ActionBar({
  state,
  unit,
  mode,
  onMove,
  onAttack,
  onAbility,
  onBuild,
  onCancel,
  onEndTurn,
  onUndo,
  undoAvailable,
  abilityAvailable,
  buildAvailable,
}: Props) {
  const isPlayerTurn = state.phase === "player-turn";
  const isPlayerUnit = unit && unit.faction === state.playerFaction;
  const canAct = isPlayerTurn && isPlayerUnit && !unit.isExtractor;
  const canMove = canAct && !unit.hasMoved;
  const canAttack = canAct && !unit.hasActed;
  const inSpecialMode = mode.mode !== "normal";

  const hint =
    mode.mode === "build"
      ? "Click an adjacent tile to place a structure."
      : mode.mode === "demolish"
      ? "Click a highlighted structure to demolish it."
      : mode.mode === "ability"
      ? "Click a target on the map."
      : null;

  return (
    <div className="rm-actionbar">
      <button
        type="button"
        className="rm-act rm-act--undo"
        disabled={!undoAvailable}
        onClick={onUndo}
        title="Undo move (U)"
        style={{ opacity: undoAvailable ? 1 : 0.38 }}
      >
        <span className="rm-act__key">U</span>
        Undo move
      </button>
      {canAct ? (
        <>
          <button
            type="button"
            className="rm-act"
            disabled={!canMove}
            onClick={onMove}
            title="Move (1)"
          >
            <span className="rm-act__key">1</span>
            Move
          </button>
          <button
            type="button"
            className="rm-act"
            disabled={!canAttack}
            onClick={onAttack}
            title="Attack (2)"
          >
            <span className="rm-act__key">2</span>
            Attack
          </button>
          {abilityAvailable && (
            <button
              type="button"
              className="rm-act rm-act--ability"
              data-on={mode.mode === "ability" ? "1" : "0"}
              disabled={!canAttack}
              onClick={onAbility}
              title="Ability (3)"
            >
              <span className="rm-act__key">3</span>
              Ability
            </button>
          )}
          {buildAvailable && (
            <button
              type="button"
              className="rm-act rm-act--build"
              data-on={mode.mode === "build" ? "1" : "0"}
              disabled={!canAttack}
              onClick={onBuild}
              title="Build (4)"
            >
              <span className="rm-act__key">4</span>
              Build
            </button>
          )}
          {inSpecialMode && (
            <button type="button" className="rm-act" onClick={onCancel} title="Cancel (Esc)">
              Cancel
            </button>
          )}
          {hint && <span className="rm-actionbar__hint">{hint}</span>}
        </>
      ) : (
        <span className="rm-actionbar__hint" style={{ fontStyle: "normal", color: "var(--muted)" }}>
          {isPlayerTurn ? "Select one of your units to issue orders." : "Enemy is moving…"}
        </span>
      )}
      <span className="rm-actionbar__sp" />
      {isPlayerTurn && state.actionBudget > 0 && (
        <span className="rm-actionbar__unspent">
          · {state.actionBudget} ACT UNSPENT
        </span>
      )}
      <button
        type="button"
        className="rm-act rm-act--end"
        disabled={!isPlayerTurn}
        onClick={onEndTurn}
        title="End turn (Enter)"
      >
        End turn
        <svg width="15" height="11" viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 5.5h13M10 1l4 4.5-4 4.5" />
        </svg>
      </button>
    </div>
  );
}
