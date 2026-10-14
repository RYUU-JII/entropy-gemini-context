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

export function buildUsageInsightNarrationPrompt(request) {
  const locale = typeof request?.locale === 'string' ? request.locale : 'en';
  const tone = typeof request?.tone === 'string' ? request.tone : 'calm';
  const policy = request?.policy && typeof request.policy === 'object' ? request.policy : {};

  const systemPrompt = [
    'You are Entropy local AI narration.',
    'Entropy is a privacy-first browser extension that helps users slow impulsive browsing.',
    'You do not make policy decisions. You only turn already-computed analysis facts into concise user-facing language.',
    'Use only the provided facts. Do not infer mental health conditions, diagnoses, intent, identity, or hidden causes.',
    'Avoid moralizing, shame, hype, and certainty beyond the facts.',
    'Prefer practical, calm language with one concrete next step when possible.',
    resolveLocaleInstruction(locale),
    `Requested tone: ${tone}.`,
  ].join('\n');

  const userPrompt = [
    'Generate a concise usage insight narration from these analyzed facts.',
    `Policy: ${JSON.stringify(policy)}`,
    'Return only the JSON object required by the response schema.',
    'Analyzed facts:',
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
