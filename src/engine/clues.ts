import { clause, hostSlot, holds, noun, isComponentFact, verb, type Fact } from './facts';
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

/** How a rule clue joins its two facts. */
export type Connective = 'requires' | 'excludes' | 'either' | 'xor' | 'iff';
/** A component picked out by rank: heaviest (top), middle, lightest (bottom); ties all count. */
export type RankPos = 'top' | 'middle' | 'bottom';

export type RankProp =
  | { p: 'slot'; slot: Slot; is: boolean }
  | { p: 'origin'; origin: Origin; is: boolean }
  | { p: 'alsoRank'; pos2: 'top' | 'bottom'; is: boolean } // rank on the other stat
  | { p: 'bound'; op: Strict; n: number } // the other stat
  | { p: 'parity'; even: boolean } // the other stat
  | { p: 'vsBottom'; more: boolean } // top only: the other stat, against the bottom
  | { p: 'share'; same: boolean } // top only: origin, against the bottom
  | { p: 'spread'; op: Bound; n: number } // top only: top minus bottom
  | { p: 'outweighs'; is: boolean } // top only: more than the other two combined
  | { p: 'value'; op: 'is' | Strict; n: number } // middle only
  | { p: 'valueParity'; even: boolean }; // middle only

export type AnyProp =
  | { p: 'vsSlot'; slot: Slot; stat: Stat }
  | { p: 'bound'; stat: Stat; op: Strict; n: number }
  | { p: 'parity'; stat: Stat; even: boolean }
  | { p: 'vsOrigin'; other: Origin; stat: Stat };

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
  | { kind: 'totalBound'; stat: Stat; op: Bound; n: number }
  | { kind: 'totalParity'; stat: Stat; even: boolean }
  | { kind: 'selfCompare'; slot: Slot; over: Stat; strict: boolean }
  | { kind: 'pairParity'; a: Slot; b: Slot; stat: Stat; same: boolean }
  | { kind: 'totalCompare'; over: Stat; strict: boolean }
  | { kind: 'diffBound'; a: Slot; b: Slot; stat: Stat; op: Bound; n: number }
  | { kind: 'sumVsOne'; slot: Slot; stat: Stat; greater: boolean }
  | { kind: 'shareFraction'; slot: Slot; stat: Stat; ifOrigin: Origin | null; moreThan: boolean; den: 2 | 3 | 4 }
  | { kind: 'rule'; conn: Connective; a: Fact; b: Fact }
  | { kind: 'rank'; stat: Stat; pos: RankPos; prop: RankProp }
  | { kind: 'anyOrigin'; origin: Origin; must: boolean; prop: AnyProp }
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
  totalBound: 3,
  totalParity: 3,
  selfCompare: 3,
  pairParity: 4,
  totalCompare: 4,
  diffBound: 4,
  sumVsOne: 4,
  shareFraction: 5,
  // The composite kinds below vary by part; see clueLevel.
  rule: 4,
  rank: 3,
  anyOrigin: 3,
};

const RANK_LEVEL: Record<RankProp['p'], number> = {
  slot: 3,
  origin: 3,
  bound: 3,
  parity: 3,
  value: 3,
  valueParity: 3,
  share: 3,
  alsoRank: 4,
  vsBottom: 4,
  spread: 4,
  outweighs: 4,
};

export function clueLevel(spec: ClueSpec): number {
  switch (spec.kind) {
    case 'rule':
      if (spec.conn === 'xor' || spec.conn === 'iff') return 5;
      if (spec.conn === 'either') return 4;
      return spec.a.f === 'has' ? 3 : 4;
    case 'rank':
      return RANK_LEVEL[spec.prop.p];
    case 'anyOrigin':
      return spec.prop.p === 'vsSlot' || spec.prop.p === 'vsOrigin' ? 4 : 3;
    default:
      return CLUE_LEVEL[spec.kind];
  }
}

/** A finer grouping than kind, so the generator can spread its picks across clue shapes. */
export function clueFamily(spec: ClueSpec): string {
  switch (spec.kind) {
    case 'rule':
      return `rule:${spec.conn}${spec.a.f === 'has' ? ':ingredient' : ''}`;
    case 'rank':
      return `rank:${spec.prop.p}`;
    case 'anyOrigin':
      return `any:${spec.prop.p}`;
    default:
      return spec.kind;
  }
}

const others = (slot: Slot): Slot[] => (['base', 'catalyst', 'binder'] as Slot[]).filter((s) => s !== slot);
const parts = (c: Combo): Ingredient[] => [c.base, c.catalyst, c.binder];
const total = (c: Combo, stat: Stat) => c.base[stat] + c.catalyst[stat] + c.binder[stat];
const isEven = (n: number) => n % 2 === 0;
const beyond = (v: number, op: Strict, n: number) => (op === 'over' ? v > n : v < n);

