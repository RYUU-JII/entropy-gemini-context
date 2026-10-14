import {
  AI_AVAILABILITY_STATES,
  AI_PROVIDER_IDS,
  createAiAvailability,
} from '@/domains/ai/index.js';
import { normalizeChromeBuiltInAvailability } from './chromeBuiltInAvailability.js';

const DEFAULT_EXPECTED_INPUTS = Object.freeze([
  Object.freeze({ type: 'text', languages: Object.freeze(['en']) }),
]);
const DEFAULT_EXPECTED_OUTPUTS = Object.freeze([
  Object.freeze({ type: 'text', languages: Object.freeze(['en']) }),
]);

function resolveLanguageModel(runtime) {
  return runtime?.LanguageModel || null;
}

function cloneExpectedLanguageSpecs(value, fallback) {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;
  return source
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      type: typeof entry.type === 'string' && entry.type.trim() ? entry.type.trim() : 'text',
      languages: Array.isArray(entry.languages)
        ? entry.languages
          .map((language) => (typeof language === 'string' ? language.trim().toLowerCase() : ''))
          .filter(Boolean)
        : [],
    }))
    .filter((entry) => entry.languages.length > 0);
}

function buildCreateOptions({ prompt, providerOptions, signal, monitor }) {
  const options = {};
  if (Array.isArray(prompt?.initialPrompts) && prompt.initialPrompts.length > 0) {
    options.initialPrompts = prompt.initialPrompts;
  }
  options.expectedInputs = cloneExpectedLanguageSpecs(
    providerOptions?.expectedInputs,
    DEFAULT_EXPECTED_INPUTS,
  );
  options.expectedOutputs = cloneExpectedLanguageSpecs(
    providerOptions?.expectedOutputs,
    DEFAULT_EXPECTED_OUTPUTS,
  );
  if (Number.isFinite(Number(providerOptions?.temperature)) && Number.isFinite(Number(providerOptions?.topK))) {
    options.temperature = Number(providerOptions.temperature);
    options.topK = Number(providerOptions.topK);
  }
  if (signal) options.signal = signal;
  if (typeof monitor === 'function') options.monitor = monitor;
  return options;
}

function buildAvailabilityOptions(providerOptions = {}) {
  const options = providerOptions?.availabilityOptions && typeof providerOptions.availabilityOptions === 'object'
    ? { ...providerOptions.availabilityOptions }
    : {};
  options.expectedInputs = cloneExpectedLanguageSpecs(
    providerOptions?.expectedInputs,
    DEFAULT_EXPECTED_INPUTS,
  );
  options.expectedOutputs = cloneExpectedLanguageSpecs(
    providerOptions?.expectedOutputs,
    DEFAULT_EXPECTED_OUTPUTS,
  );
  return options;
}

function buildPromptOptions({ responseSchema, signal }) {
  const options = {};
  if (responseSchema && typeof responseSchema === 'object') {
    options.responseConstraint = responseSchema;
  }
  if (signal) options.signal = signal;
  return options;
}

function resolvePromptInput(prompt) {
  if (Array.isArray(prompt?.prompt)) return prompt.prompt;
  if (typeof prompt?.prompt === 'string') return prompt.prompt;
  if (typeof prompt?.text === 'string') return prompt.text;
  throw new Error('Chrome built-in AI prompt payload is missing prompt input.');
}

function buildSessionMetadata(session) {
  const metadata = {};
  if (Number.isFinite(Number(session?.contextWindow))) {
    metadata.contextWindow = Number(session.contextWindow);
  }
  if (Number.isFinite(Number(session?.contextUsage))) {
    metadata.contextUsage = Number(session.contextUsage);
  }
  return metadata;
}

export function createChromeBuiltInAiProvider({
  runtime = globalThis,
} = {}) {
  return Object.freeze({
    id: AI_PROVIDER_IDS.CHROME_BUILT_IN_LANGUAGE_MODEL,

    async availability(providerOptions = {}) {
      const LanguageModel = resolveLanguageModel(runtime);
      if (!LanguageModel || typeof LanguageModel.availability !== 'function') {
        return createAiAvailability({
          providerId: AI_PROVIDER_IDS.CHROME_BUILT_IN_LANGUAGE_MODEL,
          state: AI_AVAILABILITY_STATES.UNAVAILABLE,
          reasonCode: 'language_model_api_missing',
          canCreateSession: false,
          requiresUserActivation: false,
        });
      }

      try {
        const rawAvailability = await LanguageModel.availability(buildAvailabilityOptions(providerOptions));
        return normalizeChromeBuiltInAvailability(rawAvailability);
      } catch (error) {
        return createAiAvailability({
          providerId: AI_PROVIDER_IDS.CHROME_BUILT_IN_LANGUAGE_MODEL,
          state: AI_AVAILABILITY_STATES.ERROR,
          reasonCode: 'availability_failed',
          details: {
            name: error?.name || '',
            message: error?.message || '',
          },
          canCreateSession: false,
          requiresUserActivation: false,
        });
      }
    },

    async generate({
      prompt,
      responseSchema = null,
      providerOptions = {},
      signal = null,
      monitor = null,
    } = {}) {
      const LanguageModel = resolveLanguageModel(runtime);
      if (!LanguageModel || typeof LanguageModel.create !== 'function') {
        throw new Error('Chrome built-in LanguageModel API is unavailable.');
      }

      let session = null;
      try {
        session = await LanguageModel.create(buildCreateOptions({
          prompt,
          providerOptions,
          signal,
          monitor,
        }));
        const text = await session.prompt(
          resolvePromptInput(prompt),
          buildPromptOptions({ responseSchema, signal }),
        );
        return {
          text,
          metadata: buildSessionMetadata(session),
        };
      } finally {
        if (session && typeof session.destroy === 'function') {
          session.destroy();
        }
      }
    },

    async prepare({
      providerOptions = {},
      signal = null,
      monitor = null,
    } = {}) {
      const LanguageModel = resolveLanguageModel(runtime);
      if (!LanguageModel || typeof LanguageModel.create !== 'function') {
        throw new Error('Chrome built-in LanguageModel API is unavailable.');
      }

      let session = null;
      try {
        session = await LanguageModel.create(buildCreateOptions({
          prompt: null,
          providerOptions,
          signal,
          monitor,
        }));
        return {
          metadata: buildSessionMetadata(session),
        };
      } finally {
        if (session && typeof session.destroy === 'function') {
          session.destroy();
        }
      }
    },
  });
}
