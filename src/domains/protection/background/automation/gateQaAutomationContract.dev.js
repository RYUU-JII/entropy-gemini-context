import { baselineShishiConsumptionLevel, requireShishiConsumptionLevel, SHISHI_CONSUMPTION_PROFILE } from '../../domain/shishiConsumptionLevel.js';
import { requireGateRecentConsumption, unavailableGateRecentConsumption } from '../../domain/gateRecentConsumption.js';
import {
  GATE_PROTECTED_TAB_MAX,
  getGateProtectedTabThreshold,
  normalizeGateMaxProtectedTabs,
} from '../../../settings/config/gateConfig.js';

export const GATE_QA_AUTOMATION_CHANNEL = 'entropy.gate.qa.v1';

export const GATE_QA_AUTOMATION_ACTIONS = Object.freeze({
  PRESENT_ENTRY_CHECKPOINT: 'QA_GATE_PRESENT_ENTRY_CHECKPOINT',
  PRESENT_DETOUR_SPREAD: 'QA_GATE_PRESENT_DETOUR_SPREAD',
  DISMISS: 'QA_GATE_DISMISS',
  READ_EXPOSURE: 'QA_GATE_READ_EXPOSURE',
  READ_CONSUMPTION: 'QA_GATE_READ_CONSUMPTION',
  RELEASE_ENTRY_APPROVAL: 'QA_GATE_RELEASE_ENTRY_APPROVAL',
});

const ACTIONS = new Set(Object.values(GATE_QA_AUTOMATION_ACTIONS));
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const MAX_QA_PROTECTED_TAB_COUNT = GATE_PROTECTED_TAB_MAX + 5;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTargetTabId(value) {
  const targetTabId = Number(value);
  if (!Number.isSafeInteger(targetTabId) || targetTabId < 0) {
    fail('GATE_QA_AUTOMATION_TARGET_TAB_INVALID');
  }
  return targetTabId;
}

function normalizeExactWebUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    fail('GATE_QA_AUTOMATION_PROTECTED_TAB_URL_INVALID');
  }
  const url = value.trim();
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_error) {
    fail('GATE_QA_AUTOMATION_PROTECTED_TAB_URL_INVALID');
  }
  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    || parsed.username
    || parsed.password
  ) {
    fail('GATE_QA_AUTOMATION_PROTECTED_TAB_URL_INVALID');
  }
  return url;
}

function normalizeDeclaredProtectedTabs(value, maxProtectedTabs) {
  if (!Array.isArray(value)) {
    fail('GATE_QA_AUTOMATION_PROTECTED_TABS_INVALID');
  }
  const protectedTabThreshold = getGateProtectedTabThreshold(maxProtectedTabs);
  if (
    value.length < protectedTabThreshold
    || value.length > MAX_QA_PROTECTED_TAB_COUNT
  ) {
    fail('GATE_QA_AUTOMATION_PROTECTED_TAB_COUNT_INVALID');
  }
  const seenTabIds = new Set();
  return Object.freeze(value.map((entry) => {
    if (!isRecord(entry)) fail('GATE_QA_AUTOMATION_PROTECTED_TAB_INVALID');
    const keys = Object.keys(entry);
    if (
      keys.length !== 2
      || !keys.includes('tabId')
      || !keys.includes('url')
    ) {
      fail('GATE_QA_AUTOMATION_PROTECTED_TAB_KEYS_INVALID');
    }
    const tabId = normalizeTargetTabId(entry.tabId);
    if (seenTabIds.has(tabId)) {
      fail('GATE_QA_AUTOMATION_PROTECTED_TAB_DUPLICATE');
    }
    seenTabIds.add(tabId);
    return Object.freeze({
      tabId,
      url: normalizeExactWebUrl(entry.url),
    });
  }));
}

function normalizeDetourPayload(payload, keys) {
  const expectedKeys = ['maxProtectedTabs', 'protectedTabs'];
  if (
    keys.length !== expectedKeys.length
    || expectedKeys.some((key) => !keys.includes(key))
  ) {
    fail('GATE_QA_AUTOMATION_PAYLOAD_KEYS_INVALID');
  }
  let maxProtectedTabs;
  try {
    maxProtectedTabs = normalizeGateMaxProtectedTabs(payload.maxProtectedTabs);
  } catch (_error) {
    fail('GATE_QA_AUTOMATION_MAX_PROTECTED_TABS_INVALID');
  }
  return Object.freeze({
    maxProtectedTabs,
    protectedTabs: normalizeDeclaredProtectedTabs(
      payload.protectedTabs,
      maxProtectedTabs,
    ),
  });
}

