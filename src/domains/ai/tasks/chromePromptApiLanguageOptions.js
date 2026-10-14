const CHROME_PROMPT_API_OUTPUT_LANGUAGE_CODES = Object.freeze(['en', 'es', 'ja']);
const CHROME_PROMPT_API_OUTPUT_LANGUAGE_SET = new Set(CHROME_PROMPT_API_OUTPUT_LANGUAGE_CODES);

export function normalizeChromePromptApiOutputLanguage(locale = 'en') {
  const normalized = typeof locale === 'string' ? locale.trim().toLowerCase() : '';
  const baseLanguage = normalized.split('-', 1)[0];
  return CHROME_PROMPT_API_OUTPUT_LANGUAGE_SET.has(baseLanguage) ? baseLanguage : 'en';
}

export function buildChromePromptApiLanguageOptions(request = null) {
  const outputLanguage = normalizeChromePromptApiOutputLanguage(request?.locale);
  return {
    expectedInputs: [
      { type: 'text', languages: ['en'] },
    ],
    expectedOutputs: [
      { type: 'text', languages: [outputLanguage] },
    ],
  };
}
