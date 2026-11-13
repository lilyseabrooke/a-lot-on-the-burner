import { useEffect, useState } from 'react';
import { ingredient } from '../engine/roster';
import type { Combo } from '../engine/types';
import { formatCountdown, msUntilLocalMidnight } from '../game/date';
import { bucketFor, type Stats } from '../game/stats';
import type { DayRecord } from '../game/storage';
import { Distribution, StatTiles } from './Distribution';
import { Modal } from './Modal';

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
  if (over < 0) return `You brewed it after ${used} clues, before the minimum of ${min}. A bold guess that paid off.`;
  if (over === 0) return `You brewed it after ${used} clues, exactly the minimum.`;
  return `You brewed it after ${used} clues. The minimum was ${min}, so you used ${over} more than you needed.`;
}

function Countdown() {
  const [ms, setMs] = useState(() => msUntilLocalMidnight(new Date()));
  useEffect(() => {
    const t = setInterval(() => setMs(msUntilLocalMidnight(new Date())), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="countdown">
      <span className="eyebrow">Next potion in</span>
      <span className="countdown-value">{formatCountdown(ms)}</span>
    </p>
  );
}

export function ResultModal({ open, onClose, number, intensity, record, solution, minClues, stats }: Props) {
  if (record.status === 'playing') return null;
  const won = record.status === 'won';
  const answer = [solution.base, solution.catalyst, solution.binder];
  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`No. ${number} · Intensity Rank ${intensity}`}
      title={won ? 'The potion holds' : 'The potion curdles'}
    >
      <div className="prose">
        {won ? (
          <p>{verdict(record.revealed, minClues)}</p>
        ) : (
          <>
            <p>
              The recipe was{' '}
              {answer.map((ing, i) => (
                <span key={ing.id}>
                  <strong>{ing.name}</strong>
                  {i < 2 ? ' · ' : '.'}
                </span>
              ))}
            </p>
            <p>
              You brewed {record.guess?.map((id) => ingredient(id).name).join(' · ')} after {record.revealed} clue
              {record.revealed === 1 ? '' : 's'}. Only one potion fit after clue {minClues}.
            </p>
          </>
        )}
      </div>
      <StatTiles stats={stats} />
      <Distribution stats={stats} highlight={bucketFor(record.status, record.revealed, minClues)} />
      <Countdown />
    </Modal>
  );
}
