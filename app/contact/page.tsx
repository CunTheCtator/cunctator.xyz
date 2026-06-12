import type { Metadata } from "next";
import SystemBar from "@/components/SystemBar";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import CopyButton from "@/components/CopyButton";
import { PROFILES } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact | cunctator",
  description: "Reach me directly: email or a profile. No forms, no tracking.",
};

const REASONS = [
  {
    t: "Work & collaboration",
    s: "Something to build, or a problem worth a second pair of eyes.",
  },
  {
    t: "The game",
    s: "Bugs, feedback, or a faction idea after a few missions.",
  },
  {
    t: "The Alder World",
    s: "Lore questions, or you want to run a session in it.",
  },
];

export default function ContactPage() {
  const email = PROFILES.find((p) => p.label === "Email")!.handle;
  const [localPart, domain] = email.split("@");
  const social = PROFILES.filter((p) => p.label !== "Email");

  return (
    <div className="hp vh">
      <SystemBar />
      <Nav />

      <header className="vc-hero">
        <div className="vc-hero__grid" />
        <div className="vc-hero__in">
          <div className="vb-kicker vb-mono">CONTACT</div>
          <h1 className="ct-h1">
            Say<span className="dot"> something.</span>
          </h1>
          <p className="vc-lead">
            The fastest way to reach me is email; it just opens your mail client. No
            forms, no tracking, nothing stored.
          </p>
          <p className="vc-sub">I read everything. I answer most of it.</p>
        </div>
      </header>

      <section className="ct-main">
        <div className="ct-email">
          <div className="ct-email__bar">
            <span>// PRIMARY CHANNEL</span>
            <span className="ct-email__online">RESPONDS IN A DAY OR TWO</span>
          </div>
          <div className="ct-email__label">Email me at</div>
          <div className="ct-email__addr">
            {localPart}
            <span className="at">@</span>
            {domain}
          </div>
          <div className="ct-email__actions">
            <a className="ct-btn ct-btn--solid" href={`mailto:${email}`}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
                <path d="M2 4l6 4.5L14 4" />
              </svg>
              Compose email
            </a>
            <CopyButton value={email} />
          </div>
        </div>

        <aside className="ct-aside">
          <div className="ct-aside__h">GOOD REASONS TO WRITE</div>
          {REASONS.map((r) => (
            <div className="ct-aside__item" key={r.t}>
              <div className="ct-aside__t">{r.t}</div>
              <div className="ct-aside__s">{r.s}</div>
            </div>
          ))}
        </aside>
      </section>

      <div className="ct-shead">
        <div className="ct-shead__k">ELSEWHERE</div>
        <h2 className="ct-shead__t">Or find me here</h2>
        <p className="ct-shead__s">
          Same person, different rooms. Pick whichever fits the conversation.
        </p>
      </div>
      <section className="ct-profiles">
        {social.map((p) =>
          p.href ? (
            <a
              className="ct-profile"
              href={p.href}
              key={p.label}
              target={p.href.startsWith("http") ? "_blank" : undefined}
              rel={p.href.startsWith("http") ? "noreferrer noopener" : undefined}
            >
              <div className="ct-profile__top">
                <span className="ct-profile__name">{p.label}</span>
                <svg
                  className="ct-profile__arrow"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12L12 4M5 4h7v7" />
                </svg>
              </div>
              <div className="ct-profile__handle">{p.handle}</div>
              <div className="ct-profile__for">{p.forWhat}</div>
            </a>
          ) : (
            <div className="ct-profile" key={p.label}>
              <div className="ct-profile__top">
                <span className="ct-profile__name">{p.label}</span>
              </div>
              <div className="ct-profile__handle">{p.handle}</div>
              <div className="ct-profile__for">{p.forWhat}</div>
            </div>
          )
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
