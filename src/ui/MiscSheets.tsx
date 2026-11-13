import { motion } from 'motion/react';
import type { ClueSpec } from '../engine/clues';
import { ingredient } from '../engine/roster';
import { SLOTS, type Slot } from '../engine/types';
import type { Stats } from '../game/stats';
import { ClueList } from './ClueLog';
import { Distribution, StatTiles } from './Distribution';
import { PRESS_SCALE, spring } from './motion';
import { Sheet } from './Sheet';

export function StatsSheet({ open, onClose, stats }: { open: boolean; onClose: () => void; stats: Stats }) {
  return (
    <Sheet open={open} onClose={onClose} eyebrow="Your record" title="Statistics">
      <div className="result">
        <StatTiles stats={stats} />
        <Distribution stats={stats} />
      </div>
    </Sheet>
  );
}

interface ClueProps {
  open: boolean;
  onClose: () => void;
  clues: ClueSpec[];
  revealed: number;
  finished: boolean;
  minClues: number;
  onReveal: () => void;
}

export function CluesSheet({ open, onClose, ...rest }: ClueProps) {
  return (
    <Sheet open={open} onClose={onClose} eyebrow={`${rest.revealed} revealed`} title="Clues">
      <ClueList {...rest} withReveal />
    </Sheet>
  );
}

/** Only reached when the brew button is activated without a hold, e.g. by a screen reader. */
export function ConfirmSheet({
  open,
  onCancel,
  onConfirm,
  placed,
  revealed,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  placed: Partial<Record<Slot, string>>;
  revealed: number;
}) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      eyebrow="One brew only"
      title="Brew this potion?"
      actions={
        <>
          <motion.button type="button" className="button" onClick={onCancel} whileTap={{ scale: PRESS_SCALE }} transition={spring.snappy}>
            Keep thinking
          </motion.button>
          <motion.button type="button" className="button primary" onClick={onConfirm} whileTap={{ scale: PRESS_SCALE }} transition={spring.snappy}>
            Brew
          </motion.button>
        </>
      }
    >
      <dl className="confirm-list">
        {SLOTS.map((slot) => (
          <div key={slot}>
            <dt className="eyebrow">{slot}</dt>
            <dd>{placed[slot] ? ingredient(placed[slot]!).name : '—'}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">
        You have revealed {revealed} clue{revealed === 1 ? '' : 's'}. There is no second attempt.
      </p>
    </Sheet>
  );
}
