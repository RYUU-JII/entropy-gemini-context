import { randomUUID } from 'node:crypto';

const TARGET_CREATION_OWNER_PURPOSE_PATTERN = /^[a-z][a-z0-9_]{2,63}$/u;
const DEFAULT_TARGET_CREATION_RECOVERY_TIMEOUT_MS = 1_000;
const DEFAULT_TARGET_NAVIGATION_TIMEOUT_MS = 10_000;
const DEFAULT_TARGET_NAVIGATION_DETACH_TIMEOUT_MS = 1_000;
const DEFAULT_TARGET_WINDOW_READ_TIMEOUT_MS = 1_000;
const TARGET_CREATION_RECOVERY_POLL_INTERVAL_MS = 20;

function requireCdp(cdp) {
  if (!cdp || typeof cdp.send !== 'function') {
    throw new Error('QA_CDP_TARGET_OWNER_CONNECTION_REQUIRED');
  }
  return cdp;
}

function requireTargetId(targetId, code = 'QA_CDP_TARGET_ID_REQUIRED') {
  if (
    typeof targetId !== 'string'
    || !targetId
    || targetId !== targetId.trim()
  ) {
    throw new Error(code);
  }
  return targetId;
}

function projectQaCdpPageTargetWindowReceipt(targetId, targetWindow) {
  const windowBounds = targetWindow?.bounds;
  if (
    !Number.isSafeInteger(targetWindow?.windowId)
    || targetWindow.windowId <= 0
    || !windowBounds
    || !Number.isSafeInteger(windowBounds.left)
    || !Number.isSafeInteger(windowBounds.top)
    || !Number.isSafeInteger(windowBounds.width)
    || windowBounds.width <= 0
    || !Number.isSafeInteger(windowBounds.height)
    || windowBounds.height <= 0
    || !['normal', 'minimized', 'maximized', 'fullscreen'].includes(
      windowBounds.windowState,
    )
  ) {
    throw new Error('QA_CDP_PAGE_TARGET_WINDOW_RECEIPT_INVALID');
  }
  return Object.freeze({
    status: 'target_window_verified',
    targetId,
    windowId: targetWindow.windowId,
    windowBounds: Object.freeze({
      left: windowBounds.left,
      top: windowBounds.top,
      width: windowBounds.width,
      height: windowBounds.height,
      windowState: windowBounds.windowState,
    }),
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTargetCreationFailure(code, cause, recovery) {
  const error = new Error(code, { cause });
  error.code = code;
  error.stage = 'cdp_target_creation';
  error.recovery = Object.freeze(recovery);
  return error;
}

async function recoverAmbiguousQaCdpPageTargetCreation(cdp, {
  ownershipUrl,
  ownershipToken,
  ownerPurpose,
  browserEpoch,
  observedTargetIds,
  timeoutMs,
} = {}) {
  const ownershipReceipt = { ownershipToken, ownerPurpose, browserEpoch };
  const readObservedTargetId = () => (
    observedTargetIds.size === 1 ? [...observedTargetIds][0] : null
  );
  const deadlineAtMs = Date.now() + timeoutMs;
  do {
    const remainingMs = deadlineAtMs - Date.now();
    if (remainingMs <= 0) break;
    let targetInfos;
    try {
      targetInfos = await listQaCdpTargets(cdp, { timeoutMs: remainingMs });
    } catch (cause) {
      throw createTargetCreationFailure(
        'QA_CDP_PAGE_TARGET_CREATION_RECOVERY_INSPECTION_FAILED',
        cause,
        {
          status: 'creation_token_quarantined',
          ...ownershipReceipt,
          targetId: readObservedTargetId(),
          exactTargetCount: null,
        },
      );
    }
    const exactTargets = targetInfos.filter((target) => target?.url === ownershipUrl);
    const exactPageTargets = exactTargets.filter((target) => target.type === 'page');
    const candidateTargetIds = new Set([
      ...observedTargetIds,
      ...exactPageTargets.map((target) => target.targetId),
    ]);
    if (candidateTargetIds.size > 1 || exactTargets.length > 1) {
      throw createTargetCreationFailure(
        'QA_CDP_PAGE_TARGET_CREATION_RECOVERY_IDENTITY_AMBIGUOUS',
        null,
        {
          status: 'creation_token_quarantined',
          ...ownershipReceipt,
          targetId: readObservedTargetId(),
          exactTargetCount: exactPageTargets.length,
          observedTargetCount: observedTargetIds.size,
        },
      );
    }
    if (exactTargets.length === 1 && exactPageTargets.length === 0) {
      throw createTargetCreationFailure(
        'QA_CDP_PAGE_TARGET_CREATION_RECOVERY_TYPE_MISMATCH',
        null,
        {
          status: 'creation_token_quarantined',
          ...ownershipReceipt,
          targetId: readObservedTargetId(),
          exactTargetCount: 1,
          observedTargetCount: observedTargetIds.size,
        },
      );
    }
    if (candidateTargetIds.size === 1) {
      const [candidateTargetId] = candidateTargetIds;
      const candidateTarget = targetInfos.find(
        (target) => target.targetId === candidateTargetId,
      );
      if (!candidateTarget && observedTargetIds.has(candidateTargetId)) {
        return Object.freeze({
          status: 'ambiguous_creation_event_target_already_absent',
          ...ownershipReceipt,
          targetId: candidateTargetId,
          closeStatus: 'already_absent',
        });
      }
      if (!candidateTarget) {
        throw createTargetCreationFailure(
          'QA_CDP_PAGE_TARGET_CREATION_RECOVERY_IDENTITY_UNVERIFIED',
          null,
          {
            status: 'creation_token_quarantined',
            ...ownershipReceipt,
            targetId: readObservedTargetId(),
            exactTargetCount: exactPageTargets.length,
            observedTargetCount: observedTargetIds.size,
          },
        );
      }
      try {
        const closeReceipt = await closeQaCdpTarget(cdp, candidateTargetId, {
          timeoutMs: Math.max(1, deadlineAtMs - Date.now()),
        });
        return Object.freeze({
          status: 'ambiguous_creation_target_closed',
          ...ownershipReceipt,
          targetId: candidateTargetId,
          closeStatus: closeReceipt.status,
        });
      } catch (cause) {
        throw createTargetCreationFailure(
          'QA_CDP_PAGE_TARGET_CREATION_RECOVERY_CLOSE_FAILED',
          cause,
          {
            status: 'creation_token_quarantined',
            ...ownershipReceipt,
            targetId: candidateTargetId,
            exactTargetCount: 1,
            observedTargetCount: observedTargetIds.size,
          },
        );
      }
    }
    const remainingAfterInspectionMs = deadlineAtMs - Date.now();
    if (remainingAfterInspectionMs <= 0) break;
    await sleep(Math.min(
      TARGET_CREATION_RECOVERY_POLL_INTERVAL_MS,
      remainingAfterInspectionMs,
    ));
  } while (true);
  throw createTargetCreationFailure(
    'QA_CDP_PAGE_TARGET_CREATION_RECOVERY_UNRESOLVED',
    null,
    {
      status: 'creation_token_quarantined',
      ...ownershipReceipt,
      targetId: readObservedTargetId(),
      exactTargetCount: null,
      observedTargetCount: observedTargetIds.size,
    },
  );
}

async function requireCreatedQaCdpPageTargetIdentity(cdp, {
  targetId,
  ownershipUrl,
  timeoutMs,
} = {}) {
  const deadlineAtMs = Date.now() + timeoutMs;
  do {
    const remainingMs = deadlineAtMs - Date.now();
    if (remainingMs <= 0) break;
    const targetInfos = await listQaCdpTargets(cdp, { timeoutMs: remainingMs });
    const targetInfo = targetInfos.find((target) => target.targetId === targetId);
    if (targetInfo) {
      if (targetInfo.type !== 'page' || targetInfo.url !== ownershipUrl) {
        throw createTargetCreationFailure(
          'QA_CDP_PAGE_TARGET_CREATION_IDENTITY_MISMATCH',
          null,
          {
            status: 'response_target_identity_mismatch',
            exactTargetCount: targetInfos.filter(
              (target) => target.url === ownershipUrl,
            ).length,
          },
        );
      }
      return Object.freeze({
        status: 'response_target_identity_verified',
        targetId,
      });
    }
    const remainingAfterInspectionMs = deadlineAtMs - Date.now();
    if (remainingAfterInspectionMs <= 0) break;
    await sleep(Math.min(
      TARGET_CREATION_RECOVERY_POLL_INTERVAL_MS,
      remainingAfterInspectionMs,
    ));
  } while (true);
  throw createTargetCreationFailure(
    'QA_CDP_PAGE_TARGET_CREATION_IDENTITY_UNVERIFIED',
    null,
    {
      status: 'response_target_identity_unverified',
      exactTargetCount: null,
    },
  );
}

export async function listQaCdpTargets(cdp, { timeoutMs = null } = {}) {
  if (timeoutMs !== null && (!Number.isInteger(timeoutMs) || timeoutMs <= 0)) {
    throw new Error(`QA_CDP_TARGET_LIST_TIMEOUT_INVALID:${timeoutMs}`);
  }
  const connection = requireCdp(cdp);
  const result = timeoutMs === null
    ? await connection.send('Target.getTargets')
    : await connection.send('Target.getTargets', {}, null, { timeoutMs });
  if (
    !Array.isArray(result?.targetInfos)
    || result.targetInfos.some((target) => (
      !target
      || typeof target !== 'object'
      || Array.isArray(target)
      || typeof target.targetId !== 'string'
      || !target.targetId
    ))
  ) {
    throw new Error('QA_CDP_TARGET_LIST_INVALID');
  }
  return result.targetInfos;
}

export {
  closeQaCdpTarget as closeCdpTarget,
  createQaCdpPageTarget as createCdpPageTarget,
  listQaCdpTargets as listCdpTargets,
};

export async function createQaCdpPageTarget(cdp, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('QA_CDP_PAGE_TARGET_OPTIONS_INVALID');
  }
  const unknownKeys = Object.keys(options).filter((key) => ![
    'url',
    'background',
    'timeoutMs',
    'deadlineAtMs',
    'recoverAmbiguousCreation',
    'ownerPurpose',
    'browserEpoch',
    'onOwnershipPrepared',
    'recoveryTimeoutMs',
  ].includes(key));
  if (unknownKeys.length > 0) {
    throw new Error(`QA_CDP_PAGE_TARGET_OPTION_UNKNOWN:${unknownKeys.sort().join(',')}`);
  }
  const {
    url = 'about:blank',
    background = false,
    timeoutMs = null,
    deadlineAtMs = null,
    recoverAmbiguousCreation = false,
    ownerPurpose = null,
    browserEpoch = null,
    onOwnershipPrepared = null,
    recoveryTimeoutMs = DEFAULT_TARGET_CREATION_RECOVERY_TIMEOUT_MS,
  } = options;
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('QA_CDP_PAGE_TARGET_URL_REQUIRED');
  }
  if (timeoutMs !== null && (!Number.isInteger(timeoutMs) || timeoutMs <= 0)) {
    throw new Error(`QA_CDP_PAGE_TARGET_TIMEOUT_INVALID:${timeoutMs}`);
  }
  if (deadlineAtMs !== null && (!Number.isSafeInteger(deadlineAtMs) || deadlineAtMs <= 0)) {
    throw new Error(`QA_CDP_PAGE_TARGET_DEADLINE_INVALID:${deadlineAtMs}`);
  }
  if (typeof recoverAmbiguousCreation !== 'boolean') {
    throw new Error('QA_CDP_PAGE_TARGET_RECOVERY_POLICY_INVALID');
  }
  if (
    recoverAmbiguousCreation
    && (
      url !== 'about:blank'
      || typeof ownerPurpose !== 'string'
      || !TARGET_CREATION_OWNER_PURPOSE_PATTERN.test(ownerPurpose)
      || typeof browserEpoch !== 'string'
      || !browserEpoch
      || browserEpoch !== browserEpoch.trim()
    )
  ) {
    throw new Error('QA_CDP_PAGE_TARGET_RECOVERY_OWNER_INVALID');
  }
  if (!recoverAmbiguousCreation && (ownerPurpose !== null || browserEpoch !== null)) {
    throw new Error('QA_CDP_PAGE_TARGET_RECOVERY_OWNER_WITHOUT_POLICY');
  }
  if (
    onOwnershipPrepared !== null
    && (!recoverAmbiguousCreation || typeof onOwnershipPrepared !== 'function')
  ) {
    throw new Error('QA_CDP_PAGE_TARGET_OWNERSHIP_PREPARER_INVALID');
  }
  if (!Number.isInteger(recoveryTimeoutMs) || recoveryTimeoutMs <= 0) {
    throw new Error(`QA_CDP_PAGE_TARGET_RECOVERY_TIMEOUT_INVALID:${recoveryTimeoutMs}`);
  }
  const connection = requireCdp(cdp);
  const remainingAdmissionTimeoutMs = (maximumMs) => {
    if (deadlineAtMs === null) return maximumMs;
    const remainingMs = deadlineAtMs - Date.now();
    if (remainingMs <= 0) {
      throw new Error('QA_CDP_PAGE_TARGET_DEADLINE_EXHAUSTED');
    }
    return maximumMs === null ? remainingMs : Math.min(maximumMs, remainingMs);
  };
  const ownershipToken = recoverAmbiguousCreation ? randomUUID() : null;
  const ownershipUrl = ownershipToken === null
    ? url
    : `about:blank#browser-qa-owner=${ownershipToken}`;
  if (onOwnershipPrepared) {
    await onOwnershipPrepared(Object.freeze({
      ownershipUrl,
      ownershipToken,
      ownerPurpose,
      browserEpoch,
    }));
  }
  const params = {
    url: ownershipUrl,
    ...(background === true ? { background: true } : {}),
  };
  let result;
  const observedTargetIds = new Set();
  let unsubscribeTargetCreated = null;
  if (ownershipToken !== null) {
    if (typeof connection.subscribe !== 'function') {
      throw new Error('QA_CDP_PAGE_TARGET_CREATION_EVENT_OWNER_REQUIRED');
    }
    unsubscribeTargetCreated = connection.subscribe('Target.targetCreated', (event) => {
      const targetInfo = event?.params?.targetInfo;
      if (
        targetInfo?.type === 'page'
        && targetInfo?.url === ownershipUrl
        && typeof targetInfo.targetId === 'string'
        && targetInfo.targetId
      ) {
        observedTargetIds.add(targetInfo.targetId);
      }
    });
    try {
      await connection.send('Target.setDiscoverTargets', { discover: true }, null, {
        timeoutMs: remainingAdmissionTimeoutMs(Math.min(
          timeoutMs ?? recoveryTimeoutMs,
          recoveryTimeoutMs,
        )),
      });
    } catch (cause) {
      unsubscribeTargetCreated();
      throw createTargetCreationFailure(
        'QA_CDP_PAGE_TARGET_CREATION_DISCOVERY_REQUIRED',
        cause,
        {
          status: 'creation_not_attempted',
          ownershipToken,
          ownerPurpose,
          browserEpoch,
          exactTargetCount: 0,
          observedTargetCount: 0,
        },
      );
    }
  }
  try {
    const createTimeoutMs = remainingAdmissionTimeoutMs(timeoutMs);
    result = createTimeoutMs === null
      ? await connection.send('Target.createTarget', params)
      : await connection.send('Target.createTarget', params, null, {
        timeoutMs: createTimeoutMs,
      });
    if (typeof result?.targetId !== 'string' || !result.targetId) {
      throw new Error('QA_CDP_PAGE_TARGET_ID_MISSING');
    }
  } catch (cause) {
    try {
      if (ownershipToken === null) throw cause;
      const recovery = await recoverAmbiguousQaCdpPageTargetCreation(connection, {
        ownershipUrl,
        ownershipToken,
        ownerPurpose,
        browserEpoch,
        observedTargetIds,
        timeoutMs: recoveryTimeoutMs,
      });
      throw createTargetCreationFailure(
        'QA_CDP_PAGE_TARGET_CREATE_FAILED_RECOVERED',
        cause,
        recovery,
      );
    } finally {
      unsubscribeTargetCreated?.();
    }
  }
  if (ownershipToken !== null) {
    try {
      await requireCreatedQaCdpPageTargetIdentity(connection, {
        targetId: result.targetId,
        ownershipUrl,
        timeoutMs: remainingAdmissionTimeoutMs(recoveryTimeoutMs),
      });
    } catch (identityCause) {
      try {
        const recovery = await recoverAmbiguousQaCdpPageTargetCreation(connection, {
          ownershipUrl,
          ownershipToken,
          ownerPurpose,
          browserEpoch,
          observedTargetIds,
          timeoutMs: recoveryTimeoutMs,
        });
        unsubscribeTargetCreated?.();
        throw createTargetCreationFailure(
          'QA_CDP_PAGE_TARGET_CREATION_IDENTITY_FAILED_RECOVERED',
          identityCause,
          recovery,
        );
      } catch (recoveryCause) {
        unsubscribeTargetCreated?.();
        if (recoveryCause?.code === 'QA_CDP_PAGE_TARGET_CREATION_IDENTITY_FAILED_RECOVERED') {
          throw recoveryCause;
        }
        const failure = new AggregateError(
          [identityCause, recoveryCause],
          'QA_CDP_PAGE_TARGET_CREATION_IDENTITY_AND_CLEANUP_FAILED',
        );
        failure.code = 'QA_CDP_PAGE_TARGET_CREATION_IDENTITY_AND_CLEANUP_FAILED';
        failure.stage = 'cdp_target_creation';
        failure.recovery = Object.freeze({
          status: 'response_target_quarantined',
          ownershipToken,
          ownerPurpose,
          browserEpoch,
          targetId: observedTargetIds.size === 1
            ? [...observedTargetIds][0]
            : null,
        });
        throw failure;
      }
    }
  }
  unsubscribeTargetCreated?.();
  return Object.freeze({
    targetId: result.targetId,
    initialUrl: ownershipUrl,
    ownershipToken,
    ownerPurpose,
    browserEpoch,
    background: background === true,
  });
}

export async function readQaCdpPageTargetWindow(cdp, targetId, {
  timeoutMs = DEFAULT_TARGET_WINDOW_READ_TIMEOUT_MS,
} = {}) {
  const exactTargetId = requireTargetId(
    targetId,
    'QA_CDP_PAGE_TARGET_WINDOW_TARGET_ID_REQUIRED',
  );
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`QA_CDP_PAGE_TARGET_WINDOW_TIMEOUT_INVALID:${timeoutMs}`);
  }
  const connection = requireCdp(cdp);
  const targetInfo = await connection.send(
    'Target.getTargetInfo',
    { targetId: exactTargetId },
    null,
    { timeoutMs },
  );
  if (
    targetInfo?.targetInfo?.targetId !== exactTargetId
    || targetInfo.targetInfo.type !== 'page'
  ) {
    throw new Error('QA_CDP_PAGE_TARGET_WINDOW_IDENTITY_MISMATCH');
  }
  const targetWindow = await connection.send(
    'Browser.getWindowForTarget',
    { targetId: exactTargetId },
    null,
    { timeoutMs },
  );
  return projectQaCdpPageTargetWindowReceipt(exactTargetId, targetWindow);
}

