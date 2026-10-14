const SERVICE_WORKER_DIAGNOSTIC_ENTRY_LIMIT = 120;
const SERVICE_WORKER_COLLECTOR_ERROR_LIMIT = 20;
const SERVICE_WORKER_DIAGNOSTIC_TEXT_LIMIT = 900;
const SERVICE_WORKER_DISCOVERY_SETTLE_MS = 50;
const SERVICE_WORKER_SCRIPT_PATH = '/service-worker-loader.js';
const SERVICE_WORKER_RUNTIME_TELEMETRY_EXPRESSION =
  'globalThis.__ENTROPY_SERVICE_WORKER_WAKE_TELEMETRY__?.snapshot?.() || null';

export const CWS_PAGE_READINESS_SNAPSHOT_EXPRESSION = `(() => {
  const runtime = globalThis.chrome?.runtime;
  const storageLocal = globalThis.chrome?.storage?.local;
  const storageSession = globalThis.chrome?.storage?.session;
  const history = globalThis.chrome?.history;
  const management = globalThis.chrome?.management;
  const documentGeneration = Number(globalThis.performance?.timeOrigin);
  const rawVisibilityState = globalThis.document?.visibilityState;
  const visibilityState = ['hidden', 'visible'].includes(rawVisibilityState)
    ? rawVisibilityState
    : null;
  return {
    url: globalThis.location?.href || '',
    readyState: globalThis.document?.readyState || null,
    visibilityState,
    documentGeneration: Number.isFinite(documentGeneration)
      && documentGeneration > 0
      && documentGeneration <= Number.MAX_SAFE_INTEGER
      ? documentGeneration
      : null,
    extensionApis: {
      runtimeSendMessage: typeof runtime?.sendMessage === 'function',
      storageLocal: typeof storageLocal?.get === 'function'
        && typeof storageLocal?.set === 'function',
      storageSession: typeof storageSession?.get === 'function'
        && typeof storageSession?.set === 'function',
      historyGetVisits: typeof history?.getVisits === 'function',
      managementGet: typeof management?.get === 'function',
      managementSetEnabled: typeof management?.setEnabled === 'function',
    },
  };
})()`;

const normalizePageReadinessUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return new URL(value).href;
  } catch {
    return null;
  }
};

const normalizePageDocumentGeneration = (value) => (
  typeof value === 'number'
    && Number.isFinite(value)
    && value > 0
    && value <= Number.MAX_SAFE_INTEGER
    ? value
    : null
);

const normalizePageVisibilityState = (value) => (
  value === 'hidden' || value === 'visible' ? value : null
);

export function isCwsPageReadinessSnapshotReady(snapshot, {
  expectedUrl,
  previousDocumentGeneration = null,
  requireVisible = false,
  extensionApiProfile = 'entropy_runtime',
} = {}) {
  const normalizedExpectedUrl = normalizePageReadinessUrl(expectedUrl);
  const normalizedActualUrl = normalizePageReadinessUrl(snapshot?.url);
  if (!normalizedExpectedUrl || normalizedActualUrl !== normalizedExpectedUrl) {
    return false;
  }
  const documentGeneration = normalizePageDocumentGeneration(snapshot?.documentGeneration);
  if (documentGeneration === null) return false;
  if (previousDocumentGeneration !== null) {
    const normalizedPreviousGeneration = normalizePageDocumentGeneration(
      previousDocumentGeneration,
    );
    if (
      normalizedPreviousGeneration === null
      || documentGeneration === normalizedPreviousGeneration
    ) {
      return false;
    }
  }
  if (!['interactive', 'complete'].includes(snapshot?.readyState)) {
    return false;
  }
  if (
    requireVisible === true
    && normalizePageVisibilityState(snapshot?.visibilityState) !== 'visible'
  ) {
    return false;
  }

  const expectedProtocol = new URL(normalizedExpectedUrl).protocol;
  if (expectedProtocol !== 'chrome-extension:') return true;
  if (extensionApiProfile === 'entropy_runtime') {
    return snapshot?.extensionApis?.runtimeSendMessage === true
      && snapshot?.extensionApis?.storageLocal === true
      && snapshot?.extensionApis?.storageSession === true;
  }
  if (extensionApiProfile === 'history_controller') {
    return snapshot?.extensionApis?.historyGetVisits === true
      && snapshot?.extensionApis?.managementGet === true
      && snapshot?.extensionApis?.managementSetEnabled === true;
  }
  throw new Error('CWS_PAGE_READINESS_EXTENSION_API_PROFILE_INVALID');
}

