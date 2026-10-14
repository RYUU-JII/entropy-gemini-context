import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { installFaviconQaResponseDeliveryFixture } from './faviconQaResponseDeliveryFixture.mjs';
import { ExtensionChromiumHarness, evaluate, sleep, waitForPageReady } from '../../e2e/extensionChromiumHarness.mjs';
import { ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { sendTrustedRuntimeMessage, sendGateAutomation } from './gateRuntimeQaProtocol.mjs';
import { requireConsumptionQaSettingsAcknowledgement } from './consumptionEntryQaProtocol.mjs';
import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';
import { STORAGE_SUPPORT_TASKS } from '../../../src/platform/storage/support/storageSupportTaskContract.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../src/domains/settings/config/index.js';
import { DEFAULT_GATE_CONFIG } from '../../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../src/domains/settings/config/nudgeConfig.js';
import { GATE_QA_AUTOMATION_ACTIONS } from '../../../src/domains/protection/background/automation/gateQaAutomationContract.dev.js';
import { requireIntegratedDisposableFixtureOwner } from './integratedSettingsLifecycleFixture.mjs';
import { requireEntropyAttachedArtifactRuntimeIdentity, requireEntropyTrackingRuntimeReadiness } from './attachOnlyActivePageAdapter.mjs';
import { normalizeChromiumHarnessTemporaryManifest } from '../../e2e/chromiumHarnessManifestPromotion.mjs';

export const FAVICON_QA_HOST = 'favicon.localhost';
// These observations cross the real content-message boundary, but must never
// become a network destination. They are never inserted into the page DOM.
export const FAVICON_QA_SYNTHETIC_ICON_URLS = Object.freeze([
  'https://favicon-egress.invalid/observed-icon.png?fixture=synthetic',
  'https://favicon-egress.invalid/observed-race.png?fixture=synthetic',
]);
export function createFaviconQaLocalCacheUrl(extensionId, pageUrl) {
  requireProof(typeof extensionId === 'string' && /^[a-z0-9-]+$/u.test(extensionId), 'EXTENSION_ID_REQUIRED');
  let page;
  try { page = new URL(pageUrl); } catch { requireProof(false, 'LOCAL_FIXTURE_URL_REQUIRED'); }
  requireProof(page.protocol === 'http:' && page.hostname === FAVICON_QA_HOST && page.port
    && page.pathname === '/' && !page.search && !page.hash && !page.username && !page.password,
  'LOCAL_FIXTURE_URL_REQUIRED');
  return `chrome-extension://${extensionId}/_favicon/?pageUrl=${encodeURIComponent(page.href)}&size=64`;
}

export function requireFaviconQaNoEgress({ localCacheUrl, requests, externalRequests, observedLocalRequestIds,
  localReadCompletions, nativeReads, expectedNativeSha256, expectedLocalReads }) {
  requireProof(Array.isArray(externalRequests) && externalRequests.length === 0, 'REMOTE_WORKER_REQUEST_FORBIDDEN');
  requireProof(Array.isArray(requests) && Number.isInteger(expectedLocalReads) && expectedLocalReads > 0
    && requests.length === expectedLocalReads
    && requests.every(request => request.url === localCacheUrl && request.method === 'GET'),
  'EXACT_LOCAL_CACHE_REQUEST_REQUIRED');
  requireProof(observedLocalRequestIds instanceof Set && observedLocalRequestIds.size === expectedLocalReads
    && requests.every(request => observedLocalRequestIds.has(request.networkId)), 'LOCAL_NETWORK_OBSERVATION_REQUIRED');
  requireProof(localReadCompletions instanceof Map && requests.every(request => {
    const completion = localReadCompletions.get(request.networkId);
    return completion?.finished === true && completion.failed === false;
  }), 'SUCCESSFUL_LOCAL_NETWORK_READ_REQUIRED');
  requireProof(typeof expectedNativeSha256 === 'string' && /^[a-f0-9]{64}$/u.test(expectedNativeSha256)
    && Array.isArray(nativeReads) && nativeReads.length === expectedLocalReads
    && nativeReads.every((read, index) => read.sequence === index + 1 && read.status === 200
      && read.pngSignature === true && read.byteCount > 45 && read.byteCount <= 256 * 1024
      && read.sha256 === expectedNativeSha256 && read.originalResponseUntouched === true
      && read.originalResponseReused === true && ['delivered', 'released'].includes(read.state)),
  'VALID_NATIVE_LOCAL_RESPONSE_REQUIRED');
  return { localCacheReads: requests.length, observedLocalNetworkReads: observedLocalRequestIds.size,
    nativeResponseReads: nativeReads.length, nativePngSha256: expectedNativeSha256,
    externalWorkerRequests: 0, syntheticIconRequests: 0, observedWorkerOnly: true };
}

// Failure evidence deliberately excludes request URLs, response bodies, console
// text and CSP blockedURI/originalPolicy, which can contain unrelated private data.
export function summarizeFaviconQaCapture({ response, elapsedMs, requests, externalRequests,
  observedLocalRequestIds, localReadCompletions, localResponses = [], policyViolations = [], unscopedNetworkFailures = 0 }) {
  const token = value => typeof value === 'string' && /^[a-z-]{1,40}$/u.test(value) ? value : null;
  const completions = [...localReadCompletions.values()];
  return {
    response: { type: response === null ? 'null' : typeof response,
      success: typeof response?.success === 'boolean' ? response.success : null,
      captured: typeof response?.captured === 'boolean' ? response.captured : null,
      errorPresent: typeof response?.error === 'string' && response.error.length > 0 },
    elapsedMs,
    localCacheReads: requests.length,
    observedLocalNetworkReads: observedLocalRequestIds.size,
    externalWorkerRequests: externalRequests.length,
    localNetworkCompletions: completions.slice(0, 8).map(completion => ({
      finished: completion.finished === true, failed: completion.failed === true,
      blockedReason: token(completion.blockedReason),
      networkError: typeof completion.errorText === 'string' && /^net::ERR_[A-Z0-9_]+$/u.test(completion.errorText)
        ? completion.errorText : null,
      canceled: completion.canceled === true,
    })),
    unscopedNetworkFailures,
    localResponses,
    cspViolations: policyViolations.slice(0, 8).map(violation => ({
      effectiveDirective: token(violation.effectiveDirective), disposition: token(violation.disposition),
    })),
  };
}

export function summarizeFaviconQaLocalResponse(response, { servedFromCache = false,
  bodyResult = null, bodyReadFailed = false } = {}) {
  const mime = value => {
    if (typeof value !== 'string' || value.length > 100) return null;
    const type = value.split(';')[0].trim().toLowerCase();
    return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/u.test(type) ? type : null;
  };
  const contentType = Object.entries(response?.headers || {}).find(([key]) => key.toLowerCase() === 'content-type')?.[1];
  let body = { available: false, readFailed: bodyReadFailed, byteCount: null, pngSignature: null };
  if (typeof bodyResult?.body === 'string' && bodyResult.body.length <= 1024 * 1024) {
    const bytes = Buffer.from(bodyResult.body, bodyResult.base64Encoded === true ? 'base64' : 'utf8');
    body = { available: true, readFailed: false, byteCount: bytes.length,
      pngSignature: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) };
  }
  return { status: Number.isInteger(response?.status) ? response.status : null,
    mimeType: mime(response?.mimeType), contentType: mime(contentType),
    servedFromCache: servedFromCache === true,
    fromDiskCache: response?.fromDiskCache === true, fromServiceWorker: response?.fromServiceWorker === true,
    fromPrefetchCache: response?.fromPrefetchCache === true, body };
}
function requireProof(value, code) {
  if (!value) { const error = new Error(`QA_FAVICON_${code}`); error.code = error.message; throw error; }
}