function requireOwnedPageTargetNavigationReceipt(receipt) {
  const expectedKeys = [
    'background',
    'browserEpoch',
    'initialUrl',
    'ownerPurpose',
    'ownershipToken',
    'targetId',
  ];
  if (
    !receipt
    || typeof receipt !== 'object'
    || Array.isArray(receipt)
    || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(expectedKeys)
    || typeof receipt.targetId !== 'string'
    || !receipt.targetId
    || receipt.targetId !== receipt.targetId.trim()
    || typeof receipt.ownershipToken !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
      .test(receipt.ownershipToken)
    || receipt.initialUrl !== `about:blank#browser-qa-owner=${receipt.ownershipToken}`
    || typeof receipt.ownerPurpose !== 'string'
    || !TARGET_CREATION_OWNER_PURPOSE_PATTERN.test(receipt.ownerPurpose)
    || typeof receipt.browserEpoch !== 'string'
    || !receipt.browserEpoch
    || receipt.browserEpoch !== receipt.browserEpoch.trim()
    || typeof receipt.background !== 'boolean'
  ) {
    throw new Error('QA_CDP_PAGE_TARGET_NAVIGATION_OWNERSHIP_REQUIRED');
  }
  return receipt;
}

export async function navigateQaCdpPageTarget(cdp, creationReceipt, url, {
  timeoutMs = DEFAULT_TARGET_NAVIGATION_TIMEOUT_MS,
  activateTarget = true,
} = {}) {
  const ownedTarget = requireOwnedPageTargetNavigationReceipt(creationReceipt);
  const { targetId } = ownedTarget;
  if (typeof url !== 'string' || !url.trim() || url !== url.trim()) {
    throw new Error('QA_CDP_PAGE_TARGET_NAVIGATION_URL_REQUIRED');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`QA_CDP_PAGE_TARGET_NAVIGATION_TIMEOUT_INVALID:${timeoutMs}`);
  }
  if (typeof activateTarget !== 'boolean') {
    throw new Error('QA_CDP_PAGE_TARGET_NAVIGATION_ACTIVATION_POLICY_INVALID');
  }
  const connection = requireCdp(cdp);
  const deadlineAtMs = Date.now() + timeoutMs;
  const remainingMs = () => {
    const remaining = deadlineAtMs - Date.now();
    if (remaining <= 0) {
      throw new Error('QA_CDP_PAGE_TARGET_NAVIGATION_DEADLINE_EXHAUSTED');
    }
    return remaining;
  };
  const targetInfoResult = await connection.send(
    'Target.getTargetInfo',
    { targetId },
    null,
    { timeoutMs: remainingMs() },
  );
  if (
    targetInfoResult?.targetInfo?.targetId !== targetId
    || targetInfoResult.targetInfo.type !== 'page'
    || targetInfoResult.targetInfo.url !== ownedTarget.initialUrl
  ) {
    throw new Error('QA_CDP_PAGE_TARGET_NAVIGATION_IDENTITY_MISMATCH');
  }
  const attached = await connection.send(
    'Target.attachToTarget',
    { targetId, flatten: true },
    null,
    { timeoutMs: remainingMs() },
  );
  if (
    typeof attached?.sessionId !== 'string'
    || !attached.sessionId
    || attached.sessionId !== attached.sessionId.trim()
  ) {
    throw new Error('QA_CDP_PAGE_TARGET_NAVIGATION_SESSION_REQUIRED');
  }
  const { sessionId } = attached;
  let primaryError = null;
  try {
    const navigation = await connection.send(
      'Page.navigate',
      { url },
      sessionId,
      { timeoutMs: remainingMs() },
    );
    if (typeof navigation?.frameId !== 'string' || !navigation.frameId) {
      throw new Error('QA_CDP_PAGE_TARGET_NAVIGATION_FRAME_REQUIRED');
    }
    if (typeof navigation.errorText === 'string' && navigation.errorText) {
      throw new Error('QA_CDP_PAGE_TARGET_NAVIGATION_REJECTED');
    }
    if (activateTarget) {
      await connection.send(
        'Target.activateTarget',
        { targetId },
        null,
        { timeoutMs: remainingMs() },
      );
    }
    const targetWindow = await connection.send(
      'Browser.getWindowForTarget',
      { targetId },
      null,
      { timeoutMs: remainingMs() },
    );
    const targetWindowReceipt = projectQaCdpPageTargetWindowReceipt(
      targetId,
      targetWindow,
    );
    return Object.freeze({
      status: 'navigation_requested',
      targetId,
      frameId: navigation.frameId,
      loaderId: typeof navigation.loaderId === 'string' && navigation.loaderId
        ? navigation.loaderId
        : null,
      windowId: targetWindowReceipt.windowId,
      windowBounds: targetWindowReceipt.windowBounds,
    });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await connection.send(
        'Target.detachFromTarget',
        { sessionId },
        null,
        { timeoutMs: DEFAULT_TARGET_NAVIGATION_DETACH_TIMEOUT_MS },
      );
    } catch (detachError) {
      if (primaryError) {
        throw new AggregateError(
          [primaryError, detachError],
          'QA_CDP_PAGE_TARGET_NAVIGATION_AND_DETACH_FAILED',
          { cause: primaryError },
        );
      }
      throw detachError;
    }
  }
}

