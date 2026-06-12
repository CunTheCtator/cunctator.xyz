"use client";

import type { CSSProperties } from "react";
import { currentVisibleBeat, advanceBeat } from "@/game/engine/narrative";
import type { NarrativeData, NarrativeState } from "@/game/engine/narrative";
import { gameData } from "@/game/data/loader";

type Props = {
  narrativeData: NarrativeData;
  state: NarrativeState;
  choiceHistory: Record<string, string>;
  factionId?: string | null;
  onAdvance: (next: NarrativeState | null) => void;
  onChoice: (optionIndex: number) => void;
  onAbandon?: () => void;
};

const CHOICE_KEY_MAP: Record<number, string> = { 0: "A", 1: "B", 2: "C", 3: "D", 4: "E", 5: "F" };

export default function NarrativeScene({
  narrativeData,
  state,
  choiceHistory,
  factionId,
  onAdvance,
  onChoice,
  onAbandon,
}: Props) {
  const beat = currentVisibleBeat(narrativeData, state, choiceHistory);

  const bgSrc = `/game/assets/backgrounds/${state.background}.jpeg`;
  const leftSprite = state.leftSprite;
  const rightSprite = state.rightSprite;

  const faction = factionId ? gameData.factions.find((f) => f.id === factionId) : null;
  const facColor = faction?.color ?? "var(--accent)";

  function handleFrameClick() {
    if (!beat || beat.type === "choice") return;
    const next = advanceBeat(narrativeData, state, choiceHistory);
    onAdvance(next);
  }

  const isChoice = beat?.type === "choice";

  const sceneTag = state.sceneId.replace(/_/g, " ").toUpperCase();

  return (
    <div
      className="rm-nar"
      style={{
        "--fac": facColor,
        "--fac-soft": `color-mix(in oklch, ${facColor} 16%, transparent)`,
        "--fac-line": `color-mix(in oklch, ${facColor} 45%, transparent)`,
      } as CSSProperties}
    >
      <div className="flex flex-col items-center" style={{ width: "100%" }}>
        <div
          className="rm-nar__frame"
          onClick={handleFrameClick}
          role={isChoice ? undefined : "button"}
          tabIndex={isChoice ? undefined : 0}
          aria-label={isChoice ? undefined : "Continue"}
          onKeyDown={(e) => {
            if (isChoice) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleFrameClick();
            }
          }}
        >
          <div className="rm-nar__bg" style={{ backgroundImage: `url('${bgSrc}')` }} />

          <div className="rm-nar__loc">
            <b>SCENE.</b> {sceneTag}
          </div>

          {leftSprite && !isChoice && (
            <img
              className="rm-nar__sprite rm-nar__sprite--l"
              src={`/game/assets/characters/${leftSprite}.png`}
              alt=""
              draggable={false}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          )}
          {rightSprite && !isChoice && (
            <img
              className="rm-nar__sprite rm-nar__sprite--r"
              src={`/game/assets/characters/${rightSprite}.png`}
              alt=""
              draggable={false}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          )}

          <div className="rm-nar__box">
            {beat?.type === "dialogue" && (
              <>
                {beat.speaker && (
                  <div className="rm-nar__speaker">{beat.speaker}</div>
                )}
                <div className="rm-nar__text">{beat.text}</div>
                <div className="rm-nar__cont">
                  click to continue <span>▸</span>
                </div>
              </>
            )}

            {beat?.type === "choice" && (
              <div className="rm-nar__choices">
                {beat.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    className="rm-nar__choice"
                    onClick={(e) => { e.stopPropagation(); onChoice(i); }}
                  >
                    <span className="rm-nar__choice__k">{CHOICE_KEY_MAP[i] ?? i + 1}</span>
                    <span>{opt.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {onAbandon && (
          <button type="button" className="rm-nar__abandon" onClick={onAbandon}>
            Abandon briefing
          </button>
        )}
      </div>
    </div>
  );
}
