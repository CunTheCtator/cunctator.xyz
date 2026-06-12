import Link from "next/link";
import { COLOPHON, PROFILES } from "@/lib/site";

export default function SiteFooter() {
  const email = PROFILES.find((p) => p.label === "Email")!;
  const social = PROFILES.filter((p) => p.label !== "Email");

  return (
    <footer className="vc-foot">
      <div>
        <div className="vc-foot__brand">
          cunctator<span>.</span>
        </div>
        <div className="vc-foot__note">{COLOPHON}</div>
      </div>
      <div className="vc-foot__col">
        <h2>Find me</h2>
        {social.map((p) =>
          p.href ? (
            <a
              href={p.href}
              key={p.label}
              target="_blank"
              rel="noreferrer noopener"
            >
              {p.label}
              <span>{p.handle}</span>
            </a>
          ) : (
            <a key={p.label} href={undefined} style={{ cursor: "default" }}>
              {p.label}
              <span>{p.handle}</span>
            </a>
          )
        )}
      </div>
      <div className="vc-foot__col">
        <h2>Direct</h2>
        <a href={email.href ?? undefined}>
          Email
          <span>{email.handle}</span>
        </a>
        <Link href="/game">
          The Game
          <span>play</span>
        </Link>
        <Link href="/library">
          The Library
          <span>read</span>
        </Link>
        <Link href="/privacy">
          Privacy
          <span>nothing tracked</span>
        </Link>
      </div>
    </footer>
  );
}
