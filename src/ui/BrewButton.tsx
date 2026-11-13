import { FlaskConical } from 'lucide-react';
import { animate, AnimatePresence, motion, useAnimate, useMotionValue, type AnimationPlaybackControls } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { fx } from './fx';
import { spring } from './motion';

const HOLD_SECONDS = 0.85;
const TICKS = 6;

interface Props {
  ready: boolean;
  onBrew: () => void;
  /** Tapped while slots are still empty. */
  onNotReady: () => void;
  /** Activated without a hold (e.g. by a screen reader): ask for confirmation instead. */
  onConfirmFallback: () => void;
}

/** Press and hold to brew. The hold is the confirmation, so there's no dialog in the way. */
export function BrewButton({ ready, onBrew, onNotReady, onConfirmFallback }: Props) {
  const progress = useMotionValue(0);
  const run = useRef<AnimationPlaybackControls | null>(null);
  const holding = useRef(false);
  const handled = useRef(false);
  const [hint, setHint] = useState(false);
  const [scope, animateEl] = useAnimate<HTMLButtonElement>();

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(false), 1800);
    return () => window.clearTimeout(t);
  }, [hint]);

  const start = () => {
    handled.current = true;
    if (!ready) {
      fx('reject');
      animateEl(scope.current, { x: [0, -7, 7, -4, 4, 0] }, { duration: 0.32 });
      onNotReady();
      return;
    }
    holding.current = true;
    setHint(false);
    let tick = -1;
    run.current = animate(progress, 1, {
      duration: HOLD_SECONDS * (1 - progress.get()),
      ease: 'linear',
      onUpdate: (v) => {
        const t = Math.floor(v * TICKS);
        if (t !== tick && t < TICKS) {
          tick = t;
          fx('holdTick', v);
        }
      },
      onComplete: () => {
        holding.current = false;
        fx('brew');
        onBrew();
      },
    });
  };

  const cancel = () => {
    if (!holding.current) return;
    holding.current = false;
    run.current?.stop();
    if (progress.get() < 1) {
      fx('holdCancel');
      if (progress.get() < 0.3) setHint(true);
      animate(progress, 0, spring.snappy);
    }
  };

  return (
    <div className="brew-wrap">
      <AnimatePresence>
        {hint && (
          <motion.span
            className="brew-hint"
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4 }}
            transition={spring.bouncy}
            role="status"
          >
            Keep holding to brew
          </motion.span>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        className={`brew-button${ready ? '' : ' is-waiting'}`}
        aria-label={ready ? 'Brew. Press and hold' : 'Brew. Fill all three slots first'}
        ref={scope}
        whileTap="pressed"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start();
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') cancel();
        }}
        onClick={() => {
          // Pointer and keyboard presses are handled as holds; anything else is assistive tech.
          if (handled.current) {
            handled.current = false;
            return;
          }
          if (ready) onConfirmFallback();
          else onNotReady();
        }}
      >
        <motion.span className="brew-face" variants={{ pressed: { y: 3 } }} transition={spring.snappy}>
          <motion.span className="brew-fill" style={{ scaleX: progress }} aria-hidden />
          <span className="brew-label">
            <FlaskConical size={18} strokeWidth={2.2} aria-hidden />
            {ready ? 'Hold to brew' : 'Fill all three slots'}
          </span>
        </motion.span>
      </motion.button>
    </div>
  );
}
