import { getSentinelFlareNudgeCopy } from '../../settings/i18n/nudgeCopy.js';
import { getRuntimeLanguage } from '../../settings/i18n/runtime.js';
import { normalizeNudgeRuntimeContext } from '../runtime/nudgeRuntimeContext.js';
import {
  DEFAULT_NUDGE_RUNTIME_ASSET,
  DEFAULT_NUDGE_RUNTIME_TUNING,
} from '../../settings/config/nudgeConfig.js';

function resolveCopyFallbackContext({
  activeThemeId = '',
  fallbackThemeId = '',
  runtimeContext = null,
  runtimeLanguage = getRuntimeLanguage(),
} = {}) {
  const resolvedThemeId = activeThemeId || fallbackThemeId;
  return {
    themeId: resolvedThemeId || fallbackThemeId,
    language: runtimeContext?.language || runtimeLanguage,
    variantId: runtimeContext?.variantId || resolvedThemeId || fallbackThemeId,
  };
}

export function resolveSentinelNudgeCopyContext(rawContext = null, options = {}) {
  const {
    activeThemeId = '',
    fallbackThemeId = '',
    runtimeContext = null,
    runtimeLanguage = getRuntimeLanguage(),
  } = options;
  const canonicalFallback = {
    themeId: fallbackThemeId,
    language: runtimeLanguage,
    variantId: fallbackThemeId,
  };

  if (typeof rawContext === 'string') {
    return normalizeNudgeRuntimeContext({
      themeId: rawContext,
      language: runtimeLanguage,
      variantId: rawContext,
    }, canonicalFallback);
  }

  const runtimeFallback = resolveCopyFallbackContext({
    activeThemeId,
    fallbackThemeId,
    runtimeContext,
    runtimeLanguage,
  });

  if (rawContext && typeof rawContext === 'object') {
    return normalizeNudgeRuntimeContext(rawContext, runtimeFallback);
  }

  return normalizeNudgeRuntimeContext(runtimeFallback, canonicalFallback);
}

export function createDefaultSentinelNudgeConfig(options = {}) {
  const sentinelCopy = getSentinelFlareNudgeCopy(
    resolveSentinelNudgeCopyContext(options.copyContext ?? null, options),
  );
  return {
    ...DEFAULT_NUDGE_RUNTIME_TUNING,
    asset: DEFAULT_NUDGE_RUNTIME_ASSET,
    protocol: sentinelCopy.protocol,
    message: sentinelCopy.message,
  };
}

export function mergeSentinelNudgeProtocolCopy(config, options = {}) {
  const safeConfig = config && typeof config === 'object' ? config : {};
  const themeId = typeof options.themeId === 'string' && options.themeId.trim()
    ? options.themeId.trim()
    : null;
  const baseContext = options.runtimeContext && typeof options.runtimeContext === 'object'
    ? options.runtimeContext
    : {};
  const copy = getSentinelFlareNudgeCopy(
    resolveSentinelNudgeCopyContext({
      ...baseContext,
      themeId: themeId || baseContext.themeId || options.activeThemeId || options.fallbackThemeId,
    }, options),
    {
      recoveryAction: safeConfig?.recovery?.action || null,
      protocolScope: safeConfig?.protocolScope || 'site',
    },
  );

  return {
    ...safeConfig,
    protocol: {
      ...(safeConfig.protocol || {}),
      ...(copy.protocol || {}),
    },
    message: {
      ...(safeConfig.message || {}),
      ...(copy.message || {}),
    },
  };
}
