export const AI_TASK_IDS = Object.freeze({
  USAGE_INSIGHT_GENERATE_NARRATION: 'usageInsight.generateNarration',
  INTERVENTION_ADVICE_GENERATE_NARRATION: 'interventionAdvice.generateNarration',
  SESSION_SUMMARY_GENERATE_NARRATION: 'sessionSummary.generateNarration',
  FEATURE_GUIDE_ANSWER: 'featureGuide.answer',
});

const AI_TASK_ID_SET = new Set(Object.values(AI_TASK_IDS));

export function isKnownAiTaskId(value) {
  return AI_TASK_ID_SET.has(value);
}
