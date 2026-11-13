import { Ban, Undo2, Weight, Zap } from 'lucide-react';
import type { Ingredient } from '../engine/types';
import { OriginTag } from './origins';

interface Props {
  ingredient: Ingredient;
  placed: boolean;
  crossed: boolean;
  locked: boolean;
  onPlace: () => void;
  onCross: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function IngredientCard({ ingredient: ing, placed, crossed, locked, onPlace, onCross, onDragStart, onDragEnd }: Props) {
  const cls = ['card', placed && 'is-placed', crossed && 'is-crossed'].filter(Boolean).join(' ');
  return (
    <li className={cls}>
      <button
        type="button"
        className="card-main"
        disabled={locked}
        aria-pressed={placed}
        draggable={!locked}
        onClick={onPlace}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', ing.id);
          e.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }}
        onDragEnd={onDragEnd}
      >
        <OriginTag origin={ing.origin} />
        <span className="card-name">{ing.name}</span>
        <span className="card-stats">
          <span title="Weight">
            <Weight size={13} aria-hidden /> <span className="sr-only">Weight</span>
            {ing.weight}
          </span>
          <span title="Volatility">
            <Zap size={13} aria-hidden /> <span className="sr-only">Volatility</span>
            {ing.volatility}
          </span>
        </span>
      </button>
      {!locked && (
        <button
          type="button"
          className="card-cross"
          onClick={onCross}
          aria-label={crossed ? `Restore ${ing.name}` : `Cross out ${ing.name}`}
          title={crossed ? 'Restore' : 'Cross out'}
        >
          {crossed ? <Undo2 size={14} aria-hidden /> : <Ban size={14} aria-hidden />}
        </button>
      )}
    </li>
  );
}
