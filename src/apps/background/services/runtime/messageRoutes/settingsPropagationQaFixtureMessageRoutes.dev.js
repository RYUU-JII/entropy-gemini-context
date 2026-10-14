import {
  SETTINGS_PROPAGATION_QA_ACTIONS,
  parseSettingsPropagationQaFixtureRequest,
  settingsPropagationQaError,
} from '../../../../../domains/settings/config/settingsPropagationQaFixtureContract.dev.js';
import { fetchPackagedExtensionAsset } from '../../../../../platform/extension/packagedAssetFetch.js';
import { getExtensionApi } from '../../../../../platform/extension/extensionApi.js';
import { callExtensionPromiseApi } from '../../../../../platform/extension/extensionApiCall.js';
import { assertTrustedQaAutomationHarnessSender } from '../../../../../platform/security/qaAutomationHarnessTrust.dev.js';

const SOURCE_TIMEOUT_MS = 2000;
const SOURCE_MAX_LENGTH = 32768;
const FAILURE_CODES = new Set([
  'REQUEST_INVALID', 'ACTION_INVALID', 'REQUEST_ID_INVALID', 'PAYLOAD_INVALID',
  'SEAL_INVALID', 'MODE_INVALID', 'KEYS_INVALID', 'LEASE_ID_INVALID',
  'OWNER_REQUIRED', 'SENDER_UNTRUSTED', 'SENDER_BINDING_INVALID',
  'HARNESS_TAB_UNAVAILABLE', 'HARNESS_SOURCE_INVALID', 'HARNESS_SOURCE_UNAVAILABLE',
  'HARNESS_DOCUMENT_UNAVAILABLE', 'HARNESS_DOCUMENT_MISMATCH',
  'HARNESS_SEAL_MISMATCH', 'LEASE_BUSY', 'LEASE_UNKNOWN', 'LEASE_FOREIGN',
].map(suffix => `SETTINGS_PROPAGATION_QA_${suffix}`));

