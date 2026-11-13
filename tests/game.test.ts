import { describe, expect, it } from 'vitest';
import { puzzleNumberFor } from '../src/game/date';
import { bucketFor, computeStats } from '../src/game/stats';
import type { DayRecord, SaveFile } from '../src/game/storage';

const day = (status: DayRecord['status'], revealed = 4, minClues = 4): DayRecord => ({
  revealed,
  minClues,
  status,
  crossed: [],
  placed: {},
});

describe('puzzle numbering', () => {
  it('starts at 1 on the epoch and counts local days', () => {
    expect(puzzleNumberFor(new Date(2026, 10, 13, 0, 1))).toBe(1);
    expect(puzzleNumberFor(new Date(2026, 10, 13, 23, 59))).toBe(1);
    expect(puzzleNumberFor(new Date(2026, 10, 14, 0, 0))).toBe(2);
    expect(puzzleNumberFor(new Date(2027, 10, 13, 12))).toBe(366);
  });
});

describe('stats', () => {
  it('buckets results against the minimum', () => {
    expect(bucketFor('won', 3, 4)).toBe('Under');
    expect(bucketFor('won', 4, 4)).toBe('Minimum');
    expect(bucketFor('won', 6, 4)).toBe('+2');
    expect(bucketFor('won', 12, 4)).toBe('+4 or more');
    expect(bucketFor('lost', 2, 4)).toBe('Failed');
  });

  it('tracks streaks, letting an unfinished today keep yesterday’s streak', () => {
    const save: SaveFile = {
      version: 1,
      days: { 1: day('won'), 2: day('won'), 3: day('lost'), 5: day('won'), 6: day('won', 5), 7: day('playing') },
    };
    const s = computeStats(save, 7);
    expect(s.played).toBe(5);
    expect(s.won).toBe(4);
    expect(s.winRate).toBe(80);
    expect(s.currentStreak).toBe(2);
    expect(s.bestStreak).toBe(2);
    expect(s.distribution.Minimum).toBe(3);
    expect(s.distribution['+1']).toBe(1);
    expect(s.distribution.Failed).toBe(1);
  });

  it('resets the current streak after a loss today or a missed day', () => {
    expect(computeStats({ version: 1, days: { 1: day('won'), 2: day('lost') } }, 2).currentStreak).toBe(0);
    expect(computeStats({ version: 1, days: { 1: day('won') } }, 3).currentStreak).toBe(0);
  });
});
