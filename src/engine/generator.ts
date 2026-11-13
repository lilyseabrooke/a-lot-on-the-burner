import { clueLevel, satisfies, type ClueSpec } from './clues';
import { clueWeight, intensityRank, MAX_RANK, MIN_RANK, spaceLoad } from './intensity';
import { allCombos, type PuzzleData } from './puzzle';
import { rosterFor } from './roster';
import { hashString, mulberry32, randInt, shuffle, type Rng } from './rng';
import { ORIGINS, SLOTS, STATS, type Available, type Combo, type Slot } from './types';

/*
 * Puzzle generation, in outline:
 *   1. Choose a target Intensity Rank for the day.
 *   2. Choose ingredient sets (bigger for harder days) and a secret solution.
 *   3. List every clue that is true of the solution.
 *   4. Pick clues one at a time. Each must rule out at least one remaining
 *      combination, and the clue that leaves only the solution is "the
 *      minimum". Harder targets prefer more abstract clues and narrow the field
 *      more slowly, so more clues are needed.
 *   5. Add direct helper clues after the minimum ("the binder is X") so a
 *      player who keeps asking always reaches the answer.
 *   6. Score the result and keep the attempt closest to the target.
 */

export const MIN_SET = 6;
export const MAX_SET = 12;
const MIN_CLUES_TO_MINIMUM = 3;
const MAX_CLUES_TO_MINIMUM = 14;
const ATTEMPTS = 40;

export function seedFor(puzzleNumber: number): number {
  return hashString(`a-lot-on-the-burner:${puzzleNumber}`);
}

/** Most days are 5–20; above 20 is rare (≈8%). */
export function pickTargetRank(rng: Rng): number {
  const r = rng();
  if (r < 0.3) return randInt(rng, 5, 10);
  if (r < 0.62) return randInt(rng, 11, 15);
  if (r < 0.92) return randInt(rng, 16, 20);
  if (r < 0.98) return randInt(rng, 21, 25);
  return randInt(rng, 26, 30);
}

/** 0 at the easiest rank, 1 at the hardest. */
const difficulty = (target: number) => (target - MIN_RANK) / (MAX_RANK - MIN_RANK);

// ------------------------------------------------------------ clue pool

/** Every non-helper clue that is true of the solution and could matter for these sets. */
export function candidateClues(available: Available, solution: Combo): ClueSpec[] {
  const out: ClueSpec[] = [];
  const add = (spec: ClueSpec) => {
    if (satisfies(spec, solution)) out.push(spec);
  };
  const slotPairs: [Slot, Slot][] = [
    ['base', 'catalyst'],
    ['base', 'binder'],
    ['catalyst', 'binder'],
  ];
  const ids = SLOTS.flatMap((s) => available[s]);

  for (const slot of SLOTS) {
    for (const origin of ORIGINS) {
      add({ kind: 'slotOrigin', slot, origin, is: true });
      add({ kind: 'slotOrigin', slot, origin, is: false });
    }
    ORIGINS.forEach((o1, i) =>
      ORIGINS.slice(i + 1).forEach((o2) => add({ kind: 'slotOriginEither', slot, origins: [o1, o2] })),
    );
    for (const stat of STATS) {
      for (let n = 2; n <= 9; n++) {
        add({ kind: 'slotStatBound', slot, stat, op: 'atLeast', n });
        add({ kind: 'slotStatBound', slot, stat, op: 'atMost', n });
      }
      add({ kind: 'slotParity', slot, stat, even: true });
      add({ kind: 'slotParity', slot, stat, even: false });
      for (const most of [true, false])
        for (const strict of [true, false]) add({ kind: 'extreme', slot, stat, most, strict });
      add({ kind: 'sumVsOne', slot, stat, greater: true });
      add({ kind: 'sumVsOne', slot, stat, greater: false });
      for (const ifOrigin of [null, ...ORIGINS])
        for (const moreThan of [true, false])
          for (const den of [2, 3, 4] as const) add({ kind: 'shareFraction', slot, stat, ifOrigin, moreThan, den });
    }
    for (const over of STATS) {
      add({ kind: 'selfCompare', slot, over, strict: true });
      add({ kind: 'selfCompare', slot, over, strict: false });
    }
  }

  for (const id of ids) add({ kind: 'excluded', id });

  for (const [a, b] of slotPairs) {
    add({ kind: 'pairShare', a, b, same: true });
    add({ kind: 'pairShare', a, b, same: false });
    for (const stat of STATS) {
      add({ kind: 'pairParity', a, b, stat, same: true });
      add({ kind: 'pairParity', a, b, stat, same: false });
      for (let n = 1; n <= 6; n++) {
        add({ kind: 'diffBound', a, b, stat, op: 'atLeast', n });
        add({ kind: 'diffBound', a, b, stat, op: 'atMost', n });
      }
    }
  }

  for (const a of SLOTS)
    for (const b of SLOTS) {
      if (a === b) continue;
      for (const stat of STATS) {
        add({ kind: 'slotCompare', a, b, stat, strict: true });
        add({ kind: 'slotCompare', a, b, stat, strict: false });
      }
      for (const ifOrigin of ORIGINS)
        for (const thenOrigin of ORIGINS) {
          add({ kind: 'conditionalOrigin', ifSlot: a, ifOrigin, thenSlot: b, thenOrigin, is: true });
          add({ kind: 'conditionalOrigin', ifSlot: a, ifOrigin, thenSlot: b, thenOrigin, is: false });
        }
    }

  for (const origin of ORIGINS)
    for (const count of ['none', 'exactlyOne', 'atLeastOne', 'atLeastTwo'] as const)
      add({ kind: 'originCount', origin, count });
  add({ kind: 'originVariety', allDistinct: true });
  add({ kind: 'originVariety', allDistinct: false });

  for (const stat of STATS) {
    for (let n = 6; n <= 27; n++) {
      add({ kind: 'totalBound', stat, op: 'atLeast', n });
      add({ kind: 'totalBound', stat, op: 'atMost', n });
    }
    add({ kind: 'totalParity', stat, even: true });
    add({ kind: 'totalParity', stat, even: false });
  }
  for (const over of STATS) {
    add({ kind: 'totalCompare', over, strict: true });
    add({ kind: 'totalCompare', over, strict: false });
  }

  for (const host of SLOTS)
    for (const id of available[host])
      for (const slot of SLOTS) {
        if (slot === host) continue;
        for (const origin of ORIGINS) {
          add({ kind: 'pairing', id, slot, origin, only: false });
          add({ kind: 'pairing', id, slot, origin, only: true });
        }
      }

  return out;
}

