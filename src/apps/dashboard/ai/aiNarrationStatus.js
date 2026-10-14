import { AI_AVAILABILITY_STATES } from '@/domains/ai/index.js';

export function resolveAiNarrationActionLabel({
  t,
  state,
  phase,
  preparationPhase,
  checkingCapability,
}) {
  if (checkingCapability) return t('main.ai_narration_checking');
  if (preparationPhase === 'preparing') return t('main.ai_narration_downloading');
  if (preparationPhase === 'ready' && state !== AI_AVAILABILITY_STATES.AVAILABLE) return t('main.ai_narration_ready');
  if (phase === 'generating') return t('main.ai_narration_generating');
  if (state === AI_AVAILABILITY_STATES.DOWNLOADABLE) return t('main.ai_narration_prepare');
  if (state === AI_AVAILABILITY_STATES.DOWNLOADING) return t('main.ai_narration_downloading');
  return t('main.ai_narration_generate');
}

export function resolveAiNarrationUnavailableLabel({ t, reasonCode }) {
  if (reasonCode === 'language_model_api_missing') return t('main.ai_narration_unavailable_api');
  if (reasonCode === 'model_download_required') return t('main.ai_narration_prepare');
  if (reasonCode === 'model_download_in_progress') return t('main.ai_narration_downloading');
  return t('main.ai_narration_unavailable');
}

export function resolveAiNarrationStatusLabel({
  t,
  state,
  phase,
  preparationPhase,
  checkingCapability,
  reasonCode = '',
  downloadPercent = 0,
}) {
  if (checkingCapability) return t('main.ai_narration_status_checking');
  if (preparationPhase === 'error') return t('main.ai_narration_status_prepare_error');
  if (phase === 'error') return t('main.ai_narration_status_error');
  if (preparationPhase === 'preparing' || state === AI_AVAILABILITY_STATES.DOWNLOADING) {
    if (downloadPercent > 0) {
      return t('main.ai_narration_status_downloading_percent', { percent: downloadPercent });
    }
    return t('main.ai_narration_status_downloading');
  }
  if (phase === 'generating') return t('main.ai_narration_status_generating');
  if (state === AI_AVAILABILITY_STATES.DOWNLOADABLE) return t('main.ai_narration_status_downloadable');
  if (state === AI_AVAILABILITY_STATES.AVAILABLE) return t('main.ai_narration_status_ready');
  if (reasonCode === 'language_model_api_missing') return t('main.ai_narration_status_unavailable_api');
  return t('main.ai_narration_status_unavailable');
}

export function isAiNarrationUnavailableState({ state, phase, checkingCapability }) {
  return !checkingCapability && (
    state === AI_AVAILABILITY_STATES.UNAVAILABLE
    || state === AI_AVAILABILITY_STATES.DISABLED
    || state === AI_AVAILABILITY_STATES.ERROR
    || phase === 'unavailable'
  );
}

export function isAiNarrationPrepareMode({ state, preparationPhase }) {
  return state === AI_AVAILABILITY_STATES.DOWNLOADABLE
    || state === AI_AVAILABILITY_STATES.DOWNLOADING
    || preparationPhase === 'preparing';
}