export function requireFaviconQaPlan({ plan, artifact, browser }) {
  requireProof(plan?.target?.id === 'assets/favicon' && plan.target.protocolId === 'favicon_cache'
    && plan.target.environmentId === 'ephemeral' && plan.mode === 'agent'
    && artifact?.id === 'dev_extension' && artifact.releaseProfile === 'dev'
    && browser?.processOwnership === 'owned' && plan.browserExecution?.processOwnership === 'owned'
    && plan.browserExecution.osFocus === 'never' && plan.browserExecution.targetActivation === 'active'
    && plan.browserExecution.documentVisibility === 'visible_required'
    && plan.protocolOptions?.fixturePolicy === 'owned_ephemeral_favicon'
    && plan.protocolOptions.networkPolicy === 'exact_local_favicon_cache_no_egress'
    && plan.protocolOptions.responseDeliveryPolicy === 'owned_native_response_delay', 'OWNED_DEV_REQUIRED');
  return true;
}

// A real, decodable 32px PNG keeps the browser image and MIME checks in the measured path.
export function createFaviconQaImage(red, green, blue) {
  const chunk = (type, bytes) => {
    const body = Buffer.concat([Buffer.from(type), bytes]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const header = Buffer.alloc(4); header.writeUInt32BE(bytes.length);
    const trailer = Buffer.alloc(4); trailer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([header, body, trailer]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(32, 0); header.writeUInt32BE(32, 4);
  header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc(32 * (1 + 32 * 3));
  for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
    const offset = y * 97 + 1 + x * 3;
    pixels.set((x < 8 || y < 8) ? [255, 255, 255] : [red, green, blue], offset);
  }
  const bytes = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
  return { bytes, dataUrl: `data:image/png;base64,${bytes.toString('base64')}` };
}

export function renderFaviconQaFixture(dataUrl, { nativeIconUrl = null } = {}) {
  requireProof(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/u.test(dataUrl), 'FIXTURE_PNG_REQUIRED');
  if (nativeIconUrl !== null) {
    let icon;
    try { icon = new URL(nativeIconUrl); } catch { requireProof(false, 'FIXTURE_NATIVE_ICON_REQUIRED'); }
    requireProof(icon.protocol === 'http:' && icon.hostname === FAVICON_QA_HOST && icon.port
      && icon.pathname === '/native-icon.png' && !icon.search && !icon.hash && !icon.username && !icon.password,
    'FIXTURE_NATIVE_ICON_REQUIRED');
  }
  const iconHref = nativeIconUrl === null ? dataUrl : nativeIconUrl;
  return `<!doctype html><meta charset="utf-8"><title>Favicon lifecycle QA</title>
<link id="qa-icon" rel="icon" sizes="32x32" href="${iconHref}">
<style>body{background:#17202a;color:white;font:18px sans-serif;margin:40px}</style>
<h1>Favicon lifecycle fixture</h1><p>Native icon discovery and a controlled page-owned icon change.</p>`;
}

export async function createFaviconQaFixture(image) {
  let nativeImage = null; let nativeIconRequests = 0;
  let nativeIconUrl = null;
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.hostname !== FAVICON_QA_HOST) { response.writeHead(403); response.end(); return; }
    if (url.pathname === '/native-icon.png' && !url.search && nativeImage) {
      nativeIconRequests += 1;
      response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      response.end(nativeImage.bytes); return;
    }
    if (url.pathname !== '/') { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(renderFaviconQaFixture(image.dataUrl, { nativeIconUrl }));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const ownedNativeIconUrl = `http://${FAVICON_QA_HOST}:${server.address().port}/native-icon.png`;
  return { url: `http://${FAVICON_QA_HOST}:${server.address().port}/`,
    nativeIconUrl: ownedNativeIconUrl,
    prepareNativeImage: nextImage => { nativeImage = nextImage; nativeIconUrl = ownedNativeIconUrl; },
    nativeIconRequestCount: () => nativeIconRequests,
    close: () => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve({ closed: true })); server.closeAllConnections();
    }) };
}

export function requireFaviconQaImage(state, { expectedDataUrl = null } = {}) {
  requireProof(state?.complete === true && state.naturalWidth > 4 && state.naturalHeight > 4
    && state.width > 0 && state.height > 0 && state.opacity > 0
    && state.visibility === 'visible' && state.display !== 'none' && state.unobscured === true, 'USABLE_IMAGE_REQUIRED');
  if (expectedDataUrl !== null) requireProof(state.src === expectedDataUrl, 'PERSISTED_IMAGE_SOURCE_REQUIRED');
  return state;
}

export function requireFaviconQaReuse(before, after, localReadsBefore, localReadsAfter) {
  requireProof(before?.dataUrl && before.dataUrl === after?.dataUrl
    && Number.isFinite(before.updatedAt) && before.updatedAt === after.updatedAt, 'REVISIT_REWROTE_STORAGE');
  requireProof(localReadsBefore === localReadsAfter, 'REVISIT_READ_CACHE_AGAIN');
  return { updatedAt: after.updatedAt, localCacheReads: localReadsAfter - localReadsBefore };
}

export function requireFaviconQaNativeSourceRebind({ capture, cache, nativeIconUrl, expectedDataUrl, localCacheReads }) {
  requireProof(capture?.success === true && capture.captured === true
    && cache?.cached?.sourceUrl === nativeIconUrl && cache.cached.dataUrl === expectedDataUrl
    && cache.stored?.dataUrl === expectedDataUrl && localCacheReads === 2, 'NATIVE_SOURCE_REBIND_REQUIRED');
  return { sourceUrl: nativeIconUrl, localCacheReads, durableBytesPreserved: true };
}

export function requireFaviconQaClearRace({ capture, stored, dataUrl, cacheRead, delivery, maxHoldMs, holdMs }) {
  requireProof(cacheRead?.finished === true && cacheRead.failed !== true && holdMs >= 0 && holdMs < 2500,
    'RACE_SUCCESSFUL_LOCAL_READ_REQUIRED');
  requireProof(Number.isInteger(maxHoldMs) && maxHoldMs > 0 && maxHoldMs <= 1500 && holdMs < maxHoldMs
    && delivery?.state === 'released' && delivery.releasedAfterClearAck === true
    && delivery.originalResponseUntouched === true && delivery.originalResponseReused === true
    && delivery.status === 200 && delivery.pngSignature === true, 'RACE_ORIGINAL_RESPONSE_DELIVERY_REQUIRED');
  requireProof(capture?.success === true && capture.captured === false && stored === null && dataUrl === '',
    'CLEAR_REVIVED_CAPTURE');
  return { fenced: true, holdMs, localCacheReadFinished: true, originalResponseDeliveredAfterClear: true,
    fixtureBoundary: 'native_response_delivery' };
}

