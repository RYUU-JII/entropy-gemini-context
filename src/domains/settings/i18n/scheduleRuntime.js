import {
  I18N_DEFAULT_NAMESPACE,
  I18N_FALLBACK_LANGUAGE,
} from '../../../i18n/metadata.js';
import { SCHEDULE_I18N_RESOURCES } from '../../../i18n/scheduleResources.js';
import { createRuntimeResourceTranslator } from './resourceTranslator.js';
import { normalizeRuntimeLanguage } from './language.js';
import { resolveRuntimeUiLanguage } from './runtimeUiLanguage.js';

function normalizeLanguage(value) {
  return normalizeRuntimeLanguage(value, I18N_FALLBACK_LANGUAGE);
}

const scheduleRuntimeTranslator = createRuntimeResourceTranslator({
  resources: SCHEDULE_I18N_RESOURCES,
  fallbackLanguage: I18N_FALLBACK_LANGUAGE,
  defaultNamespace: I18N_DEFAULT_NAMESPACE,
  normalizeLanguage,
  resolveLanguage: resolveRuntimeUiLanguage,
  diagnosticLabel: 'schedule-i18n',
});

export function tRuntime(key, options = {}) {
  return scheduleRuntimeTranslator.translate(key, options);
}
