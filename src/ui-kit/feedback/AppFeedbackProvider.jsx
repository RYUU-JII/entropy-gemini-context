import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { getIconByTabId } from '@/ui-kit/Icons.jsx';
import {
  APP_FEEDBACK_TONES,
  resolveAppFeedbackEvent,
} from './appFeedbackPolicy.js';

const AppFeedbackContext = createContext(null);

const DEFAULT_DURATION_MS = 2400;
const DEFAULT_DEDUPE_MS = 1500;
const MAX_VISIBLE_FEEDBACK = 3;

let feedbackSequence = 0;

const normalizeTone = (tone) => {
  if (
    tone === APP_FEEDBACK_TONES.SUCCESS
    || tone === APP_FEEDBACK_TONES.WARNING
    || tone === APP_FEEDBACK_TONES.ERROR
    || tone === APP_FEEDBACK_TONES.INFO
  ) {
    return tone;
  }
  return APP_FEEDBACK_TONES.INFO;
};

const normalizeDuration = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DURATION_MS;
  return Math.max(600, Math.floor(n));
};

const normalizeDedupeMs = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DEDUPE_MS;
  return Math.max(0, Math.floor(n));
};

const normalizePriority = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
};

const normalizeText = (value) => (
  typeof value === 'string' && value.trim() ? value.trim() : ''
);

const TONE_STYLES = Object.freeze({
  info: {
    shell: 'border-border/55 bg-surface-elevated/95 text-on-surface shadow-[0_18px_54px_rgba(0,0,0,0.18)]',
    iconShell: 'border-accent/25 bg-accent/10 text-accent',
    rule: 'bg-accent',
    title: 'text-on-surface',
    detail: 'text-on-surface-muted',
    Icon: Info,
  },
  success: {
    shell: 'border-success/35 bg-surface-elevated/95 text-on-surface shadow-[0_18px_54px_rgba(0,0,0,0.18)]',
    iconShell: 'border-success/30 bg-success/10 text-success',
    rule: 'bg-success',
    title: 'text-on-surface',
    detail: 'text-on-surface-muted',
    Icon: CheckCircle2,
  },
  warning: {
    shell: 'border-warning/45 bg-surface-elevated/95 text-on-surface shadow-[0_18px_54px_rgba(0,0,0,0.18)]',
    iconShell: 'border-warning/35 bg-warning/10 text-warning',
    rule: 'bg-warning',
    title: 'text-on-surface',
    detail: 'text-on-surface-muted',
    Icon: AlertTriangle,
  },
  error: {
    shell: 'border-danger/45 bg-surface-elevated/95 text-on-surface shadow-[0_18px_54px_rgba(0,0,0,0.2)]',
    iconShell: 'border-danger/35 bg-danger/10 text-danger',
    rule: 'bg-danger',
    title: 'text-on-surface',
    detail: 'text-on-surface-muted',
    Icon: XCircle,
  },
});

function sortQueue(feedbackItems) {
  return [...feedbackItems].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id - b.id;
  });
}

function normalizeOverlayInput(input, options = {}) {
  const raw = typeof input === 'string'
    ? { ...options, message: input }
    : { ...(input || {}) };

  const title = normalizeText(raw.title);
  const message = normalizeText(raw.message);
  const detail = normalizeText(raw.detail);

  if (!title && !message && !detail) {
    return null;
  }

  const tone = normalizeTone(raw.tone);
  return {
    kind: normalizeText(raw.kind),
    title,
    message,
    detail,
    tone,
    durationMs: normalizeDuration(raw.durationMs),
    dedupeMs: normalizeDedupeMs(raw.dedupeMs),
    dedupeKey: normalizeText(raw.dedupeKey) || `${tone}:${title}:${message}:${detail}`,
    iconTabId: normalizeText(raw.iconTabId),
    priority: normalizePriority(raw.priority),
  };
}