export function projectCwsPageReadyTimeoutDiagnostics({
  expectedUrl,
  previousDocumentGeneration = null,
  requireVisible = false,
  extensionApiProfile = 'entropy_runtime',
  lastSnapshot = null,
} = {}) {
  return {
    expectedUrl,
    requireVisible: requireVisible === true,
    extensionApiProfile,
    priorDocumentGeneration: normalizePageDocumentGeneration(previousDocumentGeneration),
    currentDocumentGeneration: normalizePageDocumentGeneration(lastSnapshot?.documentGeneration),
    currentVisibilityState: normalizePageVisibilityState(lastSnapshot?.visibilityState),
    lastSnapshot,
  };
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function sanitizeServiceWorkerDiagnosticText(value) {
  return String(value || '')
    .replace(/chrome-extension:\/\/[^/\s]+/gi, 'chrome-extension://<extension>')
    .replace(/https?:\/\/[^\s)\]}]+/gi, '<url>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SERVICE_WORKER_DIAGNOSTIC_TEXT_LIMIT);
}

function serializeRemoteObject(remoteObject) {
  if (Object.prototype.hasOwnProperty.call(remoteObject || {}, 'value')) {
    const value = remoteObject.value;
    return typeof value === 'string'
      ? sanitizeServiceWorkerDiagnosticText(value)
      : sanitizeServiceWorkerDiagnosticText(JSON.stringify(value));
  }
  return sanitizeServiceWorkerDiagnosticText(
    remoteObject?.description || remoteObject?.className || remoteObject?.type,
  );
}

export async function getTargetInfos(cdp) {
  const result = await cdp.send('Target.getTargets');
  return Array.isArray(result.targetInfos) ? result.targetInfos : [];
}

export function findExtensionServiceWorkerTarget(targets, extensionId) {
  const expectedUrl = `chrome-extension://${extensionId}${SERVICE_WORKER_SCRIPT_PATH}`;
  return (Array.isArray(targets) ? targets : []).find((target) => (
    target?.type === 'service_worker' && String(target?.url || '') === expectedUrl
  )) || null;
}

export class ServiceWorkerCdpDiagnostics {
  constructor(cdp, extensionId, {
    now = () => Date.now(),
    pauseWorkerOnStart = false,
    waitForDelay = wait,
  } = {}) {
    this.cdp = cdp;
    this.extensionId = extensionId;
    this.now = now;
    this.pauseWorkerOnStart = pauseWorkerOnStart === true;
    this.waitForDelay = waitForDelay;
    this.targets = new Map();
    this.sessions = new Map();
    this.targetAttachPromises = new Map();
    this.sessionReadyPromises = new Map();
    this.unsubscribers = [];
    this.generationSequence = 0;
    this.collectorErrors = [];
  }

  isOwnedServiceWorker(targetInfo) {
    return targetInfo?.type === 'service_worker'
      && String(targetInfo?.url || '')
        === `chrome-extension://${this.extensionId}${SERVICE_WORKER_SCRIPT_PATH}`;
  }

  rememberCollectorError(stage, error) {
    if (this.collectorErrors.length >= SERVICE_WORKER_COLLECTOR_ERROR_LIMIT) return;
    this.collectorErrors.push({
      stage,
      atEpochMs: this.now(),
      error: sanitizeServiceWorkerDiagnosticText(error?.message || error),
    });
  }

  getOrCreateTarget(targetInfo, sessionId = null) {
    const targetId = targetInfo?.targetId;
    if (!targetId) return null;
    let record = this.targets.get(targetId);
    if (!record) {
      record = {
        targetId,
        generation: ++this.generationSequence,
        url: targetInfo.url,
        observedAtEpochMs: this.now(),
        diagnosticsAttachedAtEpochMs: null,
        detachedAtEpochMs: null,
        sessionId: null,
        entries: [],
        droppedEntryCount: 0,
      };
      this.targets.set(targetId, record);
    }
    if (sessionId) {
      record.sessionId = sessionId;
      record.detachedAtEpochMs = null;
      this.sessions.set(sessionId, targetId);
    }
    return record;
  }

