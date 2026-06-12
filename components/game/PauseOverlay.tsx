"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/game/engine/types";

type ConfirmKind = "restart" | "quit" | null;

type Props = {
  state: GameState;
  codexCount: number;
  codexTotal: number;
  onResume: () => void;
  onRestartMission: () => void;
  onOpenSettings: () => void;
  onOpenCodex: () => void;
  onOpenManual: () => void;
  onQuit: () => void;
};

export default function PauseOverlay({
  state,
  codexCount,
  codexTotal,
  onResume,
  onRestartMission,
  onOpenSettings,
  onOpenCodex,
  onOpenManual,
  onQuit,
}: Props) {
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = cardRef.current?.querySelector<HTMLElement>("button");
    first?.focus();
  }, [confirm]);

  const phase = state.phase === "player-turn" ? "YOUR PHASE" : "ENEMY PHASE";

  return (
    <div className="rm-overlay" role="dialog" aria-modal="true" aria-label="Paused">
      <div className="rm-overlay__scan" />
      <div className="rm-mcard" ref={cardRef}>
        {confirm === null ? (
          <>
            <div className="rm-mcard__kick">
              {"// PAUSED · TURN "}{String(state.turn).padStart(2, "0")} · {phase}
            </div>
            <button type="button" className="rm-mbtn rm-mbtn--solid" onClick={onResume}>
              Resume <span className="rm-mbtn__chip">ESC</span>
            </button>
            <button type="button" className="rm-mbtn" onClick={() => setConfirm("restart")}>
              Restart mission
            </button>
            <button type="button" className="rm-mbtn rm-mbtn--gold" onClick={onOpenCodex}>
              Codex <b>{codexCount}/{codexTotal}</b>
            </button>
            <button type="button" className="rm-mbtn" onClick={onOpenManual}>
              Field manual <span className="rm-mbtn__chip">?</span>
            </button>
            <button type="button" className="rm-mbtn" onClick={onOpenSettings}>
              Settings
            </button>
            <button type="button" className="rm-mbtn rm-mbtn--danger" onClick={() => setConfirm("quit")}>
              Quit to faction select
            </button>
            <div className="rm-mcard__foot">The board stays visible. Nothing moves while suspended.</div>
          </>
        ) : (
          <>
            <div className="rm-mcard__kick">
              {confirm === "restart" ? "// RESTART MISSION" : "// QUIT TO FACTION SELECT"}
            </div>
            <p className="rm-mcard__warn">Progress this mission is lost.</p>
            <button
              type="button"
              className="rm-mbtn rm-mbtn--danger"
              onClick={confirm === "restart" ? onRestartMission : onQuit}
            >
              {confirm === "restart" ? "Restart" : "Quit"}
            </button>
            <button type="button" className="rm-mbtn" onClick={() => setConfirm(null)}>
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
