import React, { useCallback, useEffect, useState } from 'react';
import { Clipboard, Play, Power, RefreshCw, Trash2 } from 'lucide-react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
    clearZenTraceHistory,
    copyZenTraceHistory,
    getZenTraceHistory,
    isZenTraceEnabled,
    setZenTraceEnabled,
    startZenTraceReload,
} from '@zen-trace';
import { runZenBonsaiRenderDebugSequence } from '@/themes/plugins/zen/runtime/debug/zenBonsaiRenderDebugSequence.js';

const STATUS_COPY_KEYS = Object.freeze({
    pass: 'experiment.render_debug.status.pass',
    fail: 'experiment.render_debug.status.fail',
    not_run: 'experiment.render_debug.status.not_run',
});

const STATUS_CLASS_NAMES = Object.freeze({
    pass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
    fail: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200',
    not_run: 'border-on-surface/15 bg-surface-sunken/70 text-on-surface-muted',
});

const SUMMARY_METRICS = Object.freeze([
    Object.freeze({
        id: 'sceneUpdates',
        labelKey: 'experiment.render_debug.summary.scene_updates',
    }),
    Object.freeze({
        id: 'backLayerRebakes',
        labelKey: 'experiment.render_debug.summary.back_layer',
    }),
    Object.freeze({
        id: 'frontLayerRebakes',
        labelKey: 'experiment.render_debug.summary.front_layer',
    }),
    Object.freeze({
        id: 'branchRigRebuilds',
        labelKey: 'experiment.render_debug.summary.branch_rig',
    }),
]);

const STEP_COPY_KEYS = Object.freeze({
    baseline: 'experiment.render_debug.steps.baseline',
    wind_motion: 'experiment.render_debug.steps.wind_motion',
    gust_motion: 'experiment.render_debug.steps.gust_motion',
    bloom_band: 'experiment.render_debug.steps.bloom_band',
    health_band: 'experiment.render_debug.steps.health_band',
    light_band: 'experiment.render_debug.steps.light_band',
    canvas_resize: 'experiment.render_debug.steps.canvas_resize',
    seed_change: 'experiment.render_debug.steps.seed_change',
    version_bump: 'experiment.render_debug.steps.version_bump',
    resume_rehydrate: 'experiment.render_debug.steps.resume_rehydrate',
});

const REASON_COPY_KEYS = Object.freeze({
    initial: 'experiment.render_debug.reasons.initial',
    wind_runtime: 'experiment.render_debug.reasons.wind_runtime',
    bloom_backdrop: 'experiment.render_debug.reasons.bloom_backdrop',
    health_full: 'experiment.render_debug.reasons.health_full',
    light_bake: 'experiment.render_debug.reasons.light_bake',
    canvas_static: 'experiment.render_debug.reasons.canvas_static',
    seed_cache: 'experiment.render_debug.reasons.seed_cache',
    version_cache: 'experiment.render_debug.reasons.version_cache',
    resume_rig: 'experiment.render_debug.reasons.resume_rig',
});

const OBSERVATION_COPY_KEYS = Object.freeze({
    sceneChanged: 'experiment.render_debug.observations.scene_changed',
    sceneSteady: 'experiment.render_debug.observations.scene_steady',
    rebake: 'experiment.render_debug.observations.rebake',
    reuse: 'experiment.render_debug.observations.reuse',
    rebuild: 'experiment.render_debug.observations.rebuild',
});

const getStatusId = (result) => {
    if (!result) return 'not_run';
    return result.summary.passed ? 'pass' : 'fail';
};

const getObservationClassName = (active) => (
    active
        ? 'text-amber-700 dark:text-amber-200'
        : 'text-on-surface-muted'
);

const formatObserved = (t, active, activeKey, inactiveKey) => t(active ? activeKey : inactiveKey);

