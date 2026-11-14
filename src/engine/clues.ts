import { ingredient } from './roster';
import type { Combo, Ingredient, Origin, Slot, Stat } from './types';

/*
 * Every clue is plain data (so puzzles can be stored as JSON) with three
 * behaviours defined here: whether a combo satisfies it, how it reads, and how
 * abstract it is (its "level", used for difficulty).
 *
 * Levels: 0 = direct helper (names ingredients outright, only after the
 * minimum), 1 = simple attribute facts, up to 5 = proportional / conditional
 * arithmetic that takes real work to apply.
 */

export type Bound = 'atLeast' | 'atMost';
export type OriginCount = 'none' | 'exactlyOne' | 'atLeastOne' | 'atLeastTwo';
/** Strict bounds, for clues worded "over 12" / "under 10". */
export type Strict = 'over' | 'under';

export type ClueSpec =
  | { kind: 'slotOrigin'; slot: Slot; origin: Origin; is: boolean }
  | { kind: 'slotOriginEither'; slot: Slot; origins: [Origin, Origin] }
  | { kind: 'excluded'; id: string }
  | { kind: 'slotStatBound'; slot: Slot; stat: Stat; op: Bound; n: number }
  | { kind: 'slotParity'; slot: Slot; stat: Stat; even: boolean }
  | { kind: 'slotCompare'; a: Slot; b: Slot; stat: Stat; strict: boolean }
  | { kind: 'extreme'; slot: Slot; stat: Stat; most: boolean; strict: boolean }
  | { kind: 'originCount'; origin: Origin; count: OriginCount }
  | { kind: 'pairShare'; a: Slot; b: Slot; same: boolean }
  | { kind: 'originVariety'; allDistinct: boolean }
  | { kind: 'pairing'; id: string; slot: Slot; origin: Origin; only: boolean }
  | { kind: 'totalBound'; stat: Stat; op: Bound; n: number }
  | { kind: 'totalParity'; stat: Stat; even: boolean }
  | { kind: 'selfCompare'; slot: Slot; over: Stat; strict: boolean }
  | { kind: 'pairParity'; a: Slot; b: Slot; stat: Stat; same: boolean }
  | { kind: 'totalCompare'; over: Stat; strict: boolean }
  | { kind: 'conditionalOrigin'; ifSlot: Slot; ifOrigin: Origin; thenSlot: Slot; thenOrigin: Origin; is: boolean }
  | { kind: 'diffBound'; a: Slot; b: Slot; stat: Stat; op: Bound; n: number }
  | { kind: 'sumVsOne'; slot: Slot; stat: Stat; greater: boolean }
  | { kind: 'shareFraction'; slot: Slot; stat: Stat; ifOrigin: Origin | null; moreThan: boolean; den: 2 | 3 | 4 }
  | { kind: 'pairingAny'; id: string; origin: Origin; only: boolean }
  | { kind: 'pairedStat'; id: string; slot: Slot; stat: Stat; more: boolean }
  | { kind: 'ingredientTotal'; id: string; stat: Stat; op: Strict; n: number }
  | { kind: 'totalsConditional'; ifStat: Stat; ifOp: Strict; ifN: number; thenStat: Stat; thenOp: Strict; thenN: number }
  | { kind: 'extremeOrigin'; stat: Stat; most: boolean; origin: Origin; is: boolean }
  | { kind: 'extremesShare'; stat: Stat; same: boolean }
  | { kind: 'slotOneOf'; slot: Slot; ids: string[] }
  | { kind: 'slotIs'; slot: Slot; id: string };

export type ClueKind = ClueSpec['kind'];

export const CLUE_LEVEL: Record<ClueKind, number> = {
  slotOneOf: 0,
  slotIs: 0,
  slotOrigin: 1,
  slotOriginEither: 1,
  excluded: 1,
  slotStatBound: 1,
  slotParity: 2,
  slotCompare: 2,
  extreme: 2,
  originCount: 2,
  pairShare: 2,
  originVariety: 3,
  pairing: 3,
  pairingAny: 3,
  pairedStat: 3,
  ingredientTotal: 3,
  extremeOrigin: 3,
  extremesShare: 3,
  totalBound: 3,
  totalParity: 3,
  selfCompare: 3,
  pairParity: 4,
  totalCompare: 4,
  conditionalOrigin: 4,
  totalsConditional: 4,
  diffBound: 4,
  sumVsOne: 4,
  shareFraction: 5,
};

