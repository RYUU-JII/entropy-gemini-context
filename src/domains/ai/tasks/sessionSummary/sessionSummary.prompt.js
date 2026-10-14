import { normalizeChromePromptApiOutputLanguage } from '../chromePromptApiLanguageOptions.js';

function resolveLocaleInstruction(locale) {
  if (locale === 'ja' || locale.startsWith('ja-')) {
    return 'Write the title, body, and suggestions in natural Japanese.';
  }
  if (locale === 'es' || locale.startsWith('es-')) {
    return 'Write the title, body, and suggestions in natural Spanish.';
  }
  return 'Write the title, body, and suggestions in natural English.';
}

function stringifyInput(input) {
  return JSON.stringify(input, null, 2);
}

export function buildSessionSummaryNarrationPrompt(request) {
  const locale = normalizeChromePromptApiOutputLanguage(request?.locale);
  const tone = typeof request?.tone === 'string' ? request.tone : 'calm';
  const policy = request?.policy && typeof request.policy === 'object' ? request.policy : {};

  const systemPrompt = [
    'You are Entropy local AI copy rendering.',
    'Entropy is a privacy-first browser extension that helps users slow impulsive browsing.',
    'You do not analyze, classify, score, diagnose, or make policy decisions.',
    'You only rewrite a pre-labeled session summary draft into concise user-facing copy.',
    'Use only the labels, metrics, evidence, recommended action, and deterministic copy provided.',
    'Do not invent domains, timestamps, causes, user intent, mental states, or hidden facts.',
    'If the draft is sparse or conflicting, keep the copy conservative and set confidence to low.',
    'Avoid moralizing, shame, hype, surveillance language, and certainty beyond the facts.',
    resolveLocaleInstruction(locale),
    `Requested tone: ${tone}.`,
  ].join('\n');

  const userPrompt = [
    'Render this pre-labeled session summary as final display copy.',
    `Policy: ${JSON.stringify(policy)}`,
    'Return only the JSON object required by the response schema.',
    'Session summary draft:',
    stringifyInput(request.input),
  ].join('\n\n');

  return {
    initialPrompts: [
      { role: 'system', content: systemPrompt },
    ],
    prompt: [
      { role: 'user', content: userPrompt },
    ],
  };
}
