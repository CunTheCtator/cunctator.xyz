"use client";

import type { ActiveAdvisory } from "@/game/engine/advisories";

type Props = {
  advisory: ActiveAdvisory;
  index: number;
  total: number;
  onAcknowledge: () => void;
  onMuteAll: () => void;
};

export default function CoachMark({ advisory, index, total, onAcknowledge, onMuteAll }: Props) {
  return (
    <div className="rm-coach" role="status">
      <div className="rm-coach__top">
        <span className="rm-coach__kick">FIELD ADVISORY {index}/{total}</span>
        <button type="button" className="rm-coach__mute" onClick={onMuteAll}>
          MUTE ALL
        </button>
      </div>
      <div className="rm-coach__title">{advisory.def.title}</div>
      <p className="rm-coach__copy">{advisory.def.copy}</p>
      <div className="rm-coach__foot">
        <span>{advisory.def.action}</span>
        <button type="button" onClick={onAcknowledge}>
          ACKNOWLEDGE <b>SPACE</b>
        </button>
      </div>
    </div>
  );
}