// ------------------------------------------------------------ generation

interface Attempt {
  puzzle: PuzzleData;
  rank: number;
  minClues: number;
}

function chooseSets(rng: Rng, target: number): Available {
  const d = difficulty(target);
  const lo = Math.round(MIN_SET + 4 * d);
  const hi = Math.min(MAX_SET, lo + 2);
  const available = {} as Available;
  for (const slot of SLOTS) {
    // Occasionally restrict one shelf hard, whatever the difficulty.
    const restricted = rng() < 0.15;
    const n = restricted ? MIN_SET : randInt(rng, Math.max(MIN_SET, lo - 1), hi);
    available[slot] = shuffle(rng, rosterFor(slot))
      .slice(0, n)
      .map((i) => i.id)
      .sort();
  }
  return available;
}

function helperClues(rng: Rng, available: Available, solution: Combo): ClueSpec[] {
  const [first, second, third] = shuffle(rng, SLOTS);
  const decoys = shuffle(
    rng,
    available[first].filter((id) => id !== solution[first].id),
  ).slice(0, 2);
  return [
    { kind: 'slotOneOf', slot: first, ids: shuffle(rng, [solution[first].id, ...decoys]) },
    { kind: 'slotIs', slot: second, id: solution[second].id },
    { kind: 'slotIs', slot: third, id: solution[third].id },
    { kind: 'slotIs', slot: first, id: solution[first].id },
  ];
}

function attempt(rng: Rng, puzzleNumber: number, target: number): Attempt | null {
  const d = difficulty(target);
  const levelCentre = 1 + 4 * d;
  const available = chooseSets(rng, target);
  const combos = allCombos(available);
  const n = combos.length;
  const solutionIndex = randInt(rng, 0, n - 1);
  const solution = combos[solutionIndex];

  const pool = candidateClues(available, solution)
    .map((spec) => {
      const pass = new Uint8Array(n);
      let passing = 0;
      combos.forEach((combo, j) => {
        if (satisfies(spec, combo)) {
          pass[j] = 1;
          passing++;
        }
      });
      return { spec, pass, passing, level: clueLevel(spec) };
    })
    .filter((c) => c.passing < n);

  const targetClues = Math.max(MIN_CLUES_TO_MINIMUM, Math.round((target - spaceLoad(n)) / clueWeight(levelCentre)));

  let alive = combos.map((_, j) => j);
  const chosen: ClueSpec[] = [];
  const kindUses = new Map<string, number>();
  const used = new Set<number>();

  while (alive.length > 1) {
    const step = chosen.length + 1;
    if (step > MAX_CLUES_TO_MINIMUM) return null;
    const goal = Math.max(1, Math.pow(n, 1 - step / targetClues));
    let best = -1;
    let bestScore = Infinity;
    pool.forEach((c, idx) => {
      if (used.has(idx)) return;
      let after = 0;
      for (const j of alive) after += c.pass[j];
      if (after === alive.length) return; // rules nothing out
      if (after === 1 && step < MIN_CLUES_TO_MINIMUM) return; // always needs at least 3 clues
      let score = Math.abs(Math.log(after) - Math.log(goal));
      if (after === 1 && step < targetClues - 1) score += 3 * (targetClues - 1 - step);
      score += 0.6 * Math.abs(c.level - levelCentre);
      score += 0.5 * (kindUses.get(c.spec.kind) ?? 0);
      score += rng() * 0.4;
      if (score < bestScore) {
        bestScore = score;
        best = idx;
      }
    });
    if (best === -1) return null;
    const pickClue = pool[best];
    used.add(best);
    chosen.push(pickClue.spec);
    kindUses.set(pickClue.spec.kind, (kindUses.get(pickClue.spec.kind) ?? 0) + 1);
    alive = alive.filter((j) => pickClue.pass[j] === 1);
  }

  const rank = intensityRank(chosen, n);
  return {
    rank,
    minClues: chosen.length,
    puzzle: {
      format: 1,
      number: puzzleNumber,
      intensity: rank,
      available,
      clues: [...chosen, ...helperClues(rng, available, solution)],
    },
  };
}

export interface GenerateResult {
  puzzle: PuzzleData;
  target: number;
  minClues: number;
}

export function generatePuzzle(puzzleNumber: number, seed = seedFor(puzzleNumber), target?: number): GenerateResult {
  const rng = mulberry32(seed);
  const goal = target ?? pickTargetRank(rng);
  let best: Attempt | null = null;
  for (let i = 0; i < ATTEMPTS; i++) {
    const a = attempt(rng, puzzleNumber, goal);
    if (!a) continue;
    if (!best || Math.abs(a.rank - goal) < Math.abs(best.rank - goal)) best = a;
    if (best.rank === goal) break;
  }
  if (!best) throw new Error(`Could not generate puzzle ${puzzleNumber}`);
  return { puzzle: best.puzzle, target: goal, minClues: best.minClues };
}

