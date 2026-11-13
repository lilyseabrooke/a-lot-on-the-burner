import { Check, FlaskConical, X } from 'lucide-react';
import { useState } from 'react';
import { ingredient } from '../engine/roster';
import { SLOTS, type Combo, type Ingredient, type Slot } from '../engine/types';
import type { DayRecord } from '../game/storage';
import { OriginTag } from './origins';

interface Props {
  record: DayRecord;
  solution: Combo;
  dragging: Ingredient | null;
  onDrop: (slot: Slot, id: string) => void;
  onClear: (slot: Slot) => void;
  onBrew: () => void;
}

export function BrewStation({ record, solution, dragging, onDrop, onClear, onBrew }: Props) {
  const [over, setOver] = useState<Slot | null>(null);
  const finished = record.status !== 'playing';
  const ready = SLOTS.every((s) => record.placed[s]);

  return (
    <section className="station" aria-label="Brewing station">
      <div className="slots">
        {SLOTS.map((slot) => {
          const id = record.placed[slot];
          const ing = id ? ingredient(id) : null;
          const accepts = !finished && dragging?.slot === slot;
          const correct = finished && id === solution[slot].id;
          const cls = [
            'slot',
            ing && 'is-filled',
            accepts && 'is-accepting',
            over === slot && accepts && 'is-over',
            finished && (correct ? 'is-correct' : 'is-wrong'),
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={slot}
              className={cls}
              onDragOver={(e) => {
                if (!accepts) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setOver(slot);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const dropped = e.dataTransfer.getData('text/plain');
                if (accepts && dropped) onDrop(slot, dropped);
              }}
            >
              <span className="eyebrow slot-label">
                {slot}
                {finished && (correct ? <Check size={13} aria-label="correct" /> : <X size={13} aria-label="incorrect" />)}
              </span>
              {ing ? (
                <>
                  <span className="slot-name">{ing.name}</span>
                  <OriginTag origin={ing.origin} />
                  {!finished && (
                    <button type="button" className="slot-clear" onClick={() => onClear(slot)} aria-label={`Remove ${ing.name}`}>
                      <X size={14} aria-hidden />
                    </button>
                  )}
                </>
              ) : (
                <span className="slot-empty">Choose a {slot}</span>
              )}
            </div>
          );
        })}
      </div>
      {!finished && (
        <button type="button" className="button button-primary brew-button" disabled={!ready} onClick={onBrew}>
          <FlaskConical size={18} aria-hidden />
          Brew
        </button>
      )}
    </section>
  );
}
