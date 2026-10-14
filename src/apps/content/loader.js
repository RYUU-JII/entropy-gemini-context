(() => {
  // Registration targets the top frame, but the entry must enforce that same
  // boundary before imports or bootstrap state can run in a child document.
  // Child-frame media belongs to mediaFrameProbe.js.
  if (window.top !== window) return;
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
  if (document.contentType !== 'text/html' && document.contentType !== 'application/xhtml+xml') return;

  const CONTENT_LOADER_STATE_KEY = '__entropyContentLoaderState__';
  const CONTENT_BOOTSTRAP_STATE_KEY = '__entropyContentBootstrapState__';
  const CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY = '__entropyContentBootstrapAttemptLease__';
  const CONTENT_BOOTSTRAP_STATE_MESSAGE_TYPE = 'CONTENT_BOOTSTRAP_STATE';
  const ROOT_FILTER_PRELOAD_STATE_KEY = '__entropyRootFilterPreloadState__';
  const LOADER_STARTING_STALE_MS = 1_300;
  const PREPAINT_VISUAL_SUPPRESSION_ATTR = 'data-entropy-prepaint-suppressed';

  function normalizeHostname(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function readLoaderState() {
    try {
      return globalThis[CONTENT_LOADER_STATE_KEY] || window[CONTENT_LOADER_STATE_KEY] || null;
    } catch (_) {
      return null;
    }
  }

  function writeLoaderState(nextState) {
    try {
      globalThis[CONTENT_LOADER_STATE_KEY] = nextState;
    } catch (_) { }
    try {
      window[CONTENT_LOADER_STATE_KEY] = nextState;
    } catch (_) { }
    return nextState;
  }

  function readBootstrapState() {
    try {
      return globalThis[CONTENT_BOOTSTRAP_STATE_KEY] || window[CONTENT_BOOTSTRAP_STATE_KEY] || null;
    } catch (_) {
      return null;
    }
  }

  function writeBootstrapState(nextState) {
    try {
      globalThis[CONTENT_BOOTSTRAP_STATE_KEY] = nextState;
    } catch (_) { }
    try {
      window[CONTENT_BOOTSTRAP_STATE_KEY] = nextState;
    } catch (_) { }
    return nextState;
  }

  function readBootstrapAttemptLease() {
    try {
      return globalThis[CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY]
        || window[CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY]
        || null;
    } catch (_) {
      return null;
    }
  }

  function writeBootstrapAttemptLease(attempt) {
    globalThis[CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY] = attempt;
    window[CONTENT_BOOTSTRAP_ATTEMPT_LEASE_KEY] = attempt;
    return attempt;
  }

  function createLoaderAttemptError(code, details = {}) {
    const error = new Error(code);
    error.name = 'ContentLoaderAttemptError';
    error.code = code;
    error.details = Object.freeze({ ...details });
    return error;
  }

  function createBootstrapAttemptLease({ attemptId, startedAt, replacesAttemptId = null, reason }) {
    const abortController = new AbortController();
    const lease = {
      attemptId,
      startedAt,
      replacesAttemptId,
      reason,
      signal: abortController.signal,
      revokedAt: null,
      revokeReason: null,
      cancel(cancelReason = 'attempt_replaced') {
        if (abortController.signal.aborted) return false;
        lease.revokedAt = Date.now();
        lease.revokeReason = cancelReason;
        abortController.abort(cancelReason);
        return true;
      },
    };
    return lease;
  }

  function isAttemptCurrent(attempt, { requireLoaderState = true } = {}) {
    if (!attempt || attempt.signal?.aborted === true) return false;
    if (readBootstrapAttemptLease() !== attempt) return false;
    if (!requireLoaderState) return true;
    return Number(readLoaderState()?.attemptId) === Number(attempt.attemptId);
  }

  function assertAttemptCurrent(attempt, phase, options = {}) {
    if (isAttemptCurrent(attempt, options)) return attempt;
    throw createLoaderAttemptError('CONTENT_LOADER_ATTEMPT_STALE', {
      phase,
      attemptId: attempt?.attemptId ?? null,
      currentAttemptId: readBootstrapAttemptLease()?.attemptId ?? null,
      aborted: attempt?.signal?.aborted === true,
    });
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

  function normalizeBootstrapStatus(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function readExtensionRuntime() {
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime) return chrome.runtime;
      if (typeof browser !== 'undefined' && browser?.runtime) return browser.runtime;
      return null;
    } catch (_) {
      return null;
    }
  }

  function sendBootstrapStateToRuntime(state, reason, attempt) {
    if (!state || typeof state !== 'object') return;
    const status = normalizeBootstrapStatus(state.status);
    if (!status) return;
    try {
      assertAttemptCurrent(attempt, `send_${status}`);
      if (Number(state.attemptId) !== Number(attempt.attemptId)) {
        throw createLoaderAttemptError('CONTENT_LOADER_BOOTSTRAP_STATE_ATTEMPT_MISMATCH', {
          stateAttemptId: state.attemptId ?? null,
          attemptId: attempt.attemptId,
        });
      }
      const runtime = readExtensionRuntime();
      if (!runtime?.sendMessage) return;
      const url = typeof window?.location?.href === 'string' ? window.location.href : '';
      runtime.sendMessage({
        type: CONTENT_BOOTSTRAP_STATE_MESSAGE_TYPE,
        payload: {
          ...state,
          status,
          url,
          reason: reason || state.reason || null,
        },
      }, () => {
        try {
          void runtime?.lastError;
        } catch (_) { }
      });
    } catch (_) { }
  }

  function republishDispatchReadyBootstrapState(reason) {
    const state = readBootstrapState();
    const status = normalizeBootstrapStatus(state?.status);
    if (status !== 'receiver_ready' && status !== 'active') return;
    const attempt = readBootstrapAttemptLease();
    sendBootstrapStateToRuntime(state, reason, attempt);
  }

  function isLoaderStartingStale(state, bootstrapStatus) {
    if (state?.status !== 'starting') return false;
    if (bootstrapStatus === 'receiver_ready' || bootstrapStatus === 'active') return false;
    const startedAt = Number(state?.startedAt);
    if (!Number.isFinite(startedAt) || startedAt <= 0) return true;
    return (Date.now() - startedAt) >= LOADER_STARTING_STALE_MS;
  }

  function publishLoaderBootstrapFailure(error, reason, attempt) {
    assertAttemptCurrent(attempt, 'loader_failure_commit');
    const previous = readBootstrapState() || {};
    const now = Date.now();
    const nextState = writeBootstrapState({
      ...previous,
      status: 'failed',
      attemptId: attempt.attemptId,
      dispatchReady: false,
      active: false,
      startedAt: attempt.startedAt,
      receiverReadyAt: previous.receiverReadyAt || null,
      activeAt: previous.activeAt || null,
      failedAt: now,
      error: String(error?.message || error || 'CONTENT_LOADER_IMPORT_FAILED'),
      reason,
    });
    sendBootstrapStateToRuntime(nextState, reason, attempt);
  }

  function readRootFilterPreloadState() {
    try {
      return globalThis[ROOT_FILTER_PRELOAD_STATE_KEY] || window[ROOT_FILTER_PRELOAD_STATE_KEY] || null;
    } catch (_) {
      return null;
    }
  }

  function writeRootFilterPreloadState(nextState) {
    try {
      globalThis[ROOT_FILTER_PRELOAD_STATE_KEY] = nextState;
    } catch (_) { }
    try {
      window[ROOT_FILTER_PRELOAD_STATE_KEY] = nextState;
    } catch (_) { }
    return nextState;
  }

  function composeRootFilter(baseFilter, rootFilter) {
    return [baseFilter, rootFilter].filter(Boolean).join(' ');
  }

  function stripManagedRootFilter(baseFilter, rootFilter) {
    if (!baseFilter || !rootFilter) return baseFilter;
    if (baseFilter === rootFilter) return '';

    const suffix = ` ${rootFilter}`;
    if (!baseFilter.endsWith(suffix)) return baseFilter;
    return baseFilter.slice(0, -suffix.length).trim();
  }

  function readComputedRootFilter(root) {
    if (!root) return '';
    try {
      const computed = typeof window.getComputedStyle === 'function'
        ? window.getComputedStyle(root)?.filter || 'none'
        : 'none';
      return computed === 'none' ? '' : computed;
    } catch (_) {
      return '';
    }
  }

  function restorePreloadedRootFilter() {
    const root = typeof document === 'undefined' ? null : document.documentElement;
    const previous = readRootFilterPreloadState();
    if (!root || !previous?.active) return;

    if (previous.hasInline) {
      root.style.setProperty('filter', previous.inlineValue || '', previous.inlinePriority || '');
    } else {
      root.style.removeProperty('filter');
    }
    writeRootFilterPreloadState(null);
  }

  function suppressPrepaintVisualStyle(root = null) {
    const resolvedRoot = root || (typeof document === 'undefined' ? null : document.documentElement);
    if (!resolvedRoot?.setAttribute) return;
    resolvedRoot.setAttribute(PREPAINT_VISUAL_SUPPRESSION_ATTR, '1');
  }

  function restorePrepaintVisualStyle(root, previousValue) {
    if (!root) return;
    if (previousValue === null) {
      root.removeAttribute?.(PREPAINT_VISUAL_SUPPRESSION_ATTR);
      return;
    }
    root.setAttribute?.(PREPAINT_VISUAL_SUPPRESSION_ATTR, previousValue);
  }

  async function readRootVisualSnapshot(rootVisualReaderPaths, hostname) {
    const readerModule = await importFirstAvailable(rootVisualReaderPaths, (candidateModule, path) => {
      if (typeof candidateModule?.readContentLoaderRootVisualSnapshot === 'function') return;
      throw new Error(`ROOT_VISUAL_READER_EXPORT_MISSING:${path}:readContentLoaderRootVisualSnapshot`);
    });
    return readerModule.readContentLoaderRootVisualSnapshot({
      hostname,
      now: Date.now(),
    });
  }

  async function startRootVisualPreload(rootVisualReaderPaths, owningAttempt) {
    assertAttemptCurrent(owningAttempt, 'root_visual_preload_start');
    const root = typeof document === 'undefined' ? null : document.documentElement;
    const hostname = normalizeHostname(window.location?.hostname || '');
    if (!root || !hostname) return;

    let entry = null;
    try {
      entry = await readRootVisualSnapshot(rootVisualReaderPaths, hostname);
      assertAttemptCurrent(owningAttempt, 'root_visual_preload_read');
    } catch (error) {
      if (!isAttemptCurrent(owningAttempt)) return;
      console.error('[entropy][content-loader] root visual preload read failed:', error);
      return;
    }

    const loaderStatus = readLoaderState()?.status;
    if (loaderStatus === 'ready') {
      return;
    }
    if (loaderStatus === 'failed') {
      suppressPrepaintVisualStyle(root);
      return;
    }

    if (!entry) {
      return;
    }

    if (!entry.decision?.shouldApply) {
      suppressPrepaintVisualStyle(root);
      restorePreloadedRootFilter();
      return;
    }

    if (typeof entry.rootFilter !== 'string') {
      console.error(
        '[entropy][content-loader] root visual snapshot requires a string rootFilter while shouldApply is true:',
        new Error(`ROOT_VISUAL_SNAPSHOT_FILTER_REQUIRED:${hostname}`),
      );
      return;
    }

    // The protection decision can enable runtime or element effects without
    // root grayscale. The canonical empty string means no root visual plan.
    if (entry.rootFilter === '') {
      suppressPrepaintVisualStyle(root);
      restorePreloadedRootFilter();
      return;
    }

    let suppressionValueBeforeHandoff = null;
    let suppressionValueCaptured = false;
    try {
      const previous = readRootFilterPreloadState();
      const inlineValue = previous?.active
        ? String(previous.inlineValue || '')
        : root.style.getPropertyValue('filter');
      const inlinePriority = previous?.active
        ? String(previous.inlinePriority || '')
        : root.style.getPropertyPriority('filter');
      const hasInline = previous?.active
        ? previous.hasInline === true
        : (inlineValue !== '' || inlinePriority !== '');

      // The registered prepaint CSS participates in getComputedStyle(). Suppress
      // it before reading the page-owned baseline so the exact tier never
      // becomes part of the exact inline filter. These mutations stay in one
      // synchronous task, so the browser cannot paint between the two owners.
      suppressionValueBeforeHandoff = typeof root.getAttribute === 'function'
        ? root.getAttribute(PREPAINT_VISUAL_SUPPRESSION_ATTR)
        : null;
      suppressionValueCaptured = true;
      suppressPrepaintVisualStyle(root);
      const computedBaseFilter = readComputedRootFilter(root);
      const baseFilter = previous?.active
        ? stripManagedRootFilter(computedBaseFilter || inlineValue, previous.rootFilter)
        : (computedBaseFilter || inlineValue);
      const combined = composeRootFilter(baseFilter, entry.rootFilter);

      if (combined) {
        root.style.setProperty('filter', combined, 'important');
      } else {
        root.style.removeProperty('filter');
      }

      writeRootFilterPreloadState({
        active: true,
        hostname,
        rootFilter: entry.rootFilter,
        inlineValue,
        inlinePriority,
        hasInline,
        applied: combined,
        generatedAtEpochMs: entry.generatedAtEpochMs,
        staleAfterEpochMs: entry.staleAfterEpochMs,
      });
    } catch (error) {
      if (suppressionValueCaptured) {
        restorePrepaintVisualStyle(root, suppressionValueBeforeHandoff);
      }
      console.error('[entropy][content-loader] root visual preload apply failed:', error);
    }
  }

  const existingState = readLoaderState();
  const existingBootstrapState = readBootstrapState();
  const existingAttemptLease = readBootstrapAttemptLease();
  const bootstrapStatus = typeof existingBootstrapState?.status === 'string'
    ? existingBootstrapState.status.trim().toLowerCase()
    : '';
  const shouldAllowRebootstrap = bootstrapStatus === 'stale' || bootstrapStatus === 'failed';
  const staleStartingState = isLoaderStartingStale(existingState, bootstrapStatus);
  const existingLeaseMatchesState = existingAttemptLease
    && Number(existingAttemptLease.attemptId) === Number(existingState?.attemptId);
  const shouldRecoverStaleStart = !shouldAllowRebootstrap
    && staleStartingState
    && existingLeaseMatchesState
    && existingAttemptLease.signal?.aborted !== true;
  if (!shouldAllowRebootstrap && staleStartingState && !shouldRecoverStaleStart) {
    console.error('[entropy][content-loader] stale loader attempt has no cancellable lease:',
      createLoaderAttemptError('CONTENT_LOADER_STALE_ATTEMPT_LEASE_REQUIRED', {
        loaderAttemptId: existingState?.attemptId ?? null,
        leaseAttemptId: existingAttemptLease?.attemptId ?? null,
      }));
    return;
  }
  if (
    (existingState?.status === 'starting' && !shouldRecoverStaleStart && !shouldAllowRebootstrap)
    || (existingState?.status === 'ready' && !shouldAllowRebootstrap)
  ) {
    republishDispatchReadyBootstrapState('loader_reinjected');
    return;
  }

  const shouldReplaceExistingAttempt = shouldRecoverStaleStart
    || (shouldAllowRebootstrap && existingLeaseMatchesState);
  const replacedAttemptId = shouldReplaceExistingAttempt
    ? Number(existingAttemptLease.attemptId)
    : null;
  if (shouldReplaceExistingAttempt && existingAttemptLease.signal?.aborted !== true) {
    existingAttemptLease.cancel(
      shouldRecoverStaleStart ? 'starting_stale_rebootstrap' : 'terminal_state_rebootstrap',
    );
  }
  const attemptCount = Math.max(
    0,
    Number(existingState?.attemptCount) || 0,
    Number(existingState?.attemptId) || 0,
  ) + 1;
  const attemptStartedAt = Date.now();
  const attempt = createBootstrapAttemptLease({
    attemptId: attemptCount,
    startedAt: attemptStartedAt,
    replacesAttemptId: replacedAttemptId,
    reason: shouldRecoverStaleStart ? 'stale_bootstrapping_recovery' : 'document_start',
  });
  writeBootstrapAttemptLease(attempt);
  const loaderState = writeLoaderState({
    status: 'starting',
    attemptId: attempt.attemptId,
    startedAt: attempt.startedAt,
    readyAt: null,
    failedAt: null,
    lastError: null,
    recoveryReason: shouldRecoverStaleStart ? 'starting_stale_rebootstrap' : null,
    attemptCount,
    replacesAttemptId: attempt.replacesAttemptId,
  });

  function setLoaderState(patch = {}) {
    if (!isAttemptCurrent(attempt)) return false;
    const currentState = readLoaderState() || loaderState;
    writeLoaderState({
      ...currentState,
      ...patch,
      attemptId: attempt.attemptId,
    });
    return true;
  }

  function getRuntimeUrl(path) {
    const normalized = String(path || '').trim().replace(/^\/+/, '');
    if (!normalized) return '';
    try {
      const runtime = readExtensionRuntime();
      if (runtime?.getURL) return runtime.getURL(normalized);
    } catch (_) {
      // Fall through to return normalized path.
    }
    return normalized;
  }

  async function importEntryModule(path) {
    const moduleUrl = getRuntimeUrl(path);
    if (!moduleUrl) throw new Error(`ENTRY_URL_UNRESOLVED:${path}`);
    return import(moduleUrl);
  }

  async function importFirstAvailable(paths, validateModule = null) {
    let lastError = null;

    for (const path of paths) {
      try {
        const nextModule = await importEntryModule(path);
        if (typeof validateModule === 'function') {
          validateModule(nextModule, path);
        }
        return nextModule;
      } catch (error) {
        lastError = error;
      }
    }

    const attempted = paths.join(', ');
    const nextError = lastError instanceof Error
      ? lastError
      : new Error(String(lastError || 'ENTRY_IMPORT_FAILED'));
    nextError.message = `${nextError.message} (attempted: ${attempted})`;
    throw nextError;
  }

  async function runBootstrapEntry(paths, { after = null } = {}) {
    let bootstrapModule;
    try {
      const bootstrapModulePromise = waitForAttempt(importFirstAvailable(paths, (candidateModule, path) => {
        if (typeof candidateModule?.bootstrapContentRuntime === 'function') return;
        throw new Error(`BOOTSTRAP_ENTRY_EXPORT_MISSING:${path}:bootstrapContentRuntime`);
      }), attempt, 'bootstrap_entry_import');
      const handoffBarrierPromise = after
        ? waitForAttempt(after, attempt, 'root_visual_handoff')
        : Promise.resolve();
      [bootstrapModule] = await Promise.all([
        bootstrapModulePromise,
        handoffBarrierPromise,
      ]);
    } catch (error) {
      if (error?.code !== 'CONTENT_LOADER_ATTEMPT_STALE') {
        error.entropyLoaderBootstrapImportFailure = true;
      }
      throw error;
    }
    assertAttemptCurrent(attempt, 'bootstrap_entry_invoke');
    return bootstrapModule.bootstrapContentRuntime(attempt);
  }

  const devSourceBootstrapEntry = typeof __CONTENT_BOOTSTRAP_DEV_SOURCE_ENTRY__ === 'string'
    ? __CONTENT_BOOTSTRAP_DEV_SOURCE_ENTRY__.trim()
    : '';
  const devSourceRootVisualReaderEntry = typeof __CONTENT_ROOT_VISUAL_READER_DEV_SOURCE_ENTRY__ === 'string'
    ? __CONTENT_ROOT_VISUAL_READER_DEV_SOURCE_ENTRY__.trim()
    : '';

  // This file is injected as a classic content script, so it must remain free of
  // module-only syntax. Production must load the canonical bundled bootstrap
  // artifact only; Vite injects an optional raw-source development candidate
  // for local serve sessions where the standalone bundle is not present yet.
  const rootVisualReaderCandidates = ['assets/content-loader-root-visual-reader.js'];
  if (devSourceRootVisualReaderEntry) {
    rootVisualReaderCandidates.push(devSourceRootVisualReaderEntry);
  }
  const bootstrapEntryCandidates = ['assets/content-bootstrap.js'];
  if (devSourceBootstrapEntry) {
    bootstrapEntryCandidates.push(devSourceBootstrapEntry);
  }

  const rootVisualPreloadPromise = startRootVisualPreload(rootVisualReaderCandidates, attempt)
    .catch(() => {});

  const bootstrapPromise = runBootstrapEntry(
    bootstrapEntryCandidates,
    { after: rootVisualPreloadPromise },
  )
    .catch((error) => {
      if (error?.code === 'CONTENT_LOADER_ATTEMPT_STALE' || !isAttemptCurrent(attempt)) {
        return Object.freeze({
          status: 'stale_noop',
          staleNoop: true,
          code: 'CONTENT_LOADER_ATTEMPT_STALE_NOOP',
          attemptId: attempt.attemptId,
        });
      }
      console.error('[entropy][content-loader] content bootstrap failed:', error);
      if (error?.entropyLoaderBootstrapImportFailure === true) {
        publishLoaderBootstrapFailure(error, 'loader_import_failed', attempt);
      }
      throw error;
    });
  void rootVisualPreloadPromise;

  void Promise.allSettled([bootstrapPromise]).then((results) => {
    const rejected = results.find((entry) => entry.status === 'rejected');
    if (rejected?.status === 'rejected') {
      setLoaderState({
        status: 'failed',
        failedAt: Date.now(),
        lastError: String(rejected.reason?.message || rejected.reason || 'CONTENT_LOADER_IMPORT_FAILED'),
      });
      return;
    }

    setLoaderState({
      status: 'ready',
      readyAt: Date.now(),
      lastError: null,
    });
  });
})();
