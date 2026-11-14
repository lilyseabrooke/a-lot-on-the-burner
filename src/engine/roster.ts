import type { Ingredient, Origin, Slot } from './types';

/*
 * THE ROSTER: 96 ingredients, 16 per origin, listed by slot and then grouped by origin.
 * Ids are what puzzles reference, so renaming is always safe. Reordering or renumbering ids, or
 * changing an origin / weight / volatility, can invalidate already-generated puzzles: run
 * `npm test` afterwards (it re-checks every file in public/puzzles) and regenerate if needed.
 */
type Row = [id: string, name: string, origin: Origin, weight: number, volatility: number];

const BASES: Row[] = [
  ['b01', 'Gloomleaf Resin', 'natural', 6, 6],
  ['b02', 'Nara Sap', 'natural', 3, 8],
  ['b03', "Saphi's Heart", 'natural', 7, 9],
  ['b04', 'Dreamnectar', 'natural', 2, 4],
  ['b05', 'Black Ichor', 'demonic', 7, 4],
  ['b06', 'Seersap', 'demonic', 5, 5],
  ['b07', 'Misery Heart', 'demonic', 2, 8],
  ['b08', 'Contract Ink', 'demonic', 5, 1],
  ['b09', 'Scale Suspension', 'draconic', 4, 7],
  ['b10', 'Bloodstone Sap', 'draconic', 7, 8],
  ['b11', 'Fire Solution', 'draconic', 4, 9],
  ['b12', 'Warclaw Venom', 'draconic', 2, 10],
  ['b13', 'Flame Orb', 'draconic', 3, 7],
  ['b14', 'Dream Bubble', 'spectral', 1, 5],
  ['b15', 'Mindwretch Resin', 'spectral', 6, 9],
  ['b16', 'Ley Sap', 'spectral', 4, 7],
  ['b17', 'Rift Eye', 'spectral', 3, 4],
  ['b18', 'Ley Tear', 'spectral', 2, 6],
  ['b19', 'Walker Venom', 'extraplanar', 2, 8],
  ['b20', 'Songstone Shards', 'extraplanar', 4, 4],
  ['b21', 'Golem Heart', 'extraplanar', 7, 5],
  ['b22', 'Gloomcatcher Seed', 'extraplanar', 4, 8],
  ['b23', 'Bent Stone', 'extraplanar', 5, 4],
  ['b24', 'Solarum Ingot', 'artificial', 10, 4],
  ['b25', 'Evoker Core', 'artificial', 4, 7],
  ['b26', 'Wardsteel Scrap', 'artificial', 3, 1],
  ['b27', 'Rune Block', 'artificial', 5, 1],
];

