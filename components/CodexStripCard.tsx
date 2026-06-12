"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SAVE_KEY = "remnant_save_v1";
const TOTAL_FRAGMENTS = 40;
const GLYPHS = ["◇", "△", "◎", "✕", "□"];

export default function CodexStripCard() {
  const [recovered, setRecovered] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) {
        setRecovered(0);
        return;
      }
      const parsed = JSON.parse(raw) as { codex?: Record<string, unknown> };
      setRecovered(Object.keys(parsed.codex ?? {}).length);
    } catch (err) {
      console.error("[codex-strip] failed to read save:", err);
      setRecovered(0);
    }
  }, []);

  if (recovered === null || recovered === 0) return null;

  return (
    <Link className="lb-codexstrip" href="/game">
      <span className="lb-codexstrip__k">{"// FROM THE GAME"}</span>
      <span className="lb-codexstrip__t">Recovered fragments</span>
      <span className="lb-codexstrip__n">
        {recovered} of {TOTAL_FRAGMENTS} transmissions decoded by play
      </span>
      <span className="lb-codexstrip__glyphs">
        {GLYPHS.map((g, i) => (
          <i key={g} data-lit={i < Math.ceil((recovered / TOTAL_FRAGMENTS) * GLYPHS.length) ? "1" : "0"}>
            {g}
          </i>
        ))}
      </span>
    </Link>
  );
}
