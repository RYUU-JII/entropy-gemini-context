import React, { useCallback, useMemo, useState } from 'react';
import { Play, RotateCcw, Waves } from 'lucide-react';

import {
  setProgressionUnlockDebugMode,
} from '@/apps/dashboard/progression/progressionUnlockDebugClient.js';
import {
  PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT,
} from '@/domains/progression/policy/progressionPreviewPolicy.js';
import {
  PROGRESSION_UNLOCK_DEBUG_MODES,
} from '@progression-debug-contract';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  CeremonyOverlay,
  MEMORY_PURGE_TIDE_CEREMONY_ID,
} from '@/platform/ceremony/index.js';

const CEREMONY_PREVIEW_ITEMS = Object.freeze([
  Object.freeze({
    id: 'memoryPurgeTide',
    ceremonyId: MEMORY_PURGE_TIDE_CEREMONY_ID,
    titleKey: 'experiment.ceremony_preview.items.memoryPurgeTide.title',
    descKey: 'experiment.ceremony_preview.items.memoryPurgeTide.desc',
    Icon: Waves,
  }),
]);

const FIRST_VISION_REPLAY_STATUS = Object.freeze({
  IDLE: 'idle',
  BUSY: 'busy',
  DONE: 'done',
  ERROR: 'error',
});

function getCeremonyTitle(t, item) {
  return t(item.titleKey);
}

function describeReplayError(error) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  const message = String(error || '').trim();
  return message || 'FIRST_VISION_PREVIEW_REQUEST_FAILED';
}

function reloadDashboardWindow() {
  if (typeof window === 'undefined' || typeof window.location?.reload !== 'function') {
    return;
  }
  window.location.reload();
}

