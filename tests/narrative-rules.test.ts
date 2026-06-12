import assert from "node:assert/strict";
import { gameData } from "../game/data/loader";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed++;
    failures.push(name);
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err instanceof Error ? err.message : err}`);
  }
}

const PRONOUNS = /\b(he|she|him|her|his|hers|himself|herself)\b/i;
const COMMANDER_IDS = new Set(gameData.commanders.map((c) => c.id));
const COMMANDER_NAMES = new Set(gameData.commanders.map((c) => c.name.toLowerCase()));

console.log("\n== Caevyn no-pronouns rule ==");

test("no line spoken by Caevyn contains a gendered pronoun referring ambiguously", () => {
  const offenders: string[] = [];
  for (const [sceneId, scene] of Object.entries(gameData.narrativeData.scenes)) {
    for (const beat of scene.beats) {
      if (beat.type !== "dialogue") continue;
      const aboutCaevyn = /caevyn/i.test(beat.text) || /caevyn/i.test(beat.speaker ?? "");
      if (!aboutCaevyn) continue;
      if (PRONOUNS.test(beat.text)) {
        offenders.push(`${sceneId}: "${beat.text.slice(0, 90)}"`);
      }
    }
  }
  assert.equal(offenders.length, 0, `Caevyn-adjacent lines with pronouns:\n${offenders.join("\n")}`);
});

console.log("\n== Commander never-on-screen rule ==");

test("no scene puts a commander sprite on screen", () => {
  const offenders: string[] = [];
  for (const [sceneId, scene] of Object.entries(gameData.narrativeData.scenes)) {
    const sprites: (string | null | undefined)[] = [scene.initialLeft, scene.initialRight];
    for (const beat of scene.beats) {
      if (beat.type === "set_sprites") {
        sprites.push(beat.left, beat.right);
      }
    }
    for (const sprite of sprites) {
      if (!sprite) continue;
      const lower = sprite.toLowerCase();
      if (COMMANDER_IDS.has(sprite) || lower.includes("commander") || COMMANDER_NAMES.has(lower)) {
        offenders.push(`${sceneId}: sprite "${sprite}"`);
      }
    }
  }
  assert.equal(offenders.length, 0, offenders.join("\n"));
});

console.log("\n== no draft markers in any shipped data ==");

test("data files carry no TODO/TBD/placeholder markers in player-visible strings", () => {
  const DRAFT = /\b(TODO|TBD|FIXME|lorem ipsum|placeholder text|xxx)\b/i;
  const offenders: string[] = [];
  const scan = (label: string, value: unknown): void => {
    if (typeof value === "string") {
      if (DRAFT.test(value)) offenders.push(`${label}: "${value.slice(0, 80)}"`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => scan(`${label}[${i}]`, v));
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (k === "designNote" || k === "designRationale" || k === "balanceNotes" || k === "implementation" || k === "rationale") continue;
        scan(`${label}.${k}`, v);
      }
    }
  };
  scan("narrative", gameData.narrativeData);
  scan("units", gameData.units);
  scan("commanders", gameData.commanders);
  scan("factions", gameData.factions);
  scan("structures", gameData.structures);
  scan("abilities", gameData.abilities);
  scan("statusEffects", gameData.statusEffects);
  scan("fragments", gameData.puzzleFragments.fragments);
  assert.equal(offenders.length, 0, offenders.join("\n"));
});

test("all 40 fragments have non-trivial text", () => {
  assert.equal(gameData.puzzleFragments.fragments.length, 40);
  for (const f of gameData.puzzleFragments.fragments) {
    assert.ok(f.text.trim().length > 20, `${f.id} text too short`);
  }
});

test("every scene background and sprite file is plausible (no path separators or extensions)", () => {
  for (const [sceneId, scene] of Object.entries(gameData.narrativeData.scenes)) {
    const ids: (string | null | undefined)[] = [scene.initialBackground, scene.initialLeft, scene.initialRight];
    for (const beat of scene.beats) {
      if (beat.type === "set_background") ids.push(beat.background);
      if (beat.type === "set_sprites") ids.push(beat.left, beat.right);
    }
    for (const id of ids) {
      if (!id) continue;
      assert.ok(!/[/\\.]/.test(id), `${sceneId}: suspicious asset id "${id}"`);
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error("failures:", failures.join(" | "));
  process.exit(1);
}
