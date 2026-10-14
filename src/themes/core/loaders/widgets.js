import React from 'react';
import { withDynamicImportRecovery } from '@/platform/extension/dynamicImportRecovery.js';
import {
    assertThemeSurfaceDescriptorId,
    getThemeSurfaceDescriptorList,
    getThemeSurfaceDescriptorMap,
} from '../runtime/surfaceDescriptorCatalog.js';
import { resolveThemePluginModuleKey } from '../runtime/pluginModulePath.js';
import { THEME_PLUGIN_WIDGET_MODULES } from '@theme-widget-module-map';

const THEME_SURFACE_DESCRIPTOR_LIST = getThemeSurfaceDescriptorList();
const THEME_SURFACE_DESCRIPTOR_MAP = getThemeSurfaceDescriptorMap();
const lazyCache = new Map();
const moduleRecordCache = new Map();
const warnedMissingWidgetKeys = new Set();

const resolveWidgetThemeId = (themeId) => {
    return assertThemeSurfaceDescriptorId(themeId, 'theme widget loader');
};

const getWidgetCapability = (themeId) => (
    THEME_SURFACE_DESCRIPTOR_MAP[themeId]?.widgetLoaders || null
);

const resolveWidgetModuleLoader = (themeId, modulePath) => {
    const moduleKey = resolveThemePluginModuleKey(themeId, modulePath);
    if (!moduleKey) return null;
    const loader = THEME_PLUGIN_WIDGET_MODULES[moduleKey];
    return typeof loader === 'function' ? loader : null;
};

const createThemeWidgetError = (code, message, details = null) => {
    const error = new Error(message);
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    return error;
};

const createInvalidWidgetTypeError = (widgetType) => createThemeWidgetError(
    'THEME_WIDGET_TYPE_INVALID',
    'Theme widget type must be a non-empty string.',
    {
        widgetType,
    },
);

const createMissingThemeWidgetError = (themeId, widgetType) => createThemeWidgetError(
    'THEME_WIDGET_LOADER_MISSING',
    `Theme '${themeId}' does not declare widget '${widgetType}'.`,
    {
        themeId,
        widgetType,
        widgetKey: `${themeId}:${widgetType}`,
    },
);

const createInvalidThemeWidgetModuleError = (themeId, widgetType, widgetKey) => createThemeWidgetError(
    'THEME_WIDGET_MODULE_DEFAULT_EXPORT_INVALID',
    `Theme widget '${widgetKey}' must provide a renderable default export.`,
    {
        themeId,
        widgetType,
        widgetKey,
    },
);

const warnMissingWidgetOnce = (themeId, widgetType) => {
    const widgetKey = `${themeId}:${widgetType}`;
    if (warnedMissingWidgetKeys.has(widgetKey)) {
        return;
    }
    warnedMissingWidgetKeys.add(widgetKey);
    console.error(`[widgets] Missing explicit widget loader for ${widgetKey}.`);
};

const withChunkRecovery = (loader, widgetKey) => withDynamicImportRecovery(loader, {
    boundaryId: widgetKey,
});

export const WIDGETS = THEME_SURFACE_DESCRIPTOR_LIST.reduce((acc, descriptor) => {
    const widgetTypes = new Set(Object.keys(descriptor.widgetLoaders));
    acc[descriptor.id] = [...widgetTypes].reduce((themeMap, widgetType) => {
        themeMap[widgetType] = `${descriptor.id}:${widgetType}`;
        return themeMap;
    }, {});
    return acc;
}, {});

const resolveLoader = (resolvedThemeId, widgetType, visited = new Set()) => {
    if (typeof widgetType !== 'string' || !widgetType.trim()) return null;
    const safeThemeId = resolveWidgetThemeId(resolvedThemeId);
    const visitKey = `${safeThemeId}:${widgetType}`;
    if (visited.has(visitKey)) {
        return null;
    }
    visited.add(visitKey);

    const widgetLoaders = getWidgetCapability(safeThemeId);
    const directLoaderPath = widgetLoaders?.[widgetType];
    const directLoader = resolveWidgetModuleLoader(safeThemeId, directLoaderPath);
    if (directLoader) {
        return {
            loader: directLoader,
            themeId: safeThemeId,
        };
    }

    return null;
};

const isRenderableWidgetComponent = (candidate) => (
    typeof candidate === 'function'
    || (
        candidate !== null
        && typeof candidate === 'object'
        && typeof candidate.$$typeof === 'symbol'
    )
);

