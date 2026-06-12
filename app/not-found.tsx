import Link from "next/link";
import { NAV } from "@/lib/site";
import SysBar from "@/components/sys/SysBar";
import SysFooter from "@/components/sys/SysFooter";
import RequestedPath from "@/components/sys/RequestedPath";

const BUILD_TAG = "BUILD 2026.06";
const SECTIONS = String(NAV.length).padStart(2, "0");

export default function NotFound() {
  return (
    <div className="sys">
      <SysBar status="PERSONAL SYSTEM">
        <span className="lock">SIGNAL: LOST</span>
        <span className="hide-sm">SECTIONS: {SECTIONS}</span>
        <span className="hide-sm">{BUILD_TAG}</span>
      </SysBar>

      <div className="st-404">
        <div className="st-404__grid" />
        <div className="st-404__in">
          <div className="st-404__kicker">
            <span className="d" />
            NO READOUT · ERROR 404
          </div>
          <h1 className="st-404__code">
            4<span className="z">0</span>4
          </h1>
          <h2 className="st-404__title">There&apos;s nothing at this coordinate.</h2>
          <p className="st-404__lead">
            The page you&apos;re looking for was moved, never existed, or the link dropped a
            character somewhere.
          </p>
          <RequestedPath />
          <div className="st-404__cta">
            <Link className="sys-btn sys-btn--solid" href="/">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8H4M7 4 3 8l4 4" />
              </svg>
              Return home
            </Link>
            <Link className="sys-btn sys-btn--ghost" href="/library">
              Browse the library
            </Link>
          </div>
        </div>
      </div>

      <SysFooter />
    </div>
  );
}
