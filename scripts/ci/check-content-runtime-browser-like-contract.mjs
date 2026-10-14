#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const rootDir = process.cwd();
const distArg = String(process.argv[2] || 'dist-prod').trim();
const distDir = path.resolve(rootDir, distArg || 'dist-prod');
const loaderPath = path.resolve(distDir, 'src/apps/content/loader.js');

const CONTENT_BOOTSTRAP_STATE = 'CONTENT_BOOTSTRAP_STATE';
const CONTENT_BOOTSTRAP_SNAPSHOT = 'CONTENT_BOOTSTRAP_SNAPSHOT';
const CONTENT_RUNTIME_TEARDOWN = 'CONTENT_RUNTIME_TEARDOWN';
const CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY = '__entropyContentBootstrapAttemptLease__';
const STATUS_BOOTSTRAPPING = 'bootstrapping';
const STATUS_RECEIVER_READY = 'receiver_ready';
const STATUS_ACTIVE = 'active';
const STATUS_STALE = 'stale';
const WAIT_TIMEOUT_MS = 4000;

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

const fail = (message, details = null) => {
  restoreConsole();
  originalConsole.error(`[content-runtime-browser-contract] FAIL: ${message}`);
  if (details) {
    originalConsole.error(
      `[content-runtime-browser-contract] Details: ${JSON.stringify(details, null, 2)}`,
    );
  }
  process.exit(1);
};

const requireReadableFile = async (filePath, label) => {
  try {
    await fs.access(filePath);
  } catch (error) {
    fail(`${label} is missing: ${path.relative(rootDir, filePath)} (${error?.message || error})`);
  }
};

function installCapturedConsole(logBuffer) {
  const capture = (method) => (...args) => {
    logBuffer.push({
      method,
      message: args.map((value) => {
        if (typeof value === 'string') return value;
        try {
          return JSON.stringify(value);
        } catch (_) {
          return String(value);
        }
      }).join(' '),
    });
  };

  console.log = capture('log');
  console.warn = capture('warn');
  console.error = capture('error');
  console.debug = capture('debug');
}

function restoreConsole() {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
}

function createStorageArea(store, listeners, areaName, {
  trusted = true,
  accessState = { level: 'TRUSTED_AND_UNTRUSTED_CONTEXTS', changeCount: 0, contentReadCount: 0 },
} = {}) {
  function rejectUntrustedAccess(callback) {
    if (trusted || accessState.level !== 'TRUSTED_CONTEXTS') return null;
    const error = new Error('Access to storage is not allowed from this context.');
    if (typeof callback !== 'function') return { result: Promise.reject(error) };
    globalThis.chrome.runtime.lastError = { message: error.message };
    try {
      callback();
    } finally {
      globalThis.chrome.runtime.lastError = null;
    }
    return { result: undefined };
  }

  return {
    async setAccessLevel({ accessLevel }) {
      if (!trusted) throw new Error('Context cannot set the storage access level');
      if (accessLevel !== 'TRUSTED_CONTEXTS') throw new Error('Unexpected fixture storage access level');
      accessState.level = accessLevel;
      accessState.changeCount += 1;
    },
    get(query, callback) {
      if (!trusted) accessState.contentReadCount += 1;
      const denied = rejectUntrustedAccess(callback);
      if (denied) return denied.result;
      let result = {};
      if (Array.isArray(query)) {
        result = Object.fromEntries(
          query.filter((key) => store.has(key)).map((key) => [key, store.get(key)]),
        );
      } else if (query && typeof query === 'object') {
        result = Object.fromEntries(
          Object.entries(query).map(([key, fallback]) => [
            key,
            store.has(key) ? store.get(key) : fallback,
          ]),
        );
      }
      callback?.(result);
      return Promise.resolve(result);
    },
    set(items, callback) {
      const denied = rejectUntrustedAccess(callback);
      if (denied) return denied.result;
      const changes = {};
      for (const [key, value] of Object.entries(items || {})) {
        changes[key] = {
          oldValue: store.get(key),
          newValue: value,
        };
        store.set(key, value);
      }
      listeners.forEach((listener) => listener(changes, areaName));
      callback?.();
      return Promise.resolve();
    },
    remove(keys, callback) {
      const denied = rejectUntrustedAccess(callback);
      if (denied) return denied.result;
      const keyList = Array.isArray(keys) ? keys : [keys];
      const changes = {};
      keyList.forEach((key) => {
        changes[key] = {
          oldValue: store.get(key),
          newValue: undefined,
        };
        store.delete(key);
      });
      listeners.forEach((listener) => listener(changes, areaName));
      callback?.();
      return Promise.resolve();
    },
  };
}