const CATALYSTS: Row[] = [
  ['c01', 'Jitterbush Coils', 'natural', 2, 9],
  ['c02', "Galyr's Tooth", 'natural', 3, 2],
  ['c03', "Wilena's Apple", 'natural', 4, 1],
  ['c04', 'Spiny Heart', 'natural', 5, 6],
  ['c05', "Dragon's Tongue", 'natural', 5, 3],
  ['c06', 'Bottlebloom Leaf', 'natural', 2, 1],
  ['c07', 'Grief Crystal', 'demonic', 3, 9],
  ['c08', 'Contract Paper', 'demonic', 1, 1],
  ['c09', "Emperor's Tooth", 'demonic', 3, 8],
  ['c10', 'Mawstone', 'demonic', 6, 7],
  ['c11', 'Smokestone', 'demonic', 3, 5],
  ['c12', 'Serpent Eye', 'demonic', 3, 6],
  ['c13', 'Hatcher Pile', 'draconic', 7, 5],
  ['c14', 'Burning Eye', 'draconic', 4, 8],
  ['c15', 'Scale Knot', 'draconic', 3, 6],
  ['c16', 'Smolderstone', 'draconic', 7, 2],
  ['c17', 'Dragonscale', 'draconic', 4, 1],
  ['c18', 'Astral Stone', 'spectral', 1, 1],
  ['c19', 'Spectral Shards', 'spectral', 4, 6],
  ['c20', 'Star Mirror', 'spectral', 3, 2],
  ['c21', 'Drift Crystal', 'spectral', 2, 10],
  ['c22', 'Captured Spirit', 'spectral', 2, 8],
  ['c23', "Blackcliff's Axel", 'spectral', 4, 9],
  ['c24', 'Crystal Palace Heart', 'extraplanar', 8, 6],
  ['c25', "Meyri's Chain", 'extraplanar', 3, 5],
  ['c26', 'Planar Gem', 'extraplanar', 5, 5],
  ['c27', 'Drift Token', 'extraplanar', 6, 10],
  ['c28', 'Mirror Gem', 'extraplanar', 3, 7],
  ['c29', 'Starfall Medallion', 'artificial', 5, 1],
  ['c30', 'Force Block', 'artificial', 2, 8],
  ['c31', 'Runic Paper', 'artificial', 1, 1],
  ['c32', 'Runic Core', 'artificial', 7, 3],
  ['c33', 'Chronocog', 'artificial', 4, 8],
  ['c34', 'Crystal Pack', 'artificial', 7, 7],
];

const BINDERS: Row[] = [
  ['d01', 'Wolf Weed', 'natural', 3, 7],
  ['d02', 'Wilt Leaf', 'natural', 1, 4],
  ['d03', 'Super Root', 'natural', 4, 3],
  ['d04', 'Burstblossom', 'natural', 1, 10],
  ['d05', 'Ghostbough Dust', 'natural', 1, 7],
  ['d06', 'Shield Blossom', 'natural', 6, 1],
  ['d07', 'Abyssal Steel', 'demonic', 10, 1],
  ['d08', 'Abyss Feather', 'demonic', 1, 5],
  ['d09', 'Deathgazer', 'demonic', 4, 7],
  ['d10', "Weaver's Needle", 'demonic', 2, 5],
  ['d11', 'Abyssal Dust', 'demonic', 1, 2],
  ['d12', 'Abyssal Stone', 'demonic', 5, 3],
  ['d13', 'Shed Wing', 'draconic', 3, 5],
  ['d14', 'Dragon Eggshell', 'draconic', 2, 5],
  ['d15', 'Draconibble', 'draconic', 3, 4],
  ['d16', 'Stinger Spine', 'draconic', 3, 4],
  ['d17', 'Jolt Spine', 'draconic', 6, 6],
  ['d18', 'Coil Talon', 'draconic', 3, 5],
  ['d19', 'Dream Block', 'spectral', 7, 4],
  ['d20', 'Miasma', 'spectral', 1, 6],
  ['d21', 'Twin Spirits', 'spectral', 1, 2],
  ['d22', 'Spectral Glass', 'spectral', 3, 4],
  ['d23', 'Resonance Dust', 'spectral', 1, 3],
  ['d24', 'Pink Swirl', 'extraplanar', 4, 1],
  ['d25', 'Ripple Shard', 'extraplanar', 3, 5],
  ['d26', "Summoner's Shackle", 'extraplanar', 10, 1],
  ['d27', 'Distortion Stone', 'extraplanar', 9, 9],
  ['d28', 'Blink Peaks', 'extraplanar', 1, 5],
  ['d29', 'Swirl Shards', 'extraplanar', 1, 4],
  ['d30', 'Spellglass', 'artificial', 3, 4],
  ['d31', 'Channeling Screw', 'artificial', 5, 3],
  ['d32', 'Arcane Stabilizer', 'artificial', 10, 1],
  ['d33', 'Sealing Chain', 'artificial', 7, 4],
  ['d34', 'Power Bolt', 'artificial', 6, 5],
  ['d35', 'Driving Ring', 'artificial', 6, 3],
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
