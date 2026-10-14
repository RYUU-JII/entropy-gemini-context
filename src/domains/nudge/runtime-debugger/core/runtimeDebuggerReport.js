import { RUNTIME_DEBUGGER_PROBE_VALIDITY } from './runtimeDebuggerAnalysis.js';
import { createRuntimeDebuggerSessionPayload } from './runtimeDebuggerSession.js';
import { sanitizeRuntimeDebuggerValue } from './runtimeDebuggerSanitizer.js';

const VALID_STATUSES = new Set(Object.values(RUNTIME_DEBUGGER_PROBE_VALIDITY));

function assertProbeResult(probe) {
  if (!probe || typeof probe !== 'object' || typeof probe.probeId !== 'string') {
    throw new Error('RUNTIME_DEBUGGER_PROBE_RESULT_INVALID');
  }
  if (!VALID_STATUSES.has(probe.status)) {
    throw new Error('RUNTIME_DEBUGGER_PROBE_STATUS_INVALID');
  }
}

function cleanHeading(value, fallback) {
  const sanitized = sanitizeRuntimeDebuggerValue(String(value || fallback));
  return String(sanitized).replace(/[\r\n#]+/g, ' ').trim() || fallback;
}

function formatProbeLine(probe) {
  return `- ${probe.label || probe.probeId}: ${probe.status} (operations=${probe.operationCount}, minimum=${probe.minimumOperationCount}, reason=${probe.reason})`;
}

function formatEvidence(evidence) {
  return ['```json', JSON.stringify(evidence, null, 2), '```'].join('\n');
}

function compactValue(value, { maxArrayLength = 5, depth = 0, key = '' } = {}) {
  if (depth > 8) return '[DepthLimit]';
  if (Array.isArray(value)) {
    const isRecentArray = /^recent/i.test(key);
    const bounded = isRecentArray
      ? value.slice(-maxArrayLength)
      : value.slice(0, maxArrayLength);
    const compacted = bounded.map((entry) => compactValue(entry, {
      maxArrayLength,
      depth: depth + 1,
    }));
    if (value.length <= bounded.length) return compacted;

    const truncationMarker = {
      _truncation: {
        total: value.length,
        retained: bounded.length,
        omitted: value.length - bounded.length,
      },
    };
    return isRecentArray
      ? [truncationMarker, ...compacted]
      : [...compacted, truncationMarker];
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
    childKey,
    compactValue(childValue, {
      maxArrayLength,
      depth: depth + 1,
      key: childKey,
    }),
  ]));
}

function createCompactProbeEvidence(evidence, probeResult) {
  return sanitizeRuntimeDebuggerValue({
    tool: evidence.tool,
    version: evidence.version,
    capturedAt: evidence.capturedAt,
    url: evidence.url,
    scope: evidence.scope,
    session: evidence.session,
    probe: {
      probeId: probeResult.probeId,
      label: probeResult.label,
      status: probeResult.status,
      measurable: probeResult.measurable,
      reason: probeResult.reason,
      operationCount: probeResult.operationCount,
      minimumOperationCount: probeResult.minimumOperationCount,
      details: compactValue(probeResult.details || {}, { maxArrayLength: 5 }),
    },
    recentEvents: compactValue(evidence.events?.slice(-5) || [], { maxArrayLength: 5 }),
    evidenceGaps: compactValue(evidence.evidenceGaps || [], { maxArrayLength: 5 }),
    errors: compactValue(evidence.errors || [], { maxArrayLength: 5 }),
  });
}