function requireSourceSeal(source, payload) {
  if (typeof source !== 'string' || source.length > SOURCE_MAX_LENGTH) {
    throw settingsPropagationQaError('HARNESS_SOURCE_INVALID');
  }
  const expected = new Map([
    ['entropy-settings-propagation-qa', payload.nonce],
    ['entropy-settings-propagation-qa-profile', payload.profileKind],
    ['entropy-settings-propagation-qa-run', payload.runId],
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
    if (duplicate || attributes.size !== 2 || observed.has(name)
      || attributes.get('content') !== expected.get(name)) {
      throw settingsPropagationQaError('HARNESS_SEAL_MISMATCH');
    }
    observed.add(name);
  }
  if (observed.size !== expected.size) {
    throw settingsPropagationQaError('HARNESS_SEAL_MISMATCH');
  }
}

async function requireCopiedHarnessBinding({ browserPort, sender, payload, fetchFixtureSource }) {
  assertTrustedQaAutomationHarnessSender(sender, browserPort, {
    errorCode: 'SETTINGS_PROPAGATION_QA_SENDER_UNTRUSTED',
  });
  if (!Number.isSafeInteger(sender?.tab?.id) || sender.tab.id < 0
    || sender.frameId !== 0
    || typeof sender.documentId !== 'string' || !sender.documentId
    || sender.documentId.length > 256 || sender.documentId.trim() !== sender.documentId) {
    throw settingsPropagationQaError('SENDER_BINDING_INVALID');
  }
  const runtime = getExtensionApi()?.runtime;
  if (typeof runtime?.getURL !== 'function'
    || typeof runtime?.getContexts !== 'function'
    || typeof browserPort?.tabsGet !== 'function' || typeof fetchFixtureSource !== 'function') {
    throw settingsPropagationQaError('HARNESS_SOURCE_UNAVAILABLE');
  }
  const helperUrl = runtime.getURL('entropy-e2e.html');
  if (helperUrl !== `chrome-extension://${browserPort.getRuntimeId()}/entropy-e2e.html`
    || sender.url !== helperUrl) {
    throw settingsPropagationQaError('SENDER_UNTRUSTED');
  }
  const controller = new AbortController();
  let deadline;
  const timeout = new Promise((_, reject) => {
    deadline = setTimeout(() => {
      controller.abort();
      reject(settingsPropagationQaError('HARNESS_SOURCE_UNAVAILABLE'));
    }, SOURCE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const tab = await browserPort.tabsGet(sender.tab.id);
      if (tab?.id !== sender.tab.id || tab.url !== helperUrl) {
        throw settingsPropagationQaError('HARNESS_TAB_UNAVAILABLE');
      }
      const response = await fetchFixtureSource(helperUrl, {
        cache: 'no-store', signal: controller.signal,
      });
      if (response?.ok !== true || typeof response.text !== 'function') {
        throw settingsPropagationQaError('HARNESS_SOURCE_UNAVAILABLE');
      }
      requireSourceSeal(await response.text(), payload);
      const current = await browserPort.tabsGet(sender.tab.id);
      if (current?.id !== sender.tab.id || current.url !== helperUrl) {
        throw settingsPropagationQaError('HARNESS_TAB_UNAVAILABLE');
      }
      // A same-URL reload is a different grant. Native runtime contexts prove
      // the initiating document still exists after the asynchronous reads.
      const contexts = await callExtensionPromiseApi(runtime.getContexts, [{
        contextTypes: ['TAB'], tabIds: [sender.tab.id], frameIds: [0], documentIds: [sender.documentId],
      }], null, { thisArg: runtime });
      if (!Array.isArray(contexts)) throw settingsPropagationQaError('HARNESS_DOCUMENT_UNAVAILABLE');
      if (contexts.length !== 1 || contexts[0]?.contextType !== 'TAB'
        || contexts[0].tabId !== sender.tab.id || contexts[0].frameId !== 0
        || contexts[0].documentId !== sender.documentId || contexts[0].documentUrl !== helperUrl) {
        throw settingsPropagationQaError('HARNESS_DOCUMENT_MISMATCH');
      }
      if (controller.signal.aborted) throw settingsPropagationQaError('HARNESS_SOURCE_UNAVAILABLE');
      return Object.freeze({ nonce: payload.nonce, profileKind: payload.profileKind,
        runId: payload.runId, tabId: sender.tab.id, documentId: sender.documentId });
    })()]);
  } finally {
    clearTimeout(deadline);
  }
}

export function createSettingsPropagationQaFixtureMessageRoutes({
  browserPort,
  settingsPropagationQaFixture,
  fetchFixtureSource = (url, { signal }) => fetchPackagedExtensionAsset(url, {
    runtimeUrl: getExtensionApi()?.runtime?.getURL(''), signal, cache: 'no-store',
  }),
} = {}) {
  const actions = Object.create(null);
  for (const action of Object.values(SETTINGS_PROPAGATION_QA_ACTIONS)) {
    actions[action] = (message, sender, sendResponse) => {
      void (async () => {
        const request = parseSettingsPropagationQaFixtureRequest(message);
        if (request.action !== action) throw settingsPropagationQaError('ACTION_INVALID');
        if (typeof settingsPropagationQaFixture?.arm !== 'function'
          || typeof settingsPropagationQaFixture?.read !== 'function'
          || typeof settingsPropagationQaFixture?.release !== 'function') {
          throw settingsPropagationQaError('OWNER_REQUIRED');
        }
        const binding = await requireCopiedHarnessBinding({
          browserPort, sender, payload: request.payload, fetchFixtureSource,
        });
        const method = action === SETTINGS_PROPAGATION_QA_ACTIONS.ARM ? 'arm'
          : action === SETTINGS_PROPAGATION_QA_ACTIONS.READ ? 'read' : 'release';
        const lease = settingsPropagationQaFixture[method](request.payload, binding);
        sendResponse?.(Object.freeze({ ok: true, action, requestId: request.requestId, lease }));
      })().catch(error => {
        const code = FAILURE_CODES.has(error?.code) ? error.code : 'SETTINGS_PROPAGATION_QA_FAILED';
        const requestId = typeof message?.requestId === 'string'
          && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u.test(message.requestId) ? message.requestId : null;
        sendResponse?.(Object.freeze({ ok: false, action, requestId, error: code }));
      });
      return true;
    };
  }
  return { actions };
}