export function clueLevel(spec: ClueSpec): number {
  return CLUE_LEVEL[spec.kind];
}

const others = (slot: Slot): Slot[] => (['base', 'catalyst', 'binder'] as Slot[]).filter((s) => s !== slot);
const parts = (c: Combo): Ingredient[] => [c.base, c.catalyst, c.binder];
const total = (c: Combo, stat: Stat) => c.base[stat] + c.catalyst[stat] + c.binder[stat];
const isEven = (n: number) => n % 2 === 0;
const beyond = (v: number, op: Strict, n: number) => (op === 'over' ? v > n : v < n);
const withId = (c: Combo, id: string): Slot | null =>
  c.base.id === id ? 'base' : c.catalyst.id === id ? 'catalyst' : c.binder.id === id ? 'binder' : null;

const SLOT_ORDER: Slot[] = ['base', 'catalyst', 'binder'];

/**
 * Components at the top (most) or bottom of a stat. Ties all count, so "the heaviest component"
 * means every component tied for heaviest; clues that use this say "(ties included)".
 */
function extremes(c: Combo, stat: Stat, most: boolean): Slot[] {
  const vals = SLOT_ORDER.map((s) => c[s][stat]);
  const edge = most ? Math.max(...vals) : Math.min(...vals);
  return SLOT_ORDER.filter((s) => c[s][stat] === edge);
}

export function satisfies(spec: ClueSpec, c: Combo): boolean {
  switch (spec.kind) {
    case 'slotOrigin':
      return (c[spec.slot].origin === spec.origin) === spec.is;
    case 'slotOriginEither':
      return spec.origins.includes(c[spec.slot].origin);
    case 'excluded':
      return parts(c).every((i) => i.id !== spec.id);
    case 'slotStatBound': {
      const v = c[spec.slot][spec.stat];
      return spec.op === 'atLeast' ? v >= spec.n : v <= spec.n;
    }
    case 'slotParity':
      return isEven(c[spec.slot][spec.stat]) === spec.even;
    case 'slotCompare': {
      const a = c[spec.a][spec.stat];
      const b = c[spec.b][spec.stat];
      return spec.strict ? a > b : a >= b;
    }
    case 'extreme': {
      const v = c[spec.slot][spec.stat];
      return others(spec.slot).every((s) => {
        const o = c[s][spec.stat];
        if (spec.most) return spec.strict ? v > o : v >= o;
        return spec.strict ? v < o : v <= o;
      });
    }
    case 'originCount': {
      const n = parts(c).filter((i) => i.origin === spec.origin).length;
      switch (spec.count) {
        case 'none':
          return n === 0;
        case 'exactlyOne':
          return n === 1;
        case 'atLeastOne':
          return n >= 1;
        case 'atLeastTwo':
          return n >= 2;
      }
      return false;
    }
    case 'pairShare':
      return (c[spec.a].origin === c[spec.b].origin) === spec.same;
    case 'originVariety': {
      const distinct = new Set(parts(c).map((i) => i.origin)).size === 3;
      return distinct === spec.allDistinct;
    }
    case 'pairing': {
      const host = ingredient(spec.id);
      if (c[host.slot].id !== spec.id) return true;
      return (c[spec.slot].origin === spec.origin) === spec.only;
    }
    case 'totalBound': {
      const t = total(c, spec.stat);
      return spec.op === 'atLeast' ? t >= spec.n : t <= spec.n;
    }
    case 'totalParity':
      return isEven(total(c, spec.stat)) === spec.even;
    case 'selfCompare': {
      const i = c[spec.slot];
      const under: Stat = spec.over === 'weight' ? 'volatility' : 'weight';
      return spec.strict ? i[spec.over] > i[under] : i[spec.over] >= i[under];
    }
    case 'pairParity':
      return (isEven(c[spec.a][spec.stat]) === isEven(c[spec.b][spec.stat])) === spec.same;
    case 'totalCompare': {
      const under: Stat = spec.over === 'weight' ? 'volatility' : 'weight';
      const o = total(c, spec.over);
      const u = total(c, under);
      return spec.strict ? o > u : o >= u;
    }
    case 'conditionalOrigin':
      if (c[spec.ifSlot].origin !== spec.ifOrigin) return true;
      return (c[spec.thenSlot].origin === spec.thenOrigin) === spec.is;
    case 'diffBound': {
      const d = Math.abs(c[spec.a][spec.stat] - c[spec.b][spec.stat]);
      return spec.op === 'atLeast' ? d >= spec.n : d <= spec.n;
    }
    case 'sumVsOne': {
      const v = c[spec.slot][spec.stat];
      const rest = others(spec.slot).reduce((sum, s) => sum + c[s][spec.stat], 0);
      return (v > rest) === spec.greater;
    }
    case 'shareFraction': {
      if (spec.ifOrigin && c[spec.slot].origin !== spec.ifOrigin) return true;
      const share = c[spec.slot][spec.stat] * spec.den;
      const t = total(c, spec.stat);
      return spec.moreThan ? share > t : share <= t;
    }
    case 'pairingAny': {
      const host = withId(c, spec.id);
      if (!host) return true;
      return others(host).some((s) => c[s].origin === spec.origin) === spec.only;
    }
    case 'pairedStat': {
      const host = withId(c, spec.id);
      if (!host) return true;
      const v = c[host][spec.stat];
      const o = c[spec.slot][spec.stat];
      return spec.more ? o > v : o < v;
    }
    case 'ingredientTotal':
      if (!withId(c, spec.id)) return true;
      return beyond(total(c, spec.stat), spec.op, spec.n);
    case 'totalsConditional':
      if (!beyond(total(c, spec.ifStat), spec.ifOp, spec.ifN)) return true;
      return beyond(total(c, spec.thenStat), spec.thenOp, spec.thenN);
    case 'extremeOrigin':
      return extremes(c, spec.stat, spec.most).every((s) => (c[s].origin === spec.origin) === spec.is);
    case 'extremesShare': {
      const top = extremes(c, spec.stat, true);
      const bottom = extremes(c, spec.stat, false);
      return top.every((h) => bottom.every((l) => h === l || (c[h].origin === c[l].origin) === spec.same));
    }
    case 'slotOneOf':
      return spec.ids.includes(c[spec.slot].id);
    case 'slotIs':
      return c[spec.slot].id === spec.id;
  }
}

