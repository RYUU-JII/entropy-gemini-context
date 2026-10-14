import {
  GOAL_DELIVERY_QA_CHARGE_ACTION,
  GOAL_DELIVERY_QA_CHARGE_CONTRACT,
  goalDeliveryQaError,
  parseGoalDeliveryQaFixtureRequest,
} from '../../../../../domains/stats/contracts/goalDeliveryQaFixtureContract.dev.js';
import { fetchPackagedExtensionAsset } from '../../../../../platform/extension/packagedAssetFetch.js';
import { getExtensionApi } from '../../../../../platform/extension/extensionApi.js';
import { callExtensionPromiseApi } from '../../../../../platform/extension/extensionApiCall.js';
import { assertTrustedQaAutomationHarnessSender } from '../../../../../platform/security/qaAutomationHarnessTrust.dev.js';
import { isProfileResetWriteAdmissionClosed, resolveProfileResetGeneration } from '../../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import { createTrackingConsumptionScopeReader } from '../../../../../domains/tracking/background/trackingConsumptionScope.js';
import { resolveCollectionPolicySnapshot, resolveDomainUsageRecording } from '../../../../../domains/settings/config/dataCollectionPolicy.js';

function requireSourceSeal(source, payload) {
  if (typeof source !== 'string' || source.length > 32768) throw goalDeliveryQaError('HARNESS_SOURCE_INVALID');
  const expected = new Map([
    ['entropy-goal-delivery-qa', payload.nonce],
    ['entropy-goal-delivery-qa-profile', payload.profileKind],
    ['entropy-goal-delivery-qa-run', payload.runId],
    ['entropy-goal-delivery-qa-execution', payload.execution],
    ['entropy-goal-delivery-qa-target', payload.targetId],
    ['entropy-goal-delivery-qa-scope', payload.scope],
  ]);
  const observed = new Set();
  for (const match of source.matchAll(/<meta\b([^<>]*)>/giu)) {
    const attributes = new Map();
    let duplicate = false;
    for (const attribute of match[1].matchAll(/([a-z][a-z0-9-]*)\s*=\s*(["'])([^"']*)\2/giu)) {
      const name = attribute[1].toLowerCase();
      if (attributes.has(name)) duplicate = true;
      attributes.set(name, attribute[3]);
    }
    const name = attributes.get('name');
    if (!expected.has(name)) continue;
    if (duplicate || attributes.size !== 2 || observed.has(name) || attributes.get('content') !== expected.get(name)) {
      throw goalDeliveryQaError('HARNESS_SEAL_MISMATCH');
    }
    observed.add(name);
  }
  if (observed.size !== expected.size) throw goalDeliveryQaError('HARNESS_SEAL_MISMATCH');
}

async function requireCurrentHelperDocument(browserPort, sender, runtime, helperUrl) {
  const current = await browserPort.tabsGet(sender.tab.id);
  if (current?.id !== sender.tab.id || current.url !== helperUrl) throw goalDeliveryQaError('HARNESS_TAB_UNAVAILABLE');
  const contexts = await callExtensionPromiseApi(runtime.getContexts, [{
    contextTypes: ['TAB'], tabIds: [sender.tab.id], frameIds: [0], documentIds: [sender.documentId],
  }], null, { thisArg: runtime });
  if (!Array.isArray(contexts)) throw goalDeliveryQaError('HARNESS_DOCUMENT_UNAVAILABLE');
  if (contexts.length !== 1 || contexts[0]?.contextType !== 'TAB' || contexts[0].tabId !== sender.tab.id
    || contexts[0].frameId !== 0 || contexts[0].documentId !== sender.documentId || contexts[0].documentUrl !== helperUrl) {
    throw goalDeliveryQaError('HARNESS_DOCUMENT_MISMATCH');
  }
}

async function requireCopiedHelper({ browserPort, sender, payload, fetchFixtureSource }) {
  assertTrustedQaAutomationHarnessSender(sender, browserPort, { errorCode: 'GOAL_DELIVERY_QA_SENDER_UNTRUSTED' });
  if (!Number.isSafeInteger(sender?.tab?.id) || sender.tab.id < 0 || sender.frameId !== 0
    || typeof sender.documentId !== 'string' || !sender.documentId || sender.documentId.length > 256
    || sender.documentId.trim() !== sender.documentId) throw goalDeliveryQaError('SENDER_BINDING_INVALID');
  const runtime = getExtensionApi()?.runtime;
  if (typeof runtime?.getURL !== 'function' || typeof runtime?.getContexts !== 'function'
    || typeof browserPort.tabsGet !== 'function') throw goalDeliveryQaError('HARNESS_SOURCE_UNAVAILABLE');
  const helperUrl = runtime.getURL('entropy-e2e.html');
  if (helperUrl !== `chrome-extension://${browserPort.getRuntimeId()}/entropy-e2e.html` || sender.url !== helperUrl) {
    throw goalDeliveryQaError('SENDER_UNTRUSTED');
  }
  const controller = new AbortController();
  let deadline;
  try {
    await Promise.race([
      new Promise((_, reject) => {
        deadline = setTimeout(() => { controller.abort(); reject(goalDeliveryQaError('HARNESS_SOURCE_UNAVAILABLE')); }, 2000);
      }),
      (async () => {
        await requireCurrentHelperDocument(browserPort, sender, runtime, helperUrl);
        const response = await fetchFixtureSource(helperUrl, { cache: 'no-store', signal: controller.signal });
        if (response?.ok !== true || typeof response.text !== 'function') throw goalDeliveryQaError('HARNESS_SOURCE_UNAVAILABLE');
        requireSourceSeal(await response.text(), payload);
        await requireCurrentHelperDocument(browserPort, sender, runtime, helperUrl);
        if (controller.signal.aborted) throw goalDeliveryQaError('HARNESS_SOURCE_UNAVAILABLE');
      })(),
    ]);
  } finally {
    clearTimeout(deadline);
  }
  return () => requireCurrentHelperDocument(browserPort, sender, runtime, helperUrl);
}

export function createGoalDeliveryQaFixtureMessageRoutes({
  browserPort, statsCollector, statsRuntimeService, settingsService, runtimeSessionRepository, readProfileMutationLifecycle,
  fetchFixtureSource = (url, { signal }) => fetchPackagedExtensionAsset(url, {
    runtimeUrl: getExtensionApi()?.runtime?.getURL(''), signal, cache: 'no-store',
  }),
} = {}) {
  // There is no reusable grant or persisted fixture capability. Every write
  // proves the sealed copied helper, live document and generation independently.
  const attempted = new Set();
  const action = GOAL_DELIVERY_QA_CHARGE_ACTION;
  return { actions: { [action]: (message, sender, sendResponse) => {
    void (async () => {
      const request = parseGoalDeliveryQaFixtureRequest(message);
      const payload = request.payload;
      if (typeof statsCollector?.collectBatch !== 'function' || typeof statsRuntimeService?.runStatsMutationBatch !== 'function'
        || typeof settingsService?.getSettingsCache !== 'function' || typeof settingsService?.getCollectionAdmission !== 'function'
        || typeof settingsService?.getSettingsChangeVersion !== 'function' || typeof readProfileMutationLifecycle !== 'function') {
        throw goalDeliveryQaError('OWNER_REQUIRED');
      }
      const assertGeneration = async () => {
        const lifecycle = await readProfileMutationLifecycle();
        if (isProfileResetWriteAdmissionClosed(lifecycle)) throw goalDeliveryQaError('GENERATION_CLOSED');
        if (resolveProfileResetGeneration(lifecycle) !== payload.profileGeneration) throw goalDeliveryQaError('GENERATION_STALE');
      };
      await assertGeneration();
      const assertHelper = await requireCopiedHelper({ browserPort, sender, payload, fetchFixtureSource });
      await assertGeneration();
      const attemptId = `${payload.runId}:${sender.documentId}:${request.requestId}`;
      if (attempted.has(attemptId)) throw goalDeliveryQaError('REQUEST_ALREADY_ATTEMPTED');
      attempted.add(attemptId);
      const resolveScope = createTrackingConsumptionScopeReader({ sessionStore: runtimeSessionRepository });
      const receipt = await statsRuntimeService.runStatsMutationBatch(async ({ now: committedAt, dateStr }) => {
        if (!Number.isSafeInteger(committedAt) || committedAt <= 0
          || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(dateStr)) {
          throw goalDeliveryQaError('STATS_ADMISSION_INVALID');
        }
        const version = settingsService.getSettingsChangeVersion();
        const admission = settingsService.getCollectionAdmission();
        const settings = settingsService.getSettingsCache();
        if (admission.enabled !== true || !resolveDomainUsageRecording(payload.hostname, settings).enabled) {
          throw goalDeliveryQaError('RECORDING_NOT_ADMITTED');
        }
        const scope = await resolveScope({ hostname: payload.hostname, settings, now: committedAt });
        if (payload.protectedDeltaMs > 0 && (scope?.ok !== true || scope.isBlockedDomain !== true)) {
          throw goalDeliveryQaError('PROTECTION_NOT_ADMITTED');
        }
        const result = await statsCollector.collectBatch({ now: committedAt, dateStr, skipCacheLoad: true, requireDurableCommit: true }, async collection => {
          await assertGeneration();
          await assertHelper();
          const current = settingsService.getCollectionAdmission();
          if (!current.enabled || current.revision !== admission.revision || settingsService.getSettingsChangeVersion() !== version) {
            throw goalDeliveryQaError('RECORDING_ADMISSION_CHANGED');
          }
          if (typeof collection.recordGoalDeliveryQaCharge !== 'function') throw goalDeliveryQaError('STATS_FIXTURE_OWNER_REQUIRED');
          collection.ensureDomainTrackingState({ hostname: payload.hostname, now: committedAt,
            collectionPolicy: resolveCollectionPolicySnapshot(settings) });
          return collection.recordGoalDeliveryQaCharge(payload);
        });
        await assertGeneration();
        return Object.freeze({ contract: GOAL_DELIVERY_QA_CHARGE_CONTRACT, synthetic: true, naturalConsumptionObserved: false,
          runId: payload.runId, profileGeneration: payload.profileGeneration, hostname: payload.hostname,
          observedDeltaMs: payload.observedDeltaMs, protectedDeltaMs: payload.protectedDeltaMs, committedAt,
          calendarDateStr: result.dateStr, before: result.value.before, after: result.value.after });
      });
      sendResponse?.(Object.freeze({ ok: true, action, requestId: request.requestId, receipt }));
    })().catch(error => {
      const code = typeof error?.code === 'string' && /^GOAL_DELIVERY_QA_[A-Z_]{1,64}$/u.test(error.code)
        ? error.code : 'GOAL_DELIVERY_QA_FAILED';
      const requestId = typeof message?.requestId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u.test(message.requestId)
        ? message.requestId : null;
      sendResponse?.(Object.freeze({ ok: false, action, requestId, error: code }));
    });
    return true;
  } } };
}
