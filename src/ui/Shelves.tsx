import { ingredient } from '../engine/roster';
import { ORIGINS, SLOTS, type Available, type Ingredient, type Slot } from '../engine/types';
import { IngredientCard } from './IngredientCard';

export type SortKey = 'name' | 'weight' | 'volatility' | 'origin';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'origin', label: 'Origin' },
  { key: 'weight', label: 'Weight' },
  { key: 'volatility', label: 'Volatility' },
];

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
  sort: SortKey;
  onSort: (key: SortKey) => void;
  onPlace: (ing: Ingredient) => void;
  onCross: (id: string) => void;
  onDragStart: (ing: Ingredient) => void;
  onDragEnd: () => void;
}

export function Shelves({ available, placed, crossed, locked, sort, onSort, onPlace, onCross, onDragStart, onDragEnd }: Props) {
  return (
    <section className="shelves" aria-label="Ingredients">
      <div className="shelves-head">
        <h2 className="section-title">Ingredients</h2>
        <div className="segmented" role="group" aria-label="Sort ingredients by">
          {SORTS.map((s) => (
            <button key={s.key} type="button" aria-pressed={sort === s.key} onClick={() => onSort(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {SLOTS.map((slot) => {
        const items = sorted(available[slot].map(ingredient), sort);
        return (
          <div key={slot} className="shelf">
            <h3 className="eyebrow shelf-title">
              {PLURAL[slot]} <span className="shelf-count">· {items.length}</span>
            </h3>
            <ul className="card-grid">
              {items.map((ing) => (
                <IngredientCard
                  key={ing.id}
                  ingredient={ing}
                  placed={placed[slot] === ing.id}
                  crossed={crossed.includes(ing.id)}
                  locked={locked}
                  onPlace={() => onPlace(ing)}
                  onCross={() => onCross(ing.id)}
                  onDragStart={() => onDragStart(ing)}
                  onDragEnd={onDragEnd}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