export async function enableQaCdpNoFocusPageExecution(
  cdp,
  creationReceipt,
  sessionId,
  { timeoutMs = 1_000 } = {},
) {
  const ownedTarget = requireOwnedPageTargetNavigationReceipt(creationReceipt);
  if (typeof sessionId !== 'string' || !sessionId || sessionId !== sessionId.trim()) {
    throw new Error('QA_CDP_PAGE_TARGET_NO_FOCUS_SESSION_REQUIRED');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`QA_CDP_PAGE_TARGET_NO_FOCUS_TIMEOUT_INVALID:${timeoutMs}`);
  }
  const connection = requireCdp(cdp);
  const targetInfo = await connection.send(
    'Target.getTargetInfo',
    { targetId: ownedTarget.targetId },
    null,
    { timeoutMs },
  );
  if (
    targetInfo?.targetInfo?.targetId !== ownedTarget.targetId
    || targetInfo.targetInfo.type !== 'page'
  ) {
    throw new Error('QA_CDP_PAGE_TARGET_NO_FOCUS_IDENTITY_MISMATCH');
  }
  await connection.send(
    'Emulation.setFocusEmulationEnabled',
    { enabled: true },
    sessionId,
    { timeoutMs },
  );
  await connection.send(
    'Page.setWebLifecycleState',
    { state: 'active' },
    sessionId,
    { timeoutMs },
  );
  const evaluated = await connection.send(
    'Runtime.evaluate',
    {
      expression: '({ visibilityState: document.visibilityState, hasFocus: document.hasFocus() })',
      returnByValue: true,
      awaitPromise: false,
    },
    sessionId,
    { timeoutMs },
  );
  const state = evaluated?.result?.value;
  if (state?.visibilityState !== 'visible' || state?.hasFocus !== true) {
    throw new Error('QA_CDP_PAGE_TARGET_NO_FOCUS_EXECUTION_NOT_CONFIRMED');
  }
  return Object.freeze({
    status: 'no_focus_execution_confirmed',
    targetId: ownedTarget.targetId,
    visibilityState: state.visibilityState,
    hasFocus: state.hasFocus,
    osFocusRequestIssued: false,
  });
}

