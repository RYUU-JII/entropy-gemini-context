const MAIN_FIRST_FRAME_METADATA_FIELDS = Object.freeze([
  'source',
  'themeId',
  'milestone',
  'failureScope',
  'bootImpact',
  'part',
  'reason',
  'mainWidgetThemeId',
  'degraded',
  'pondRuntimeReady',
  'bonsaiRuntimeReady',
  'scannerRuntimeReady',
  'firstViewportReady',
  'bootVisualHoldActive',
  'bootVisualCaptureActive',
  'pondCaptured',
  'bonsaiCaptured',
  'rhythmCaptured',
  'pondVisualFrameSource',
  'bonsaiVisualFrameSource',
  'rhythmVisualFrameSource',
  'releaseBlockedBySignatureMismatch',
  'pondRuntimeMountReady',
  'pondRosterAuthorityState',
  'pondRosterAuthoritySource',
  'bonsaiEvidenceReady',
  'bonsaiLifecycleInputSource',
  'rhythmFrameReady',
  'scannerDomainCandidateCount',
  'signalScannerTargetCount',
]);

const MAIN_FIRST_FRAME_RUNTIME_FIELDS = Object.freeze([
  'source',
  'renderer',
  'reason',
  'mountId',
  'firstFrameAcked',
  'ackElapsedMs',
  'runtimeLoopMounted',
  'runtimeLoopFrameCount',
  'requiredRuntimeLoopFrameCount',
  'surfaceEffectsRequested',
  'surfaceEffectsEnabled',
  'surfaceEffectsDeferredForFirstFrame',
  'waterLayerProbeReady',
  'essentialWaterAtmosphereReady',
  'waterEffectsReason',
  'fishCount',
  'visibleFishCount',
  'requiredFirstFrameFishCount',
  'requiredVisibleFishCount',
  'expectedFirstFrameFishCount',
  'workerRequiredFirstFrameFishCount',
  'firstFrameAckDeferredCount',
  'initOrderOk',
  'width',
  'height',
  'pixelWidth',
  'pixelHeight',
  'pixelRatio',
  'treeSeed',
  'isAnimated',
  'renderBackend',
  'cacheInvalidated',
  'frameCount',
  'renderLoopMode',
  'branchRigReady',
  'branchRigDeferred',
  'branchRigRebuilt',
  'branchRigRecords',
  'staticLayersRebaked',
]);

const isRecord = (value) => Boolean(
  value && typeof value === 'object' && !Array.isArray(value),
);

const roundDiagnosticMs = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Number(parsed.toFixed(1)));
};

const copyScalarFields = (source, keys) => {
  if (!isRecord(source)) return {};
  return keys.reduce((output, key) => {
    const value = source[key];
    if (
      typeof value === 'string'
      || typeof value === 'number'
      || typeof value === 'boolean'
      || value === null
    ) {
      output[key] = value;
    }
    return output;
  }, {});
};

const compactTimingMap = (value) => {
  if (!isRecord(value)) return null;
  return Object.entries(value).reduce((output, [key, entry]) => {
    if (typeof entry === 'number') {
      output[key] = roundDiagnosticMs(entry);
    } else if (typeof entry === 'boolean' || typeof entry === 'string' || entry === null) {
      output[key] = entry;
    }
    return output;
  }, {});
};

const compactFrameMetrics = (value) => {
  if (!isRecord(value)) return null;
  const output = copyScalarFields(value, [
    'updateMs',
    'renderMs',
    'worldRenderMs',
    'stageRenderMs',
    'frameMs',
  ]);
  if (isRecord(value.stageMs)) {
    output.stageMs = compactTimingMap(value.stageMs);
  }
  if (isRecord(value.koiRender)) {
    output.koiRender = copyScalarFields(value.koiRender, [
      'fishCount',
      'visibleFishCount',
      'createdFishCount',
      'materialSignatureUpdates',
      'materialWrites',
      'materialSkipCount',
      'shadowEnabledCount',
    ]);
  }
  return output;
};

export const compactDashboardMainFirstFrameRuntimeDetails = (value) => {
  if (!isRecord(value)) return value ?? null;
  const output = copyScalarFields(value, MAIN_FIRST_FRAME_RUNTIME_FIELDS);
  [
    'fromInitMs',
    'deltasMs',
    'waitGapsMs',
    'workSpansMs',
    'budgetMs',
    'workerTiming',
    'clientTiming',
  ].forEach((key) => {
    const compactValue = compactTimingMap(value[key]);
    if (compactValue) output[key] = compactValue;
  });
  const frameMetrics = compactFrameMetrics(value.frameMetrics);
  if (frameMetrics) output.frameMetrics = frameMetrics;
  if (isRecord(value.branchRigDiagnostics)) {
    output.branchRigDiagnostics = {
      ...copyScalarFields(value.branchRigDiagnostics, [
        'records',
        'liveRecords',
        'groupedSubtrees',
        'canvasMegapixels',
      ]),
      timings: compactTimingMap(value.branchRigDiagnostics.timings),
    };
  }
  return output;
};

export const compactDashboardMainFirstFrameMetadata = (metadata = null, depth = 0) => {
  if (!isRecord(metadata)) return metadata ?? null;
  const output = copyScalarFields(metadata, MAIN_FIRST_FRAME_METADATA_FIELDS);
  [
    'pondRuntimeDetails',
    'bonsaiRuntimeDetails',
    'scannerRuntimeDetails',
  ].forEach((key) => {
    if (isRecord(metadata[key])) {
      output[key] = compactDashboardMainFirstFrameRuntimeDetails(metadata[key]);
    }
  });
  if (isRecord(metadata.firstViewportDetails)) {
    output.firstViewportDetails = compactDashboardMainFirstFrameMetadata(
      metadata.firstViewportDetails,
      depth + 1,
    );
  }
  if (isRecord(metadata.releaseFrameMatch)) {
    output.releaseFrameMatch = copyScalarFields(metadata.releaseFrameMatch, [
      'pond',
      'bonsai',
      'rhythm',
    ]);
  }
  if (isRecord(metadata.renderer)) {
    output.renderer = copyScalarFields(metadata.renderer, [
      'status',
      'reason',
      'causeCode',
      'error',
      'message',
      'degraded',
    ]);
  }
  if (depth < 2 && isRecord(metadata.metadata)) {
    output.metadata = compactDashboardMainFirstFrameMetadata(metadata.metadata, depth + 1);
  }
  return output;
};
