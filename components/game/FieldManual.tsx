"use client";

import { useState } from "react";
import { gameData } from "@/game/data/loader";
import type { AdvisoryDef } from "@/game/engine/advisories";

type Props = {
  advisoryDefs: AdvisoryDef[];
  seenAdvisories: Record<string, number>;
  advisoriesMuted: boolean;
  onRestoreAdvisories: () => void;
  onClose: () => void;
};

const TABS = ["VERBS", "ECONOMY", "STATUS", "STRUCTURES", "NODES", "ADVISORIES"] as const;
type Tab = (typeof TABS)[number];

const VERBS: { key: string; name: string; desc: string }[] = [
  { key: "1", name: "Move", desc: "Order the selected unit to a lit tile. One move per unit per turn. Costs 1 action." },
  { key: "2", name: "Attack", desc: "Strike an enemy in range. Damage is exact: attacker ATK − defender DEF, minimum 1. Survivors in range retaliate. Costs 1 action." },
  { key: "3", name: "Ability", desc: "Trigger an unlocked ability. Gated by XP, bought with currency, limited by cooldown. Costs 1 action." },
  { key: "4", name: "Build", desc: "Builders place structures on adjacent tiles, repair damaged works, and amplify the extractor." },
  { key: "U", name: "Undo move", desc: "Take back the last move, until that unit acts. Acting settles the move permanently." },
  { key: "↵", name: "End turn", desc: "Pass to the enemy. Unspent actions are forfeit." },
  { key: "ESC", name: "Pause", desc: "Suspend the field. The board stays visible; nothing moves." },
];

export default function FieldManual({ advisoryDefs, seenAdvisories, advisoriesMuted, onRestoreAdvisories, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("VERBS");
  const economy = gameData.economy;

  return (
    <div className="rm-overlay rm-overlay--manual" role="dialog" aria-modal="true" aria-label="Field manual">
      <div className="rm-overlay__scan" />
      <div className="rm-manual">
        <div className="rm-manual__head">
          <div className="rm-mcard__kick">{"// FIELD MANUAL"}</div>
          <button type="button" className="rm-mbtn rm-cx__close" onClick={onClose}>
            Close <span className="rm-mbtn__chip">ESC</span>
          </button>
        </div>
        <div className="rm-manual__tabs">
          {TABS.map((t) => (
            <button key={t} type="button" data-on={tab === t ? "1" : "0"} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        <div className="rm-manual__body">
          {tab === "VERBS" &&
            VERBS.map((v) => (
              <div className="rm-manual__row" key={v.name}>
                <span className="rm-manual__key">{v.key}</span>
                <div>
                  <div className="rm-manual__name">{v.name}</div>
                  <div className="rm-manual__desc">{v.desc}</div>
                </div>
              </div>
            ))}

          {tab === "ECONOMY" && (
            <>
              <div className="rm-manual__row">
                <span className="rm-manual__key">¤</span>
                <div>
                  <div className="rm-manual__name">Currency</div>
                  <div className="rm-manual__desc">
                    An extractor seated beside a deposit draws ¤{economy.resourceTiles.baseOutputPerTurn} per adjacent
                    tile per turn. Relay posts within 4 tiles add ¤{economy.resourceTiles.relayPostBonus}. Currency
                    always carries between missions.
                  </div>
                </div>
              </div>
              <div className="rm-manual__row">
                <span className="rm-manual__key">XP</span>
                <div>
                  <div className="rm-manual__name">The record</div>
                  <div className="rm-manual__desc">
                    A kill grants 1 XP. Wounding grants damage ÷ max health to each contributor. Milestones:{" "}
                    {economy.xp.milestones.statIncrease}: choose a stat increase · {economy.xp.milestones.secondTrait}:
                    second trait wakes · {economy.xp.milestones.ability1Unlock}: first ability slot ·{" "}
                    {economy.xp.milestones.ability2Unlock}: second ability slot.
                  </div>
                </div>
              </div>
              <div className="rm-manual__row">
                <span className="rm-manual__key">⟲</span>
                <div>
                  <div className="rm-manual__name">Replacement</div>
                  <div className="rm-manual__desc">
                    Lost units can be re-bought; replacements muster at the extractor next turn. Extractors themselves
                    cannot be killed, only delayed.
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "STATUS" &&
            gameData.statusEffects.map((s) => (
              <div className="rm-manual__row" key={s.id}>
                <span className="rm-manual__key" data-level={s.level}>{s.level === "army" ? "A" : "U"}</span>
                <div>
                  <div className="rm-manual__name">{s.name}</div>
                  <div className="rm-manual__desc">{s.description}</div>
                </div>
              </div>
            ))}

          {tab === "STRUCTURES" &&
            gameData.structures.map((s) => (
              <div className="rm-manual__row" key={s.id}>
                <span className="rm-manual__key">¤{s.currencyCost}</span>
                <div>
                  <div className="rm-manual__name">
                    {s.name}
                    {s.faction !== "shared" && <em> · {s.faction}</em>}
                  </div>
                  <div className="rm-manual__desc">{s.description} ({s.durability} durability)</div>
                </div>
              </div>
            ))}

          {tab === "NODES" && (
            <>
              <div className="rm-manual__row">
                <span className="rm-manual__key">◇</span>
                <div>
                  <div className="rm-manual__name">Remnant consoles</div>
                  <div className="rm-manual__desc">
                    End a move beside a node to interface. The lock is positional: the key row shows five symbols in
                    scrambled positions; the cipher line names positions. Answer with the symbols at those positions.
                  </div>
                </div>
              </div>
              <div className="rm-manual__row">
                <span className="rm-manual__key">✓</span>
                <div>
                  <div className="rm-manual__name">Success</div>
                  <div className="rm-manual__desc">
                    Arms the whole detachment with an effect, and recovers a transmission fragment, kept permanently in
                    the codex, across defeats and campaigns.
                  </div>
                </div>
              </div>
              <div className="rm-manual__row">
                <span className="rm-manual__key">✕</span>
                <div>
                  <div className="rm-manual__name">Failure</div>
                  <div className="rm-manual__desc">No penalty. The node seals for the rest of the mission.</div>
                </div>
              </div>
            </>
          )}

          {tab === "ADVISORIES" && (
            <>
              <div className="rm-manual__row">
                <span className="rm-manual__key">{advisoriesMuted ? "OFF" : "ON"}</span>
                <div>
                  <div className="rm-manual__name">Field advisories</div>
                  <div className="rm-manual__desc">
                    One concept per beat, fired the first time it becomes relevant. Restore replays every advisory from
                    the start.
                  </div>
                  <button type="button" className="rm-set__restore" onClick={onRestoreAdvisories} style={{ marginTop: 8 }}>
                    RESTORE ADVISORIES
                  </button>
                </div>
              </div>
              {advisoryDefs
                .filter((d) => seenAdvisories[d.id] !== undefined)
                .map((d) => (
                  <div className="rm-manual__row" key={d.id}>
                    <span className="rm-manual__key">✓</span>
                    <div>
                      <div className="rm-manual__name">{d.title}</div>
                      <div className="rm-manual__desc">{d.copy}</div>
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
