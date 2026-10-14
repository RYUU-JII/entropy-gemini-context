import { parseLocalDateParts } from '@/domains/stats/shared/dateMath.js';

function dateParts(value) {
  const parts = parseLocalDateParts(value);
  if (parts === null) throw new Error('ZEN_SITE_LEDGER_DATE_INVALID');
  return parts;
}

export function zenLedgerShortDate(value) {
  const { month, day } = dateParts(value);
  return `${month}.${day}`;
}

export function zenLedgerWeekday(value, t, short = false) {
  const { year, month, day } = dateParts(value);
  const weekday = new Date(year, month - 1, day, 12).getDay();
  return t(`usage_ledger.weekday_${short ? 'short_' : ''}${weekday}`);
}

export function zenLedgerDayLabel(value, t) {
  return `${zenLedgerShortDate(value)} ${zenLedgerWeekday(value, t)}`;
}

function requireDuration(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('ZEN_SITE_LEDGER_DURATION_INVALID');
  }
}

export function zenLedgerDuration(value, t) {
  requireDuration(value);
  if (value > 0 && value < 60_000) return t('usage_ledger.duration_less_minute');
  return t('usage_ledger.duration_minutes', { count: Math.round(value / 60_000) });
}

// Evidence must not round a value across its admission threshold.
export function zenLedgerEvidenceDuration(value, t) {
  requireDuration(value);
  if (value === 0) return t('usage_ledger.duration_minutes', { count: 0 });
  if (value < 1_000) return t('usage_ledger.evidence_less_second');
  const wholeSeconds = Math.floor(value / 1_000);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  if (seconds === 0) return t('usage_ledger.duration_minutes', { count: minutes });
  if (minutes === 0) return t('usage_ledger.evidence_duration_seconds', { seconds });
  return t('usage_ledger.evidence_duration_minutes_seconds', { minutes, seconds });
}

export function zenLedgerEvidenceShare(share) {
  if (typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 1) {
    throw new Error('ZEN_SITE_LEDGER_SHARE_INVALID');
  }
  return Math.floor(share * 1_000) / 10;
}

export function zenLedgerWindowEnd(window) {
  return window.startHour + window.durationHours === 24 ? 24 : window.endHourExclusive;
}

export function zenLedgerWindowLabel(window, t) {
  if (window === null || typeof window !== 'object' || Array.isArray(window)
    || !Number.isInteger(window.startHour) || window.startHour < 0 || window.startHour > 23
    || !Number.isInteger(window.durationHours) || window.durationHours < 1 || window.durationHours > 24
    || !Number.isInteger(window.endHourExclusive) || window.endHourExclusive < 0 || window.endHourExclusive > 24
    || typeof window.wrapsMidnight !== 'boolean') throw new Error('ZEN_SITE_LEDGER_WINDOW_INVALID');
  const end = window.startHour + window.durationHours;
  const validEnd = end === 24 ? window.endHourExclusive === 0 || window.endHourExclusive === 24
    : window.endHourExclusive === end % 24;
  if (!validEnd || window.wrapsMidnight !== (end > 24)) throw new Error('ZEN_SITE_LEDGER_WINDOW_INVALID');
  return t(window.wrapsMidnight ? 'usage_ledger.window_range_wrap' : 'usage_ledger.window_range', {
    start: window.startHour, end: zenLedgerWindowEnd(window),
  });
}

export function zenLedgerPatternTitle(pattern, model, t) {
  if (pattern.id === 'short_sessions') return t('usage_ledger.pattern_short_title');
  if (pattern.id === 'long_sessions') return t('usage_ledger.pattern_long_title', {
    minutes: model.criteria.longSessionMinMs / 60_000,
  });
  if (pattern.id === 'recurring_time') return t('usage_ledger.pattern_recurring_title', {
    window: zenLedgerWindowLabel(pattern, t),
  });
  throw new Error('ZEN_SITE_LEDGER_PATTERN_INVALID');
}

export function zenLedgerFocusTitle(focus, model, todayNotes, t) {
  if (focus === null) return null;
  if (focus.kind === 'pattern') {
    const pattern = model.patterns.find(item => item.id === focus.id);
    if (pattern === undefined) throw new Error('ZEN_SITE_LEDGER_FOCUS_INVALID');
    return zenLedgerPatternTitle(pattern, model, t);
  }
  if (focus.kind === 'change' && focus.id === 'change' && model.observations.change.available) {
    return t('usage_ledger.change_title');
  }
  if (focus.kind === 'early' && focus.id === 'longest_session') return t('usage_ledger.early_longest_title');
  if (focus.kind === 'early' && focus.id === 'short_sessions') return t('usage_ledger.today_short_title', {
    minutes: model.criteria.shortSessionMaxMsExclusive / 60_000,
  });
  if (focus.kind === 'today') {
    const note = todayNotes.notes.find(item => item.id === focus.id);
    if (note === undefined) throw new Error('ZEN_SITE_LEDGER_FOCUS_INVALID');
    if (note.id === 'short_sessions') return t('usage_ledger.today_short_title', {
      minutes: model.criteria.shortSessionMaxMsExclusive / 60_000,
    });
    if (note.id === 'peak_time_window') return t('usage_ledger.today_window_title', {
      start: note.window.startHour, end: zenLedgerWindowEnd(note.window),
    });
    if (note.id === 'revisit_within_5m') return t('usage_ledger.today_revisit_title');
    if (note.id === 'friction_response') return t('usage_ledger.today_friction_title');
  }
  throw new Error('ZEN_SITE_LEDGER_FOCUS_INVALID');
}
