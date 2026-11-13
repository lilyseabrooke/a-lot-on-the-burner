import { BUCKETS, type Bucket, type Stats } from '../game/stats';

/** Single-series horizontal bars: one gold hue, today's bucket picked out, counts labelled directly. */
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
        {BUCKETS.map((b) => {
          const value = stats.distribution[b];
          return (
            <div key={b} className={`dist-row${b === highlight ? ' is-today' : ''}`}>
              <span className="dist-label">{b}</span>
              <span className="dist-track">
                <span className="dist-bar" style={{ width: value ? `${Math.max(4, (value / max) * 100)}%` : 0 }} />
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
    { label: 'Best streak', value: stats.bestStreak },
  ];
  return (
    <dl className="stat-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="stat-tile">
          <dd>{t.value}</dd>
          <dt>{t.label}</dt>
        </div>
      ))}
    </dl>
  );
}