export function AppFeedbackProvider({ children }) {
  const { t } = useAppTranslation('common');
  const [visibleFeedback, setVisibleFeedback] = useState([]);
  const [queuedFeedback, setQueuedFeedback] = useState([]);
  const timerMapRef = useRef(new Map());
  const dedupeMapRef = useRef(new Map());

  const dismiss = useCallback((feedbackId) => {
    setVisibleFeedback((prev) => prev.filter((item) => item.id !== feedbackId));
    const timer = timerMapRef.current.get(feedbackId);
    if (timer) {
      clearTimeout(timer);
      timerMapRef.current.delete(feedbackId);
    }
  }, []);

  const clear = useCallback(() => {
    timerMapRef.current.forEach((timer) => clearTimeout(timer));
    timerMapRef.current.clear();
    setVisibleFeedback([]);
    setQueuedFeedback([]);
  }, []);

  useEffect(() => {
    if (!queuedFeedback.length) return;
    if (visibleFeedback.length >= MAX_VISIBLE_FEEDBACK) return;

    const nextCount = Math.min(MAX_VISIBLE_FEEDBACK - visibleFeedback.length, queuedFeedback.length);
    const promote = queuedFeedback.slice(0, nextCount);

    setVisibleFeedback((prev) => [...prev, ...promote]);
    setQueuedFeedback((prev) => prev.slice(nextCount));
  }, [queuedFeedback, visibleFeedback.length]);

  useEffect(() => {
    visibleFeedback.forEach((item) => {
      if (timerMapRef.current.has(item.id)) return;

      const timer = setTimeout(() => {
        dismiss(item.id);
      }, item.durationMs);

      timerMapRef.current.set(item.id, timer);
    });
  }, [visibleFeedback, dismiss]);

  useEffect(() => () => {
    timerMapRef.current.forEach((timer) => clearTimeout(timer));
    timerMapRef.current.clear();
  }, []);

  const show = useCallback((input, options = {}) => {
    const normalized = normalizeOverlayInput(input, options);
    if (!normalized) return null;

    const now = Date.now();
    const previousShownAt = dedupeMapRef.current.get(normalized.dedupeKey) || 0;
    if (normalized.dedupeMs > 0 && now - previousShownAt < normalized.dedupeMs) {
      return null;
    }
    dedupeMapRef.current.set(normalized.dedupeKey, now);

    const feedbackItem = {
      id: ++feedbackSequence,
      ...normalized,
    };

    setQueuedFeedback((prev) => sortQueue([...prev, feedbackItem]));
    return feedbackItem.id;
  }, []);

  const emit = useCallback((event) => {
    const resolved = resolveAppFeedbackEvent(event, t);
    if (!resolved) return null;
    return show(resolved);
  }, [show, t]);

  const success = useCallback((message, options = {}) => show({ ...options, message, tone: APP_FEEDBACK_TONES.SUCCESS }), [show]);
  const info = useCallback((message, options = {}) => show({ ...options, message, tone: APP_FEEDBACK_TONES.INFO }), [show]);
  const warning = useCallback((message, options = {}) => show({ ...options, message, tone: APP_FEEDBACK_TONES.WARNING }), [show]);
  const error = useCallback((message, options = {}) => show({ ...options, message, tone: APP_FEEDBACK_TONES.ERROR }), [show]);

  const contextValue = useMemo(() => ({
    emit,
    show,
    success,
    info,
    warning,
    error,
    dismiss,
    clear,
  }), [emit, show, success, info, warning, error, dismiss, clear]);

  return (
    <AppFeedbackContext.Provider value={contextValue}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 top-4 z-[11990] flex justify-center px-3 sm:justify-end sm:px-6">
        <div className="flex w-full max-w-[25rem] flex-col gap-2">
          {visibleFeedback.map((item) => {
            const toneStyle = TONE_STYLES[item.tone] || TONE_STYLES.info;
            const isError = item.tone === APP_FEEDBACK_TONES.ERROR;
            const Icon = item.iconTabId ? getIconByTabId(item.iconTabId) : toneStyle.Icon;

            return (
              <div
                key={item.id}
                role={isError ? 'alert' : 'status'}
                aria-live={isError ? 'assertive' : 'polite'}
                className={`pointer-events-auto relative overflow-hidden rounded-none border backdrop-blur-xl ${toneStyle.shell}`}
              >
                <div className={`absolute inset-y-0 left-0 w-1 ${toneStyle.rule}`} aria-hidden="true" />

                <div className="flex min-h-[4.5rem] items-start gap-3 px-4 py-3.5 pl-5">
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-none border ${toneStyle.iconShell}`}
                    aria-hidden="true"
                  >
                    <Icon className="h-[17px] w-[17px]" size={17} strokeWidth={2.2} />
                  </span>

                  <div className="min-w-0 flex-1">
                    {item.title ? (
                      <div className={`text-[11px] font-black uppercase leading-snug tracking-[0.08em] ${toneStyle.title}`}>
                        {item.title}
                      </div>
                    ) : null}

                    {item.message ? (
                      <p className={`whitespace-pre-line text-sm font-medium leading-snug ${item.title ? 'mt-1' : ''} ${toneStyle.detail}`}>
                        {item.message}
                      </p>
                    ) : null}

                    {item.detail ? (
                      <p className={`mt-2 break-words text-[11px] font-semibold leading-snug ${toneStyle.detail}`}>
                        {item.detail}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    aria-label={t('toast.dismiss_notification')}
                    onClick={() => dismiss(item.id)}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-none text-on-surface-muted transition hover:bg-surface hover:text-on-surface focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/35"
                  >
                    <X size={14} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppFeedbackContext.Provider>
  );
}

export function useAppFeedback() {
  const context = useContext(AppFeedbackContext);
  if (!context) {
    throw new Error('useAppFeedback must be used within AppFeedbackProvider.');
  }
  return context;
}

export const ToastProvider = AppFeedbackProvider;
export const useToast = useAppFeedback;
