import { Modal } from './Modal';

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="How to play"
      title="A Lot on the Burner"
      actions={
        <button type="button" className="button button-primary" onClick={onClose}>
          Light the burner
        </button>
      }
    >
      <div className="prose">
        <p>Each day brings one potion to brew. It takes one base, one catalyst and one binder.</p>
        <ul>
          <li>Every ingredient has an origin, a weight and a volatility.</li>
          <li>You start with one clue. Reveal more whenever you like, but each one counts.</li>
          <li>
            Every puzzle has a <strong>minimum</strong>: the number of clues after which only one potion fits. You are
            not told what it is. Any clue could be the last one you need.
          </li>
          <li>You get one brew. Get it right and you will see how close to the minimum you came. Get it wrong and the day is lost.</li>
          <li>Tap an ingredient to place it, or drag it to its slot. Use the cross to rule an ingredient out in your notes.</li>
          <li>The Intensity Rank, from 5 to 30, shows how hard the day's puzzle is. Anything above 20 is rare.</li>
        </ul>
        <p className="muted">A new puzzle arrives at midnight, your local time.</p>
      </div>
    </Modal>
  );
}
