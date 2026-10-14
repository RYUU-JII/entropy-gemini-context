export const APP_FEEDBACK_SURFACES = Object.freeze({
  OVERLAY: 'overlay',
  INLINE: 'inline',
  DIALOG: 'dialog',
  NONE: 'none',
});

export const APP_FEEDBACK_KINDS = Object.freeze({
  SETTINGS_COMMAND_SYNCED: 'settings.command.synced',
  SETTINGS_COMMAND_FAILED: 'settings.command.failed',
  SETTINGS_PROPAGATION_FAILED: 'settings.propagation.failed',
  SETTINGS_COMMAND_RETRYING: 'settings.command.retrying',
  FORM_VALIDATION_ERROR: 'form.validation_error',
  CONFIRM_DESTRUCTIVE_ACTION: 'confirm.destructive_action',
  INTERACTION_COPY_COMPLETED: 'interaction.copy.completed',
  INTERACTION_COPY_FAILED: 'interaction.copy.failed',
  ACTION_COMPLETED: 'action.completed',
  ACTION_FAILED: 'action.failed',
  SYSTEM_NOTICE: 'system.notice',
  SYSTEM_WARNING: 'system.warning',
});

export const APP_FEEDBACK_TONES = Object.freeze({
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
});

const EVENT_POLICY = Object.freeze({
  [APP_FEEDBACK_KINDS.SETTINGS_COMMAND_SYNCED]: {
    surface: APP_FEEDBACK_SURFACES.NONE,
    tone: APP_FEEDBACK_TONES.SUCCESS,
  },
  [APP_FEEDBACK_KINDS.SETTINGS_COMMAND_FAILED]: {
    surface: APP_FEEDBACK_SURFACES.INLINE,
    tone: APP_FEEDBACK_TONES.ERROR,
  },
  [APP_FEEDBACK_KINDS.SETTINGS_PROPAGATION_FAILED]: {
    surface: APP_FEEDBACK_SURFACES.INLINE,
    tone: APP_FEEDBACK_TONES.WARNING,
  },
  [APP_FEEDBACK_KINDS.SETTINGS_COMMAND_RETRYING]: {
    surface: APP_FEEDBACK_SURFACES.INLINE,
    tone: APP_FEEDBACK_TONES.WARNING,
  },
  [APP_FEEDBACK_KINDS.FORM_VALIDATION_ERROR]: {
    surface: APP_FEEDBACK_SURFACES.INLINE,
    tone: APP_FEEDBACK_TONES.ERROR,
  },
  [APP_FEEDBACK_KINDS.CONFIRM_DESTRUCTIVE_ACTION]: {
    surface: APP_FEEDBACK_SURFACES.DIALOG,
    tone: APP_FEEDBACK_TONES.WARNING,
  },
  [APP_FEEDBACK_KINDS.INTERACTION_COPY_COMPLETED]: {
    surface: APP_FEEDBACK_SURFACES.OVERLAY,
    tone: APP_FEEDBACK_TONES.SUCCESS,
    titleKey: 'feedback.interaction.copy_completed.title',
    messageKey: 'feedback.interaction.copy_completed.message',
    durationMs: 1800,
    dedupeMs: 900,
    priority: 25,
  },
  [APP_FEEDBACK_KINDS.INTERACTION_COPY_FAILED]: {
    surface: APP_FEEDBACK_SURFACES.OVERLAY,
    tone: APP_FEEDBACK_TONES.ERROR,
    titleKey: 'feedback.interaction.copy_failed.title',
    messageKey: 'feedback.interaction.copy_failed.message',
    durationMs: 3600,
    dedupeMs: 900,
    priority: 60,
  },
  [APP_FEEDBACK_KINDS.ACTION_COMPLETED]: {
    surface: APP_FEEDBACK_SURFACES.OVERLAY,
    tone: APP_FEEDBACK_TONES.SUCCESS,
    durationMs: 2200,
    dedupeMs: 900,
    priority: 30,
  },
  [APP_FEEDBACK_KINDS.ACTION_FAILED]: {
    surface: APP_FEEDBACK_SURFACES.OVERLAY,
    tone: APP_FEEDBACK_TONES.ERROR,
    durationMs: 4600,
    dedupeMs: 900,
    priority: 70,
  },
  [APP_FEEDBACK_KINDS.SYSTEM_NOTICE]: {
    surface: APP_FEEDBACK_SURFACES.OVERLAY,
    tone: APP_FEEDBACK_TONES.INFO,
    durationMs: 2600,
    dedupeMs: 900,
    priority: 20,
  },
  [APP_FEEDBACK_KINDS.SYSTEM_WARNING]: {
    surface: APP_FEEDBACK_SURFACES.OVERLAY,
    tone: APP_FEEDBACK_TONES.WARNING,
    durationMs: 3800,
    dedupeMs: 900,
    priority: 50,
  },
});

