import React from 'react';

import './artifactPathIndex.css';

function ThresholdStroke({ direction }) {
  const tip = direction === 'next' ? 'M9 9.5l4 6.5-4 6.5' : 'M13 9.5l-4 6.5 4 6.5';
  return (
    <svg viewBox="0 0 22 32" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <path d={tip} strokeWidth="1.3" />
    </svg>
  );
}

/**
 * ArtifactPathIndex
 * The gallery as a walked path: only the neighbouring artifacts can be reached.
 *
 * - Two edge thresholds step to the previous / next artifact and wrap at the
 *   ends. They are near-invisible until approached; the parent also maps
 *   arrow keys, wheel and swipe gestures to the same single step.
 * - No visible position index competes with the scene. Locked families are
 *   skipped by every step. Read-only DOM metadata exposes the ordered inventory
 *   and selection to the existing QA readers without decorative stand-ins.
 * - The control panel owns the visible name; a polite live region announces
 *   the artifact and position after each step.
 */
export default function ArtifactPathIndex({
  slots,
  activeIndex,
  pendingIndex = null,
  selectionPhase = 'idle',
  inkColor,
  ariaLabel,
  positionAnnouncement,
  previous,
  next,
  onStep,
  onIntent,
  errorContent = null,
}) {
  const activeSlot = slots.find((slot) => slot.kind === 'artifact' && slot.itemIndex === activeIndex);
  if (!activeSlot) throw new Error('[ArtifactPathIndex] Selected artifact must exist in the path inventory.');
  const isSelectionPending = pendingIndex !== null && (selectionPhase === 'pending' || selectionPhase === 'requested');
  const thresholds = [
    { direction: 'previous', step: -1, ...previous },
    { direction: 'next', step: 1, ...next },
  ];

  return (
    <nav
      data-artifact-gallery-index="path"
      data-artifact-path-order={slots.map((slot) => slot.familyId).join('|')}
      data-artifact-path-locked={slots.filter((slot) => slot.kind === 'locked').map((slot) => slot.familyId).join('|')}
      data-artifact-path-current={activeSlot.familyId}
      className="artifact-path"
      aria-label={ariaLabel}
      aria-busy={isSelectionPending ? 'true' : undefined}
      style={{ '--artifact-path-ink': inkColor }}
    >
      {thresholds.map((threshold) => (threshold.available ? (
        <button
          key={threshold.direction}
          type="button"
          className={`artifact-path__threshold artifact-path__threshold--${threshold.direction}`}
          data-artifact-path-threshold={threshold.direction}
          aria-label={threshold.label}
          aria-disabled={threshold.blocked ? 'true' : undefined}
          onClick={() => { if (!threshold.blocked) onStep(threshold.step); }}
          onFocus={threshold.blocked ? undefined : () => onIntent(threshold.step)}
          onPointerEnter={threshold.blocked ? undefined : () => onIntent(threshold.step)}
        >
          <span className="artifact-path__threshold-stroke">
            <ThresholdStroke direction={threshold.direction} />
          </span>
        </button>
      ) : null))}

      <p className="sr-only" aria-live="polite" aria-atomic="true">{positionAnnouncement}</p>
      {errorContent ? <div className="artifact-path__feedback">{errorContent}</div> : null}
    </nav>
  );
}
