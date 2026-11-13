import { List, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { describe, type ClueSpec } from '../engine/clues';
import { fx } from './fx';
import { PRESS_SCALE, spring } from './motion';

interface Props {
  clues: ClueSpec[];
  revealed: number;
  finished: boolean;
  minClues: number;
  onReveal: () => void;
}

/** Once the day is over, also show any unrevealed clues up to the minimum so the player can see the path. */
function shownCount({ revealed, finished, minClues }: Pick<Props, 'revealed' | 'finished' | 'minClues'>) {
  return finished ? Math.max(revealed, minClues) : revealed;
}

function Flag({ i, revealed, finished, minClues }: { i: number } & Pick<Props, 'revealed' | 'finished' | 'minClues'>) {
  if (finished && i + 1 === minClues) return <span className="clue-flag">Minimum</span>;
  if (i >= revealed) return <span className="clue-flag is-muted">Not revealed</span>;
  return null;
}

function RevealButton({ revealed, total, onReveal }: { revealed: number; total: number; onReveal: () => void }) {
  const exhausted = revealed >= total;
  return (
    <motion.button
      type="button"
      className="reveal-button"
      onClick={() => {
        fx('reveal');
        onReveal();
      }}
      disabled={exhausted}
      whileTap={{ scale: PRESS_SCALE }}
      transition={spring.snappy}
    >
      {exhausted ? (
        'No clues left'
      ) : (
        <>
          <Plus size={15} strokeWidth={2.6} aria-hidden />
          Reveal clue
        </>
      )}
    </motion.button>
  );
}

/** Phone: one clue at a time, swipe or tap the dots to look back. */
export function ClueCard(props: Props & { onShowAll: () => void }) {
  const { clues, revealed, finished, onReveal, onShowAll } = props;
  const count = shownCount(props);
  const [index, setIndex] = useState(count - 1);
  const [dir, setDir] = useState(1);
  const prevRevealed = useRef(revealed);

  // Jump to the newest clue whenever one is revealed.
  useEffect(() => {
    if (revealed !== prevRevealed.current) {
      setDir(1);
      setIndex(revealed - 1);
      prevRevealed.current = revealed;
    }
  }, [revealed]);

  const go = (to: number) => {
    const next = Math.max(0, Math.min(count - 1, to));
    if (next === index) return;
    setDir(next > index ? 1 : -1);
    setIndex(next);
    fx('tab');
  };

  return (
    <section className="clue-card" aria-label="Clues" aria-roledescription="carousel">
      <div className="clue-head">
        <span className="eyebrow">
          Clue {index + 1}
          <span className="clue-of"> of {count}</span>
        </span>
        <motion.button
          type="button"
          className="icon-button small"
          onClick={onShowAll}
          aria-label="Show all clues"
          whileTap={{ scale: 0.88 }}
          transition={spring.snappy}
        >
          <List size={17} aria-hidden />
        </motion.button>
      </div>

      <div className="clue-viewport" aria-live="polite">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={index}
            className="clue-slide"
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 60, opacity: 0, rotate: d * 2 }),
              center: { x: 0, opacity: 1, rotate: 0 },
              exit: (d: number) => ({ x: d * -60, opacity: 0, rotate: d * -2 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring.bouncy}
            drag={count > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={(_, info) => {
              if (info.offset.x < -50 || info.velocity.x < -400) go(index + 1);
              else if (info.offset.x > 50 || info.velocity.x > 400) go(index - 1);
            }}
          >
            <p className={`clue-text${index >= revealed ? ' is-unrevealed' : ''}`}>{describe(clues[index])}</p>
            <Flag i={index} {...props} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="clue-foot">
        <div className="dots" role="group" aria-label="Choose clue">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              className={['dot', i === index && 'is-current', finished && i + 1 === props.minClues && 'is-minimum', i >= revealed && 'is-unrevealed']
                .filter(Boolean)
                .join(' ')}
              aria-label={`Clue ${i + 1}`}
              aria-current={i === index}
              onClick={() => go(i)}
            >
              <motion.span layout transition={spring.snappy} />
            </button>
          ))}
        </div>
        {!finished && <RevealButton revealed={revealed} total={clues.length} onReveal={onReveal} />}
      </div>
    </section>
  );
}

/** Desktop side panel and the "all clues" sheet: every clue in order. */
export function ClueList(props: Props & { withReveal?: boolean }) {
  const { clues, revealed, finished, onReveal, withReveal } = props;
  const count = shownCount(props);
  return (
    <div className="clue-list-wrap">
      <ol className="clue-list">
        <AnimatePresence initial={false}>
          {clues.slice(0, count).map((clue, i) => (
            <motion.li
              key={i}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={spring.bouncy}
              className={[finished && i + 1 === props.minClues && 'is-minimum', i >= revealed && 'is-unrevealed'].filter(Boolean).join(' ') || undefined}
            >
              <span className="clue-number">{i + 1}</span>
              <span className="clue-text">{describe(clue)}</span>
              <Flag i={i} {...props} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {withReveal && !finished && <RevealButton revealed={revealed} total={clues.length} onReveal={onReveal} />}
    </div>
  );
}
