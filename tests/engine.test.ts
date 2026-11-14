import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe as group, expect, it } from 'vitest';
import { clueLevel, describe, satisfies, type AnyProp, type ClueSpec, type Connective, type RankProp } from '../src/engine/clues';
import type { Fact } from '../src/engine/facts';
import type { Origin } from '../src/engine/types';
import { generatePuzzle, MAX_SET, MIN_SET } from '../src/engine/generator';
import { intensityRank } from '../src/engine/intensity';
import { allCombos, analyse, remaining, type PuzzleData } from '../src/engine/puzzle';
import { ingredient, ROSTER } from '../src/engine/roster';
import { SLOTS } from '../src/engine/types';

function checkPuzzle(p: PuzzleData) {
  const combos = allCombos(p.available);
  const a = analyse(p);

  // Every clue is true of the answer.
  for (const clue of p.clues) expect(satisfies(clue, a.solution), describe(clue)).toBe(true);

  // The free clue and the minimum clue always narrow things down. Clues in between may be duds
  // (rule nothing out), but no clue up to the minimum just restates a single earlier clue.
  expect(a.counts[0]).toBeLessThan(combos.length);
  expect(a.counts[a.minClues - 1]).toBeLessThan(a.counts[a.minClues - 2]);
  for (let i = 1; i < a.minClues; i++) {
    for (let j = 0; j < i; j++) {
      const restates = combos.every((c) => !satisfies(p.clues[j], c) || satisfies(p.clues[i], c));
      expect(restates, `clue ${i + 1} restates clue ${j + 1}`).toBe(false);
    }
  }
  // Nothing is solved before the minimum, and the free clue alone never solves it.
  expect(a.minClues).toBeGreaterThanOrEqual(3);
  expect(a.counts[a.minClues - 2]).toBeGreaterThan(1);
  // Direct helpers only appear after the minimum.
  p.clues.slice(0, a.minClues).forEach((c) => expect(clueLevel(c)).toBeGreaterThan(0));
  // The stored rank matches the clues.
  expect(p.intensity).toBe(intensityRank(p.clues.slice(0, a.minClues), combos.length));
  for (const slot of SLOTS) {
    expect(p.available[slot].length).toBeGreaterThanOrEqual(MIN_SET);
    expect(p.available[slot].length).toBeLessThanOrEqual(MAX_SET);
    p.available[slot].forEach((id) => expect(ingredient(id).slot).toBe(slot));
  }
}

group('roster', () => {
  it('has unique ids and enough of each slot', () => {
    expect(new Set(ROSTER.map((i) => i.id)).size).toBe(ROSTER.length);
    for (const slot of SLOTS) expect(ROSTER.filter((i) => i.slot === slot).length).toBeGreaterThanOrEqual(MAX_SET);
  });
});

