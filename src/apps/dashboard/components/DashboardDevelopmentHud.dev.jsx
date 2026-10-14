import React, { useEffect, useId, useRef } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import ProgressionUnlockDebugControl from '@progression-unlock-debug-control';
import ZenAppearanceTimeControl from './ZenAppearanceTimeControl.jsx';
import JourneyProgress from '../guidance/JourneyProgress.jsx';

export default function DashboardDevelopmentHud({
  expanded,
  onExpandedChange,
  appearanceClock,
  progressionUnlockDisclosure,
}) {
  const { t } = useAppTranslation('tools');
  const panelId = useId();
  const titleId = useId();
  const launcherRef = useRef(null);
  const closeRef = useRef(null);
  const previouslyExpanded = useRef(false);

  useEffect(() => {
    if (expanded) closeRef.current?.focus({ preventScroll: true });
    else if (previouslyExpanded.current) launcherRef.current?.focus({ preventScroll: true });
    previouslyExpanded.current = expanded;
  }, [expanded]);

  return (
    <>
      {expanded ? (
        <aside
          id={panelId}
          aria-labelledby={titleId}
          className="pointer-events-auto max-h-[calc(100vh-64px)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface/95 text-on-surface shadow-xl backdrop-blur-xl"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            onExpandedChange(false);
          }}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-surface px-4 py-3">
            <h2 id={titleId} className="flex items-center gap-2 text-xs font-semibold">
              <SlidersHorizontal className="h-4 w-4 text-accent" />
              {t('development_tools.title')}
            </h2>
            <button
              ref={closeRef}
              type="button"
              aria-label={t('development_tools.close')}
              onClick={() => onExpandedChange(false)}
              className="rounded-full p-1.5 text-on-surface-muted hover:bg-surface-sunken hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4 p-4">
            <ZenAppearanceTimeControl
              mode={appearanceClock.mode}
              customHour={appearanceClock.customHour}
              onModeChange={appearanceClock.setMode}
              onCustomHourChange={appearanceClock.setCustomHour}
            />
            <div className="border-t border-border/50 pt-4">
              <ProgressionUnlockDebugControl disclosure={progressionUnlockDisclosure} embedded>
                <JourneyProgress developmentHud />
              </ProgressionUnlockDebugControl>
            </div>
          </div>
        </aside>
      ) : (
        <button
          ref={launcherRef}
          type="button"
          aria-label={t('development_tools.open')}
          aria-expanded={false}
          title={t('development_tools.open')}
          onClick={() => onExpandedChange(true)}
          className="pointer-events-auto flex h-16 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface/95 text-on-surface shadow-md backdrop-blur-xl hover:border-accent hover:text-accent"
        >
          <SlidersHorizontal className="h-5 w-5" />
          <span className="text-[9px] font-semibold tracking-wider">{t('development_tools.short_label')}</span>
        </button>
      )}
    </>
  );
}
