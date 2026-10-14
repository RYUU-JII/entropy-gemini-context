import { DEFAULT_THEME_ID, assertCanonicalThemeId } from '../ids.js';
import { resolveThemePluginModuleKey } from '../runtime/pluginModulePath.js';

const DEFAULT_VARIANT = 'soft';
const THEME_PLUGIN_BOOT_SHELL_MODULES = import.meta.glob('../../plugins/*/presentation/**/*BootShell.js', {
    eager: true,
});

const THEME_BOOT_SHELL_CATALOG = Object.freeze({
    zen: Object.freeze({
        activeVariant: 'soft',
        shells: Object.freeze({
            soft: './presentation/ZenSoftBootShell.js',
        }),
    }),
});

const normalizeBootShellVariant = (variant) => (
    typeof variant === 'string' && variant.trim()
        ? variant.trim()
        : DEFAULT_VARIANT
);

const resolveBootShellModule = (themeId, modulePath) => {
    const moduleKey = resolveThemePluginModuleKey(themeId, modulePath);
    if (!moduleKey) return null;
    return THEME_PLUGIN_BOOT_SHELL_MODULES[moduleKey] || null;
};

const createThemeBootShellError = (code, message, details = null) => {
    const error = new Error(message);
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    return error;
};

const createUnresolvedBootShellError = (themeId, variant, modulePath) => createThemeBootShellError(
    'THEME_BOOT_SHELL_VARIANT_UNRESOLVED',
    `Theme '${themeId}' declares boot shell variant '${variant}', but its module could not be resolved.`,
    {
        themeId,
        variant,
        modulePath,
        bootShellKey: `${themeId}:${variant}`,
    },
);

const resolveDeclaredBootShellPath = (catalogEntry, variant) => {
    const modulePath = catalogEntry?.shells?.[variant];
    return typeof modulePath === 'string' && modulePath.trim()
        ? modulePath.trim()
        : null;
};

export function getBootShellCatalogEntry(themeId = DEFAULT_THEME_ID) {
    const resolvedThemeId = assertCanonicalThemeId(themeId, 'theme boot shell catalog lookup');
    return THEME_BOOT_SHELL_CATALOG[resolvedThemeId] || null;
}

export function getBootShellActiveVariant(themeId = DEFAULT_THEME_ID) {
    const catalogEntry = getBootShellCatalogEntry(themeId);
    return normalizeBootShellVariant(catalogEntry?.activeVariant || DEFAULT_VARIANT);
}

export function getBootShellModuleByVariant(variant = DEFAULT_VARIANT, themeId = DEFAULT_THEME_ID) {
    const resolvedThemeId = assertCanonicalThemeId(themeId, 'theme boot shell lookup');
    const resolvedVariant = normalizeBootShellVariant(variant);
    const catalogEntry = getBootShellCatalogEntry(resolvedThemeId);
    const modulePath = resolveDeclaredBootShellPath(catalogEntry, resolvedVariant);
    if (!modulePath) return null;

    const shellModule = resolveBootShellModule(resolvedThemeId, modulePath);
    if (!shellModule) {
        throw createUnresolvedBootShellError(resolvedThemeId, resolvedVariant, modulePath);
    }
    return shellModule;
}
