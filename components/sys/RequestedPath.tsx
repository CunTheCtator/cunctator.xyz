"use client";

import { useEffect, useState } from "react";

export default function RequestedPath() {
  const [pathname, setPathname] = useState<string | null>(null);

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  return (
    <div className="st-404__path">
      requested · <b>{pathname ?? "·"}</b>
    </div>
  );
}
