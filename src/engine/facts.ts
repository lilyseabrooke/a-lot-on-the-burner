import { ingredient } from './roster';
import { SLOTS, type Combo, type Origin, type Slot, type Stat } from './types';

/*
 * FACTS: the simple statements that rule clues ("A requires B", "A cannot be paired with B",
 * "A if and only if B", …) are built from. Every fact can be read two ways:
 *   noun   – "a natural base", "a total weight over 12"   (for "requires", "must be paired with")
 *   clause – "the base is natural", "the total weight is over 12"   (for "if and only if", lists)
 *
 * "Component" facts describe one component of the potion ("a natural base", "Contract Ink"), so
 * they read well after "paired with". The rest describe the whole potion.
 *
 * Two facts only make sense relative to a named ingredient (the host): "a natural ingredient"
 * (some other component is natural) and "a heavier binder" (heavier than the host).
 */

export type Strict = 'over' | 'under';
export type CountOp = 'none' | 'atLeastOne' | 'atLeastTwo' | 'atMostOne';

export type Fact =
  | { f: 'has'; id: string }
  | { f: 'origin'; slot: Slot; origin: Origin }
  | { f: 'otherOrigin'; origin: Origin } // host-relative
  | { f: 'relStat'; slot: Slot; stat: Stat; more: boolean } // host-relative
  | { f: 'othersShare'; same: boolean } // host-relative: the other two components
  | { f: 'slotStat'; slot: Slot; stat: Stat; op: Strict; n: number }
  | { f: 'slotParity'; slot: Slot; stat: Stat; even: boolean }
  | { f: 'cmp'; a: Slot; b: Slot; stat: Stat; strict: boolean }
  | { f: 'total'; stat: Stat; op: Strict; n: number }
  | { f: 'totalParity'; stat: Stat; even: boolean }
  | { f: 'count'; origin: Origin; count: CountOp }
  | { f: 'variety'; distinct: boolean }
  | { f: 'share'; a: Slot; b: Slot; same: boolean };

const total = (c: Combo, stat: Stat) => c.base[stat] + c.catalyst[stat] + c.binder[stat];
const beyond = (v: number, op: Strict, n: number) => (op === 'over' ? v > n : v < n);
const isEven = (n: number) => n % 2 === 0;

/** The slot a named ingredient sits in, if it is in this combo. */
export function hostSlot(c: Combo, id: string): Slot | null {
  for (const s of SLOTS) if (c[s].id === id) return s;
  return null;
}

/** Whether a fact holds. Host-relative facts need the host's slot (and are false without one). */
export function holds(f: Fact, c: Combo, host: Slot | null = null): boolean {
  switch (f.f) {
    case 'has':
      return hostSlot(c, f.id) !== null;
    case 'origin':
      return c[f.slot].origin === f.origin;
    case 'otherOrigin':
      return host !== null && SLOTS.some((s) => s !== host && c[s].origin === f.origin);
    case 'relStat': {
      if (host === null) return false;
      const v = c[host][f.stat];
      const o = c[f.slot][f.stat];
      return f.more ? o > v : o < v;
    }
    case 'othersShare': {
      if (host === null) return false;
      const [x, y] = SLOTS.filter((s) => s !== host);
      return (c[x].origin === c[y].origin) === f.same;
    }
    case 'slotStat':
      return beyond(c[f.slot][f.stat], f.op, f.n);
    case 'slotParity':
      return isEven(c[f.slot][f.stat]) === f.even;
    case 'cmp':
      return f.strict ? c[f.a][f.stat] > c[f.b][f.stat] : c[f.a][f.stat] >= c[f.b][f.stat];
    case 'total':
      return beyond(total(c, f.stat), f.op, f.n);
    case 'totalParity':
      return isEven(total(c, f.stat)) === f.even;
    case 'count': {
      const n = SLOTS.filter((s) => c[s].origin === f.origin).length;
      if (f.count === 'none') return n === 0;
      if (f.count === 'atLeastOne') return n >= 1;
      if (f.count === 'atLeastTwo') return n >= 2;
      return n <= 1;
    }
    case 'variety':
      return (new Set(SLOTS.map((s) => c[s].origin)).size === 3) === f.distinct;
    case 'share':
      return (c[f.a].origin === c[f.b].origin) === f.same;
  }
}

export const isComponentFact = (f: Fact) => ['has', 'origin', 'otherOrigin', 'relStat', 'slotStat'].includes(f.f);
/** Facts that read well as the subject of "… requires …" (a single thing, not a count or a pair). */
export const isSubjectFact = (f: Fact) => !['count', 'variety', 'share', 'otherOrigin', 'relStat', 'othersShare'].includes(f.f);
export const isHostRelative = (f: Fact) => f.f === 'otherOrigin' || f.f === 'relStat' || f.f === 'othersShare';

/** Slots a fact talks about directly (used to avoid pairing two facts about the same slot). */
export function factSlots(f: Fact): Slot[] {
  switch (f.f) {
    case 'has':
      return [ingredient(f.id).slot];
    case 'origin':
    case 'slotStat':
    case 'slotParity':
    case 'relStat':
      return [f.slot];
    case 'cmp':
    case 'share':
      return [f.a, f.b];
    default:
      return [];
  }
}

