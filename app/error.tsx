"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="sys">
      <div className="st-404">
        <div className="st-404__grid" />
        <div className="st-404__in">
          <div className="st-404__kicker">
            <span className="d" />
            FAULT DETECTED · RUNTIME ERROR
          </div>
          <h1 className="st-404__code">
            5<span className="z">0</span>0
          </h1>
          <h2 className="st-404__title">Something went wrong on this surface.</h2>
          <p className="st-404__lead">
            The rest of the system is unaffected. You can retry this view, or fall back
            to a known-good coordinate.
          </p>
          {error.digest && (
            <p className="st-404__lead" style={{ fontSize: 12, opacity: 0.7 }}>
              ref: {error.digest}
            </p>
          )}
          <div className="st-404__cta">
            <button className="sys-btn sys-btn--solid" type="button" onClick={reset}>
              Retry
            </button>
            <Link className="sys-btn sys-btn--ghost" href="/">
              Return home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