const SLOT_ORDER: Slot[] = ['base', 'catalyst', 'binder'];
const otherStat = (stat: Stat): Stat => (stat === 'weight' ? 'volatility' : 'weight');

/** Value at a rank: highest, middle or lowest of the three. */
function rankValue(c: Combo, stat: Stat, pos: RankPos): number {
  const x = c.base[stat];
  const y = c.catalyst[stat];
  const z = c.binder[stat];
  if (pos === 'top') return Math.max(x, y, z);
  if (pos === 'bottom') return Math.min(x, y, z);
  return x + y + z - Math.max(x, y, z) - Math.min(x, y, z);
}

/** Components at a rank. Ties all count: two components tied for heaviest are both "the heaviest". */
export function rankSlots(c: Combo, stat: Stat, pos: RankPos): Slot[] {
  const v = rankValue(c, stat, pos);
  return SLOT_ORDER.filter((s) => c[s][stat] === v);
}

function ruleHolds(conn: Connective, a: Fact, b: Fact, c: Combo): boolean {
  const host = a.f === 'has' ? hostSlot(c, a.id) : null;
  const A = holds(a, c);
  const B = holds(b, c, host);
  switch (conn) {
    case 'requires':
      return !A || B;
    case 'excludes':
      return !(A && B);
    case 'either':
      return A || B;
    case 'xor':
      return A !== B;
    case 'iff':
      return A === B;
  }
}

function rankHolds(spec: Extract<ClueSpec, { kind: 'rank' }>, c: Combo): boolean {
  const { stat, pos, prop } = spec;
  const members = rankSlots(c, stat, pos);
  const o = otherStat(stat);
  switch (prop.p) {
    case 'slot':
      return prop.is ? members.length === 1 && members[0] === prop.slot : !members.includes(prop.slot);
    case 'origin':
      return members.every((s) => (c[s].origin === prop.origin) === prop.is);
    case 'alsoRank': {
      const second = rankSlots(c, o, prop.pos2);
      return members.every((s) => second.includes(s) === prop.is);
    }
    case 'bound':
      return members.every((s) => beyond(c[s][o], prop.op, prop.n));
    case 'parity':
      return members.every((s) => isEven(c[s][o]) === prop.even);
    case 'vsBottom': {
      const bottom = rankSlots(c, stat, 'bottom');
      return members.every((h) => bottom.every((l) => h === l || (prop.more ? c[h][o] > c[l][o] : c[h][o] < c[l][o])));
    }
    case 'share': {
      const bottom = rankSlots(c, stat, 'bottom');
      return members.every((h) => bottom.every((l) => h === l || (c[h].origin === c[l].origin) === prop.same));
    }
    case 'spread': {
      const d = rankValue(c, stat, 'top') - rankValue(c, stat, 'bottom');
      return prop.op === 'atLeast' ? d >= prop.n : d <= prop.n;
    }
    case 'outweighs': {
      const top = rankValue(c, stat, 'top');
      return (top * 2 > total(c, stat)) === prop.is;
    }
    case 'value': {
      const v = rankValue(c, stat, 'middle');
      return prop.op === 'is' ? v === prop.n : beyond(v, prop.op, prop.n);
    }
    case 'valueParity':
      return isEven(rankValue(c, stat, 'middle')) === prop.even;
  }
}

function anyHolds(spec: Extract<ClueSpec, { kind: 'anyOrigin' }>, c: Combo): boolean {
  const { origin, must, prop } = spec;
  for (const s of SLOT_ORDER) {
    if (c[s].origin !== origin) continue;
    switch (prop.p) {
      case 'vsSlot':
        if (s !== prop.slot && c[s][prop.stat] > c[prop.slot][prop.stat] !== must) return false;
        break;
      case 'bound':
        if (beyond(c[s][prop.stat], prop.op, prop.n) !== must) return false;
        break;
      case 'parity':
        if (isEven(c[s][prop.stat]) !== prop.even) return false;
        break;
      case 'vsOrigin':
        for (const t of SLOT_ORDER)
          if (t !== s && c[t].origin === prop.other && c[s][prop.stat] > c[t][prop.stat] !== must) return false;
        break;
    }
  }
  return true;
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
    case 'rule':
      return ruleHolds(spec.conn, spec.a, spec.b, c);
    case 'rank':
      return rankHolds(spec, c);
    case 'anyOrigin':
      return anyHolds(spec, c);
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
      return `${name(spec.id)} ${verb(spec.id, 'is', 'are')} not in the potion.`;
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
    case 'rule':
      return describeRule(spec.conn, spec.a, spec.b);
    case 'rank':
      return describeRank(spec);
    case 'anyOrigin':
      return describeAny(spec);
    case 'slotOneOf':
      return `${The(spec.slot)} is ${listOr(spec.ids.map(name))}.`;
    case 'slotIs':
      return `${The(spec.slot)} is ${name(spec.id)}.`;
  }
}

