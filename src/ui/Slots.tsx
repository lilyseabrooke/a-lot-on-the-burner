import { Check, X } from 'lucide-react';
import { motion } from 'motion/react';
import { ingredient } from '../engine/roster';
import { SLOTS, type Combo, type Slot } from '../engine/types';
import type { DayRecord } from '../game/storage';
import { PRESS_SCALE, spring } from './motion';
import { Tile } from './Tile';

/** Seconds between each slot flipping over after a brew. */
export const FLIP_STAGGER = 0.38;

interface Props {
  record: DayRecord;
  solution: Combo;
  activeTab: Slot;
  /** The slot an ingredient is being dragged over, and whether it accepts it. */
  hover: { slot: Slot; ok: boolean } | null;
  /** Slot the dragged ingredient belongs to, so its well can light up. */
  dragSlot: Slot | null;
  /** True right after brewing: play the flip sequence instead of showing results instantly. */
  flipping: boolean;
  register: (slot: Slot, el: HTMLDivElement | null) => void;
  onRemove: (slot: Slot) => void;
  onSelect: (slot: Slot) => void;
}

export function Slots({ record, solution, activeTab, hover, dragSlot, flipping, register, onRemove, onSelect }: Props) {
  const finished = record.status !== 'playing';
  return (
    <div className="slots" role="group" aria-label="Your potion">
      {SLOTS.map((slot, i) => {
        const id = record.placed[slot];
        const ing = id ? ingredient(id) : null;
        const verdict = finished ? (id === solution[slot].id ? 'correct' : 'wrong') : undefined;
        const cls = [
          'slot',
          ing && 'is-filled',
          !finished && activeTab === slot && 'is-active',
          dragSlot === slot && 'is-target',
          hover?.slot === slot && (hover.ok ? 'is-over' : 'is-refusing'),
          verdict && `is-${verdict}`,
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <motion.div
            key={slot}
            ref={(el) => register(slot, el)}
            className={cls}
            initial={false}
            animate={
              finished && flipping
                ? { rotateX: [0, 90, 0], transition: { duration: 0.5, delay: i * FLIP_STAGGER, times: [0, 0.5, 1] } }
                : { rotateX: 0, scale: hover?.slot === slot && hover.ok ? 1.04 : 1 }
            }
            transition={spring.bouncy}
          >
            <span className="slot-label">
              {slot}
              {verdict &&
                (verdict === 'correct' ? <Check size={12} strokeWidth={3} aria-label="correct" /> : <X size={12} strokeWidth={3} aria-label="incorrect" />)}
            </span>
            {ing ? (
              <Tile ingredient={ing} slotted locked={finished} verdict={verdict} onPress={() => onRemove(slot)} />
            ) : (
              <motion.button
                type="button"
                className="slot-empty"
                disabled={finished}
                onClick={() => onSelect(slot)}
                whileTap={{ scale: PRESS_SCALE }}
                transition={spring.snappy}
                aria-label={`Empty ${slot} slot. Show ${slot}s`}
              >
                <span aria-hidden>+</span>
              </motion.button>
            )}
            {verdict && (
              <motion.span
                className="slot-verdict"
                aria-hidden
                initial={flipping ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ delay: flipping ? i * FLIP_STAGGER + 0.25 : 0, duration: 0.01 }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
