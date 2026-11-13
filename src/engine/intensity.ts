import { clueLevel, type ClueSpec } from './clues';

/*
 * Intensity Rank (5–30): how hard a puzzle is to reason through.
 *
 * Each clue the solver has to combine adds weight, and abstract clues add more
 * (level 1 = 1.8, level 5 = 3.0). Bigger ingredient sets add a little on top,
 * since there's more to eliminate. Only clues up to the minimum count:
 * anything later is extra help.
 */

export const MIN_RANK = 5;
export const MAX_RANK = 30;

/** Smallest search space (6 × 6 × 6); bigger spaces add to the rank. */
const BASELINE_SPACE = Math.log2(6 * 6 * 6);

export function clueWeight(level: number): number {
  return 1.5 + 0.3 * level;
}

export function spaceLoad(comboCount: number): number {
  return 0.8 * Math.max(0, Math.log2(comboCount) - BASELINE_SPACE);
}

export function rawIntensity(cluesToMinimum: readonly ClueSpec[], comboCount: number): number {
  const clueLoad = cluesToMinimum.reduce((sum, c) => sum + clueWeight(clueLevel(c)), 0);
  return clueLoad + spaceLoad(comboCount);
}

export function intensityRank(cluesToMinimum: readonly ClueSpec[], comboCount: number): number {
  const raw = rawIntensity(cluesToMinimum, comboCount);
  return Math.min(MAX_RANK, Math.max(MIN_RANK, Math.round(raw)));
}
