import {
  I18N_FALLBACK_LANGUAGE,
  I18N_SUPPORTED_LOCALES,
} from '../../../i18n/metadata.js';
import { tBackgroundRuntimeWithLanguage } from '../../settings/i18n/backgroundRuntime.js';
import { normalizeRuntimeLanguage } from '../../settings/i18n/language.js';

const SUPPORTED_NOTIFICATION_LANGUAGES = new Set(I18N_SUPPORTED_LOCALES);

function requireNotificationCopyLanguage(value) {
  if (
    typeof value !== 'string'
    || normalizeRuntimeLanguage(value, '') !== value
    || !SUPPORTED_NOTIFICATION_LANGUAGES.has(value)
  ) {
    throw new Error('NOTIFICATION_COPY_LANGUAGE_INVALID');
  }
  return value;
}

function requireNotificationCopyKey(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`NOTIFICATION_COPY_KEY_INVALID:${fieldName}`);
  }
  return value.trim();
}

export function createNotificationCopyResolver({
  runtimeLanguageRepository,
} = {}) {
  if (!runtimeLanguageRepository || typeof runtimeLanguageRepository.get !== 'function') {
    throw new Error('NOTIFICATION_COPY_LANGUAGE_REPOSITORY_REQUIRED');
  }

  return async function resolveNotificationCopy(descriptor = {}) {
    const titleKey = requireNotificationCopyKey(descriptor.titleKey, 'title');
    const messageKey = requireNotificationCopyKey(descriptor.messageKey, 'message');
    const language = requireNotificationCopyLanguage(
      await runtimeLanguageRepository.get(I18N_FALLBACK_LANGUAGE),
    );
    return {
      title: tBackgroundRuntimeWithLanguage(language, titleKey),
      message: tBackgroundRuntimeWithLanguage(language, messageKey),
    };
  };
}
