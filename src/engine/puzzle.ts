import { satisfies, type ClueSpec } from './clues';
import { ingredient } from './roster';
import type { Available, Combo } from './types';

/** The stored form of a puzzle (one JSON file per day in public/puzzles). */
export interface PuzzleData {
  /** Bumped if the file format or clue semantics ever change. */
  format: 1;
  number: number;
  intensity: number;
  available: Available;
  /** Full clue sequence, in reveal order. Clue 1 is given for free. */
  clues: ClueSpec[];
}

export function allCombos(available: Available): Combo[] {
  const out: Combo[] = [];
  for (const b of available.base)
    for (const c of available.catalyst)
      for (const d of available.binder)
        out.push({ base: ingredient(b), catalyst: ingredient(c), binder: ingredient(d) });
  return out;
}

export function remaining(combos: Combo[], clues: readonly ClueSpec[]): Combo[] {
  return combos.filter((combo) => clues.every((clue) => satisfies(clue, combo)));
}

export interface Analysis {
  solution: Combo;
  /** Number of clues (counting the free first one) after which only the solution remains. */
  minClues: number;
  /** Combos left after each prefix of clues: counts[i] = remaining after i + 1 clues. */
  counts: number[];
}

/** Works out the answer and the minimum from the clues alone (the answer is never stored). */
export function analyse(puzzle: Pick<PuzzleData, 'available' | 'clues'>): Analysis {
  let alive = allCombos(puzzle.available);
  const counts: number[] = [];
  let minClues = -1;
  puzzle.clues.forEach((clue, i) => {
    alive = alive.filter((combo) => satisfies(clue, combo));
    counts.push(alive.length);
    if (alive.length === 1 && minClues === -1) minClues = i + 1;
  });
  if (alive.length !== 1 || minClues === -1) {
    throw new Error(`Puzzle does not resolve to a single potion (${alive.length} remain)`);
  }
  return { solution: alive[0], minClues, counts };
}

export const comboIds = (c: Combo): [string, string, string] => [c.base.id, c.catalyst.id, c.binder.id];
