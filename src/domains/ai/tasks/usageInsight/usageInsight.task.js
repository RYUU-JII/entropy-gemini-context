import { createAiTaskRequest } from '../../contracts/aiRequestProtocol.js';
import { buildChromePromptApiLanguageOptions } from '../chromePromptApiLanguageOptions.js';
import { AI_TASK_IDS } from '../../contracts/aiTaskIds.js';
import { redactAiInput } from '../../orchestration/AiInputRedactor.js';
import { buildUsageInsightNarrationInput } from './buildUsageInsightNarrationInput.js';
import { buildUsageInsightNarrationPrompt } from './usageInsight.prompt.js';
import {
  USAGE_INSIGHT_NARRATION_RESPONSE_SCHEMA,
  USAGE_INSIGHT_NARRATION_SCHEMA_ID,
} from './usageInsight.schema.js';

export const USAGE_INSIGHT_NARRATION_POLICY = Object.freeze({
  maxSentences: 4,
  maxSuggestions: 3,
  noDiagnosis: true,
  noMoralizing: true,
  noPolicyDecision: true,
});

export const usageInsightNarrationTask = Object.freeze({
  id: AI_TASK_IDS.USAGE_INSIGHT_GENERATE_NARRATION,
  version: 1,
  outputSchemaId: USAGE_INSIGHT_NARRATION_SCHEMA_ID,
  responseSchema: USAGE_INSIGHT_NARRATION_RESPONSE_SCHEMA,
  buildPrompt: buildUsageInsightNarrationPrompt,
  getProviderOptions(request = null) {
    return buildChromePromptApiLanguageOptions(request);
  },
});

export function createUsageInsightNarrationRequest({
  siteInsightModel = null,
  homeScanSnapshot = null,
  locale = 'en',
  tone = 'calm',
  policy = {},
} = {}) {
  return createAiTaskRequest({
    taskId: AI_TASK_IDS.USAGE_INSIGHT_GENERATE_NARRATION,
    locale,
    tone,
    source: {
      kind: siteInsightModel ? 'siteInsightModel' : 'homeScanSnapshot',
      engineVersion: siteInsightModel?.engineVersion || '',
    },
    input: redactAiInput(buildUsageInsightNarrationInput({ siteInsightModel, homeScanSnapshot })),
    policy: {
      ...USAGE_INSIGHT_NARRATION_POLICY,
      ...(policy && typeof policy === 'object' ? policy : {}),
    },
    outputSchemaId: USAGE_INSIGHT_NARRATION_SCHEMA_ID,
  });
}
