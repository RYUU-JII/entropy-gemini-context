import { useCallback, useMemo } from 'react';

import { AI_TASK_IDS } from '@/domains/ai/index.js';
import {
  generateUsageInsightNarration,
  prepareUsageInsightNarrationModel,
} from './dashboardAiClient.js';
import {
  buildUsageInsightNarrationInputSignature,
  resolveUsageInsightNarrationReadiness,
} from './usageInsightNarrationInput.js';
import { useAiNarrationTaskRuntime } from './useAiNarrationTaskRuntime.js';

export function useUsageInsightNarration({
  enabled = true,
  homeScanSnapshot = null,
  locale = 'en',
  tone = 'calm',
} = {}) {
  const readiness = useMemo(
    () => resolveUsageInsightNarrationReadiness(homeScanSnapshot),
    [homeScanSnapshot],
  );
  const inputSignature = useMemo(() => (
    readiness.ready
      ? buildUsageInsightNarrationInputSignature({ homeScanSnapshot, locale, tone })
      : ''
  ), [homeScanSnapshot, locale, readiness.ready, tone]);
  const generateNarration = useCallback(({ signal, monitor }) => (
    generateUsageInsightNarration({
      homeScanSnapshot,
      locale,
      tone,
      signal,
      monitor,
    })
  ), [homeScanSnapshot, locale, tone]);
  const prepareNarration = useCallback(({ signal, monitor }) => (
    prepareUsageInsightNarrationModel({
      locale,
      signal,
      monitor,
    })
  ), [locale]);

  return useAiNarrationTaskRuntime({
    enabled,
    taskId: AI_TASK_IDS.USAGE_INSIGHT_GENERATE_NARRATION,
    locale,
    readiness,
    inputSignature,
    generateNarration,
    prepareNarration,
  });
}
