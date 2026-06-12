"use client";

import { useMemo, useState } from "react";
import { gameData } from "@/game/data/loader";
import type { CodexRecord } from "@/lib/game-save";

type Props = {
  codex: Record<string, CodexRecord>;
  onClose: () => void;
};

const GLYPHS = ["◇", "△", "◎", "✕", "□"];

function romanNumeral(n: number): string {
  const table: [number, string][] = [
    [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let rest = n;
  for (const [v, s] of table) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

export default function CodexOverlay({ codex, onClose }: Props) {
  const fragments = gameData.puzzleFragments.fragments;
  const total = fragments.length;
  const recovered = fragments.filter((f) => codex[f.id]).length;
  const [openId, setOpenId] = useState<string | null>(null);
  const [worldFilter, setWorldFilter] = useState<string | null>(null);

  const worlds = useMemo(() => {
    const set = new Set<string>();
    for (const rec of Object.values(codex)) set.add(rec.world);
    return [...set].sort();
  }, [codex]);

  const recoveredIds = fragments.filter((f) => codex[f.id]).map((f) => f.id);
  const openIdx = openId ? recoveredIds.indexOf(openId) : -1;
  const openFragment = openId ? fragments.find((f) => f.id === openId) ?? null : null;
  const openRecord = openId ? codex[openId] ?? null : null;
  const lastRecovery = Object.entries(codex).sort((a, b) => b[1].recoveredAt.localeCompare(a[1].recoveredAt))[0] ?? null;

  return (
    <div className="rm-overlay rm-overlay--codex" role="dialog" aria-modal="true" aria-label="Fragment codex">
      <div className="rm-overlay__scan" />
      <div className="rm-cx">
        <div className="rm-cx__head">
          <div>
            <div className="rm-mcard__kick">{"// FRAGMENT CODEX"}</div>
            <div className="rm-cx__sub">Recovered transmissions persist across campaigns. Defeat does not erase knowledge.</div>
          </div>
          <div className="rm-cx__progress">
            <b>{recovered}</b>/{total}
            <div className="rm-cx__bar">
              <i style={{ width: `${(recovered / total) * 100}%` }} />
            </div>
            {lastRecovery && (
              <div className="rm-cx__last">last · {lastRecovery[1].world.toUpperCase()}</div>
            )}
          </div>
          <button type="button" className="rm-mbtn rm-cx__close" onClick={onClose}>
            Close <span className="rm-mbtn__chip">ESC</span>
          </button>
        </div>

        {worlds.length > 1 && (
          <div className="rm-cx__filters">
            <button type="button" data-on={worldFilter === null ? "1" : "0"} onClick={() => setWorldFilter(null)}>
              ALL
            </button>
            {worlds.map((w) => (
              <button key={w} type="button" data-on={worldFilter === w ? "1" : "0"} onClick={() => setWorldFilter(w)}>
                {w.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {openFragment && openRecord ? (
          <div className="rm-cx__reader">
            <div className="rm-cx__tablet">
              <div className="rm-cx__glyphrow">
                {GLYPHS.map((g, i) => (
                  <span key={g} data-lit={i === (fragments.indexOf(openFragment)) % 5 ? "1" : "0"}>{g}</span>
                ))}
              </div>
              <div className="rm-cx__num">FRAGMENT {romanNumeral(fragments.indexOf(openFragment) + 1)}</div>
              <p className="rm-cx__text">{openFragment.text}</p>
              <div className="rm-cx__meta">
                RECOVERED · OP. {openRecord.world.toUpperCase()} · TURN {String(openRecord.turn).padStart(2, "0")} · NODE {openRecord.node.toUpperCase()}
              </div>
            </div>
            <div className="rm-cx__nav">
              <button
                type="button"
                className="rm-mbtn"
                disabled={openIdx <= 0}
                onClick={() => setOpenId(recoveredIds[openIdx - 1])}
              >
                ← Prev
              </button>
              <button type="button" className="rm-mbtn" onClick={() => setOpenId(null)}>
                Grid
              </button>
              <button
                type="button"
                className="rm-mbtn"
                disabled={openIdx < 0 || openIdx >= recoveredIds.length - 1}
                onClick={() => setOpenId(recoveredIds[openIdx + 1])}
              >
                Next →
              </button>
            </div>
          </div>
        ) : recovered === 0 ? (
          <div className="rm-cx__empty">
            <p>Nothing recovered yet.</p>
            <p className="rm-cx__emptysub">
              Remnant consoles in the field carry cipher locks. Solve one and its transmission is kept here.
            </p>
          </div>
        ) : (
          <div className="rm-cx__grid">
            {fragments.map((f, i) => {
              const rec = codex[f.id];
              const dimmed = worldFilter !== null && (!rec || rec.world !== worldFilter);
              if (!rec) {
                return (
                  <div className="rm-cx__slot" data-dim={dimmed ? "1" : "0"} key={f.id}>
                    <span className="rm-cx__idx">{String(i + 1).padStart(2, "0")}</span>
                    <span className="rm-cx__lock">🔒</span>
                    <span className="rm-cx__unrec">UNRECOVERED</span>
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  className="rm-cx__slot rm-cx__slot--open"
                  data-dim={dimmed ? "1" : "0"}
                  key={f.id}
                  onClick={() => setOpenId(f.id)}
                >
                  <span className="rm-cx__idx">{String(i + 1).padStart(2, "0")}</span>
                  <span className="rm-cx__glyph">{GLYPHS[i % 5]}</span>
                  <span className="rm-cx__excerpt">{f.text}</span>
                  <span className="rm-cx__world">{rec.world.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
