import { createAiTaskRequest } from '../../contracts/aiRequestProtocol.js';
import { buildChromePromptApiLanguageOptions } from '../chromePromptApiLanguageOptions.js';
import { AI_TASK_IDS } from '../../contracts/aiTaskIds.js';
import { redactAiInput } from '../../orchestration/AiInputRedactor.js';
import {
  buildSessionSummaryNarrationInput,
  SESSION_SUMMARY_DRAFT_CONTRACT_VERSION,
} from './buildSessionSummaryNarrationInput.js';
import { buildSessionSummaryNarrationPrompt } from './sessionSummary.prompt.js';
import {
  SESSION_SUMMARY_NARRATION_RESPONSE_SCHEMA,
  SESSION_SUMMARY_NARRATION_SCHEMA_ID,
} from './sessionSummary.schema.js';

export const SESSION_SUMMARY_NARRATION_POLICY = Object.freeze({
  maxSentences: 3,
  maxSuggestions: 2,
  copyOnly: true,
  noNewFacts: true,
  noDiagnosis: true,
  noMoralizing: true,
  noPolicyDecision: true,
});

export const sessionSummaryNarrationTask = Object.freeze({
  id: AI_TASK_IDS.SESSION_SUMMARY_GENERATE_NARRATION,
  version: 1,
  outputSchemaId: SESSION_SUMMARY_NARRATION_SCHEMA_ID,
  responseSchema: SESSION_SUMMARY_NARRATION_RESPONSE_SCHEMA,
  buildPrompt: buildSessionSummaryNarrationPrompt,
  getProviderOptions(request = null) {
    return buildChromePromptApiLanguageOptions(request);
  },
});

export function createSessionSummaryNarrationRequest({
  summaryDraft = null,
  locale = 'en',
  tone = 'calm',
  policy = {},
} = {}) {
  return createAiTaskRequest({
    taskId: AI_TASK_IDS.SESSION_SUMMARY_GENERATE_NARRATION,
    locale,
    tone,
    source: {
      kind: 'sessionSummaryDraft',
      engineVersion: SESSION_SUMMARY_DRAFT_CONTRACT_VERSION,
    },
    input: redactAiInput(buildSessionSummaryNarrationInput({ summaryDraft })),
    policy: {
      ...SESSION_SUMMARY_NARRATION_POLICY,
      ...(policy && typeof policy === 'object' ? policy : {}),
    },
    outputSchemaId: SESSION_SUMMARY_NARRATION_SCHEMA_ID,
  });
}
