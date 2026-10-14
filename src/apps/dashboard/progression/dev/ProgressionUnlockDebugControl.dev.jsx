import React, { useMemo, useState } from 'react';
import { Eye, RotateCcw } from 'lucide-react';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT } from '@/domains/progression/policy/progressionPreviewPolicy.js';
import {
  PROGRESSION_UNLOCK_DEBUG_MODES,
} from '@progression-debug-contract';
import {
  clearProgressionUnlockDebugOverride,
  setProgressionUnlockDebugMode,
  setProgressionUnlockDebugDay,
} from '../progressionUnlockDebugClient.js';

const DAY_OPTIONS = Object.freeze(Array.from({ length: PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT + 1 }, (_, day) => day));

function reloadDashboardWindow() {
  if (typeof window === 'undefined' || typeof window.location?.reload !== 'function') return;
  window.location.reload();
}

export default function ProgressionUnlockDebugControl({
  disclosure = null,
  compact = false,
  embedded = false,
  reloadDashboard = reloadDashboardWindow,
  closeSlot = null,
  children = null,
}) {
  const { t } = useAppTranslation('tools');
  const [busy, setBusy] = useState(false);
  const [commandError, setCommandError] = useState(null);
  const unlockProgress = disclosure?.snapshot?.unlockProgress || null;
  const sourceIsDebug = unlockProgress?.debugOverrideActive === true;
  const qualifiedUseDayCount = unlockProgress?.qualifiedUseFacts?.effectiveDayCount ?? null;
  const canonicalQualifiedUseDayCount = unlockProgress?.qualifiedUseFacts?.canonicalDayCount ?? null;
  const mode = disclosure?.snapshot?.developmentProjection?.mode;
  const error = commandError || disclosure?.error;
  const unavailable = disclosure?.loading === true || Boolean(disclosure?.error) || !unlockProgress || busy;
  const status = useMemo(() => {
    if (error) return error.message;
    if (disclosure?.loading) return t('progression_unlock_debug.loading');
    if (!unlockProgress) return t('progression_unlock_debug.unavailable');
    if (mode === PROGRESSION_UNLOCK_DEBUG_MODES.FULL_ACCESS) {
      return t('progression_unlock_debug.full_access_status', { canonical: canonicalQualifiedUseDayCount });
    }
    return sourceIsDebug
      ? t('progression_unlock_debug.debug_status', {
        effective: qualifiedUseDayCount,
        canonical: canonicalQualifiedUseDayCount,
      })
      : t('progression_unlock_debug.live_status', { canonical: canonicalQualifiedUseDayCount });
  }, [
    canonicalQualifiedUseDayCount,
    error,
    disclosure?.loading,
    qualifiedUseDayCount,
    sourceIsDebug,
    mode,
    t,
    unlockProgress,
  ]);

  const runCommand = async (command) => {
    setBusy(true);
    setCommandError(null);
    try {
      await command();
    } catch (error) {
      setCommandError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setBusy(false);
    }
  };

  const runModeCommandAndReload = (command) => runCommand(async () => {
    await command();
    reloadDashboard();
  });

  return (
    <aside
      aria-label={t('progression_unlock_debug.aria_label')}
      data-entropy-debug-signature="ENTROPY_PROGRESSION_UNLOCK_DEBUG_DEV"
      className={[
        'pointer-events-auto flex select-none flex-col',
        !embedded && 'rounded-2xl border',
        compact ? 'h-[280px] w-[56px] p-2' : embedded ? 'w-full' : 'max-h-[calc(100vh-80px)] w-[320px] overflow-y-auto overscroll-contain p-4',
      ].filter(Boolean).join(' ')}
      style={embedded ? undefined : {
        background: 'var(--color-surface-variant, rgba(244, 241, 225, 0.85))',
        borderColor: 'var(--color-border, rgba(93, 64, 55, 0.15))',
        backdropFilter: 'blur(12px)',
        boxShadow: 'var(--shadow-md, 0 4px 12px rgba(93, 64, 55, 0.08))',
      }}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-black text-on-surface">
        <span>{t('progression_unlock_debug.title', { target: PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT })}</span>
        {closeSlot}
      </div>
      <div
        className={[
          'mt-1 font-semibold leading-[1.35] text-on-surface-muted',
          compact ? 'min-h-[22px] text-center text-[8px]' : 'text-xs',
        ].join(' ')}
        title={status}
        role={error ? 'alert' : 'status'}
      >
        {compact && unlockProgress && !error && !disclosure?.loading
          ? `${qualifiedUseDayCount}/${canonicalQualifiedUseDayCount}`
          : status}
      </div>

      {!compact && <p className="mt-2 text-[11px] leading-relaxed text-on-surface-muted">
        {t('progression_unlock_debug.scope_note', { target: PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT })}
      </p>}
      <div className={`mt-3 grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-1`}>
        {DAY_OPTIONS.map((dayCount) => {
          const active = sourceIsDebug && qualifiedUseDayCount === dayCount
            && disclosure?.snapshot?.developmentProjection?.mode !== PROGRESSION_UNLOCK_DEBUG_MODES.FULL_ACCESS;
          return (
            <button
              key={dayCount}
              type="button"
              disabled={unavailable}
              aria-pressed={active}
              aria-label={t('progression_unlock_debug.day', { day: dayCount })}
              onClick={() => void runCommand(() => setProgressionUnlockDebugDay(dayCount))}
              className={[
                `${compact ? 'h-6 text-[9px]' : 'h-8 text-xs'} rounded-md border font-black transition-colors`,
                active
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-border bg-surface-sunken text-on-surface hover:border-accent',
                unavailable ? 'cursor-not-allowed opacity-40' : '',
              ].join(' ')}
            >
              {compact ? dayCount : t('progression_unlock_debug.day', { day: dayCount })}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={unavailable}
        aria-label={t('progression_unlock_debug.full_access')}
        aria-pressed={disclosure?.snapshot?.developmentProjection?.mode === PROGRESSION_UNLOCK_DEBUG_MODES.FULL_ACCESS}
        onClick={() => void runModeCommandAndReload(() => setProgressionUnlockDebugMode(
          PROGRESSION_UNLOCK_DEBUG_MODES.FULL_ACCESS, { dayCount: PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT },
        ))}
        className="mt-2 min-h-7 shrink-0 rounded-md border border-border bg-surface-sunken text-[11px] font-black text-on-surface disabled:opacity-40"
      >
        {compact ? '∞' : t('progression_unlock_debug.full_access')}
      </button>

      <button
        type="button"
        disabled={unavailable}
        aria-label={t('progression_unlock_debug.first_vision_replay')}
        onClick={() => void runModeCommandAndReload(() => setProgressionUnlockDebugMode(
          PROGRESSION_UNLOCK_DEBUG_MODES.FIRST_VISION_PREVIEW,
          { dayCount: qualifiedUseDayCount },
        ))}
        className="mt-2 flex h-7 items-center justify-center gap-1 rounded-md border border-border bg-surface-sunken text-[9px] font-black text-on-surface transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Eye className="h-3 w-3" />
        {compact ? null : t('progression_unlock_debug.first_vision_replay')}
      </button>

      <button
        type="button"
        disabled={unavailable || !sourceIsDebug}
        aria-label={t('progression_unlock_debug.live')}
        onClick={() => void runModeCommandAndReload(clearProgressionUnlockDebugOverride)}
        className="mt-2 flex min-h-7 shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-surface-sunken text-[11px] font-black text-on-surface transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        <RotateCcw className="h-3 w-3" />
        {compact ? null : t('progression_unlock_debug.live')}
      </button>
      {children && <div className="mt-3">{children}</div>}
    </aside>
  );
}
