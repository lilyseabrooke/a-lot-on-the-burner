export type Slot = 'base' | 'catalyst' | 'binder';
export const SLOTS: readonly Slot[] = ['base', 'catalyst', 'binder'];

export type Origin = 'natural' | 'artificial' | 'extraplanar' | 'demonic' | 'draconic' | 'spectral';
export const ORIGINS: readonly Origin[] = [
  'natural',
  'artificial',
  'extraplanar',
  'demonic',
  'draconic',
  'spectral',
];

export type Stat = 'weight' | 'volatility';
export const STATS: readonly Stat[] = ['weight', 'volatility'];

export interface Ingredient {
  id: string;
  name: string;
  slot: Slot;
  origin: Origin;
  weight: number;
  volatility: number;
}

/** A candidate potion: one ingredient per slot, in SLOTS order. */
export interface Combo {
  base: Ingredient;
  catalyst: Ingredient;
  binder: Ingredient;
}

export type Available = Record<Slot, string[]>;
