const RELEASED_TARGET_STATUSES = new Set(['closed', 'already_absent']);

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function requireIdentifier(value, code) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized !== value) fail(code);
  return normalized;
}

function freezeTargetRecord(record) {
  return Object.freeze({
    targetId: record.targetId,
    tabId: Number.isInteger(record.tabId) ? record.tabId : null,
    purpose: record.purpose,
    initialUrl: record.initialUrl || null,
    acquiredAt: record.acquiredAt,
  });
}

export function resolveQaBrowserEpoch(browserVersion, fallback = 'unknown-browser') {
  const websocketUrl = typeof browserVersion?.webSocketDebuggerUrl === 'string'
    ? browserVersion.webSocketDebuggerUrl.trim()
    : '';
  if (!websocketUrl) return requireIdentifier(fallback, 'QA_BROWSER_EPOCH_REQUIRED');
  try {
    const parsed = new URL(websocketUrl);
    const browserId = parsed.pathname.match(/\/devtools\/browser\/([^/]+)$/u)?.[1];
    return browserId ? `cdp:${browserId}` : `cdp:${websocketUrl}`;
  } catch {
    fail('QA_BROWSER_EPOCH_INVALID', websocketUrl);
  }
}

export class QaBrowserTargetLease {
  constructor({
    browserEpoch,
    ownerId,
    baselineTargetIds = [],
    now = () => new Date().toISOString(),
  } = {}) {
    this.browserEpoch = requireIdentifier(browserEpoch, 'QA_BROWSER_EPOCH_REQUIRED');
    this.ownerId = requireIdentifier(ownerId, 'QA_BROWSER_TARGET_OWNER_REQUIRED');
    this.now = now;
    this.baselineTargetIds = new Set(
      Array.from(baselineTargetIds, (targetId) => (
        requireIdentifier(targetId, 'QA_BROWSER_BASELINE_TARGET_ID_INVALID')
      )),
    );
    this.targets = new Map();
  }

  owns(targetId) {
    return this.targets.has(targetId);
  }

  register({
    targetId,
    tabId = null,
    purpose,
    initialUrl = null,
  } = {}) {
    const normalizedTargetId = requireIdentifier(
      targetId,
      'QA_BROWSER_TARGET_ID_REQUIRED',
    );
    if (this.baselineTargetIds.has(normalizedTargetId)) {
      fail('QA_BROWSER_BASELINE_TARGET_OWNERSHIP_FORBIDDEN', normalizedTargetId);
    }
    if (this.targets.has(normalizedTargetId)) {
      fail('QA_BROWSER_TARGET_ALREADY_OWNED', normalizedTargetId);
    }
    const normalizedPurpose = requireIdentifier(
      purpose,
      'QA_BROWSER_TARGET_PURPOSE_REQUIRED',
    );
    if (tabId !== null && !Number.isInteger(tabId)) {
      fail('QA_BROWSER_TARGET_TAB_ID_INVALID', normalizedTargetId);
    }
    if (
      initialUrl !== null
      && (typeof initialUrl !== 'string' || !initialUrl.trim())
    ) {
      fail('QA_BROWSER_TARGET_INITIAL_URL_INVALID', normalizedTargetId);
    }
    const record = freezeTargetRecord({
      targetId: normalizedTargetId,
      tabId,
      purpose: normalizedPurpose,
      initialUrl,
      acquiredAt: this.now(),
    });
    this.targets.set(normalizedTargetId, record);
    return record;
  }

  snapshot() {
    return Object.freeze({
      browserEpoch: this.browserEpoch,
      ownerId: this.ownerId,
      baselineTargetCount: this.baselineTargetIds.size,
      ownedTargetCount: this.targets.size,
      ownedTargets: Object.freeze([...this.targets.values()]),
    });
  }

  async release(targetId, { closeTarget } = {}) {
    const record = this.targets.get(targetId);
    if (!record) fail('QA_BROWSER_TARGET_NOT_OWNED', targetId || 'missing');
    if (typeof closeTarget !== 'function') {
      fail('QA_BROWSER_TARGET_CLOSE_OWNER_REQUIRED', targetId);
    }
    const receipt = await closeTarget(targetId, record);
    if (
      !receipt
      || receipt.targetId !== targetId
      || !RELEASED_TARGET_STATUSES.has(receipt.status)
    ) {
      fail('QA_BROWSER_TARGET_CLOSE_RECEIPT_INVALID', targetId);
    }
    this.targets.delete(targetId);
    return Object.freeze({
      ...receipt,
      browserEpoch: this.browserEpoch,
      ownerId: this.ownerId,
      purpose: record.purpose,
      releasedAt: this.now(),
    });
  }

  async releaseAll({ closeTarget } = {}) {
    const receipts = [];
    const failures = [];
    for (const targetId of [...this.targets.keys()]) {
      try {
        receipts.push(await this.release(targetId, { closeTarget }));
      } catch (error) {
        failures.push(Object.freeze({ targetId, error }));
      }
    }
    if (failures.length > 0) {
      const error = new Error(
        `QA_BROWSER_TARGET_RELEASE_INCOMPLETE:${failures
          .map(({ targetId, error: failure }) => (
            `${targetId}:${failure?.message || failure}`
          ))
          .join('|')}`,
      );
      error.code = 'QA_BROWSER_TARGET_RELEASE_INCOMPLETE';
      error.receipts = Object.freeze(receipts);
      error.failures = Object.freeze(failures);
      throw error;
    }
    return Object.freeze(receipts);
  }
}

export {
  QaBrowserTargetLease as BrowserTargetLease,
  resolveQaBrowserEpoch as resolveBrowserEpoch,
};
