const MINUTE_MS = 60000;
const MAX_LABELS = 8;
const MAX_EVIDENCE_ITEMS = 8;
const MAX_METRICS = 16;
const MAX_SUGGESTIONS = 3;
export const SESSION_SUMMARY_DRAFT_CONTRACT_VERSION = 'home-focus-session-summary-v1';

const SESSION_SUMMARY_DRAFT_FIELDS = Object.freeze([
  'id',
  'version',
  'scope',
  'domain',
  'durationMs',
  'severity',
  'primaryLabelId',
  'labels',
  'metrics',
  'evidence',
  'recommendedActionId',
  'deterministicCopy',
]);
const SESSION_SUMMARY_LABEL_FIELDS = Object.freeze(['id', 'severity', 'confidence']);
const SESSION_SUMMARY_COPY_FIELDS = Object.freeze(['title', 'body', 'suggestions']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const canonicalKeys = [...expectedKeys].sort();
  return actualKeys.length === canonicalKeys.length
    && actualKeys.every((key, index) => key === canonicalKeys[index]);
}

function requireSessionSummaryDraftV1(summaryDraft) {
  if (!hasExactKeys(summaryDraft, SESSION_SUMMARY_DRAFT_FIELDS)) {
    throw new Error('SESSION_SUMMARY_DRAFT_V1_FIELDS_INVALID');
  }
  if (summaryDraft.version !== SESSION_SUMMARY_DRAFT_CONTRACT_VERSION) {
    throw new Error('SESSION_SUMMARY_DRAFT_V1_VERSION_INVALID');
  }
  for (const field of ['id', 'scope', 'domain', 'severity', 'primaryLabelId', 'recommendedActionId']) {
    if (typeof summaryDraft[field] !== 'string' || summaryDraft[field].trim() !== summaryDraft[field]) {
      throw new Error(`SESSION_SUMMARY_DRAFT_V1_FIELD_INVALID:${field}`);
    }
  }
  if (!summaryDraft.id || !summaryDraft.scope || !summaryDraft.domain || !summaryDraft.severity) {
    throw new Error('SESSION_SUMMARY_DRAFT_V1_IDENTITY_INVALID');
  }
  if (!Number.isFinite(summaryDraft.durationMs) || summaryDraft.durationMs < 0) {
    throw new Error('SESSION_SUMMARY_DRAFT_V1_FIELD_INVALID:durationMs');
  }
  if (!Array.isArray(summaryDraft.labels) || summaryDraft.labels.some((label) => (
    !hasExactKeys(label, SESSION_SUMMARY_LABEL_FIELDS)
    || typeof label.id !== 'string'
    || !label.id
    || label.id.trim() !== label.id
    || typeof label.severity !== 'string'
    || !label.severity
    || label.severity.trim() !== label.severity
    || typeof label.confidence !== 'number'
    || !Number.isFinite(label.confidence)
    || label.confidence < 0
    || label.confidence > 1
  ))) throw new Error('SESSION_SUMMARY_DRAFT_V1_LABELS_INVALID');
  if (!isPlainObject(summaryDraft.metrics)) {
    throw new Error('SESSION_SUMMARY_DRAFT_V1_METRICS_INVALID');
  }
  if (!Array.isArray(summaryDraft.evidence) || summaryDraft.evidence.some((item) => (
    typeof item !== 'string' || !item.trim() || item.trim() !== item
  ))) throw new Error('SESSION_SUMMARY_DRAFT_V1_EVIDENCE_INVALID');
  if (!hasExactKeys(summaryDraft.deterministicCopy, SESSION_SUMMARY_COPY_FIELDS)
    || typeof summaryDraft.deterministicCopy.title !== 'string'
    || typeof summaryDraft.deterministicCopy.body !== 'string'
    || !Array.isArray(summaryDraft.deterministicCopy.suggestions)
    || summaryDraft.deterministicCopy.suggestions.some((item) => typeof item !== 'string')) {
    throw new Error('SESSION_SUMMARY_DRAFT_V1_COPY_INVALID');
  }
  return summaryDraft;
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function truncateString(value, maxLength = 220) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function cleanString(value, fallback = '', maxLength = 220) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized ? truncateString(normalized, maxLength) : fallback;
}

function cleanId(value, fallback = '') {
  return cleanString(value, fallback, 96);
}

function cleanScalar(value) {
  if (typeof value === 'string') return cleanString(value, '', 180);
  if (typeof value === 'number') return toFiniteNumber(value);
  if (typeof value === 'boolean') return value;
  if (value === null) return null;
  return null;
}

function cleanDurationMinutes(summaryDraft) {
  return Math.max(0, Math.round(summaryDraft.durationMs / MINUTE_MS));
}

function cleanLabel(label) {
  return {
    id: cleanId(label.id),
    severity: cleanString(label.severity, '', 40),
    confidence: label.confidence,
  };
}

function cleanEvidenceItem(item) {
  return { text: cleanString(item, '', 180) };
}

function cleanLabels(summaryDraft) {
  return summaryDraft.labels.map(cleanLabel).slice(0, MAX_LABELS);
}

function cleanMetrics(metrics) {
  if (!isPlainObject(metrics)) return {};
  const entries = [];
  for (const [key, value] of Object.entries(metrics)) {
    const normalizedKey = cleanId(key);
    if (!normalizedKey) continue;
    const normalizedValue = cleanScalar(value);
    if (normalizedValue === null) continue;
    entries.push([normalizedKey, normalizedValue]);
    if (entries.length >= MAX_METRICS) break;
  }
  return Object.fromEntries(entries);
}

function cleanDeterministicCopy(summaryDraft) {
  const copy = summaryDraft.deterministicCopy;
  return {
    title: cleanString(copy.title, '', 90),
    body: cleanString(copy.body, '', 360),
    suggestions: copy.suggestions
      .map((suggestion) => cleanString(suggestion, '', 140))
      .filter(Boolean)
      .slice(0, MAX_SUGGESTIONS),
  };
}

export function buildSessionSummaryNarrationInput({
  summaryDraft = null,
} = {}) {
  if (!isPlainObject(summaryDraft)) {
    throw new Error('Session summary narration requires a summaryDraft input.');
  }
  const source = requireSessionSummaryDraftV1(summaryDraft);

  const labels = cleanLabels(source);
  const metrics = cleanMetrics(source.metrics);
  const evidence = source.evidence.map(cleanEvidenceItem).slice(0, MAX_EVIDENCE_ITEMS);
  const deterministicCopy = cleanDeterministicCopy(source);

  if (!labels.length && !deterministicCopy.body && Object.keys(metrics).length <= 0) {
    throw new Error('Session summary narration requires labels, metrics, or deterministic copy.');
  }

  return {
    sourceKind: 'sessionSummaryDraft',
    draftId: cleanId(source.id),
    draftVersion: cleanId(source.version),
    scope: cleanString(source.scope, '', 40),
    domain: cleanString(source.domain, '', 140),
    durationMinutes: cleanDurationMinutes(source),
    severity: cleanString(source.severity, '', 40),
    primaryLabelId: cleanId(source.primaryLabelId),
    labels,
    metrics,
    evidence,
    recommendedActionId: cleanId(source.recommendedActionId),
    deterministicCopy,
  };
}
