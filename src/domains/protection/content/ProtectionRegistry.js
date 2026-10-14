import VisualManager from '../../nudge/visual/visualManager.js';
import TextPipeline from '../../nudge/textPipeline.js';
import InputVisualBrakeManager from '../../nudge/inputVisualBrakeManager.js';
import InteractionManager from '../../nudge/interactionManager.js';
import NavigationButtonLockManager from '../../nudge/navigationButtonLockManager.js';
import {
    removeLoadedSocialMetricsManager,
    updateSocialMetricsManager,
} from '../../nudge/visual/lazySocialMetricsManager.js';
import { projectCompiledRuntimeSocialMetricsSetting } from '../contracts/compiledRuntimeFilterPlanContract.js';
import { ENSO_INTERVAL_PRESETS } from '../../settings/config/ensoIntervalPolicy.js';
import {
    recordProtectionFeatureError,
    recordProtectionFeatureMount,
    recordProtectionFeatureUnmount,
} from './runtime/protectionRuntimeDiagnostics.js';

let sentinelProtocolHostPromise = null;
let loadedSentinelProtocolHost = null;
let videoManagerPromise = null;
let loadedVideoManager = null;
let ensoRuntimeEpisodeManagerPromise = null;
let loadedEnsoRuntimeEpisodeManager = null;
const lazyManagerInvocationTokens = new Map();
const lazyManagerDiagnosticErrors = new WeakSet();
const CONTENT_DEBUG_TOOLS_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : true
);

function debugProtectionRegistry(...args) {
    if (!CONTENT_DEBUG_TOOLS_ENABLED) return;
    console.debug(...args);
}

function isPromiseLike(value) {
    return value && typeof value.then === 'function';
}

function markLazyManagerDiagnosticRecorded(error) {
    if (error && typeof error === 'object') {
        lazyManagerDiagnosticErrors.add(error);
    }
}

function hasLazyManagerDiagnosticRecorded(error) {
    return !!(error && typeof error === 'object' && lazyManagerDiagnosticErrors.has(error));
}

function loadDefaultModule({
    label,
    importer,
    getLoaded,
    setLoaded,
    getPromise,
    setPromise,
}) {
    const loaded = getLoaded();
    if (loaded) {
        return Promise.resolve(loaded);
    }
    const existingPromise = getPromise();
    if (existingPromise) {
        return existingPromise;
    }
    const nextPromise = importer()
        .then(({ default: moduleDefault }) => {
            setLoaded(moduleDefault);
            return moduleDefault;
        })
        .catch((error) => {
            setPromise(null);
            console.error(`[ProtectionRegistry] Failed to load ${label}.`, error);
            throw error;
        });
    setPromise(nextPromise);
    return nextPromise;
}

function invokeLazyManager({
    label,
    method,
    args = [],
    loadIfMissing = true,
    load,
    getLoaded,
    diagnosticFeatureKey = null,
    diagnosticPhase = null,
    invocationKey = `${label}.${method}`,
}) {
    const runManagerMethod = (manager) => {
        if (typeof manager?.[method] !== 'function') {
            throw new Error(`${label.toUpperCase()}_METHOD_MISSING:${method}`);
        }
        return manager[method](...args);
    };
    const handleFailure = (error) => {
        if (diagnosticFeatureKey) {
            recordProtectionFeatureError(diagnosticFeatureKey, error, {
                phase: diagnosticPhase || `lazy_${method}`,
                manager: label,
                method,
            });
            markLazyManagerDiagnosticRecorded(error);
        }
        console.error(`[ProtectionRegistry] Failed to run ${label}.${method}.`, error);
        throw error;
    };

    // A loaded invocation also supersedes an older import continuation whose
    // module resolved but whose method has not run yet.
    const token = Symbol(invocationKey);
    lazyManagerInvocationTokens.set(invocationKey, token);
    const loaded = getLoaded();
    if (loaded) {
        try {
            return runManagerMethod(loaded);
        } catch (error) {
            return handleFailure(error);
        }
    }
    if (!loadIfMissing) {
        lazyManagerInvocationTokens.delete(invocationKey);
        return undefined;
    }

    return load()
        .then((manager) => {
            if (lazyManagerInvocationTokens.get(invocationKey) !== token) {
                return undefined;
            }
            return runManagerMethod(manager);
        })
        .catch(handleFailure);
}

