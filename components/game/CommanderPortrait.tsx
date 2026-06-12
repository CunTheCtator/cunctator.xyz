"use client";

import { useState } from "react";

const COMMANDER_PORTRAITS: Record<string, string> = {
  covenant_shepherd: "aeathas_base",
  covenant_confessor: "caevyn_base",
  syndicate_director: "soldan_base",
  syndicate_analyst: "korren_base",
  vrath_warlord: "high_chief_base",
  vrath_undying: "vrakthi_senior_officer_base",
  pirates_captain: "halloran_base",
  pirates_fixer: "pirate_crew_human_base",
};

type Props = {
  commanderId: string;
  commanderName: string;
};

export default function CommanderPortrait({ commanderId, commanderName }: Props) {
  const [failed, setFailed] = useState(false);
  const portraitId = COMMANDER_PORTRAITS[commanderId];
  const src = portraitId ? `/game/assets/characters/${portraitId}.png` : null;
  const monogram = commanderName.replace(/^The\s+/, "").charAt(0).toUpperCase();

  if (!src || failed) {
    return (
      <div className="rm-cmcard__port rm-cmcard__port--ph">
        <span>{monogram}</span>
      </div>
    );
  }

  return (
    <div className="rm-cmcard__port">
      <img src={src} alt="" draggable={false} onError={() => setFailed(true)} />
    </div>
  );
}
