import type { Stats } from '../game/stats';
import { Distribution, StatTiles } from './Distribution';
import { Modal } from './Modal';

export function StatsModal({ open, onClose, stats }: { open: boolean; onClose: () => void; stats: Stats }) {
  return (
    <Modal open={open} onClose={onClose} eyebrow="Your record" title="Statistics">
      <StatTiles stats={stats} />
      <Distribution stats={stats} />
    </Modal>
  );
}
