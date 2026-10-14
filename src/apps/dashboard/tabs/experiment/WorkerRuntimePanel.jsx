import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  clearPersistedWorkerRuntimeEvents,
  clearWorkerRuntimeEvents,
  readPersistedWorkerRuntimeEvents,
  readWorkerRuntimePersistenceStatus,
  readWorkerRuntimeEvents,
  WORKER_RUNTIME_EVENT_TYPE,
} from '../../../../platform/workers/runtime/index.js';

const ALL_WORKER_RUNTIME_FILTER = 'all';
const EMPTY_WORKER_RUNTIME_SUMMARY = Object.freeze({
  totalAll: 0,
  total: 0,
  success: 0,
  fail: 0,
  timeout: 0,
  fallback: 0,
  circuitOpen: 0,
  canceled: 0,
  queueDropped: 0,
  queueCleared: 0,
  latestEvents: [],
  updatedAt: 0,
});

function applyWorkerRuntimeFilters(
  events = [],
  {
    taskTypeFilter = ALL_WORKER_RUNTIME_FILTER,
    priorityFilter = ALL_WORKER_RUNTIME_FILTER,
  } = {},
) {
  const normalized = Array.isArray(events) ? events : [];
  return normalized.filter((event) => {
    const eventTaskType = typeof event?.taskType === 'string' ? event.taskType : null;
    const eventPriority = typeof event?.priority === 'string' ? event.priority : null;
    const taskTypePass = (
      taskTypeFilter === ALL_WORKER_RUNTIME_FILTER
      || eventTaskType === taskTypeFilter
    );
    const priorityPass = (
      priorityFilter === ALL_WORKER_RUNTIME_FILTER
      || eventPriority === priorityFilter
    );
    return taskTypePass && priorityPass;
  });
}

function summarizeWorkerRuntimeEvents(
  events = [],
  {
    taskTypeFilter = ALL_WORKER_RUNTIME_FILTER,
    priorityFilter = ALL_WORKER_RUNTIME_FILTER,
  } = {},
) {
  const normalized = Array.isArray(events) ? events : [];
  const filtered = applyWorkerRuntimeFilters(
    normalized,
    { taskTypeFilter, priorityFilter },
  );
  const summary = {
    ...EMPTY_WORKER_RUNTIME_SUMMARY,
    totalAll: normalized.length,
    total: filtered.length,
    latestEvents: filtered.slice(-20).reverse(),
    updatedAt: Date.now(),
  };
  filtered.forEach((event) => {
    const type = String(event?.type || '');
    if (type === WORKER_RUNTIME_EVENT_TYPE.SUCCESS) summary.success += 1;
    if (type === WORKER_RUNTIME_EVENT_TYPE.FAIL) summary.fail += 1;
    if (type === WORKER_RUNTIME_EVENT_TYPE.TIMEOUT) summary.timeout += 1;
    if (type === WORKER_RUNTIME_EVENT_TYPE.FALLBACK_USED) summary.fallback += 1;
    if (type === WORKER_RUNTIME_EVENT_TYPE.CIRCUIT_OPEN) summary.circuitOpen += 1;
    if (type === WORKER_RUNTIME_EVENT_TYPE.CANCELED) summary.canceled += 1;
    if (type === WORKER_RUNTIME_EVENT_TYPE.QUEUE_DROPPED) summary.queueDropped += 1;
    if (type === WORKER_RUNTIME_EVENT_TYPE.QUEUE_CLEARED) summary.queueCleared += 1;
  });
  return summary;
}

