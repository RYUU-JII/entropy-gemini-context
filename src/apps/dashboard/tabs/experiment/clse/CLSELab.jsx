/**
 * CLSELab - Cognitive Load Sensing Engine diagnostics for the Experiment hub
 * 
 * Refactored for better organization:
 * - Status: Real-time system state and alerts.
 * - Baseline: Same-grain evidence and sensitivity controls.
 * - Logs: Raw data buckets and recent events.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { Panel } from '@/ui-kit/Panel.jsx';
import { ensurePrecisionInsightsPermissionBundleStrict } from '@/platform/security/capabilityGate.js';
import { runtimeSendMessage } from '@/platform/chrome/ChromeService.js';
import { requireCanonicalCLSEStatusSnapshot } from '@/domains/behavior/clseStatusContract.js';
import {
    PERSONAL_BASELINE_METRIC_GRAINS,
    PERSONAL_BASELINE_STATUSES,
} from '@/lib/personalBaselineContract.js';
import {
    DashboardTabErrorSurface,
    DashboardTabLoadingSurface,
} from '@/apps/dashboard/loading/DashboardTabStateSurfaces.jsx';
import SettingsSyncBanner from '@/apps/dashboard/components/SettingsSyncBanner.jsx';
import {
    SETTINGS_COMMAND_CHANNELS,
    useSettingsCommandSync,
} from '@/apps/dashboard/stores/settingsCommandBus.js';
import { useCLSEStore } from '@/apps/dashboard/stores/useCLSEStore.js';
import { resolveSettingsSyncNotice } from '@/apps/dashboard/utils/settingsSyncNotice.js';

const MESSAGE_TYPES = {
    CLSE_GET_STATUS: 'CLSE_GET_STATUS',
    CLSE_GET_BUCKETS: 'CLSE_GET_BUCKETS',
    CLSE_RESET_BASELINE: 'CLSE_RESET_BASELINE',
    CLSE_GET_AGGRESSION_LOGS: 'CLSE_GET_AGGRESSION_LOGS',
};

const CLSE_BASELINE_FEATURE_ROWS = Object.freeze([
    { id: 'tab_switch_rate', labelKey: 'tab_switch_rate' },
    { id: 'nav_rate', labelKey: 'navigation_rate' },
    { id: 'scroll_volatility', labelKey: 'scroll_volatility' },
    { id: 'seek_rate', labelKey: 'seek_rate' },
]);

function getCLSEErrorMessage(error, fallback = 'CLSE_COMMAND_FAILED') {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error.trim();
    if (error && typeof error === 'object') {
        if (typeof error.message === 'string' && error.message.trim()) return error.message.trim();
        if (typeof error.error === 'string' && error.error.trim()) return error.error.trim();
    }
    return fallback;
}

function createCLSEMessageError(type, response = null, cause = null) {
    const message = getCLSEErrorMessage(response, `${type}_FAILED`);
    const error = new Error(message);
    error.code = typeof response?.error === 'string' && response.error.trim()
        ? response.error.trim()
        : `${type}_FAILED`;
    error.response = response;
    if (cause) error.cause = cause;
    return error;
}

function requireCLSEStatus(response) {
    try {
        return requireCanonicalCLSEStatusSnapshot(response);
    } catch (error) {
        throw createCLSEMessageError(MESSAGE_TYPES.CLSE_GET_STATUS, {
            error: error?.message || 'CLSE_STATUS_RESPONSE_INVALID',
        }, error);
    }
}

function requireCLSEArrayField(response, field, type) {
    if (!response || typeof response !== 'object' || !Array.isArray(response[field])) {
        throw createCLSEMessageError(type, {
            error: `CLSE_${field.toUpperCase()}_RESPONSE_INVALID`,
        });
    }
    return response[field];
}

async function sendCLSEMessage(type, payload = {}) {
    try {
        const response = await runtimeSendMessage({ type, payload });
        if (response?.success === false) {
            throw createCLSEMessageError(type, response);
        }
        if (!response || typeof response !== 'object') {
            throw createCLSEMessageError(type, {
                error: `${type}_RESPONSE_INVALID`,
            });
        }
        return response;
    } catch (error) {
        if (error?.response) throw error;
        throw createCLSEMessageError(type, null, error);
    }
}

export default function CLSELab({ isActive = true }) {
    const { t } = useAppTranslation('settings');
    const tClse = useCallback((key, fallbackOrOptions = {}, maybeOptions = {}) => (
        t(`clse.${key}`, {
            ...(fallbackOrOptions && typeof fallbackOrOptions === 'object' ? fallbackOrOptions : maybeOptions),
        })
    ), [t]);
    const clseSync = useSettingsCommandSync(SETTINGS_COMMAND_CHANNELS.CLSE);
    const setEnabled = useCLSEStore((state) => state.setEnabled);
    const setSensitivity = useCLSEStore((state) => state.setSensitivityScale);
    const setAlertCooldown = useCLSEStore((state) => state.setAlertCooldownMs);
    const refreshControlSnapshot = useCLSEStore((state) => state.refreshStatus);
    const controlSnapshotLoaded = useCLSEStore((state) => state.loaded === true);
    const controlSnapshotError = useCLSEStore((state) => state.loadError || null);
    const [subTab, setActiveSubTab] = useState('status'); // 'status', 'baseline', 'logs'
    const [status, setStatus] = useState(null);
    const [actionErrorMessage, setActionErrorMessage] = useState('');
    const [buckets60s, setBuckets60s] = useState([]);
    const [events, setEvents] = useState([]);
    const [aggressionLogs, setAggressionLogs] = useState([]);
    const [diagnosticsPhase, setDiagnosticsPhase] = useState('idle');
    const [diagnosticsError, setDiagnosticsError] = useState(null);
    const [loadPhase, setLoadPhase] = useState('loading');
    const [loadError, setLoadError] = useState(null);
    const [refreshCount, setRefreshCount] = useState(0);
    const [sensitivityScale, setSensitivityScale] = useState(1);
    const [alertCooldownMs, setAlertCooldownMs] = useState(120000);
    const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);
    const [resetInFlight, setResetInFlight] = useState(false);
    const hasResolvedSnapshotRef = useRef(false);
    const hasResolvedDiagnosticsRef = useRef(false);
    const activeRef = useRef(isActive);
    const requestRevisionRef = useRef(0);
    const diagnosticsRevisionRef = useRef(0);
    const controlDraftDirtyRef = useRef({
        sensitivity: false,
        cooldown: false,
    });
    const controlCommitQueuesRef = useRef({
        sensitivity: Promise.resolve(),
        cooldown: Promise.resolve(),
    });
    const lastRequestedControlValuesRef = useRef({
        sensitivity: null,
        cooldown: null,
    });
    const canonicalControlValuesRef = useRef({
        sensitivity: null,
        cooldown: null,
    });
    const settingsSyncNotice = useMemo(
        () => resolveSettingsSyncNotice([clseSync], t),
        [clseSync, t],
    );
    const formatActionError = useCallback((key, error) => (
        tClse(key, {
            message: getCLSEErrorMessage(error),
        })
    ), [tClse]);
    // Fetch data
    const fetchData = useCallback(async ({
        showLoading = false,
        treatFailureAsFatal = false,
    } = {}) => {
        const requestRevision = requestRevisionRef.current + 1;
        requestRevisionRef.current = requestRevision;
        if (showLoading) {
            setLoadPhase('loading');
            setLoadError(null);
        }

        try {
            const statusResponse = await sendCLSEMessage(MESSAGE_TYPES.CLSE_GET_STATUS);
            if (!activeRef.current || requestRevision !== requestRevisionRef.current) {
                return;
            }
            const statusRes = requireCLSEStatus(statusResponse);
            setStatus(statusRes);
            if (!controlDraftDirtyRef.current.sensitivity) {
                setSensitivityScale(statusRes.sensitivityScale);
            }
            if (!controlDraftDirtyRef.current.cooldown) {
                setAlertCooldownMs(statusRes.alertCooldownMs);
            }
            canonicalControlValuesRef.current = {
                sensitivity: statusRes.sensitivityScale,
                cooldown: statusRes.alertCooldownMs,
            };
            hasResolvedSnapshotRef.current = true;
            setLoadPhase('ready');
            setLoadError(null);
        } catch (err) {
            if (!activeRef.current || requestRevision !== requestRevisionRef.current) {
                return;
            }
            console.error('[CLSELab] Fetch error:', err);
            const nextError = err instanceof Error ? err : new Error(getCLSEErrorMessage(err, 'CLSE_WORKSPACE_LOAD_FAILED'));
            if (treatFailureAsFatal) {
                setLoadPhase('error');
                setLoadError(nextError);
            } else {
                setLoadError(nextError);
            }
        }
    }, []);

    const fetchDiagnostics = useCallback(async () => {
        const requestRevision = diagnosticsRevisionRef.current + 1;
        diagnosticsRevisionRef.current = requestRevision;
        setDiagnosticsPhase(hasResolvedDiagnosticsRef.current ? 'refreshing' : 'loading');
        try {
            const [bucketsResponse, aggressionResponse] = await Promise.all([
                sendCLSEMessage(MESSAGE_TYPES.CLSE_GET_BUCKETS),
                sendCLSEMessage(MESSAGE_TYPES.CLSE_GET_AGGRESSION_LOGS, {
                    rangeMs: 60 * 60 * 1000,
                    limit: 200,
                }),
            ]);
            if (!activeRef.current || requestRevision !== diagnosticsRevisionRef.current) {
                return;
            }
            setBuckets60s(requireCLSEArrayField(bucketsResponse, 'buckets60s', MESSAGE_TYPES.CLSE_GET_BUCKETS));
            setEvents(requireCLSEArrayField(bucketsResponse, 'events', MESSAGE_TYPES.CLSE_GET_BUCKETS));
            setAggressionLogs(requireCLSEArrayField(aggressionResponse, 'logs', MESSAGE_TYPES.CLSE_GET_AGGRESSION_LOGS));
            hasResolvedDiagnosticsRef.current = true;
            setDiagnosticsPhase('ready');
            setDiagnosticsError(null);
        } catch (error) {
            if (!activeRef.current || requestRevision !== diagnosticsRevisionRef.current) {
                return;
            }
            setDiagnosticsPhase('error');
            setDiagnosticsError(error instanceof Error ? error : new Error(getCLSEErrorMessage(error)));
        }
    }, []);

    // Initial fetch and polling
    useEffect(() => {
        activeRef.current = isActive;
        if (!isActive) {
            requestRevisionRef.current += 1;
            return undefined;
        }

        void fetchData({
            showLoading: !hasResolvedSnapshotRef.current,
            treatFailureAsFatal: !hasResolvedSnapshotRef.current,
        });
        const interval = setInterval(() => {
            setRefreshCount(c => c + 1);
            void fetchData();
        }, 5000); // Refresh every 5 seconds

        return () => {
            activeRef.current = false;
            requestRevisionRef.current += 1;
            diagnosticsRevisionRef.current += 1;
            clearInterval(interval);
        };
    }, [fetchData, isActive]);

    useEffect(() => {
        if (!isActive || subTab !== 'logs') return undefined;
        void fetchDiagnostics();
        const interval = setInterval(() => {
            void fetchDiagnostics();
        }, 5000);
        return () => {
            diagnosticsRevisionRef.current += 1;
            clearInterval(interval);
        };
    }, [fetchDiagnostics, isActive, subTab]);

    // Handlers
    const handleToggle = async () => {
        if (!controlSnapshotLoaded) {
            setActionErrorMessage(getCLSEErrorMessage(
                controlSnapshotError,
                'CLSE_CONTROL_SNAPSHOT_NOT_READY',
            ));
            return;
        }
        const newEnabled = !status?.isEnabled;
        if (newEnabled) {
            let granted = false;
            try {
                granted = await ensurePrecisionInsightsPermissionBundleStrict();
            } catch (error) {
                setActionErrorMessage(formatActionError('permission_check_failed', error));
                return;
            }
            if (!granted) {
                setActionErrorMessage(t('clse.permission_denied'));
                return;
            }
        }
        try {
            await setEnabled(newEnabled);
            setActionErrorMessage('');
            await fetchData();
        } catch (error) {
            setActionErrorMessage(formatActionError('save_failed', error));
        }
    };

    const handleControlSnapshotRetry = async () => {
        try {
            await refreshControlSnapshot();
            setActionErrorMessage('');
        } catch (error) {
            setActionErrorMessage(formatActionError('load_failed', error));
        }
    };

    useEffect(() => {
        if (!actionErrorMessage) return;
        const timeoutId = setTimeout(() => setActionErrorMessage(''), 5000);
        return () => clearTimeout(timeoutId);
    }, [actionErrorMessage]);

    const enqueueControlCommit = (field, value, commit) => {
        if (!controlSnapshotLoaded || !Number.isFinite(value)) return;
        if (lastRequestedControlValuesRef.current[field] === value) return;
        if (
            lastRequestedControlValuesRef.current[field] === null
            && canonicalControlValuesRef.current[field] === value
        ) {
            controlDraftDirtyRef.current[field] = false;
            return;
        }
        lastRequestedControlValuesRef.current[field] = value;
        const previous = controlCommitQueuesRef.current[field] || Promise.resolve();
        const next = previous
            .catch(() => undefined)
            .then(async () => {
                const releaseLatestDraft = () => {
                    if (lastRequestedControlValuesRef.current[field] === value) {
                        controlDraftDirtyRef.current[field] = false;
                    }
                };
                try {
                    await commit(value);
                    releaseLatestDraft();
                    if (activeRef.current) {
                        await fetchData();
                        setActionErrorMessage('');
                    }
                } catch (error) {
                    releaseLatestDraft();
                    if (lastRequestedControlValuesRef.current[field] === value) {
                        lastRequestedControlValuesRef.current[field] = null;
                    }
                    if (activeRef.current) {
                        setActionErrorMessage(formatActionError('save_failed', error));
                        await fetchData();
                    }
                }
            })
            .finally(() => {
                if (lastRequestedControlValuesRef.current[field] === value) {
                    lastRequestedControlValuesRef.current[field] = null;
                }
            });
        controlCommitQueuesRef.current[field] = next;
    };
    const commitSensitivityDraft = (rawValue) => {
        enqueueControlCommit('sensitivity', Number(rawValue), setSensitivity);
    };
    const commitCooldownDraft = (rawValue) => {
        enqueueControlCommit('cooldown', Number(rawValue), setAlertCooldown);
    };
    const shouldCommitRangeKey = (key) => (
        key === 'ArrowLeft'
        || key === 'ArrowRight'
        || key === 'ArrowUp'
        || key === 'ArrowDown'
        || key === 'Home'
        || key === 'End'
        || key === 'PageUp'
        || key === 'PageDown'
    );

    const handleResetBaseline = async () => {
        if (resetInFlight) return;
        const recoveringFromLoadError = loadPhase === 'error';
        setResetInFlight(true);
        try {
            await sendCLSEMessage(MESSAGE_TYPES.CLSE_RESET_BASELINE);
            setActionErrorMessage('');
            setIsResetConfirmationOpen(false);
            await fetchData({
                showLoading: recoveringFromLoadError,
                treatFailureAsFatal: recoveringFromLoadError,
            });
        } catch (error) {
            setActionErrorMessage(formatActionError('reset_failed', error));
        } finally {
            setResetInFlight(false);
        }
    };

    const renderResetConfirmation = () => {
        if (!isResetConfirmationOpen) return null;
        return (
            <div
                role="alertdialog"
                aria-labelledby="clse-baseline-reset-title"
                aria-describedby="clse-baseline-reset-description"
                className="rounded-lg border border-[var(--color-warning)]/50 bg-[var(--color-surface-elevated)] p-4 text-sm"
            >
                <div id="clse-baseline-reset-title" className="font-semibold text-[var(--color-on-surface)]">
                    {tClse('baseline.reset_confirm_title', 'Reset personal baseline?')}
                </div>
                <p id="clse-baseline-reset-description" className="mt-1 text-[var(--color-on-surface-muted)]">
                    {tClse('baseline.reset_confirm_description', 'This starts a new learning epoch and permanently clears the learned evidence and associated aggression diagnostics.')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleResetBaseline}
                        disabled={resetInFlight}
                        className="rounded bg-[var(--color-warning)] px-3 py-1.5 text-xs font-semibold text-black disabled:cursor-wait disabled:opacity-60"
                    >
                        {resetInFlight
                            ? tClse('baseline.resetting', 'Resetting…')
                            : tClse('baseline.reset_confirm_action', 'Reset and start new epoch')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsResetConfirmationOpen(false)}
                        disabled={resetInFlight}
                        className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-on-surface)] disabled:opacity-60"
                    >
                        {t('dialogs.cancel')}
                    </button>
                </div>
            </div>
        );
    };

    if (!isActive) {
        return null;
    }

    if (loadPhase === 'loading') {
        return (
            <DashboardTabLoadingSurface
                tabId="experiment-clse"
                policyTabId="experiment"
                label={t('status.loading')}
                sectionClassName="bg-transparent"
            />
        );
    }

    if (loadPhase === 'error') {
        return (
            <DashboardTabErrorSurface
                tabId="experiment-clse"
                title={t('status.error')}
                detail={loadError?.message || tClse('load_failed', 'Failed to load CLSE status.')}
                actions={(
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => fetchData({ showLoading: true, treatFailureAsFatal: true })}
                                className="rounded bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                                {tClse('retry_load', 'Retry')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsResetConfirmationOpen(true)}
                                className="rounded border border-amber-900/35 px-3 py-1.5 text-xs font-semibold text-amber-950"
                            >
                                {tClse('baseline.reset_recovery_action', 'Reset personal baseline')}
                            </button>
                        </div>
                        {renderResetConfirmation()}
                        {actionErrorMessage ? (
                            <p role="alert" className="text-xs font-semibold text-red-800">{actionErrorMessage}</p>
                        ) : null}
                    </div>
                )}
                sectionClassName="bg-transparent"
            />
        );
    }

    // --- Sub-Components (Inline for simplicity) ---

    // 1. Status View
    const StatusView = () => (
        <div className="flex flex-col gap-6">
            {/* System Status Panel */}
            <Panel className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">{tClse('status_panel.title', 'System Status')}</h2>
                    <button
                        onClick={handleToggle}
                        disabled={!controlSnapshotLoaded}
                        className={`px-4 py-2 rounded font-medium transition-colors disabled:cursor-wait disabled:opacity-55 ${status?.isEnabled
                            ? 'bg-[var(--color-success)] text-white'
                            : 'bg-[var(--color-surface-elevated)] text-[var(--color-on-surface-muted)] border border-[var(--color-border)]'
                            }`}
                    >
                        {status?.isEnabled
                            ? tClse('status_panel.active', 'ACTIVE')
                            : tClse('status_panel.inactive', 'INACTIVE')}
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <div className="text-[var(--color-on-surface-muted)]">{tClse('status_panel.initialized', 'Initialized')}</div>
                        <div className="font-mono text-[var(--color-on-surface)]">
                            {status?.isInitialized
                                ? tClse('status_panel.yes', '✓ YES')
                                : tClse('status_panel.no', '✗ NO')}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--color-on-surface-muted)]">{tClse('status_panel.buckets_total', 'Buckets (Total)')}</div>
                        <div className="font-mono text-[var(--color-on-surface)]">
                            {status?.bucketCount || 0}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--color-on-surface-muted)]">{tClse('status_panel.tracked_sites', 'Tracked Sites')}</div>
                        <div className="font-mono text-[var(--color-on-surface)]">
                            {status?.loopStats?.trackedSites || 0}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--color-on-surface-muted)]">{tClse('status_panel.baseline_stable', 'Baseline Stable')}</div>
                        <div className="font-mono text-[var(--color-on-surface)]">
                            {status?.baseline?.status === PERSONAL_BASELINE_STATUSES.STABLE
                                ? tClse('status_panel.yes', '✓ YES')
                                : tClse('status_panel.no', '✗ NO')}
                        </div>
                    </div>
                </div>
            </Panel>

            {/* Alert State Panel */}
            <Panel className="p-5">
                <h2 className="text-lg font-semibold text-[var(--color-on-surface)] mb-3">{tClse('alert_panel.title', 'Current Alert State')}</h2>
                {status?.alert ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <div className="text-[var(--color-on-surface-muted)]">{tClse('alert_panel.type', 'Type')}</div>
                            <div className="font-mono text-[var(--color-warning)] font-bold">{status.alert.type}</div>
                        </div>
                        <div>
                            <div className="text-[var(--color-on-surface-muted)]">{tClse('alert_panel.severity', 'Severity')}</div>
                            <div className="font-mono text-[var(--color-on-surface)]">
                                {(Number(status.alert.severity || 0) * 100).toFixed(0)}%
                            </div>
                        </div>
                        <div>
                            <div className="text-[var(--color-on-surface-muted)]">{tClse('alert_panel.action', 'Action')}</div>
                            <div className="font-mono text-[var(--color-on-surface)]">
                                {status.alert.type === 'SUSTAINED_LOAD'
                                    ? tClse('alert_panel.block', 'BLOCK')
                                    : tClse('alert_panel.warn', 'WARN')}
                            </div>
                        </div>
                        <div>
                            <div className="text-[var(--color-on-surface-muted)]">{tClse('alert_panel.triggered', 'Triggered')}</div>
                            <div className="font-mono text-[var(--color-on-surface)]">
                                {new Date(status.alert.ts || Date.now()).toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-sm text-[var(--color-on-surface-muted)]">
                        <span className="w-2 h-2 rounded-full bg-[var(--color-success)]"></span>
                        <span>{tClse('alert_panel.normal', 'System Normal. No anomalies detected.')}</span>
                    </div>
                )}
            </Panel>

            {/* Sustained Load State */}
            {status?.sustainedLoadState && (
                <Panel className="p-5">
                    <h2 className="text-lg font-semibold text-[var(--color-on-surface)] mb-3">{tClse('sustained_panel.title', 'Sustained Load Monitor')}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <div className="text-[var(--color-on-surface-muted)]">{tClse('sustained_panel.in_load', 'In Load')}</div>
                            <div className={`font-mono ${status.sustainedLoadState.inSustainedLoad ? 'text-[var(--color-warning)]' : 'text-[var(--color-on-surface)]'}`}>
                                {status.sustainedLoadState.inSustainedLoad
                                    ? tClse('sustained_panel.yes_warning', 'YES ⚠️')
                                    : tClse('sustained_panel.no', 'NO')}
                            </div>
                        </div>
                        <div>
                            <div className="text-[var(--color-on-surface-muted)]">{tClse('sustained_panel.elevated_windows', 'Elevated Windows')}</div>
                            <div className="font-mono text-[var(--color-on-surface)]">
                                {status.sustainedLoadState.elevatedWindowCount || 0}
                            </div>
                        </div>
                        <div>
                            <div className="text-[var(--color-on-surface-muted)]">{tClse('sustained_panel.load_severity', 'Load Severity')}</div>
                            <div className="font-mono text-[var(--color-on-surface)]">
                                {((status.sustainedLoadState.currentSeverity || 0) * 100).toFixed(0)}%
                            </div>
                        </div>
                    </div>
                </Panel>
            )}
        </div>
    );

    // 2. Personal Baseline View
    const BaselineView = () => (
        <div className="flex flex-col gap-6">
            {/* Legend / Policy Info */}
            <Panel className="p-5 border-l-4 border-[var(--color-accent)]">
                <h2 className="text-lg font-semibold text-[var(--color-on-surface)] mb-2">{tClse('baseline.policy_title', 'Detection Policy')}</h2>
                <ul className="text-sm text-[var(--color-on-surface-muted)] list-disc pl-5 space-y-1">
                    <li>
                        <strong>{tClse('baseline.policy_spike_label', 'Spike (Short Term):')}</strong>
                        {' '}
                        {tClse('baseline.policy_spike_desc', 'High activity in <10s. Triggers')}
                        {' '}
                        <span className="text-[var(--color-warning)]">{tClse('baseline.policy_warning', 'WARNING')}</span>.
                    </li>
                    <li>
                        <strong>{tClse('baseline.policy_sustain_label', 'Sustain (Long Term):')}</strong>
                        {' '}
                        {tClse('baseline.policy_sustain_desc', 'Consistent high load over time. Triggers')}
                        {' '}
                        <span className="text-[var(--color-error)]">{tClse('baseline.policy_block', 'BLOCK')}</span>.
                    </li>
                    <li>
                        <strong>{tClse('baseline.policy_baseline_label', 'Baseline:')}</strong>
                        {' '}
                        {tClse('baseline.policy_baseline_desc', 'Learned online from completed 10-second and 60-second windows at the same time grain.')}
                    </li>
                </ul>
            </Panel>

            {/* Baseline Snapshot */}
            <Panel className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h2 className="text-lg font-semibold text-[var(--color-on-surface)]">{tClse('baseline.baseline_title', 'Baseline Snapshot')}</h2>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setIsResetConfirmationOpen(true)}
                            className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-on-surface)] hover:bg-[var(--color-surface-elevated)]"
                        >
                            {tClse('baseline.reset_baseline', 'Reset Baseline')}
                        </button>
                    </div>
                </div>

                {renderResetConfirmation()}

                {status?.baseline ? (
                    <div className="space-y-5 text-sm">
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div>
                                <div className="text-xs text-[var(--color-on-surface-muted)]">{tClse('baseline.baseline_state', 'State')}</div>
                                <div className="font-mono text-[var(--color-on-surface)]">{status.baseline.status}</div>
                            </div>
                            <div>
                                <div className="text-xs text-[var(--color-on-surface-muted)]">{tClse('baseline.baseline_confidence', 'Confidence')}</div>
                                <div className="font-mono text-[var(--color-on-surface)]">{(status.baseline.confidence.overall * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                                <div className="text-xs text-[var(--color-on-surface-muted)]">{tClse('baseline.policy_version', 'Policy')}</div>
                                <div className="break-all font-mono text-[var(--color-on-surface)]">{status.baseline.policyVersion}</div>
                            </div>
                            <div>
                                <div className="text-xs text-[var(--color-on-surface-muted)]">{tClse('baseline.last_updated', 'Last Updated:')}</div>
                                <div className="font-mono text-[var(--color-on-surface)]">{new Date(status.baseline.updatedAt).toLocaleString()}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            {status.baseline.profiles.map((profile) => (
                                <div key={profile.grain} className="rounded-lg border border-[var(--color-border)] p-4">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-[var(--color-on-surface)]">
                                                {profile.grain === PERSONAL_BASELINE_METRIC_GRAINS.BUCKET_10S
                                                    ? tClse('baseline.grain_10s', '10-second profile')
                                                    : tClse('baseline.grain_60s', '60-second profile')}
                                            </div>
                                            <div className="text-xs text-[var(--color-on-surface-muted)]">
                                                {tClse('baseline.evidence_summary', {
                                                    days: profile.evidence.observedDays,
                                                    samples: profile.evidence.eligibleObservations,
                                                    minutes: Math.round(profile.evidence.totalActiveMs / 60000),
                                                })}
                                            </div>
                                        </div>
                                        <div className="text-right font-mono text-xs text-[var(--color-on-surface-muted)]">
                                            <div>{profile.status}</div>
                                            <div>{(profile.confidence.overall * 100).toFixed(0)}%</div>
                                        </div>
                                    </div>
                                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-on-surface-muted)]">
                                        {tClse('baseline.feature_statistics', 'Feature Statistics (μ / σ)')}
                                    </div>
                                    <div className="space-y-1">
                                        {CLSE_BASELINE_FEATURE_ROWS.map(({ id, labelKey }) => {
                                            const feature = profile.featureStats[id];
                                            return (
                                                <div key={id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--color-border)]/50 py-1">
                                                    <span className="text-[var(--color-on-surface-muted)]">{tClse(`baseline.${labelKey}`)}</span>
                                                    <span className="font-mono text-[var(--color-on-surface)]">
                                                        {feature.mean.toFixed(3)} / {feature.sigma.toFixed(3)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-[var(--color-on-surface-muted)]">{tClse('baseline.baseline_empty', 'Baseline not initialized yet.')}</div>
                )}
            </Panel>

            {/* Configuration Panel */}
            <Panel className="p-5">
                <h2 className="text-lg font-semibold text-[var(--color-on-surface)] mb-4">{tClse('baseline.sensitivity_tuning', 'Sensitivity Tuning')}</h2>

                {/* Sensitivity */}
                <div className="mb-6">
                    <div className="flex justify-between text-xs text-[var(--color-on-surface-muted)] mb-2">
                        <span>{tClse('baseline.threshold_scale', 'Threshold Scale')}</span>
                        <span className="font-mono text-[var(--color-on-surface)]">{sensitivityScale.toFixed(2)}x</span>
                    </div>
                    <input
                        type="range"
                        min="0.7"
                        max="1.5"
                        step="0.05"
                        value={sensitivityScale}
                        onChange={(event) => {
                            controlDraftDirtyRef.current.sensitivity = true;
                            setSensitivityScale(Number(event.target.value));
                        }}
                        onPointerUp={(event) => commitSensitivityDraft(event.currentTarget.value)}
                        onBlur={(event) => commitSensitivityDraft(event.currentTarget.value)}
                        onKeyUp={(event) => {
                            if (shouldCommitRangeKey(event.key)) {
                                commitSensitivityDraft(event.currentTarget.value);
                            }
                        }}
                        disabled={!controlSnapshotLoaded}
                        className="w-full accent-[var(--color-accent)] disabled:cursor-wait disabled:opacity-55"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--color-on-surface-muted)] mt-1">
                        <span>{tClse('baseline.high_sensitivity', 'High Sensitivity (0.7x)')}</span>
                        <span>{tClse('baseline.low_sensitivity', 'Low Sensitivity (1.5x)')}</span>
                    </div>
                </div>

                {/* Alert Cooldown */}
                <div>
                    <div className="flex justify-between text-xs text-[var(--color-on-surface-muted)] mb-2">
                        <span>{tClse('baseline.alert_cooldown', 'Alert Cooldown')}</span>
                        <span className="font-mono text-[var(--color-on-surface)]">{Math.round(alertCooldownMs / 1000)}s</span>
                    </div>
                    <input
                        type="range"
                        min="30000"
                        max="600000"
                        step="15000"
                        value={alertCooldownMs}
                        onChange={(event) => {
                            controlDraftDirtyRef.current.cooldown = true;
                            setAlertCooldownMs(Number(event.target.value));
                        }}
                        onPointerUp={(event) => commitCooldownDraft(event.currentTarget.value)}
                        onBlur={(event) => commitCooldownDraft(event.currentTarget.value)}
                        onKeyUp={(event) => {
                            if (shouldCommitRangeKey(event.key)) {
                                commitCooldownDraft(event.currentTarget.value);
                            }
                        }}
                        disabled={!controlSnapshotLoaded}
                        className="w-full accent-[var(--color-accent)] disabled:cursor-wait disabled:opacity-55"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--color-on-surface-muted)] mt-1">
                        <span>{tClse('baseline.cooldown_min_label', '30s')}</span>
                        <span>{tClse('baseline.cooldown_max_label', '10m')}</span>
                    </div>
                </div>
            </Panel>
        </div>
    );

    // 3. Logs View
    const formatAggressionDetail = (log) => {
        if (!log || !log.metrics) return '-';
        const m = log.metrics;
        switch (log.type) {
            case 'scroll':
                return tClse('logs.aggression_scroll_detail', 'int {{intensity}} | jitter {{jitter}} | feed {{feed}}', {
                    intensity: Math.round(m.intensity || 0),
                    jitter: (m.dirChangeRate || 0).toFixed(2),
                    feed: m.feedItems || 0,
                });
            case 'nav':
                return tClse('logs.aggression_nav_detail', 'rate {{rate}} | back {{back}}', {
                    rate: (m.navRate || 0).toFixed(2),
                    back: (m.backForwardRatio || 0).toFixed(2),
                });
            case 'tab':
                return tClse('logs.aggression_tab_detail', 'rate {{rate}} | tabs {{tabs}}', {
                    rate: (m.switchRate || 0).toFixed(2),
                    tabs: m.openTabs || 0,
                });
            case 'media':
                return tClse('logs.aggression_media_detail', 'seek {{seek}} | skim {{skim}}', {
                    seek: (m.seekRate || 0).toFixed(2),
                    skim: (m.skimRatio || 0).toFixed(2),
                });
            default:
                return '-';
        }
    };

    const formatAggressionBaseline = (log) => (
        `${log.reference_mode} / ${log.baseline_status} / ${log.baseline_grain}`
    );

    const LogsView = () => (
        <div className="flex flex-col gap-6">
            {diagnosticsError ? (
                <div
                    role="alert"
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3 text-xs text-[var(--color-warning)]"
                >
                    <span>{tClse('refresh_failed', { message: getCLSEErrorMessage(diagnosticsError) })}</span>
                    <button
                        type="button"
                        onClick={() => fetchDiagnostics()}
                        className="rounded border border-current/35 px-2 py-1 font-semibold"
                    >
                        {tClse('retry_load', 'Retry')}
                    </button>
                </div>
            ) : null}
            {/* Recent 60s Buckets */}
            <Panel className="p-5">
                <h2 className="text-lg font-semibold text-[var(--color-on-surface)] mb-3">
                    {tClse('logs.recent_history', 'Recent History (60s)')}
                    <span className="text-xs text-[var(--color-on-surface-muted)] ml-2">
                        {tClse('logs.last_buckets', '(Last {{count}} buckets)', { count: buckets60s.length })}
                    </span>
                </h2>

                {diagnosticsPhase === 'loading' ? (
                    <div role="status" className="text-sm text-[var(--color-on-surface-muted)]">{t('status.loading')}</div>
                ) : buckets60s.length === 0 ? (
                    <div className="text-sm text-[var(--color-on-surface-muted)]">{tClse('logs.no_data', 'No data yet. Enable CLSE and browse to collect data.')}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono whitespace-nowrap">
                            <thead>
                                <tr className="text-left text-[var(--color-on-surface-muted)] border-b border-[var(--color-border)]">
                                    <th className="pb-2 pr-4">{tClse('logs.time', 'Time')}</th>
                                    <th className="pb-2 pr-4">{tClse('logs.tab_sw', 'Tab SW')}</th>
                                    <th className="pb-2 pr-4">{tClse('logs.nav', 'Nav')}</th>
                                    <th className="pb-2 pr-4">{tClse('logs.scroll_delta', 'Scroll Δ')}</th>
                                    <th className="pb-2 pr-4">{tClse('logs.media_seek', 'Media Seek')}</th>
                                    <th className="pb-2">{tClse('logs.active', 'Active')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {buckets60s.slice().reverse().map((b, i) => (
                                    <tr key={b.ts_start || i} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]">
                                        <td className="py-2 pr-4 text-[var(--color-on-surface-muted)]">
                                            {new Date(b.ts_start).toLocaleTimeString()}
                                        </td>
                                        <td className="py-2 pr-4 text-[var(--color-on-surface)]">{b.tab_switch_count || 0}</td>
                                        <td className="py-2 pr-4 text-[var(--color-on-surface)]">{b.nav_count || 0}</td>
                                        <td className="py-2 pr-4 text-[var(--color-on-surface)]">{Math.round(b.scroll_abs_delta_sum || 0)}</td>
                                        <td className="py-2 pr-4 text-[var(--color-on-surface)]">{b.media_seek_count || 0}</td>
                                        <td className="py-2 text-[var(--color-on-surface)]">{Math.round((b.active_ms || 0) / 1000)}s</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>

            {/* Aggression Diagnostics */}
            <Panel className="p-5">
                <h2 className="text-lg font-semibold text-[var(--color-on-surface)] mb-3">
                    {tClse('logs.aggression_title', 'Aggression Diagnostics')}
                    <span className="text-xs text-[var(--color-on-surface-muted)] ml-2">
                        {tClse('logs.last_count', '(Last {{count}})', { count: aggressionLogs.length })}
                    </span>
                </h2>
                {diagnosticsPhase === 'loading' ? (
                    <div role="status" className="text-sm text-[var(--color-on-surface-muted)]">{t('status.loading')}</div>
                ) : aggressionLogs.length === 0 ? (
                    <div className="text-sm text-[var(--color-on-surface-muted)]">{tClse('logs.no_aggression', 'No aggression logs yet.')}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono whitespace-nowrap">
                            <thead>
                                <tr className="text-left text-[var(--color-on-surface-muted)] border-b border-[var(--color-border)]">
                                    <th className="pb-2 pr-4">{tClse('logs.time', 'Time')}</th>
                                    <th className="pb-2 pr-4">{tClse('logs.type', 'Type')}</th>
                                    <th className="pb-2 pr-4">{tClse('logs.score', 'Score')}</th>
                                    <th className="pb-2 pr-4">{tClse('logs.aggressive', 'Aggressive')}</th>
                                    <th className="pb-2 pr-4">{tClse('logs.meaningless', 'Meaningless')}</th>
                                    <th className="pb-2">{tClse('logs.details', 'Details')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aggressionLogs.slice().reverse().slice(0, 20).map((log, i) => (
                                    <tr key={`${log.ts || i}-${log.type || 'aggr'}`} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]">
                                        <td className="py-2 pr-4 text-[var(--color-on-surface-muted)]">
                                            {new Date(log.ts || Date.now()).toLocaleTimeString()}
                                        </td>
                                        <td className="py-2 pr-4 text-[var(--color-on-surface)]">{log.type || '-'}</td>
                                        <td className="py-2 pr-4 text-[var(--color-on-surface)]">{Math.round((log.score || 0) * 100)}%</td>
                                        <td className="py-2 pr-4 text-[var(--color-on-surface)]">{Math.round((log.aggressive_score || 0) * 100)}%</td>
                                        <td className="py-2 pr-4 text-[var(--color-on-surface)]">{Math.round((log.meaningless_score || 0) * 100)}%</td>
                                        <td className="py-2 text-[var(--color-on-surface)]">
                                            <div>{formatAggressionDetail(log)}</div>
                                            <div className="text-[10px] text-[var(--color-on-surface-muted)]">
                                                {formatAggressionBaseline(log)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>

            {/* Recent Events */}
            <Panel className="p-5">
                <h2 className="text-lg font-semibold text-[var(--color-on-surface)] mb-3">
                    {tClse('logs.event_log', 'Event Log')}
                    <span className="text-xs text-[var(--color-on-surface-muted)] ml-2">
                        {tClse('logs.last_count', '(Last {{count}})', { count: events.length })}
                    </span>
                </h2>
                {diagnosticsPhase === 'loading' ? (
                    <div role="status" className="text-sm text-[var(--color-on-surface-muted)]">{t('status.loading')}</div>
                ) : events.length === 0 ? (
                    <div className="text-sm text-[var(--color-on-surface-muted)]">{tClse('logs.no_events', 'No events recorded.')}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono whitespace-nowrap">
                            <thead>
                                <tr className="text-left text-[var(--color-on-surface-muted)] border-b border-[var(--color-border)]">
                                    <th className="pb-2 pr-4">{tClse('logs.time', 'Time')}</th>
                                    <th className="pb-2 pr-4">{tClse('logs.type', 'Type')}</th>
                                    <th className="pb-2 pr-4">{tClse('logs.severity', 'Severity')}</th>
                                    <th className="pb-2">{tClse('logs.details', 'Details')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.slice(0, 10).map((evt, i) => (
                                    <tr key={`${evt.ts || i}-${evt.type || 'evt'}`} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-elevated)]">
                                        <td className="py-2 pr-4 text-[var(--color-on-surface-muted)]">
                                            {new Date(evt.ts || Date.now()).toLocaleTimeString()}
                                        </td>
                                        <td className="py-2 pr-4 text-[var(--color-on-surface)]">{evt.type || tClse('logs.event', 'EVENT')}</td>
                                        <td className="py-2 pr-4 text-[var(--color-on-surface)]">
                                            {evt?.data?.severity !== undefined
                                                ? `${Math.round(Number(evt.data.severity || 0) * 100)}%`
                                                : '-'}
                                        </td>
                                        <td className="py-2 text-[var(--color-on-surface)]">
                                            {evt?.data?.value !== undefined
                                                ? String(evt.data.value)
                                                : evt?.data?.repeat_count !== undefined
                                                    ? `repeat ${evt.data.repeat_count}`
                                                    : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>

            <Panel className="p-5">
                <h2 className="text-lg font-semibold text-[var(--color-on-surface)] mb-3">{tClse('logs.debug_info', 'Debug Info')}</h2>
                <div className="text-xs font-mono text-[var(--color-on-surface-muted)] whitespace-pre-wrap">
                    {tClse('logs.debug_refresh', 'Refresh #{{count}} | Last update: {{time}}', {
                        count: refreshCount,
                        time: new Date().toLocaleTimeString(),
                    })}
                </div>
            </Panel>
        </div>
    );

    return (
        <section data-testid="experiment-clse-lab" className="flex h-full min-h-0 flex-col overflow-hidden text-[var(--color-on-surface)] bg-transparent">
            {/* --- Sticky Header & Tabs --- */}
            <div className="z-10 flex-none px-1 pb-0 pt-2 bg-transparent">
                {actionErrorMessage && (
                    <div className="mb-3 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-xs text-[var(--color-danger)]">
                        {actionErrorMessage}
                    </div>
                )}
                {!controlSnapshotLoaded && (
                    <div
                        role={controlSnapshotError ? 'alert' : 'status'}
                        className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3 text-xs text-[var(--color-warning)]"
                    >
                        <span>
                            {controlSnapshotError
                                ? getCLSEErrorMessage(controlSnapshotError, 'CLSE_CONTROL_SNAPSHOT_LOAD_FAILED')
                                : t('status.loading')}
                        </span>
                        {controlSnapshotError ? (
                            <button
                                type="button"
                                onClick={handleControlSnapshotRetry}
                                className="rounded border border-current/35 px-2 py-1 font-semibold"
                            >
                                {tClse('retry_load', 'Retry')}
                            </button>
                        ) : null}
                    </div>
                )}
                {loadError && loadPhase !== 'error' && (
                    <div className="mb-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3 text-xs text-[var(--color-warning)]">
                        {tClse('refresh_failed', {
                            message: getCLSEErrorMessage(loadError),
                        })}
                    </div>
                )}
                {settingsSyncNotice && (
                    <SettingsSyncBanner className="mb-3" notice={settingsSyncNotice} />
                )}

                <div className="flex border-b border-[var(--color-border)]">
                    <button
                        onClick={() => setActiveSubTab('status')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus:outline-hidden ${subTab === 'status'
                            ? 'border-[var(--color-accent)] text-[var(--color-on-surface)]'
                            : 'border-transparent text-[var(--color-on-surface-muted)] hover:text-[var(--color-on-surface)]'
                            }`}
                    >
                        {tClse('tabs.status', 'Status')}
                    </button>
                    <button
                        onClick={() => setActiveSubTab('baseline')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus:outline-hidden ${subTab === 'baseline'
                            ? 'border-[var(--color-accent)] text-[var(--color-on-surface)]'
                            : 'border-transparent text-[var(--color-on-surface-muted)] hover:text-[var(--color-on-surface)]'
                            }`}
                    >
                        {tClse('tabs.baseline', 'Personal Baseline')}
                    </button>
                    <button
                        onClick={() => setActiveSubTab('logs')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus:outline-hidden ${subTab === 'logs'
                            ? 'border-[var(--color-accent)] text-[var(--color-on-surface)]'
                            : 'border-transparent text-[var(--color-on-surface-muted)] hover:text-[var(--color-on-surface)]'
                            }`}
                    >
                        {tClse('tabs.logs', 'Logs')}
                    </button>
                </div>
            </div>

            {/* --- Scrollable Content --- */}
            <div className="flex-1 overflow-y-auto min-h-0 px-1 pb-1 pt-4">
                {subTab === 'status' && StatusView()}
                {subTab === 'baseline' && BaselineView()}
                {subTab === 'logs' && LogsView()}
            </div>
        </section>
    );
}
