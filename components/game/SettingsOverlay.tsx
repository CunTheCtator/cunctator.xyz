"use client";

import type { GameSettings, ReducedMotionSetting } from "@/lib/game-save";
import type { Difficulty } from "@/game/engine/types";
import { playSfx } from "@/game/audio/sfx";

type Props = {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  onRestoreAdvisories: () => void;
  onBack: () => void;
};

const MOTION_OPTIONS: { value: ReducedMotionSetting; label: string }[] = [
  { value: "system", label: "System" },
  { value: "on", label: "Reduced" },
  { value: "off", label: "Full" },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "easy", label: "Easy" },
];

export default function SettingsOverlay({ settings, onChange, onRestoreAdvisories, onBack }: Props) {
  return (
    <div className="rm-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="rm-overlay__scan" />
      <div className="rm-mcard rm-mcard--wide">
        <div className="rm-mcard__kick">{"// SETTINGS"}</div>

        <div className="rm-set__group">DISPLAY</div>
        <div className="rm-set__row">
          <div>
            <div className="rm-set__label">Motion</div>
            <div className="rm-set__sub">Damage numbers, drains, and deaths respect this.</div>
          </div>
          <div className="rm-seg" role="radiogroup" aria-label="Motion">
            {MOTION_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={settings.reducedMotion === o.value}
                data-on={settings.reducedMotion === o.value ? "1" : "0"}
                onClick={() => onChange({ ...settings, reducedMotion: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rm-set__group">GAME</div>
        <div className="rm-set__row">
          <div>
            <div className="rm-set__label">Field advisories</div>
            <div className="rm-set__sub">In-mission teaching tips. Restore replays them from the start.</div>
          </div>
          <div className="rm-set__ctl">
            <button
              type="button"
              className="rm-toggle"
              role="switch"
              aria-checked={!settings.advisoriesMuted}
              data-on={settings.advisoriesMuted ? "0" : "1"}
              onClick={() => onChange({ ...settings, advisoriesMuted: !settings.advisoriesMuted })}
            >
              <i />
            </button>
            <button type="button" className="rm-set__restore" onClick={onRestoreAdvisories}>
              RESTORE
            </button>
          </div>
        </div>
        <div className="rm-set__row">
          <div>
            <div className="rm-set__label">Difficulty</div>
            <div className="rm-set__sub">Easy softens enemy stats. Applies from the next mission.</div>
          </div>
          <div className="rm-seg" role="radiogroup" aria-label="Difficulty">
            {DIFFICULTY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={settings.difficulty === o.value}
                data-on={settings.difficulty === o.value ? "1" : "0"}
                onClick={() => onChange({ ...settings, difficulty: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rm-set__group">AUDIO</div>
        <div className="rm-set__row">
          <div>
            <div className="rm-set__label">Master volume</div>
            <div className="rm-set__sub">
              Every sound is synthesized live; no recordings. Zero mutes everything,
              ambience included.
            </div>
          </div>
          <div className="rm-set__ctl">
            <input
              type="range"
              className="rm-set__range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings.volume * 100)}
              aria-label="Master volume"
              onChange={(e) => onChange({ ...settings, volume: Number(e.target.value) / 100 })}
              onPointerUp={() => playSfx("levelup")}
            />
            <span className="rm-set__rangeval">{Math.round(settings.volume * 100)}%</span>
          </div>
        </div>

        <button type="button" className="rm-mbtn" onClick={onBack} style={{ marginTop: 16 }}>
          Back <span className="rm-mbtn__chip">ESC</span>
        </button>
      </div>
    </div>
  );
}