const getOrCreateWidgetModuleRecord = (resolved, cleanWidgetType) => {
    const resolvedKey = `${resolved.themeId}:${cleanWidgetType}`;
    const cachedRecord = moduleRecordCache.get(resolvedKey);
    if (cachedRecord) {
        return cachedRecord;
    }

    const record = {
        key: resolvedKey,
        status: 'loading',
        module: null,
        component: null,
        promise: null,
    };
    moduleRecordCache.set(resolvedKey, record);
    let loadedModulePromise;
    try {
        loadedModulePromise = withChunkRecovery(resolved.loader, resolvedKey)();
    } catch (error) {
        loadedModulePromise = Promise.reject(error);
    }
    const modulePromise = Promise.resolve(loadedModulePromise)
        .then((module) => {
            const resolvedComponent = module?.default;
            if (!isRenderableWidgetComponent(resolvedComponent)) {
                throw createInvalidThemeWidgetModuleError(
                    resolved.themeId,
                    cleanWidgetType,
                    resolvedKey,
                );
            }
            record.status = 'ready';
            record.module = module;
            record.component = resolvedComponent;
            return module;
        })
        .catch((error) => {
            record.status = 'error';
            if (moduleRecordCache.get(resolvedKey) === record) {
                moduleRecordCache.delete(resolvedKey);
            }
            lazyCache.delete(resolvedKey);
            throw error;
        });

    record.promise = modulePromise;
    return record;
};

export const preloadWidgetChunk = (themeId, widgetType) => {
    if (typeof widgetType !== 'string' || !widgetType.trim()) {
        return Promise.reject(createInvalidWidgetTypeError(widgetType));
    }
    const cleanWidgetType = widgetType.trim();
    let resolvedThemeId;
    try {
        resolvedThemeId = resolveWidgetThemeId(themeId);
    } catch (error) {
        return Promise.reject(error);
    }
    const resolved = resolveLoader(resolvedThemeId, cleanWidgetType);
    if (!resolved) {
        return Promise.reject(createMissingThemeWidgetError(resolvedThemeId, cleanWidgetType));
    }
    const record = getOrCreateWidgetModuleRecord(resolved, cleanWidgetType);
    return record.promise.then(() => Object.freeze({
        loaded: true,
        key: record.key,
    }));
};

export const getWidgetChunkState = (themeId, widgetType) => {
    if (typeof widgetType !== 'string' || !widgetType.trim()) {
        throw createInvalidWidgetTypeError(widgetType);
    }
    const cleanWidgetType = widgetType.trim();
    const resolvedThemeId = resolveWidgetThemeId(themeId);
    const resolved = resolveLoader(resolvedThemeId, cleanWidgetType);
    if (!resolved) {
        return Object.freeze({
            status: 'missing',
            key: '',
            themeId: resolvedThemeId,
            widgetType: cleanWidgetType,
        });
    }
    const key = `${resolved.themeId}:${cleanWidgetType}`;
    const record = moduleRecordCache.get(key);
    return Object.freeze({
        status: record?.status === 'ready'
            ? 'ready'
            : record?.status === 'loading'
                ? 'loading'
                : 'idle',
        key,
        themeId: resolved.themeId,
        widgetType: cleanWidgetType,
    });
};

export const getWidget = (themeId, widgetType) => {
    if (typeof widgetType !== 'string' || !widgetType.trim()) return null;
    const cleanWidgetType = widgetType.trim();
    const resolvedThemeId = resolveWidgetThemeId(themeId);
    const resolved = resolveLoader(resolvedThemeId, cleanWidgetType);
    if (!resolved) {
        warnMissingWidgetOnce(resolvedThemeId, cleanWidgetType);
        return null;
    }
    const key = `${resolved.themeId}:${cleanWidgetType}`;
    if (lazyCache.has(key)) return lazyCache.get(key);
    const record = moduleRecordCache.get(key);
    if (record?.status === 'ready') {
        return record.component;
    }

    const LazyComponent = React.lazy(() => (
        getOrCreateWidgetModuleRecord(resolved, cleanWidgetType).promise
    ));
    lazyCache.set(key, LazyComponent);
    return LazyComponent;
};

export const resetThemeWidgetModuleRecordsForTests = () => {
    lazyCache.clear();
    moduleRecordCache.clear();
    warnedMissingWidgetKeys.clear();
};
