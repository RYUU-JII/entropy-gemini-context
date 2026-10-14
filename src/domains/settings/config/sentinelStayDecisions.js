import { normalizeDomain } from '../../../lib/domain.js';

function normalizeIsoDate(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeDecisionTimestamp(value) {
  const timestamp = Math.floor(Number(value));
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

export function normalizeSentinelStayDecisions(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const next = {};
  for (const [domain, value] of Object.entries(raw)) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain || !value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    const dateStr = normalizeIsoDate(value.dateStr);
    const decidedAt = normalizeDecisionTimestamp(value.decidedAt);
    if (!dateStr || !decidedAt) continue;

    next[normalizedDomain] = {
      dateStr,
      decidedAt,
    };
  }

  return next;
}