function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

async function createHarness(distDirPath) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://example.com/feed',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const runtimeMessages = [];
  const runtimeListeners = new Set();
  const storageListeners = new Set();
  const storageLocal = new Map();
  const storageSession = new Map();
  const accessState = { level: 'TRUSTED_AND_UNTRUSTED_CONTEXTS', changeCount: 0, contentReadCount: 0 };
  const backgroundStorageListeners = new Set();
  const bootstrapResponses = [];
  let bootstrapSnapshotRoute = null;
  storageLocal.set('settings.ui', { app_language: 'ko' });
  storageLocal.set('keys.domain_hmac_secret', 'A'.repeat(43));

  const chrome = {
    runtime: {
      id: 'entropy-browser-contract',
      lastError: null,
      getURL(relativePath) {
        return pathToFileURL(path.resolve(distDirPath, relativePath)).href;
      },
      sendMessage(message, callback) {
        runtimeMessages.push(message);
        if (message?.type === CONTENT_BOOTSTRAP_SNAPSHOT) {
          return bootstrapSnapshotRoute(message, {
            id: chrome.runtime.id,
            tab: { id: 1, url: window.location.href },
            frameId: 0,
            url: window.location.href,
          }, (response) => {
            bootstrapResponses.push(response);
            callback?.(response);
          });
        }
        if (message?.action === 'GET_SETTINGS') {
          callback?.({
            success: true,
            settings: {
              indicatorConfig: null,
            },
          });
          return;
        }
        if (message?.action === 'SET_SETTINGS') {
          const committedItems = message?.items && typeof message.items === 'object'
            ? { ...message.items }
            : {};
          callback?.({
            success: true,
            changedKeys: Object.keys(committedItems),
            committedItems,
            version: 1,
            applied: {
              refreshed: false,
              syncScripts: false,
              broadcast: false,
            },
          });
          return;
        }
        if (message?.action === 'GET_FILTER_INDICATOR_INFO') {
          callback?.({
            success: true,
            data: null,
          });
          return;
        }
        if (message?.action === 'CAPTURE_FAVICON') {
          callback?.({
            success: true,
            captured: true,
          });
          return;
        }
        callback?.({
          success: true,
          ok: true,
        });
      },
      onMessage: {
        addListener(listener) {
          runtimeListeners.add(listener);
        },
        removeListener(listener) {
          runtimeListeners.delete(listener);
        },
      },
    },
    storage: {
      local: createStorageArea(storageLocal, storageListeners, 'local', { trusted: false, accessState }),
      session: createStorageArea(storageSession, storageListeners, 'session'),
      onChanged: {
        addListener(listener) {
          storageListeners.add(listener);
        },
        removeListener(listener) {
          storageListeners.delete(listener);
        },
      },
    },
  };

  [
    ['window', window],
    ['document', window.document],
    ['navigator', window.navigator],
    ['location', window.location],
    ['chrome', chrome],
    ['HTMLElement', window.HTMLElement],
    ['Element', window.Element],
    ['Node', window.Node],
    ['MutationObserver', window.MutationObserver],
    ['CustomEvent', window.CustomEvent],
    ['Event', window.Event],
    ['requestAnimationFrame', window.requestAnimationFrame.bind(window)],
    ['cancelAnimationFrame', window.cancelAnimationFrame.bind(window)],
    ['getComputedStyle', window.getComputedStyle.bind(window)],
    ['localStorage', window.localStorage],
    ['sessionStorage', window.sessionStorage],
    ['DOMParser', window.DOMParser],
    ['CSS', window.CSS],
    ['self', window],
  ].forEach(([name, value]) => defineGlobal(name, value));

  window.chrome = chrome;
  window.globalThis = globalThis;
  window.self = window;

  // Canonical background owners capture a trusted API; the emitted content
  // bundle receives only the untrusted API above. The route and key/settings
  // contracts remain product code, including real storage-access initialization.
  const backgroundChrome = {
    ...chrome,
    storage: {
      ...chrome.storage,
      local: createStorageArea(storageLocal, backgroundStorageListeners, 'local', { accessState }),
    },
  };
  defineGlobal('chrome', backgroundChrome);
  try {
    const [routeModule, snapshotModule, languageModule, trustModule] = await Promise.all([
      import('../../src/apps/background/services/runtime/messageRoutes/contentBootstrapSnapshotMessageRoutes.js'),
      import('../../src/platform/storage/bootstrap/BootstrapSnapshotRepository.js'),
      import('../../src/platform/storage/settings/RuntimeLanguageRepository.js'),
      import('../../src/platform/storage/security/StorageTrustCapability.js'),
    ]);
    bootstrapSnapshotRoute = routeModule.createContentBootstrapSnapshotMessageRoutes({
      bootstrapSnapshotRepository: snapshotModule.default.getInstance(),
      runtimeLanguageRepository: languageModule.default.getInstance(),
    }).types[CONTENT_BOOTSTRAP_SNAPSHOT];
    await trustModule.initializeTrustedLocalStorageAccess();
  } finally {
    defineGlobal('chrome', chrome);
  }

  return {
    close() {
      dom.window.close();
    },
    getLoaderState() {
      return globalThis.__entropyContentLoaderState__ || null;
    },
    getBootstrapState() {
      return globalThis.__entropyContentBootstrapState__ || null;
    },
    getAttemptLease() {
      return globalThis[CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY] || null;
    },
    setLoaderState(nextState) {
      globalThis.__entropyContentLoaderState__ = nextState;
      window.__entropyContentLoaderState__ = nextState;
    },
    setBootstrapState(nextState) {
      globalThis.__entropyContentBootstrapState__ = nextState;
      window.__entropyContentBootstrapState__ = nextState;
    },
    setAttemptLease(nextLease) {
      globalThis[CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY] = nextLease;
      window[CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY] = nextLease;
    },
    getBootstrapStatuses() {
      return runtimeMessages
        .filter((message) => message?.type === CONTENT_BOOTSTRAP_STATE)
        .map((message) => message?.payload?.status || null)
        .filter(Boolean);
    },
    getRuntimeListenerCount() {
      return runtimeListeners.size;
    },
    getStorageListenerCount() {
      return storageListeners.size;
    },
    getRuntimeMessages() {
      return runtimeMessages.slice();
    },
    getStorageTrustDiagnostics() {
      return { ...accessState, bootstrapResponses: bootstrapResponses.slice() };
    },
    async assertContentStorageDenied() {
      try {
        await chrome.storage.local.get(['keys.domain_hmac_secret']);
      } catch (error) {
        if (error?.message === 'Access to storage is not allowed from this context.') return;
        throw error;
      }
      throw new Error('Browser-like fixture exposed trusted local key material to content.');
    },
    navigateSpa(relativeUrl) {
      window.history.pushState({}, '', relativeUrl);
      window.dispatchEvent(new window.PopStateEvent('popstate'));
    },
    async invokeRuntimeMessage(message, sender = { id: chrome.runtime.id }) {
      const listeners = [...runtimeListeners];
      const responses = [];
      listeners.forEach((listener) => {
        listener(message, sender, (response) => responses.push(response));
      });
      await waitFor(() => responses.length > 0, 'the content runtime message acknowledgement');
      return responses[0];
    },
  };
}

