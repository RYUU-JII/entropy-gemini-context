import { useCallback, useEffect, useRef, useState } from 'react';

export const SITES_RELEASE_GRACE_PERIOD_MS = 8_000;

export const SITES_RELEASE_PHASES = Object.freeze({
  GRACE: 'grace',
  COMMITTING: 'committing',
  FAILED: 'failed',
});

function resolveGracePeriodMs(value) {
  if (value === undefined) return SITES_RELEASE_GRACE_PERIOD_MS;

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('SITES_RELEASE_GRACE_PERIOD_INVALID');
  }
  return Math.floor(numeric);
}

function normalizeReleaseRequest(domain, type) {
  const normalizedDomain = typeof domain === 'string' ? domain.trim().toLowerCase() : '';
  if (!normalizedDomain) {
    throw new Error('SITES_RELEASE_DOMAIN_REQUIRED');
  }
  if (type !== 'blocked' && type !== 'allowed') {
    throw new Error('SITES_RELEASE_TYPE_INVALID');
  }
  return {
    domain: normalizedDomain,
    type,
  };
}

function normalizeReleaseError(error) {
  if (error instanceof Error) return error;
  const message = typeof error === 'string' && error.trim()
    ? error.trim()
    : 'SITES_RELEASE_COMMIT_FAILED';
  return new Error(message);
}

function createFailedCommitError(result) {
  if (result?.error instanceof Error) return result.error;
  if (typeof result?.error === 'string' && result.error.trim()) {
    return new Error(result.error.trim());
  }
  return new Error('SITES_RELEASE_COMMIT_FAILED');
}

export function useSitesReleaseGuard({
  onRemove,
  gracePeriodMs = SITES_RELEASE_GRACE_PERIOD_MS,
  enabled = true,
} = {}) {
  if (typeof onRemove !== 'function') {
    throw new Error('SITES_RELEASE_REMOVE_OWNER_REQUIRED');
  }

  const resolvedGracePeriodMs = resolveGracePeriodMs(gracePeriodMs);
  const onRemoveRef = useRef(onRemove);
  const enabledRef = useRef(enabled);
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);
  const activeRequestRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const commitTimerRef = useRef(null);
  const [pending, setPending] = useState(null);

  onRemoveRef.current = onRemove;
  enabledRef.current = enabled;

  const clearTimers = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      globalThis.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (commitTimerRef.current !== null) {
      globalThis.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  const commitRelease = useCallback(async (requestSequence) => {
    const activeRequest = activeRequestRef.current;
    if (
      !activeRequest
      || activeRequest.requestSequence !== requestSequence
      || activeRequest.phase !== SITES_RELEASE_PHASES.GRACE
    ) {
      return false;
    }

    clearTimers();
    const committingRequest = {
      ...activeRequest,
      phase: SITES_RELEASE_PHASES.COMMITTING,
      remainingSeconds: 0,
      error: null,
    };
    activeRequestRef.current = committingRequest;
    if (mountedRef.current) {
      setPending({
        domain: committingRequest.domain,
        type: committingRequest.type,
        remainingSeconds: 0,
        phase: SITES_RELEASE_PHASES.COMMITTING,
        error: null,
      });
    }

    try {
      const result = await onRemoveRef.current(
        committingRequest.domain,
        committingRequest.type,
      );
      if (result === false || result?.ok === false || result?.error) {
        throw createFailedCommitError(result);
      }

      if (
        !mountedRef.current
        || requestSequenceRef.current !== requestSequence
        || activeRequestRef.current?.requestSequence !== requestSequence
      ) {
        return true;
      }

      activeRequestRef.current = null;
      setPending(null);
      return true;
    } catch (error) {
      if (
        !mountedRef.current
        || requestSequenceRef.current !== requestSequence
        || activeRequestRef.current?.requestSequence !== requestSequence
      ) {
        return false;
      }

      const normalizedError = normalizeReleaseError(error);
      const failedRequest = {
        ...committingRequest,
        phase: SITES_RELEASE_PHASES.FAILED,
        remainingSeconds: 0,
        error: normalizedError,
      };
      activeRequestRef.current = failedRequest;
      setPending({
        domain: failedRequest.domain,
        type: failedRequest.type,
        remainingSeconds: 0,
        phase: SITES_RELEASE_PHASES.FAILED,
        error: normalizedError,
      });
      return false;
    }
  }, [clearTimers]);

  const requestRelease = useCallback((domain, type) => {
    if (!mountedRef.current || !enabledRef.current) return null;
    const request = normalizeReleaseRequest(domain, type);
    clearTimers();

    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    const deadlineEpochMs = Date.now() + resolvedGracePeriodMs;
    const remainingSeconds = Math.ceil(resolvedGracePeriodMs / 1_000);
    const activeRequest = {
      ...request,
      requestSequence,
      deadlineEpochMs,
      remainingSeconds,
      phase: SITES_RELEASE_PHASES.GRACE,
      error: null,
    };
    activeRequestRef.current = activeRequest;
    setPending({
      domain: activeRequest.domain,
      type: activeRequest.type,
      remainingSeconds,
      phase: SITES_RELEASE_PHASES.GRACE,
      error: null,
    });

    countdownTimerRef.current = globalThis.setInterval(() => {
      const currentRequest = activeRequestRef.current;
      if (
        !mountedRef.current
        || currentRequest?.requestSequence !== requestSequence
        || currentRequest.phase !== SITES_RELEASE_PHASES.GRACE
      ) {
        return;
      }

      const nextRemainingSeconds = Math.max(
        0,
        Math.ceil((currentRequest.deadlineEpochMs - Date.now()) / 1_000),
      );
      if (nextRemainingSeconds === currentRequest.remainingSeconds) return;

      currentRequest.remainingSeconds = nextRemainingSeconds;
      setPending((current) => (
        current?.phase === SITES_RELEASE_PHASES.GRACE
        && current.domain === currentRequest.domain
        && current.type === currentRequest.type
          ? { ...current, remainingSeconds: nextRemainingSeconds }
          : current
      ));
    }, 1_000);

    commitTimerRef.current = globalThis.setTimeout(() => {
      void commitRelease(requestSequence);
    }, resolvedGracePeriodMs);

    return {
      domain: activeRequest.domain,
      type: activeRequest.type,
      remainingSeconds,
      phase: SITES_RELEASE_PHASES.GRACE,
      error: null,
    };
  }, [clearTimers, commitRelease, resolvedGracePeriodMs]);

  const undoRelease = useCallback(() => {
    const activeRequest = activeRequestRef.current;
    if (!activeRequest || activeRequest.phase === SITES_RELEASE_PHASES.COMMITTING) {
      return false;
    }

    clearTimers();
    requestSequenceRef.current += 1;
    activeRequestRef.current = null;
    if (mountedRef.current) {
      setPending(null);
    }
    return true;
  }, [clearTimers]);

  useEffect(() => {
    if (enabled) return;
    const activeRequest = activeRequestRef.current;
    if (!activeRequest || activeRequest.phase !== SITES_RELEASE_PHASES.GRACE) return;

    clearTimers();
    requestSequenceRef.current += 1;
    activeRequestRef.current = null;
    if (mountedRef.current) {
      setPending(null);
    }
  }, [clearTimers, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
      requestSequenceRef.current += 1;
      if (activeRequestRef.current?.phase === SITES_RELEASE_PHASES.GRACE) {
        activeRequestRef.current = null;
      }
    };
  }, [clearTimers]);

  return {
    pending,
    requestRelease,
    undoRelease,
  };
}

export default useSitesReleaseGuard;