function mergeRuntimeEvents(...eventLists) {
  const merged = [];
  const seen = new Set();
  eventLists.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((event) => {
      if (!event || typeof event !== 'object') return;
      const id = String(event.id || '');
      const key = id || `${event.type || 'unknown'}_${event.timestamp || 0}_${event.worker || 'worker'}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(event);
    });
  });
  return merged
    .slice()
    .sort((left, right) => Number(left?.timestamp || 0) - Number(right?.timestamp || 0));
}

function formatRuntimeTimestamp(value) {
  const ts = Number(value);
  if (!Number.isFinite(ts) || ts <= 0) return '-';
  try {
    return new Date(ts).toLocaleTimeString();
  } catch (_) {
    return '-';
  }
}

function describeWorkerRuntimeError(error) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  const message = String(error || '').trim();
  return message || 'WORKER_RUNTIME_EVENTS_FAILED';
}

export default function WorkerRuntimePanel({ isActive = false }) {
  const { t } = useAppTranslation('tools');
  const tRuntimePanel = useCallback((key, options = {}) => (
    t(`worker_runtime.${key}`, options)
  ), [t]);
  const [workerRuntimeEvents, setWorkerRuntimeEvents] = useState([]);
  const [workerRuntimeTaskTypeFilter, setWorkerRuntimeTaskTypeFilter] = useState(ALL_WORKER_RUNTIME_FILTER);
  const [workerRuntimePriorityFilter, setWorkerRuntimePriorityFilter] = useState(ALL_WORKER_RUNTIME_FILTER);
  const [workerRuntimeSummary, setWorkerRuntimeSummary] = useState(EMPTY_WORKER_RUNTIME_SUMMARY);
  const [workerRuntimeError, setWorkerRuntimeError] = useState('');
  const [workerRuntimePersistenceStatus, setWorkerRuntimePersistenceStatus] = useState(() => (
    readWorkerRuntimePersistenceStatus()
  ));

  const refreshWorkerRuntimeSummary = useCallback(async ({
    clearErrorOnSuccess = true,
  } = {}) => {
    setWorkerRuntimePersistenceStatus(readWorkerRuntimePersistenceStatus());
    const localEvents = readWorkerRuntimeEvents();
    const applySummary = (events) => {
      const mergedEvents = mergeRuntimeEvents(localEvents, events);
      setWorkerRuntimeEvents(mergedEvents);
      setWorkerRuntimePersistenceStatus(readWorkerRuntimePersistenceStatus());
    };
    try {
      const storedEvents = await readPersistedWorkerRuntimeEvents();
      if (clearErrorOnSuccess) {
        setWorkerRuntimeError('');
      }
      applySummary(storedEvents);
    } catch (error) {
      setWorkerRuntimeError(describeWorkerRuntimeError(error));
      applySummary([]);
    }
  }, []);

  const workerRuntimeTaskTypeOptions = useMemo(() => {
    const options = new Set([ALL_WORKER_RUNTIME_FILTER]);
    workerRuntimeEvents.forEach((event) => {
      if (typeof event?.taskType === 'string' && event.taskType.trim()) {
        options.add(event.taskType.trim());
      }
    });
    const sorted = Array.from(options)
      .filter((value) => value !== ALL_WORKER_RUNTIME_FILTER)
      .sort((left, right) => left.localeCompare(right));
    return [ALL_WORKER_RUNTIME_FILTER, ...sorted];
  }, [workerRuntimeEvents]);

  const workerRuntimePriorityOptions = useMemo(() => {
    const options = new Set([ALL_WORKER_RUNTIME_FILTER]);
    workerRuntimeEvents.forEach((event) => {
      if (typeof event?.priority === 'string' && event.priority.trim()) {
        options.add(event.priority.trim());
      }
    });
    const sorted = Array.from(options)
      .filter((value) => value !== ALL_WORKER_RUNTIME_FILTER)
      .sort((left, right) => left.localeCompare(right));
    return [ALL_WORKER_RUNTIME_FILTER, ...sorted];
  }, [workerRuntimeEvents]);

  useEffect(() => {
    if (!workerRuntimeTaskTypeOptions.includes(workerRuntimeTaskTypeFilter)) {
      setWorkerRuntimeTaskTypeFilter(ALL_WORKER_RUNTIME_FILTER);
    }
  }, [workerRuntimeTaskTypeOptions, workerRuntimeTaskTypeFilter]);

  useEffect(() => {
    if (!workerRuntimePriorityOptions.includes(workerRuntimePriorityFilter)) {
      setWorkerRuntimePriorityFilter(ALL_WORKER_RUNTIME_FILTER);
    }
  }, [workerRuntimePriorityOptions, workerRuntimePriorityFilter]);

  const clearWorkerRuntimeSummary = useCallback(async () => {
    try {
      clearWorkerRuntimeEvents();
      await clearPersistedWorkerRuntimeEvents();
      setWorkerRuntimeError('');
    } catch (error) {
      setWorkerRuntimeError(describeWorkerRuntimeError(error));
    }
    await refreshWorkerRuntimeSummary({ clearErrorOnSuccess: false });
  }, [refreshWorkerRuntimeSummary]);

  useEffect(() => {
    setWorkerRuntimeSummary(
      summarizeWorkerRuntimeEvents(
        workerRuntimeEvents,
        {
          taskTypeFilter: workerRuntimeTaskTypeFilter,
          priorityFilter: workerRuntimePriorityFilter,
        },
      ),
    );
  }, [
    workerRuntimeEvents,
    workerRuntimeTaskTypeFilter,
    workerRuntimePriorityFilter,
  ]);

  useEffect(() => {
    if (!isActive) return undefined;
    void refreshWorkerRuntimeSummary();
    const intervalId = setInterval(() => {
      void refreshWorkerRuntimeSummary();
    }, 2500);
    return () => clearInterval(intervalId);
  }, [isActive, refreshWorkerRuntimeSummary]);

  const runtimeLatestEvents = Array.isArray(workerRuntimeSummary?.latestEvents)
    ? workerRuntimeSummary.latestEvents
    : [];

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-surface-sunken/35 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-on-surface">{tRuntimePanel('title')}</div>
          <div className="text-[11px] text-on-surface-muted">
            {tRuntimePanel('subtitle')}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void refreshWorkerRuntimeSummary();
            }}
            className="rounded-lg border border-white/20 bg-white/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-on-surface hover:bg-white/[0.1]"
          >
            {tRuntimePanel('refresh')}
          </button>
          <button
            type="button"
            onClick={clearWorkerRuntimeSummary}
            className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-rose-200 hover:bg-rose-500/20"
          >
            {tRuntimePanel('clear')}
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-on-surface-muted">{tRuntimePanel('events')}</div>
          <div className="text-xs font-mono text-accent tabular-nums">
            {Number(workerRuntimeSummary?.total || 0)} / {Number(workerRuntimeSummary?.totalAll || 0)}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-on-surface-muted">{tRuntimePanel('fail')}</div>
          <div className={`text-xs font-mono tabular-nums ${Number(workerRuntimeSummary?.fail || 0) > 0 ? 'text-danger' : 'text-on-surface'}`}>
            {Number(workerRuntimeSummary?.fail || 0)}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-on-surface-muted">{tRuntimePanel('fallback')}</div>
          <div className="text-xs font-mono text-warning tabular-nums">{Number(workerRuntimeSummary?.fallback || 0)}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <div className="text-[9px] font-black uppercase tracking-[0.1em] text-on-surface-muted">{tRuntimePanel('circuit')}</div>
          <div className={`text-xs font-mono tabular-nums ${Number(workerRuntimeSummary?.circuitOpen || 0) > 0 ? 'text-danger' : 'text-on-surface'}`}>
            {Number(workerRuntimeSummary?.circuitOpen || 0)}
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
        <label className="flex flex-col gap-1 text-[9px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
          {tRuntimePanel('task_type')}
          <select
            value={typeof workerRuntimeTaskTypeFilter === 'string' ? workerRuntimeTaskTypeFilter : ALL_WORKER_RUNTIME_FILTER}
            onChange={(event) => setWorkerRuntimeTaskTypeFilter(event.target.value || ALL_WORKER_RUNTIME_FILTER)}
            className="w-full rounded-md border border-white/15 bg-black/20 px-2 py-1.5 text-[10px] font-mono text-on-surface outline-hidden transition-colors focus:border-accent/70"
          >
            {workerRuntimeTaskTypeOptions.map((optionValue) => (
                  <option key={`task_type_${optionValue}`} value={optionValue}>
                    {optionValue === ALL_WORKER_RUNTIME_FILTER
                      ? tRuntimePanel('all_task_types')
                      : optionValue}
                  </option>
                ))}
              </select>
            </label>
        <label className="flex flex-col gap-1 text-[9px] font-black uppercase tracking-[0.1em] text-on-surface-muted">
          {tRuntimePanel('priority')}
          <select
            value={typeof workerRuntimePriorityFilter === 'string' ? workerRuntimePriorityFilter : ALL_WORKER_RUNTIME_FILTER}
            onChange={(event) => setWorkerRuntimePriorityFilter(event.target.value || ALL_WORKER_RUNTIME_FILTER)}
            className="w-full rounded-md border border-white/15 bg-black/20 px-2 py-1.5 text-[10px] font-mono text-on-surface outline-hidden transition-colors focus:border-accent/70"
          >
            {workerRuntimePriorityOptions.map((optionValue) => (
                  <option key={`priority_${optionValue}`} value={optionValue}>
                    {optionValue === ALL_WORKER_RUNTIME_FILTER
                      ? tRuntimePanel('all_priorities')
                      : optionValue}
                  </option>
                ))}
              </select>
            </label>
      </div>

      <div className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[10px] font-mono text-on-surface-muted">
        <span>
          {tRuntimePanel('filtered', {
            total: Number(workerRuntimeSummary?.total || 0),
            all: Number(workerRuntimeSummary?.totalAll || 0),
          })}
        </span>
        <button
          type="button"
          onClick={() => {
            setWorkerRuntimeTaskTypeFilter(ALL_WORKER_RUNTIME_FILTER);
            setWorkerRuntimePriorityFilter(ALL_WORKER_RUNTIME_FILTER);
          }}
          className="rounded border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-on-surface hover:bg-white/[0.1]"
        >
          {tRuntimePanel('reset_filters')}
        </button>
      </div>
      {workerRuntimePersistenceStatus?.ok === false ? (
        <div className="mb-2 rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1.5 text-[10px] font-mono text-amber-100">
          {tRuntimePanel('persistence_failed')}: {String(workerRuntimePersistenceStatus.lastError || 'WORKER_TELEMETRY_PERSIST_FAILED')}
        </div>
      ) : null}
      {workerRuntimeError ? (
        <div className="mb-2 rounded-lg border border-rose-300/30 bg-rose-500/10 px-2 py-1.5 text-[10px] font-mono text-rose-200">
          {tRuntimePanel('fail')}: {workerRuntimeError}
        </div>
      ) : null}

      <div className="h-[min(45vh,420px)] overflow-auto space-y-2 pr-1">
        {runtimeLatestEvents.length > 0 ? runtimeLatestEvents.map((event, index) => (
          <div
            key={`${event?.id || event?.timestamp || 'runtime'}_${index}`}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[10px] font-mono text-on-surface-muted"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-black uppercase tracking-[0.09em] text-on-surface">
                {String(event?.type || tRuntimePanel('unknown'))}
              </span>
              <span>{formatRuntimeTimestamp(event?.timestamp)}</span>
            </div>
            <div className="mt-1 break-words text-on-surface-muted">
              {String(event?.worker || tRuntimePanel('worker'))}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-on-surface-muted/90">
              <span className="break-words">{tRuntimePanel('task')}: {String(event?.taskType || '-')}</span>
              <span className="break-words">{tRuntimePanel('priority_short')}: {String(event?.priority || '-')}</span>
              <span className="break-words">{tRuntimePanel('lane')}: {String(event?.lane || '-')}</span>
              <span className="break-words">{tRuntimePanel('context_short')}: {String(event?.context || '-')}</span>
            </div>
            {event?.message ? (
              <div className="mt-1 break-words text-rose-200">
                {String(event.message)}
              </div>
            ) : null}
          </div>
        )) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 text-[10px] font-mono text-on-surface-muted">
            {tRuntimePanel('no_events')}
          </div>
        )}
      </div>
    </div>
  );
}
