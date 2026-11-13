/**
 * Generates a batch of puzzles in memory and prints how the targets, Intensity
 * Ranks and minimum clue counts come out. Use it when tuning the generator.
 *   npm run calibrate -- 300
 */
import { describe } from '../src/engine/clues';
import { generatePuzzle } from '../src/engine/generator';
import { analyse } from '../src/engine/puzzle';

const count = Number(process.argv[2] ?? 200);
const rows: { target: number; rank: number; min: number; space: number }[] = [];
const started = Date.now();
for (let i = 1; i <= count; i++) {
  const { puzzle, target, minClues } = generatePuzzle(10_000 + i);
  const a = analyse(puzzle);
  if (a.minClues !== minClues) throw new Error('minimum mismatch');
  const space = puzzle.available.base.length * puzzle.available.catalyst.length * puzzle.available.binder.length;
  rows.push({ target, rank: puzzle.intensity, min: minClues, space });
  if (i <= 3) {
    console.log(`\n#${i} target ${target} rank ${puzzle.intensity} min ${minClues} space ${space}`);
    puzzle.clues.forEach((c, k) => console.log(`  ${k + 1}${k + 1 === minClues ? '*' : ' '} ${describe(c)}`));
  }
}
const ms = Date.now() - started;
const hist = (key: 'rank' | 'min') => {
  const m = new Map<number, number>();
  rows.forEach((r) => m.set(r[key], (m.get(r[key]) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join('  ');
};
const miss = rows.filter((r) => Math.abs(r.rank - r.target) > 1).length;
console.log(`\n${count} puzzles in ${ms}ms (${(ms / count).toFixed(0)}ms each)`);
console.log(`rank histogram: ${hist('rank')}`);
console.log(`min-clue histogram: ${hist('min')}`);
console.log(`missed target by >1: ${miss}`);
const byBand = [5, 11, 16, 21, 26].map((lo, i, arr) => {
  const hi = arr[i + 1] ? arr[i + 1] - 1 : 30;
  const band = rows.filter((r) => r.rank >= lo && r.rank <= hi);
  const avg = (f: (r: (typeof rows)[0]) => number) => (band.reduce((s, r) => s + f(r), 0) / (band.length || 1)).toFixed(1);
  return `${lo}-${hi}: n=${band.length} avgMin=${avg((r) => r.min)} avgSpace=${avg((r) => r.space)}`;
});
console.log(byBand.join('\n'));
