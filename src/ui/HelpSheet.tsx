import { Hand, Lightbulb, Pencil, Plus, Scale } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { House } from '../game/storage';
import { fx } from './fx';
import { PRESS_SCALE, spring } from './motion';
import { HousePicker } from './Settings';
import { Sheet } from './Sheet';

export function Rules() {
  return (
    <div className="rules">
      <p className="rules-lead">Brew today’s potion: one base, one catalyst and one binder.</p>
      <ul>
        <li>
          <Lightbulb size={18} aria-hidden />
          <span>
            You start with one clue. <strong>Reveal</strong> more whenever you like, but every clue counts against you.
          </span>
        </li>
        <li>
          <Plus size={18} aria-hidden />
          <span>Tap an ingredient to drop it into its slot, or drag it there. Tap a slot to take it back out.</span>
        </li>
        <li>
          <Pencil size={18} aria-hidden />
          <span>Long-press an ingredient, or switch on notes mode, to rule it out.</span>
        </li>
        <li>
          <Scale size={18} aria-hidden />
          <span>
            <strong>Ties:</strong> “the heaviest component” means every component tied for heaviest, and the same goes
            for lightest, most and least volatile. “Heavier”, “over” and “under” are strict, so a tie never counts.
          </span>
        </li>
        <li>
          <Hand size={18} aria-hidden />
          <span>
            <strong>Hold to brew.</strong> You get one brew. Get it right and you’ll see how close you came to the minimum:
            the clue after which only one potion fits.
          </span>
        </li>
      </ul>
      <p className="muted">The Intensity Rank, from 5 to 30, shows how hard the day is. A new potion arrives at midnight.</p>
    </div>
  );
}

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="How to play"
      title="A Lot on the Burner"
      actions={
        <motion.button type="button" className="button primary" onClick={onClose} whileTap={{ scale: PRESS_SCALE }} transition={spring.snappy}>
          Got it
        </motion.button>
      }
    >
      <Rules />
    </Sheet>
  );
}

/** First visit: pick a House (it sets the accent colour), then the rules. */
export function WelcomeSheet({ open, onClose, house, onHouse }: { open: boolean; onClose: () => void; house: House; onHouse: (h: House) => void }) {
  const [step, setStep] = useState<'house' | 'rules'>('house');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Welcome to the lab"
      title={step === 'house' ? 'Choose your House' : 'How to play'}
      actions={
        <motion.button
          type="button"
          className="button primary"
          whileTap={{ scale: PRESS_SCALE }}
          transition={spring.snappy}
          onClick={() => {
            fx('tap');
            if (step === 'house') setStep('rules');
            else onClose();
          }}
        >
          {step === 'house' ? 'Continue' : 'Light the burner'}
        </motion.button>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={spring.gentle}
        >
          {step === 'house' ? (
            <div className="welcome-house">
              <p className="muted">Your House sets your colours. You can change it any time in settings.</p>
              <HousePicker value={house} onChange={onHouse} />
            </div>
          ) : (
            <Rules />
          )}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  );
}
