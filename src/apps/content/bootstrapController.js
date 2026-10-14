import { ensureFrictionGlobalStyles } from '../../domains/nudge/visual/styleInjection.js';
import {
  installProtectionRuntimeReceiver,
  startProtectionRuntimeSidecars,
  teardownProtectionRuntimeSidecars,
  teardownProtectionRuntimeReceiver,
} from '../../domains/protection/content/ProtectionController.js';
import { applyEarlyRuntimeBootstrapSnapshot } from '../../domains/protection/content/bootstrapEarlyRuntime.js';
import { clearProtectionRuntimeEffects } from '../../domains/protection/content/runtime/ProtectionFrictionModifierRuntime.js';
import {
  installRitualSurfaceLedgerReporter,
  teardownRitualSurfaceLedgerReporter,
} from '../../domains/protection/content/runtime/ritualSurfaceLedgerReporter.js';
import { createContentBootstrapSidecars } from './bootstrap/contentSidecars.js';
import interventionAdmissionClient from '../../domains/nudge/runtime/interventionAdmissionClient.js';
import {
  activateBootstrapAttempt,
  assertBootstrapAttemptCurrent,
  isBootstrapAttemptCurrent,
  publishBootstrapState,
  readBootstrapAttemptLease,
  readBootstrapState,
  revokeBootstrapAttempt,
} from './bootstrap/bootstrapState.js';
import { installRuntimeControlChannel } from './bootstrap/runtimeControlChannel.js';
import { loadCLSEAlertOverlay } from '@content-clse-alert-overlay';
import { suppressPrepaintVisualEffects } from '../../domains/protection/content/prepaintVisualRuntime.js';
import {
  startTopFrameMediaDiagnostics,
  teardownTopFrameMediaDiagnostics,
} from './topFrameMediaDiagnosticsReporter.js';

let contentRuntimeEpoch = 0;
let contentContextInvalidated = false;
let clseAlertOverlayPromise = null;
const CONTENT_CLSE_ALERT_OVERLAY_ENABLED = (
  typeof __ENTROPY_BUILD_ENABLE_CONTENT_CLSE_ALERT_OVERLAY__ !== 'undefined'
    ? __ENTROPY_BUILD_ENABLE_CONTENT_CLSE_ALERT_OVERLAY__
    : true
);

const contentSidecars = createContentBootstrapSidecars({
  getEpoch: () => contentRuntimeEpoch,
  bumpEpoch: () => {
    contentRuntimeEpoch += 1;
    return contentRuntimeEpoch;
  },
});

function isBootstrapInProgress(state) {
  return (
    state?.status === 'active'
    || state?.status === 'receiver_ready'
    || state?.status === 'bootstrapping'
  );
}

function createContentBootstrapError(code, details = {}) {
  const error = new Error(code);
  error.name = 'ContentBootstrapError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function describeBootstrapError(error, fallback = 'CONTENT_BOOTSTRAP_FAILED') {
  return String(error?.message || error || fallback);
}

function isEpochStaleBootstrapError(error) {
  return error?.code === 'CONTENT_BOOTSTRAP_EPOCH_STALE'
    || error?.code === 'CONTENT_BOOTSTRAP_SIDECAR_EPOCH_STALE'
    || error?.code === 'CONTENT_BOOTSTRAP_ATTEMPT_STALE';
}

function isEpochStale(epoch) {
  return epoch !== contentRuntimeEpoch;
}

function assertEpochCurrent(epoch, phase) {
  if (!isEpochStale(epoch)) return;
  throw createContentBootstrapError('CONTENT_BOOTSTRAP_EPOCH_STALE', {
    phase,
    expectedEpoch: epoch,
    actualEpoch: contentRuntimeEpoch,
    state: readBootstrapState(),
  });
}

function isReplacingPreviousAttempt(previous, attempt) {
  const previousAttemptId = Number(previous?.attemptId);
  const replacedAttemptId = Number(attempt?.replacesAttemptId);
  return Number.isInteger(previousAttemptId)
    && previousAttemptId > 0
    && Number.isInteger(replacedAttemptId)
    && replacedAttemptId === previousAttemptId;
}

function assertAttemptCurrent(attempt, phase) {
  return assertBootstrapAttemptCurrent(attempt, phase);
}

