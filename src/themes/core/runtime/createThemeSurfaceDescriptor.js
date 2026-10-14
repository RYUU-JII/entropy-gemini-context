import { assertCanonicalThemeId } from '../ids.js';
import { resolveThemePluginModuleKey } from './pluginModulePath.js';

const createDescriptorError = (code, themeId, field, value = null) => {
    const error = new Error(`${code}:${String(themeId)}:${field}`);
    error.code = code;
    error.themeId = themeId;
    error.field = field;
    error.value = value;
    return error;
};

const requireDescriptorString = (value, {
    code,
    themeId,
    field,
} = {}) => {
    if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
        throw createDescriptorError(code, themeId, field, value);
    }
    return value;
};

const freezeWidgetLoaders = (themeId, widgetLoaders) => {
    if (
        !widgetLoaders
        || typeof widgetLoaders !== 'object'
        || Array.isArray(widgetLoaders)
    ) {
        throw createDescriptorError(
            'THEME_SURFACE_WIDGET_LOADERS_REQUIRED',
            themeId,
            'widgetLoaders',
            widgetLoaders,
        );
    }

    const entries = Object.entries(widgetLoaders);
    if (entries.length === 0) {
        throw createDescriptorError(
            'THEME_SURFACE_WIDGET_LOADERS_REQUIRED',
            themeId,
            'widgetLoaders',
            widgetLoaders,
        );
    }

    const loaders = {};
    entries.forEach(([widgetType, modulePath]) => {
        const cleanWidgetType = requireDescriptorString(widgetType, {
            code: 'THEME_SURFACE_WIDGET_TYPE_INVALID',
            themeId,
            field: 'widgetLoaders.key',
        });
        const cleanModulePath = requireDescriptorString(modulePath, {
            code: 'THEME_SURFACE_WIDGET_MODULE_PATH_INVALID',
            themeId,
            field: `widgetLoaders.${cleanWidgetType}`,
        });
        if (
            !cleanModulePath.startsWith('./widgets/')
            || !resolveThemePluginModuleKey(themeId, cleanModulePath)
        ) {
            throw createDescriptorError(
                'THEME_SURFACE_WIDGET_MODULE_PATH_INVALID',
                themeId,
                `widgetLoaders.${cleanWidgetType}`,
                cleanModulePath,
            );
        }
        loaders[cleanWidgetType] = cleanModulePath;
    });

    return Object.freeze(loaders);
};

/**
 * Creates the small, implementation-free declaration needed by dashboard boot,
 * readiness, navigation-copy selection, and the widget module resolver. Full
 * theme definitions, profiles, policies, and render runtimes stay in manifest.js.
 */
export function createThemeSurfaceDescriptor({
    id,
    mainWidgetThemeId,
    tabIconVariant,
    widgetLoaders,
} = {}) {
    const themeId = assertCanonicalThemeId(id, 'theme surface descriptor');
    const resolvedMainWidgetThemeId = assertCanonicalThemeId(
        mainWidgetThemeId,
        `theme surface descriptor '${themeId}' main widget owner`,
    );
    const resolvedTabIconVariant = requireDescriptorString(tabIconVariant, {
        code: 'THEME_SURFACE_TAB_ICON_VARIANT_INVALID',
        themeId,
        field: 'tabIconVariant',
    });

    return Object.freeze({
        id: themeId,
        mainWidgetThemeId: resolvedMainWidgetThemeId,
        tabIconVariant: resolvedTabIconVariant,
        widgetLoaders: freezeWidgetLoaders(themeId, widgetLoaders),
    });
}
