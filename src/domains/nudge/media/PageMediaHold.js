import { getVideoElementObserverForDocument } from '../video/VideoElementObserver.js';
import {
  isTabMediaElement,
  isPlayingTabMediaElement,
  isMediaObservationExcludedNode,
  readMediaSourceIdentity,
  matchesMediaSourceIdentity,
} from './pageMediaElements.js';
import { pauseTabMediaElement } from './tabMediaControl.js';
import { createFrameMediaHoldClient } from './FrameMediaHoldClient.js';
import { FRAME_MEDIA_MAX_ORIGINS } from './frameMediaProtocol.js';
import { formatRuntimeDiagnostic } from '../../../platform/diagnostics/runtimeDiagnosticConsole.js';

const PLAY_EVENTS = ['play', 'playing'];
const SOURCE_EVENTS = ['emptied', 'loadstart'];

// Rituals own actuation and resume policy. The document's canonical video owner
// owns all document/shadow discovery, including accessible frame documents.
export function createPageMediaHold({
  documentRef = document,
  onDiagnostic = console.warn,
  mediaObserverForDocument = getVideoElementObserverForDocument,
  remoteHoldFactory = createFrameMediaHoldClient,
} = {}) {
  const entries = new Map();
  const documents = new Map();
  const roots = new Set();
  const frames = new Map();
  const pausing = new Set();
  let active = false;
  let blockedPlays = 0;
  let pauseAttempts = 0;
  let failedCount = 0;
  let inaccessibleFrames = 0;
  let resumeRequestedCount = 0;
  let resumeFailedCount = 0;
  let deferInitialPause = false;
  const remoteHold = remoteHoldFactory({ documentRef, onDiagnostic, getFrameOrigins });

  function getFrameOrigins() {
    const origins = new Set();
    for (const [frame, connection] of frames) {
      if (connection.document || frame.isConnected === false) continue;
      try {
        const source = frame.getAttribute('src');
        if (!source || !URL.canParse(source, frame.ownerDocument.baseURI)) continue;
        const parsed = new URL(source, frame.ownerDocument.baseURI);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') origins.add(parsed.origin);
      } catch (error) { report('frame_origin_read_failed', error); }
      if (origins.size === FRAME_MEDIA_MAX_ORIGINS) break;
    }
    return [...origins];
  }

  function report(reason, error = null, entry = null) {
    failedCount += 1;
    if (entry?.reportedFailures.has(reason)) return;
    entry?.reportedFailures.add(reason);
    const code = `PAGE_MEDIA_HOLD_${reason.toUpperCase()}`;
    onDiagnostic(formatRuntimeDiagnostic({
      scope: 'PageMediaHold', severity: 'warn', event: 'media_operation_failed',
      code, error, fields: { phase: reason },
    }), {
      code,
      ...(error ? { name: error.name } : {}),
    });
  }

  function pause(element, initial = false) {
    if (!isTabMediaElement(element) || isMediaObservationExcludedNode(element) || pausing.has(element)) return;
    let entry = entries.get(element);
    try {
      if (element.isConnected === false || !isCurrentDocument(element.ownerDocument)) {
        entries.delete(element);
        prune();
        return;
      }
      if (initial && entry) return;
      if (!isPlayingTabMediaElement(element)) return;
      if (!entry) {
        entry = {
          element,
          resumeEligible: initial,
          source: readMediaSourceIdentity(element),
          pausedByHold: false,
          reportedFailures: new Set(),
        };
        entries.set(element, entry);
      }
      if (initial && deferInitialPause) return;
      pausing.add(element);
      pauseAttempts += 1;
      const result = pauseTabMediaElement(element);
      if (!result.ok) {
        report(result.reason, result.error, entry);
        return;
      }
      entry.pausedByHold = true;
      blockedPlays += 1;
    } catch (error) {
      report('media_state_read_failed', error, entry);
    } finally {
      pausing.delete(element);
    }
  }

  function onPlay(event) { if (active) pause(event.target); }
  function onSourceChange(event) {
    const entry = entries.get(event.target);
    if (entry) entry.resumeEligible = false;
  }

  function attachRoot(root) {
    if (roots.has(root) || isMediaObservationExcludedNode(root)) return;
    if (!isCurrentDocument(root.nodeType === 9 ? root : root.ownerDocument)) return;
    // Retain cleanup ownership even when a listener installation throws.
    roots.add(root);
    PLAY_EVENTS.forEach((name) => root.addEventListener(name, onPlay, true));
    SOURCE_EVENTS.forEach((name) => root.addEventListener(name, onSourceChange, true));
  }

  function detachRoot(root) {
    PLAY_EVENTS.forEach((name) => root.removeEventListener(name, onPlay, true));
    SOURCE_EVENTS.forEach((name) => root.removeEventListener(name, onSourceChange, true));
    roots.delete(root);
  }

  function detachDocument(targetDocument) {
    for (const [frame, connection] of frames) {
      if (frame.ownerDocument !== targetDocument) continue;
      releaseFrame(frame, connection);
    }
    const connection = documents.get(targetDocument);
    if (connection?.unsubscribe) {
      connection.unsubscribe();
      connection.unsubscribe = null;
    }
    for (const root of roots) {
      if (root === targetDocument || root.ownerDocument === targetDocument) detachRoot(root);
    }
    for (const element of entries.keys()) {
      if (element.ownerDocument === targetDocument) entries.delete(element);
    }
    documents.delete(targetDocument);
  }

  function releaseFrame(frame, connection) {
    frame.removeEventListener('load', connection.onLoad);
    if (connection.document) detachDocument(connection.document);
    frames.delete(frame);
  }

  function attachFrame(frame, initial) {
    if (frames.has(frame)) return;
    const connection = { document: null, onLoad: null, inaccessible: false };
    const attach = (resumeEligible) => {
      if (!active) return;
      if (frame.isConnected === false || !isCurrentDocument(frame.ownerDocument)) {
        releaseFrame(frame, connection);
        return;
      }
      if (connection.document) detachDocument(connection.document);
      connection.document = null;
      const frameDocument = frame.contentDocument;
      if (!frameDocument) {
        if (!connection.inaccessible) {
          inaccessibleFrames += 1;
          connection.inaccessible = true;
          const code = 'SITE_FURIN_MEDIA_FRAME_INACCESSIBLE';
          onDiagnostic(formatRuntimeDiagnostic({
            scope: 'PageMediaHold', severity: 'warn', event: 'frame_outside_dom_reach', code,
          }), {
            code,
          });
        }
        return;
      }
      connection.inaccessible = false;
      connection.document = frameDocument;
      attachDocument(frameDocument, resumeEligible);
    };
    connection.onLoad = () => {
      try { attach(false); }
      catch (error) { report('frame_observation_failed', error); }
    };
    frames.set(frame, connection);
    frame.addEventListener('load', connection.onLoad);
    attach(initial);
  }

  function acquireInventory({ videos, audio, frames: observedFrames, roots: observedRoots }, initial) {
    observedRoots.forEach(attachRoot);
    videos.forEach((element) => pause(element, initial));
    audio.forEach((element) => pause(element, initial));
    observedFrames.forEach((frame) => {
      if (isMediaObservationExcludedNode(frame)) return;
      try { attachFrame(frame, initial); }
      catch (error) { report('frame_observation_failed', error); }
    });
  }

  function prune() {
    for (const [frame, connection] of frames) {
      if (frame.isConnected === false || !isCurrentDocument(frame.ownerDocument)) releaseFrame(frame, connection);
    }
    for (const element of entries.keys()) {
      if (element.isConnected === false || !isCurrentDocument(element.ownerDocument)) entries.delete(element);
    }
    for (const root of roots) {
      if (root.host?.isConnected === false || !isCurrentDocument(root.nodeType === 9 ? root : root.ownerDocument)) detachRoot(root);
    }
  }

  function attachDocument(targetDocument, initial) {
    if (documents.has(targetDocument)) return;
    const owner = mediaObserverForDocument(targetDocument);
    const connection = { owner, unsubscribe: null, initializing: initial };
    documents.set(targetDocument, connection);
    attachRoot(targetDocument);
    connection.unsubscribe = owner.subscribeMediaMutations({
      debugLabel: 'PageMediaHold.observation',
      synchronousInitialInventory: true,
      onMutation: ({ observedVideos, observedAudio, observedFrames, observedRoots, removedNodes }) => {
        if (!active || documents.get(targetDocument) !== connection) return;
        try {
          acquireInventory({
            videos: observedVideos, audio: observedAudio,
            frames: observedFrames, roots: observedRoots,
          }, connection.initializing);
          if (removedNodes.length > 0) prune();
        } catch (error) { report('mutation_delivery_failed', error); }
      },
    });
    acquireInventory(owner.getMediaSnapshot(), initial);
    connection.initializing = false;
  }

  function disconnect() {
    active = false;
    const failures = [];
    for (const root of roots) {
      try { detachRoot(root); } catch (error) {
        failures.push(error);
        report('cleanup_root_listeners_failed', error);
      }
    }
    for (const [frame, connection] of frames) {
      try {
        frame.removeEventListener('load', connection.onLoad);
        frames.delete(frame);
      } catch (error) {
        failures.push(error);
        report('cleanup_frame_listener_failed', error);
      }
    }
    for (const [targetDocument, connection] of documents) {
      try {
        connection.unsubscribe?.();
        documents.delete(targetDocument);
      } catch (error) {
        failures.push(error);
        report('cleanup_observation_failed', error);
      }
    }
    if (failures.length) throw new AggregateError(failures, 'PAGE_MEDIA_HOLD_CLEANUP_FAILED');
  }

  function isCurrentDocument(targetDocument) {
    if (!documents.has(targetDocument)) return false;
    if (targetDocument === documentRef) return true;
    for (const [frame, connection] of frames) {
      if (connection.document !== targetDocument) continue;
      return frame.isConnected && frame.contentDocument === targetDocument
        && isCurrentDocument(frame.ownerDocument);
    }
    return false;
  }

  function captureMediaScope(element) {
    const sourceDocument = element.ownerDocument;
    if (!isCurrentDocument(sourceDocument)) throw new Error('PAGE_MEDIA_HOLD_MEDIA_SCOPE_REQUIRED');
    const sourceWindow = documentRef.defaultView;
    const ancestry = [];
    let currentDocument = sourceDocument;
    while (currentDocument !== documentRef) {
      const connection = [...frames].find(([, value]) => value.document === currentDocument);
      if (!connection) throw new Error('PAGE_MEDIA_HOLD_MEDIA_SCOPE_REQUIRED');
      const frame = connection[0];
      ancestry.push({ frame, document: currentDocument, parentDocument: frame.ownerDocument });
      currentDocument = frame.ownerDocument;
    }
    // Volume restoration can outlive hold listener cleanup. Retain the exact
    // original ancestry, rather than depending on the cleared observation maps.
    return () => element.isConnected !== false && element.ownerDocument === sourceDocument
      && (!sourceWindow || sourceWindow.document === documentRef)
      && ancestry.every(({ frame, document: frameDocument, parentDocument }) => (
        frame.isConnected && frame.ownerDocument === parentDocument && frame.contentDocument === frameDocument
      ));
  }

  return {
    suppress({ deferPause = false } = {}) {
      if (active) return;
      if (documents.size || roots.size || frames.size) throw new Error('PAGE_MEDIA_HOLD_CLEANUP_RETRY_REQUIRED');
      active = true;
      blockedPlays = 0; pauseAttempts = 0; failedCount = 0; inaccessibleFrames = 0;
      resumeRequestedCount = 0; resumeFailedCount = 0;
      deferInitialPause = deferPause;
      try { attachDocument(documentRef, true); }
      catch (error) {
        try { disconnect(); } catch (cleanupError) { error.cleanupError = cleanupError; }
        entries.clear();
        throw error;
      } finally { deferInitialPause = false; }
      // Complete same-origin initial acquisition before remote receivers decide
      // which documents are already owned by the top hold. Remote media pauses
      // immediately; local deferred volume transitions retain their own policy.
      remoteHold.begin();
    },
    pauseTracked() {
      if (!active) return;
      entries.forEach(({ element }) => pause(element));
    },
    getInitiallyPlayingMedia: () => Array.from(entries.values())
      .filter((entry) => entry.resumeEligible).map((entry) => entry.element),
    captureMediaScope,
    restore({ resume = false, beforeResume = null } = {}) {
      const currentDocuments = new Set();
      if (resume) for (const targetDocument of documents.keys()) {
        try { if (isCurrentDocument(targetDocument)) currentDocuments.add(targetDocument); }
        catch (error) { report('frame_identity_unconfirmed', error); }
      }
      try { disconnect(); }
      catch (error) {
        remoteHold.end({ resume: false });
        throw error;
      }
      remoteHold.end({ resume });
      const heldEntries = [...entries.values()];
      entries.clear();
      for (const entry of heldEntries) {
        const { element, resumeEligible, pausedByHold, source } = entry;
        if (!resume || !resumeEligible || !pausedByHold || element.isConnected === false
          || !currentDocuments.has(element.ownerDocument)) continue;
        try {
          if (!matchesMediaSourceIdentity(element, source) || element.paused !== true) continue;
          beforeResume?.(element);
          const result = element.play();
          resumeRequestedCount += 1;
          result?.catch((error) => {
            resumeFailedCount += 1;
            report('resume_rejected', error, entry);
          });
        } catch (error) {
          resumeFailedCount += 1;
          report('resume_rejected', error, entry);
        }
      }
    },
    whenSettled: () => remoteHold.whenSettled(),
    snapshot: () => ({
      active, trackedCount: entries.size, blockedPlays, pauseAttempts, failedCount,
      observedRoots: roots.size, inaccessibleFrames, resumeRequestedCount, resumeFailedCount,
      remote: remoteHold.snapshot(),
    }),
  };
}
