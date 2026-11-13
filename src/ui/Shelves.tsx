import { ArrowDownUp, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { ingredient } from '../engine/roster';
import { ORIGINS, SLOTS, type Available, type Ingredient, type Slot } from '../engine/types';
import { fx } from './fx';
import { PRESS_SCALE, spring } from './motion';
import { Tile } from './Tile';

export type SortKey = 'name' | 'origin' | 'weight' | 'volatility';
export const SORTS: SortKey[] = ['name', 'origin', 'weight', 'volatility'];
const SORT_LABEL: Record<SortKey, string> = { name: 'Name', origin: 'Origin', weight: 'Weight', volatility: 'Volatility' };

const PLURAL: Record<Slot, string> = { base: 'Bases', catalyst: 'Catalysts', binder: 'Binders' };

function sorted(items: Ingredient[], key: SortKey): Ingredient[] {
  const byName = (a: Ingredient, b: Ingredient) => a.name.localeCompare(b.name);
  return [...items].sort((a, b) => {
    if (key === 'name') return byName(a, b);
    if (key === 'origin') return ORIGINS.indexOf(a.origin) - ORIGINS.indexOf(b.origin) || byName(a, b);
    return b[key] - a[key] || byName(a, b);
  });
}

interface Props {
  available: Available;
  placed: Partial<Record<Slot, string>>;
  crossed: string[];
  locked: boolean;
  notes: boolean;
  tab: Slot;
  /** -1 or 1: which way the shelf slides when the tab changes. */
  tabDir: number;
  sort: SortKey;
  onTab: (slot: Slot) => void;
  onSort: () => void;
  onPlace: (ing: Ingredient) => void;
  onCross: (id: string) => void;
  onDragStart: (ing: Ingredient) => void;
  onDragMove: (ing: Ingredient, point: { x: number; y: number }) => void;
  onDrop: (ing: Ingredient, point: { x: number; y: number }) => void;
}

export function Shelves(p: Props) {
  const rows = Math.ceil(Math.max(...SLOTS.map((s) => p.available[s].length)) / 3);
  const items = sorted(p.available[p.tab].map(ingredient), p.sort);

  return (
    <section className={`shelf${p.notes ? ' is-notes' : ''}`} aria-label="Ingredients">
      <div className="shelf-bar">
        <div className="tabs" role="tablist" aria-label="Ingredient shelves">
          {SLOTS.map((s) => (
            <motion.button
              key={s}
              type="button"
              role="tab"
              aria-selected={p.tab === s}
              className="tab"
              onClick={() => {
                if (s !== p.tab) fx('tab');
                p.onTab(s);
              }}
              whileTap={{ scale: PRESS_SCALE }}
              transition={spring.snappy}
            >
              {p.tab === s && <motion.span layoutId="tab-pill" className="tab-pill" transition={spring.snappy} />}
              <span className="tab-label">
                {PLURAL[s]}
                {p.placed[s] && <Check size={12} strokeWidth={3} className="tab-check" aria-label="filled" />}
              </span>
            </motion.button>
          ))}
        </div>
        <motion.button
          type="button"
          className="sort-button"
          onClick={() => {
            fx('tap');
            p.onSort();
          }}
          whileTap={{ scale: PRESS_SCALE }}
          transition={spring.snappy}
          aria-label={`Sorted by ${SORT_LABEL[p.sort]}. Change sort`}
        >
          <ArrowDownUp size={13} strokeWidth={2.4} aria-hidden />
          <motion.span key={p.sort} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={spring.snappy}>
            {SORT_LABEL[p.sort]}
          </motion.span>
        </motion.button>
      </div>

      <motion.ul
        key={p.tab}
        className="tile-grid"
        role="tabpanel"
        style={{ ['--rows' as string]: rows }}
        initial={{ opacity: 0, x: 24 * p.tabDir }}
        animate={{ opacity: 1, x: 0 }}
        transition={spring.gentle}
      >
        {items.map((ing) => (
          <li key={ing.id}>
            {p.placed[p.tab] === ing.id ? (
              <span className="tile-ghost" aria-label={`${ing.name} is in the ${p.tab} slot`} />
            ) : (
              <Tile
                ingredient={ing}
                crossed={p.crossed.includes(ing.id)}
                locked={p.locked}
                onPress={() => (p.notes ? p.onCross(ing.id) : p.onPlace(ing))}
                onLongPress={() => p.onCross(ing.id)}
                onDragStart={() => p.onDragStart(ing)}
                onDragMove={(pt) => p.onDragMove(ing, pt)}
                onDrop={(pt) => p.onDrop(ing, pt)}
              />
            )}
          </li>
        ))}
      </motion.ul>
    </section>
  );
}
