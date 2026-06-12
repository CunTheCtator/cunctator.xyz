import type { Metadata } from "next";
import Link from "next/link";
import SystemBar from "@/components/SystemBar";
import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy | cunctator",
  description: "What this site stores, what it doesn't, and how to make it forget you.",
};

export default function PrivacyPage() {
  return (
    <div className="hp vh">
      <SystemBar />
      <Nav />

      <header className="vc-hero">
        <div className="vc-hero__grid" />
        <div className="vc-hero__in">
          <div className="vb-kicker vb-mono">PRIVACY</div>
          <h1 className="lb-h1">
            Nothing tracked<span className="dot">.</span>
          </h1>
          <p className="vc-lead">
            This is a personal site. There are no analytics, no third-party trackers, no
            advertising, and no user accounts. Here is the complete inventory of what it
            touches.
          </p>
        </div>
      </header>

      <section className="pv-body">
        <div className="pv-block">
          <h2>Visitors</h2>
          <p>
            Reading pages, browsing the library, and playing the game require no account
            and send nothing identifying to this server beyond the ordinary web request.
            Server logs (IP address, requested path, timestamp) exist only as standard
            web-server operation and rotate out automatically.
          </p>
        </div>
        <div className="pv-block">
          <h2>The game</h2>
          <p>
            Campaign progress, settings, and recovered lore fragments are saved in your
            browser&apos;s <b>localStorage</b>, on your machine, never transmitted.
            Clearing site data in your browser erases them completely.
          </p>
        </div>
        <div className="pv-block">
          <h2>Admin sign-in</h2>
          <p>
            The only authentication on this site protects its own admin panel. Signing in
            via Discord, Google, or GitHub stores a <b>session cookie</b> and reads your
            public profile identity solely to check it against the single allowed admin
            account. No password is ever stored; no visitor is ever asked to sign in.
          </p>
        </div>
        <div className="pv-block">
          <h2>Deletion</h2>
          <p>
            There is nothing server-side to delete for visitors. If you believe this site
            holds anything of yours, <Link href="/contact">reach out</Link> and it will be
            removed.
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
