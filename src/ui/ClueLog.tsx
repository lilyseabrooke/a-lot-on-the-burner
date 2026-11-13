import { ScrollText } from 'lucide-react';
import { describe, type ClueSpec } from '../engine/clues';

interface Props {
  clues: ClueSpec[];
  revealed: number;
  finished: boolean;
  minClues: number;
  onReveal: () => void;
}

export function ClueLog({ clues, revealed, finished, minClues, onReveal }: Props) {
  // Once the day is over, also show any unrevealed clues up to the minimum so the player can see the path.
  const shown = clues.slice(0, finished ? Math.max(revealed, minClues) : revealed);
  const exhausted = revealed >= clues.length;
  return (
    <section className="clues" aria-label="Clues">
      <div className="clues-head">
        <h2 className="section-title">Clues</h2>
        <span className="clue-count">{revealed} revealed</span>
      </div>
      <ol className="clue-list">
        {shown.map((clue, i) => (
          <li
            key={i}
            className={[finished && i + 1 === minClues && 'is-minimum', i >= revealed && 'is-unrevealed'].filter(Boolean).join(' ') || undefined}
          >
            <span className="clue-number">{i + 1}</span>
            <span className="clue-text">{describe(clue)}</span>
            {finished && i + 1 === minClues && <span className="clue-flag">Minimum</span>}
            {i >= revealed && <span className="clue-flag clue-flag-muted">Not revealed</span>}
          </li>
        ))}
      </ol>
      {!finished && (
        <button type="button" className="button button-secondary reveal-button" onClick={onReveal} disabled={exhausted}>
          <ScrollText size={16} aria-hidden />
          {exhausted ? 'No clues remain' : 'Reveal another clue'}
        </button>
      )}
    </section>
  );
}
