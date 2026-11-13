import type { Transition } from 'motion/react';

/** Shared spring presets so every surface moves with the same physics. */
export const spring = {
  /** Presses, toggles, small UI. */
  snappy: { type: 'spring', stiffness: 700, damping: 38, mass: 0.6 },
  /** Things landing: ingredients in slots, cards dealing in. */
  bouncy: { type: 'spring', stiffness: 520, damping: 24, mass: 0.8 },
  /** Large surfaces: sheets, panels. */
  gentle: { type: 'spring', stiffness: 340, damping: 34 },
} satisfies Record<string, Transition>;

/** Scale applied while a pressable surface is held down. */
export const PRESS_SCALE = 0.95;