function normalizePayload(action, value) {
  const payload = value === undefined || value === null ? {} : value;
  if (!isRecord(payload)) fail('GATE_QA_AUTOMATION_PAYLOAD_INVALID');
  const keys = Object.keys(payload);
  if (action === GATE_QA_AUTOMATION_ACTIONS.RELEASE_ENTRY_APPROVAL) {
    if (keys.length !== 1 || typeof payload.sessionId !== 'string' || !payload.sessionId.trim()) {
      fail('GATE_QA_AUTOMATION_SESSION_REQUIRED');
    }
    return Object.freeze({ sessionId: payload.sessionId });
  }
  if (action === GATE_QA_AUTOMATION_ACTIONS.PRESENT_ENTRY_CHECKPOINT) {
    if (keys.some((key) => !['holdMs', 'intensity', 'recentUse'].includes(key))) {
      fail('GATE_QA_AUTOMATION_PAYLOAD_KEYS_INVALID');
    }
    const holdMs = payload.holdMs === undefined ? 0 : Number(payload.holdMs);
    if (!Number.isSafeInteger(holdMs) || holdMs < 0 || holdMs > 30_000) {
      fail('GATE_QA_AUTOMATION_HOLD_MS_INVALID');
    }
    const intensity = payload.intensity === undefined ? 'baseline' : payload.intensity;
    if (!['baseline', 'maximum'].includes(intensity)) fail('GATE_QA_AUTOMATION_INTENSITY_INVALID');
    const recentUse = payload.recentUse === undefined ? 'empty' : payload.recentUse;
    if (!['empty', 'recorded'].includes(recentUse)) fail('GATE_QA_AUTOMATION_RECENT_USE_INVALID');
    return Object.freeze({ holdMs, intensity, recentUse });
  }
  if (action === GATE_QA_AUTOMATION_ACTIONS.PRESENT_DETOUR_SPREAD) {
    return normalizeDetourPayload(payload, keys);
  }
  if (keys.length > 0) fail('GATE_QA_AUTOMATION_PAYLOAD_KEYS_INVALID');
  return Object.freeze({});
}

export function parseGateQaAutomationRequest(message) {
  if (!isRecord(message)) fail('GATE_QA_AUTOMATION_REQUEST_INVALID');
  if (message.channel !== GATE_QA_AUTOMATION_CHANNEL) {
    fail('GATE_QA_AUTOMATION_CHANNEL_INVALID');
  }
  if (!ACTIONS.has(message.action)) fail('GATE_QA_AUTOMATION_ACTION_INVALID');
  if (
    typeof message.requestId !== 'string'
    || !REQUEST_ID_PATTERN.test(message.requestId)
  ) {
    fail('GATE_QA_AUTOMATION_REQUEST_ID_INVALID');
  }
  const targetTabId = normalizeTargetTabId(message.targetTabId);
  const payload = normalizePayload(message.action, message.payload);
  if (
    message.action === GATE_QA_AUTOMATION_ACTIONS.PRESENT_DETOUR_SPREAD
    && !payload.protectedTabs.some((entry) => entry.tabId === targetTabId)
  ) {
    fail('GATE_QA_AUTOMATION_TARGET_TAB_NOT_PROTECTED');
  }
  return Object.freeze({
    channel: GATE_QA_AUTOMATION_CHANNEL,
    action: message.action,
    requestId: message.requestId,
    targetTabId,
    payload,
  });
}

export function createGateQaAutomationResponse(request, {
  success,
  result = null,
  error = null,
} = {}) {
  const normalized = parseGateQaAutomationRequest(request);
  if (typeof success !== 'boolean') fail('GATE_QA_AUTOMATION_RESPONSE_SUCCESS_INVALID');
  if (success && error !== null) fail('GATE_QA_AUTOMATION_RESPONSE_ERROR_CONFLICT');
  if (!success && (typeof error !== 'string' || !error.trim())) {
    fail('GATE_QA_AUTOMATION_RESPONSE_ERROR_REQUIRED');
  }
  return Object.freeze({
    channel: normalized.channel,
    action: normalized.action,
    requestId: normalized.requestId,
    targetTabId: normalized.targetTabId,
    success,
    result: success ? result : null,
    error: success ? null : error.trim(),
  });
}

