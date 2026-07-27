import { Check, Sparkles } from 'lucide-react';
import type { Destination } from '@/shared/types';

export function DestinationOption({
  destination,
  selected,
  recommended,
  reason,
  onSelect,
}: {
  destination: Destination;
  selected: boolean;
  recommended: boolean;
  reason?: string;
  onSelect: () => void;
}) {
  return (
    <button
      className={`destination-option${selected ? ' is-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="radio-dot" aria-hidden="true">
        {selected ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span className="destination-copy">
        <span className="destination-name">{destination.name}</span>
        <span className="destination-meta">
          {recommended ? (reason ?? 'Routing rule matched') : 'Clay table'}
        </span>
      </span>
      {recommended ? <Sparkles size={15} className="recommend-icon" aria-hidden="true" /> : null}
    </button>
  );
}