async function waitFor(predicate, label, { timeoutMs = WAIT_TIMEOUT_MS, details = null } = {}) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  fail(`Timed out waiting for ${label}.`, typeof details === 'function' ? details() : details);
}

function findNthIndex(values, target, ordinal = 1) {
  let seen = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] !== target) continue;
    seen += 1;
    if (seen === ordinal) return index;
  }
  return -1;
}

function findIndexAfter(values, target, afterIndex) {
  for (let index = Math.max(-1, afterIndex) + 1; index < values.length; index += 1) {
    if (values[index] === target) return index;
  }
  return -1;
}

function assertStatusSequence(statuses, diagnostics = {}) {
  const firstBootstrapping = findNthIndex(statuses, STATUS_BOOTSTRAPPING, 1);
  const firstReceiverReady = findNthIndex(statuses, STATUS_RECEIVER_READY, 1);
  const firstActive = findNthIndex(statuses, STATUS_ACTIVE, 1);
  const stale = findNthIndex(statuses, STATUS_STALE, 1);
  const secondBootstrapping = findIndexAfter(statuses, STATUS_BOOTSTRAPPING, stale);
  const secondReceiverReady = findIndexAfter(statuses, STATUS_RECEIVER_READY, secondBootstrapping);
  const secondActive = findIndexAfter(statuses, STATUS_ACTIVE, secondReceiverReady);

  const isValid = (
    firstBootstrapping !== -1
    && firstReceiverReady > firstBootstrapping
    && firstActive > firstReceiverReady
    && stale > firstActive
    && secondBootstrapping > stale
    && secondReceiverReady > secondBootstrapping
    && secondActive > secondReceiverReady
  );

  if (!isValid) {
    fail('Built content runtime did not publish the expected bootstrap -> stale -> rebootstrap sequence.', {
      ...diagnostics,
      statuses,
    });
  }
}

