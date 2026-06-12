"use client";

import type { Unit } from "@/game/engine/types";

type Stat = "attack" | "defense" | "hp" | "moveRange";

type Props = {
  unit: Unit;
  onChoose: (stat: Stat) => void;
};

const OPTIONS: { key: Stat; label: string; sub: string }[] = [
  { key: "attack", label: "Attack +2", sub: "Hit harder" },
  { key: "defense", label: "Defense +2", sub: "Take less" },
  { key: "hp", label: "Max HP +2", sub: "Endure more" },
  { key: "moveRange", label: "Move +1", sub: "Reach further" },
];

export default function LevelUpOverlay({ unit, onChoose }: Props) {
  return (
    <div className="rm-modal">
      <div className="rm-card rm-lvl">
        <div className="rm-lvl__tag">◆ Milestone reached</div>
        <div className="rm-lvl__name">{unit.name} levels up</div>
        <div className="rm-lvl__sub">Choose a permanent improvement.</div>
        <div className="rm-lvl__opts">
          {OPTIONS.map((o) => (
            <button key={o.key} type="button" className="rm-lvl__opt" onClick={() => onChoose(o.key)}>
              <b>{o.label}</b>
              <span>{o.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
