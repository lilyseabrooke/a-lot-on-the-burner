import { motion, type PanInfo } from 'motion/react';
import { useRef } from 'react';
import type { Ingredient } from '../engine/types';
import { fx } from './fx';
import { PRESS_SCALE, spring } from './motion';
import { OriginGlyph, StatPair } from './origins';

const LONG_PRESS_MS = 420;

interface Props {
  ingredient: Ingredient;
  crossed?: boolean;
  locked?: boolean;
  /** Rendered inside a slot rather than on the shelf. */
  slotted?: boolean;
  /** Slot result once the day is over. */
  verdict?: 'correct' | 'wrong';
  onPress: () => void;
  onLongPress?: () => void;
  /** Called while dragging with the pointer position; return true when hovering a slot that accepts this tile. */
  onDragMove?: (point: { x: number; y: number }) => void;
  /** Return true if the drop was accepted. */
  onDrop?: (point: { x: number; y: number }) => void;
  onDragStart?: () => void;
}

/**
 * A pressable keycap: the outer button scales and drags; the inner face drops onto its
 * edge while pressed. Shares a layoutId between shelf and slot so placing flies the tile across.
 */
export function Tile({ ingredient: ing, crossed, locked, slotted, verdict, onPress, onLongPress, onDragMove, onDrop, onDragStart }: Props) {
  const timer = useRef<number | undefined>(undefined);
  const suppress = useRef(false);
  const canDrag = !locked && !slotted && !!onDrop;

  const clearTimer = () => window.clearTimeout(timer.current);

  const label = `${ing.name}, ${ing.origin}, weight ${ing.weight}, volatility ${ing.volatility}${crossed ? ', ruled out' : ''}`;

  return (
    <motion.button
      type="button"
      layoutId={`ing-${ing.id}`}
      className={['tile', crossed && 'is-crossed', slotted && 'is-slotted', verdict && `is-${verdict}`].filter(Boolean).join(' ')}
      aria-label={slotted ? `${label}. Tap to return it to the shelf` : label}
      disabled={locked}
      initial={false}
      whileTap={locked ? undefined : 'pressed'}
      whileHover={locked ? undefined : 'hover'}
      variants={{ pressed: { scale: PRESS_SCALE }, hover: { scale: 1.02 } }}
      transition={spring.bouncy}
      drag={canDrag}
      dragSnapToOrigin
      dragElastic={0.9}
      dragMomentum={false}
      whileDrag={{ scale: 1.08, zIndex: 50, rotate: -2 }}
      style={{ zIndex: 1 }}
      onPointerDown={() => {
        suppress.current = false;
        if (!onLongPress || locked) return;
        clearTimer();
        timer.current = window.setTimeout(() => {
          suppress.current = true;
          onLongPress();
        }, LONG_PRESS_MS);
      }}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(e) => {
        // Right-click on desktop rules out, like long-press on touch.
        e.preventDefault();
        if (onLongPress && !locked && !suppress.current) {
          suppress.current = true;
          onLongPress();
        }
      }}
      onDragStart={() => {
        clearTimer();
        suppress.current = true;
        fx('pickUp');
        onDragStart?.();
      }}
      onDrag={(_, info: PanInfo) => onDragMove?.(info.point)}
      onDragEnd={(_, info: PanInfo) => onDrop?.(info.point)}
      onClick={() => {
        if (suppress.current) {
          suppress.current = false;
          return;
        }
        onPress();
      }}
    >
      <motion.span
        className="tile-face"
        variants={{ pressed: { y: 3 } }}
        transition={spring.snappy}
        animate={crossed ? { y: 3 } : { y: 0 }}
      >
        <span className="tile-name">{ing.name}</span>
        <span className="tile-meta">
          <OriginGlyph origin={ing.origin} />
          <StatPair weight={ing.weight} volatility={ing.volatility} />
        </span>
      </motion.span>
    </motion.button>
  );
}
