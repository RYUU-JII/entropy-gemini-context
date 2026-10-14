import React, { useEffect } from 'react';
import { AlertCircle, Loader2, Sparkles, X } from 'lucide-react';

import { AI_AVAILABILITY_STATES } from '@/domains/ai/index.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  isAiNarrationPrepareMode,
  isAiNarrationUnavailableState,
  resolveAiNarrationActionLabel,
  resolveAiNarrationStatusLabel,
  resolveAiNarrationUnavailableLabel,
} from './aiNarrationStatus.js';
import { useSessionSummaryNarration } from './useSessionSummaryNarration.js';

function ConfidencePill({ confidence }) {
  const { t } = useAppTranslation('main');
  const safeConfidence = ['low', 'medium', 'high'].includes(confidence) ? confidence : 'medium';
  const label = safeConfidence === 'high'
    ? t('main.ai_narration_confidence_high')
    : safeConfidence === 'low'
      ? t('main.ai_narration_confidence_low')
      : t('main.ai_narration_confidence_medium');
  return (
    <span className="inline-flex shrink-0 items-center rounded-[7px] border border-current/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none opacity-80">
      {label}
    </span>
  );
}

export default function SessionSummaryAiPanel({
  summaryDraft = null,
  locale = 'en',
  enabled = true,
  onNarration = null,
  className = '',
}) {
  const { t } = useAppTranslation('main');
  const {
    capability,
    checkingCapability,
    readiness,
    generation,
    preparation,
    prepare,
    generate,
    cancel,
    cancelPreparation,
    canPrepare,
    canGenerate,
    inputSignature,
  } = useSessionSummaryNarration({
    enabled,
    summaryDraft,
    locale,
    tone: 'calm',
  });

  useEffect(() => {
    if (generation.phase !== 'ready' || !generation.result) return;
    if (!generation.resultSignature || generation.resultSignature !== inputSignature) return;
    if (typeof onNarration !== 'function') return;
    onNarration({
      narration: generation.result,
      signature: generation.resultSignature,
    });
  }, [
    generation.phase,
    generation.result,
    generation.resultSignature,
    inputSignature,
    onNarration,
  ]);

  if (!enabled || !readiness.ready) return null;

  const phase = generation.phase;
  const preparationPhase = preparation.phase;
  const activeAvailability = generation.availability || preparation.availability || capability;
  const activeReasonCode = generation.errorCode || preparation.errorCode || activeAvailability?.reasonCode || '';
  const availabilityState = activeAvailability?.state || AI_AVAILABILITY_STATES.UNAVAILABLE;
  const unavailable = isAiNarrationUnavailableState({
    state: availabilityState,
    phase,
    checkingCapability,
  });
  const busy = checkingCapability || phase === 'generating' || preparationPhase === 'preparing';
  const prepareMode = isAiNarrationPrepareMode({
    state: availabilityState,
    preparationPhase,
  });
  const actionLabel = resolveAiNarrationActionLabel({
    t,
    state: availabilityState,
    phase,
    preparationPhase,
    checkingCapability,
  });
  const activeDownloadProgress = preparationPhase === 'preparing'
    ? preparation.downloadProgress
    : generation.downloadProgress;
  const downloadPercent = Math.round((activeDownloadProgress?.ratio || 0) * 100);
  const statusLabel = resolveAiNarrationStatusLabel({
    t,
    state: availabilityState,
    phase,
    preparationPhase,
    checkingCapability,
    reasonCode: activeReasonCode,
    downloadPercent,
  });
  const handlePrimaryAction = prepareMode ? prepare : generate;
  const primaryDisabled = prepareMode ? !canPrepare : !canGenerate;
  const generated = phase === 'ready' && generation.result;

  return (
    <div className={`min-w-0 text-[11px] leading-snug ${className}`} aria-live="polite">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-[7px] border border-current/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none opacity-80">
          <Sparkles size={11} strokeWidth={2.2} aria-hidden="true" />
          {t('main.ai_narration_beta')}
        </span>

        {unavailable ? (
          <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium opacity-75">
            <AlertCircle size={12} strokeWidth={2.2} aria-hidden="true" />
            <span className="truncate">
              {resolveAiNarrationUnavailableLabel({
                t,
                reasonCode: activeReasonCode,
              })}
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={primaryDisabled}
            className="inline-flex min-h-[28px] max-w-full items-center gap-1.5 rounded-[8px] border border-current/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] transition hover:bg-current/10 disabled:cursor-not-allowed disabled:opacity-55"
            aria-busy={busy ? 'true' : 'false'}
          >
            {busy ? (
              <Loader2 size={12} strokeWidth={2.2} aria-hidden="true" className="animate-spin" />
            ) : (
              <Sparkles size={12} strokeWidth={2.2} aria-hidden="true" />
            )}
            <span className="truncate">{actionLabel}</span>
          </button>
        )}

        {phase === 'generating' || preparationPhase === 'preparing' ? (
          <button
            type="button"
            onClick={preparationPhase === 'preparing' ? cancelPreparation : cancel}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-current/20 transition hover:bg-current/10"
            aria-label={t('main.ai_narration_cancel')}
            title={t('main.ai_narration_cancel')}
          >
            <X size={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}

        {generated ? <ConfidencePill confidence={generation.result.confidence} /> : null}
      </div>

      {statusLabel ? (
        <div className="mt-1 min-w-0 text-[10px] font-medium opacity-70">
          <span
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {statusLabel}
          </span>
        </div>
      ) : null}

      {(phase === 'generating' || preparationPhase === 'preparing') && downloadPercent > 0 ? (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-[4px] bg-current/10" aria-hidden="true">
          <div
            className="h-full rounded-[4px] bg-current/45 transition-[width]"
            style={{ width: `${downloadPercent}%` }}
          />
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[10px] font-medium opacity-75">
          <AlertCircle size={12} strokeWidth={2.2} aria-hidden="true" />
          <span className="truncate">{t('main.ai_narration_error')}</span>
        </div>
      ) : null}

      {preparationPhase === 'error' ? (
        <div className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[10px] font-medium opacity-75">
          <AlertCircle size={12} strokeWidth={2.2} aria-hidden="true" />
          <span className="truncate">{t('main.ai_narration_prepare_error')}</span>
        </div>
      ) : null}
    </div>
  );
}
