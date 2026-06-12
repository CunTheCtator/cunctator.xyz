import type { Metadata } from "next";
import Link from "next/link";
import SystemBar from "@/components/SystemBar";
import MotionOrchestrator from "@/components/MotionOrchestrator";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import CounterBand from "@/components/CounterBand";
import ArrowRight from "@/components/ArrowRight";
import { PROFILES, STATEMENT, STATUS } from "@/lib/site";
import { getSiteCounters } from "@/lib/site-counters";
import { getAllDocuments } from "@/lib/db";

export const metadata: Metadata = {
  title: "cunctator",
  description: "Operator profile: programmer, worldbuilder, game master. Projects, the Alder World library, and a browser tactics game.",
};

const PLAYER_CELLS = new Set([26, 27, 38, 51, 63]);
const ENEMY_CELLS = new Set([92, 104, 105, 117]);
const TERRAIN_CELLS = new Set([40, 52, 53, 66, 78, 79, 90]);

function Grid12() {
  const cells = [];
  for (let i = 0; i < 144; i++) {
    const cls = PLAYER_CELLS.has(i)
      ? "a"
      : ENEMY_CELLS.has(i)
      ? "b"
      : TERRAIN_CELLS.has(i)
      ? "m"
      : "";
    cells.push(<i className={cls} key={i} />);
  }
  return <div className="vc-grid12">{cells}</div>;
}

export default function HomePage() {
  const counters = getSiteCounters();
  const profiles = PROFILES.filter((p) => p.label !== "Email" && p.primary);
  const latestDoc = getAllDocuments()[0] ?? null;

  return (
    <div className="hp vh">
      <MotionOrchestrator />
      <SystemBar />
      <Nav />

      <header className="vc-hero">
        <div className="vc-hero__grid" />
        <div className="vc-hero__in">
          <div className="vb-kicker vb-mono">OPERATOR PROFILE</div>
          <h1 className="vc-h1">
            cunctator<span className="dot">.</span>
            <span className="vb-cursor" />
          </h1>
          <p className="vc-lead">{STATEMENT}</p>

          <div className="vc-term">
            <div className="vc-term__bar">
              <span className="vc-term__dot" />
              <span className="vc-term__dot" />
              <span className="vc-term__dot" />
              <span className="vc-term__name">identity.sh</span>
            </div>
            <div className="vc-term__body">
              <span className="ln">
                <span className="c"># who</span>
              </span>
              <span className="ln">
                <span className="k">role</span>     ={" "}
                <span className="v">[ programmer, worldbuilder, game_master ]</span>
              </span>
              <span className="ln">
                <span className="k">status</span>   ={" "}
                <span className="v">&quot;{STATUS}&quot;</span>
              </span>
              <span className="ln">
                <span className="k">building</span> ={" "}
                <span className="v">[ the_alder_world, the_game ]</span>
              </span>
            </div>
          </div>

          <div className="vc-cta">
            <Link className="vc-btn vc-btn--primary" href="/game">
              Play the game
            </Link>
            <Link className="vc-btn vc-btn--ghost" href="/library">
              Enter the library
            </Link>
          </div>
        </div>
      </header>

      <div data-reveal="">
        <CounterBand counters={counters} />
      </div>

      <section className="vc-bento" data-reveal="">
        <Link
          className="vc-card vc-card--wide vc-card--tall vc-card--big"
          href="/library"
        >
          <div className="vc-card__tag">LIBRARY</div>
          <div className="vc-card__title">The Library</div>
          <div className="vc-card__blurb">
            My writing archive: worldbuilding, lore, and chronicles, with The Alder World
            as its centerpiece. Each document rendered exactly as written.
          </div>
          <div className="vc-doclines">
            <i className="t" />
            <i className="s" />
            <i className="s2" />
            <i />
            <i className="s3" />
            <i className="s" />
          </div>
          <div className="vc-ph">
            {latestDoc
              ? `Latest entry: “${latestDoc.title}”`
              : "The first entries are being written; archive opening soon."}
          </div>
          <div className="vc-card__foot">
            <ArrowRight label="Browse the library" />
          </div>
        </Link>

        <Link className="vc-card vc-card--tall vc-card--big" href="/game">
          <Grid12 />
          <div className="vc-card__tag">TACTICS</div>
          <div className="vc-card__title">The Game</div>
          <div className="vc-card__blurb">
            A turn-based tactics campaign. Three factions, fog of war, real opposing AI.
            Playable in-browser.
          </div>
          <div className="vc-card__foot">
            <ArrowRight label="Play in browser" />
          </div>
        </Link>

        <Link className="vc-card" href="/about">
          <div className="vc-card__tag">PERSONAL</div>
          <div className="vc-card__title">About</div>
          <div className="vc-card__blurb">
            Who I am, told in interests rather than credentials.
          </div>
          <div className="vc-card__foot">
            <ArrowRight label="Read more" />
          </div>
        </Link>

        <Link className="vc-card vc-card--wide" href="/projects">
          <div className="vc-card__tag">ENGINEERING</div>
          <div className="vc-card__title">Projects</div>
          <div className="vc-card__blurb">
            Software I&apos;ve built and shipped. Links out to source and live demos.
          </div>
          <div className="vc-card__foot">
            <ArrowRight label="See the work" />
          </div>
        </Link>

        <Link className="vc-card vc-card--full" href="/contact">
          <div className="vc-card__tag">DIRECT</div>
          <div className="vc-contact">
            <div>
              <div className="vc-card__title">Contact</div>
              <div className="vc-card__blurb">
                Reach me directly. Email or a profile. No forms, no tracking.
              </div>
            </div>
            <div className="vc-contact__profiles">
              {profiles.map((p) => (
                <div key={p.label} className="vc-contact__profile">
                  <div className="vc-contact__label">{p.label}</div>
                  <div className="vc-contact__handle">{p.handle}</div>
                </div>
              ))}
            </div>
          </div>
        </Link>
      </section>

      <div data-reveal="">
        <SiteFooter />
      </div>
    </div>
  );
}
