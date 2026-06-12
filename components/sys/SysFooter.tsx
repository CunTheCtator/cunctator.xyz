import Link from "next/link";
import { COLOPHON, PROFILES } from "@/lib/site";

export default function SysFooter() {
  const email = PROFILES.find((p) => p.label === "Email");
  const social = PROFILES.filter((p) => p.label !== "Email");

  return (
    <footer className="sys-foot">
      <div>
        <div className="sys-foot__brand">
          cunctator<span>.</span>
        </div>
        <div className="sys-foot__note">{COLOPHON}</div>
      </div>
      <div className="sys-foot__col">
        <h2>Find me</h2>
        {social.map((p) => (
          <a
            href={p.href ?? undefined}
            key={p.label}
            target={p.href?.startsWith("http") ? "_blank" : undefined}
            rel={p.href?.startsWith("http") ? "noreferrer noopener" : undefined}
            style={p.href ? undefined : { cursor: "default" }}
          >
            {p.label}
            <span>{p.handle}</span>
          </a>
        ))}
      </div>
      <div className="sys-foot__col">
        <h2>Site</h2>
        {email && (
          <a href={email.href ?? undefined}>
            Email
            <span>{email.handle}</span>
          </a>
        )}
        <Link href="/library">
          The Library
          <span>read</span>
        </Link>
        <Link href="/">
          Home
          <span>·</span>
        </Link>
      </div>
    </footer>
  );
}
