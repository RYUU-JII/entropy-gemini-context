import { ENTROPY_RUNTIME_BUILD_INFO } from '../build/runtimeBuildInfo.js';

const DYNAMIC_IMPORT_RECOVERY_MARKER_PREFIX = 'entropy_dynamic_import_recovery_v1';
const DYNAMIC_IMPORT_FAILURE_PATTERNS = Object.freeze([
    'failed to fetch dynamically imported module',
    'importing a module script failed',
    'chunkloaderror',
    'loading chunk',
]);

const getErrorText = (error) => {
    if (!error) return '';
    if (typeof error === 'string') return error.toLowerCase();

    const message = typeof error.message === 'string' ? error.message : '';
    const name = typeof error.name === 'string' ? error.name : '';
    const stack = typeof error.stack === 'string' ? error.stack : '';
    return `${name} ${message} ${stack}`.toLowerCase();
};

const assertIdentifier = (value, code, label) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new TypeError(`${code}: ${label} must be a non-empty string.`);
    }
    return value.trim();
};

const resolveRecoveryContext = (boundaryId, buildId) => ({
    boundaryId: assertIdentifier(
        boundaryId,
        'DYNAMIC_IMPORT_RECOVERY_BOUNDARY_ID_INVALID',
        'boundaryId',
    ),
    buildId: assertIdentifier(
        buildId,
        'DYNAMIC_IMPORT_RECOVERY_BUILD_ID_INVALID',
        'buildId',
    ),
});

const getMarkerKey = (boundaryId) => (
    `${DYNAMIC_IMPORT_RECOVERY_MARKER_PREFIX}:${encodeURIComponent(boundaryId)}`
);

const logDiagnostic = (logger, code, context, error) => {
    const message = (
        `[dynamic-import-recovery] ${code}: `
        + `boundary="${context.boundaryId}" buildId="${context.buildId}".`
    );
    if (logger && typeof logger.error === 'function') {
        logger.error(message, error);
        return;
    }
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error(message, error);
    }
};

const resolveSessionStorage = ({ storage, logger, context }) => {
    if (storage !== undefined) {
        return storage;
    }
    if (typeof window === 'undefined') {
        logDiagnostic(logger, 'SESSION_STORAGE_UNAVAILABLE', context);
        return null;
    }
    try {
        return window.sessionStorage;
    } catch (error) {
        logDiagnostic(logger, 'SESSION_STORAGE_ACCESS_FAILED', context, error);
        return null;
    }
};

const clearRecoveryMarker = ({ context, storage, logger }) => {
    const resolvedStorage = resolveSessionStorage({ storage, logger, context });
    if (!resolvedStorage || typeof resolvedStorage.removeItem !== 'function') {
        if (resolvedStorage) {
            logDiagnostic(logger, 'SESSION_STORAGE_INVALID', context);
        }
        return false;
    }
    try {
        resolvedStorage.removeItem(getMarkerKey(context.boundaryId));
        return true;
    } catch (error) {
        logDiagnostic(logger, 'RECOVERY_MARKER_CLEAR_FAILED', context, error);
        return false;
    }
};

const invokeReload = ({ reload, logger, context }) => {
    let reloadPage = reload;
    if (reloadPage === undefined) {
        if (
            typeof window === 'undefined'
            || !window.location
            || typeof window.location.reload !== 'function'
        ) {
            logDiagnostic(logger, 'RELOAD_UNAVAILABLE', context);
            return false;
        }
        reloadPage = () => window.location.reload();
    }
    if (typeof reloadPage !== 'function') {
        logDiagnostic(logger, 'RELOAD_UNAVAILABLE', context);
        return false;
    }
    try {
        reloadPage();
        return true;
    } catch (error) {
        logDiagnostic(logger, 'RELOAD_FAILED', context, error);
        return false;
    }
};

const triggerAutomaticReload = ({
    context,
    storage,
    reload,
    logger,
}) => {
    const resolvedStorage = resolveSessionStorage({ storage, logger, context });
    if (
        !resolvedStorage
        || typeof resolvedStorage.getItem !== 'function'
        || typeof resolvedStorage.setItem !== 'function'
    ) {
        if (resolvedStorage) {
            logDiagnostic(logger, 'SESSION_STORAGE_INVALID', context);
        }
        return false;
    }

    const markerKey = getMarkerKey(context.boundaryId);
    let recoveredBuildId;
    try {
        recoveredBuildId = resolvedStorage.getItem(markerKey);
    } catch (error) {
        logDiagnostic(logger, 'RECOVERY_MARKER_READ_FAILED', context, error);
        return false;
    }
    if (recoveredBuildId === context.buildId) {
        return false;
    }
    try {
        resolvedStorage.setItem(markerKey, context.buildId);
    } catch (error) {
        logDiagnostic(logger, 'RECOVERY_MARKER_WRITE_FAILED', context, error);
        return false;
    }

    return invokeReload({ reload, logger, context });
};

export const isDynamicImportFailure = (error) => {
    const text = getErrorText(error);
    return Boolean(text) && DYNAMIC_IMPORT_FAILURE_PATTERNS.some((pattern) => (
        text.includes(pattern)
    ));
};

export const reloadAfterDynamicImportFailure = ({
    boundaryId,
    buildId = ENTROPY_RUNTIME_BUILD_INFO.buildId,
    storage,
    reload,
    logger = console,
} = {}) => {
    const context = resolveRecoveryContext(boundaryId, buildId);
    clearRecoveryMarker({ context, storage, logger });
    return invokeReload({ reload, logger, context });
};

export const withDynamicImportRecovery = (loader, {
    boundaryId,
    buildId = ENTROPY_RUNTIME_BUILD_INFO.buildId,
    storage,
    reload,
    logger = console,
    terminalFallback,
} = {}) => {
    if (typeof loader !== 'function') {
        throw new TypeError(
            'DYNAMIC_IMPORT_RECOVERY_LOADER_INVALID: loader must be a function.',
        );
    }
    if (terminalFallback !== undefined && typeof terminalFallback !== 'function') {
        throw new TypeError(
            'DYNAMIC_IMPORT_RECOVERY_TERMINAL_FALLBACK_INVALID: '
            + 'terminalFallback must be a function.',
        );
    }
    const context = resolveRecoveryContext(boundaryId, buildId);

    return async function loadWithDynamicImportRecovery(...args) {
        try {
            const module = await loader.apply(this, args);
            clearRecoveryMarker({ context, storage, logger });
            return module;
        } catch (error) {
            if (!isDynamicImportFailure(error)) {
                throw error;
            }
            const didTriggerReload = triggerAutomaticReload({
                context,
                storage,
                reload,
                logger,
            });
            if (didTriggerReload) {
                return new Promise(() => { });
            }
            if (terminalFallback) {
                return terminalFallback(error);
            }
            throw error;
        }
    };
};