export function buildRuntimeDebuggerItemReport(
  session,
  probeResult,
  { title = null, diagnosticContext = null } = {},
) {
  assertProbeResult(probeResult);
  const evidence = createRuntimeDebuggerSessionPayload(session, {
    probeResults: [probeResult],
    selectedProbeId: probeResult.probeId,
  });
  const compactEvidence = createCompactProbeEvidence(evidence, probeResult);
  const heading = cleanHeading(title, `Entropy Runtime Debugger: ${probeResult.label || probeResult.probeId}`);

  return [
    `# ${heading}`,
    '',
    '## Agent diagnostic request',
    '',
    'Use only this baseline-to-latest session evidence to identify duplicate scans, unnecessary rescans, over-broad roots/candidates, deferred queue cost, and repeated writes. Separate product work from debugger overhead. Do not interpret an inactive, unavailable, armed_idle, insufficient, or zero-denominator probe as efficient.',
    '',
    `- URL: ${evidence.url || '(none)'}`,
    `- Capture kind: ${evidence.session.captureKind}`,
    `- Validity: ${probeResult.status}`,
    `- Reason: ${probeResult.reason}`,
    `- Session operations: ${probeResult.operationCount}`,
    `- Required operations: ${probeResult.minimumOperationCount}`,
    '',
    '## Compact evidence',
    '',
    formatEvidence(compactEvidence),
    ...(diagnosticContext ? [
      '',
      '## Domain-specific diagnostic context',
      '',
      String(diagnosticContext),
    ] : []),
  ].join('\n');
}

export function buildRuntimeDebuggerFullReport(
  session,
  probeResults,
  { title = 'Entropy Runtime Debugger v2' } = {},
) {
  if (!Array.isArray(probeResults)) throw new Error('RUNTIME_DEBUGGER_PROBE_RESULTS_INVALID');
  probeResults.forEach(assertProbeResult);
  const evidence = createRuntimeDebuggerSessionPayload(session, { probeResults });
  const counts = Object.values(RUNTIME_DEBUGGER_PROBE_VALIDITY).reduce((result, status) => {
    result[status] = probeResults.filter((probe) => probe.status === status).length;
    return result;
  }, Object.create(null));
  const validitySummary = Object.entries(counts)
    .map(([status, count]) => `${status}=${count}`)
    .join(', ');
  const compactProbeResults = probeResults.map((probe) => ({
    probeId: probe.probeId,
    label: probe.label,
    status: probe.status,
    measurable: probe.measurable,
    reason: probe.reason,
    operationCount: probe.operationCount,
    minimumOperationCount: probe.minimumOperationCount,
    details: compactValue(probe.details || {}, { maxArrayLength: 3 }),
  }));

  return [
    `# ${cleanHeading(title, 'Entropy Runtime Debugger v2')}`,
    '',
    '## Agent diagnostic request',
    '',
    'Diagnose where scanner, observer, artifact-effect, and scroll-frame cost overlap across this capture. Prioritize delayed wheel-input-to-first-frame samples, late animation frames, overlapping owner spans or long tasks, duplicate scans, avoidable full rescans, over-broad dirty roots/candidate sets, queue or idle-delay cost, repeated target work, and debugger-induced overhead. Temporal overlap is correlation evidence, not causal proof. Use the validity state before reading any zero counter: inactive/unavailable are not measurements, armed_idle means the owner was ready but its relevant opportunity/effect proof was absent, broken means the active probe contract is incomplete, and zero-denominator ratios are not measured. Operation count is owner work and is not always an opportunity denominator.',
    '',
    '## Capture',
    '',
    `- URL: ${evidence.url || '(none)'}`,
    `- Capture kind: ${evidence.session.captureKind}`,
    `- Started at: ${evidence.session.startedAt}`,
    `- Duration ms: ${Math.max(0, evidence.session.latestCapturedAt - evidence.session.startedAt)}`,
    `- Sample reads: ${evidence.session.sampleReadCount}`,
    `- Changed samples: ${evidence.session.changedSampleCount}`,
    `- Events: ${evidence.session.eventCount}`,
    '',
    '## Measurement validity',
    '',
    `- ${validitySummary}`,
    ...(probeResults.length > 0 ? probeResults.map(formatProbeLine) : ['- No probes registered.']),
    '',
    '## Probe summary',
    '',
    formatEvidence(compactProbeResults),
    '',
    '## Session integrity',
    '',
    formatEvidence({
      tool: evidence.tool,
      version: evidence.version,
      capturedAt: evidence.capturedAt,
      url: evidence.url,
      scope: evidence.scope,
      retention: evidence.session.retention,
      evidenceGaps: compactValue(evidence.evidenceGaps || [], { maxArrayLength: 5 }),
      errors: compactValue(evidence.errors || [], { maxArrayLength: 5 }),
    }),
  ].join('\n');
}
