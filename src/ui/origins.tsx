import { Cog, Flame, Ghost, Leaf, Orbit, Skull, Weight, Zap, type LucideIcon } from 'lucide-react';
import type { Origin } from '../engine/types';

export const ORIGIN_ICON: Record<Origin, LucideIcon> = {
  natural: Leaf,
  artificial: Cog,
  extraplanar: Orbit,
  demonic: Skull,
  draconic: Flame,
  spectral: Ghost,
};

/** Coloured origin glyph; the name is available to assistive tech and on hover. */
export function OriginGlyph({ origin, withLabel }: { origin: Origin; withLabel?: boolean }) {
  const Icon = ORIGIN_ICON[origin];
  return (
    <span className={`origin origin-${origin}`} title={origin}>
      <Icon aria-hidden size={14} strokeWidth={2.2} />
      {withLabel ? origin : <span className="sr-only">{origin}</span>}
    </span>
  );
}

export function StatPair({ weight, volatility }: { weight: number; volatility: number }) {
  return (
    <span className="stats" aria-hidden>
      <span title="Weight">
        <Weight size={11} strokeWidth={2.4} />
        {weight}
      </span>
      <span title="Volatility">
        <Zap size={11} strokeWidth={2.4} />
        {volatility}
      </span>
    </span>
  );
}
