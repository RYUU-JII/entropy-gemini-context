const VIDEO_RUNTIME_HANDLER_BINDINGS = Object.freeze([
  Object.freeze({ eventName: 'timeupdate', handlerKey: 'onTimeUpdate', group: 'runtime' }),
  Object.freeze({ eventName: 'seeking', handlerKey: 'onSeeking', group: 'runtime' }),
  Object.freeze({ eventName: 'loadedmetadata', handlerKey: 'onLoadedMetadata', group: 'runtime' }),
  Object.freeze({ eventName: 'emptied', handlerKey: 'onEmptied', group: 'runtime' }),
  Object.freeze({ eventName: 'play', handlerKey: 'onPlay', group: 'runtime' }),
  Object.freeze({ eventName: 'pause', handlerKey: 'onPause', group: 'runtime' }),
  Object.freeze({ eventName: 'ended', handlerKey: 'onEnded', group: 'runtime' }),
  Object.freeze({ eventName: 'ratechange', handlerKey: 'onRateChange', group: 'runtime' }),
]);

const VIDEO_DIAGNOSTIC_HANDLER_BINDINGS = Object.freeze([
  Object.freeze({ eventName: 'seeked', handlerKey: 'onSeeked', group: 'runtime' }),
  Object.freeze({ eventName: 'waiting', handlerKey: 'onWaiting', group: 'runtime' }),
  Object.freeze({ eventName: 'stalled', handlerKey: 'onStalled', group: 'runtime' }),
  Object.freeze({ eventName: 'suspend', handlerKey: 'onSuspend', group: 'runtime' }),
  Object.freeze({ eventName: 'canplay', handlerKey: 'onCanPlay', group: 'runtime' }),
  Object.freeze({ eventName: 'canplaythrough', handlerKey: 'onCanPlayThrough', group: 'runtime' }),
  Object.freeze({ eventName: 'playing', handlerKey: 'onPlaying', group: 'runtime' }),
  Object.freeze({ eventName: 'progress', handlerKey: 'onProgress', group: 'runtime' }),
  Object.freeze({ eventName: 'error', handlerKey: 'onError', group: 'runtime' }),
]);

const VIDEO_TARGET_BINDINGS = Object.freeze([
  Object.freeze({ eventName: 'mouseenter', handlerKey: 'onVideoEnter', group: 'target' }),
  Object.freeze({ eventName: 'mouseleave', handlerKey: 'onVideoLeave', group: 'target' }),
  Object.freeze({ eventName: 'focus', handlerKey: 'onVideoEnter', group: 'target' }),
  Object.freeze({ eventName: 'blur', handlerKey: 'onVideoLeave', group: 'target' }),
]);

function buildBindings(handlers, targetHandlers, includeDiagnostics) {
  const bindingSpecs = [
    ...VIDEO_RUNTIME_HANDLER_BINDINGS,
    ...VIDEO_TARGET_BINDINGS,
    ...(includeDiagnostics ? VIDEO_DIAGNOSTIC_HANDLER_BINDINGS : []),
  ];
  return bindingSpecs.map((spec) => {
    const source = spec.group === 'runtime' ? handlers : targetHandlers;
    const listener = source?.[spec.handlerKey];
    if (typeof listener !== 'function') {
      throw new Error(`VIDEO_SKIP_LISTENER_HANDLER_REQUIRED:${spec.handlerKey}`);
    }
    return Object.freeze({
      eventName: spec.eventName,
      handlerKey: spec.handlerKey,
      group: spec.group,
      listener,
      capture: true,
    });
  });
}

function buildRemainingLedger(video, failures) {
  const bindings = failures.map(({ binding }) => binding);
  if (bindings.length === 0) return null;
  return Object.freeze({
    video,
    bindings: Object.freeze(bindings),
    eventNames: Object.freeze(bindings.map((binding) => binding.eventName)),
  });
}

function decorateAttachFailure(error, video, binding, appliedBindings, rollbackFailures) {
  const failure = error && typeof error === 'object'
    ? error
    : new Error(String(error || 'VIDEO_SKIP_LISTENER_ATTACH_FAILED'));
  failure.videoSkipListenerDetails = {
    eventName: binding.eventName,
    handlerKey: binding.handlerKey,
    group: binding.group,
    appliedEventNames: appliedBindings.map((entry) => entry.eventName),
    rollbackFailureCount: rollbackFailures.length,
  };
  failure.videoSkipListenerRollbackFailures = rollbackFailures;
  failure.videoSkipListenerRemainingLedger = buildRemainingLedger(video, rollbackFailures);
  return failure;
}

export function attachVideoSkipListenerLedger({
  video,
  handlers,
  targetHandlers,
  includeDiagnostics = false,
} = {}) {
  if (!video || typeof video.addEventListener !== 'function') {
    throw new Error('VIDEO_SKIP_LISTENER_TARGET_REQUIRED');
  }
  const bindings = buildBindings(handlers, targetHandlers, includeDiagnostics === true);
  const appliedBindings = [];

  for (const binding of bindings) {
    try {
      video.addEventListener(binding.eventName, binding.listener, binding.capture);
      appliedBindings.push(binding);
    } catch (error) {
      const rollbackFailures = [];
      [...appliedBindings].reverse().forEach((applied) => {
        try {
          video.removeEventListener(applied.eventName, applied.listener, applied.capture);
        } catch (rollbackError) {
          rollbackFailures.push({ binding: applied, error: rollbackError });
        }
      });
      throw decorateAttachFailure(error, video, binding, appliedBindings, rollbackFailures);
    }
  }

  return Object.freeze({
    video,
    bindings: Object.freeze(bindings),
    eventNames: Object.freeze(bindings.map((binding) => binding.eventName)),
  });
}

export function detachVideoSkipListenerLedger(ledger) {
  if (!ledger || !Array.isArray(ledger.bindings)) {
    return { eventNames: [], failures: [], remainingLedger: null };
  }
  const eventNames = [];
  const failures = [];

  ledger.bindings.forEach((binding) => {
    try {
      ledger.video.removeEventListener(binding.eventName, binding.listener, binding.capture);
      eventNames.push(binding.eventName);
    } catch (error) {
      failures.push({ binding, error });
    }
  });

  const remainingLedger = buildRemainingLedger(ledger.video, failures);

  return { eventNames, failures, remainingLedger };
}

export const VIDEO_SKIP_LISTENER_EVENT_NAMES = Object.freeze([
  ...VIDEO_RUNTIME_HANDLER_BINDINGS,
  ...VIDEO_TARGET_BINDINGS,
].map((binding) => binding.eventName));

export const VIDEO_SKIP_DIAGNOSTIC_LISTENER_EVENT_NAMES = Object.freeze(
  VIDEO_DIAGNOSTIC_HANDLER_BINDINGS.map((binding) => binding.eventName),
);