function requireTranslator(t) {
  if (typeof t !== 'function') {
    throw new Error('[appFeedbackPolicy] resolveAppFeedbackEvent requires a translation function.');
  }
  return t;
}

function normalizeKind(kind) {
  const nextKind = typeof kind === 'string' ? kind.trim() : '';
  if (!nextKind) {
    throw new Error('[appFeedbackPolicy] Feedback event kind is required.');
  }
  if (!Object.prototype.hasOwnProperty.call(EVENT_POLICY, nextKind)) {
    throw new Error(`[appFeedbackPolicy] Unknown feedback event kind '${nextKind}'.`);
  }
  return nextKind;
}

function normalizeTone(tone, fallbackTone = APP_FEEDBACK_TONES.INFO) {
  if (
    tone === APP_FEEDBACK_TONES.SUCCESS
    || tone === APP_FEEDBACK_TONES.WARNING
    || tone === APP_FEEDBACK_TONES.ERROR
    || tone === APP_FEEDBACK_TONES.INFO
  ) {
    return tone;
  }
  return fallbackTone;
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function resolvePolicyText({ event, policy, t }) {
  const explicitTitle = normalizeString(event.title);
  const explicitMessage = normalizeString(event.message);
  const explicitDetail = normalizeString(event.detail);

  if (explicitTitle || explicitMessage || explicitDetail) {
    return {
      title: explicitTitle,
      message: explicitMessage,
      detail: explicitDetail,
    };
  }

  return {
    title: policy.titleKey ? t(policy.titleKey, {}) : '',
    message: policy.messageKey ? t(policy.messageKey, {}) : '',
    detail: '',
  };
}

function normalizeIconTabId(value) {
  const normalized = normalizeString(value);
  return normalized || '';
}

function buildDedupeKey(event, policy, text) {
  const explicitKey = normalizeString(event.dedupeKey);
  if (explicitKey) return explicitKey;

  return `${event.kind}:${policy.tone}:${text.title}:${text.message}:${text.detail}`;
}

export function getAppFeedbackPolicy(kind) {
  return EVENT_POLICY[normalizeKind(kind)];
}

export function shouldUseOverlayFeedback(kind) {
  return getAppFeedbackPolicy(kind).surface === APP_FEEDBACK_SURFACES.OVERLAY;
}

export function resolveAppFeedbackEvent(event = {}, t) {
  const translate = requireTranslator(t);
  const kind = normalizeKind(event.kind);
  const policy = EVENT_POLICY[kind];

  if (policy.surface !== APP_FEEDBACK_SURFACES.OVERLAY) {
    return null;
  }

  const text = resolvePolicyText({
    event: { ...event, kind },
    policy,
    t: translate,
  });

  if (!text.title && !text.message && !text.detail) {
    throw new Error(`[appFeedbackPolicy] Overlay feedback '${kind}' resolved without visible text.`);
  }

  return {
    kind,
    surface: APP_FEEDBACK_SURFACES.OVERLAY,
    tone: normalizeTone(event.tone, policy.tone),
    iconTabId: normalizeIconTabId(event.iconTabId || event.payload?.tabId),
    title: text.title,
    message: text.message,
    detail: text.detail,
    durationMs: event.durationMs ?? policy.durationMs,
    dedupeMs: event.dedupeMs ?? policy.dedupeMs,
    dedupeKey: buildDedupeKey({ ...event, kind }, policy, text),
    priority: Number.isFinite(Number(event.priority))
      ? Math.floor(Number(event.priority))
      : policy.priority,
  };
}