function waitForAttempt(promise, attempt, phase) {
  assertAttemptCurrent(attempt, `${phase}_before_wait`);
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      attempt.signal.removeEventListener('abort', handleAbort);
      callback(value);
    };
    const handleAbort = () => {
      try {
        assertAttemptCurrent(attempt, `${phase}_cancelled`);
      } catch (error) {
        settle(reject, error);
      }
    };
    attempt.signal.addEventListener('abort', handleAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => {
        try {
          assertAttemptCurrent(attempt, `${phase}_after_wait`);
          settle(resolve, value);
        } catch (error) {
          settle(reject, error);
        }
      },
      (error) => settle(reject, error),
    );
    if (attempt.signal.aborted) handleAbort();
  });
}

function createStaleAttemptNoop(attempt, error, phase = 'bootstrap_completion') {
  const currentState = readBootstrapState();
  return Object.freeze({
    status: 'stale_noop',
    staleNoop: true,
    code: 'CONTENT_BOOTSTRAP_ATTEMPT_STALE_NOOP',
    phase,
    attemptId: attempt?.attemptId ?? null,
    currentAttemptId: readBootstrapAttemptLease()?.attemptId ?? null,
    currentStatus: currentState?.status || null,
    reason: describeBootstrapError(error, 'CONTENT_BOOTSTRAP_ATTEMPT_STALE'),
  });
}

async function settleRuntimeCleanup(operations) {
  const results = await Promise.allSettled(operations.map(async (run) => run()));
  const failures = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
  if (failures.length > 0) throw new AggregateError(failures, 'CONTENT_RUNTIME_CLEANUP_FAILED');
}

function clearContentRuntimeEffects() {
  return settleRuntimeCleanup([
    () => suppressPrepaintVisualEffects(),
    () => clearProtectionRuntimeEffects(),
  ]);
}

function getCLSEAlertOverlay() {
  clseAlertOverlayPromise ||= loadCLSEAlertOverlay()
    .catch((error) => {
      clseAlertOverlayPromise = null;
      console.error('[ContentBootstrap] Failed to load CLSE alert overlay.', error);
      throw error;
    });
  return clseAlertOverlayPromise;
}

async function initLoadedCLSEAlertOverlay() {
  const overlay = await getCLSEAlertOverlay();
  if (typeof overlay?.initCLSEAlertOverlay === 'function') {
    overlay.initCLSEAlertOverlay();
  }
}

function teardownLoadedCLSEAlertOverlay() {
  if (!clseAlertOverlayPromise) return;
  return clseAlertOverlayPromise
    .then((overlay) => {
      if (typeof overlay?.teardownCLSEAlertOverlay === 'function') {
        return overlay.teardownCLSEAlertOverlay();
      }
    })
    .catch((error) => {
      console.error('[ContentBootstrap] Failed to teardown CLSE alert overlay.', error);
      throw error;
    });
}

function installBootstrapPhaseOne() {
  ensureFrictionGlobalStyles();
  installRuntimeControlChannel(({ reason }) => teardownContentRuntime({ reason }));
  // Installed once for the whole runtime rather than per surface: the arbiter
  // already sees every ritual surface, so nothing has to report itself.
  installRitualSurfaceLedgerReporter();
  installProtectionRuntimeReceiver();
}

async function publishBootstrappingState(attempt, reason) {
  return publishBootstrapState('bootstrapping', {
    startedAt: attempt.startedAt,
    reason,
  }, {
    attempt,
  });
}

function teardownContentRuntime({ reason = 'runtime_teardown', publishState = true } = {}) {
  interventionAdmissionClient.cancelPending();
  const attempt = readBootstrapAttemptLease();
  const staleStatePromise = attempt && attempt.signal?.aborted !== true
    ? revokeBootstrapAttempt(attempt, {
      startedAt: attempt.startedAt,
      reason,
    }, { publish: publishState })
    : Promise.resolve(readBootstrapState());
  return settleRuntimeCleanup([
    () => staleStatePromise,
    () => clearContentRuntimeEffects(),
    () => contentSidecars.teardown(),
    () => teardownTopFrameMediaDiagnostics(),
    () => teardownProtectionRuntimeSidecars(),
    () => teardownRitualSurfaceLedgerReporter(),
    () => CONTENT_CLSE_ALERT_OVERLAY_ENABLED && teardownLoadedCLSEAlertOverlay(),
    () => teardownProtectionRuntimeReceiver(),
  ]);
}

async function publishReceiverReadyState(attempt, patch = {}) {
  return publishBootstrapState('receiver_ready', {
    startedAt: attempt.startedAt,
    receiverReadyAt: Date.now(),
    reason: 'receiver_ready',
    ...patch,
  }, {
    attempt,
  });
}

