import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ingredient } from '../engine/roster';
import { SLOTS, type Combo } from '../engine/types';
import { formatCountdown, msUntilLocalMidnight } from '../game/date';
import { bucketFor, type Stats } from '../game/stats';
import type { DayRecord } from '../game/storage';
import { Distribution, StatTiles } from './Distribution';
import { spring } from './motion';
import { OriginGlyph } from './origins';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  number: number;
  intensity: number;
  record: DayRecord;
  solution: Combo;
  minClues: number;
  stats: Stats;
}

function verdict(used: number, min: number): string {
  const over = used - min;
  if (over < 0) return `${used} clue${used === 1 ? '' : 's'}, before the minimum of ${min}. Galobalo’s luck.`;
  if (over === 0) return `${used} clues: perfect breakthrough.`;
  return `${used} clues. The breakthrough was at ${min}, so you used ${over} extra.`;
}

function Countdown() {
  const [ms, setMs] = useState(() => msUntilLocalMidnight(new Date()));
  useEffect(() => {
    const t = setInterval(() => setMs(msUntilLocalMidnight(new Date())), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="countdown">
      <span className="eyebrow">Next request coming in</span>
      <span className="countdown-value">{formatCountdown(ms)}</span>
    </p>
  );
}

export function ResultSheet({ open, onClose, number, intensity, record, solution, minClues, stats }: Props) {
  if (record.status === 'playing') return null;
  const won = record.status === 'won';
  return (
    <Sheet open={open} onClose={onClose} eyebrow={`Vial ${number} · Rank ${intensity}`} title={won ? 'Spectral' : 'Sparked out'}>
      <div className="result">
        <motion.p
          className={`result-verdict ${won ? 'is-won' : 'is-lost'}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring.bouncy}
        >
          {won ? verdict(record.revealed, minClues) : `The breakthrough was at clue ${minClues}. You brewed after ${record.revealed}.`}
        </motion.p>
        {!won && (
          <div className="result-recipe" aria-label="The recipe">
            {SLOTS.map((slot, i) => {
              const ing = solution[slot];
              const guessed = record.guess?.[i];
              return (
                <motion.div
                  key={slot}
                  className={`recipe-chip ${guessed === ing.id ? 'is-correct' : 'is-wrong'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.bouncy, delay: 0.1 + i * 0.06 }}
                >
                  <span className="eyebrow">{slot}</span>
                  <span className="recipe-name">{ing.name}</span>
                  <OriginGlyph origin={ing.origin} />
                  {guessed !== ing.id && guessed && <span className="recipe-guess">You: {ingredient(guessed).name}</span>}
                </motion.div>
              );
            })}
          </div>
        )}
        <StatTiles stats={stats} />
        <Distribution stats={stats} highlight={bucketFor(record.status, record.revealed, minClues)} />
        <Countdown />
      </div>
    </Sheet>
  );
}
