"use client";

import { useEffect, useState, type CSSProperties } from "react";
import GameCanvas from "@/components/GameCanvas";
import { gameData } from "@/game/data/loader";
import { isPirateUnlocked } from "@/lib/pirate-unlock";

type FactionDef = {
  id: "covenant" | "syndicate" | "vrath" | "pirates";
  name: string;
  species: string;
  color: string;
  doctrine: string;
  note: string;
  op: string;
};

const OP_MAP: Record<string, string> = {
  covenant: "OP. HELVYN · SOUTHERN ICE SHELF",
  syndicate: "OP. KARADUN · GLASS FIELD",
  vrath: "OP. YELVAR · OPEN GROUND",
  pirates: "OP. AC-411 · MARSH",
};

const DOCTRINE_MAP: Record<string, string> = {
  covenant: "Support & control",
  syndicate: "Range & information",
  vrath: "Aggression",
  pirates: "Eclectic & unpredictable",
};

const NOTE_MAP: Record<string, string> = {
  covenant: "Buffs, debuffs, and damage that lingers. Rewards patient, methodical play.",
  syndicate: "A generalist toolbox with reach. Rewards adaptability and what you know before they do.",
  vrath: "Close range, direct damage, almost no tricks. Rewards forward pressure.",
  pirates: "Slightly stronger crew, no doctrine, just results. The buyer pays; the crew delivers.",
};

function buildFactions(includePirates: boolean): FactionDef[] {
  const ids: FactionDef["id"][] = includePirates
    ? ["covenant", "syndicate", "vrath", "pirates"]
    : ["covenant", "syndicate", "vrath"];
  return ids
    .map((id) => {
      const f = gameData.factions.find((x) => x.id === id);
      if (!f) return null;
      return {
        id,
        name: f.name,
        species: f.species,
        color: f.color,
        doctrine: DOCTRINE_MAP[id] ?? "",
        note: NOTE_MAP[id] ?? "",
        op: OP_MAP[id] ?? "OP.",
      };
    })
    .filter((x): x is FactionDef => x !== null);
}

function Sigil({ id }: { id: "covenant" | "syndicate" | "vrath" | "pirates" | "locked" | "standby" }) {
  const s = { width: "100%", height: "100%", display: "block" } as const;
  if (id === "covenant")
    return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" />
      </svg>
    );
  if (id === "syndicate")
    return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z" />
        <path d="M12 8.5l3.5 2v3L12 15.5l-3.5-2v-3z" fill="currentColor" stroke="none" />
      </svg>
    );
  if (id === "vrath")
    return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M12 3l9 16H3z" />
        <path d="M12 10l3.5 6h-7z" fill="currentColor" stroke="none" />
      </svg>
    );
  if (id === "pirates")
    return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M12 3l2.4 5.6 6 .5-4.6 4 1.4 5.9L12 17l-5.6 3 1.4-5.9-4.6-4 6-.5z" />
      </svg>
    );
  if (id === "locked")
    return (
      <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="5" y="10.5" width="14" height="9" rx="1.5" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l9 9-9 9-9-9z" />
    </svg>
  );
}

export default function GameConsoleShell() {
  const [piratesUnlocked, setPiratesUnlocked] = useState(false);

  useEffect(() => {
    setPiratesUnlocked(isPirateUnlocked());
  }, []);

  const FACTIONS = buildFactions(piratesUnlocked);

  return (
    <>
      <div className="gm-console-wrap" id="console">
        <div
          className="gm-console gm-console--canvas"
          style={{ "--fac": "var(--accent)" } as CSSProperties}
        >
          <GameCanvas />
        </div>
      </div>

      <div className="gm-shead">
        <div className="gm-shead__k">ORDER OF BATTLE</div>
        <h2 className="gm-shead__t">The factions</h2>
        <p className="gm-shead__s">
          Three powers want the Remnant for different reasons. Each plays differently:
          different units, different temperament, a different campaign.
        </p>
      </div>
      <section className="gm-factions">
        {FACTIONS.map((f) => (
          <div className="gm-fac" key={f.id} style={{ "--c": f.color } as CSSProperties}>
            <div className="gm-fac__sigil">
              <Sigil id={f.id} />
            </div>
            <div className="gm-fac__name">{f.name}</div>
            <div className="gm-fac__species">{f.species}</div>
            <div className="gm-fac__doctrine">{f.doctrine}</div>
            <div className="gm-fac__note">{f.note}</div>
          </div>
        ))}
        {!piratesUnlocked && (
          <div className="gm-fac gm-fac--locked">
            <div className="gm-fac__sigil">
              <Sigil id="locked" />
            </div>
            <div className="gm-fac__name gm-redacted">
              A fourth power{" "}
              <span className="bar" style={{ width: 120, display: "inline-block" }} />
            </div>
            <div className="gm-fac__species">Classification withheld</div>
            <div className="gm-fac__note">
              Someone else is on the ice. They don&apos;t answer to a god, a guild, or a
              standard, and they aren&apos;t on the order of battle yet.{" "}
              <span className="gm-redacted">[ unlock conditions redacted ]</span>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