async function publishActiveState(attempt, patch = {}) {
  assertAttemptCurrent(attempt, 'active_state_previous_read');
  const previous = readBootstrapState();
  return publishBootstrapState('active', {
    startedAt: attempt.startedAt,
    receiverReadyAt: previous?.attemptId === attempt.attemptId
      ? (previous.receiverReadyAt || Date.now())
      : Date.now(),
    activeAt: Date.now(),
    reason: 'bootstrap_active',
    ...patch,
  }, {
    attempt,
  });
}

async function finishPostReceiverBootstrap(attempt, epoch) {
  await waitForAttempt(contentSidecars.start(epoch), attempt, 'content_sidecars');
  if (CONTENT_CLSE_ALERT_OVERLAY_ENABLED) {
    await waitForAttempt(initLoadedCLSEAlertOverlay(), attempt, 'clse_alert_overlay');
  }
  assertAttemptCurrent(attempt, 'sidecars_start');
  startProtectionRuntimeSidecars();
  startTopFrameMediaDiagnostics();
  assertEpochCurrent(epoch, 'sidecars_ready');
  assertAttemptCurrent(attempt, 'sidecars_ready');

  return publishActiveState(attempt);
}

function handlePostReceiverBootstrapError(attempt, error) {
  if (isEpochStaleBootstrapError(error)) {
    return createStaleAttemptNoop(attempt, error, 'post_receiver');
  }

  const message = describeBootstrapError(error, 'CONTENT_BOOTSTRAP_ACTIVATION_FAILED');
  console.warn('[ContentBootstrap] Post-receiver activation failed; keeping receiver dispatch-ready.', message);
  return publishReceiverReadyState(attempt, {
    reason: 'bootstrap_receiver_ready_degraded',
    error: message,
  });
}

export async function bootstrapContentRuntime(attempt) {
  if (contentContextInvalidated) throw createContentBootstrapError('CONTENT_RUNTIME_EXTENSION_CONTEXT_INVALIDATED');
  activateBootstrapAttempt(attempt);
  const previous = readBootstrapState();
  const replacingPreviousAttempt = isReplacingPreviousAttempt(previous, attempt);
  if (isBootstrapInProgress(previous) && !replacingPreviousAttempt) {
    throw createContentBootstrapError('CONTENT_BOOTSTRAP_REENTRY_BLOCKED', {
      previousStatus: previous?.status || null,
      previousReason: previous?.reason || null,
      previousStartedAt: previous?.startedAt || null,
      previousAttemptId: previous?.attemptId || null,
      attemptId: attempt.attemptId,
    });
  }

  const epoch = contentRuntimeEpoch + 1;
  contentRuntimeEpoch = epoch;
  try {
    await publishBootstrappingState(
      attempt,
      replacingPreviousAttempt ? 'stale_bootstrapping_recovery' : attempt.reason,
    );

    assertAttemptCurrent(attempt, 'phase_one_install');
    installBootstrapPhaseOne();
    await waitForAttempt(applyEarlyRuntimeBootstrapSnapshot({
      source: replacingPreviousAttempt
        ? 'stale_bootstrapping_recovery'
        : 'document_start',
      assertAttemptCurrent: (phase) => assertAttemptCurrent(attempt, phase),
    }), attempt, 'early_runtime_snapshot');
    assertAttemptCurrent(attempt, 'receiver_ready_before_commit');
    await publishReceiverReadyState(attempt);
    assertAttemptCurrent(attempt, 'receiver_ready_after_commit');
    assertEpochCurrent(epoch, 'receiver_ready');
    try {
      return await finishPostReceiverBootstrap(attempt, epoch);
    } catch (error) {
      return handlePostReceiverBootstrapError(attempt, error);
    }
  } catch (error) {
    if (isEpochStaleBootstrapError(error) || !isBootstrapAttemptCurrent(attempt)) {
      return createStaleAttemptNoop(attempt, error);
    }
    await publishBootstrapState('failed', {
      startedAt: attempt.startedAt,
      failedAt: Date.now(),
      error: describeBootstrapError(error),
      reason: 'bootstrap_exception',
    }, {
      attempt,
    });
    throw error;
  }
}

// The bootstrap owner handles terminal local shutdown; the admission transport
// only reports the event. There is no worker liveness polling or reload retry.
interventionAdmissionClient.setContextInvalidationHandler(({ reason }) => {
  contentContextInvalidated = true;
  return teardownContentRuntime({ reason, publishState: false });
});