group('clues', () => {
  const combo = { base: ingredient('b15'), catalyst: ingredient('c08'), binder: ingredient('d06') };
  // Mindwretch Resin (spectral 6/9), Contract Paper (demonic 1/1), Shield Blossom (natural 6/1)
  it('handles ties in comparisons', () => {
    expect(satisfies({ kind: 'extreme', slot: 'base', stat: 'weight', most: true, strict: true }, combo)).toBe(false);
    expect(satisfies({ kind: 'extreme', slot: 'base', stat: 'weight', most: true, strict: false }, combo)).toBe(true);
  });
  it('evaluates proportional clues', () => {
    // total weight 13; base 6 → more than a third, less than half
    expect(satisfies({ kind: 'shareFraction', slot: 'base', stat: 'weight', ifOrigin: null, moreThan: true, den: 3 }, combo)).toBe(true);
    expect(satisfies({ kind: 'shareFraction', slot: 'base', stat: 'weight', ifOrigin: null, moreThan: true, den: 2 }, combo)).toBe(false);
    expect(satisfies({ kind: 'shareFraction', slot: 'base', stat: 'weight', ifOrigin: 'natural', moreThan: true, den: 2 }, combo)).toBe(true);
  });
  // Rule clues: two facts joined by a connective.
  const has = (id: string) => ({ f: 'has', id }) as const;
  const rule = (conn: Connective, a: Fact, b: Fact): ClueSpec => ({ kind: 'rule', conn, a, b });
  it('treats ingredient rules as vacuous when the ingredient is absent', () => {
    expect(satisfies(rule('excludes', has('b15'), { f: 'otherOrigin', origin: 'natural' }), combo)).toBe(false);
    expect(satisfies(rule('excludes', has('b02'), { f: 'otherOrigin', origin: 'natural' }), combo)).toBe(true);
    expect(satisfies(rule('requires', has('b02'), { f: 'total', stat: 'weight', op: 'over', n: 20 }), combo)).toBe(true);
  });
  it('measures host-relative facts against the named ingredient', () => {
    expect(satisfies(rule('requires', has('b15'), { f: 'otherOrigin', origin: 'natural' }), combo)).toBe(true);
    // Equal weights (6 vs 6) are neither heavier nor lighter.
    expect(satisfies(rule('requires', has('b15'), { f: 'relStat', slot: 'binder', stat: 'weight', more: true }), combo)).toBe(false);
    expect(satisfies(rule('requires', has('b15'), { f: 'relStat', slot: 'binder', stat: 'weight', more: false }), combo)).toBe(false);
    expect(satisfies(rule('requires', has('b15'), { f: 'relStat', slot: 'catalyst', stat: 'weight', more: false }), combo)).toBe(true);
    // The other two (demonic, natural) don't share an origin.
    expect(satisfies(rule('requires', has('b15'), { f: 'othersShare', same: true }), combo)).toBe(false);
    expect(satisfies(rule('requires', has('b15'), { f: 'othersShare', same: false }), combo)).toBe(true);
  });
  it('evaluates every connective', () => {
    // total weight 13, total volatility 11
    const over10: Fact = { f: 'total', stat: 'volatility', op: 'over', n: 10 };
    expect(satisfies(rule('requires', over10, { f: 'total', stat: 'weight', op: 'over', n: 12 }), combo)).toBe(true);
    expect(satisfies(rule('requires', over10, { f: 'total', stat: 'weight', op: 'over', n: 13 }), combo)).toBe(false);
    const yes: Fact = { f: 'origin', slot: 'base', origin: 'spectral' };
    const no: Fact = { f: 'totalParity', stat: 'weight', even: true };
    expect(satisfies(rule('either', yes, no), combo)).toBe(true);
    expect(satisfies(rule('xor', yes, no), combo)).toBe(true);
    expect(satisfies(rule('iff', yes, no), combo)).toBe(false);
    expect(satisfies(rule('excludes', yes, { f: 'origin', slot: 'binder', origin: 'natural' }), combo)).toBe(false);
  });
  it('counts every tied component at a rank', () => {
    // Weights 6, 1, 6: base and binder are both heaviest.
    const heaviest = (prop: RankProp): ClueSpec => ({ kind: 'rank', stat: 'weight', pos: 'top', prop });
    expect(satisfies(heaviest({ p: 'origin', origin: 'spectral', is: true }), combo)).toBe(false);
    expect(satisfies(heaviest({ p: 'origin', origin: 'demonic', is: false }), combo)).toBe(true);
    expect(satisfies(heaviest({ p: 'slot', slot: 'base', is: false }), combo)).toBe(false);
    expect(satisfies(heaviest({ p: 'alsoRank', pos2: 'top', is: true }), combo)).toBe(false); // binder isn't most volatile
    expect(satisfies(heaviest({ p: 'share', same: false }), combo)).toBe(true);
    expect(satisfies(heaviest({ p: 'outweighs', is: false }), combo)).toBe(true);
    expect(satisfies({ kind: 'rank', stat: 'weight', pos: 'bottom', prop: { p: 'origin', origin: 'demonic', is: true } }, combo)).toBe(true);
    // Volatilities 9, 1, 1: catalyst (demonic) and binder (natural) are both least volatile.
    const vol = (prop: RankProp): ClueSpec => ({ kind: 'rank', stat: 'volatility', pos: 'top', prop });
    expect(satisfies(vol({ p: 'share', same: false }), combo)).toBe(true);
    expect(satisfies(vol({ p: 'share', same: true }), combo)).toBe(false);
    expect(satisfies(vol({ p: 'spread', op: 'atLeast', n: 8 }), combo)).toBe(true);
  });
  it('treats "any <origin> component" clues as vacuous when there is none', () => {
    const any = (origin: Origin, must: boolean, prop: AnyProp): ClueSpec => ({ kind: 'anyOrigin', origin, must, prop });
    expect(satisfies(any('natural', true, { p: 'bound', stat: 'weight', op: 'over', n: 5 }), combo)).toBe(true);
    expect(satisfies(any('natural', true, { p: 'vsSlot', slot: 'catalyst', stat: 'weight' }), combo)).toBe(true);
    // A natural binder isn't compared with itself.
    expect(satisfies(any('natural', true, { p: 'vsSlot', slot: 'binder', stat: 'weight' }), combo)).toBe(true);
    expect(satisfies(any('demonic', false, { p: 'vsOrigin', other: 'natural', stat: 'weight' }), combo)).toBe(true);
    expect(satisfies(any('demonic', true, { p: 'vsOrigin', other: 'natural', stat: 'weight' }), combo)).toBe(false);
    expect(satisfies(any('draconic', true, { p: 'bound', stat: 'weight', op: 'over', n: 9 }), combo)).toBe(true);
  });
  it('reads naturally', () => {
    expect(describe(rule('excludes', has('b15'), { f: 'otherOrigin', origin: 'natural' }))).toBe(
      'Mindwretch Resin cannot be paired with a natural ingredient.',
    );
    expect(describe(rule('requires', has('b08'), { f: 'relStat', slot: 'binder', stat: 'weight', more: true }))).toBe(
      'Contract Ink must be paired with a heavier binder.',
    );
    expect(describe(rule('requires', has('b08'), { f: 'origin', slot: 'binder', origin: 'natural' }))).toBe(
      'Contract Ink must be paired with a natural binder.',
    );
    expect(describe(rule('requires', has('b11'), { f: 'total', stat: 'weight', op: 'under', n: 10 }))).toBe(
      'Fire Solution requires a total weight under 10.',
    );
    expect(describe(rule('requires', has('c15'), { f: 'othersShare', same: true }))).toBe(
      'Scale Knot requires two other components of the same origin.',
    );
    expect(
      describe(rule('requires', { f: 'total', stat: 'volatility', op: 'over', n: 10 }, { f: 'total', stat: 'weight', op: 'over', n: 12 })),
    ).toBe('A total volatility over 10 requires a total weight over 12.');
    expect(
      describe(rule('excludes', { f: 'origin', slot: 'base', origin: 'natural' }, { f: 'slotStat', slot: 'binder', stat: 'volatility', op: 'over', n: 7 })),
    ).toBe('A natural base cannot be paired with a binder more volatile than 7.');
    expect(describe(rule('iff', { f: 'origin', slot: 'base', origin: 'natural' }, { f: 'cmp', a: 'catalyst', b: 'binder', stat: 'weight', strict: true }))).toBe(
      'The base is natural if and only if the catalyst is heavier than the binder.',
    );
    expect(describe({ kind: 'rank', stat: 'volatility', pos: 'top', prop: { p: 'origin', origin: 'spectral', is: false } })).toBe(
      'The most volatile component cannot be spectral.',
    );
    expect(describe({ kind: 'rank', stat: 'weight', pos: 'top', prop: { p: 'share', same: false } })).toBe(
      'The heaviest and lightest components cannot share an origin.',
    );
    expect(describe({ kind: 'anyOrigin', origin: 'natural', must: false, prop: { p: 'vsSlot', slot: 'binder', stat: 'weight' } })).toBe(
      'Any natural component cannot be heavier than the binder.',
    );
    expect(describe({ kind: 'anyOrigin', origin: 'artificial', must: false, prop: { p: 'vsOrigin', other: 'natural', stat: 'weight' } })).toBe(
      'No artificial component can be heavier than a natural component.',
    );
    expect(describe({ kind: 'shareFraction', slot: 'base', stat: 'weight', ifOrigin: 'natural', moreThan: false, den: 3 })).toBe(
      'A natural base cannot account for more than a third of the total weight.',
    );
    expect(describe({ kind: 'extreme', slot: 'catalyst', stat: 'weight', most: true, strict: false })).toBe(
      'The catalyst is no lighter than any other component.',
    );
  });
  it('agrees verbs with plural ingredient names', () => {
    expect(ingredient('b20').plural).toBe(true);
    expect(describe({ kind: 'excluded', id: 'b20' })).toBe('Songstone Shards are not in the potion.');
    expect(describe(rule('requires', has('b20'), { f: 'total', stat: 'weight', op: 'under', n: 10 }))).toBe(
      'Songstone Shards require a total weight under 10.',
    );
    expect(describe(rule('either', has('b20'), { f: 'origin', slot: 'binder', origin: 'spectral' }))).toBe(
      'At least one of these is true: Songstone Shards are in the potion, or the binder is spectral.',
    );
    expect(describe(rule('either', has('b15'), { f: 'origin', slot: 'binder', origin: 'spectral' }))).toBe(
      'At least one of these is true: Mindwretch Resin is in the potion, or the binder is spectral.',
    );
  });
});

