import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe as group, expect, it } from 'vitest';
import { clueLevel, describe, satisfies } from '../src/engine/clues';
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
  it('treats pairing clues as vacuous when the ingredient is absent', () => {
    expect(satisfies({ kind: 'pairing', id: 'b15', slot: 'binder', origin: 'natural', only: false }, combo)).toBe(false);
    expect(satisfies({ kind: 'pairing', id: 'b02', slot: 'binder', origin: 'natural', only: false }, combo)).toBe(true);
  });
  it('evaluates proportional clues', () => {
    // total weight 13; base 6 → more than a third, less than half
    expect(satisfies({ kind: 'shareFraction', slot: 'base', stat: 'weight', ifOrigin: null, moreThan: true, den: 3 }, combo)).toBe(true);
    expect(satisfies({ kind: 'shareFraction', slot: 'base', stat: 'weight', ifOrigin: null, moreThan: true, den: 2 }, combo)).toBe(false);
    expect(satisfies({ kind: 'shareFraction', slot: 'base', stat: 'weight', ifOrigin: 'natural', moreThan: true, den: 2 }, combo)).toBe(true);
  });
  it('reads naturally', () => {
    expect(describe({ kind: 'pairing', id: 'b15', slot: 'binder', origin: 'natural', only: false })).toBe(
      'Mindwretch Resin cannot be paired with a natural binder.',
    );
    expect(describe({ kind: 'shareFraction', slot: 'base', stat: 'weight', ifOrigin: 'natural', moreThan: false, den: 3 })).toBe(
      'A natural base cannot account for more than a third of the total weight.',
    );
    expect(describe({ kind: 'extreme', slot: 'catalyst', stat: 'weight', most: true, strict: false })).toBe(
      'The catalyst is no lighter than any other component.',
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
  });
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