/** The opposite fact, when it reads naturally ("over 12" ↔ "under 13", "odd" ↔ "even"). */
export function negate(f: Fact): Fact | null {
  switch (f.f) {
    case 'slotStat':
      return { ...f, op: f.op === 'over' ? 'under' : 'over', n: f.op === 'over' ? f.n + 1 : f.n - 1 };
    case 'total':
      return { ...f, op: f.op === 'over' ? 'under' : 'over', n: f.op === 'over' ? f.n + 1 : f.n - 1 };
    case 'slotParity':
    case 'totalParity':
      return { ...f, even: !f.even };
    case 'cmp':
      return { f: 'cmp', a: f.b, b: f.a, stat: f.stat, strict: !f.strict };
    case 'count': {
      const opposite: Record<CountOp, CountOp> = { none: 'atLeastOne', atLeastOne: 'none', atLeastTwo: 'atMostOne', atMostOne: 'atLeastTwo' };
      return { ...f, count: opposite[f.count] };
    }
    case 'variety':
      return { ...f, distinct: !f.distinct };
    case 'share':
      return { ...f, same: !f.same };
    default:
      return null;
  }
}

// ---------------------------------------------------------------- wording

const name = (id: string) => ingredient(id).name;
/** Picks the verb form that agrees with an ingredient's name: verb(id, 'is', 'are'). */
export const verb = (id: string, singular: string, plural: string) => (ingredient(id).plural ? plural : singular);
const an = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

function compared(stat: Stat, more: boolean, strict = true): string {
  if (stat === 'weight') return strict ? (more ? 'heavier' : 'lighter') : more ? 'no lighter' : 'no heavier';
  return strict ? (more ? 'more volatile' : 'less volatile') : more ? 'no less volatile' : 'no more volatile';
}

const COUNT_NOUN: Record<CountOp, (o: Origin) => string> = {
  none: (o) => `no ${o} components`,
  atLeastOne: (o) => `at least one ${o} component`,
  atLeastTwo: (o) => `two or more ${o} components`,
  atMostOne: (o) => `at most one ${o} component`,
};
const COUNT_CLAUSE: Record<CountOp, (o: Origin) => string> = {
  none: (o) => `no component is ${o}`,
  atLeastOne: (o) => `at least one component is ${o}`,
  atLeastTwo: (o) => `at least two components are ${o}`,
  atMostOne: (o) => `at most one component is ${o}`,
};

/** "a natural base", "a total weight over 12", "Contract Ink". */
export function noun(f: Fact): string {
  switch (f.f) {
    case 'has':
      return name(f.id);
    case 'origin':
      return `${an(f.origin)} ${f.origin} ${f.slot}`;
    case 'otherOrigin':
      return `${an(f.origin)} ${f.origin} ingredient`;
    case 'relStat': {
      const adj = compared(f.stat, f.more);
      return `${an(adj)} ${adj} ${f.slot}`;
    }
    case 'othersShare':
      return f.same ? 'two other components of the same origin' : 'two other components of different origins';
    case 'slotStat':
      return f.stat === 'weight'
        ? `${an(f.slot)} ${f.slot} ${f.op === 'over' ? 'heavier' : 'lighter'} than ${f.n}`
        : `${an(f.slot)} ${f.slot} ${f.op === 'over' ? 'more' : 'less'} volatile than ${f.n}`;
    case 'slotParity':
      return `${f.even ? 'an even' : 'an odd'}-${f.stat} ${f.slot}`;
    case 'cmp':
      return `${an(f.a)} ${f.a} ${compared(f.stat, true, f.strict)} than the ${f.b}`;
    case 'total':
      return `a total ${f.stat} ${f.op} ${f.n}`;
    case 'totalParity':
      return `${f.even ? 'an even' : 'an odd'} total ${f.stat}`;
    case 'count':
      return COUNT_NOUN[f.count](f.origin);
    case 'variety':
      return f.distinct ? 'three different origins' : 'two components of the same origin';
    case 'share':
      return `${an(f.a)} ${f.a} and ${f.b} of ${f.same ? 'the same origin' : 'different origins'}`;
  }
}

/** "the base is natural", "the total weight is over 12", "Contract Ink is in the potion". */
export function clause(f: Fact): string {
  switch (f.f) {
    case 'has':
      return `${name(f.id)} ${verb(f.id, 'is', 'are')} in the potion`;
    case 'origin':
      return `the ${f.slot} is ${f.origin}`;
    case 'otherOrigin':
    case 'relStat':
    case 'othersShare':
      throw new Error('host-relative facts have no clause form');
    case 'slotStat':
      return f.stat === 'weight'
        ? `the ${f.slot} weighs ${f.op === 'over' ? 'more' : 'less'} than ${f.n}`
        : `the ${f.slot}'s volatility is ${f.op} ${f.n}`;
    case 'slotParity':
      return `the ${f.slot}'s ${f.stat} is ${f.even ? 'even' : 'odd'}`;
    case 'cmp':
      return `the ${f.a} is ${compared(f.stat, true, f.strict)} than the ${f.b}`;
    case 'total':
      return `the total ${f.stat} is ${f.op} ${f.n}`;
    case 'totalParity':
      return `the total ${f.stat} is ${f.even ? 'even' : 'odd'}`;
    case 'count':
      return COUNT_CLAUSE[f.count](f.origin);
    case 'variety':
      return f.distinct ? 'no two components share an origin' : 'at least two components share an origin';
    case 'share':
      return `the ${f.a} and the ${f.b} ${f.same ? 'share an origin' : 'do not share an origin'}`;
  }
}
