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
      <p className="rules-lead">Combine one of each type of ingredient: base, catalyst, and binder. Ingredients have weights, volatilities, and origins: natural, artificial, spectral, draconic, demonic, or extraplanar. Use the information to deduce the correct recipe.</p>
      <ul>
        <li>
          <Lightbulb size={18} aria-hidden />
          <span>
            You start with one clue. Reveal more clues to figure out the recipe, and try to solve it in as few clues as you can.
          </span>
        </li>
        <li>
          <Plus size={18} aria-hidden />
          <span>Tap or drag an ingredient to place it in its slot. Tap a slot to take it back out.</span>
        </li>
        <li>
          <Pencil size={18} aria-hidden />
          <span>Long-press an ingredient, or switch on study mode, to cross it out.</span>
        </li>
        <li>
          <Scale size={18} aria-hidden />
          <span>
            <strong>Tip:</strong> Some clues describe “the heaviest/lightest” or “most/least volatile” component. In the case of a tie, this clue must apply to every heaviest, lightest, or most or least volatile component.
          </span>
        </li>
        <li>
          <Hand size={18} aria-hidden />
          <span>
            <strong>Hold to brew.</strong> Careful: you’ve only got one shot. Once you succeed, you’ll see how close you were to the <strong>Breakthrough</strong>: the earliest clue possible to solve the puzzle.
          </span>
        </li>
      </ul>
      <p className="muted">A new potion arrives every day, at a different Intensity Rank from 5 to 30, which describes how difficult the potion is.</p>
    </div>
  );
}

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Potion Brewing"
      title="A Practical Guide"
      actions={
        <motion.button type="button" className="button primary" onClick={onClose} whileTap={{ scale: PRESS_SCALE }} transition={spring.snappy}>
          Let’s go
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
          {step === 'house' ? 'Continue' : 'Activate the lab'}
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
              <p className="muted">Your House is the most important choice you will make. It determines your colors, and your destiny.</p>
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