// ---------------------------------------------------------------- wording

const the = (slot: Slot) => `the ${slot}`;
const The = (slot: Slot) => `The ${slot}`;
const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const name = (id: string) => ingredient(id).name;
const FRACTION: Record<2 | 3 | 4, string> = { 2: 'half', 3: 'a third', 4: 'a quarter' };

function listOr(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `either ${items[0]} or ${items[1]}`;
  return `one of ${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

function heavier(stat: Stat, more: boolean): string {
  if (stat === 'weight') return more ? 'heavier' : 'lighter';
  return more ? 'more volatile' : 'less volatile';
}

function superlative(stat: Stat, most: boolean): string {
  if (stat === 'weight') return most ? 'heaviest' : 'lightest';
  return most ? 'most volatile' : 'least volatile';
}

/** "no lighter" / "no less volatile" — the non-strict form of heavier/more volatile. */
function noLess(stat: Stat, more: boolean): string {
  if (stat === 'weight') return more ? 'no lighter' : 'no heavier';
  return more ? 'no less volatile' : 'no more volatile';
}

export function describe(spec: ClueSpec): string {
  switch (spec.kind) {
    case 'slotOrigin':
      return `${The(spec.slot)} is ${spec.is ? '' : 'not '}${spec.origin}.`;
    case 'slotOriginEither':
      return `${The(spec.slot)} is either ${spec.origins[0]} or ${spec.origins[1]}.`;
    case 'excluded':
      return `${name(spec.id)} is not in the potion.`;
    case 'slotStatBound': {
      const bound = spec.op === 'atLeast' ? 'at least' : 'at most';
      return spec.stat === 'weight'
        ? `${The(spec.slot)} weighs ${bound} ${spec.n}.`
        : `${The(spec.slot)} has a volatility of ${bound} ${spec.n}.`;
    }
    case 'slotParity':
      return `${The(spec.slot)}'s ${spec.stat} is ${spec.even ? 'even' : 'odd'}.`;
    case 'slotCompare':
      return `${The(spec.a)} is ${spec.strict ? heavier(spec.stat, true) : noLess(spec.stat, true)} than ${the(spec.b)}.`;
    case 'extreme':
      return spec.strict
        ? `${The(spec.slot)} is ${heavier(spec.stat, spec.most)} than every other component.`
        : `${The(spec.slot)} is ${noLess(spec.stat, spec.most)} than any other component.`;
    case 'originCount':
      switch (spec.count) {
        case 'none':
          return `No component is ${spec.origin}.`;
        case 'exactlyOne':
          return `Exactly one component is ${spec.origin}.`;
        case 'atLeastOne':
          return `At least one component is ${spec.origin}.`;
        case 'atLeastTwo':
          return `At least two components are ${spec.origin}.`;
      }
      return '';
    case 'pairShare':
      return `${The(spec.a)} and ${the(spec.b)} ${spec.same ? 'share an origin' : 'do not share an origin'}.`;
    case 'originVariety':
      return spec.allDistinct ? 'No two components share an origin.' : 'At least two components share an origin.';
    case 'pairing':
      return `${name(spec.id)} can ${spec.only ? 'only' : 'not'} be paired with ${article(spec.origin)} ${spec.origin} ${spec.slot}.`.replace(
        'can not',
        'cannot',
      );
    case 'totalBound':
      return `The total ${spec.stat} is ${spec.op === 'atLeast' ? 'at least' : 'at most'} ${spec.n}.`;
    case 'totalParity':
      return `The total ${spec.stat} is ${spec.even ? 'even' : 'odd'}.`;
    case 'selfCompare': {
      const under: Stat = spec.over === 'weight' ? 'volatility' : 'weight';
      return `${The(spec.slot)}'s ${spec.over} is ${spec.strict ? 'greater than' : 'no less than'} its ${under}.`;
    }
    case 'pairParity': {
      const plural = spec.stat === 'weight' ? 'weights' : 'volatilities';
      return `${The(spec.a)} and ${the(spec.b)} have ${plural} of ${spec.same ? 'the same' : 'different'} parity.`;
    }
    case 'totalCompare': {
      const under: Stat = spec.over === 'weight' ? 'volatility' : 'weight';
      return `The total ${spec.over} is ${spec.strict ? 'greater than' : 'no less than'} the total ${under}.`;
    }
    case 'conditionalOrigin':
      return `If ${the(spec.ifSlot)} is ${spec.ifOrigin}, ${the(spec.thenSlot)} is ${spec.is ? '' : 'not '}${spec.thenOrigin}.`;
    case 'diffBound': {
      const plural = spec.stat === 'weight' ? 'weights' : 'volatilities';
      return `The ${plural} of ${the(spec.a)} and ${the(spec.b)} differ by ${spec.op === 'atLeast' ? 'at least' : 'at most'} ${spec.n}.`;
    }
    case 'sumVsOne':
      return `${The(spec.slot)} is ${spec.greater ? heavier(spec.stat, true) : noLess(spec.stat, false)} than the other two components combined.`;
    case 'shareFraction': {
      const frac = FRACTION[spec.den];
      const subject = spec.ifOrigin
        ? `${capitalise(article(spec.ifOrigin))} ${spec.ifOrigin} ${spec.slot}`
        : The(spec.slot);
      if (spec.ifOrigin) {
        return spec.moreThan
          ? `${subject} must account for more than ${frac} of the total ${spec.stat}.`
          : `${subject} cannot account for more than ${frac} of the total ${spec.stat}.`;
      }
      return spec.moreThan
        ? `${subject} accounts for more than ${frac} of the total ${spec.stat}.`
        : `${subject} accounts for no more than ${frac} of the total ${spec.stat}.`;
    }
    case 'pairingAny':
      return spec.only
        ? `${name(spec.id)} must be paired with ${article(spec.origin)} ${spec.origin} ingredient.`
        : `${name(spec.id)} cannot be paired with ${article(spec.origin)} ${spec.origin} ingredient.`;
    case 'pairedStat':
      return `${name(spec.id)} must be paired with ${article(heavier(spec.stat, spec.more))} ${heavier(spec.stat, spec.more)} ${spec.slot}.`;
    case 'ingredientTotal':
      return `${name(spec.id)} requires a total ${spec.stat} ${spec.op} ${spec.n}.`;
    case 'totalsConditional':
      return `A total ${spec.ifStat} ${spec.ifOp} ${spec.ifN} requires a total ${spec.thenStat} ${spec.thenOp} ${spec.thenN}.`;
    case 'extremeOrigin':
      return `The ${superlative(spec.stat, spec.most)} component ${spec.is ? 'must' : 'cannot'} be ${spec.origin} (ties included).`;
    case 'extremesShare':
      return `The ${superlative(spec.stat, true)} and ${superlative(spec.stat, false)} components ${spec.same ? 'must' : 'cannot'} share an origin (ties included).`;
    case 'slotOneOf':
      return `${The(spec.slot)} is ${listOr(spec.ids.map(name))}.`;
    case 'slotIs':
      return `${The(spec.slot)} is ${name(spec.id)}.`;
  }
}
