/**
 * Debug tool: makes a brand-new puzzle at a specified Intensity Rank and prints it.
 *
 *   npm run puzzle -- --rank 18                 # new random puzzle at rank 18
 *   npm run puzzle -- --rank 18 --seed 42       # reproducible: same seed, same puzzle
 *   npm run puzzle -- --rank 18 --json          # also print the stored JSON
 *   npm run puzzle -- --rank 18 --write 400     # save as public/puzzles/400.json
 *   npm run puzzle -- --rank 18 --write 400 --force   # overwrite an existing file
 *
 * The generator aims at a rank but can land off it, so this retries with fresh seeds
 * until the rank matches exactly (up to --tries, default 200). If none match, it
 * reports the closest one and exits non-zero unless --allow-miss is passed.
 *
 * Without --write nothing on disk changes. The puzzle's answer is printed here for
 * debugging even though it is never stored in the file.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe } from '../src/engine/clues';
import { generatePuzzle } from '../src/engine/generator';
import { MAX_RANK, MIN_RANK, rawIntensity } from '../src/engine/intensity';
import { allCombos, analyse, type PuzzleData } from '../src/engine/puzzle';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name: string) => args.includes(`--${name}`);

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const rankArg = flag('rank');
if (rankArg === undefined) {
  fail(`Usage: npm run puzzle -- --rank <${MIN_RANK}-${MAX_RANK}> [--seed N] [--tries N] [--write N [--force]] [--json] [--allow-miss]`);
}
const rank = Number(rankArg);
if (!Number.isInteger(rank) || rank < MIN_RANK || rank > MAX_RANK) {
  fail(`--rank must be a whole number from ${MIN_RANK} to ${MAX_RANK} (got "${rankArg}").`);
}

const parseInt0 = (name: string, fallback: number, min: number) => {
  const raw = flag(name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) fail(`--${name} must be a whole number of at least ${min} (got "${raw}").`);
  return n;
};
const tries = parseInt0('tries', 200, 1);
const writeTo = has('write') ? parseInt0('write', NaN, 1) : undefined;
if (has('write') && (writeTo === undefined || Number.isNaN(writeTo))) fail('--write needs a puzzle number, e.g. --write 400.');

// A random base seed unless one is given; attempt i uses baseSeed + i, so a run is reproducible from the printed seed.
const baseSeed = parseInt0('seed', Math.floor(Math.random() * 2 ** 31), 0);
const number = writeTo ?? 0;

let best: ReturnType<typeof generatePuzzle> | null = null;
let bestSeed = baseSeed;
let used = 0;
for (let i = 0; i < tries; i++) {
  used = i + 1;
  const seed = (baseSeed + i) >>> 0;
  let result;
  try {
    result = generatePuzzle(number, seed, rank);
  } catch {
    continue; // generator gave up on this seed; try the next
  }
  if (!best || Math.abs(result.puzzle.intensity - rank) < Math.abs(best.puzzle.intensity - rank)) {
    best = result;
    bestSeed = seed;
  }
  if (result.puzzle.intensity === rank) break;
}
if (!best) fail(`Could not generate any puzzle in ${tries} tries. Try a different --seed.`);
const { puzzle, minClues } = best!;
const hit = puzzle.intensity === rank;

// Re-derive everything from the stored form, exactly as the client will.
const analysis = analyse(puzzle);
if (analysis.minClues !== minClues) fail('Internal error: minimum clue count mismatch.');
const space = allCombos(puzzle.available).length;
const raw = rawIntensity(puzzle.clues.slice(0, analysis.minClues), space);
const { solution } = analysis;

console.log(`Intensity Rank ${puzzle.intensity} (requested ${rank})${hit ? '' : '  *** MISSED THE REQUESTED RANK ***'}`);
console.log(`seed ${bestSeed}  ·  attempts ${used}  ·  raw intensity ${raw.toFixed(2)}`);
console.log(
  `shelf ${puzzle.available.base.length} × ${puzzle.available.catalyst.length} × ${puzzle.available.binder.length} = ${space} potions`,
);
console.log(`minimum ${analysis.minClues} clues of ${puzzle.clues.length}`);
console.log(`answer  ${solution.base.name} + ${solution.catalyst.name} + ${solution.binder.name}`);
console.log('');
puzzle.clues.forEach((clue, k) => {
  const prev = k === 0 ? space : analysis.counts[k - 1];
  const left = analysis.counts[k];
  const isMin = k + 1 === analysis.minClues;
  const dud = k > 0 && k < analysis.minClues && left === prev;
  const marker = isMin ? '*' : ' ';
  const tag = isMin ? '  [minimum]' : dud ? '  [dud: rules nothing out]' : k >= analysis.minClues ? '  [helper]' : '';
  console.log(`${String(k + 1).padStart(2)}${marker} ${String(left).padStart(4)} left  ${describe(clue)}${tag}`);
});

if (has('json')) {
  console.log('');
  console.log(JSON.stringify(puzzle));
}

if (!hit && !has('allow-miss')) {
  console.error(`\nNo puzzle at exactly rank ${rank} in ${used} tries (closest: ${puzzle.intensity}). Raise --tries, change --seed, or pass --allow-miss.`);
  process.exit(2); // nothing is written for a miss
}

if (writeTo !== undefined) {
  const dir = join(import.meta.dirname, '..', 'public', 'puzzles');
  const file = join(dir, `${writeTo}.json`);
  if (existsSync(file) && !has('force')) {
    fail(`\n${file} already exists. Pass --force to overwrite it.`);
  }
  mkdirSync(dir, { recursive: true });
  const stored: PuzzleData = { ...puzzle, number: writeTo };
  writeFileSync(file, JSON.stringify(stored) + '\n');
  console.log(`\nWrote public/puzzles/${writeTo}.json`);
}
