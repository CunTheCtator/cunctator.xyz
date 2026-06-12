import type { Metadata } from "next";
import SystemBar from "@/components/SystemBar";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import GameConsoleShell from "@/components/GameConsoleShell";

export const metadata: Metadata = {
  title: "The Game | cunctator",
  description: "Remnant: a browser turn-based tactics campaign. Four factions, fog of war, a real opposing AI, and choices that bend the ending.",
};

const MANUAL = [
  {
    n: "01",
    t: "Action budget",
    b: "Every turn you spend a budget of actions: moving, attacking, building. Board state, structures, and status effects change how much you get.",
  },
  {
    n: "02",
    t: "Fog of war",
    b: "You see what your units see. The rest is last-known position and guesswork. The enemy plays under the same blindness.",
  },
  {
    n: "03",
    t: "The Extractor",
    b: "An unkillable unit that draws currency from Remnant-rich tiles each turn. Hold its ground; it pays for everything else.",
  },
  {
    n: "04",
    t: "The Builder",
    b: "Places and upgrades structures: barriers, walls, relay posts, watchtowers, turrets. Weak in a fight, and the enemy AI knows to hunt it.",
  },
  {
    n: "05",
    t: "Commanders",
    b: "Each faction fields two commanders, each with an army-wide passive. Your pick colors the whole campaign.",
  },
  {
    n: "06",
    t: "Remnant nodes",
    b: "Scattered objectives. Solve a short puzzle to claim a bonus. Fail or skip it and you simply walk away. No penalty.",
  },
];

export default function GamePage() {
  return (
    <div className="hp vh">
      <SystemBar />
      <Nav />

      <header className="vc-hero">
        <div className="vc-hero__grid" />
        <div className="vc-hero__in">
          <div className="vb-kicker vb-mono">THE GAME · FIELD COMMAND</div>
          <h1 className="gm-h1">
            Remnant<span className="dot">.</span>
          </h1>
          <p className="vc-lead">
            Three powers and one buried technology that turns soldiers into something
            more. Take a side, take a commander, and fight a campaign across the ice for
            control of the Remnant.
          </p>
          <p className="vc-sub">
            A turn-based tactics campaign, built from scratch and played in your browser.
            You are the Commander. Nothing holds your hand.
          </p>
          <div className="gm-hero__cta">
            <a className="gm-btn gm-btn--solid" href="#console">
              Deploy
              <svg
                width="16"
                height="11"
                viewBox="0 0 16 11"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 5.5h13M10 1l4 4.5-4 4.5" />
              </svg>
            </a>
            <a className="gm-btn gm-btn--ghost" href="#manual">
              Read the field manual
            </a>
          </div>
        </div>
      </header>

      <GameConsoleShell />

      <div className="gm-shead" id="manual">
        <div className="gm-shead__k">FIELD MANUAL</div>
        <h2 className="gm-shead__t">How the war works</h2>
        <p className="gm-shead__s">
          Six things to know before you drop. The rest you&apos;ll learn the hard way.
        </p>
      </div>
      <section className="gm-manual">
        {MANUAL.map((m) => (
          <div className="gm-entry" key={m.n}>
            <div className="gm-entry__n">{m.n}</div>
            <div className="gm-entry__t">{m.t}</div>
            <div className="gm-entry__b">{m.b}</div>
          </div>
        ))}
      </section>

      <SiteFooter />
    </div>
  );
}
