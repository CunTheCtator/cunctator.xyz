import type { Metadata } from "next";
import SystemBar from "@/components/SystemBar";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "About | cunctator",
  description: "Who I am, told in interests rather than credentials: programming, worldbuilding, and everything in between.",
};

const FACETS = [
  {
    n: "01",
    t: "Programming",
    b: "I build things end to end: this site, a tactics engine, tools I needed and couldn't find. TypeScript, Canvas, whatever the problem wants.",
  },
  {
    n: "02",
    t: "Worldbuilding",
    b: "The Alder World is an ongoing fantasy setting: calendars, factions, chronicles. Each entry written as a self-contained document.",
  },
  {
    n: "03",
    t: "Game mastering",
    b: "I run tabletop campaigns. Most of the worldbuilding starts as something a table needed on a Thursday night.",
  },
  {
    n: "04",
    t: "Japanese",
    b: "Slowly, stubbornly learning the language. Reading is the goal; patience is the method.",
  },
  {
    n: "05",
    t: "Games",
    b: "Tactics, strategy, anything with a system worth taking apart. The kind of player who reads the patch notes.",
  },
  {
    n: "06",
    t: "Cooking",
    b: "The other thing I do with my hands. Recipes treated like code: tweak, taste, iterate, rarely the same way twice.",
  },
];

const FACTS = [
  { k: "role", v: "programmer · worldbuilder", acc: false },
  { k: "building", v: "the alder world · the game", acc: true },
  { k: "learning", v: "日本語", acc: false },
  { k: "stack", v: "typescript · next · canvas", acc: false },
  { k: "playing", v: "tactics & strategy", acc: false },
];

const NOW = [
  {
    k: "Building",
    v: "This site & the tactics game",
    s: "shipping in the open",
  },
  { k: "Learning", v: "日本語", s: "reading practice, most days" },
  {
    k: "Playing",
    v: "Turn-based tactics",
    s: "and reading the patch notes",
  },
  { k: "Cooking", v: "Something slow", s: "weekends, no recipe twice" },
];

export default function AboutPage() {
  return (
    <div className="hp vh">
      <SystemBar />
      <Nav />

      <header className="vc-hero">
        <div className="vc-hero__grid" />
        <div className="vc-hero__in">
          <div className="vb-kicker vb-mono">ABOUT</div>
          <h1 className="ab-h1">
            Interests over
            <br />
            <span className="dot">credentials.</span>
          </h1>
          <p className="vc-lead">
            I build systems for work and worlds for fun, and I&apos;m not always great at
            telling the two apart.
          </p>
          <p className="vc-sub">
            Programmer, worldbuilder, and game master. Here&apos;s who that actually is.
          </p>
        </div>
      </header>

      <section className="ab-intro">
        <div className="ab-bio">
          <p>
            I&apos;m <strong>cunctator</strong>, a programmer who never quite stopped
            playing make-believe. I build software for a living and worlds for the love
            of it, and the two keep bleeding into each other.
          </p>
          <p>
            Most of what&apos;s on this site started as something a tabletop group needed,
            or a problem I couldn&apos;t stop turning over. I&apos;d rather{" "}
            <em>show the work</em> than list the credentials, so this is the work: code,
            a living fantasy world, and a game you can play right now.
          </p>
        </div>
        <aside className="ab-facts">
          <div className="ab-facts__head">whoami</div>
          {FACTS.map((f) => (
            <div className="ab-fact" key={f.k}>
              <b>{f.k}</b>
              <span className={f.acc ? "acc" : ""}>{f.v}</span>
            </div>
          ))}
        </aside>
      </section>

      <div className="ab-shead">
        <div className="ab-shead__k">WHAT I SPEND TIME ON</div>
        <h2 className="ab-shead__t">Six things, one person</h2>
        <p className="ab-shead__s">
          None of these is a job title. They&apos;re the threads that keep tangling
          together into everything here.
        </p>
      </div>
      <section className="ab-facets">
        {FACETS.map((f) => (
          <div className="ab-facet" key={f.n}>
            <div className="ab-facet__n">{f.n}</div>
            <div className="ab-facet__t">{f.t}</div>
            <div className="ab-facet__b">{f.b}</div>
          </div>
        ))}
      </section>

      <div className="ab-shead">
        <div className="ab-shead__k">
          <span className="vc-live" style={{ marginRight: 8 }} />
          NOW
        </div>
        <h2 className="ab-shead__t">What I&apos;m into lately</h2>
      </div>
      <section className="ab-now">
        <div className="ab-now__grid">
          {NOW.map((n) => (
            <div className="ab-now__cell" key={n.k}>
              <div className="ab-now__k">{n.k}</div>
              <div className="ab-now__v">
                {n.v}
                <small>{n.s}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