function loadVideoManager() {
    return loadDefaultModule({
        label: 'VideoManager',
        importer: () => import('../../nudge/video/index.js'),
        getLoaded: () => loadedVideoManager,
        setLoaded: (manager) => {
            loadedVideoManager = manager;
        },
        getPromise: () => videoManagerPromise,
        setPromise: (promise) => {
            videoManagerPromise = promise;
        },
    });
}

function loadEnsoRuntimeEpisodeManager() {
    return loadDefaultModule({
        label: 'EnsoRuntimeEpisodeManager',
        importer: () => import('../../nudge/interaction/EnsoRuntimeEpisodeManager.js'),
        getLoaded: () => loadedEnsoRuntimeEpisodeManager,
        setLoaded: (manager) => {
            loadedEnsoRuntimeEpisodeManager = manager;
        },
        getPromise: () => ensoRuntimeEpisodeManagerPromise,
        setPromise: (promise) => {
            ensoRuntimeEpisodeManagerPromise = promise;
        },
    });
}

const VideoManager = {
    setVideoSkipEnabled(...args) {
        return invokeLazyManager({
            label: 'VideoManager',
            method: 'setVideoSkipEnabled',
            args,
            loadIfMissing: args[0] !== false,
            load: loadVideoManager,
            getLoaded: () => loadedVideoManager,
            diagnosticFeatureKey: 'videoSkipGuard',
            diagnosticPhase: args[0] === false ? 'lazy_unmount' : 'lazy_mount',
            invocationKey: 'videoSkipGuard',
        });
    },
    setShortFormBlockEnabled(...args) {
        return invokeLazyManager({
            label: 'VideoManager',
            method: 'setShortFormBlockEnabled',
            args,
            loadIfMissing: args[0] !== false,
            load: loadVideoManager,
            getLoaded: () => loadedVideoManager,
            diagnosticFeatureKey: 'shortFormBlock',
            diagnosticPhase: args[0] === false ? 'lazy_unmount' : 'lazy_mount',
            invocationKey: 'shortFormBlock',
        });
    },
    remove() {
        return invokeLazyManager({
            label: 'VideoManager',
            method: 'remove',
            loadIfMissing: false,
            load: loadVideoManager,
            getLoaded: () => loadedVideoManager,
        });
    },
};

const EnsoRuntimeEpisodeManager = {
    apply(...args) {
        return invokeLazyManager({
            label: 'EnsoRuntimeEpisodeManager',
            method: 'apply',
            args,
            load: loadEnsoRuntimeEpisodeManager,
            getLoaded: () => loadedEnsoRuntimeEpisodeManager,
            diagnosticFeatureKey: 'infiniteScrollGuard',
            diagnosticPhase: 'lazy_mount',
            invocationKey: 'infiniteScrollGuard',
        });
    },
    remove() {
        return invokeLazyManager({
            label: 'EnsoRuntimeEpisodeManager',
            method: 'remove',
            loadIfMissing: false,
            load: loadEnsoRuntimeEpisodeManager,
            getLoaded: () => loadedEnsoRuntimeEpisodeManager,
            invocationKey: 'infiniteScrollGuard',
        });
    },
};

const SocialMetricsManager = {
    update(...args) {
        return updateSocialMetricsManager(...args);
    },
    remove() {
        return removeLoadedSocialMetricsManager();
    },
};

const INACTIVE_KEYED_EFFECT_SIGNATURE = 'inactive';

function stableSerializeKeyedEffectValue(value) {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) {
        return value.map((entry) => stableSerializeKeyedEffectValue(entry));
    }
    if (typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((acc, entryKey) => {
                acc[entryKey] = stableSerializeKeyedEffectValue(value[entryKey]);
                return acc;
            }, {});
    }
    return value;
}

function buildKeyedEffectSignature(value, config) {
    return JSON.stringify(stableSerializeKeyedEffectValue({
        active: true,
        value,
        config: config || null,
    }));
}