function assertRecoveredStaleBootstrapping(runtimeMessages, diagnostics = {}) {
  const recoveryMessage = runtimeMessages.find((message) => (
    message?.type === CONTENT_BOOTSTRAP_STATE
    && message?.payload?.status === STATUS_BOOTSTRAPPING
    && message?.payload?.reason === 'stale_bootstrapping_recovery'
  ));

  if (!recoveryMessage) {
    fail('Built content runtime did not report stale bootstrapping recovery during reinjection.', {
      ...diagnostics,
      runtimeMessages: runtimeMessages.slice(-12),
    });
  }
}

function assertAttemptOwnership(runtimeMessages, diagnostics = {}) {
  const bootstrapMessages = runtimeMessages.filter((message) => (
    message?.type === CONTENT_BOOTSTRAP_STATE
  ));
  const initialMessage = bootstrapMessages.find((message) => (
    message?.payload?.status === STATUS_BOOTSTRAPPING
    && message?.payload?.reason !== 'stale_bootstrapping_recovery'
  ));
  const recoveryIndex = bootstrapMessages.findIndex((message) => (
    message?.payload?.status === STATUS_BOOTSTRAPPING
    && message?.payload?.reason === 'stale_bootstrapping_recovery'
  ));
  const recoveryMessage = recoveryIndex >= 0 ? bootstrapMessages[recoveryIndex] : null;
  const initialAttemptId = Number(initialMessage?.payload?.attemptId);
  const recoveryAttemptId = Number(recoveryMessage?.payload?.attemptId);
  const staleWritesAfterRecovery = bootstrapMessages.slice(recoveryIndex + 1).filter((message) => (
    Number(message?.payload?.attemptId) === initialAttemptId
    && (message?.payload?.status === STATUS_RECEIVER_READY || message?.payload?.status === 'failed')
  ));

  if (
    !Number.isInteger(initialAttemptId)
    || initialAttemptId <= 0
    || !Number.isInteger(recoveryAttemptId)
    || recoveryAttemptId <= initialAttemptId
    || staleWritesAfterRecovery.length > 0
  ) {
    fail('Built content runtime did not preserve monotonic attempt ownership across recovery.', {
      ...diagnostics,
      initialAttemptId,
      recoveryAttemptId,
      staleWritesAfterRecovery,
      bootstrapMessages: bootstrapMessages.slice(-16),
    });
  }
}

