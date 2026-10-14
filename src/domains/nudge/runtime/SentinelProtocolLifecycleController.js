import {
  bindSentinelLifecycleListeners,
  markSentinelNudgeEpisodeAbsorbed,
  markSentinelNudgeAborted,
  markSentinelNudgePresented,
  markSentinelNudgeResolved,
  unbindSentinelLifecycleListeners,
} from '../nudge/nudgeGameLifecycle.js';
import {
  SENTINEL_MEDIA_SUPPRESS_MODES,
  createSentinelMediaSuppressor,
} from '../nudge/nudgeGameMediaSuppression.js';
import { createPageMediaHold } from '../media/PageMediaHold.js';

export function createSentinelProtocolLifecycleController({
  isGlobalProtocolActive = () => false,
  createMediaSuppressor = createSentinelMediaSuppressor,
  onPresentedUnconfirmed = null,
} = {}) {
  let mode = 'auto';
  let activeNudgeKey = null;
  let activeNudgeRunId = null;
  let admissionLeaseId = null;
  let goalBinding = null;
  let startedAtMs = 0;
  let finalAction = null;
  let resolvingPromise = null;
  let presentedSent = false;
  let episodeAbsorbedSent = false;
  let listenersBound = false;
  let pageHideHandler = null;
  let beforeUnloadHandler = null;
  let mediaSuppressor = null;
  let siteMediaHold = null;
  let lifecycleEpoch = 0;

  function configure({
    mode: nextMode = 'auto',
    activeNudgeKey: nextKey = null,
    activeNudgeRunId: nextRunId = null,
    admissionLeaseId: nextLeaseId = null,
    goalBinding: nextGoalBinding = null,
    startedAtMs: nextStartedAtMs = 0,
    lifecycleFinalAction = null,
    lifecyclePresentedSent = false,
    lifecycleEpisodeAbsorbedSent = false,
  } = {}) {
    lifecycleEpoch += 1;
    mode = nextMode;
    activeNudgeKey = nextKey;
    activeNudgeRunId = nextRunId;
    admissionLeaseId = nextLeaseId;
    goalBinding = nextGoalBinding;
    startedAtMs = nextStartedAtMs;
    finalAction = lifecycleFinalAction;
    resolvingPromise = null;
    presentedSent = lifecyclePresentedSent;
    episodeAbsorbedSent = lifecycleEpisodeAbsorbedSent;
  }

  function bindListeners() {
    const nextState = bindSentinelLifecycleListeners({
      lifecycleListenersBound: listenersBound,
      pageHideHandler,
      beforeUnloadHandler,
      onAbort: (reason) => markAborted(reason),
    });
    listenersBound = nextState.lifecycleListenersBound;
    pageHideHandler = nextState.pageHideHandler;
    beforeUnloadHandler = nextState.beforeUnloadHandler;
  }

  function unbindListeners() {
    const nextState = unbindSentinelLifecycleListeners({
      lifecycleListenersBound: listenersBound,
      pageHideHandler,
      beforeUnloadHandler,
    });
    listenersBound = nextState.lifecycleListenersBound;
    pageHideHandler = nextState.pageHideHandler;
    beforeUnloadHandler = nextState.beforeUnloadHandler;
  }

  function markPresented() {
    const requestEpoch = lifecycleEpoch;
    const result = markSentinelNudgePresented({
      lifecyclePresentedSent: presentedSent,
      activeNudgeKey,
      mode,
      activeNudgeRunId,
      admissionLeaseId,
      goalBinding,
      startedAtMs,
    });
    presentedSent = result.lifecyclePresentedSent;
    if (result.lifecycleSendPromise) {
      void result.lifecycleSendPromise.then((sendResult) => {
        if (
          requestEpoch !== lifecycleEpoch
          || sendResult?.ok === true
          || finalAction
        ) return;
        presentedSent = false;
        const authorityRejected = sendResult?.sent === true
          && sendResult?.response?.success === false;
        if (authorityRejected) {
          finalAction = 'presentation_rejected';
        }
        onPresentedUnconfirmed?.(sendResult);
      });
    }
    return result;
  }

  function markEpisodeAbsorbed(reason = 'site_furin_completed') {
    const result = markSentinelNudgeEpisodeAbsorbed({
      lifecycleEpisodeAbsorbedSent: episodeAbsorbedSent,
      activeNudgeKey,
      mode,
      activeNudgeRunId,
      startedAtMs,
      reason,
    });
    episodeAbsorbedSent = result.lifecycleEpisodeAbsorbedSent;
  }

  function markAborted(reason = 'aborted') {
    const result = markSentinelNudgeAborted({
      lifecycleFinalAction: finalAction,
      activeNudgeKey,
      mode,
      activeNudgeRunId,
      startedAtMs,
      reason,
    });
    finalAction = result.lifecycleFinalAction;
  }

  async function markResolved(reason = 'resolved') {
    if (resolvingPromise) return resolvingPromise;
    if (finalAction === 'resolved') return true;
    if (finalAction) return false;

    const requestEpoch = lifecycleEpoch;
    finalAction = 'resolving';
    resolvingPromise = markSentinelNudgeResolved({
      lifecycleFinalAction: null,
      activeNudgeKey,
      mode,
      activeNudgeRunId,
      startedAtMs,
      reason,
    }).then((result) => {
      if (requestEpoch === lifecycleEpoch) {
        finalAction = result.resolved === true ? 'resolved' : 'resolution_failed';
        resolvingPromise = null;
      }
      return result.resolved === true;
    });
    return resolvingPromise;
  }

  function suppressMedia() {
    if (!isGlobalProtocolActive()) {
      siteMediaHold ||= createPageMediaHold();
      siteMediaHold.suppress();
      return;
    }
    mediaSuppressor ||= createMediaSuppressor();
    mediaSuppressor.suppress({
      mode: isGlobalProtocolActive()
        ? SENTINEL_MEDIA_SUPPRESS_MODES.SEIZE
        : SENTINEL_MEDIA_SUPPRESS_MODES.SUBMERGE,
    });
  }

  function restoreMedia(modeOverride) {
    if (siteMediaHold) {
      siteMediaHold.restore({ resume: modeOverride === 'surface' });
      siteMediaHold = null;
    }
    mediaSuppressor?.restore({ mode: modeOverride });
  }

  function reset(nextState = {}) {
    unbindListeners();
    configure(nextState);
  }

  return {
    configure,
    reset,
    bindListeners,
    unbindListeners,
    markPresented,
    markEpisodeAbsorbed,
    markAborted,
    markResolved,
    suppressMedia,
    restoreMedia,
    getSiteMediaSnapshot: () => siteMediaHold?.snapshot() ?? null,
    resetEpisodeAbsorbed: () => {
      episodeAbsorbedSent = false;
    },
    hasFinalAction: () => !!finalAction,
  };
}
