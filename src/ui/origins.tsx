import { Cog, Flame, Ghost, Leaf, Orbit, Skull, type LucideIcon } from 'lucide-react';
import type { Origin } from '../engine/types';

export const ORIGIN_ICON: Record<Origin, LucideIcon> = {
  natural: Leaf,
  artificial: Cog,
  extraplanar: Orbit,
  demonic: Skull,
  draconic: Flame,
  spectral: Ghost,
};

export function OriginTag({ origin }: { origin: Origin }) {
  const Icon = ORIGIN_ICON[origin];
  return (
    <span className={`origin origin-${origin}`}>
      <Icon aria-hidden size={13} strokeWidth={2} />
      {origin}
    </span>
  );
}
