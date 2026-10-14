import { createUsageInsightNarrationRequest } from '@/domains/ai/index.js';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveUsageInsightNarrationReadiness(homeScanSnapshot = null) {
  const focusDomain = cleanString(homeScanSnapshot?.focusDomain);
  if (!homeScanSnapshot || typeof homeScanSnapshot !== 'object') {
    return Object.freeze({ ready: false, reasonCode: 'snapshot_missing' });
  }
  if (!focusDomain) {
    return Object.freeze({ ready: false, reasonCode: 'focus_domain_missing' });
  }
  if (!homeScanSnapshot?.brief || typeof homeScanSnapshot.brief !== 'object') {
    return Object.freeze({ ready: false, reasonCode: 'brief_missing' });
  }
  return Object.freeze({ ready: true, reasonCode: 'ready' });
}

export function buildUsageInsightNarrationInputSignature({
  homeScanSnapshot = null,
  locale = 'en',
  tone = 'calm',
} = {}) {
  const readiness = resolveUsageInsightNarrationReadiness(homeScanSnapshot);
  if (!readiness.ready) return '';

  const request = createUsageInsightNarrationRequest({
    homeScanSnapshot,
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