export default function ZenBonsaiRenderDebugLab({ isActive = false }) {
    const { t } = useAppTranslation('tools');
    const [result, setResult] = useState(null);
    const [renderTraceEnabled, setRenderTraceEnabled] = useState(() => isZenTraceEnabled());
    const [renderTraceEventCount, setRenderTraceEventCount] = useState(() => getZenTraceHistory().length);
    const [renderTraceFeedback, setRenderTraceFeedback] = useState('');
    const statusId = getStatusId(result);

    const handleRunSequence = useCallback(() => {
        setResult(runZenBonsaiRenderDebugSequence());
    }, []);
    const refreshRenderTraceState = useCallback(() => {
        setRenderTraceEnabled(isZenTraceEnabled());
        setRenderTraceEventCount(getZenTraceHistory().length);
    }, []);
    const handleRenderTraceReload = useCallback(() => {
        startZenTraceReload({ source: 'experiment_render_debug_reload' });
    }, []);
    const handleRenderTraceDisable = useCallback(() => {
        setZenTraceEnabled(false);
        refreshRenderTraceState();
        setRenderTraceFeedback(t('experiment.render_trace.disabled_feedback'));
    }, [refreshRenderTraceState, t]);
    const handleRenderTraceClear = useCallback(() => {
        clearZenTraceHistory();
        refreshRenderTraceState();
        setRenderTraceFeedback(t('experiment.render_trace.clear_feedback'));
    }, [refreshRenderTraceState, t]);
    const handleRenderTraceCopy = useCallback(() => {
        const history = getZenTraceHistory();
        if (!history.length) {
            setRenderTraceFeedback(t('experiment.render_trace.copy_empty'));
            return;
        }
        copyZenTraceHistory()
            .then(() => {
                refreshRenderTraceState();
                setRenderTraceFeedback(t('experiment.render_trace.copy_done'));
            })
            .catch(() => {
                setRenderTraceFeedback(t('experiment.render_trace.copy_failed'));
            });
    }, [refreshRenderTraceState, t]);

    useEffect(() => {
        refreshRenderTraceState();
        if (!isActive) return undefined;
        if (typeof window === 'undefined' || typeof window.setInterval !== 'function') return undefined;
        const timerId = window.setInterval(refreshRenderTraceState, 1000);
        return () => {
            window.clearInterval(timerId);
        };
    }, [isActive, refreshRenderTraceState]);

    return (
        <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
            <div className="rounded-lg border border-on-surface/10 bg-surface/80 px-3 py-2 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase text-on-surface-muted">
                            {t('experiment.render_trace.eyebrow')}
                        </p>
                        <p className="text-xs font-semibold text-on-surface">
                            {t('experiment.render_trace.title')}
                        </p>
                        <p className="mt-0.5 text-[11px] text-on-surface-muted">
                            {t('experiment.render_trace.desc')}
                        </p>
                    </div>
                    <span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-semibold ${renderTraceEnabled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-surface-sunken text-on-surface-muted'
                        }`}>
                        {renderTraceEnabled
                            ? t('experiment.render_trace.status_enabled', { count: renderTraceEventCount })
                            : t('experiment.render_trace.status_disabled', { count: renderTraceEventCount })}
                    </span>
                    <button
                        type="button"
                        onClick={handleRenderTraceReload}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[10px] font-semibold text-on-accent transition-colors hover:opacity-90"
                    >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('experiment.render_trace.reload')}
                    </button>
                    <button
                        type="button"
                        onClick={handleRenderTraceCopy}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface"
                    >
                        <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('experiment.render_trace.copy')}
                    </button>
                    <button
                        type="button"
                        onClick={handleRenderTraceDisable}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface"
                    >
                        <Power className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('experiment.render_trace.disable')}
                    </button>
                    <button
                        type="button"
                        onClick={handleRenderTraceClear}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface"
                    >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('experiment.render_trace.clear')}
                    </button>
                </div>
                {renderTraceFeedback ? (
                    <p className="mt-2 text-[10px] text-on-surface-muted">
                        {renderTraceFeedback}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-3 rounded-lg border border-on-surface/10 bg-surface/80 p-3 shadow-sm lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleRunSequence}
                        className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-3 text-xs font-semibold text-on-accent shadow-sm transition-transform hover:-translate-y-0.5 focus:outline-hidden focus:ring-2 focus:ring-accent/40"
                        aria-label={t('experiment.render_debug.actions.run')}
                        title={t('experiment.render_debug.actions.run')}
                    >
                        {result ? (
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                            <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{t('experiment.render_debug.actions.run')}</span>
                    </button>
                    <span
                        className={`inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-semibold ${STATUS_CLASS_NAMES[statusId]}`}
                        data-active={isActive ? 'true' : 'false'}
                    >
                        {t(STATUS_COPY_KEYS[statusId])}
                    </span>
                </div>

                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                    {SUMMARY_METRICS.map((metric) => (
                        <div
                            key={metric.id}
                            className="min-w-0 rounded-lg border border-on-surface/10 bg-surface-sunken/50 px-3 py-2"
                        >
                            <div className="truncate text-[10px] font-semibold uppercase text-on-surface-muted">
                                {t(metric.labelKey)}
                            </div>
                            <div className="mt-1 text-lg font-bold tabular-nums text-on-surface">
                                {result?.summary?.[metric.id] ?? 0}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="min-h-0 overflow-hidden rounded-lg border border-on-surface/10 bg-surface/80 shadow-sm">
                {result ? (
                    <div className="h-full min-h-0 overflow-auto">
                        <table className="min-w-full border-separate border-spacing-0 text-left text-[11px]">
                            <thead className="sticky top-0 z-10 bg-surface text-on-surface-muted">
                                <tr>
                                    <th scope="col" className="border-b border-on-surface/10 px-3 py-2 font-semibold">
                                        {t('experiment.render_debug.columns.step')}
                                    </th>
                                    <th scope="col" className="border-b border-on-surface/10 px-3 py-2 font-semibold">
                                        {t('experiment.render_debug.columns.scene')}
                                    </th>
                                    <th scope="col" className="border-b border-on-surface/10 px-3 py-2 font-semibold">
                                        {t('experiment.render_debug.columns.back')}
                                    </th>
                                    <th scope="col" className="border-b border-on-surface/10 px-3 py-2 font-semibold">
                                        {t('experiment.render_debug.columns.front')}
                                    </th>
                                    <th scope="col" className="border-b border-on-surface/10 px-3 py-2 font-semibold">
                                        {t('experiment.render_debug.columns.branch')}
                                    </th>
                                    <th scope="col" className="border-b border-on-surface/10 px-3 py-2 font-semibold">
                                        {t('experiment.render_debug.columns.reason')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.steps.map((step) => (
                                    <tr
                                        key={step.id}
                                        className={step.passed ? 'text-on-surface' : 'bg-rose-500/10 text-rose-600'}
                                    >
                                        <td className="border-b border-on-surface/5 px-3 py-2 font-semibold">
                                            {t(STEP_COPY_KEYS[step.id])}
                                        </td>
                                        <td className={`border-b border-on-surface/5 px-3 py-2 font-medium ${getObservationClassName(step.observed.sceneChanged)}`}>
                                            {formatObserved(
                                                t,
                                                step.observed.sceneChanged,
                                                OBSERVATION_COPY_KEYS.sceneChanged,
                                                OBSERVATION_COPY_KEYS.sceneSteady,
                                            )}
                                        </td>
                                        <td className={`border-b border-on-surface/5 px-3 py-2 font-medium ${getObservationClassName(step.observed.backRebake)}`}>
                                            {formatObserved(
                                                t,
                                                step.observed.backRebake,
                                                OBSERVATION_COPY_KEYS.rebake,
                                                OBSERVATION_COPY_KEYS.reuse,
                                            )}
                                        </td>
                                        <td className={`border-b border-on-surface/5 px-3 py-2 font-medium ${getObservationClassName(step.observed.frontRebake)}`}>
                                            {formatObserved(
                                                t,
                                                step.observed.frontRebake,
                                                OBSERVATION_COPY_KEYS.rebake,
                                                OBSERVATION_COPY_KEYS.reuse,
                                            )}
                                        </td>
                                        <td className={`border-b border-on-surface/5 px-3 py-2 font-medium ${getObservationClassName(step.observed.branchRigRebuild)}`}>
                                            {formatObserved(
                                                t,
                                                step.observed.branchRigRebuild,
                                                OBSERVATION_COPY_KEYS.rebuild,
                                                OBSERVATION_COPY_KEYS.reuse,
                                            )}
                                        </td>
                                        <td className="border-b border-on-surface/5 px-3 py-2 text-on-surface-muted">
                                            {t(REASON_COPY_KEYS[step.reasonId])}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex h-full min-h-[220px] items-center justify-center p-4 text-center text-xs font-medium text-on-surface-muted">
                        {t('experiment.render_debug.empty')}
                    </div>
                )}
            </div>
        </div>
    );
}
