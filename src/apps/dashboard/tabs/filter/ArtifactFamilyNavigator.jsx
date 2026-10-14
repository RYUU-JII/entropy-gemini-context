import React from 'react';
import { Aperture, BellRing, Blinds, Hand, Waves } from 'lucide-react';
import { BarrierIcon } from '@/ui-kit/Icons.jsx';
import {
  getDashboardStateTransitionStyle,
  getInteractionMotionStyle,
} from '@/themes/core/motion/index.js';

const FAMILY_ICONS = Object.freeze({
  lens: Aperture,
  veil: Blinds,
  brake: Hand,
  barrier: BarrierIcon,
  flare: BellRing,
  echo: Waves,
});
const FILTER_NAV_INTERACTION_STYLE = getInteractionMotionStyle('stable');
const FILTER_NAV_CARD_STYLE = getDashboardStateTransitionStyle('filter.navigator.card');

export default function ArtifactNavigator({
  artifacts = [],
  activeArtifactId = '',
  onSelect,
}) {
  return (
    <div className="grid gap-2 border-b border-border/15 bg-surface-sunken/20 p-3 md:grid-cols-5" style={FILTER_NAV_INTERACTION_STYLE}>
      {artifacts.map((artifact) => {
        const Icon = FAMILY_ICONS[artifact.id];
        const isActive = artifact.id === activeArtifactId;

        return (
          <button
            key={artifact.id}
            type="button"
            onClick={() => onSelect?.(artifact.id)}
            className={[
              'rounded-[16px] border px-4 py-3 text-left',
              isActive
                ? 'border-accent/35 bg-accent/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]'
                : 'border-border/15 bg-surface hover:bg-surface-elevated/20',
            ].join(' ')}
            style={FILTER_NAV_CARD_STYLE}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-muted/70">
                  {artifact.eyebrow}
                </div>
                <div className="mt-1 text-base font-semibold text-on-surface">
                  {artifact.title}
                </div>
              </div>
              <div
                className={[
                  'rounded-[10px] p-2',
                  isActive ? 'bg-accent/15 text-accent' : 'bg-surface-elevated/40 text-on-surface-muted',
                ].join(' ')}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
              </div>
            </div>

            <p className="mt-3 min-h-[40px] text-xs leading-relaxed text-on-surface-muted">
              {artifact.description}
            </p>

            <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-muted/80">
              {artifact.meta}
            </div>
          </button>
        );
      })}
    </div>
  );
}
