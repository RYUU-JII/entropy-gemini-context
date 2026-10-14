import {
    I18N_DEFAULT_NAMESPACE,
    I18N_FALLBACK_LANGUAGE,
} from '../../../i18n/metadata.js';
import { I18N_RESOURCES } from '../../../i18n/resources.js';
import { createRuntimeResourceTranslator } from './resourceTranslator.js';
import { normalizeRuntimeLanguage } from './language.js';
import { resolveRuntimeUiLanguage } from './runtimeUiLanguage.js';

const FALLBACK_LANGUAGE = I18N_FALLBACK_LANGUAGE;
const DEFAULT_NAMESPACE = I18N_DEFAULT_NAMESPACE;
const RUNTIME_RESOURCES = I18N_RESOURCES;

function normalizeLanguage(value) {
    return normalizeRuntimeLanguage(value, FALLBACK_LANGUAGE);
}

const runtimeTranslator = createRuntimeResourceTranslator({
    resources: RUNTIME_RESOURCES,
    fallbackLanguage: FALLBACK_LANGUAGE,
    defaultNamespace: DEFAULT_NAMESPACE,
    normalizeLanguage,
    resolveLanguage: resolveRuntimeUiLanguage,
    diagnosticLabel: 'i18n',
});

export function setRuntimeLanguage(language) {
    const normalized = normalizeLanguage(language);
    const resolved = RUNTIME_RESOURCES[normalized] ? normalized : FALLBACK_LANGUAGE;
    globalThis.__ENTROPY_LANG__ = resolved;
    return resolved;
}

export function tRuntime(key, options = {}) {
    return runtimeTranslator.translate(key, options);
}

export function tRuntimeWithLanguage(language, key, options = {}) {
    return runtimeTranslator.translateWithLanguage(language, key, options);
}

export function getRuntimeLanguage() {
    return resolveRuntimeUiLanguage();
}