export function createEntryCheckpointQaRuntimeSnapshot({
  now = Date.now(),
  holdMs = 0,
  intensity = 'baseline',
  recentUse = 'empty',
} = {}) {
  const issuedAt = Math.max(0, Math.floor(Number(now) || Date.now()));
  if (!['baseline', 'maximum'].includes(intensity)) fail('GATE_QA_AUTOMATION_INTENSITY_INVALID');
  if (!['empty', 'recorded'].includes(recentUse)) fail('GATE_QA_AUTOMATION_RECENT_USE_INVALID');
  const recentConsumption = recentUse === 'recorded'
    ? requireGateRecentConsumption({ contract: 'gate_recent_consumption_v1', status: 'observed',
      reason: 'manual_qa_fixture', evaluatedAt: issuedAt,
      foregroundMs: 32 * 60_000, lastObservedAt: issuedAt - 18 * 60_000 })
    : unavailableGateRecentConsumption(issuedAt, 'manual_qa_fixture');
  const shishiIntensity = requireShishiConsumptionLevel({
    ...baselineShishiConsumptionLevel('manual_qa_fixture', issuedAt, issuedAt),
    ...(intensity === 'maximum' ? { status: 'adapted', band: 'high', uncertaintyMs: 0,
      waitExtensionMs: SHISHI_CONSUMPTION_PROFILE.maximumWaitExtensionMs } : {}),
  });
  return Object.freeze({
    scope: Object.freeze({
      specialSession: null,
      isBlockedDomain: false,
    }),
    plan: Object.freeze({
      artifacts: Object.freeze({
        detourSpreadGuard: 'inactive',
        returnGuard: 'inactive',
        entryCheckpoint: 'engaged',
      }),
      state: Object.freeze({ level: 1 }),
      trace: Object.freeze({
        pressureSignals: Object.freeze([]),
        directTriggers: Object.freeze(['ENTRY_CHECKPOINT_REQUIRED']),
      }),
    }),
    telemetryContext: Object.freeze({
      gate: Object.freeze({
        entryCheckpoint: Object.freeze({
          entryDetected: true,
          entryPassActive: false,
          holdDurationMs: holdMs,
          shishiIntensity,
          recentConsumption,
          issuedAt,
        }),
      }),
    }),
  });
}

export function createDetourSpreadQaRuntimeSnapshot({
  now = Date.now(),
  maxProtectedTabs,
  protectedTabs,
} = {}) {
  const issuedAt = Math.max(0, Math.floor(Number(now) || Date.now()));
  const normalizedMaxProtectedTabs = normalizeGateMaxProtectedTabs(maxProtectedTabs);
  if (!Array.isArray(protectedTabs)) {
    fail('GATE_QA_AUTOMATION_RESOLVED_PROTECTED_TABS_INVALID');
  }
  const normalizedProtectedTabs = Object.freeze(protectedTabs.map((entry) => {
    if (
      !isRecord(entry)
      || !Number.isSafeInteger(entry.tabId)
      || entry.tabId < 0
      || typeof entry.hostname !== 'string'
      || !entry.hostname.trim()
      || typeof entry.url !== 'string'
      || !entry.url.trim()
    ) {
      fail('GATE_QA_AUTOMATION_RESOLVED_PROTECTED_TAB_INVALID');
    }
    return Object.freeze({ ...entry });
  }));
  if (
    normalizedProtectedTabs.length
    < getGateProtectedTabThreshold(normalizedMaxProtectedTabs)
  ) {
    fail('GATE_QA_AUTOMATION_PROTECTED_TAB_COUNT_INVALID');
  }
  const protectedTabHostCount = new Set(
    normalizedProtectedTabs.map((entry) => entry.hostname.trim().toLowerCase()),
  ).size;
  return Object.freeze({
    scope: Object.freeze({
      specialSession: null,
      isBlockedDomain: false,
    }),
    plan: Object.freeze({
      artifacts: Object.freeze({
        detourSpreadGuard: 'engaged',
        returnGuard: 'inactive',
        entryCheckpoint: 'inactive',
      }),
      state: Object.freeze({ level: 2 }),
      trace: Object.freeze({
        pressureSignals: Object.freeze([]),
        directTriggers: Object.freeze([
          'DETOUR_SPREAD_DETECTED',
          'PROTECTED_TAB_CLUSTER',
        ]),
      }),
    }),
    telemetryContext: Object.freeze({
      gate: Object.freeze({
        detourSpreadGuard: Object.freeze({
          maxProtectedTabs: normalizedMaxProtectedTabs,
          contextSwitchCount: 0,
          contextSwitchThreshold: 0,
          protectedTabCount: normalizedProtectedTabs.length,
          protectedTabHostCount,
          protectedTabThreshold: getGateProtectedTabThreshold(
            normalizedMaxProtectedTabs,
          ),
          protectedTabs: normalizedProtectedTabs,
          detourEntryObserved: true,
          consumedProtectedContextCount: 0,
          protectedContextThreshold: 0,
          hopSignal: false,
          clusterSignal: true,
          protectedTabSignal: true,
          consumedContextSignal: false,
          holdDurationMs: 0,
          keptTabPassWindowMs: 0,
          triggered: true,
          issuedAt,
        }),
      }),
    }),
  });
}
