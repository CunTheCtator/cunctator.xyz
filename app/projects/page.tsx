import type { Metadata } from "next";
import SystemBar from "@/components/SystemBar";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import ExtLink from "@/components/ExtLink";
import { FEATURED_PROJECT, PROJECTS, PROFILES } from "@/lib/site";

export const metadata: Metadata = {
  title: "Projects | cunctator",
  description: "Software I've built and shipped, with links out to source and live demos.",
};

export default function ProjectsPage() {
  const github = PROFILES.find((p) => p.label === "GitHub")!;

  return (
    <div className="hp vh">
      <SystemBar />
      <Nav />

      <header className="vc-hero">
        <div className="vc-hero__grid" />
        <div className="vc-hero__in">
          <div className="vb-kicker vb-mono">PROJECTS</div>
          <h1 className="pr-h1">
            Things I&apos;ve<span className="dot"> built.</span>
          </h1>
          <p className="vc-lead">
            Software I&apos;ve designed and shipped. Most of it self-hosted, all of it
            built to last longer than the patience of whoever was waiting on it.
          </p>
          <p className="vc-sub">A curated few. Each links out to source or a live demo.</p>
        </div>
      </header>

      <section className="pr-featured">
        <div className="pr-featured__card">
          <div className="pr-featured__body">
            <div className="pr-featured__eyebrow">{FEATURED_PROJECT.eyebrow}</div>
            <h2 className="pr-featured__title">{FEATURED_PROJECT.title}</h2>
            <div className="pr-featured__meta">{FEATURED_PROJECT.meta}</div>
            <p className="pr-featured__desc">{FEATURED_PROJECT.desc}</p>
            <div className="pr-tags pr-featured__tags">
              {FEATURED_PROJECT.tags.map((t) => (
                <span className="pr-tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
            <div className="pr-featured__foot">
              <span
                className="pr-status"
                data-s={FEATURED_PROJECT.status[0]}
              >
                {FEATURED_PROJECT.status[1]}
              </span>
              <div className="pr-links">
                {FEATURED_PROJECT.links.map((l) => (
                  <ExtLink key={l.label} {...l} />
                ))}
              </div>
            </div>
          </div>
          <div className="pr-preview">
            <div className="pr-preview__bar">
              <span className="pr-preview__dot" />
              <span className="pr-preview__dot" />
              <span className="pr-preview__dot" />
              <span className="pr-preview__url">{FEATURED_PROJECT.url}</span>
            </div>
            <div className="pr-preview__body pr-preview__body--mock">
              <div className="pr-mini">
                <div className="pr-mini__bar">
                  <i /><i /><i />
                </div>
                <div className="pr-mini__word">
                  cunctator<span>.</span><i className="pr-mini__cursor" />
                </div>
                <div className="pr-mini__lines">
                  <i style={{ width: "72%" }} />
                  <i style={{ width: "54%" }} />
                </div>
                <div className="pr-mini__term">
                  <i style={{ width: "38%" }} />
                  <i style={{ width: "61%" }} />
                  <i style={{ width: "47%" }} />
                </div>
                <div className="pr-mini__bento">
                  <i className="a" /><i /><i /><i className="b" /><i /><i />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="pr-shead">
        <div className="pr-shead__k">MORE WORK</div>
        <h2 className="pr-shead__t">Selected projects</h2>
      </div>
      <section className="pr-list">
        {PROJECTS.map((p) => (
          <article className="pr-row" key={p.n}>
            <div className="pr-row__n">{p.n}</div>
            <div>
              <div className="pr-row__title">
                {p.title}
                <span className="pr-row__year">{p.year}</span>
              </div>
              <div className="pr-row__desc">{p.desc}</div>
              <div className="pr-tags">
                {p.tags.map((t) => (
                  <span className="pr-tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="pr-row__side">
              <span className="pr-status" data-s={p.status[0]}>
                {p.status[1]}
              </span>
              <div className="pr-links">
                {p.links.map((l) => (
                  <ExtLink key={l.label} {...l} />
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>

      <div className="pr-more">
        <div>
          <div className="pr-more__t">More on GitHub</div>
          <div className="pr-more__s">
            Smaller experiments, tools, and one-offs live on the profile.
          </div>
        </div>
        <ExtLink label={(github.href ?? "").replace(/^https?:\/\//, "")} href={github.href ?? "/"} solid />
      </div>

      <SiteFooter />
    </div>
  );
}
