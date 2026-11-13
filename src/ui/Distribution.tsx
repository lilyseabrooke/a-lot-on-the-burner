import { animate, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { BUCKETS, type Bucket, type Stats } from '../game/stats';
import { spring } from './motion';

/** Counts up from zero when it first appears. */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [value]);
  return (
    <>
      {shown}
      {suffix}
    </>
  );
}

/** Single-series horizontal bars: one accent hue, today's bucket picked out, counts labelled directly. */
export function Distribution({ stats, highlight }: { stats: Stats; highlight?: Bucket }) {
  const max = Math.max(1, ...BUCKETS.map((b) => stats.distribution[b]));
  return (
    <figure className="distribution">
      <figcaption className="eyebrow">Clues used against the minimum</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Result</th>
            <th>Days</th>
          </tr>
        </thead>
        <tbody>
          {BUCKETS.map((b) => (
            <tr key={b}>
              <td>{b}</td>
              <td>{stats.distribution[b]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dist-rows" aria-hidden>
        {BUCKETS.map((b, i) => {
          const value = stats.distribution[b];
          return (
            <div key={b} className={`dist-row${b === highlight ? ' is-today' : ''}`}>
              <span className="dist-label">{b}</span>
              <span className="dist-track">
                <motion.span
                  className="dist-bar"
                  initial={{ width: 0 }}
                  animate={{ width: value ? `${Math.max(6, (value / max) * 100)}%` : 0 }}
                  transition={{ ...spring.gentle, delay: 0.15 + i * 0.05 }}
                />
                <span className="dist-value">{value}</span>
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

export function StatTiles({ stats }: { stats: Stats }) {
  const tiles = [
    { label: 'Played', value: stats.played },
    { label: 'Win %', value: stats.winRate },
    { label: 'Streak', value: stats.currentStreak },
    { label: 'Best', value: stats.bestStreak },
  ];
  return (
    <dl className="stat-tiles">
      {tiles.map((t, i) => (
        <motion.div
          key={t.label}
          className="stat-tile"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.bouncy, delay: i * 0.05 }}
        >
          <dd>
            <CountUp value={t.value} />
          </dd>
          <dt>{t.label}</dt>
        </motion.div>
      ))}
    </dl>
  );
}
