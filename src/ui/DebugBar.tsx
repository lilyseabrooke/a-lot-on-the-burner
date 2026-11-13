import { Bug, Dices, Undo2 } from 'lucide-react';
import { motion } from 'motion/react';
import { MAX_RANK, MIN_RANK } from '../engine/intensity';
import { fx } from './fx';
import { PRESS_SCALE, spring } from './motion';

interface Props {
  rank: number;
  onRank: (rank: number) => void;
  /** True while a sample puzzle is being brewed. */
  busy: boolean;
  /** True while a sample (not the daily puzzle) is on screen. */
  inSample: boolean;
  /** Set when the last sample could not hit the chosen rank exactly. */
  missedWith?: number;
  error?: string;
  onNew: () => void;
  onBackToDaily: () => void;
}

/** Debug-only strip: pick an Intensity Rank, press the button, play a throwaway puzzle at that rank. */
export function DebugBar({ rank, onRank, busy, inSample, missedWith, error, onNew, onBackToDaily }: Props) {
  return (
    <div className="debug-bar" role="region" aria-label="Debug: sample puzzles">
      <Bug size={15} aria-hidden className="debug-icon" />
      <label className="debug-rank">
        <span className="debug-rank-label">Rank</span>
        <output className="debug-rank-value">{rank}</output>
        <input
          type="range"
          min={MIN_RANK}
          max={MAX_RANK}
          step={1}
          value={rank}
          aria-label="Intensity Rank for the next sample puzzle"
          onChange={(e) => onRank(Number(e.target.value))}
        />
      </label>
      <motion.button
        type="button"
        className="debug-button primary"
        onClick={() => {
          fx('tap');
          onNew();
        }}
        disabled={busy}
        whileTap={{ scale: PRESS_SCALE }}
        transition={spring.snappy}
      >
        <Dices size={16} aria-hidden />
        {busy ? 'Brewing…' : 'New puzzle'}
      </motion.button>
      {inSample && (
        <motion.button
          type="button"
          className="debug-button"
          onClick={() => {
            fx('tap');
            onBackToDaily();
          }}
          aria-label="Back to today's puzzle"
          title="Back to today's puzzle"
          whileTap={{ scale: PRESS_SCALE }}
          transition={spring.snappy}
        >
          <Undo2 size={16} aria-hidden />
        </motion.button>
      )}
      {(missedWith !== undefined || error) && (
        <p className="debug-note" role="status">
          {error ?? `No exact match found; closest is rank ${missedWith}.`}
        </p>
      )}
    </div>
  );
}
