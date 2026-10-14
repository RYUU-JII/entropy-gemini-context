function interpolate(template, options = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = options?.[key];
    return value == null ? '' : String(value);
  });
}

function deepGet(target, pathSegments) {
  let current = target;
  for (const segment of pathSegments) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[segment];
  }
  return current;
}

function resolveNamespaceAndPath(rawKey, defaultNamespace) {
  const key = String(rawKey || '').trim();
  if (!key) {
    return {
      namespace: defaultNamespace,
      pathSegments: [],
    };
  }

  const namespaceDividerIndex = key.indexOf(':');
  if (namespaceDividerIndex <= 0) {
    return {
      namespace: defaultNamespace,
      pathSegments: key.split('.').filter(Boolean),
    };
  }

  return {
    namespace: key.slice(0, namespaceDividerIndex),
    pathSegments: key
      .slice(namespaceDividerIndex + 1)
      .split('.')
      .filter(Boolean),
  };
}

function resolveScopedValue(dictionary, pathSegments, context) {
  if (!dictionary || pathSegments.length === 0) return undefined;

  if (context) {
    const contextualPath = pathSegments.slice();
    const lastIndex = contextualPath.length - 1;
    contextualPath[lastIndex] = `${contextualPath[lastIndex]}_${context}`;
    const contextualValue = deepGet(dictionary, contextualPath);
    if (typeof contextualValue === 'string') return contextualValue;
  }

  const baseValue = deepGet(dictionary, pathSegments);
  return typeof baseValue === 'string' ? baseValue : undefined;
}

function requireRuntimeTranslatorConfig({
  resources,
  fallbackLanguage,
  defaultNamespace,
  normalizeLanguage,
  resolveLanguage,
}) {
  if (!resources || typeof resources !== 'object' || Array.isArray(resources)) {
    throw new Error('RUNTIME_I18N_RESOURCES_REQUIRED');
  }
  if (!resources[fallbackLanguage]) {
    throw new Error('RUNTIME_I18N_FALLBACK_RESOURCE_REQUIRED');
  }
  if (typeof defaultNamespace !== 'string' || !defaultNamespace.trim()) {
    throw new Error('RUNTIME_I18N_DEFAULT_NAMESPACE_REQUIRED');
  }
  if (typeof normalizeLanguage !== 'function') {
    throw new Error('RUNTIME_I18N_LANGUAGE_NORMALIZER_REQUIRED');
  }
  if (typeof resolveLanguage !== 'function') {
    throw new Error('RUNTIME_I18N_LANGUAGE_RESOLVER_REQUIRED');
  }
}

export function createRuntimeResourceTranslator({
  resources,
  fallbackLanguage,
  defaultNamespace,
  normalizeLanguage,
  resolveLanguage,
  diagnosticLabel = 'i18n',
} = {}) {
  requireRuntimeTranslatorConfig({
    resources,
    fallbackLanguage,
    defaultNamespace,
    normalizeLanguage,
    resolveLanguage,
  });

  const reportedMissingTranslations = new Set();

  function resolveResourceValue(language, namespace, pathSegments, context) {
    const dictionary = resources?.[language]?.[namespace];
    const resolved = resolveScopedValue(dictionary, pathSegments, context);
    if (typeof resolved === 'string') return resolved;

    if (language !== fallbackLanguage) {
      const fallbackDictionary = resources?.[fallbackLanguage]?.[namespace];
      return resolveScopedValue(fallbackDictionary, pathSegments, context);
    }

    return undefined;
  }

  function reportMissingTranslation({ language, namespace, pathSegments, context }) {
    const cacheKey = `${language}:${namespace}.${pathSegments.join('.')}::${context || ''}`;
    if (reportedMissingTranslations.has(cacheKey)) return;
    reportedMissingTranslations.add(cacheKey);

    console.error(
      `[${diagnosticLabel}] Missing runtime translation for ${language}:${namespace}.${pathSegments.join('.')} (context=${context || 'none'})`,
    );
  }

  function translateWithResolvedLanguage(language, key, options = {}) {
    const { namespace, pathSegments } = resolveNamespaceAndPath(key, defaultNamespace);
    const context = String(options?.context || '').trim();
    const resolved = resolveResourceValue(language, namespace, pathSegments, context);
    if (typeof resolved === 'string') return interpolate(resolved, options);

    reportMissingTranslation({ language, namespace, pathSegments, context });
    const keyPath = pathSegments.join('.');
    const scopedKey = context ? `${keyPath}_${context}` : keyPath;
    return `[missing i18n: ${language}:${namespace}.${scopedKey}]`;
  }

  function resolveRequestedLanguage(rawLanguage) {
    const normalized = normalizeLanguage(rawLanguage);
    if (resources[normalized]) return normalized;
    return resolveLanguage();
  }

  return Object.freeze({
    translate(key, options = {}) {
      return translateWithResolvedLanguage(resolveLanguage(), key, options);
    },
    translateWithLanguage(language, key, options = {}) {
      return translateWithResolvedLanguage(
        resolveRequestedLanguage(language),
        key,
        options,
      );
    },
  });
}
