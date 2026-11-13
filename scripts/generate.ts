/**
 * Pre-generates daily puzzles into public/puzzles/<number>.json.
 *
 *   npm run generate                 # fills in any missing puzzles 1..365
 *   npm run generate -- --to 730     # extend the run
 *   npm run generate -- --from 40 --to 45 --force   # regenerate specific days
 *
 * Existing files are never touched without --force, so puzzles that players
 * have already seen stay fixed even if the generator changes.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_PUZZLE_COUNT } from '../src/config';
import { generatePuzzle } from '../src/engine/generator';
import { analyse } from '../src/engine/puzzle';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const from = Number(flag('from') ?? 1);
const to = Number(flag('to') ?? DEFAULT_PUZZLE_COUNT);
const force = args.includes('--force');

const dir = join(import.meta.dirname, '..', 'public', 'puzzles');
mkdirSync(dir, { recursive: true });

let written = 0;
for (let n = from; n <= to; n++) {
  const file = join(dir, `${n}.json`);
  if (existsSync(file) && !force) continue;
  const { puzzle } = generatePuzzle(n);
  analyse(puzzle); // throws if the puzzle is somehow not uniquely solvable
  writeFileSync(file, JSON.stringify(puzzle) + '\n');
  written++;
}
console.log(`Wrote ${written} puzzle(s) to public/puzzles (range ${from}–${to}${force ? ', forced' : ''}).`);
