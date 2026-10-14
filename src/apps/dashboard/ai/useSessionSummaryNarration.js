import { useCallback, useMemo } from 'react';

import { AI_TASK_IDS } from '@/domains/ai/index.js';
import {
  generateSessionSummaryNarration,
  prepareSessionSummaryNarrationModel,
} from './dashboardAiClient.js';
import {
  buildSessionSummaryNarrationInputSignature,
  resolveSessionSummaryNarrationReadiness,
} from './sessionSummaryNarrationInput.js';
import { useAiNarrationTaskRuntime } from './useAiNarrationTaskRuntime.js';

export function useSessionSummaryNarration({
  enabled = true,
  summaryDraft = null,
  locale = 'en',
  tone = 'calm',
} = {}) {
  const readiness = useMemo(
    () => resolveSessionSummaryNarrationReadiness(summaryDraft),
    [summaryDraft],
  );
  const inputSignature = useMemo(() => (
    readiness.ready
      ? buildSessionSummaryNarrationInputSignature({ summaryDraft, locale, tone })
      : ''
  ), [locale, readiness.ready, summaryDraft, tone]);
  const generateNarration = useCallback(({ signal, monitor }) => (
    generateSessionSummaryNarration({
      summaryDraft,
      locale,
      tone,
      signal,
      monitor,
    })
  ), [locale, summaryDraft, tone]);
  const prepareNarration = useCallback(({ signal, monitor }) => (
    prepareSessionSummaryNarrationModel({
      locale,
      signal,
      monitor,
    })
  ), [locale]);

  return useAiNarrationTaskRuntime({
    enabled,
    taskId: AI_TASK_IDS.SESSION_SUMMARY_GENERATE_NARRATION,
    locale,
    readiness,
    inputSignature,
    generateNarration,
    prepareNarration,
  });
}
