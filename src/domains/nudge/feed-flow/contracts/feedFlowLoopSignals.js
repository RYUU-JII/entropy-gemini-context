function normalizeTimestamp(value) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeCount(value) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function normalizeRatio(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeNullableMs(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : null;
}

function normalizeContentClass(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized || 'feed';
}

function normalizeSurfaceMode(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized || 'unknown';
}

function createEmptySignals() {
  return {
    context: {
      surfaceMode: 'unknown',
      surfaceProfileId: '',
      semanticSurfaceId: '',
      surfaceConfidence: 0,
      contentClass: 'feed',
    },
    progression: {
      episodeId: '',
      burstDurationMs: 0,
      episodeActiveMs: 0,
      dose: 0,
      advanceCount: 0,
      rapidAdvanceStreak: 0,
      screenfulsConsumed: 0,
      itemTransitions: 0,
      dominantAdvanceSource: 'screenful',
    },
    novelty: {
      freshItemsSeen: 0,
      episodeFreshItemsSeen: 0,
      freshItemRate: 0,
    },
    rhythm: {
      medianDwellMs: null,
      maxPauseMs: 0,
    },
    directionality: {
      forwardIntentCount: 0,
      backwardIntentCount: 0,
      reverseScrollDistance: 0,
      backtrackRatio: 0,
      revisitCount: 0,
      recentBackwardIntentAt: 0,
      recentRevisitAt: 0,
    },
    intentionality: {
      recentInteractiveActionCount: 0,
      recentClickThroughAt: 0,
      recentInputFocusAt: 0,
      recentTypingAt: 0,
      recentSelectionAt: 0,
    },
    media: {
      activeVideoChangedCount: 0,
      recentMediaPlayAt: 0,
      recentMediaPauseAt: 0,
      sustainedMediaWatchMs: 0,
    },
    supply: {
      initialized: false,
      totalSteps: 0,
      demandSteps: 0,
      demandRatio: 0,
      loopPressure: 0,
      lastStepAt: 0,
      msSinceLastStep: null,
      lastDeltaPx: 0,
      lastThresholdPx: 0,
      lastBottomReachRatio: 0,
      maxDepthRatio: 0,
      skewedSteps: 0,
      lateConfirmedSteps: 0,
      expiredPendingSteps: 0,
      pendingStep: false,
      cadenceSettling: false,
    },
    control: {
      lastContinueAt: 0,
      continuePassUntil: 0,
    },
  };
}

export function createEmptyFeedFlowLoopSignals() {
  return createEmptySignals();
}

export function normalizeFeedFlowLoopSignals(rawSignals = null) {
  const source = rawSignals && typeof rawSignals === 'object' ? rawSignals : {};
  const base = createEmptySignals();

  return {
    context: {
      surfaceMode: normalizeSurfaceMode(source.context?.surfaceMode ?? base.context.surfaceMode),
      surfaceProfileId: typeof source.context?.surfaceProfileId === 'string'
        ? source.context.surfaceProfileId.trim()
        : '',
      semanticSurfaceId: typeof source.context?.semanticSurfaceId === 'string'
        ? source.context.semanticSurfaceId.trim()
        : '',
      surfaceConfidence: normalizeRatio(source.context?.surfaceConfidence ?? base.context.surfaceConfidence),
      contentClass: normalizeContentClass(source.context?.contentClass ?? base.context.contentClass),
    },
    progression: {
      episodeId: typeof source.progression?.episodeId === 'string'
        ? source.progression.episodeId.trim()
        : '',
      burstDurationMs: normalizeTimestamp(source.progression?.burstDurationMs ?? base.progression.burstDurationMs),
      episodeActiveMs: normalizeTimestamp(source.progression?.episodeActiveMs ?? base.progression.episodeActiveMs),
      dose: normalizeNumber(source.progression?.dose ?? base.progression.dose),
      advanceCount: normalizeCount(source.progression?.advanceCount ?? base.progression.advanceCount),
      rapidAdvanceStreak: normalizeCount(source.progression?.rapidAdvanceStreak ?? base.progression.rapidAdvanceStreak),
      screenfulsConsumed: normalizeNumber(source.progression?.screenfulsConsumed ?? base.progression.screenfulsConsumed),
      itemTransitions: normalizeCount(source.progression?.itemTransitions ?? base.progression.itemTransitions),
      dominantAdvanceSource: typeof source.progression?.dominantAdvanceSource === 'string'
        && source.progression.dominantAdvanceSource.trim()
        ? source.progression.dominantAdvanceSource.trim()
        : base.progression.dominantAdvanceSource,
    },
    novelty: {
      freshItemsSeen: normalizeCount(source.novelty?.freshItemsSeen ?? base.novelty.freshItemsSeen),
      episodeFreshItemsSeen: normalizeCount(source.novelty?.episodeFreshItemsSeen ?? base.novelty.episodeFreshItemsSeen),
      freshItemRate: normalizeNumber(source.novelty?.freshItemRate ?? base.novelty.freshItemRate),
    },
    rhythm: {
      medianDwellMs: normalizeNullableMs(source.rhythm?.medianDwellMs ?? base.rhythm.medianDwellMs),
      maxPauseMs: normalizeTimestamp(source.rhythm?.maxPauseMs ?? base.rhythm.maxPauseMs),
    },
    directionality: {
      forwardIntentCount: normalizeCount(source.directionality?.forwardIntentCount ?? base.directionality.forwardIntentCount),
      backwardIntentCount: normalizeCount(source.directionality?.backwardIntentCount ?? base.directionality.backwardIntentCount),
      reverseScrollDistance: normalizeNumber(source.directionality?.reverseScrollDistance ?? base.directionality.reverseScrollDistance),
      backtrackRatio: normalizeRatio(source.directionality?.backtrackRatio ?? base.directionality.backtrackRatio),
      revisitCount: normalizeCount(source.directionality?.revisitCount ?? base.directionality.revisitCount),
      recentBackwardIntentAt: normalizeTimestamp(
        source.directionality?.recentBackwardIntentAt ?? base.directionality.recentBackwardIntentAt,
      ),
      recentRevisitAt: normalizeTimestamp(
        source.directionality?.recentRevisitAt ?? base.directionality.recentRevisitAt,
      ),
    },
    intentionality: {
      recentInteractiveActionCount: normalizeCount(
        source.intentionality?.recentInteractiveActionCount ?? base.intentionality.recentInteractiveActionCount,
      ),
      recentClickThroughAt: normalizeTimestamp(
        source.intentionality?.recentClickThroughAt ?? base.intentionality.recentClickThroughAt,
      ),
      recentInputFocusAt: normalizeTimestamp(
        source.intentionality?.recentInputFocusAt ?? base.intentionality.recentInputFocusAt,
      ),
      recentTypingAt: normalizeTimestamp(
        source.intentionality?.recentTypingAt ?? base.intentionality.recentTypingAt,
      ),
      recentSelectionAt: normalizeTimestamp(
        source.intentionality?.recentSelectionAt ?? base.intentionality.recentSelectionAt,
      ),
    },
    media: {
      activeVideoChangedCount: normalizeCount(
        source.media?.activeVideoChangedCount ?? base.media.activeVideoChangedCount,
      ),
      recentMediaPlayAt: normalizeTimestamp(source.media?.recentMediaPlayAt ?? base.media.recentMediaPlayAt),
      recentMediaPauseAt: normalizeTimestamp(source.media?.recentMediaPauseAt ?? base.media.recentMediaPauseAt),
      sustainedMediaWatchMs: normalizeTimestamp(
        source.media?.sustainedMediaWatchMs ?? base.media.sustainedMediaWatchMs,
      ),
    },
    supply: {
      initialized: source.supply?.initialized === true,
      totalSteps: normalizeCount(source.supply?.totalSteps ?? base.supply.totalSteps),
      demandSteps: normalizeCount(source.supply?.demandSteps ?? base.supply.demandSteps),
      demandRatio: normalizeRatio(source.supply?.demandRatio ?? base.supply.demandRatio),
      loopPressure: normalizeNumber(source.supply?.loopPressure ?? base.supply.loopPressure),
      lastStepAt: normalizeTimestamp(source.supply?.lastStepAt ?? base.supply.lastStepAt),
      msSinceLastStep: normalizeNullableMs(source.supply?.msSinceLastStep ?? base.supply.msSinceLastStep),
      lastDeltaPx: normalizeNumber(source.supply?.lastDeltaPx ?? base.supply.lastDeltaPx),
      lastThresholdPx: normalizeNumber(source.supply?.lastThresholdPx ?? base.supply.lastThresholdPx),
      lastBottomReachRatio: normalizeRatio(
        source.supply?.lastBottomReachRatio ?? base.supply.lastBottomReachRatio,
      ),
      maxDepthRatio: normalizeRatio(source.supply?.maxDepthRatio ?? base.supply.maxDepthRatio),
      skewedSteps: normalizeCount(source.supply?.skewedSteps ?? base.supply.skewedSteps),
      lateConfirmedSteps: normalizeCount(
        source.supply?.lateConfirmedSteps ?? base.supply.lateConfirmedSteps,
      ),
      expiredPendingSteps: normalizeCount(
        source.supply?.expiredPendingSteps ?? base.supply.expiredPendingSteps,
      ),
      pendingStep: source.supply?.pendingStep === true,
      cadenceSettling: source.supply?.cadenceSettling === true,
    },
    control: {
      lastContinueAt: normalizeTimestamp(source.control?.lastContinueAt ?? base.control.lastContinueAt),
      continuePassUntil: normalizeTimestamp(source.control?.continuePassUntil ?? base.control.continuePassUntil),
    },
  };
}

export function mergeFeedFlowLoopSignals(previousSignals = null, patchSignals = null) {
  const previous = normalizeFeedFlowLoopSignals(previousSignals);
  const patchSource = patchSignals && typeof patchSignals === 'object' ? patchSignals : {};

  return {
    context: Object.prototype.hasOwnProperty.call(patchSource, 'context')
      ? normalizeFeedFlowLoopSignals({ context: patchSource.context }).context
      : previous.context,
    progression: Object.prototype.hasOwnProperty.call(patchSource, 'progression')
      ? normalizeFeedFlowLoopSignals({ progression: patchSource.progression }).progression
      : previous.progression,
    novelty: Object.prototype.hasOwnProperty.call(patchSource, 'novelty')
      ? normalizeFeedFlowLoopSignals({ novelty: patchSource.novelty }).novelty
      : previous.novelty,
    rhythm: Object.prototype.hasOwnProperty.call(patchSource, 'rhythm')
      ? normalizeFeedFlowLoopSignals({ rhythm: patchSource.rhythm }).rhythm
      : previous.rhythm,
    directionality: Object.prototype.hasOwnProperty.call(patchSource, 'directionality')
      ? normalizeFeedFlowLoopSignals({ directionality: patchSource.directionality }).directionality
      : previous.directionality,
    intentionality: Object.prototype.hasOwnProperty.call(patchSource, 'intentionality')
      ? normalizeFeedFlowLoopSignals({ intentionality: patchSource.intentionality }).intentionality
      : previous.intentionality,
    media: Object.prototype.hasOwnProperty.call(patchSource, 'media')
      ? normalizeFeedFlowLoopSignals({ media: patchSource.media }).media
      : previous.media,
    supply: Object.prototype.hasOwnProperty.call(patchSource, 'supply')
      ? normalizeFeedFlowLoopSignals({ supply: patchSource.supply }).supply
      : previous.supply,
    control: Object.prototype.hasOwnProperty.call(patchSource, 'control')
      ? normalizeFeedFlowLoopSignals({ control: patchSource.control }).control
      : previous.control,
  };
}
