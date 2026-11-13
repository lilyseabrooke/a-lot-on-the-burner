import type { Ingredient, Origin, Slot } from './types';

/*
 * PLACEHOLDER ROSTER.
 * Names are stand-ins; swap them freely. Ids are what puzzles reference, so
 * renaming is always safe. Changing an origin / weight / volatility can
 * invalidate already-generated puzzles: run `npm test` afterwards (it re-checks
 * every file in public/puzzles) and regenerate if needed.
 */
type Row = [id: string, name: string, origin: Origin, weight: number, volatility: number];

const BASES: Row[] = [
  ['b01', 'Contract Ink', 'demonic', 5, 6],
  ['b02', 'Moonwell Water', 'natural', 6, 2],
  ['b03', 'Quicksilver Draught', 'artificial', 9, 5],
  ['b04', 'Ghostmilk', 'spectral', 3, 4],
  ['b05', 'Ember Oil', 'draconic', 7, 8],
  ['b06', 'Void Brine', 'extraplanar', 8, 3],
  ['b07', 'Sap of the Elder Oak', 'natural', 7, 1],
  ['b08', 'Brimstone Syrup', 'demonic', 8, 7],
  ['b09', 'Clockwork Lubricant', 'artificial', 5, 3],
  ['b10', 'Ectoplasm', 'spectral', 2, 6],
  ['b11', 'Dragonblood Wine', 'draconic', 6, 5],
  ['b12', 'Starlight Distillate', 'extraplanar', 4, 7],
  ['b13', 'Saltmarsh Vinegar', 'natural', 5, 4],
  ['b14', 'Glass Solvent', 'artificial', 6, 8],
  ['b15', 'Phantom Tea', 'spectral', 4, 2],
  ['b16', 'Wyrm Bile', 'draconic', 9, 6],
  ['b17', 'Aether Dew', 'extraplanar', 2, 5],
  ['b18', 'Tar of Unmaking', 'demonic', 10, 4],
  ['b19', 'Thrice-Fallen Rain', 'natural', 3, 3],
  ['b20', 'Mourning Oil', 'spectral', 7, 7],
];

const CATALYSTS: Row[] = [
  ['c01', 'Wyrmscale Flake', 'draconic', 3, 7],
  ['c02', 'Imp Ash', 'demonic', 1, 8],
  ['c03', 'Ghostfire Ember', 'spectral', 2, 9],
  ['c04', 'Thunder Salt', 'natural', 4, 6],
  ['c05', 'Clockspring Shavings', 'artificial', 3, 5],
  ['c06', 'Riftshard', 'extraplanar', 5, 9],
  ['c07', 'Hellhound Tooth', 'demonic', 4, 6],
  ['c08', 'Bottled Banshee Wail', 'spectral', 1, 7],
  ['c09', 'Mandrake Root', 'natural', 6, 4],
  ['c10', "Philosopher's Grit", 'artificial', 7, 3],
  ['c11', 'Drake Pepper', 'draconic', 2, 10],
  ['c12', 'Star Fragment', 'extraplanar', 6, 7],
  ['c13', 'Infernal Coal', 'demonic', 5, 10],
  ['c14', 'Lightning-Struck Acorn', 'natural', 2, 8],
  ['c15', 'Copper Filings', 'artificial', 6, 4],
  ['c16', 'Echo Crystal', 'extraplanar', 3, 5],
  ['c17', 'Wyvern Venom', 'draconic', 1, 6],
  ['c18', 'Grave Candle Wick', 'spectral', 4, 3],
  ['c19', 'Sulphur Bloom', 'natural', 3, 9],
  ['c20', 'Brass Reagent', 'artificial', 5, 8],
];

const BINDERS: Row[] = [
  ['d01', 'Moonwax', 'spectral', 3, 2],
  ['d02', 'Ash Resin', 'natural', 5, 3],
  ['d03', 'Spidersilk Gum', 'natural', 2, 1],
  ['d04', 'Dragon Marrow', 'draconic', 8, 4],
  ['d05', 'Demon Tallow', 'demonic', 6, 5],
  ['d06', 'Riftmortar', 'extraplanar', 9, 2],
  ['d07', 'Ectoplasmic Gel', 'spectral', 4, 4],
  ['d08', "Alchemist's Paste", 'artificial', 5, 1],
  ['d09', 'Beeswax', 'natural', 3, 2],
  ['d10', 'Wyrm Glue', 'draconic', 6, 6],
  ['d11', 'Brimstone Paste', 'demonic', 7, 3],
  ['d12', 'Fog Agar', 'extraplanar', 2, 5],
  ['d13', 'Chain Clay', 'artificial', 8, 2],
  ['d14', 'Grave Moss', 'natural', 4, 4],
  ['d15', 'Bone Meal', 'demonic', 5, 2],
  ['d16', 'Pale Lacquer', 'spectral', 6, 3],
  ['d17', 'Starch of Elsewhere', 'extraplanar', 3, 6],
  ['d18', 'Rivet Putty', 'artificial', 7, 4],
  ['d19', 'Scale Mortar', 'draconic', 4, 1],
  ['d20', 'Shroud Linen Pulp', 'spectral', 2, 3],
];

function build(slot: Slot, rows: Row[]): Ingredient[] {
  return rows.map(([id, name, origin, weight, volatility]) => ({ id, name, slot, origin, weight, volatility }));
}

export const ROSTER: readonly Ingredient[] = [
  ...build('base', BASES),
  ...build('catalyst', CATALYSTS),
  ...build('binder', BINDERS),
];

export const INGREDIENTS: ReadonlyMap<string, Ingredient> = new Map(ROSTER.map((i) => [i.id, i]));

export function ingredient(id: string): Ingredient {
  const found = INGREDIENTS.get(id);
  if (!found) throw new Error(`Unknown ingredient id: ${id}`);
  return found;
}

export function rosterFor(slot: Slot): Ingredient[] {
  return ROSTER.filter((i) => i.slot === slot);
}
