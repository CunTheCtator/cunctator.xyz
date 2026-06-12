import type { CipherPuzzle, GameState } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickFragment(
  fragments: { id: string; text: string; used: boolean }[]
): { id: string; text: string } | null {
  const unused = fragments.filter((f) => !f.used);
  if (unused.length === 0) {
    const any = fragments[Math.floor(Math.random() * fragments.length)];
    return any ? { id: any.id, text: any.text } : null;
  }
  const pick = unused[Math.floor(Math.random() * unused.length)];
  return { id: pick.id, text: pick.text };
}

export function generateCipherPuzzle(
  nodeId: string,
  state: Pick<GameState, "puzzleDef" | "fragmentPool">
): CipherPuzzle {
  const glyphs = state.puzzleDef.symbols.map((s) => s.glyph);
  const shuffledKey = shuffle(glyphs);

  const allPositions = [1, 2, 3, 4, 5];
  const positions = shuffle(allPositions).slice(0, state.puzzleDef.encodedLength);

  const frag = pickFragment(state.fragmentPool);

  return {
    nodeId,
    key: shuffledKey,
    encoded: positions,
    answer: [],
    fragment: frag,
    showingFragment: false,
  };
}

export function getCorrectAnswer(puzzle: CipherPuzzle): string[] {
  return puzzle.encoded.map((pos) => puzzle.key[pos - 1]);
}

export function isAnswerCorrect(puzzle: CipherPuzzle): boolean {
  if (puzzle.answer.length !== puzzle.encoded.length) return false;
  const correct = getCorrectAnswer(puzzle);
  return puzzle.answer.every((sym, i) => sym === correct[i]);
}

export function puzzleAddSymbol(puzzle: CipherPuzzle, glyph: string): CipherPuzzle {
  if (puzzle.answer.length >= puzzle.encoded.length) return puzzle;
  return { ...puzzle, answer: [...puzzle.answer, glyph] };
}

export function puzzleRemoveLast(puzzle: CipherPuzzle): CipherPuzzle {
  if (puzzle.answer.length === 0) return puzzle;
  return { ...puzzle, answer: puzzle.answer.slice(0, -1) };
}

export function markFragmentUsed(
  pool: { id: string; text: string; used: boolean }[],
  id: string
): { id: string; text: string; used: boolean }[] {
  return pool.map((f) => (f.id === id ? { ...f, used: true } : f));
}
