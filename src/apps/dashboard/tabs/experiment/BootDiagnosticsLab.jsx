import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Clipboard,
  Clock3,
  FileJson,
  RefreshCw,
  Snowflake,
  Trash2,
} from 'lucide-react';

import { getBootSnapshot } from '@/apps/dashboard/bootstrap/bootManager.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  clearBootTelemetryReportHistory,
  getBootTelemetryReportHistory,
  getBootTelemetrySnapshot,
} from '@dashboard-boot-telemetry';
import {
  clearZenTraceHistory,
  getZenTraceHistory,
  isZenTraceEnabled,
  startZenTraceReload,
} from '@zen-trace';

import {
  BOOT_DIAGNOSTICS_SECTION_IDS,
  buildDashboardBootDiagnosticsReport,
  serializeBootDiagnosticsSection,
} from './bootDiagnosticsReport.js';

const TRACE_TTL_MS = 10 * 60 * 1000;
const BOOT_TRACE_RELOAD_SOURCE = 'experiment_boot_lab_reload';
const COLD_VISUAL_RELOAD_SOURCE = 'experiment_boot_lab_cold_visual_reload';

const STATUS_CLASS_NAMES = Object.freeze({
  ready: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  degraded: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  failed: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200',
  booting: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200',
  idle: 'border-on-surface/15 bg-surface-sunken/70 text-on-surface-muted',
});

const COPY_ACTIONS = Object.freeze([
  { id: BOOT_DIAGNOSTICS_SECTION_IDS.SUMMARY, labelKey: 'experiment.boot_lab.copy_summary', icon: Clipboard },
  { id: BOOT_DIAGNOSTICS_SECTION_IDS.TIMING, labelKey: 'experiment.boot_lab.copy_timing', icon: Clock3 },
  { id: BOOT_DIAGNOSTICS_SECTION_IDS.MAIN_FRAME, labelKey: 'experiment.boot_lab.copy_main_frame', icon: Clock3 },
  { id: BOOT_DIAGNOSTICS_SECTION_IDS.ERRORS, labelKey: 'experiment.boot_lab.copy_errors', icon: AlertTriangle },
  { id: BOOT_DIAGNOSTICS_SECTION_IDS.STATE, labelKey: 'experiment.boot_lab.copy_state', icon: Activity },
  { id: BOOT_DIAGNOSTICS_SECTION_IDS.TRACE, labelKey: 'experiment.boot_lab.copy_trace', icon: FileJson },
  { id: BOOT_DIAGNOSTICS_SECTION_IDS.FULL, labelKey: 'experiment.boot_lab.copy_full', icon: FileJson },
]);

const copyTextToClipboard = async (text) => {
  const payload = typeof text === 'string' ? text : '';
  if (!payload) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(payload);
      return true;
    } catch (_error) {
      // Continue to document fallback.
    }
  }
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return false;
  }
  const textarea = document.createElement('textarea');
  textarea.value = payload;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
  return copied;
};

