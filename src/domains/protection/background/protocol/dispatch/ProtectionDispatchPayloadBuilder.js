import { MESSAGE_TYPES } from '../../../../../platform/messaging/messageTypes.js';
import { normalizeIndicatorConfig } from '../../../../settings/config/indicator.js';
import {
  DEFAULT_DEBUG_CONFIG,
  normalizeDebugConfig,
} from '../../../../settings/config/debugConfig.js';
import {
  PRECISION_INSIGHTS_SIGNAL_IDS,
  isPrecisionInsightsEnabledForHostname,
  isPrecisionInsightsSignalEnabled,
} from '../../../../settings/config/dataCollectionPolicy.js';
import { buildProtectionPolicyPayload } from './ProtectionDispatchPolicyPayload.js';

function toTraceSignature(trace) {
  const next = { ...trace };
  delete next.traceId;
  return next;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function failPayloadField(fieldName) {
  throw new Error(`PROTECTION_DISPATCH_PAYLOAD_FIELD_INVALID:${fieldName}`);
}

function requirePayloadHostname(hostname) {
  const resolvedHostname = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
  if (!resolvedHostname) {
    throw new Error('PROTECTION_DISPATCH_PAYLOAD_HOSTNAME_REQUIRED');
  }
  return resolvedHostname;
}

function requirePayloadUrl(url) {
  const resolvedUrl = typeof url === 'string' ? url.trim() : '';
  if (!resolvedUrl) {
    throw new Error('PROTECTION_DISPATCH_PAYLOAD_URL_REQUIRED');
  }
  return resolvedUrl;
}

function requireRuntimeSnapshot(runtimeSnapshot) {
  if (!isPlainObject(runtimeSnapshot)) {
    throw new Error('PROTECTION_DISPATCH_PAYLOAD_RUNTIME_SNAPSHOT_REQUIRED');
  }
  return runtimeSnapshot;
}

function readNullableString(source, fieldName) {
  if (!Object.prototype.hasOwnProperty.call(source, fieldName)) {
    failPayloadField(fieldName);
  }
  const value = source[fieldName];
  if (value === null) return null;
  if (typeof value === 'string') return value;
  failPayloadField(fieldName);
}

function requireDispatchSnapshot(dispatch) {
  if (!isPlainObject(dispatch)) {
    failPayloadField('dispatch');
  }
  if (typeof dispatch.isBlockedDomain !== 'boolean') {
    failPayloadField('dispatch.isBlockedDomain');
  }
  if (typeof dispatch.shouldApply !== 'boolean') {
    failPayloadField('dispatch.shouldApply');
  }
  return {
    ...dispatch,
    domainClassId: readNullableString(dispatch, 'domainClassId'),
    traceId: readNullableString(dispatch, 'traceId'),
  };
}

function requireEnvelopeResult(envelopeResult) {
  if (!isPlainObject(envelopeResult)) {
    failPayloadField('envelopeResult');
  }
  if (!isPlainObject(envelopeResult.envelope)) {
    failPayloadField('envelopeResult.envelope');
  }
  return envelopeResult;
}

function requireRuntimePlan(plan) {
  if (!isPlainObject(plan)) {
    failPayloadField('plan');
  }
  return plan;
}

function requireRuntimeTrace(trace) {
  if (!isPlainObject(trace)) {
    failPayloadField('trace');
  }
  return trace;
}

function readOptionalString(source, fieldName) {
  if (!Object.prototype.hasOwnProperty.call(source, fieldName)) return null;
  const value = source[fieldName];
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  failPayloadField(fieldName);
}

function readOptionalPlainObject(source, fieldName) {
  if (!Object.prototype.hasOwnProperty.call(source, fieldName)) return null;
  const value = source[fieldName];
  if (value === null || value === undefined) return null;
  if (isPlainObject(value)) return value;
  failPayloadField(fieldName);
}

export function buildProtectionDispatchPayload({
  hostname,
  runtimeSnapshot,
  settingsCache = {},
  url,
} = {}) {
  const resolvedHostname = requirePayloadHostname(hostname);
  const resolvedUrl = requirePayloadUrl(url);
  const resolvedRuntimeSnapshot = requireRuntimeSnapshot(runtimeSnapshot);
  const envelopeResult = requireEnvelopeResult(resolvedRuntimeSnapshot.envelopeResult);
  const envelope = envelopeResult.envelope;
  const plan = requireRuntimePlan(resolvedRuntimeSnapshot.plan);
  const trace = requireRuntimeTrace(resolvedRuntimeSnapshot.trace);
  const policy = resolvedRuntimeSnapshot.policy ?? null;
  const dispatch = requireDispatchSnapshot(resolvedRuntimeSnapshot.dispatch);
  const releaseReason = readOptionalString(resolvedRuntimeSnapshot, 'releaseReason');
  const globalSentinelOutcome = readOptionalPlainObject(
    resolvedRuntimeSnapshot,
    'globalSentinelOutcome',
  );
  const indicatorConfig = normalizeIndicatorConfig(settingsCache.indicatorConfig);
  const precisionInsightsAllowed = (
    isPrecisionInsightsEnabledForHostname(resolvedHostname, settingsCache)
    && isPrecisionInsightsSignalEnabled(settingsCache, PRECISION_INSIGHTS_SIGNAL_IDS.CLSE)
  );
  const debugConfig = normalizeDebugConfig(settingsCache.debugConfig, {
    defaults: DEFAULT_DEBUG_CONFIG,
  });
  const indicatorEnabled =
    typeof indicatorConfig?.enabled === 'boolean' ? indicatorConfig.enabled : true;
  const policyPayload = buildProtectionPolicyPayload(policy);
  const basePayload = {
    type: MESSAGE_TYPES.PROTECTION_UPDATE,
    isBlockedDomain: dispatch.isBlockedDomain,
    precisionInsightsAllowed,
    hostname: resolvedHostname,
    indicatorConfig,
    debugConfig,
    indicatorEnabled,
    policy: policyPayload,
    releaseReason,
    globalSentinelOutcome,
  };
  const signature = JSON.stringify({
    url: resolvedUrl,
    blocked: dispatch.isBlockedDomain,
    shouldApply: dispatch.shouldApply,
    domainClassId: dispatch.domainClassId,
    precisionInsightsAllowed,
    indicatorConfig,
    debugConfig,
    policy: policyPayload,
    releaseReason,
    globalSentinelOutcome,
    plan,
    trace: toTraceSignature(trace),
  });

  return {
    basePayload,
    dispatch,
    envelope,
    envelopeResult,
    messageType: MESSAGE_TYPES.PROTECTION_UPDATE,
    payload: {
      ...basePayload,
      envelope,
    },
    policy: policyPayload,
    signature,
    traceId: dispatch.traceId,
  };
}
