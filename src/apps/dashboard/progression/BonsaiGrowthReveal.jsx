import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useDocumentVisibility } from '@/ui-kit/hooks/useDocumentVisibility.js';
import {
  createBonsaiGrowthRevealAcknowledgedRecord,
  readBonsaiGrowthRevealRecord,
  resolveBonsaiGrowthRevealState,
  writeBonsaiGrowthRevealRecord,
} from './bonsaiGrowthRevealState.js';

const BONSAI_GROWTH_REVEAL_AUTO_ACK_MS = 2800;

export default function BonsaiGrowthReveal({
  unlockProgress = null,
  ready = false,
} = {}) {
  const documentVisible = useDocumentVisibility();
  const presentationReady = ready && documentVisible;
  const [record, setRecord] = useState(readBonsaiGrowthRevealRecord);
  const reveal = useMemo(() => resolveBonsaiGrowthRevealState({
    unlockProgress,
    record,
  }), [record, unlockProgress]);

  const acknowledge = useCallback(() => {
    if (!unlockProgress || unlockProgress.debugOverrideActive === true) return;
    const nextRecord = createBonsaiGrowthRevealAcknowledgedRecord(unlockProgress);
    writeBonsaiGrowthRevealRecord(nextRecord);
    setRecord(nextRecord);
  }, [unlockProgress]);

  useEffect(() => {
    if (!unlockProgress || !reveal.alignmentRequired) return;
    acknowledge();
  }, [acknowledge, reveal.alignmentRequired, unlockProgress]);

  useEffect(() => {
    if (!presentationReady || !reveal.active) return undefined;
    const timeoutId = globalThis.setTimeout(
      acknowledge,
      BONSAI_GROWTH_REVEAL_AUTO_ACK_MS,
    );
    return () => globalThis.clearTimeout(timeoutId);
  }, [acknowledge, presentationReady, reveal.active, reveal.toDayCount]);

  if (!presentationReady || !reveal.active) return null;

  return <ZenBonsaiGrowthRevealCard reveal={reveal} onAcknowledge={acknowledge} />;
}

// The same presentation is used by the finite visual harness without starting
// the acknowledgement timer or writing a progression preview to browser storage.
export function ZenBonsaiGrowthRevealCard({ reveal, onAcknowledge }) {
  const { t } = useAppTranslation('main');
  return (
    <div
      className="zen-bonsai-growth-reveal pointer-events-none absolute inset-x-3 bottom-3 z-20 flex justify-center"
      role="status"
      aria-live="polite"
      data-testid="bonsai-growth-reveal"
    >
      <div className="zen-bonsai-growth-reveal-card pointer-events-auto">
        <div className="min-w-0 flex-1">
          <p className="zen-bonsai-growth-reveal-card__eyebrow">
            {t('target_protocol.bonsai_growth_reveal_eyebrow')}
          </p>
          <p className="zen-bonsai-growth-reveal-card__title">
            {t('target_protocol.bonsai_growth_reveal_title', {
              count: reveal.deltaDayCount,
            })}
          </p>
          <p className="zen-bonsai-growth-reveal-card__progress">
            {t('target_protocol.bonsai_growth_reveal_progress', {
              from: reveal.fromDayCount,
              to: reveal.toDayCount,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={onAcknowledge}
          className="zen-bonsai-growth-reveal-card__ack"
        >
          {t('target_protocol.bonsai_growth_reveal_ack')}
        </button>
      </div>
    </div>
  );
}