export function createDiagnosticKeyedEffect({
    key,
    mount,
    unmount,
    startupPhase = null,
}) {
    let lastSignature = INACTIVE_KEYED_EFFECT_SIGNATURE;
    let operationEpoch = 0;
    let pendingPromise = null;

    return {
        key,
        startupPhase,
        mount(value, config, context = null) {
            const nextSignature = buildKeyedEffectSignature(value, config);
            if (lastSignature === nextSignature) {
                return pendingPromise || undefined;
            }
            const epoch = ++operationEpoch;
            pendingPromise = null;
            const previousSignature = lastSignature;
            lastSignature = nextSignature;
            try {
                const result = mount(value, config, context);
                if (isPromiseLike(result)) {
                    pendingPromise = result
                        .then((resolved) => {
                            if (operationEpoch === epoch) {
                                recordProtectionFeatureMount(key, config, {
                                    value,
                                    source: 'protection_registry',
                                });
                            }
                            return resolved;
                        })
                        .catch((error) => {
                            if (operationEpoch === epoch) {
                                lastSignature = previousSignature;
                            }
                            if (!hasLazyManagerDiagnosticRecorded(error)) {
                                recordProtectionFeatureError(key, error, { phase: 'mount' });
                            }
                            throw error;
                        }).finally(() => {
                            if (operationEpoch === epoch) pendingPromise = null;
                        });
                    return pendingPromise;
                }
                recordProtectionFeatureMount(key, config, {
                    value,
                    source: 'protection_registry',
                });
                return result;
            } catch (error) {
                lastSignature = previousSignature;
                recordProtectionFeatureError(key, error, { phase: 'mount' });
                throw error;
            }
        },
        unmount({ force = false } = {}) {
            if (!force && lastSignature === INACTIVE_KEYED_EFFECT_SIGNATURE) {
                return pendingPromise || undefined;
            }
            const epoch = ++operationEpoch;
            pendingPromise = null;
            const previousSignature = lastSignature;
            lastSignature = INACTIVE_KEYED_EFFECT_SIGNATURE;
            try {
                const result = unmount();
                if (isPromiseLike(result)) {
                    pendingPromise = result
                        .then((resolved) => {
                            if (operationEpoch === epoch) {
                                recordProtectionFeatureUnmount(key, {
                                    source: 'protection_registry',
                                });
                            }
                            return resolved;
                        })
                        .catch((error) => {
                            if (operationEpoch === epoch) {
                                lastSignature = previousSignature;
                            }
                            if (!hasLazyManagerDiagnosticRecorded(error)) {
                                recordProtectionFeatureError(key, error, { phase: 'unmount' });
                            }
                            throw error;
                        }).finally(() => {
                            if (operationEpoch === epoch) pendingPromise = null;
                        });
                    return pendingPromise;
                }
                recordProtectionFeatureUnmount(key, {
                    source: 'protection_registry',
                });
                return result;
            } catch (error) {
                lastSignature = previousSignature;
                recordProtectionFeatureError(key, error, { phase: 'unmount' });
                throw error;
            }
        },
    };
}

function loadSentinelProtocolHost() {
    if (loadedSentinelProtocolHost) {
        return Promise.resolve(loadedSentinelProtocolHost);
    }
    sentinelProtocolHostPromise ||= import('../../nudge/runtime/SentinelProtocolHost.js')
        .then(({ default: SentinelProtocolHost }) => {
            loadedSentinelProtocolHost = SentinelProtocolHost;
            return loadedSentinelProtocolHost;
        })
        .catch((error) => {
            sentinelProtocolHostPromise = null;
            console.error('[ProtectionRegistry] Failed to load SentinelProtocolHost.', error);
            throw error;
        });
    return sentinelProtocolHostPromise;
}

export function stopLoadedSentinelProtocolHostIfActive() {
    if (!loadedSentinelProtocolHost) return;
    if (loadedSentinelProtocolHost.hasLifecycleOwnership() && loadedSentinelProtocolHost.getMode() !== 'debug') {
        return loadedSentinelProtocolHost.stop();
    }
}

export function stopLoadedNudgeGameIfActive() {
    return stopLoadedSentinelProtocolHostIfActive();
}

export async function withSentinelProtocolHost(callback) {
    const SentinelProtocolHost = await loadSentinelProtocolHost();
    return callback(SentinelProtocolHost);
}

export async function withNudgeGame(callback) {
    return withSentinelProtocolHost(callback);
}

/**
 * 1. Keyed Protection Effects
 * These respond to a specific key in the filters object.
 * { key: string, mount: (value) => void, unmount: () => void }
 */