function describeRule(conn: Connective, a: Fact, b: Fact): string {
  switch (conn) {
    case 'requires':
      return isComponentFact(a) && isComponentFact(b)
        ? `${capitalise(noun(a))} must be paired with ${noun(b)}.`
        : `${capitalise(noun(a))} ${a.f === 'has' ? verb(a.id, 'requires', 'require') : 'requires'} ${noun(b)}.`;
    case 'excludes':
      return `${capitalise(noun(a))} cannot be paired with ${noun(b)}.`;
    case 'either':
      return `At least one of these is true: ${clause(a)}, or ${clause(b)}.`;
    case 'xor':
      return `Exactly one of these is true: ${clause(a)}, or ${clause(b)}.`;
    case 'iff':
      return `${capitalise(clause(a))} if and only if ${clause(b)}.`;
  }
}

function rankName(stat: Stat, pos: RankPos): string {
  if (pos === 'middle') return stat === 'weight' ? 'middle-weight' : 'middle-volatility';
  return superlative(stat, pos === 'top');
}

function describeRank(spec: Extract<ClueSpec, { kind: 'rank' }>): string {
  const { stat, pos, prop } = spec;
  const subject = `The ${rankName(stat, pos)} component`;
  const o = otherStat(stat);
  switch (prop.p) {
    case 'slot':
      return `${subject} is ${prop.is ? '' : 'not '}the ${prop.slot}.`;
    case 'origin':
      return `${subject} ${prop.is ? 'must' : 'cannot'} be ${prop.origin}.`;
    case 'alsoRank':
      return prop.is
        ? `${subject} is also the ${superlative(o, prop.pos2 === 'top')}.`
        : `${subject} cannot also be the ${superlative(o, prop.pos2 === 'top')}.`;
    case 'bound':
      return o === 'weight'
        ? `${subject} weighs ${prop.op === 'over' ? 'more' : 'less'} than ${prop.n}.`
        : `${subject} has a volatility ${prop.op} ${prop.n}.`;
    case 'parity':
      return `${subject}'s ${o} is ${prop.even ? 'even' : 'odd'}.`;
    case 'vsBottom':
      return `${subject} is ${heavier(o, prop.more)} than the ${superlative(stat, false)}.`;
    case 'share':
      return `The ${superlative(stat, true)} and ${superlative(stat, false)} components ${prop.same ? 'must' : 'cannot'} share an origin.`;
    case 'spread': {
      const pair = stat === 'weight' ? 'The heaviest and lightest components' : 'The most and least volatile components';
      return `${pair} differ in ${stat} by ${prop.op === 'atLeast' ? 'at least' : 'at most'} ${prop.n}.`;
    }
    case 'outweighs':
      return stat === 'weight'
        ? `${subject} ${prop.is ? 'weighs' : 'does not weigh'} more than the other two combined.`
        : `${subject} ${prop.is ? 'is' : 'is not'} more volatile than the other two combined.`;
    case 'value':
      return `The middle ${stat} is ${prop.op === 'is' ? '' : `${prop.op} `}${prop.n}.`;
    case 'valueParity':
      return `The middle ${stat} is ${prop.even ? 'even' : 'odd'}.`;
  }
}

function describeAny(spec: Extract<ClueSpec, { kind: 'anyOrigin' }>): string {
  const { origin, must, prop } = spec;
  const subject = `Any ${origin} component ${must ? 'must' : 'cannot'}`;
  switch (prop.p) {
    case 'vsSlot':
      return `${subject} be ${heavier(prop.stat, true)} than the ${prop.slot}.`;
    case 'bound':
      return prop.stat === 'weight'
        ? `${subject} weigh ${prop.op === 'over' ? 'more' : 'less'} than ${prop.n}.`
        : `${subject} have a volatility ${prop.op} ${prop.n}.`;
    case 'parity':
      return `${subject} have ${prop.even ? 'an even' : 'an odd'} ${prop.stat}.`;
    case 'vsOrigin':
      return must
        ? `${subject} be ${heavier(prop.stat, true)} than any ${prop.other} component.`
        : `No ${origin} component can be ${heavier(prop.stat, true)} than ${article(prop.other)} ${prop.other} component.`;
  }
}