export default function CeremonyPreviewLab({
  reloadDashboard = reloadDashboardWindow,
} = {}) {
  const { t } = useAppTranslation('tools');
  const [activePreview, setActivePreview] = useState(null);
  const [lastCeremonyId, setLastCeremonyId] = useState('');
  const [firstVisionReplayStatus, setFirstVisionReplayStatus] = useState(FIRST_VISION_REPLAY_STATUS.IDLE);
  const [firstVisionReplayError, setFirstVisionReplayError] = useState('');
  const activeCeremonyId = activePreview?.ceremonyId || '';
  const activeItem = useMemo(
    () => CEREMONY_PREVIEW_ITEMS.find((item) => item.ceremonyId === activeCeremonyId) || null,
    [activeCeremonyId],
  );
  const lastItem = useMemo(
    () => CEREMONY_PREVIEW_ITEMS.find((item) => item.ceremonyId === lastCeremonyId) || null,
    [lastCeremonyId],
  );
  const statusLabel = activeItem
    ? t('experiment.ceremony_preview.status_playing', {
      title: getCeremonyTitle(t, activeItem),
    })
    : lastItem
      ? t('experiment.ceremony_preview.status_last', {
        title: getCeremonyTitle(t, lastItem),
      })
      : t('experiment.ceremony_preview.status_idle');
  const firstVisionReplayBusy = firstVisionReplayStatus === FIRST_VISION_REPLAY_STATUS.BUSY;
  const firstVisionReplayStatusLabel = firstVisionReplayStatus === FIRST_VISION_REPLAY_STATUS.BUSY
    ? t('experiment.ceremony_preview.replay_first_vision.status_busy')
    : firstVisionReplayStatus === FIRST_VISION_REPLAY_STATUS.DONE
      ? t('experiment.ceremony_preview.replay_first_vision.status_done')
      : firstVisionReplayStatus === FIRST_VISION_REPLAY_STATUS.ERROR
        ? t('experiment.ceremony_preview.replay_first_vision.status_error', {
          error: firstVisionReplayError,
        })
        : t('experiment.ceremony_preview.replay_first_vision.status_idle');

  const handlePlay = useCallback((ceremonyId) => {
    setActivePreview({
      ceremonyId,
      key: `${ceremonyId}:${Date.now()}`,
      seed: 872342 + Math.floor(Date.now() % 100000),
    });
  }, []);

  const handleComplete = useCallback(({ ceremonyId } = {}) => {
    setLastCeremonyId(ceremonyId || activeCeremonyId);
    setActivePreview(null);
  }, [activeCeremonyId]);

  const handleReplayFirstVision = useCallback(async () => {
    setFirstVisionReplayStatus(FIRST_VISION_REPLAY_STATUS.BUSY);
    setFirstVisionReplayError('');
    try {
      await setProgressionUnlockDebugMode(
        PROGRESSION_UNLOCK_DEBUG_MODES.FIRST_VISION_PREVIEW,
        { dayCount: PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT },
      );
      setFirstVisionReplayStatus(FIRST_VISION_REPLAY_STATUS.DONE);
      reloadDashboard();
    } catch (error) {
      setFirstVisionReplayError(describeReplayError(error));
      setFirstVisionReplayStatus(FIRST_VISION_REPLAY_STATUS.ERROR);
    }
  }, [reloadDashboard]);

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-on-surface/10 bg-surface/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase text-on-surface-muted">
            {t('experiment.ceremony_preview.eyebrow')}
          </p>
          <h4 className="mt-1 text-sm font-bold text-on-surface">
            {t('experiment.ceremony_preview.title')}
          </h4>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-on-surface-muted">
            {t('experiment.ceremony_preview.desc')}
          </p>
        </div>
        <div className="ml-auto rounded-full bg-surface-sunken px-3 py-1 text-[10px] font-semibold text-on-surface-muted">
          {statusLabel}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {CEREMONY_PREVIEW_ITEMS.map((item) => {
          const Icon = item.Icon;
          const title = getCeremonyTitle(t, item);
          const isActive = activeCeremonyId === item.ceremonyId;
          const isBlocked = Boolean(activePreview);
          return (
            <article
              key={item.id}
              className={`rounded-lg border p-4 transition-colors ${isActive
                ? 'border-accent bg-accent/10'
                : 'border-on-surface/10 bg-surface-sunken/45'
                }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-accent shadow-sm">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h5 className="text-sm font-bold text-on-surface">
                    {title}
                  </h5>
                  <p className="mt-1 text-[12px] leading-relaxed text-on-surface-muted">
                    {t(item.descKey)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isBlocked}
                onClick={() => handlePlay(item.ceremonyId)}
                aria-label={t('experiment.ceremony_preview.play_aria', { title })}
                className={`mt-4 inline-flex h-9 items-center gap-2 rounded-full px-3 text-[11px] font-semibold transition-colors ${isBlocked
                  ? 'cursor-not-allowed bg-surface text-on-surface-muted opacity-60'
                  : 'bg-accent text-on-accent hover:opacity-90'
                  }`}
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('experiment.ceremony_preview.play')}</span>
              </button>
            </article>
          );
        })}
      </div>

      <div className="mt-4 border-t border-on-surface/10 pt-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase text-on-surface-muted">
              {t('experiment.ceremony_preview.replay_first_vision.eyebrow')}
            </p>
            <h5 className="mt-1 text-sm font-bold text-on-surface">
              {t('experiment.ceremony_preview.replay_first_vision.title')}
            </h5>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-on-surface-muted">
              {t('experiment.ceremony_preview.replay_first_vision.desc')}
            </p>
          </div>
          <button
            type="button"
            disabled={firstVisionReplayBusy}
            onClick={handleReplayFirstVision}
            aria-label={t('experiment.ceremony_preview.replay_first_vision.button_aria')}
            className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-[11px] font-semibold transition-colors ${firstVisionReplayBusy
              ? 'cursor-wait bg-surface text-on-surface-muted opacity-60'
              : 'bg-surface-sunken text-on-surface hover:bg-accent/10 hover:text-accent'
              }`}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('experiment.ceremony_preview.replay_first_vision.button')}</span>
          </button>
        </div>
        <div className="mt-3 rounded-md bg-surface-sunken/55 px-3 py-2 text-[11px] font-medium text-on-surface-muted">
          {firstVisionReplayStatusLabel}
        </div>
      </div>

      {activePreview ? (
        <CeremonyOverlay
          key={activePreview.key}
          active={true}
          ceremonyId={activePreview.ceremonyId}
          seed={activePreview.seed}
          onComplete={handleComplete}
        />
      ) : null}
    </div>
  );
}
