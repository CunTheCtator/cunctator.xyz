"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#0D1117", color: "#e6edf3", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 12, letterSpacing: "0.14em", color: "#8b949e", textTransform: "uppercase" }}>
            Fault detected · system-level error
          </p>
          <h1 style={{ fontSize: 28, margin: 0 }}>The console hit an unrecoverable fault.</h1>
          <p style={{ color: "#8b949e", maxWidth: 460 }}>
            Reloading usually clears it. If it persists, the fault is on our side.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#8b949e" }}>ref: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{ background: "#1f6feb", color: "#fff", border: "none", borderRadius: 6, padding: "10px 22px", fontSize: 15, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
