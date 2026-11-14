import { clueFamily, clueLevel, satisfies, type ClueSpec, type Connective } from './clues';
import { factSlots, holds, isComponentFact, isHostRelative, isSubjectFact, type Fact } from './facts';
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
 *   4. Pick clues one at a time. Most rule out at least one remaining
 *      combination; occasionally (more often on harder days) one is a "dud"
 *      that rules nothing out. The clue that leaves only the solution is "the
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
/** Per-clue chance of a dud before the minimum, rising with difficulty; at most MAX_DUDS per puzzle. */
const DUD_CHANCE_EASIEST = 0.3;
const DUD_CHANCE_HARDEST = 0.4;
const MAX_DUDS = 2;

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
export function candidateClues(available: Available, solution: Combo, rng: Rng = mulberry32(1)): ClueSpec[] {
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

  out.push(...ruleClues(available, solution, rng));
  out.push(...rankClues(solution));
  out.push(...anyOriginClues(solution));

  return out;
}

// ------------------------------------------------------------ composite clues

/** Every simple fact that rule clues can be built from, for this shelf. */
function factsFor(available: Available): Fact[] {
  const out: Fact[] = [];
  for (const slot of SLOTS) for (const id of available[slot]) out.push({ f: 'has', id });
  for (const slot of SLOTS) {
    for (const origin of ORIGINS) out.push({ f: 'origin', slot, origin });
    for (const stat of STATS) {
      for (let n = 3; n <= 7; n++) out.push({ f: 'slotStat', slot, stat, op: 'over', n });
      for (let n = 4; n <= 8; n++) out.push({ f: 'slotStat', slot, stat, op: 'under', n });
      out.push({ f: 'slotParity', slot, stat, even: true }, { f: 'slotParity', slot, stat, even: false });
    }
  }
  for (const a of SLOTS)
    for (const b of SLOTS) if (a !== b) for (const stat of STATS) out.push({ f: 'cmp', a, b, stat, strict: true });
  for (const stat of STATS) {
    for (let n = 9; n <= 21; n += 2) out.push({ f: 'total', stat, op: 'over', n }, { f: 'total', stat, op: 'under', n: n + 1 });
    out.push({ f: 'totalParity', stat, even: true }, { f: 'totalParity', stat, even: false });
  }
  for (const origin of ORIGINS)
    for (const count of ['none', 'atLeastOne', 'atLeastTwo', 'atMostOne'] as const) out.push({ f: 'count', origin, count });
  out.push({ f: 'variety', distinct: true }, { f: 'variety', distinct: false });
  out.push(
    ...(
      [
        ['base', 'catalyst'],
        ['base', 'binder'],
        ['catalyst', 'binder'],
      ] as [Slot, Slot][]
    ).flatMap(([a, b]) => [
      { f: 'share', a, b, same: true } as Fact,
      { f: 'share', a, b, same: false } as Fact,
    ]),
  );
  return out;
}

/** Facts that only make sense next to a named ingredient: "a natural ingredient", "a heavier binder". */
function hostFacts(): Fact[] {
  const out: Fact[] = [];
  for (const origin of ORIGINS) out.push({ f: 'otherOrigin', origin });
  for (const slot of SLOTS) for (const stat of STATS) for (const more of [true, false]) out.push({ f: 'relStat', slot, stat, more });
  out.push({ f: 'othersShare', same: true }, { f: 'othersShare', same: false });
  return out;
}

/** Two facts make a sensible rule only if they talk about different things. */
function compatible(a: Fact, b: Fact): boolean {
  const sa = factSlots(a);
  if (factSlots(b).some((s) => sa.includes(s))) return false;
  if (a.f === b.f && (a.f === 'total' || a.f === 'variety')) return a.f === 'total' && b.f === 'total' && a.stat !== b.stat;
  if (a.f === 'count' && b.f === 'count' && a.origin === b.origin) return false;
  if ((a.f === 'variety' || b.f === 'variety') && (a.f === 'share' || b.f === 'share')) return false;
  return true;
}

/** How many rule clues of each shape to sample per attempt (the full space is tens of thousands). */
const RULE_SAMPLES = 200;