const main = async () => {
  await requireReadableFile(loaderPath, 'built content loader');
  const loaderSource = await fs.readFile(loaderPath, 'utf8');
  const capturedLogs = [];
  installCapturedConsole(capturedLogs);

  const harness = await createHarness(distDir);
  try {
    await harness.assertContentStorageDenied();
    const runLoader = new Function(loaderSource);

    runLoader();
    await waitFor(
      () => harness.getLoaderState()?.status === 'ready' && harness.getBootstrapState()?.status === STATUS_ACTIVE,
      'the built content runtime to reach its initial active state',
      {
        details: () => ({
          loaderState: harness.getLoaderState(),
          bootstrapState: harness.getBootstrapState(),
          runtimeMessages: harness.getRuntimeMessages().slice(0, 16),
          capturedLogs: capturedLogs.slice(-12),
        }),
      },
    );

    const initialLifecycleSnapshot = {
      loaderAttemptCount: Number(harness.getLoaderState()?.attemptCount || 0),
      loaderAttemptId: Number(harness.getLoaderState()?.attemptId || 0),
      runtimeListenerCount: harness.getRuntimeListenerCount(),
      storageListenerCount: harness.getStorageListenerCount(),
    };
    const storageTrust = harness.getStorageTrustDiagnostics();
    const bootstrapOperations = new Set(storageTrust.bootstrapResponses
      .filter((response) => response?.success === true && response.hostname === 'example.com')
      .map((response) => response.operation));
    if (
      storageTrust.level !== 'TRUSTED_CONTEXTS'
      || storageTrust.changeCount !== 1
      || storageTrust.contentReadCount !== 1
      || !['root_visual', 'friction', 'language'].every((operation) => bootstrapOperations.has(operation))
      || !storageTrust.bootstrapResponses.some((response) => response.operation === 'language' && response.snapshot === 'ko')
    ) {
      fail('Built content bootstrap did not preserve the trusted local-storage/runtime boundary.', storageTrust);
    }
    if (initialLifecycleSnapshot.loaderAttemptCount !== 1) {
      fail('Built content loader did not establish exactly one initial bootstrap attempt.', {
        initialLifecycleSnapshot,
        loaderState: harness.getLoaderState(),
      });
    }
    if (initialLifecycleSnapshot.runtimeListenerCount <= 0) {
      fail('Built content runtime reached active without a runtime message listener.', {
        initialLifecycleSnapshot,
      });
    }

    harness.navigateSpa('/feed?view=next#same-document');
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (
      harness.getBootstrapState()?.status !== STATUS_ACTIVE
      || Number(harness.getLoaderState()?.attemptCount || 0) !== initialLifecycleSnapshot.loaderAttemptCount
      || harness.getRuntimeListenerCount() !== initialLifecycleSnapshot.runtimeListenerCount
      || harness.getStorageListenerCount() !== initialLifecycleSnapshot.storageListenerCount
    ) {
      fail('Same-document SPA navigation changed content bootstrap or listener ownership.', {
        initialLifecycleSnapshot,
        loaderState: harness.getLoaderState(),
        bootstrapState: harness.getBootstrapState(),
        runtimeListenerCount: harness.getRuntimeListenerCount(),
        storageListenerCount: harness.getStorageListenerCount(),
      });
    }

    const reinjectedBefore = harness.getRuntimeMessages().filter((message) => (
      message?.type === CONTENT_BOOTSTRAP_STATE
      && message?.payload?.reason === 'loader_reinjected'
    )).length;
    runLoader();
    runLoader();
    const reinjectedAfter = harness.getRuntimeMessages().filter((message) => (
      message?.type === CONTENT_BOOTSTRAP_STATE
      && message?.payload?.reason === 'loader_reinjected'
    )).length;
    if (reinjectedAfter !== reinjectedBefore + 2) {
      fail('Active loader reinjection did not reannounce dispatch readiness exactly once per injection.', {
        reinjectedBefore,
        reinjectedAfter,
        runtimeMessages: harness.getRuntimeMessages().slice(-12),
      });
    }
    const reinjectedAttempts = harness.getRuntimeMessages().filter((message) => (
      message?.type === CONTENT_BOOTSTRAP_STATE
      && message?.payload?.reason === 'loader_reinjected'
    )).slice(-2).map((message) => Number(message?.payload?.attemptId));
    if (reinjectedAttempts.some((attemptId) => attemptId !== initialLifecycleSnapshot.loaderAttemptId)) {
      fail('Active loader reinjection did not preserve the canonical attempt identity.', {
        initialLifecycleSnapshot,
        reinjectedAttempts,
      });
    }
    if (
      Number(harness.getLoaderState()?.attemptCount || 0) !== initialLifecycleSnapshot.loaderAttemptCount
      || harness.getRuntimeListenerCount() !== initialLifecycleSnapshot.runtimeListenerCount
      || harness.getStorageListenerCount() !== initialLifecycleSnapshot.storageListenerCount
    ) {
      fail('Active loader reinjection duplicated bootstrap attempts or listeners.', {
        initialLifecycleSnapshot,
        loaderState: harness.getLoaderState(),
        runtimeListenerCount: harness.getRuntimeListenerCount(),
        storageListenerCount: harness.getStorageListenerCount(),
      });
    }

    const teardownId = 'browser-contract-teardown';
    const teardownAttemptId = harness.getBootstrapState().attemptId;
    const teardownAck = await harness.invokeRuntimeMessage({
      type: CONTENT_RUNTIME_TEARDOWN,
      payload: {
        reason: 'browser_contract_test',
        attemptId: teardownAttemptId,
        teardownId,
      },
    });
    if (teardownAck?.ok !== true || teardownAck.type !== CONTENT_RUNTIME_TEARDOWN
      || teardownAck.attemptId !== teardownAttemptId || teardownAck.teardownId !== teardownId) {
      fail('Built content runtime did not acknowledge completed teardown for the exact attempt.', {
        teardownAck, capturedLogs: capturedLogs.slice(-12),
      });
    }
    await waitFor(
      () => harness.getBootstrapState()?.status === STATUS_STALE,
      'the built content runtime to honor teardown and publish a stale state',
      {
        details: {
          bootstrapState: harness.getBootstrapState(),
          runtimeMessages: harness.getRuntimeMessages().slice(0, 20),
          capturedLogs: capturedLogs.slice(-12),
        },
      },
    );
    const staleListenerSnapshot = {
      runtimeListenerCount: harness.getRuntimeListenerCount(),
      storageListenerCount: harness.getStorageListenerCount(),
    };
    if (
      staleListenerSnapshot.runtimeListenerCount > initialLifecycleSnapshot.runtimeListenerCount
      || staleListenerSnapshot.storageListenerCount > initialLifecycleSnapshot.storageListenerCount
    ) {
      fail('Content teardown increased listener cardinality.', {
        initialLifecycleSnapshot,
        staleListenerSnapshot,
      });
    }

    const simulatedStaleStartedAt = Date.now() - 2_000;
    const simulatedStaleAbortController = new AbortController();
    const simulatedStaleLease = {
      attemptId: initialLifecycleSnapshot.loaderAttemptId,
      startedAt: simulatedStaleStartedAt,
      replacesAttemptId: null,
      reason: 'browser_contract_stale_bootstrapping',
      signal: simulatedStaleAbortController.signal,
      revokedAt: null,
      revokeReason: null,
      cancel(reason = 'attempt_replaced') {
        if (simulatedStaleAbortController.signal.aborted) return false;
        simulatedStaleLease.revokedAt = Date.now();
        simulatedStaleLease.revokeReason = reason;
        simulatedStaleAbortController.abort(reason);
        return true;
      },
    };
    harness.setAttemptLease(simulatedStaleLease);
    harness.setLoaderState({
      status: 'starting',
      attemptId: initialLifecycleSnapshot.loaderAttemptId,
      startedAt: simulatedStaleStartedAt,
      readyAt: null,
      failedAt: null,
      lastError: null,
      attemptCount: Number(harness.getLoaderState()?.attemptCount || 1),
    });
    harness.setBootstrapState({
      status: STATUS_BOOTSTRAPPING,
      attemptId: initialLifecycleSnapshot.loaderAttemptId,
      dispatchReady: false,
      active: false,
      startedAt: simulatedStaleStartedAt,
      receiverReadyAt: null,
      activeAt: null,
      failedAt: null,
      error: null,
      reason: 'browser_contract_stale_bootstrapping',
    });

    runLoader();
    await waitFor(
      () => harness.getBootstrapState()?.status === STATUS_ACTIVE
        && Number(harness.getLoaderState()?.attemptCount || 0) >= 2,
      'the built content loader to recover stale bootstrapping during reinjection',
      {
        details: {
          loaderState: harness.getLoaderState(),
          bootstrapState: harness.getBootstrapState(),
          runtimeMessages: harness.getRuntimeMessages().slice(0, 24),
          capturedLogs: capturedLogs.slice(-12),
        },
      },
    );
    if (simulatedStaleAbortController.signal.aborted !== true) {
      fail('Stale content recovery did not revoke the previous in-flight attempt lease first.', {
        simulatedStaleLease,
        currentAttemptId: harness.getAttemptLease()?.attemptId ?? null,
      });
    }

    assertStatusSequence(harness.getBootstrapStatuses(), {
      loaderState: harness.getLoaderState(),
      bootstrapState: harness.getBootstrapState(),
      runtimeListenerCount: harness.getRuntimeListenerCount(),
      capturedLogs: capturedLogs.slice(-12),
    });
    assertRecoveredStaleBootstrapping(harness.getRuntimeMessages(), {
      loaderState: harness.getLoaderState(),
      bootstrapState: harness.getBootstrapState(),
      capturedLogs: capturedLogs.slice(-12),
    });
    assertAttemptOwnership(harness.getRuntimeMessages(), {
      loaderState: harness.getLoaderState(),
      bootstrapState: harness.getBootstrapState(),
    });

    const recoveredLifecycleSnapshot = {
      loaderAttemptCount: Number(harness.getLoaderState()?.attemptCount || 0),
      runtimeListenerCount: harness.getRuntimeListenerCount(),
      storageListenerCount: harness.getStorageListenerCount(),
    };
    if (
      recoveredLifecycleSnapshot.loaderAttemptCount !== initialLifecycleSnapshot.loaderAttemptCount + 1
      || recoveredLifecycleSnapshot.runtimeListenerCount !== initialLifecycleSnapshot.runtimeListenerCount
      || recoveredLifecycleSnapshot.storageListenerCount !== initialLifecycleSnapshot.storageListenerCount
    ) {
      fail('Rebootstrapped content runtime did not restore its original listener cardinality.', {
        initialLifecycleSnapshot,
        staleListenerSnapshot,
        recoveredLifecycleSnapshot,
      });
    }

    const recoveredReinjectedBefore = harness.getRuntimeMessages().filter((message) => (
      message?.type === CONTENT_BOOTSTRAP_STATE
      && message?.payload?.reason === 'loader_reinjected'
    )).length;
    runLoader();
    const recoveredReinjectedAfter = harness.getRuntimeMessages().filter((message) => (
      message?.type === CONTENT_BOOTSTRAP_STATE
      && message?.payload?.reason === 'loader_reinjected'
    )).length;
    if (
      recoveredReinjectedAfter !== recoveredReinjectedBefore + 1
      || Number(harness.getLoaderState()?.attemptCount || 0) !== recoveredLifecycleSnapshot.loaderAttemptCount
      || harness.getRuntimeListenerCount() !== recoveredLifecycleSnapshot.runtimeListenerCount
      || harness.getStorageListenerCount() !== recoveredLifecycleSnapshot.storageListenerCount
    ) {
      fail('Recovered active runtime reinjection duplicated bootstrap or listener ownership.', {
        recoveredLifecycleSnapshot,
        loaderState: harness.getLoaderState(),
        runtimeListenerCount: harness.getRuntimeListenerCount(),
        storageListenerCount: harness.getStorageListenerCount(),
        recoveredReinjectedBefore,
        recoveredReinjectedAfter,
      });
    }

    const loaderState = harness.getLoaderState();
    if (loaderState?.lastError) {
      fail('Built content loader reported an unexpected error during the browser-like contract check.', {
        loaderState,
        bootstrapState: harness.getBootstrapState(),
        capturedLogs: capturedLogs.slice(-12),
      });
    }
  } finally {
    harness.close();
    restoreConsole();
  }

  originalConsole.log(
    `[content-runtime-browser-contract] PASS: ${path.relative(rootDir, loaderPath)} preserved SPA/reinjection listener cardinality across teardown and rebootstrap.`,
  );
  process.exit(0);
};

main().catch((error) => {
  fail('Unexpected error.', {
    message: String(error?.message || error),
    stack: String(error?.stack || ''),
  });
});
