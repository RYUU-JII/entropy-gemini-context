(() => {
  const STATE_KEY = '__entropyMediaFrameProbeState__';
  const PROBE_VERSION = 5;
  const MESSAGE_TYPE = 'CONTENT_MEDIA_FRAME_STATE';
  const VIDEO_OBSERVATION_MODE = 'frame_probe_incremental';
  const REPORT_DEBOUNCE_MS = 200;
  const RECOVERY_EVENTS = ['pointerdown', 'keydown', 'focusin', 'play', 'loadedmetadata'];
  const RECOVERY_PATH_LIMIT = 16;
  const CONTROL_MESSAGE_TYPE = 'CONTENT_MEDIA_FRAME_CONTROL';
  const CONTROL_READY_TYPE = 'CONTENT_MEDIA_FRAME_CONTROL_READY';
  const CONTROL_DISCOVER_TYPE = 'CONTENT_MEDIA_FRAME_CONTROL_DISCOVER';
  const CONTROL_EXIT_TYPE = 'CONTENT_MEDIA_FRAME_CONTROL_EXIT';
  const CONTROL_VERSION = 1;
  const MAX_HOLD_MS = 60_000;
  const RESUME_TIMEOUT_MS = 2_000;
  const MAX_HOLD_IDS = 128;
  const MEDIA_EVENTS = ['play', 'playing', 'loadstart', 'emptied'];
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
  const NATIVE_CONTROL_HOSTS = new Set([
    'video', 'audio', 'input', 'select', 'textarea', 'option', 'optgroup',
    'meter', 'progress', 'img',
  ]);

  function isTopFrame() {
    try {
      return window.top === window;
    } catch (_error) {
      return false;
    }
  }

  function readState() {
    try {
      return globalThis[STATE_KEY] || window[STATE_KEY] || null;
    } catch (_error) {
      return null;
    }
  }

  function writeState(nextState) {
    try {
      globalThis[STATE_KEY] = nextState;
    } catch (_error) { }
    try {
      window[STATE_KEY] = nextState;
    } catch (_error) { }
    return nextState;
  }

  const existing = readState();
  const topFrame = isTopFrame();
  if (existing?.active) {
    if (existing.version === PROBE_VERSION) {
      if (topFrame) {
        existing.teardown?.('top_frame_owner_replaced');
        return;
      }
      if (typeof existing.report === 'function') {
        existing.report('probe_reinjected', { force: true });
        return;
      }
    }
    if (typeof existing.teardown === 'function') {
      try {
        existing.teardown('probe_version_replaced');
      } catch (_error) {
        return;
      }
    } else {
      // A pre-versioned probe cannot expose its observer handles. Avoid adding a
      // second owner; navigation/reload is the only safe retirement boundary.
      try {
        existing.upgradeBlocked = true;
      } catch (_error) { }
      return;
    }
  }

  // The module content runtime reports top-frame media through the canonical
  // VideoElementObserver. This classic script owns iframe inventory and its narrow
  // native media hold receiver; it never boots the top-frame feature runtime.
  if (topFrame) return;

  function readRuntime() {
    try {
      if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) return chrome.runtime;
      if (typeof browser !== 'undefined' && browser?.runtime?.sendMessage) return browser.runtime;
      return null;
    } catch (_error) {
      return null;
    }
  }

  function readLocationHref() {
    try {
      return typeof window?.location?.href === 'string' ? window.location.href : '';
    } catch (_error) {
      return '';
    }
  }

  function readDocumentReadyState() {
    try {
      return typeof document?.readyState === 'string' ? document.readyState : '';
    } catch (_error) {
      return '';
    }
  }

  function readVisibilityState() {
    try {
      return typeof document?.visibilityState === 'string' ? document.visibilityState : '';
    } catch (_error) {
      return '';
    }
  }

  function canUseHtmlVideoElement() {
    try {
      return typeof HTMLVideoElement !== 'undefined';
    } catch (_error) {
      return false;
    }
  }

  function forEachNode(list, visitor) {
    if (!list || typeof visitor !== 'function') return;
    for (let index = 0; index < list.length; index += 1) {
      visitor(list[index]);
    }
  }

  function isVideoElement(node) {
    if (!node || node.nodeType !== 1 || node.namespaceURI !== HTML_NAMESPACE) return false;
    const localName = typeof node.localName === 'string' ? node.localName : '';
    const tagName = typeof node.tagName === 'string' ? node.tagName : '';
    return localName.toLowerCase() === 'video' || tagName.toLowerCase() === 'video';
  }

  function isMediaElement(node) {
    return node?.nodeType === 1 && node.namespaceURI === HTML_NAMESPACE
      && (node.localName === 'video' || node.localName === 'audio');
  }

  function readShadowRoot(node) {
    if (
      node?.nodeType !== 1
      || node.namespaceURI !== HTML_NAMESPACE
      || NATIVE_CONTROL_HOSTS.has(node.localName)
    ) return null;
    if (node.shadowRoot) return node.shadowRoot;
    const dom = globalThis.chrome?.dom;
    if (typeof dom?.openOrClosedShadowRoot !== 'function') return null;
    // Same capability contract as mediaShadowRootAccess; this registered script
    // is classic and cannot import the module runtime.
    const root = dom.openOrClosedShadowRoot(node);
    if (root == null) return null;
    if (root.nodeType !== 11 || root.host !== node) throw new Error('MEDIA_SHADOW_ROOT_RESULT_INVALID');
    return root;
  }

  function isNodeConnected(node) {
    if (!node) return false;
    if (typeof node.isConnected === 'boolean') return node.isConnected;
    try {
      return typeof document?.contains === 'function' && document.contains(node);
    } catch (_error) {
      return false;
    }
  }

  function isOwnedConnectedNode(node) {
    return node === document || (node?.ownerDocument === document && isNodeConnected(node.host || node));
  }

  let reportTimer = 0;
  let lastSignature = '';
  const startedAt = Date.now();
  const liveVideos = new Set();
  const liveAudio = new Set();
  const shadowObservers = new Map();
  let documentObserver = null;
  let initialDocumentScanCount = 0;
  let incrementalSubtreeScanCount = 0;
  let recoveryDocumentScanCount = 0;
  let fullDocumentScanCount = 0;
  let visitedNodeCount = 0;
  let mutationBatchCount = 0;
  let mutationAddedRootCount = 0;
  let collapsedMutationRootCount = 0;
  let removalPruneCount = 0;
  let inventoryRevision = 0;
  let readyMessageCount = 0;
  let readySuppressedCount = 0;
  let beginCommandCount = 0;
  let renewCommandCount = 0;
  let lastReadySignature = '';
  let pendingReadySignature = '';
  let readyAttempt = 0;
  let pendingLifecycleRecovery = null;
  let observationError = null;
  let reportError = null;
  let recoveryTimer = 0;
  const recoveryCandidates = new Set();
  let state = null;
  let receiverInstanceId = null;
  let receiverDocumentId = null;
  let controlError = null;
  let exitReportError = null;
  let exitReportDetails = null;
  let lastExitedInstanceId = null;
  let suspended = false;
  let leaseTimer = 0;
  let cohort = null;
  let resumingCohort = null;
  let cohortGeneration = 0;
  const holds = new Map();
  const finishedHoldIds = new Map();
  const mediaListenerRoots = new Set();
  const pendingResumes = new Map();
  const pausing = new Set();
  const runtime = readRuntime();
  let receiverListenerInstalled = false;
  const shadowRootAccess = typeof globalThis.chrome?.dom?.openOrClosedShadowRoot === 'function'
    ? 'open_and_closed' : 'open_only';
  const onReadyStateChange = () => queueLifecycleRecovery('ready_state_change');
  const onVisibilityChange = () => scheduleReport('visibility_change');
  const onPageShow = () => {
    if (suspended) {
      suspended = false;
      receiverDocumentId = null;
      receiverInstanceId = null;
      initializeControlIdentity();
      recoverDocument('bfcache_restore');
      reportControlReady({ force: true });
      return;
    }
    queueLifecycleRecovery('page_show');
  };
  const onPageHide = (event) => {
    reportControlExit(event.persisted === true ? 'bfcache_pagehide' : 'pagehide');
    suspended = true;
    abandonHolds('MEDIA_FRAME_CONTROL_PAGE_HIDDEN');
    receiverDocumentId = null;
    if (reportTimer) clearTimeout(reportTimer);
    if (recoveryTimer) clearTimeout(recoveryTimer);
    reportTimer = 0;
    recoveryTimer = 0;
    recoveryCandidates.clear();
    pendingLifecycleRecovery = null;
    if (event.persisted !== true) teardown('page_hidden');
  };

  function isTopReachable() {
    try {
      let frame = window;
      while (frame !== frame.top) {
        const parent = frame.parent;
        if (!parent || parent === frame || !parent.document) return false;
        frame = parent;
      }
      return true;
    } catch (_error) {
      // Same-origin access is the capability check. A same-origin grandchild
      // under an inaccessible ancestor is still outside the top DOM owner.
      return false;
    }
  }

  function ownedMedia() {
    const media = [];
    [liveVideos, liveAudio].forEach((inventory) => inventory.forEach((element) => {
      if (isOwnedConnectedNode(element)) media.push(element);
      else {
        inventory.delete(element);
        cohort?.entries.delete(element);
        markInventoryChanged();
      }
    }));
    return media;
  }

  function markInventoryChanged() {
    if (inventoryRevision === Number.MAX_SAFE_INTEGER) throw new Error('MEDIA_FRAME_INVENTORY_REVISION_EXHAUSTED');
    inventoryRevision += 1;
  }

  function readSource(element) {
    return {
      currentSrc: element.currentSrc,
      src: element.getAttribute('src'),
      srcObject: element.srcObject,
      sources: Array.from(element.childNodes).filter((node) => (
        node.nodeType === 1 && node.namespaceURI === HTML_NAMESPACE && node.localName === 'source'
      )).map((node) => ({ node, src: node.getAttribute('src'), type: node.getAttribute('type'), media: node.getAttribute('media') })),
    };
  }

  function matchesSource(element, source) {
    const next = readSource(element);
    return next.currentSrc === source.currentSrc && next.src === source.src
      && next.srcObject === source.srcObject && next.sources.length === source.sources.length
      && next.sources.every((entry, index) => {
        const previous = source.sources[index];
        return entry.node === previous.node && entry.src === previous.src
          && entry.type === previous.type && entry.media === previous.media;
      });
  }

  function pauseMedia(element) {
    if (!isOwnedConnectedNode(element) || pausing.has(element)) return false;
    pausing.add(element);
    try {
      element.pause();
      return element.paused === true;
    } catch (error) {
      controlError = 'MEDIA_FRAME_CONTROL_PAUSE_FAILED';
      console.warn('[mediaFrameProbe] media pause failed', error);
      return false;
    } finally {
      pausing.delete(element);
    }
  }

  function cancelPendingResumes() {
    pendingResumes.forEach((attempt, element) => {
      attempt.cancelled = true;
      pauseMedia(element);
      attempt.finish(false);
    });
  }

  function onMediaEvent(event) {
    const element = event.target;
    if (!isMediaElement(element) || !isOwnedConnectedNode(element)) return;
    if (expireHolds()) scheduleLeaseExpiry();
    const inventory = isVideoElement(element) ? liveVideos : liveAudio;
    if (!inventory.has(element)) {
      inventory.add(element);
      markInventoryChanged();
      scheduleReport('media_event_discovery');
    }
    if (event.type === 'loadstart' || event.type === 'emptied') {
      markInventoryChanged();
      scheduleReport('media_source_invalidated');
      const entry = cohort?.entries.get(element);
      if (entry) entry.resumeEligible = false;
      const attempt = pendingResumes.get(element);
      if (attempt) {
        attempt.cancelled = true;
        pauseMedia(element);
        attempt.finish(false);
      }
    }
    if (!suspended && holds.size > 0) pauseMedia(element);
  }

  function attachMediaRoot(root) {
    if (mediaListenerRoots.has(root)) return;
    mediaListenerRoots.add(root);
    MEDIA_EVENTS.forEach((name) => root.addEventListener(name, onMediaEvent, true));
  }

  function detachMediaRoot(root) {
    if (!mediaListenerRoots.has(root)) return;
    MEDIA_EVENTS.forEach((name) => root.removeEventListener(name, onMediaEvent, true));
    mediaListenerRoots.delete(root);
  }

  function initializeControlIdentity() {
    try {
      // getRandomValues is available on HTTP documents too; randomUUID is
      // restricted to secure contexts in some content-script environments.
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      receiverInstanceId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      if (!UUID_PATTERN.test(receiverInstanceId)) throw new Error('invalid receiver identity');
      // The new instance fences every old command, including BFCache receipts.
      // A current top hold may acquire this fresh receiver using its existing ID.
      finishedHoldIds.clear();
      lastReadySignature = '';
      pendingReadySignature = '';
      readyAttempt += 1;
      controlError = null;
      exitReportError = null;
      exitReportDetails = null;
    } catch (error) {
      controlError = 'MEDIA_FRAME_CONTROL_IDENTITY_UNAVAILABLE';
      console.warn('[mediaFrameProbe] receiver identity failed', error);
    }
  }

  function reportControlReady({ force = false } = {}) {
    if (!state?.active || suspended || !receiverInstanceId || !receiverListenerInstalled) return;
    const instanceId = receiverInstanceId;
    try {
      const observedMediaCount = observationError ? null : ownedMedia().length;
      const payload = {
        version: CONTROL_VERSION,
        instanceId,
        inventoryRevision,
        topReachable: isTopReachable(),
        capabilities: { pause: 'supported', resume: 'supported', seek: 'unsupported' },
        observation: observationError ? 'failed' : 'observed',
        observedMediaCount,
      };
      const signature = JSON.stringify(payload);
      // Only acknowledged or currently pending healthy observations deduplicate.
      // DISCOVER/reinjection must always recover a lost service-worker ledger.
      if (!force && !observationError && (signature === lastReadySignature || signature === pendingReadySignature)) {
        readySuppressedCount += 1;
        return;
      }
      const attempt = ++readyAttempt;
      pendingReadySignature = signature;
      readyMessageCount += 1;
      runtime.sendMessage({
        type: CONTROL_READY_TYPE,
        payload,
      }, (response) => {
        if (!state?.active || suspended || instanceId !== receiverInstanceId || attempt !== readyAttempt) return;
        pendingReadySignature = '';
        if (runtime.lastError || response?.success !== true || typeof response.documentId !== 'string' || !response.documentId) {
          lastReadySignature = '';
          controlError = 'MEDIA_FRAME_CONTROL_READY_REJECTED';
          return;
        }
        if (receiverDocumentId && receiverDocumentId !== response.documentId) {
          lastReadySignature = '';
          abandonHolds('MEDIA_FRAME_CONTROL_DOCUMENT_CHANGED');
          return;
        }
        receiverDocumentId = response.documentId;
        lastReadySignature = signature;
        if (controlError === 'MEDIA_FRAME_CONTROL_READY_REJECTED' || controlError === 'MEDIA_FRAME_CONTROL_READY_FAILED') controlError = null;
      });
    } catch (error) {
      lastReadySignature = '';
      pendingReadySignature = '';
      controlError = 'MEDIA_FRAME_CONTROL_READY_FAILED';
      console.warn('[mediaFrameProbe] receiver ready failed', error);
    }
  }

  function reportControlExit(reason) {
    if (!receiverInstanceId || lastExitedInstanceId === receiverInstanceId) return;
    const instanceId = receiverInstanceId;
    const documentId = receiverDocumentId;
    lastExitedInstanceId = instanceId;
    try {
      if (!runtime?.sendMessage) throw new Error('exit messaging unavailable');
      runtime.sendMessage({ type: CONTROL_EXIT_TYPE, payload: { version: CONTROL_VERSION, instanceId } }, (response) => {
        if (receiverInstanceId !== instanceId) return;
        const transportError = runtime.lastError;
        if (transportError || response?.success !== true) {
          exitReportError = 'MEDIA_FRAME_CONTROL_EXIT_REJECTED';
          exitReportDetails = Object.freeze({
            reason,
            instanceId,
            documentId,
            failureKind: transportError ? 'transport' : 'receiver_rejection',
            transportMessage: typeof transportError?.message === 'string'
              ? transportError.message.slice(0, 240) : null,
            responseCode: typeof response?.errorCode === 'string' ? response.errorCode.slice(0, 160) : null,
            responseError: typeof response?.error === 'string' ? response.error.slice(0, 240) : null,
          });
          console.warn('[mediaFrameProbe] receiver exit report rejected', exitReportDetails);
        }
      });
    } catch (error) {
      exitReportError = 'MEDIA_FRAME_CONTROL_EXIT_FAILED';
      exitReportDetails = Object.freeze({
        reason, instanceId, documentId, failureKind: 'send_exception',
        transportMessage: typeof error?.message === 'string' ? error.message.slice(0, 240) : null,
      });
      console.warn('[mediaFrameProbe] receiver exit report failed', error);
    }
  }

  function scheduleLeaseExpiry() {
    if (leaseTimer) clearTimeout(leaseTimer);
    leaseTimer = 0;
    if (!holds.size) return;
    const nextExpiry = Math.min(...Array.from(holds.values()));
    leaseTimer = setTimeout(() => {
      leaseTimer = 0;
      expireHolds();
      scheduleLeaseExpiry();
    }, Math.max(0, nextExpiry - Date.now()));
  }

  function expireHolds() {
    const now = Date.now();
    let expired = false;
    holds.forEach((expiresAt, holdId) => {
      if (expiresAt > now) return;
      expired = true;
      holds.delete(holdId);
      finishedHoldIds.set(holdId, now + MAX_HOLD_MS);
      if (cohort) cohort.resumeAllowed = false;
      controlError = 'MEDIA_FRAME_CONTROL_LEASE_EXPIRED';
    });
    if (expired && !holds.size) {
      cohort = null;
      cohortGeneration += 1;
      cancelPendingResumes();
    }
    return expired;
  }

  function abandonHolds(reason) {
    const now = Date.now();
    holds.forEach((_expiresAt, holdId) => finishedHoldIds.set(holdId, now + MAX_HOLD_MS));
    holds.clear();
    cohort = null;
    resumingCohort = null;
    cohortGeneration += 1;
    if (leaseTimer) clearTimeout(leaseTimer);
    leaseTimer = 0;
    cancelPendingResumes();
    controlError = reason;
  }

  function makeResult(payload) {
    return {
      version: CONTROL_VERSION,
      instanceId: receiverInstanceId,
      documentId: receiverDocumentId,
      holdId: payload?.holdId,
      accepted: false,
      status: 'rejected',
      observedCount: observationError ? null : ownedMedia().length,
      attemptedCount: 0,
      pausedCount: 0,
      failedCount: 0,
      resumedCount: 0,
      resumeFailedCount: 0,
      errorCode: null,
    };
  }

  function validateCommand(payload, sender) {
    const senderError = validateBackgroundSender(sender);
    if (senderError) return senderError;
    if (!state?.active || suspended || !receiverDocumentId) return 'MEDIA_FRAME_CONTROL_NOT_READY';
    if (payload?.version !== CONTROL_VERSION || !['begin', 'renew', 'end', 'revoke'].includes(payload.action)
      || !UUID_PATTERN.test(payload.holdId) || payload.instanceId !== receiverInstanceId
      || payload.documentId !== receiverDocumentId || typeof payload.resume !== 'boolean'
      || !Number.isFinite(payload.expiresAt)) return 'MEDIA_FRAME_CONTROL_COMMAND_INVALID';
    if ((payload.action === 'begin' || payload.action === 'renew')
      && (payload.expiresAt <= Date.now() || payload.expiresAt > Date.now() + MAX_HOLD_MS || payload.resume)) {
      return 'MEDIA_FRAME_CONTROL_LEASE_INVALID';
    }
    if (payload.action === 'revoke' && payload.resume) return 'MEDIA_FRAME_CONTROL_COMMAND_INVALID';
    return null;
  }

  function validateBackgroundSender(sender) {
    if (!runtime?.id || sender?.id !== runtime.id || sender.tab != null) return 'MEDIA_FRAME_CONTROL_SENDER_REJECTED';
    if (sender.url) {
      const worker = runtime.getManifest().background?.service_worker;
      if (typeof worker !== 'string' || sender.url !== runtime.getURL(worker)) return 'MEDIA_FRAME_CONTROL_SENDER_REJECTED';
    }
    return null;
  }

  function enforceHold(result, initial) {
    ownedMedia().forEach((element) => {
      result.attemptedCount += 1;
      let entry = null;
      try {
        if (initial && element.paused === false && element.ended === false) {
          try {
            entry = { source: readSource(element), resumeEligible: true };
            cohort.entries.set(element, entry);
          } catch (error) {
            controlError = 'MEDIA_FRAME_CONTROL_SOURCE_SNAPSHOT_FAILED';
            console.warn('[mediaFrameProbe] media source snapshot failed', error);
          }
        }
        if (pauseMedia(element)) result.pausedCount += 1;
        else {
          if (entry) entry.resumeEligible = false;
          result.failedCount += 1;
        }
      } catch (error) {
        result.failedCount += 1;
        console.warn('[mediaFrameProbe] media admission failed', error);
      }
    });
    result.status = result.failedCount > 0 || observationError ? 'partial' : 'held';
    if (result.failedCount) result.errorCode = 'MEDIA_FRAME_CONTROL_PAUSE_FAILED';
    else if (observationError) result.errorCode = observationError;
  }

  function resumeMedia(element, entry, generation) {
    return new Promise((resolve) => {
      let timer = 0;
      let finished = false;
      const attempt = {
        cancelled: false,
        finish: (success) => {
          if (finished) return;
          finished = true;
          if (timer) clearTimeout(timer);
          if (pendingResumes.get(element) === attempt) pendingResumes.delete(element);
          resolve(success);
        },
      };
      pendingResumes.set(element, attempt);
      timer = setTimeout(() => {
        attempt.cancelled = true;
        pauseMedia(element);
        attempt.finish(false);
      }, RESUME_TIMEOUT_MS);
      try {
        const playback = element.play();
        Promise.resolve(playback).then(() => {
          const current = !attempt.cancelled && state?.active && !suspended && holds.size === 0
            && generation === cohortGeneration && isOwnedConnectedNode(element) && matchesSource(element, entry.source);
          if (!current) pauseMedia(element);
          attempt.finish(current && element.paused === false && element.ended === false);
        }, () => {
          pauseMedia(element);
          attempt.finish(false);
        }).catch((error) => {
          pauseMedia(element);
          attempt.finish(false);
          console.warn('[mediaFrameProbe] resume verification failed', error);
        });
      } catch (_error) {
        pauseMedia(element);
        attempt.finish(false);
      }
    });
  }

  async function executeCommand(payload, sender) {
    const error = validateCommand(payload, sender);
    if (error) return { ...makeResult(payload), errorCode: error };
    if (payload.action === 'begin') beginCommandCount += 1;
    if (payload.action === 'renew') renewCommandCount += 1;
    if (payload.action === 'begin' || payload.action === 'renew') {
      flushLifecycleRecovery();
      if (payload.expiresAt <= Date.now()) return { ...makeResult(payload), errorCode: 'MEDIA_FRAME_CONTROL_LEASE_INVALID' };
    }
    const result = makeResult(payload);
    if (isTopReachable()) return { ...result, accepted: true, status: 'managed_by_top' };
    const now = Date.now();
    if (expireHolds()) scheduleLeaseExpiry();
    finishedHoldIds.forEach((expiresAt, holdId) => { if (expiresAt <= now) finishedHoldIds.delete(holdId); });
    if (!holds.has(payload.holdId) && !finishedHoldIds.has(payload.holdId)
      && holds.size + finishedHoldIds.size >= MAX_HOLD_IDS) {
      return { ...result, errorCode: 'MEDIA_FRAME_CONTROL_HOLD_CAPACITY' };
    }
    if (payload.action === 'begin' || payload.action === 'renew') {
      if (finishedHoldIds.has(payload.holdId) || (payload.action === 'renew' && !holds.has(payload.holdId))) {
        return { ...result, errorCode: 'MEDIA_FRAME_CONTROL_HOLD_STALE' };
      }
      if (!holds.has(payload.holdId) && holds.size + finishedHoldIds.size >= MAX_HOLD_IDS) {
        return { ...result, errorCode: 'MEDIA_FRAME_CONTROL_HOLD_CAPACITY' };
      }
      const initial = holds.size === 0;
      if (initial) {
        cohortGeneration += 1;
        cancelPendingResumes();
        resumingCohort = null;
        cohort = { entries: new Map(), holdIds: new Set(), resumeAllowed: true };
      }
      holds.set(payload.holdId, payload.expiresAt);
      cohort.holdIds.add(payload.holdId);
      result.accepted = true;
      enforceHold(result, initial);
      scheduleLeaseExpiry();
      return result;
    }
    const existed = holds.delete(payload.holdId);
    finishedHoldIds.set(payload.holdId, now + MAX_HOLD_MS);
    if (!payload.resume && resumingCohort?.holdIds.has(payload.holdId)) {
      cohortGeneration += 1;
      cancelPendingResumes();
      resumingCohort = null;
    }
    if (existed && !payload.resume && cohort) cohort.resumeAllowed = false;
    result.accepted = true;
    result.status = holds.size ? 'held' : 'released';
    scheduleLeaseExpiry();
    if (!existed || holds.size > 0) return result;
    const releasing = cohort;
    cohort = null;
    const generation = ++cohortGeneration;
    if (!payload.resume || !releasing?.resumeAllowed) return result;
    resumingCohort = releasing;
    const resumptions = [];
    releasing.entries.forEach((entry, element) => {
      try {
        if (!entry.resumeEligible || !isOwnedConnectedNode(element) || !matchesSource(element, entry.source)
          || element.paused !== true || element.ended !== false) return;
        resumptions.push(resumeMedia(element, entry, generation).then((success) => {
          if (success) result.resumedCount += 1;
          else result.resumeFailedCount += 1;
        }));
      } catch (_error) { result.resumeFailedCount += 1; }
    });
    await Promise.all(resumptions);
    if (resumingCohort === releasing) resumingCohort = null;
    if (result.resumeFailedCount) result.errorCode = 'MEDIA_FRAME_CONTROL_RESUME_FAILED';
    return result;
  }

  function onControlMessage(message, sender, sendResponse) {
    if (message?.type === CONTROL_DISCOVER_TYPE) {
      try {
        if (validateBackgroundSender(sender) || message.payload?.version !== CONTROL_VERSION) return false;
        reportControlReady({ force: true });
        sendResponse({ success: true });
      } catch (error) {
        controlError = 'MEDIA_FRAME_CONTROL_DISCOVER_FAILED';
        console.warn('[mediaFrameProbe] receiver discover failed', error);
        sendResponse({ success: false });
      }
      return false;
    }
    if (message?.type !== CONTROL_MESSAGE_TYPE) return false;
    executeCommand(message.payload, sender).then(sendResponse, (error) => {
      controlError = 'MEDIA_FRAME_CONTROL_COMMAND_FAILED';
      console.warn('[mediaFrameProbe] command failed', error);
      sendResponse({ ...makeResult(message.payload), errorCode: controlError });
    });
    return true;
  }

  function installControlReceiver() {
    initializeControlIdentity();
    try {
      if (!runtime?.onMessage?.addListener) throw new Error('receiver messaging unavailable');
      runtime.onMessage.addListener(onControlMessage);
      receiverListenerInstalled = true;
    } catch (error) {
      controlError = 'MEDIA_FRAME_CONTROL_LISTENER_FAILED';
      console.warn('[mediaFrameProbe] receiver install failed', error);
    }
  }

  function failObservation(phase, error) {
    observationError = `MEDIA_FRAME_${phase}_FAILED`;
    console.warn('[mediaFrameProbe] observation failed', { phase, error });
    if (state?.active) scheduleReport('observation_failed');
  }

  function observeShadowRoot(root) {
    if (!root || shadowObservers.has(root)) return;
    if (typeof MutationObserver !== 'function') throw new Error('MEDIA_FRAME_MUTATION_OBSERVER_REQUIRED');
    const shadowObserver = new MutationObserver((mutations) => handleMutations(mutations));
    try {
      shadowObserver.observe(root, {
        childList: true,
        subtree: true,
      });
      shadowObservers.set(root, shadowObserver);
      attachMediaRoot(root);
    } catch (error) {
      try {
        shadowObserver.disconnect();
      } catch (disconnectError) {
        failObservation('SHADOW_CLEANUP', disconnectError);
      }
      throw error;
    }
  }

  function scanSubtree(root) {
    if (!root) return false;
    if (root === document) fullDocumentScanCount += 1;
    if (expireHolds()) scheduleLeaseExpiry();
    const stack = [root];
    let changed = false;
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) continue;
      visitedNodeCount += 1;
      if (!isOwnedConnectedNode(node)) continue;

      if (isMediaElement(node)) {
        const inventory = isVideoElement(node) ? liveVideos : liveAudio;
        if (!inventory.has(node)) {
          inventory.add(node);
          markInventoryChanged();
          changed = true;
          if (!suspended && holds.size > 0) pauseMedia(node);
        }
      }

      const shadowRoot = readShadowRoot(node);
      if (shadowRoot) {
        observeShadowRoot(shadowRoot);
        stack.push(shadowRoot);
      }
      forEachNode(node.childNodes, (child) => stack.push(child));
    }
    return changed;
  }

  function pruneDetachedShadowRoots() {
    shadowObservers.forEach((shadowObserver, root) => {
      if (isOwnedConnectedNode(root?.host)) return;
      try {
        shadowObserver.disconnect();
        detachMediaRoot(root);
      } catch (error) {
        failObservation('SHADOW_CLEANUP', error);
        return;
      }
      shadowObservers.delete(root);
    });
  }

  function handleMutations(mutations) {
    if (!state?.active) return;
    mutationBatchCount += 1;
    let changed = false;
    try {
      const addedRoots = new Set();
      let addedRootCount = 0;
      let hasRemovals = false;
      forEachNode(mutations, (mutation) => {
        forEachNode(mutation?.addedNodes, (node) => {
          mutationAddedRootCount += 1;
          addedRootCount += 1;
          addedRoots.add(node);
        });
        if (mutation?.removedNodes?.length) hasRemovals = true;
      });
      // Removal needs only the bounded live inventory, never the removed tree.
      // Connected same-document moves keep their hold/source eligibility.
      if (hasRemovals) {
        removalPruneCount += 1;
        const previousRevision = inventoryRevision;
        ownedMedia();
        changed = inventoryRevision !== previousRevision;
        pruneDetachedShadowRoots();
      }
      const roots = [];
      addedRoots.forEach((node) => {
        if (!isOwnedConnectedNode(node)) return;
        let ancestor = node.parentNode || node.host;
        while (ancestor) {
          if (addedRoots.has(ancestor)) return;
          ancestor = ancestor.parentNode || ancestor.host;
        }
        roots.push(node);
      });
      collapsedMutationRootCount += addedRootCount - roots.length;
      roots.forEach((node) => {
        // A moved host can acquire a late shadow root without a mutation record.
        // Traverse its added side once; the removed side was handled by cache.
        incrementalSubtreeScanCount += 1;
        changed = scanSubtree(node) || changed;
      });
      if (changed) scheduleReport('media_mutation');
    } catch (error) {
      failObservation('INCREMENTAL_DISCOVERY', error);
    }
  }

  function registerRoot(root, reason = 'explicit_media_root') {
    if (!state?.active || !root) return false;
    try {
      if (root !== document && root.ownerDocument !== document) {
        throw new Error('MEDIA_FRAME_ROOT_DOCUMENT_MISMATCH');
      }
      if (!isOwnedConnectedNode(root)) return false;
      if (root.host) observeShadowRoot(root);
      const changed = scanSubtree(root);
      if (changed) scheduleReport(reason);
      return true;
    } catch (error) {
      failObservation('ROOT_DISCOVERY', error);
      return false;
    }
  }

  function recoverDocument(reason, { report = true } = {}) {
    if (!state?.active) return;
    recoveryDocumentScanCount += 1;
    try {
      ownedMedia();
      pruneDetachedShadowRoots();
      scanSubtree(document);
    } catch (error) {
      failObservation('ROOT_DISCOVERY', error);
    }
    if (report) scheduleReport(reason);
  }

  function queueLifecycleRecovery(reason) {
    if (!state?.active || suspended) return;
    if (holds.size > 0) {
      pendingLifecycleRecovery = null;
      recoverDocument(reason);
      return;
    }
    // Initial ready-state/pageshow bursts share the existing first-dirty report
    // deadline. Active holds and BFCache restore retain synchronous discovery.
    pendingLifecycleRecovery = reason;
    scheduleReport(reason);
  }

  function flushLifecycleRecovery() {
    if (!pendingLifecycleRecovery) return;
    const reason = pendingLifecycleRecovery;
    pendingLifecycleRecovery = null;
    recoverDocument(reason, { report: false });
  }

  function onRecoveryEvent(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
    for (const node of path.slice(0, RECOVERY_PATH_LIMIT)) {
      if (recoveryCandidates.size >= RECOVERY_PATH_LIMIT) break;
      if (node?.nodeType === 1) recoveryCandidates.add(node);
    }
    if (recoveryTimer || recoveryCandidates.size === 0) return;
    recoveryTimer = setTimeout(() => {
      recoveryTimer = 0;
      const candidates = Array.from(recoveryCandidates);
      recoveryCandidates.clear();
      if (!state?.active) return;
      try {
        candidates.forEach((node) => {
          if (!isOwnedConnectedNode(node)) return;
          if (isMediaElement(node) && !(isVideoElement(node) ? liveVideos : liveAudio).has(node)) {
            registerRoot(node, 'media_event_discovery');
          }
          const root = readShadowRoot(node);
          if (root && !shadowObservers.has(root)) registerRoot(root, 'shadow_event_discovery');
        });
      } catch (error) {
        failObservation('EVENT_DISCOVERY', error);
      }
    }, 0);
  }

  function buildPayload(reason) {
    const videoCount = observationError ? null : liveVideos.size;
    return {
      status: observationError ? 'failed' : 'observed',
      observationError,
      shadowRootAccess,
      lateShadowDiscovery: 'explicit_registration_or_document_event',
      reason,
      url: readLocationHref(),
      startedAt,
      reportedAt: Date.now(),
      frameKind: 'frame',
      topFrame: false,
      videoObservationMode: VIDEO_OBSERVATION_MODE,
      readyState: readDocumentReadyState(),
      visibilityState: readVisibilityState(),
      htmlVideoElementAvailable: canUseHtmlVideoElement(),
      videoCount,
      hasVideo: observationError ? null : videoCount > 0,
    };
  }

  function publish(reason = 'probe_report', { force = false } = {}) {
    flushLifecycleRecovery();
    reportControlReady({ force });
    const payload = buildPayload(reason);
    const signature = JSON.stringify({
      url: payload.url,
      readyState: payload.readyState,
      visibilityState: payload.visibilityState,
      videoCount: payload.videoCount,
      hasVideo: payload.hasVideo,
      videoObservationMode: payload.videoObservationMode,
      status: payload.status,
      observationError: payload.observationError,
    });
    if (!force && signature === lastSignature) return payload;
    const runtime = readRuntime();
    if (!runtime?.sendMessage) {
      reportError = 'MEDIA_FRAME_REPORT_RUNTIME_UNAVAILABLE';
      return payload;
    }

    try {
      reportError = null;
      runtime.sendMessage({
        type: MESSAGE_TYPE,
        payload,
      }, () => {
        try {
          if (runtime.lastError) {
            reportError = 'MEDIA_FRAME_REPORT_REJECTED';
            lastSignature = '';
          }
        } catch (error) {
          reportError = 'MEDIA_FRAME_REPORT_CALLBACK_FAILED';
          lastSignature = '';
          console.warn('[mediaFrameProbe] report failed', error);
        }
      });
      if (!reportError) lastSignature = signature;
    } catch (error) {
      reportError = 'MEDIA_FRAME_REPORT_FAILED';
      console.warn('[mediaFrameProbe] report failed', error);
    }
    return payload;
  }

  function scheduleReport(reason = 'dom_mutation') {
    if (!state?.active || suspended) return;
    // Keep the first dirty deadline: continued DOM changes cannot starve reports.
    if (reportTimer) return;
    reportTimer = setTimeout(() => {
      reportTimer = 0;
      publish(reason);
    }, REPORT_DEBOUNCE_MS);
  }

  function installFrameObservation() {
    try {
      if (typeof MutationObserver !== 'function') throw new Error('MEDIA_FRAME_MUTATION_OBSERVER_REQUIRED');
      documentObserver = new MutationObserver((mutations) => handleMutations(mutations));
      documentObserver.observe(document, { childList: true, subtree: true });
      attachMediaRoot(document);
      initialDocumentScanCount += 1;
      scanSubtree(document);
    } catch (error) {
      failObservation('INITIAL_DISCOVERY', error);
    }
  }

  function installDocumentListeners() {
    try {
      document.addEventListener('readystatechange', onReadyStateChange, true);
      document.addEventListener('visibilitychange', onVisibilityChange, true);
      RECOVERY_EVENTS.forEach((name) => document.addEventListener(name, onRecoveryEvent, true));
    } catch (error) { failObservation('LISTENER_INSTALL', error); }
    try {
      window.addEventListener('pageshow', onPageShow, true);
      window.addEventListener('pagehide', onPageHide, true);
    } catch (error) { failObservation('LISTENER_INSTALL', error); }
  }

  function teardown(reason = 'probe_teardown') {
    if (!state?.active) return true;
    reportControlExit(reason);
    const cleanupErrors = [];
    const noteCleanupFailure = (phase, error) => {
      cleanupErrors.push(error);
      failObservation(phase, error);
    };
    state.active = false;
    abandonHolds('MEDIA_FRAME_CONTROL_TEARDOWN');
    state.teardownReason = reason;
    if (reportTimer) {
      clearTimeout(reportTimer);
      reportTimer = 0;
    }
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = 0;
    recoveryCandidates.clear();
    pendingLifecycleRecovery = null;
    try {
      documentObserver?.disconnect();
      documentObserver = null;
    } catch (error) { noteCleanupFailure('DOCUMENT_CLEANUP', error); }
    shadowObservers.forEach((shadowObserver, root) => {
      try {
        shadowObserver.disconnect();
        detachMediaRoot(root);
        shadowObservers.delete(root);
      } catch (error) { noteCleanupFailure('SHADOW_CLEANUP', error); }
    });
    try {
      document.removeEventListener('readystatechange', onReadyStateChange, true);
      document.removeEventListener('visibilitychange', onVisibilityChange, true);
      RECOVERY_EVENTS.forEach((name) => document.removeEventListener(name, onRecoveryEvent, true));
      detachMediaRoot(document);
    } catch (error) { noteCleanupFailure('LISTENER_CLEANUP', error); }
    try {
      window.removeEventListener('pageshow', onPageShow, true);
      window.removeEventListener('pagehide', onPageHide, true);
    } catch (error) { noteCleanupFailure('LISTENER_CLEANUP', error); }
    try {
      if (receiverListenerInstalled) runtime.onMessage.removeListener(onControlMessage);
      receiverListenerInstalled = false;
    } catch (error) { noteCleanupFailure('RECEIVER_CLEANUP', error); }
    if (cleanupErrors.length > 0) {
      state.active = true;
      throw new AggregateError(cleanupErrors, 'MEDIA_FRAME_TEARDOWN_FAILED');
    }
    liveVideos.clear();
    liveAudio.clear();
    finishedHoldIds.clear();
    return true;
  }

  state = writeState({
    active: true,
    version: PROBE_VERSION,
    startedAt,
    report: publish,
    reportControlReady,
    getControlSnapshot: () => ({
      instanceId: receiverInstanceId,
      documentId: receiverDocumentId,
      topReachable: isTopReachable(),
      suspended,
      activeHoldCount: holds.size,
      resumeCandidateCount: cohort?.entries.size || 0,
      pendingResumeCount: pendingResumes.size,
      observedMediaCount: observationError ? null : ownedMedia().length,
      inventoryRevision,
      errorCode: controlError,
      exitReportError,
      exitReportDetails,
    }),
    registerRoot,
    teardown,
    getDebugSnapshot: () => ({
      active: state?.active === true,
      version: PROBE_VERSION,
      videoObservationMode: VIDEO_OBSERVATION_MODE,
      videoCount: liveVideos.size,
      audioCount: liveAudio.size,
      initialDocumentScanCount,
      incrementalSubtreeScanCount,
      recoveryDocumentScanCount,
      fullDocumentScanCount,
      visitedNodeCount,
      mutationBatchCount,
      mutationAddedRootCount,
      collapsedMutationRootCount,
      removalPruneCount,
      inventoryRevision,
      readyMessageCount,
      readySuppressedCount,
      readyPending: pendingReadySignature !== '',
      beginCommandCount,
      renewCommandCount,
      observationError,
      reportError,
      shadowRootAccess,
      documentObserverActive: !!documentObserver,
      shadowObserverCount: shadowObservers.size,
    }),
  });

  installFrameObservation();
  installDocumentListeners();
  installControlReceiver();
  publish('probe_started', { force: true });
  if (state?.active) scheduleReport('probe_settled');
})();