function ruleClues(available: Available, solution: Combo, rng: Rng): ClueSpec[] {
  const facts = factsFor(available);
  const ingredients = facts.filter((f) => f.f === 'has');
  const components = facts.filter(isComponentFact);
  // After a named ingredient, counts and shared-origin facts are ambiguous (does the ingredient
  // count?), so those use the host-relative forms instead: "a natural ingredient", "two other…".
  const afterIngredient = facts.filter((f) => f.f !== 'count' && f.f !== 'variety');
  const host = hostFacts();
  const pick = <T>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  const out: ClueSpec[] = [];

  const shapes: { conn: Connective; a: () => Fact; b: () => Fact }[] = [
    // Ingredient-led: "Contract Ink requires…", "…must be paired with…", "…cannot be paired with…"
    { conn: 'requires', a: () => pick(ingredients), b: () => (rng() < 0.4 ? pick(host) : pick(afterIngredient)) },
    { conn: 'excludes', a: () => pick(ingredients), b: () => (rng() < 0.4 ? pick(host) : pick(components)) },
    // Fact-led conditionals
    { conn: 'requires', a: () => pick(facts.filter((f) => f.f !== 'has' && isSubjectFact(f))), b: () => pick(facts) },
    { conn: 'excludes', a: () => pick(components.filter((f) => f.f !== 'has')), b: () => pick(components) },
    { conn: 'either', a: () => pick(facts), b: () => pick(facts) },
    { conn: 'xor', a: () => pick(facts), b: () => pick(facts) },
    { conn: 'iff', a: () => pick(facts), b: () => pick(facts) },
  ];
  for (const shape of shapes) {
    let found = 0;
    for (let tries = 0; tries < RULE_SAMPLES * 20 && found < RULE_SAMPLES; tries++) {
      const a = shape.a();
      const b = shape.b();
      if (!compatible(a, b)) continue;
      const spec: ClueSpec = { kind: 'rule', conn: shape.conn, a, b };
      if (!satisfies(spec, solution)) continue;
      out.push(spec);
      found++;
    }
  }
  return out;
}

/**
 * Clues about the middle-ranked component ("the middle-weight component", "the middle weight is 5")
 * are switched off for now: with ties (5, 5, 8) it isn't clear which component is "the middle".
 */
const MIDDLE_RANK_CLUES = false;

function rankClues(solution: Combo): ClueSpec[] {
  const out: ClueSpec[] = [];
  const add = (spec: ClueSpec) => {
    if (spec.kind === 'rank' && spec.pos === 'middle' && !MIDDLE_RANK_CLUES) return;
    if (satisfies(spec, solution)) out.push(spec);
  };
  for (const stat of STATS) {
    for (const slot of SLOTS) {
      add({ kind: 'rank', stat, pos: 'middle', prop: { p: 'slot', slot, is: true } });
      add({ kind: 'rank', stat, pos: 'middle', prop: { p: 'slot', slot, is: false } });
    }
    for (let n = 1; n <= 10; n++) add({ kind: 'rank', stat, pos: 'middle', prop: { p: 'value', op: 'is', n } });
    for (let n = 2; n <= 8; n++) {
      add({ kind: 'rank', stat, pos: 'middle', prop: { p: 'value', op: 'over', n } });
      add({ kind: 'rank', stat, pos: 'middle', prop: { p: 'value', op: 'under', n: n + 1 } });
    }
    add({ kind: 'rank', stat, pos: 'middle', prop: { p: 'valueParity', even: true } });
    add({ kind: 'rank', stat, pos: 'middle', prop: { p: 'valueParity', even: false } });
    for (const pos of ['top', 'bottom'] as const) {
      for (const slot of SLOTS) add({ kind: 'rank', stat, pos, prop: { p: 'slot', slot, is: false } });
      for (const origin of ORIGINS)
        for (const is of [true, false]) add({ kind: 'rank', stat, pos, prop: { p: 'origin', origin, is } });
      for (const pos2 of ['top', 'bottom'] as const)
        for (const is of [true, false]) add({ kind: 'rank', stat, pos, prop: { p: 'alsoRank', pos2, is } });
      for (let n = 3; n <= 7; n++) {
        add({ kind: 'rank', stat, pos, prop: { p: 'bound', op: 'over', n } });
        add({ kind: 'rank', stat, pos, prop: { p: 'bound', op: 'under', n: n + 1 } });
      }
      add({ kind: 'rank', stat, pos, prop: { p: 'parity', even: true } });
      add({ kind: 'rank', stat, pos, prop: { p: 'parity', even: false } });
    }
    for (const more of [true, false]) add({ kind: 'rank', stat, pos: 'top', prop: { p: 'vsBottom', more } });
    for (const same of [true, false]) add({ kind: 'rank', stat, pos: 'top', prop: { p: 'share', same } });
    for (let n = 2; n <= 6; n++) add({ kind: 'rank', stat, pos: 'top', prop: { p: 'spread', op: 'atLeast', n } });
    for (let n = 1; n <= 4; n++) add({ kind: 'rank', stat, pos: 'top', prop: { p: 'spread', op: 'atMost', n } });
    for (const is of [true, false]) add({ kind: 'rank', stat, pos: 'top', prop: { p: 'outweighs', is } });
  }
  return out;
}