export async function closeQaCdpTarget(cdp, targetId, {
  timeoutMs = 1_000,
  pollIntervalMs = 20,
  allowConfirmedBrowserDisconnect = false,
} = {}) {
  if (typeof targetId !== 'string' || !targetId) {
    throw new Error('QA_CDP_TARGET_ID_REQUIRED');
  }
  const boundedTimeoutMs = Math.max(0, Number(timeoutMs) || 0);
  const deadline = Date.now() + boundedTimeoutMs;
  const remainingCommandTimeoutMs = () => Math.max(1, deadline - Date.now());
  let closeResult = null;
  let closeError = null;
  try {
    closeResult = await requireCdp(cdp).send(
      'Target.closeTarget',
      { targetId },
      null,
      { timeoutMs: remainingCommandTimeoutMs() },
    );
    if (closeResult?.success !== true) {
      closeError = new Error('Target.closeTarget did not confirm success');
    }
  } catch (error) {
    closeError = error;
  }

  do {
    let targets;
    try {
      targets = await listQaCdpTargets(cdp, {
        timeoutMs: remainingCommandTimeoutMs(),
      });
    } catch (error) {
      const disconnectObserved = [
        error,
        error?.cause,
        error?.cause?.cause,
      ].some((candidate) => (
        candidate?.code === 'BROWSER_QA_CDP_WEBSOCKET_CLOSED'
        || candidate?.code === 'BROWSER_QA_CDP_WEBSOCKET_ERROR'
        || candidate?.code === 'BROWSER_QA_CDP_WEBSOCKET_NOT_OPEN'
        || candidate?.code === 'CDP_WEBSOCKET_CLOSED'
        || candidate?.code === 'CDP_WEBSOCKET_NOT_OPEN'
        || candidate?.message === 'CDP_WEBSOCKET_CLOSED'
      ));
      if (
        allowConfirmedBrowserDisconnect === true
        && closeResult?.success === true
        && disconnectObserved
      ) {
        return Object.freeze({ targetId, status: 'closed' });
      }
      throw new Error(
        `QA_CDP_TARGET_CLOSE_INSPECTION_FAILED:${targetId}:${error?.message || error}`,
        { cause: error },
      );
    }
    if (!targets.some((target) => target?.targetId === targetId)) {
      return Object.freeze({
        targetId,
        status: closeResult?.success === true ? 'closed' : 'already_absent',
      });
    }
    if (closeError || Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(
      resolve,
      Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())),
    ));
  } while (true);

  throw new Error(
    `QA_CDP_TARGET_CLOSE_UNCONFIRMED:${targetId}:${closeError?.message || 'target still present'}`,
    closeError ? { cause: closeError } : undefined,
  );
}