  appendEntry(sessionId, entry) {
    const targetId = this.sessions.get(sessionId);
    const record = targetId ? this.targets.get(targetId) : null;
    if (!record) return;
    if (record.entries.length >= SERVICE_WORKER_DIAGNOSTIC_ENTRY_LIMIT) {
      record.droppedEntryCount += 1;
      return;
    }
    record.entries.push({ atEpochMs: this.now(), ...entry });
  }

  async handleAttached(params) {
    const { sessionId, targetInfo, waitingForDebugger } = params;
    if (!this.isOwnedServiceWorker(targetInfo)) {
      if (waitingForDebugger) {
        await this.cdp.send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => {});
      }
      return;
    }
    const existingReadyPromise = this.sessionReadyPromises.get(sessionId);
    if (existingReadyPromise) return existingReadyPromise;
    const record = this.getOrCreateTarget(targetInfo, sessionId);
    const readyPromise = (async () => {
      try {
        await this.cdp.send('Runtime.enable', {}, sessionId);
        await this.cdp.send('Log.enable', {}, sessionId).catch(() => {});
        record.diagnosticsAttachedAtEpochMs = this.now();
        return true;
      } catch (error) {
        this.rememberCollectorError('worker_runtime_enable', error);
        return false;
      } finally {
        if (waitingForDebugger) {
          await this.cdp.send('Runtime.runIfWaitingForDebugger', {}, sessionId).catch((error) => {
            this.rememberCollectorError('worker_resume', error);
          });
        }
      }
    })();
    this.sessionReadyPromises.set(sessionId, readyPromise);
    return readyPromise;
  }

  async attachOwnedTarget(targetInfo) {
    if (!this.isOwnedServiceWorker(targetInfo)) return;
    const record = this.getOrCreateTarget(targetInfo);
    if (record?.sessionId) {
      return this.sessionReadyPromises.get(record.sessionId) || true;
    }
    const existingAttachPromise = this.targetAttachPromises.get(targetInfo.targetId);
    if (existingAttachPromise) return existingAttachPromise;
    const attachPromise = (async () => {
      try {
        const { sessionId } = await this.cdp.send('Target.attachToTarget', {
          targetId: targetInfo.targetId,
          flatten: true,
        });
        return await this.handleAttached({
          sessionId,
          targetInfo,
          waitingForDebugger: false,
        });
      } catch (error) {
        this.rememberCollectorError('worker_attach', error);
        return false;
      } finally {
        this.targetAttachPromises.delete(targetInfo.targetId);
      }
    })();
    this.targetAttachPromises.set(targetInfo.targetId, attachPromise);
    return attachPromise;
  }

  async start() {
    this.unsubscribers.push(
      this.cdp.on('Target.targetCreated', ({ targetInfo }) => {
        if (!this.isOwnedServiceWorker(targetInfo)) return;
        this.getOrCreateTarget(targetInfo);
      }),
      this.cdp.on('Target.attachedToTarget', (params) => this.handleAttached(params)),
      this.cdp.on('Target.detachedFromTarget', ({ sessionId, targetId }) => {
        const resolvedTargetId = targetId || this.sessions.get(sessionId);
        const record = resolvedTargetId ? this.targets.get(resolvedTargetId) : null;
        if (record) {
          record.detachedAtEpochMs = this.now();
          if (record.sessionId === sessionId) record.sessionId = null;
        }
        if (sessionId) this.sessions.delete(sessionId);
        if (sessionId) this.sessionReadyPromises.delete(sessionId);
      }),
      this.cdp.on('Runtime.consoleAPICalled', (params, sessionId) => {
        if (!['error', 'warning', 'warn'].includes(params?.type)) return;
        this.appendEntry(sessionId, {
          kind: 'console',
          level: params.type,
          text: (params.args || []).map(serializeRemoteObject).filter(Boolean).join(' '),
        });
      }),
      this.cdp.on('Runtime.exceptionThrown', (params, sessionId) => {
        const details = params?.exceptionDetails || {};
        this.appendEntry(sessionId, {
          kind: 'exception',
          level: 'error',
          text: sanitizeServiceWorkerDiagnosticText(
            details.exception?.description || details.text || 'Runtime exception',
          ),
          lineNumber: Number.isFinite(details.lineNumber) ? details.lineNumber : null,
          columnNumber: Number.isFinite(details.columnNumber) ? details.columnNumber : null,
        });
      }),
      this.cdp.on('Log.entryAdded', ({ entry }, sessionId) => {
        if (!['error', 'warning'].includes(entry?.level)) return;
        this.appendEntry(sessionId, {
          kind: 'log',
          level: entry.level,
          text: sanitizeServiceWorkerDiagnosticText(entry.text),
        });
      }),
    );
    await this.cdp.send('Target.setDiscoverTargets', { discover: true });
    if (this.pauseWorkerOnStart) {
      await this.cdp.send('Target.setAutoAttach', {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
        filter: [
          { type: 'service_worker', exclude: false },
          { exclude: true },
        ],
      });
    }
    await this.waitForDelay(SERVICE_WORKER_DISCOVERY_SETTLE_MS);
    const current = findExtensionServiceWorkerTarget(
      await getTargetInfos(this.cdp),
      this.extensionId,
    );
    const currentRecord = current ? this.targets.get(current.targetId) : null;
    if (
      this.pauseWorkerOnStart
      && current
      && !currentRecord?.sessionId
      && !current.attached
    ) {
      await this.attachOwnedTarget(current);
    }
  }

  async attachForRead(targetInfo) {
    if (!this.isOwnedServiceWorker(targetInfo)) return false;
    return (await this.attachOwnedTarget(targetInfo)) === true;
  }

  async readRuntimeTelemetry(targetId = null) {
    const record = targetId
      ? this.targets.get(targetId)
      : Array.from(this.targets.values()).at(-1);
    if (!record?.sessionId || record.detachedAtEpochMs !== null) return null;
    const result = await this.cdp.send('Runtime.evaluate', {
      expression: SERVICE_WORKER_RUNTIME_TELEMETRY_EXPRESSION,
      awaitPromise: true,
      returnByValue: true,
    }, record.sessionId).catch((error) => {
      this.rememberCollectorError('worker_telemetry_read', error);
      return null;
    });
    return result?.result?.value || null;
  }

  async snapshot(targetId = null) {
    const records = targetId
      ? [this.targets.get(targetId)].filter(Boolean)
      : Array.from(this.targets.values());
    return {
      instrumentationMode: this.pauseWorkerOnStart
        ? 'pause_on_start_diagnostic'
        : 'non_pausing_measurement',
      thresholdEligible: this.pauseWorkerOnStart !== true,
      targets: await Promise.all(records.map(async (record) => ({
        targetId: record.targetId,
        generation: record.generation,
        url: record.url,
        observedAtEpochMs: record.observedAtEpochMs,
        diagnosticsAttachedAtEpochMs: record.diagnosticsAttachedAtEpochMs,
        detachedAtEpochMs: record.detachedAtEpochMs,
        runtimeTelemetry: await this.readRuntimeTelemetry(record.targetId),
        entries: record.entries.map((entry) => ({ ...entry })),
        droppedEntryCount: record.droppedEntryCount,
      }))),
      collectorErrors: this.collectorErrors.map((entry) => ({ ...entry })),
    };
  }

  async detachTarget(targetId) {
    const record = targetId ? this.targets.get(targetId) : null;
    if (!record?.sessionId) return false;
    const sessionId = record.sessionId;
    await this.cdp.send('Target.detachFromTarget', { sessionId }).catch((error) => {
      this.rememberCollectorError('worker_detach', error);
    });
    record.detachedAtEpochMs = this.now();
    record.sessionId = null;
    this.sessions.delete(sessionId);
    this.sessionReadyPromises.delete(sessionId);
    return true;
  }

  stop() {
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  }
}