function anyOriginClues(solution: Combo): ClueSpec[] {
  const out: ClueSpec[] = [];
  const add = (spec: ClueSpec) => {
    if (satisfies(spec, solution)) out.push(spec);
  };
  for (const origin of ORIGINS)
    for (const stat of STATS) {
      for (const must of [true, false]) {
        for (const slot of SLOTS) add({ kind: 'anyOrigin', origin, must, prop: { p: 'vsSlot', slot, stat } });
        for (let n = 3; n <= 7; n++) {
          add({ kind: 'anyOrigin', origin, must, prop: { p: 'bound', stat, op: 'over', n } });
          add({ kind: 'anyOrigin', origin, must, prop: { p: 'bound', stat, op: 'under', n: n + 1 } });
        }
        for (const other of ORIGINS)
          if (other !== origin) add({ kind: 'anyOrigin', origin, must, prop: { p: 'vsOrigin', other, stat } });
      }
      for (const even of [true, false]) add({ kind: 'anyOrigin', origin, must: true, prop: { p: 'parity', stat, even } });
    }
  return out;
}

/**
 * Which combos each clue allows (1) or rules out (0). Rule clues are built from a few hundred facts
 * shared across thousands of rules, so each fact is checked against the combos once and reused.
 */
function passVectors(combos: Combo[]): (spec: ClueSpec) => Uint8Array {
  const n = combos.length;
  const factCache = new Map<string, Uint8Array>();
  const factVector = (f: Fact): Uint8Array => {
    const key = JSON.stringify(f);
    let v = factCache.get(key);
    if (!v) {
      v = new Uint8Array(n);
      for (let j = 0; j < n; j++) v[j] = holds(f, combos[j]) ? 1 : 0;
      factCache.set(key, v);
    }
    return v;
  };
  return (spec) => {
    const pass = new Uint8Array(n);
    if (spec.kind === 'rule' && !isHostRelative(spec.b)) {
      const A = factVector(spec.a);
      const B = factVector(spec.b);
      for (let j = 0; j < n; j++) {
        const a = A[j] === 1;
        const b = B[j] === 1;
        switch (spec.conn) {
          case 'requires':
            pass[j] = !a || b ? 1 : 0;
            break;
          case 'excludes':
            pass[j] = a && b ? 0 : 1;
            break;
          case 'either':
            pass[j] = a || b ? 1 : 0;
            break;
          case 'xor':
            pass[j] = a !== b ? 1 : 0;
            break;
          case 'iff':
            pass[j] = a === b ? 1 : 0;
            break;
        }
      }
      return pass;
    }
    for (let j = 0; j < n; j++) pass[j] = satisfies(spec, combos[j]) ? 1 : 0;
    return pass;
  };
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

interface PoolEntry {
  spec: ClueSpec;
  pass: Uint8Array;
  level: number;
}

/** True when every combination on the shelf that passes `earlier` also passes `later`. */
function implies(earlier: PoolEntry, later: PoolEntry): boolean {
  for (let j = 0; j < earlier.pass.length; j++) if (earlier.pass[j] === 1 && later.pass[j] === 0) return false;
  return true;
}

/**
 * A "dud": true, but every combination it would rule out is already gone. It may confirm something
 * the player could already work out, or look useful while adding nothing. A clue that merely
 * restates a single earlier clue ("total weight at least 8" after "at least 16") is never allowed.
 */
function pickDud(
  rng: Rng,
  pool: PoolEntry[],
  chosen: PoolEntry[],
  alive: number[],
  used: Set<number>,
  kindUses: Map<string, number>,
  levelCentre: number,
): number {
  const options: { idx: number; score: number }[] = [];
  pool.forEach((c, idx) => {
    if (used.has(idx)) return;
    for (const j of alive) if (c.pass[j] === 0) return;
    const score = 0.6 * Math.abs(c.level - levelCentre) + 0.5 * (kindUses.get(clueFamily(c.spec)) ?? 0) + rng() * 0.6;
    options.push({ idx, score });
  });
  options.sort((a, b) => a.score - b.score);
  for (const { idx } of options.slice(0, 80)) {
    if (!chosen.some((earlier) => implies(earlier, pool[idx]))) return idx;
  }
  return -1;
}

function attempt(rng: Rng, puzzleNumber: number, target: number): Attempt | null {
  const d = difficulty(target);
  const levelCentre = 1 + 4 * d;
  const available = chooseSets(rng, target);
  const combos = allCombos(available);
  const n = combos.length;
  const solutionIndex = randInt(rng, 0, n - 1);
  const solution = combos[solutionIndex];

  const passFor = passVectors(combos);
  const pool = candidateClues(available, solution, rng)
    .map((spec) => {
      const pass = passFor(spec);
      let passing = 0;
      for (let j = 0; j < n; j++) passing += pass[j];
      return { spec, pass, passing, level: clueLevel(spec) };
    })
    .filter((c) => c.passing < n);

  const targetClues = Math.max(MIN_CLUES_TO_MINIMUM, Math.round((target - spaceLoad(n)) / clueWeight(levelCentre)));

  type PoolClue = (typeof pool)[number];
  let alive = combos.map((_, j) => j);
  const chosen: PoolClue[] = [];
  const kindUses = new Map<string, number>();
  const used = new Set<number>();
  const dudChance = DUD_CHANCE_EASIEST + (DUD_CHANCE_HARDEST - DUD_CHANCE_EASIEST) * d;
  let informative = 0;
  let duds = 0;
  let lastWasDud = false;

  const take = (idx: number) => {
    const clue = pool[idx];
    used.add(idx);
    chosen.push(clue);
    kindUses.set(clueFamily(clue.spec), (kindUses.get(clueFamily(clue.spec)) ?? 0) + 1);
    alive = alive.filter((j) => clue.pass[j] === 1);
  };

  while (alive.length > 1) {
    const step = chosen.length + 1;
    if (step > MAX_CLUES_TO_MINIMUM) return null;

    // Sometimes slip in a clue that rules nothing out. Never as the free clue, never two in a row,
    // and never as the clue that finishes the puzzle (that one always narrows to the answer).
    if (step > 1 && !lastWasDud && duds < MAX_DUDS && rng() < dudChance) {
      const dud = pickDud(rng, pool, chosen, alive, used, kindUses, levelCentre);
      if (dud !== -1) {
        take(dud);
        duds++;
        lastWasDud = true;
        continue;
      }
    }
    lastWasDud = false;

    // Duds take up clue slots, so the informative clues narrow faster to keep the total on target.
    const informativeTarget = Math.max(MIN_CLUES_TO_MINIMUM - duds, targetClues - duds);
    const progress = informative + 1;
    const goal = Math.max(1, Math.pow(n, 1 - progress / informativeTarget));
    let best = -1;
    let bestScore = Infinity;
    pool.forEach((c, idx) => {
      if (used.has(idx)) return;
      let after = 0;
      for (const j of alive) after += c.pass[j];
      if (after === alive.length) return; // rules nothing out
      if (after === 1 && step < MIN_CLUES_TO_MINIMUM) return; // always needs at least 3 clues
      let score = Math.abs(Math.log(after) - Math.log(goal));
      if (after === 1 && progress < informativeTarget - 1) score += 3 * (informativeTarget - 1 - progress);
      score += 0.6 * Math.abs(c.level - levelCentre);
      score += 0.5 * (kindUses.get(clueFamily(c.spec)) ?? 0);
      score += rng() * 0.4;
      if (score < bestScore) {
        bestScore = score;
        best = idx;
      }
    });
    if (best === -1) return null;
    take(best);
    informative++;
  }

  const specs = chosen.map((c) => c.spec);
  const rank = intensityRank(specs, n);
  return {
    rank,
    minClues: specs.length,
    puzzle: {
      format: 1,
      number: puzzleNumber,
      intensity: rank,
      available,
      clues: [...specs, ...helperClues(rng, available, solution)],
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