export const keyedProtectionEffects = [
    createDiagnosticKeyedEffect({
        key: 'inputVisualBrake',
        startupPhase: 'input',
        mount: () => InputVisualBrakeManager.apply(),
        unmount: () => InputVisualBrakeManager.remove(),
    }),
    createDiagnosticKeyedEffect({
        key: 'clickDelay',
        startupPhase: 'input',
        mount: (val, config) => InteractionManager.applyClickDelay(val, config),
        unmount: () => InteractionManager.removeClickDelay(),
    }),
    createDiagnosticKeyedEffect({
        key: 'ensoGate',
        mount: (val, config, context) => {
            if (!val || typeof val !== 'object' || Array.isArray(val)
                || Object.keys(val).length !== 1
                || !Object.hasOwn(val, 'intervalMs')
                || !Object.values(ENSO_INTERVAL_PRESETS).includes(val.intervalMs)) {
                throw new Error('ENSO_COMPILED_INTERVAL_INVALID');
            }
            return InteractionManager.applyEnsoGate(true, { ...config, ...val }, context);
        },
        unmount: () => InteractionManager.removeEnsoGate(),
    }),
    createDiagnosticKeyedEffect({
        key: 'scrollFriction',
        startupPhase: 'input',
        mount: (val) => InteractionManager.applyScroll(val),
        unmount: () => InteractionManager.removeScroll(),
    }),
    createDiagnosticKeyedEffect({
        key: 'navigationButtonLock',
        mount: (val) => NavigationButtonLockManager.apply(val),
        unmount: () => NavigationButtonLockManager.remove(),
    }),
    createDiagnosticKeyedEffect({
        key: 'videoSkipGuard',
        mount: (val) => {
            debugProtectionRegistry('[ProtectionRegistry] Enabling Video Skip Guard');
            return VideoManager.setVideoSkipEnabled(true, val);
        },
        unmount: () => {
            debugProtectionRegistry('[ProtectionRegistry] Disabling Video Skip Guard');
            return VideoManager.setVideoSkipEnabled(false);
        },
    }),
    createDiagnosticKeyedEffect({
        key: 'shortFormBlock',
        mount: () => {
            debugProtectionRegistry('[ProtectionRegistry] Enabling Shortform Block');
            return VideoManager.setShortFormBlockEnabled(true);
        },
        unmount: () => {
            debugProtectionRegistry('[ProtectionRegistry] Disabling Shortform Block');
            return VideoManager.setShortFormBlockEnabled(false);
        },
    }),
    createDiagnosticKeyedEffect({
        key: 'infiniteScrollGuard',
        mount: (val, _config, context) => EnsoRuntimeEpisodeManager.apply(val, context),
        unmount: () => EnsoRuntimeEpisodeManager.remove(),
    }),
];

/**
 * 2. Global Protection Effects
 * These consume the entire filters object or multiple keys.
 * { update: (filters) => void, remove: () => void }
 */
export const globalProtectionEffects = [
    {
        label: 'visualManager',
        startupPhase: 'root',
        // VisualManager handles blur, grayscale, etc. internally based on filters
        update: (filters) => VisualManager.updateCooperatively(filters),
        remove: () => VisualManager.remove(),
    },
    {
        label: 'textPipeline',
        // TextPipeline handles text-related filters (spacing/blur/shadow/opacity/shuffle)
        update: (filters) => TextPipeline.update(filters),
        remove: () => TextPipeline.remove(),
    },
    {
        label: 'socialMetricsManager',
        // SocialMetricsManager owns one canonical setting, not the full compiled plan.
        update: (filters) =>
            SocialMetricsManager.update(projectCompiledRuntimeSocialMetricsSetting(filters)),
        remove: () => SocialMetricsManager.remove(),
    },
];

/**
 * Utility to clear EVERYTHING
 */
export async function clearAllProtectionEffects() {
    // Invoke every cleanup immediately, then acknowledge only after all settle.
    const operations = [
        ...keyedProtectionEffects.map((effect) => ({
            label: effect.key,
            run: () => effect.unmount({ force: true }),
        })),
        ...globalProtectionEffects.map((effect) => ({
            label: effect.label,
            run: () => effect.remove(),
        })),
        { label: 'sentinelProtocolHost', run: stopLoadedSentinelProtocolHostIfActive },
    ];
    const results = await Promise.allSettled(operations.map(async ({ label, run }) => {
        try {
            await run();
        } catch (error) {
            console.warn(`[ProtectionRegistry] Failed to clear ${label}:`, error);
            throw error;
        }
    }));
    const failures = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
    if (failures.length > 0) throw new AggregateError(failures, 'PROTECTION_EFFECT_CLEANUP_FAILED');
}
