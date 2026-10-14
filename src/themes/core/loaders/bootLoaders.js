import { DEFAULT_THEME_ID } from '../ids.js';
import {
    assertThemePluginId,
    getThemePluginStrict,
} from '../runtime/pluginCatalog.js';
import { resolveThemePluginModuleKey } from '../runtime/pluginModulePath.js';

const DEFAULT_VARIANT = 'soft';
const THEME_PLUGIN_BOOT_MODULES = import.meta.glob('../../plugins/*/presentation/**/*.{js,jsx,ts,tsx}', {
    eager: true,
});

const normalizeBootLoaderVariant = (variant) => (
    typeof variant === 'string' && variant.trim()
        ? variant.trim()
        : DEFAULT_VARIANT
);

const resolveBootLoaderModule = (themeId, modulePath) => {
    const moduleKey = resolveThemePluginModuleKey(themeId, modulePath);
    if (!moduleKey) return null;
    return THEME_PLUGIN_BOOT_MODULES[moduleKey] || null;
};

const resolveBootLoaderComponent = (themeId, modulePath) => (
    resolveBootLoaderModule(themeId, modulePath)?.default || null
);

const createThemeBootLoaderError = (code, message, details = null) => {
    const error = new Error(message);
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    return error;
};

const createMissingBootLoaderError = (themeId, variant) => createThemeBootLoaderError(
    'THEME_BOOT_LOADER_VARIANT_UNRESOLVED',
    `Theme '${themeId}' does not declare boot loader variant '${variant}'.`,
    {
        themeId,
        variant,
        bootLoaderKey: `${themeId}:${variant}`,
    },
);

const resolveBootLoaderModuleByVariant = (themeId, variant) => {
    const safeVariant = normalizeBootLoaderVariant(variant);
    const manifest = getThemePluginStrict(themeId, 'theme boot loader');
    const directLoaderModule = resolveBootLoaderModule(themeId, manifest?.bootLoaders?.[safeVariant]);
    return directLoaderModule || null;
};

const resolveBootLoader = (themeId, variant) => {
    const loaderModule = resolveBootLoaderModuleByVariant(themeId, variant);
    return loaderModule?.default || null;
};

export async function preloadBootLoader(themeId, variant = DEFAULT_VARIANT) {
    const resolvedThemeId = assertThemePluginId(themeId, 'theme boot loader preload');
    const resolvedVariant = normalizeBootLoaderVariant(variant);
    const loader = resolveBootLoader(resolvedThemeId, resolvedVariant);
    if (!loader) {
        throw createMissingBootLoaderError(resolvedThemeId, resolvedVariant);
    }
    return loader;
}

export function getBootLoaderByVariant(variant = DEFAULT_VARIANT, themeId = DEFAULT_THEME_ID) {
    const resolvedThemeId = assertThemePluginId(themeId, 'theme boot loader lookup');
    const resolvedVariant = normalizeBootLoaderVariant(variant);
    const loader = resolveBootLoader(resolvedThemeId, resolvedVariant);
    if (!loader) {
        throw createMissingBootLoaderError(resolvedThemeId, resolvedVariant);
    }
    return loader;
}

export function getBootLoaderModuleByVariant(variant = DEFAULT_VARIANT, themeId = DEFAULT_THEME_ID) {
    const resolvedThemeId = assertThemePluginId(themeId, 'theme boot loader module lookup');
    const resolvedVariant = normalizeBootLoaderVariant(variant);
    const loaderModule = resolveBootLoaderModuleByVariant(resolvedThemeId, resolvedVariant);
    if (!loaderModule) {
        throw createMissingBootLoaderError(resolvedThemeId, resolvedVariant);
    }
    return loaderModule;
}