const formatMs = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(2)}s`;
  return `${numeric.toFixed(numeric >= 100 ? 0 : 1)}ms`;
};

const formatValue = (value) => {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (value === null || value === undefined || value === '') return '--';
  return String(value);
};

function BootMetric({ label, value, tone = 'default' }) {
  const toneClassName = tone === 'warning'
    ? 'border-amber-500/25 bg-amber-500/10'
    : tone === 'error'
      ? 'border-rose-500/25 bg-rose-500/10'
      : 'border-on-surface/10 bg-surface-sunken/45';
  return (
    <div className={`min-w-0 rounded-lg border px-3 py-2 ${toneClassName}`}>
      <div className="truncate text-[10px] font-semibold uppercase text-on-surface-muted">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-bold tabular-nums text-on-surface">
        {value}
      </div>
    </div>
  );
}

function BootDiagnosticsLab({ isActive = false }) {
  const { t } = useAppTranslation('tools');
  const [report, setReport] = useState(null);
  const [traceEnabled, setTraceEnabledState] = useState(() => isZenTraceEnabled());
  const [feedback, setFeedback] = useState('');

  const refreshReport = useCallback(() => {
    const nextReport = buildDashboardBootDiagnosticsReport({
      bootSnapshot: getBootSnapshot(),
      bootTelemetrySnapshot: getBootTelemetrySnapshot(),
      bootTelemetryReports: getBootTelemetryReportHistory(),
      zenTraceHistory: getZenTraceHistory(),
    });
    setReport(nextReport);
    setTraceEnabledState(isZenTraceEnabled());
    return nextReport;
  }, []);

  useEffect(() => {
    refreshReport();
    if (!isActive || typeof window === 'undefined' || typeof window.setInterval !== 'function') {
      return undefined;
    }
    const timerId = window.setInterval(refreshReport, 1200);
    return () => {
      window.clearInterval(timerId);
    };
  }, [isActive, refreshReport]);

  const copySection = useCallback(async (sectionId) => {
    const currentReport = refreshReport();
    const text = serializeBootDiagnosticsSection(currentReport, sectionId);
    const copied = await copyTextToClipboard(text);
    setFeedback(copied
      ? t('experiment.boot_lab.copy_done')
      : t('experiment.boot_lab.copy_failed'));
  }, [refreshReport, t]);

  const handleTraceReload = useCallback(() => {
    clearBootTelemetryReportHistory();
    startZenTraceReload({
      source: BOOT_TRACE_RELOAD_SOURCE,
      ttlMs: TRACE_TTL_MS,
      oneShot: true,
    });
  }, []);

  const handleColdVisualReload = useCallback(() => {
    clearBootTelemetryReportHistory();
    startZenTraceReload({
      source: COLD_VISUAL_RELOAD_SOURCE,
      ttlMs: TRACE_TTL_MS,
      oneShot: true,
    });
  }, []);

  const handleClear = useCallback(() => {
    clearZenTraceHistory();
    clearBootTelemetryReportHistory();
    refreshReport();
    setFeedback(t('experiment.boot_lab.clear_done'));
  }, [refreshReport, t]);

  const statusClassName = useMemo(() => {
    const phase = String(report?.summary?.phase || report?.summary?.status || 'idle');
    if (phase === 'degraded' || report?.summary?.degraded === true) return STATUS_CLASS_NAMES.degraded;
    return STATUS_CLASS_NAMES[phase] || STATUS_CLASS_NAMES.idle;
  }, [report]);

  const tasks = Array.isArray(report?.timing?.tasks) ? report.timing.tasks : [];
  const phases = Array.isArray(report?.timing?.phases) ? report.timing.phases : [];
  const traceEvents = Array.isArray(report?.trace?.recent) ? report.trace.recent : [];
  const bootErrors = Array.isArray(report?.errors?.bootErrors) ? report.errors.bootErrors : [];
  const taskErrors = Array.isArray(report?.errors?.taskErrors) ? report.errors.taskErrors : [];
  const traceErrors = Array.isArray(report?.errors?.traceErrors) ? report.errors.traceErrors : [];
  const stackSamples = Array.isArray(report?.errors?.stackSamples) ? report.errors.stackSamples : [];
  const risks = Array.isArray(report?.risks) ? report.risks : [];
  const mainFrameSegment = report?.segments?.mainFrame || null;
  const mainFrameWaitMs = mainFrameSegment?.waitWindow?.durationMs ?? report?.summary?.mainFrameWaitMs;
  const mainFrameSlowMs = Number(mainFrameSegment?.thresholds?.slowMs) || 3200;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="rounded-lg border border-on-surface/10 bg-surface/85 p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-on-surface-muted">
              {t('experiment.boot_lab.eyebrow')}
            </p>
            <p className="text-sm font-bold text-on-surface">
              {t('experiment.boot_lab.title')}
            </p>
            <p className="mt-1 max-w-3xl text-[11px] leading-snug text-on-surface-muted">
              {t('experiment.boot_lab.desc')}
            </p>
          </div>
          <span className={`ml-auto rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClassName}`}>
            {formatValue(report?.summary?.phase || report?.summary?.status)}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${traceEnabled
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
            : 'bg-surface-sunken text-on-surface-muted'
          }`}>
            {traceEnabled
              ? t('experiment.boot_lab.trace_on', { count: report?.summary?.traceEventCount || 0 })
              : t('experiment.boot_lab.trace_off', { count: report?.summary?.traceEventCount || 0 })}
          </span>
          <button
            type="button"
            onClick={handleTraceReload}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[10px] font-semibold text-on-accent transition-colors hover:opacity-90"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {t('experiment.boot_lab.trace_reload')}
          </button>
          <button
            type="button"
            onClick={handleColdVisualReload}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sky-600 px-3 text-[10px] font-semibold text-white transition-colors hover:bg-sky-500"
          >
            <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
            {t('experiment.boot_lab.cold_visual_reload')}
          </button>
          <button
            type="button"
            onClick={refreshReport}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {t('experiment.boot_lab.refresh')}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t('experiment.boot_lab.clear')}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {COPY_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => copySection(action.id)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[10px] font-semibold text-on-surface-muted transition-colors hover:text-on-surface"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {t(action.labelKey)}
              </button>
            );
          })}
        </div>
        {feedback ? (
          <p className="mt-2 rounded-lg border border-on-surface/10 bg-surface-sunken/45 px-3 py-2 text-[10px] font-semibold text-on-surface-muted">
            {feedback}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 overflow-auto px-1 pb-1">
        <div className="grid min-w-0 gap-3 xl:grid-cols-2">
          <section className="rounded-lg border border-on-surface/10 bg-surface/85 p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-on-surface-muted" aria-hidden="true" />
              <h4 className="text-xs font-bold text-on-surface">{t('experiment.boot_lab.state_title')}</h4>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <BootMetric label={t('experiment.boot_lab.metric_status')} value={formatValue(report?.summary?.status)} />
              <BootMetric label={t('experiment.boot_lab.metric_phase')} value={formatValue(report?.summary?.phase)} tone={report?.summary?.degraded ? 'warning' : 'default'} />
              <BootMetric label={t('experiment.boot_lab.metric_theme')} value={formatValue(report?.summary?.themeReady)} />
              <BootMetric label={t('experiment.boot_lab.metric_core')} value={formatValue(report?.summary?.coreReady)} />
              <BootMetric label={t('experiment.boot_lab.metric_main_frame')} value={formatValue(report?.summary?.mainTabFirstFrameReady)} tone={report?.summary?.mainTabFirstFrameDegraded ? 'warning' : 'default'} />
              <BootMetric label={t('experiment.boot_lab.metric_mode')} value={formatValue(report?.summary?.diagnosticMode)} />
              <BootMetric label={t('experiment.boot_lab.metric_reports')} value={formatValue(report?.summary?.storedReportCount)} />
            </div>
            {risks.length ? (
              <div className="mt-3 space-y-1">
                {risks.map((risk) => (
                  <div
                    key={risk.id}
                    className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-on-surface"
                  >
                    <span className="font-semibold">{risk.id}</span>
                    <span className="ml-2 text-on-surface-muted">{formatValue(risk.signal)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-on-surface/10 bg-surface/85 p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-on-surface-muted" aria-hidden="true" />
              <h4 className="text-xs font-bold text-on-surface">{t('experiment.boot_lab.timing_title')}</h4>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <BootMetric label={t('experiment.boot_lab.metric_total')} value={formatMs(report?.summary?.totalDurationMs)} />
              <BootMetric label={t('experiment.boot_lab.metric_loader')} value={formatMs(report?.summary?.loaderVisibleForMs)} />
              <BootMetric label={t('experiment.boot_lab.metric_main_wait')} value={formatMs(mainFrameWaitMs)} tone={Number(mainFrameWaitMs) > mainFrameSlowMs ? 'warning' : 'default'} />
              <BootMetric label={t('experiment.boot_lab.metric_long_tasks')} value={`${report?.summary?.longTaskCount || 0}`} tone={report?.summary?.longTaskCount ? 'warning' : 'default'} />
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              <div className="min-w-0 rounded-lg border border-on-surface/10 bg-surface-sunken/35 p-2">
                <div className="mb-1 text-[10px] font-semibold uppercase text-on-surface-muted">
                  {t('experiment.boot_lab.tasks')}
                </div>
                <div className="space-y-1">
                  {tasks.slice(-8).map((task, index) => (
                    <div key={`${task.task}-${index}`} className="flex min-w-0 items-center gap-2 text-[11px]">
                      <span className="min-w-0 flex-1 truncate text-on-surface">{task.task}</span>
                      <span className={`shrink-0 tabular-nums ${task.error ? 'text-rose-600' : 'text-on-surface-muted'}`}>
                        {formatMs(task.durationMs)}
                      </span>
                    </div>
                  ))}
                  {!tasks.length ? (
                    <div className="text-[11px] text-on-surface-muted">{t('experiment.boot_lab.empty')}</div>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0 rounded-lg border border-on-surface/10 bg-surface-sunken/35 p-2">
                <div className="mb-1 text-[10px] font-semibold uppercase text-on-surface-muted">
                  {t('experiment.boot_lab.phases')}
                </div>
                <div className="space-y-1">
                  {phases.slice(-8).map((phase, index) => (
                    <div key={`${phase.phase}-${index}`} className="flex min-w-0 items-center gap-2 text-[11px]">
                      <span className="min-w-0 flex-1 truncate text-on-surface">{phase.phase}</span>
                      <span className="shrink-0 tabular-nums text-on-surface-muted">{formatMs(phase.durationMs)}</span>
                    </div>
                  ))}
                  {!phases.length ? (
                    <div className="text-[11px] text-on-surface-muted">{t('experiment.boot_lab.empty')}</div>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0 rounded-lg border border-on-surface/10 bg-surface-sunken/35 p-2">
                <div className="mb-1 text-[10px] font-semibold uppercase text-on-surface-muted">
                  {t('experiment.boot_lab.main_frame_segment')}
                </div>
                <div className="space-y-1">
                  <div className="flex min-w-0 items-center gap-2 text-[11px]">
                    <span className="min-w-0 flex-1 truncate text-on-surface">{t('experiment.boot_lab.metric_main_wait')}</span>
                    <span className="shrink-0 tabular-nums text-on-surface-muted">{formatMs(mainFrameWaitMs)}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-[11px]">
                    <span className="min-w-0 flex-1 truncate text-on-surface">{t('experiment.boot_lab.main_frame_trace_events')}</span>
                    <span className="shrink-0 tabular-nums text-on-surface-muted">{mainFrameSegment?.trace?.keyEventCount || 0}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-[11px]">
                    <span className="min-w-0 flex-1 truncate text-on-surface">{t('experiment.boot_lab.main_frame_pond')}</span>
                    <span className="shrink-0 tabular-nums text-on-surface-muted">{formatMs(mainFrameSegment?.trace?.parts?.pond?.elapsedMs)}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-[11px]">
                    <span className="min-w-0 flex-1 truncate text-on-surface">{t('experiment.boot_lab.main_frame_bonsai')}</span>
                    <span className="shrink-0 tabular-nums text-on-surface-muted">{formatMs(mainFrameSegment?.trace?.parts?.bonsai?.elapsedMs)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-on-surface/10 bg-surface/85 p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-on-surface-muted" aria-hidden="true" />
              <h4 className="text-xs font-bold text-on-surface">{t('experiment.boot_lab.errors_title')}</h4>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <BootMetric label={t('experiment.boot_lab.metric_boot_errors')} value={`${bootErrors.length}`} tone={bootErrors.length ? 'error' : 'default'} />
              <BootMetric label={t('experiment.boot_lab.metric_task_errors')} value={`${taskErrors.length}`} tone={taskErrors.length ? 'error' : 'default'} />
              <BootMetric label={t('experiment.boot_lab.metric_trace_errors')} value={`${traceErrors.length}`} tone={traceErrors.length ? 'warning' : 'default'} />
            </div>
            <div className="mt-3 space-y-2">
              {[...bootErrors, ...taskErrors, ...traceErrors].slice(0, 6).map((entry, index) => (
                <div key={index} className="rounded-lg border border-on-surface/10 bg-surface-sunken/35 px-3 py-2 text-[11px]">
                  <div className="truncate font-semibold text-on-surface">
                    {formatValue(entry.code || entry.task || entry.event || entry.type)}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-on-surface-muted">
                    {formatValue(entry.message || entry.error || entry.details?.message || entry.payload?.message)}
                  </div>
                </div>
              ))}
              {!bootErrors.length && !taskErrors.length && !traceErrors.length ? (
                <div className="rounded-lg border border-on-surface/10 bg-surface-sunken/35 px-3 py-2 text-[11px] text-on-surface-muted">
                  {t('experiment.boot_lab.no_errors')}
                </div>
              ) : null}
              {stackSamples.length ? (
                <pre className="max-h-44 overflow-auto rounded-lg border border-on-surface/10 bg-surface-sunken/55 p-3 text-[10px] leading-relaxed text-on-surface-muted">
                  {stackSamples.map((sample) => `${sample.path}\n${sample.stack}`).join('\n\n')}
                </pre>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-on-surface/10 bg-surface/85 p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileJson className="h-4 w-4 text-on-surface-muted" aria-hidden="true" />
              <h4 className="text-xs font-bold text-on-surface">{t('experiment.boot_lab.trace_title')}</h4>
            </div>
            <div className="space-y-1">
              {traceEvents.slice(-14).map((event) => (
                <div key={`${event.index}-${event.event}`} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-[11px]">
                  <span className="tabular-nums text-on-surface-muted">{formatMs(event.elapsedMs)}</span>
                  <span className="min-w-0 truncate text-on-surface">{event.event}</span>
                </div>
              ))}
              {!traceEvents.length ? (
                <div className="rounded-lg border border-on-surface/10 bg-surface-sunken/35 px-3 py-2 text-[11px] text-on-surface-muted">
                  {t('experiment.boot_lab.no_trace')}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default BootDiagnosticsLab;
