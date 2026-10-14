import {
  createSessionSummaryNarrationRequest,
} from '@/domains/ai/tasks/sessionSummary/sessionSummary.task.js';

export {
  applySessionSummaryNarrationToBrief,
  buildSessionSummaryDraftFromHomeScanSnapshot,
  buildSessionSummaryPresentationSignature,
} from './sessionSummaryPresentation.js';

export function resolveSessionSummaryNarrationReadiness(summaryDraft = null) {
  if (!summaryDraft || typeof summaryDraft !== 'object') {
    return Object.freeze({ ready: false, reasonCode: 'summary_draft_missing' });
  }
  const copy = summaryDraft.deterministicCopy && typeof summaryDraft.deterministicCopy === 'object'
    ? summaryDraft.deterministicCopy
    : {};
  const labels = Array.isArray(summaryDraft.labels) ? summaryDraft.labels : [];
  if (!copy.title && !copy.body) {
    return Object.freeze({ ready: false, reasonCode: 'deterministic_copy_missing' });
  }
  if (!labels.length && !summaryDraft.primaryLabelId) {
    return Object.freeze({ ready: false, reasonCode: 'labels_missing' });
  }
  return Object.freeze({ ready: true, reasonCode: 'ready' });
}

export function buildSessionSummaryNarrationInputSignature({
  summaryDraft = null,
  locale = 'en',
  tone = 'calm',
} = {}) {
  const readiness = resolveSessionSummaryNarrationReadiness(summaryDraft);
  if (!readiness.ready) return '';

  const request = createSessionSummaryNarrationRequest({
    summaryDraft,
    locale,
    tone,
  });

  return JSON.stringify({
    taskId: request.taskId,
    locale: request.locale,
    tone: request.tone,
    source: request.source,
    input: request.input,
    policy: request.policy,
  });
}