export async function executeQaProtocol({ plan, artifact, browser, evidence, attachmentsDir,
  registerCleanup, reportBrowserGpuCapability, signal, recoveryJournal }) {
  requireFaviconQaPlan({ plan, artifact, browser });
  const images = [createFaviconQaImage(22, 163, 74), createFaviconQaImage(37, 99, 235), createFaviconQaImage(234, 88, 12)];
  const fixture = await createFaviconQaFixture(images[0]); registerCleanup('favicon_fixture', fixture.close);
  const temporaryManifest = normalizeChromiumHarnessTemporaryManifest({ requiredPermissions: ['scripting'],
    requiredHostPermissions: [`http://${FAVICON_QA_HOST}/*`] });
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome, distDir: artifact.path,
    rootDir: plan.rootDir, headless: plan.browserExecution.headless, browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy, launchEnvironment: browser.launchEnvironment, displayReceipt: browser.display,
    renderingRequirement: plan.browserExecution.renderingRequirement, keepTemp: false,
    temporaryManifest, trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, tempPrefix: 'entropy-favicon-', recoveryJournal });
  registerCleanup('favicon_browser', () => harness.close());
  const trace = [];
  const reportState = { status: 'RUNNING', targetId: plan.target.id, buildId: artifact.buildId, verdictScope: 'product' };
  const reportJsonPath = path.join(attachmentsDir, 'favicon-cache.json');
  registerCleanup('favicon_trace', async () => {
    await fs.writeFile(reportJsonPath, JSON.stringify({ schemaVersion: 2, ...reportState,
      transport: 'Native loopback HTTP favicon warms Chrome local DB; actual own-extension _favicon GET/PNG bytes are independently observed through Network and a scoped original-Response delivery fixture. Clear is ordered before returning one unchanged native Response, not by network interception. Synthetic icon observations must cause zero external worker requests; observed worker/fixture phase only.', trace }, null, 2));
    return { samples: trace.length };
  });
  async function record(label, value) {
    trace.push({ label, value }); await evidence.event('QA_FAVICON_BOUNDARY', { label, value });
    console.log(JSON.stringify({ event: 'QA_FAVICON_PROGRESS', label })); return value;
  }
  async function until(label, read, accept, timeout = 15000) {
    let value; const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      signal?.throwIfAborted(); value = await read();
      if (accept(value)) return value;
      await sleep(100);
    }
    await record(`${label}_timeout`, value); throw new Error(`QA_FAVICON_TIMEOUT:${label}`);
  }
  try {
  await harness.start(); requireIntegratedDisposableFixtureOwner(harness);
  await reportBrowserGpuCapability(harness.gpuCapability);
  const expectedBuild = { buildId: artifact.buildId, releaseProfile: artifact.releaseProfile };
  const extensionUrl = suffix => `chrome-extension://${harness.extensionId}/src/pages/${suffix}`;
  const verifyArtifactIdentity = () => requireEntropyAttachedArtifactRuntimeIdentity(harness, {
    artifactIdentity: { artifactId: artifact.id, inputDigest: artifact.inputDigest, ...expectedBuild },
    temporaryManifest, trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH });
  async function verifyRuntime(label) {
    const identity = await verifyArtifactIdentity();
    const readiness = await requireEntropyTrackingRuntimeReadiness(harness, { expectedBuild });
    await record(label, { identity, readiness });
  }
  await record('initial_artifact_identity', await verifyArtifactIdentity());
  const dashboard = await harness.openPage(extensionUrl('dashboard.html?tab=sites'), { active: true });
  requireIntegratedDisposableFixtureOwner(harness);
  // Canonical status admission prepares a fresh automatic local keyring.
  // This fixture must not opt the disposable profile into passphrase protection.
  const vaultSetup = await evaluate(harness.cdp, dashboard.sessionId, `(async () => {
    if (location.origin !== ${JSON.stringify(`chrome-extension://${harness.extensionId}`)}
      || location.pathname !== '/src/pages/dashboard.html') throw new Error('QA_FAVICON_VAULT_DASHBOARD_REQUIRED');
    const send = request => new Promise((resolve, reject) => chrome.runtime.sendMessage(request, response => {
      if (chrome.runtime.lastError) reject(new Error('QA_FAVICON_VAULT_MESSAGE_FAILED'));
      else resolve(response);
    }));
    const statusAction = ${JSON.stringify(MESSAGE_ACTIONS.GET_SECURITY_VAULT_STATUS)};
    const ready = await send({ action: statusAction });
    if (ready?.success !== true || ready.status?.version !== 1 || ready.status.state !== 'unlocked'
      || ready.status.mode !== 'local') throw new Error('QA_FAVICON_VAULT_AUTOMATIC_LOCAL_REQUIRED');
    return { state: ready.status.state, mode: ready.status.mode, version: ready.status.version,
      preparation: 'Canonical Dashboard status admission with automatic local keys' };
  })()`, { timeoutMs: 30000 });
  await record('disposable_vault_setup', vaultSetup);
  await verifyRuntime('initial_runtime_ready');
  const message = request => sendTrustedRuntimeMessage(harness, request);
  async function inspect() {
    const response = await message({ action: MESSAGE_ACTIONS.DEBUG_INSPECT_FAVICON, domain: FAVICON_QA_HOST });
    requireProof(response?.success === true, 'INSPECT_ACK_REQUIRED'); return response;
  }
  async function query() {
    const response = await message({ action: MESSAGE_ACTIONS.GET_FAVICON_DATA, domain: FAVICON_QA_HOST });
    if (response?.success !== true || typeof response.dataUrl !== 'string') {
      await record('query_ack_failure', { action: MESSAGE_ACTIONS.GET_FAVICON_DATA,
        domain: FAVICON_QA_HOST, response: { type: response === null ? 'null' : typeof response,
          success: response?.success ?? null, error: typeof response?.error === 'string' ? response.error.slice(0, 2000) : null,
          dataUrlType: typeof response?.dataUrl } });
    }
    requireProof(response?.success === true && typeof response.dataUrl === 'string', 'QUERY_ACK_REQUIRED');
    return response.dataUrl;
  }
  async function clear() {
    const response = await message({ action: MESSAGE_ACTIONS.RUN_STORAGE_SUPPORT_ACTION,
      task: STORAGE_SUPPORT_TASKS.CLEAR_FAVICON_CACHE });
    requireProof(response?.success === true && response.result?.cleared === true, 'CLEAR_ACK_REQUIRED');
    return response;
  }
  requireProof((await query()) === '' && (await inspect()).stored === null, 'COLD_CACHE_NOT_EMPTY');
  const settings = { 'app-theme': 'matrix', filteringMode: 'blocklist', rulesMode: 'managed',
    dataCollectionMode: 'all_sites_minimal', insightsConsent: 'all_sites',
    filterSettings: Object.fromEntries(Object.entries(structuredClone(CONFIG_DEFAULT_FILTER_SETTINGS))
      .map(([key, value]) => [key, { ...value, isActive: false }])),
    nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS), gateConfig: structuredClone(DEFAULT_GATE_CONFIG) };
  requireConsumptionQaSettingsAcknowledgement(await message({ action: MESSAGE_ACTIONS.SET_SETTINGS,
    items: settings, waitForPropagation: true }), settings);
  const rule = await message({ action: MESSAGE_ACTIONS.UPSERT_SITE_RULE, domain: FAVICON_QA_HOST,
    type: 'blocked', waitForPropagation: true });
  requireProof(rule?.success === true && rule.propagation?.status === 'succeeded', 'SITE_RULE_ACK_REQUIRED');
  const page = await harness.openPage(fixture.url, { active: true });
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(page);
  async function nativeObservation() {
    const observedAt = Date.now();
    const [cache, tab, document] = await Promise.all([inspect(), harness.resolveTabForPage(page),
      evaluate(harness.cdp, page.sessionId, `({ readyState: document.readyState,
        iconHref: document.querySelector('#qa-icon')?.href || null })`)]);
    requireProof(tab?.url === fixture.url, 'OBSERVATION_FIXTURE_TAB_REQUIRED');
    const favicon = typeof tab.favIconUrl === 'string' ? tab.favIconUrl : '';
    let fixtureIcon = favicon === '' || (favicon.startsWith('data:image/png;base64,') && favicon.length <= 4096);
    if (!fixtureIcon) {
      try { fixtureIcon = new URL(favicon).hostname === FAVICON_QA_HOST; } catch { fixtureIcon = false; }
    }
    return { observedAt, cache, document, tab: { id: tab.id, status: tab.status, active: tab.active,
      faviconUrl: fixtureIcon ? favicon : '[outside fixture scope]', faviconUrlLength: favicon.length } };
  }
  const initial = await until('native_content_capture', inspect, value => value.stored?.dataUrl === images[0].dataUrl);
  await record('native_content_capture', { ...initial, dataUrl: await query() });
  const beforeRevisit = await nativeObservation();
  await record('native_initial_settling_observation', { firstCommitted: initial, observation: beforeRevisit });
  await harness.reloadPage(page);
  await until('revisit_content_ready', () => evaluate(harness.cdp, page.sessionId,
    'document.readyState === "complete" && !!document.querySelector("#qa-icon")'), Boolean);
  await record('native_revisit_document_ready', await nativeObservation());
  await sleep(400);
  const afterRevisit = await nativeObservation();
  await record('native_revisit_comparison', { before: initial, beforeRevisit, afterRevisit });
  await record('native_revisit', requireFaviconQaReuse(initial.stored, afterRevisit.cache.stored, 0, 0));
  const previousWorker = await harness.stopServiceWorker();
  await verifyRuntime('restarted_runtime_ready');
  requireProof(await query() === images[0].dataUrl, 'DURABLE_RESTART_QUERY_FAILED');
  const worker = await harness.waitForServiceWorker({ previousTargetId: previousWorker.targetId });
  await record('durable_worker_restart', { previousTargetId: previousWorker.targetId, targetId: worker.targetId,
    reuse: requireFaviconQaReuse(initial.stored, (await inspect()).stored, 0, 0) });

  // These are normal content-tab messages. The isolated execution is only used
  // to await deterministic local-cache acknowledgements; native discovery above and below is untouched.
  async function capture(iconUrl) {
    requireIntegratedDisposableFixtureOwner(harness);
    const request = { action: MESSAGE_ACTIONS.CAPTURE_FAVICON, pageUrl: fixture.url, iconUrls: [iconUrl] };
    const response = await harness.evaluateInTrustedPage(`chrome.scripting.executeScript({
      target: { tabId: ${page.tabId}, frameIds: [0] }, world: 'ISOLATED',
      func: async (request) => chrome.runtime.sendMessage(request), args: [${JSON.stringify(request)}]
    }).then(results => results[0].result)`, { timeoutMs: 15000 });
    requireProof(response?.success === true, 'CONTENT_CAPTURE_ACK_REQUIRED'); return response;
  }
  await capture(images[0].dataUrl);
  await evaluate(harness.cdp, page.sessionId, `document.querySelector('#qa-icon').href = ${JSON.stringify(images[1].dataUrl)}`);
  const changed = await until('native_changed_icon', inspect, value => value.stored?.dataUrl === images[1].dataUrl);
  requireProof(changed.stored.updatedAt > initial.stored.updatedAt, 'CHANGED_ICON_NOT_COMMITTED');
  await record('native_changed_icon', changed);

  // Keep subsequent native observations aligned with the local-cache fixture bytes.
  // Await the real page mutation before sending synthetic remote icon observations.
  await evaluate(harness.cdp, page.sessionId, `document.querySelector('#qa-icon').href = ${JSON.stringify(images[2].dataUrl)}`);
  const cacheFixtureIcon = await until('native_local_cache_fixture_icon', inspect,
    value => value.stored?.dataUrl === images[2].dataUrl);
  await record('native_local_cache_fixture_icon', cacheFixtureIcon);

  // Native HTTP discovery warms Chrome's own favicon DB. A separate exact
  // extension-page read proves the selected pixels before the worker phase;
  // neither source is synthesized by the response-delivery fixture below.
  fixture.prepareNativeImage(images[2]);
  await evaluate(harness.cdp, page.sessionId,
    `document.querySelector('#qa-icon').href = ${JSON.stringify(fixture.nativeIconUrl)}`);
  const localCacheUrl = createFaviconQaLocalCacheUrl(harness.extensionId, fixture.url);
  let warmReadAttempts = 0;
  async function readNativeCachePreparation() {
    requireIntegratedDisposableFixtureOwner(harness); warmReadAttempts += 1;
    return harness.evaluateInTrustedPage(`(async () => {
      const response = await fetch(${JSON.stringify(localCacheUrl)}, { method: 'GET', cache: 'no-store',
        credentials: 'same-origin', redirect: 'error', referrerPolicy: 'no-referrer' });
      if (!response.ok) return { ready: false, status: response.status };
      const bytes = new Uint8Array(await response.arrayBuffer());
      const pngSignature = [137,80,78,71,13,10,26,10].every((byte,index) => bytes[index] === byte);
      if (!pngSignature || bytes.length < 45 || bytes.length > 256 * 1024)
        return { ready: false, status: response.status, byteCount: bytes.length, pngSignature };
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      try {
        if (!bitmap.width || !bitmap.height || bitmap.width > 256 || bitmap.height > 256)
          throw new Error('QA_FAVICON_WARM_IMAGE_SIZE_INVALID');
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
        const center = [...context.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data];
        const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
          .map(byte => byte.toString(16).padStart(2,'0')).join('');
        return { ready: center.every((value,index) => value === [234,88,12,255][index]), status: response.status,
          byteCount: bytes.length, pngSignature, sha256, width: bitmap.width, height: bitmap.height, center };
      } finally { bitmap.close(); }
    })()`, { timeoutMs: 5000 });
  }
  const warmedNative = await until('native_http_cache_warm', readNativeCachePreparation,
    value => value.ready === true && fixture.nativeIconRequestCount() > 0);
  await record('native_http_cache_warmed', { ...warmedNative, warmReadAttempts,
    nativeIconRequests: fixture.nativeIconRequestCount(), preparationScope: 'owned_extension_page_before_worker_observation' });
  await clear();
  requireProof(await query() === '' && (await inspect()).stored === null, 'LOCAL_PHASE_CACHE_CLEAR_REQUIRED');

  requireIntegratedDisposableFixtureOwner(harness);
  requireProof(worker.type === 'service_worker'
    && worker.url === `chrome-extension://${harness.extensionId}/service-worker-loader.js`, 'EXACT_WORKER_REQUIRED');
  const attached = await harness.cdp.send('Target.attachToTarget', { targetId: worker.targetId, flatten: true });
  const workerSession = attached.sessionId;
  requireProof(typeof workerSession === 'string', 'WORKER_SESSION_REQUIRED');
  const requests = [];
  const localReadCompletions = new Map();
  const localResponses = new Map();
  const servedFromCacheRequestIds = new Set();
  let unscopedNetworkFailures = 0;
  const externalRequests = [];
  const observedLocalRequestIds = new Set();
  const pendingInterceptions = new Set();
  let interceptionError = null; let interceptionEnabled = false; let cacheDisabled = false;
  const policyObserverKey = `__entropyFaviconQaPolicy_${Date.now()}`;
  let policyObserverInstalled = false;
  const deliveryKey = `__entropyFaviconQaDelivery_${Date.now().toString(36)}`;
  let deliveryInstalled = false; let deliveryCleanup = null;
  const deliverySnapshot = () => evaluate(harness.cdp, workerSession,
    `globalThis[${JSON.stringify(deliveryKey)}].snapshot()`);
  const trackInterception = operation => {
    const pending = operation.catch(error => { if (!interceptionError) interceptionError = error; });
    pendingInterceptions.add(pending);
    void pending.then(() => pendingInterceptions.delete(pending));
  };
  const unsubscribers = [
    harness.cdp.subscribe('Fetch.requestPaused', event => {
      if (event.sessionId !== workerSession) return;
      const request = event.params;
      if (FAVICON_QA_SYNTHETIC_ICON_URLS.includes(request.request.url)) {
        externalRequests.push({ source: 'fetch_interception', syntheticIcon: true });
        interceptionError = new Error('QA_FAVICON_REMOTE_WORKER_REQUEST_FORBIDDEN');
      } else interceptionError = new Error('QA_FAVICON_INTERCEPTION_SCOPE_VIOLATION');
      trackInterception(harness.cdp.send('Fetch.failRequest',
        { requestId: request.requestId, errorReason: 'BlockedByClient' }, workerSession));
    }),
    harness.cdp.subscribe('Network.requestWillBeSent', event => {
      if (event.sessionId !== workerSession) return;
      const url = event.params.request?.url;
      if (url === localCacheUrl) {
        observedLocalRequestIds.add(event.params.requestId);
        requests.push({ networkId: event.params.requestId, url, method: event.params.request.method }); return;
      }
      if (typeof url !== 'string' || !/^https?:/u.test(url)) return;
      // Record only scoped classification, never an unexpected URL's private query.
      externalRequests.push({ source: 'network_observation',
        syntheticIcon: FAVICON_QA_SYNTHETIC_ICON_URLS.includes(url) });
      interceptionError = new Error('QA_FAVICON_REMOTE_WORKER_REQUEST_FORBIDDEN');
    }),
    harness.cdp.subscribe('Network.responseReceived', event => {
      if (event.sessionId === workerSession && observedLocalRequestIds.has(event.params.requestId)
        && event.params.response?.url === localCacheUrl) localResponses.set(event.params.requestId, event.params.response);
    }),
    harness.cdp.subscribe('Network.requestServedFromCache', event => {
      if (event.sessionId === workerSession && observedLocalRequestIds.has(event.params.requestId))
        servedFromCacheRequestIds.add(event.params.requestId);
    }),
    harness.cdp.subscribe('Network.loadingFinished', event => {
      if (event.sessionId === workerSession && observedLocalRequestIds.has(event.params.requestId))
        localReadCompletions.set(event.params.requestId, { finished: true, failed: false });
    }),
    harness.cdp.subscribe('Network.loadingFailed', event => {
      if (event.sessionId !== workerSession) return;
      if (!observedLocalRequestIds.has(event.params.requestId)) { unscopedNetworkFailures += 1; return; }
      localReadCompletions.set(event.params.requestId, { finished: false, failed: true,
        errorText: event.params.errorText, blockedReason: event.params.blockedReason, canceled: event.params.canceled });
    }),
  ];
  registerCleanup('favicon_interception', async () => {
    const errors = [];
    const attempt = async operation => { try { await operation(); } catch (error) { errors.push(error); } };
    if (deliveryInstalled) await attempt(async () => {
      deliveryCleanup = await evaluate(harness.cdp, workerSession,
        `globalThis[${JSON.stringify(deliveryKey)}].restore()`, { timeoutMs: 4000 });
      requireProof(deliveryCleanup?.originalDescriptorRestored === true && deliveryCleanup.restored === true,
        'RESPONSE_DELIVERY_RESTORE_REQUIRED');
      deliveryInstalled = false;
    });
    if (interceptionEnabled) await attempt(() => harness.cdp.send('Fetch.disable', {}, workerSession));
    await Promise.all([...pendingInterceptions]);
    if (interceptionError) errors.push(interceptionError);
    if (cacheDisabled) await attempt(async () => {
      await harness.cdp.send('Network.setCacheDisabled', { cacheDisabled: false }, workerSession); cacheDisabled = false;
    });
    await attempt(() => harness.cdp.send('Network.disable', {}, workerSession));
    if (policyObserverInstalled) await attempt(() => evaluate(harness.cdp, workerSession, `(() => {
      const key = ${JSON.stringify(policyObserverKey)}; const observer = globalThis[key];
      if (!observer) throw new Error('QA_FAVICON_POLICY_OBSERVER_MISSING');
      globalThis.removeEventListener('securitypolicyviolation', observer.listener);
      delete globalThis[key]; return true;
    })()`));
    for (const unsubscribe of unsubscribers) await attempt(unsubscribe);
    await attempt(() => harness.cdp.send('Target.detachFromTarget', { sessionId: workerSession }));
    if (errors.length) throw new AggregateError(errors, 'QA_FAVICON_INTERCEPTION_CLEANUP_FAILED');
    return { detached: true, localCacheUrl, syntheticRemoteUrlsBlocked: FAVICON_QA_SYNTHETIC_ICON_URLS,
      localCacheReads: requests.length, externalWorkerRequests: externalRequests.length, workerCacheRestored: !cacheDisabled,
      responseDelivery: deliveryCleanup };
  });
  const diagnosticWorker = await evaluate(harness.cdp, workerSession, `(() => {
    const key = ${JSON.stringify(policyObserverKey)};
    if (Object.prototype.hasOwnProperty.call(globalThis, key)) throw new Error('QA_FAVICON_POLICY_OBSERVER_EXISTS');
    const violations = [];
    const listener = event => {
      if (violations.length < 8) violations.push({ effectiveDirective: event.effectiveDirective, disposition: event.disposition });
    };
    Object.defineProperty(globalThis, key, { value: { listener, violations }, configurable: true });
    globalThis.addEventListener('securitypolicyviolation', listener);
    return { runtimeId: chrome.runtime.id, workerUrl: location.href };
  })()`);
  policyObserverInstalled = true;
  requireProof(diagnosticWorker?.runtimeId === harness.extensionId && diagnosticWorker.workerUrl === worker.url,
    'DIAGNOSTIC_WORKER_IDENTITY_REQUIRED');
  const deliveryReceipt = await evaluate(harness.cdp, workerSession,
    `(${installFaviconQaResponseDeliveryFixture.toString()})(${JSON.stringify({ key: deliveryKey,
      extensionId: harness.extensionId, pageUrl: fixture.url, localCacheUrl, maxHoldMs: 1500 })})`);
  deliveryInstalled = true;
  requireProof(deliveryReceipt?.originalResponseOnly === true && deliveryReceipt.runtimeId === harness.extensionId,
    'ORIGINAL_RESPONSE_DELIVERY_OWNER_REQUIRED');
  await record('native_response_delivery_fixture', deliveryReceipt);
  await harness.cdp.send('Network.enable', {}, workerSession);
  // A cold HTTP/memory read still obtains bytes from Chrome's local favicon DB.
  // This does not clear or replace that DB and never fetches the observed icon.
  await harness.cdp.send('Network.setCacheDisabled', { cacheDisabled: true }, workerSession); cacheDisabled = true;
  await harness.cdp.send('Fetch.enable', { patterns: FAVICON_QA_SYNTHETIC_ICON_URLS
    .map(urlPattern => ({ urlPattern, requestStage: 'Request' })) }, workerSession);
  interceptionEnabled = true;
  const localCaptureStartedAt = Date.now();
  const localCaptureResponse = await capture(FAVICON_QA_SYNTHETIC_ICON_URLS[0]);
  const localCaptureElapsedMs = Date.now() - localCaptureStartedAt;
  const policyViolations = await evaluate(harness.cdp, workerSession,
    `globalThis[${JSON.stringify(policyObserverKey)}].violations`);
  const localResponseReceipts = [];
  for (const [requestId, response] of [...localResponses].slice(0, 8)) {
    let bodyResult = null; let bodyReadFailed = false;
    try { bodyResult = await harness.cdp.send('Network.getResponseBody', { requestId }, workerSession, { timeoutMs: 1500 }); }
    catch { bodyReadFailed = true; }
    localResponseReceipts.push(summarizeFaviconQaLocalResponse(response, {
      servedFromCache: servedFromCacheRequestIds.has(requestId), bodyResult, bodyReadFailed }));
  }
  await record('local_cache_capture_diagnostics', { worker: diagnosticWorker,
    workerCacheDisabled: cacheDisabled,
    nativeResponseReads: (await deliverySnapshot()).reads,
    ...summarizeFaviconQaCapture({ response: localCaptureResponse, elapsedMs: localCaptureElapsedMs,
      requests, externalRequests, observedLocalRequestIds, localReadCompletions, localResponses: localResponseReceipts,
      policyViolations, unscopedNetworkFailures }) });
  requireProof(localCaptureResponse.captured === true, 'LOCAL_CACHE_CAPTURE_FAILED');
  if (interceptionError) throw interceptionError;
  const requireNativeProof = async expectedLocalReads => {
    // The capture ACK and CDP Network completion travel on independent channels.
    // Wait only for positive completion; all request/body assertions stay exact.
    await until('native_cache_network_completed', async () => ({
      count: requests.length,
      completions: requests.map(request => localReadCompletions.get(request.networkId)),
    }), value => value.count === expectedLocalReads
      && value.completions.every(completion => completion?.finished === true && completion.failed === false), 3000);
    return requireFaviconQaNoEgress({ localCacheUrl, requests,
      externalRequests, observedLocalRequestIds, localReadCompletions, nativeReads: (await deliverySnapshot()).reads,
      expectedNativeSha256: warmedNative.sha256, expectedLocalReads });
  };
  const localCaptureProof = await requireNativeProof(1);
  const persistedNativeDataUrl = await query();
  requireProof(persistedNativeDataUrl.startsWith('data:image/png;base64,')
    && createHash('sha256').update(Buffer.from(persistedNativeDataUrl.slice('data:image/png;base64,'.length), 'base64'))
      .digest('hex') === warmedNative.sha256, 'LOCAL_CACHE_BYTES_NOT_PERSISTED');
  const locallyCaptured = (await inspect()).stored;
  await record('local_cache_capture', { request: requests[0], stored: locallyCaptured, noEgress: localCaptureProof });
  const beforeRepeat = requests.length;
  requireProof((await capture(FAVICON_QA_SYNTHETIC_ICON_URLS[0])).captured === true, 'LOCAL_CACHE_REVISIT_ACK_REQUIRED');
  await record('local_cache_revisit', requireFaviconQaReuse(locallyCaptured, (await inspect()).stored, beforeRepeat, requests.length));
  await requireNativeProof(1);

  // Synthetic and native inputs belong to the same content source lane. Rebind
  // that lane explicitly before normal page/load observations resume. This
  // accounts for exactly one additional local GET, rather than treating a later
  // native observation as an unexplained change during the clear-race phase.
  const nativeRebindCapture = await capture(fixture.nativeIconUrl);
  const nativeRebindProof = await requireNativeProof(2);
  const nativeRebind = requireFaviconQaNativeSourceRebind({ capture: nativeRebindCapture,
    cache: await inspect(), nativeIconUrl: fixture.nativeIconUrl, expectedDataUrl: persistedNativeDataUrl,
    localCacheReads: requests.length });
  requireProof(await query() === persistedNativeDataUrl, 'NATIVE_SOURCE_REBIND_BYTES_CHANGED');
  await record('native_source_rebound', { ...nativeRebind, noEgress: nativeRebindProof });

  const imageExpression = selector => `(() => {
    const image = document.querySelector(${JSON.stringify(selector)});
    if (!image) return null;
    const rect = image.getBoundingClientRect(); const style = getComputedStyle(image);
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const centerInViewport = center.x >= 0 && center.y >= 0 && center.x < innerWidth && center.y < innerHeight;
    const hit = centerInViewport ? document.elementFromPoint(center.x, center.y) : null;
    const bootCoverPresent = !!document.getElementById('entropy-dashboard-boot-shell');
    let opacity = 1;
    for (let node = image; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    return { src: image.src, complete: image.complete, naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight, width: rect.width, height: rect.height,
      opacity, visibility: style.visibility, display: style.display, center, centerInViewport, bootCoverPresent,
      unobscured: centerInViewport && hit === image && !bootCoverPresent, hitTag: hit?.tagName || null };
  })()`;
  async function evaluateSurface(target, expression) {
    if (!Number.isInteger(target.executionContextId)) return evaluate(harness.cdp, target.sessionId, expression);
    const result = await harness.cdp.send('Runtime.evaluate', { expression: `(() => {
      if (location.href !== ${JSON.stringify(target.frameUrl)}) throw new Error('QA_FAVICON_GATE_FRAME_URL_CHANGED');
      return (${expression});
    })()`, contextId: target.executionContextId, awaitPromise: true, returnByValue: true, timeout: 3000 }, target.sessionId);
    if (result.exceptionDetails) throw new Error(`QA_FAVICON_GATE_FRAME_EVALUATION_FAILED:${
      result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
    return result.result?.value;
  }
  async function image(pageTarget, selector, expectedDataUrl = null) {
    try {
      return await until('surface_image', () => evaluateSurface(pageTarget, imageExpression(selector)), value => {
        try { requireFaviconQaImage(value, { expectedDataUrl }); return true; } catch { return false; }
      });
    } catch (error) {
      await record('surface_image_failure', { selector, expectedDataUrl, cache: await inspect(), dataUrl: await query() });
      throw error;
    }
  }
  async function screenshot(name, target) {
    const capture = await harness.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true,
      captureBeyondViewport: false }, target.sessionId);
    requireProof(typeof capture.data === 'string' && capture.data.length > 0, 'SCREENSHOT_REQUIRED');
    const file = path.join(attachmentsDir, `${name}.png`); await fs.writeFile(file, Buffer.from(capture.data, 'base64'));
    return file;
  }
  await harness.reloadPage(dashboard);
  await harness.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  }, dashboard.sessionId);
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(dashboard);
  const dashboardRowSelector = `button[aria-controls="sites-site-detail"][title="${FAVICON_QA_HOST}"]`;
  const dashboardSelector = `${dashboardRowSelector} img`;
  const dashboardPresentation = await until('dashboard_rendered_owner_ready', () => evaluate(harness.cdp, dashboard.sessionId, `(() => {
    const root = document.getElementById('root'); const boot = globalThis.__ENTROPY_DASHBOARD_BOOT_SNAPSHOT__;
    return { readyState: document.readyState, shellDismissed: boot?.shellDismissed === true,
      shellPresent: !!document.getElementById('entropy-dashboard-boot-shell'),
      rootInteractive: !!root && !root.inert && getComputedStyle(root).visibility === 'visible'
        && getComputedStyle(root).pointerEvents !== 'none',
      rowPresent: !!document.querySelector(${JSON.stringify(dashboardRowSelector)}) };
  })()`), value => value.readyState === 'complete' && value.shellDismissed && !value.shellPresent
    && value.rootInteractive && value.rowPresent);
  const dashboardScroll = await evaluate(harness.cdp, dashboard.sessionId, `(() => {
    const row = document.querySelector(${JSON.stringify(dashboardRowSelector)});
    if (!row?.isConnected) throw new Error('QA_FAVICON_DASHBOARD_ROW_REQUIRED');
    row.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
    const rect = row.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height,
      viewport: { width: innerWidth, height: innerHeight } };
  })()`);
  await record('dashboard_target_row_prepared', { presentation: dashboardPresentation, scroll: dashboardScroll });
  await record('dashboard_persisted_image', { image: await image(dashboard, dashboardSelector, persistedNativeDataUrl),
    screenshot: await screenshot('favicon-dashboard', dashboard) });
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(page);
  const popup = await harness.openPage(extensionUrl('popup.html'), { active: false, sameWindowAs: page });
  await until('popup_domain_binding', () => evaluate(harness.cdp, popup.sessionId,
    'document.querySelector(".popup-shell")?.getAttribute("data-site-domain")'), value => value === FAVICON_QA_HOST);
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(popup);
  const popupPersistedQueryMatches = await query() === persistedNativeDataUrl;
  requireProof(popupPersistedQueryMatches, 'POPUP_PERSISTED_QUERY_MISMATCH');
  await record('popup_browser_first_image', { image: await image(popup, '.popup-favicon__image'),
    persistedQueryMatches: popupPersistedQueryMatches,
    sourcePolicy: 'High-density popup intentionally tries Chrome _favicon first; its selected source is recorded.',
    screenshot: await screenshot('favicon-popup', popup) });
  const gate = await harness.openPage(fixture.url, { active: true, sameWindowAs: page });
  await harness.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  }, gate.sessionId);
  await harness.activateOwnedEphemeralPageWithoutWindowFocus(gate);
  const gateContentSession = await until('gate_content_document_ready', async () => {
    const response = await message({ action: MESSAGE_ACTIONS.DEBUG_GET_CONTENT_RUNTIME_DIAGNOSTICS,
      targetTabId: gate.tabId, limit: 5 });
    requireProof(response?.success === true && response.snapshot?.tabId === gate.tabId,
      'GATE_CONTENT_DIAGNOSTICS_REQUIRED');
    return response.snapshot.currentSession;
  }, session => session?.url === fixture.url && session.status === 'active'
    && typeof session.documentId === 'string' && session.documentId.length > 0
    && session.documentId === session.documentId.trim());
  await record('gate_content_document_ready', { targetTabId: gate.tabId, url: gateContentSession.url,
    documentId: gateContentSession.documentId, status: gateContentSession.status });
  const presentation = await sendGateAutomation(harness, { action: GATE_QA_AUTOMATION_ACTIONS.PRESENT_DETOUR_SPREAD,
    targetTabId: gate.tabId, payload: { maxProtectedTabs: 1, protectedTabs: [
      { tabId: page.tabId, url: fixture.url }, { tabId: gate.tabId, url: fixture.url },
    ] } });
  requireProof(presentation?.handled === true && presentation.reason === 'redirected'
    && presentation.gateKind === 'detourSpreadGuard' && typeof presentation.gatePageUrl === 'string',
  'GATE_PRESENTATION_REQUIRED');
  registerCleanup('favicon_gate', () => sendGateAutomation(harness, {
    action: GATE_QA_AUTOMATION_ACTIONS.DISMISS, targetTabId: gate.tabId }));
  await waitForPageReady(harness.cdp, gate.sessionId, 15_000);
  const gateDocument = await until('gate_exact_top_level_document', async () => {
    const [{ frameTree }, tab, { targetInfo }] = await Promise.all([
      harness.cdp.send('Page.getFrameTree', {}, gate.sessionId),
      harness.resolveTabForPage(gate),
      harness.cdp.send('Target.getTargetInfo', { targetId: gate.targetId }, gate.sessionId),
    ]);
    requireProof(tab.id === gate.tabId && targetInfo.targetId === gate.targetId && targetInfo.type === 'page',
      'GATE_TOP_LEVEL_OWNER_REQUIRED');
    const document = frameTree?.frame?.url === presentation.gatePageUrl
      && tab.url === presentation.gatePageUrl && targetInfo.url === presentation.gatePageUrl
      ? await evaluate(harness.cdp, gate.sessionId, `({ href: location.href, topLevel: window === window.top,
        present: !!document.querySelector('.gate-page[data-gate-kind="detourSpreadGuard"]') })`)
      : null;
    return { frame: frameTree?.frame, tab, target: targetInfo, document };
  }, value => value.frame?.url === presentation.gatePageUrl && !value.frame.parentId
    && value.tab.url === presentation.gatePageUrl && value.target.url === presentation.gatePageUrl
    && value.document?.topLevel && value.document.present && value.document.href === presentation.gatePageUrl);
  const gateSurface = gate;
  const gateSelector = '.gate-tab-chip__favicon-image, .gate-orbit-orb__favicon-image';
  await record('gate_persisted_image', { image: await image(gateSurface, gateSelector, persistedNativeDataUrl),
    presentation: 'Actual top-level Gate document in the exact authorized tab',
    targetId: gate.targetId, tabId: gate.tabId, frameId: gateDocument.frame.id,
    gatePageUrl: presentation.gatePageUrl, screenshot: await screenshot('favicon-gate', gate) });

  // Gate navigation must use the very same HTTP icon as the original page;
  // injecting Chrome's resized PNG back as a data URL would mutate its cache.
  const nativeStageDocuments = await Promise.all([page].map(target => evaluate(harness.cdp, target.sessionId,
    `({ pageUrl: location.href, iconUrl: document.querySelector('#qa-icon')?.href })`)));
  requireProof(nativeStageDocuments.every(document => document.pageUrl === fixture.url
    && document.iconUrl === fixture.nativeIconUrl), 'NATIVE_HTTP_STAGE_CHANGED');
  const preRaceNative = await readNativeCachePreparation();
  requireProof(preRaceNative.ready === true && preRaceNative.sha256 === warmedNative.sha256,
    'PRE_RACE_NATIVE_BYTES_CHANGED');
  requireProof(await query() === persistedNativeDataUrl, 'PRE_RACE_DURABLE_BYTES_CHANGED');
  await record('native_pre_race_baseline', { documents: nativeStageDocuments, native: preRaceNative,
    noEgress: await requireNativeProof(2) });

  // Obtain a successful real local-cache Response, hold only its delivery, clear
  // via the public product command, then return that same Response before expiry.
  await evaluate(harness.cdp, workerSession, `globalThis[${JSON.stringify(deliveryKey)}].arm()`);
  const pendingRace = capture(FAVICON_QA_SYNTHETIC_ICON_URLS[1]).then(value => ({ value }), error => ({ error }));
  const heldDelivery = await until('race_response_delivery_held', async () => {
    if (interceptionError) throw interceptionError;
    const state = await deliverySnapshot(); const read = state.reads.at(-1);
    if (read && ['expired', 'aborted', 'cleanup_released'].includes(read.state))
      requireProof(false, 'RACE_RESPONSE_DELIVERY_EXPIRED');
    return read?.state === 'held' ? { read, maxHoldMs: state.maxHoldMs } : null;
  }, Boolean, 1500);
  requireProof(heldDelivery.read.sha256 === warmedNative.sha256, 'RACE_NATIVE_BYTES_CHANGED');
  const raceRequest = requests.at(-1);
  requireProof(requests.length === 3 && raceRequest?.url === localCacheUrl, 'RACE_EXACT_LOCAL_REQUEST_REQUIRED');
  const clearReceipt = await clear();
  const releasedDelivery = await evaluate(harness.cdp, workerSession,
    `globalThis[${JSON.stringify(deliveryKey)}].release(${JSON.stringify(clearReceipt)})`);
  const raceDelivery = releasedDelivery.reads.at(-1);
  const holdMs = raceDelivery.holdMs;
  const raceOutcome = await pendingRace;
  if (raceOutcome.error) throw raceOutcome.error;
  const cacheRead = await until('race_local_read_completed', async () => localReadCompletions.get(raceRequest.networkId), Boolean, 3000);
  const cleared = await inspect();
  await record('clear_during_native_response_delivery', { clearReceipt, delivery: raceDelivery,
    proof: requireFaviconQaClearRace({ capture: raceOutcome.value, stored: cleared.stored,
      dataUrl: await query(), cacheRead, delivery: raceDelivery, maxHoldMs: releasedDelivery.maxHoldMs, holdMs }), requests,
    noEgress: await requireNativeProof(3) });
  // The full-page Gate keeps its document while hidden. Verify live cache
  // invalidation in both mounted app documents without changing window focus.
  for (const [name, target, surface, selector] of [['gate', gate, gateSurface, gateSelector],
    ['dashboard', dashboard, dashboard, dashboardSelector]]) {
    await harness.activateOwnedEphemeralPageWithoutWindowFocus(target);
    const rootSelector = name === 'dashboard'
      ? `button[aria-controls="sites-site-detail"][title="${FAVICON_QA_HOST}"]` : '.gate-page[data-gate-kind="detourSpreadGuard"]';
    const invalidation = await until(`${name}_clear_invalidation`, () => evaluateSurface(surface, `({
      mounted: !!document.querySelector(${JSON.stringify(rootSelector)}),
      staleImageCount: [...document.querySelectorAll(${JSON.stringify(selector)})]
        .filter(image => image.src === ${JSON.stringify(persistedNativeDataUrl)}).length
    })`), value => value.mounted && value.staleImageCount === 0);
    await record(`${name}_clear_invalidation`, invalidation);
  }
  requireProof(await query() === '' && (await inspect()).stored === null, 'CLEAR_REPOPULATED_AFTER_UI_READ');
  await harness.cdp.send('Fetch.disable', {}, workerSession); interceptionEnabled = false;
  await Promise.all([...pendingInterceptions]);
  if (interceptionError) throw interceptionError;
  await record('worker_no_egress', await requireNativeProof(3));
  reportState.status = 'PASS';
  return { status: 'PASS', protocol: 'favicon_cache', reportJsonPath, buildId: artifact.buildId, verdictScope: 'product',
    scope: 'Actual disposable Chrome: native content discovery/change, unchanged revisit and worker restart, loopback HTTP favicon warming, successful own-extension cache GET with native PNG bytes and repeat suppression, zero external worker requests from synthetic icon observations, dashboard/full-page Gate persisted images, popup browser-first rendering, clear before delivery of one unchanged native local-cache Response and live app invalidation. No synthesized responses, network-request hold, whole-browser egress or 24-hour clock certification.' };
  } catch (error) {
    reportState.status = 'FAIL'; reportState.error = { code: error?.code || null, message: error?.message || String(error) };
    throw error;
  }
}