group('generator', () => {
  it('is deterministic for a seed', () => {
    expect(generatePuzzle(7).puzzle).toEqual(generatePuzzle(7).puzzle);
  });
  it('produces valid puzzles across the difficulty range', () => {
    for (const target of [5, 10, 15, 20, 25, 30]) {
      const { puzzle } = generatePuzzle(1, 1000 + target, target);
      checkPuzzle(puzzle);
      expect(Math.abs(puzzle.intensity - target)).toBeLessThanOrEqual(2);
    }
  }, 30_000);
  it('the full clue list always pins down one potion', () => {
    const { puzzle } = generatePuzzle(3);
    expect(remaining(allCombos(puzzle.available), puzzle.clues)).toHaveLength(1);
  });
});

group('published puzzles', () => {
  const dir = join(import.meta.dirname, '..', 'public', 'puzzles');
  const files = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f));
  it('exist', () => expect(files.length).toBeGreaterThan(0));
  it('are all still valid against the current roster and clue rules', () => {
    for (const f of files) {
      const p = JSON.parse(readFileSync(join(dir, f), 'utf8')) as PuzzleData;
      expect(p.number).toBe(Number(f.replace('.json', '')));
      checkPuzzle(p);
    }
  });
  it('include some duds, more often on harder days', () => {
    const dudRate = (lo: number, hi: number) => {
      let duds = 0;
      let puzzles = 0;
      for (const f of files) {
        const p = JSON.parse(readFileSync(join(dir, f), 'utf8')) as PuzzleData;
        if (p.intensity < lo || p.intensity > hi) continue;
        const a = analyse(p);
        puzzles++;
        for (let i = 1; i < a.minClues; i++) if (a.counts[i] === a.counts[i - 1]) duds++;
      }
      return duds / puzzles;
    };
    expect(dudRate(5, 30)).toBeGreaterThan(0);
    expect(dudRate(16, 30)).toBeGreaterThan(dudRate(5, 10));
  });
});
