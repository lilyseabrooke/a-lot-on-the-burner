import type { SaveFile } from './storage';

export const BUCKETS = ['Under', 'Minimum', '+1', '+2', '+3', '+4 or more', 'Failed'] as const;
export type Bucket = (typeof BUCKETS)[number];

export interface Stats {
  played: number;
  won: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  distribution: Record<Bucket, number>;
}

export function bucketFor(status: 'won' | 'lost', revealed: number, minClues: number): Bucket {
  if (status === 'lost') return 'Failed';
  const over = revealed - minClues;
  if (over < 0) return 'Under';
  if (over === 0) return 'Minimum';
  if (over >= 4) return '+4 or more';
  return `+${over}` as Bucket;
}

export function computeStats(save: SaveFile, today: number): Stats {
  const distribution = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>;
  let played = 0;
  let won = 0;
  const finished = Object.entries(save.days)
    .map(([n, d]) => ({ n: Number(n), d }))
    .filter(({ d }) => d.status !== 'playing')
    .sort((a, b) => a.n - b.n);

  let bestStreak = 0;
  let run = 0;
  let prev = -Infinity;
  for (const { n, d } of finished) {
    played++;
    if (d.status === 'won') won++;
    distribution[bucketFor(d.status as 'won' | 'lost', d.revealed, d.minClues ?? d.revealed)]++;
    if (d.status === 'won') {
      run = n === prev + 1 ? run + 1 : 1;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
    prev = n;
  }

  // The current streak survives until a day is lost or skipped; today being unfinished doesn't break it.
  let currentStreak = 0;
  let day = save.days[today]?.status === 'playing' || !save.days[today] ? today - 1 : today;
  while (save.days[day]?.status === 'won') {
    currentStreak++;
    day--;
  }

  return { played, won, winRate: played ? Math.round((won / played) * 100) : 0, currentStreak, bestStreak, distribution };
}
