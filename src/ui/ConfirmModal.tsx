import { FlaskConical } from 'lucide-react';
import { ingredient } from '../engine/roster';
import { SLOTS, type Slot } from '../engine/types';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  placed: Partial<Record<Slot, string>>;
  revealed: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({ open, placed, revealed, onCancel, onConfirm }: Props) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      eyebrow="One brew only"
      title="Brew this potion?"
      actions={
        <>
          <button type="button" className="button button-ghost" onClick={onCancel}>
            Keep thinking
          </button>
          <button type="button" className="button button-primary" onClick={onConfirm}>
            <FlaskConical size={18} aria-hidden />
            Brew
          </button>
        </>
      }
    >
      <dl className="confirm-list">
        {SLOTS.map((slot) => (
          <div key={slot}>
            <dt className="eyebrow">{slot}</dt>
            <dd>{placed[slot] ? ingredient(placed[slot]!).name : '—'}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">
        You have revealed {revealed} clue{revealed === 1 ? '' : 's'}. There is no second attempt.
      </p>
    </Modal>
  );
}
