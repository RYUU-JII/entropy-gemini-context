import { readZenPondShadowLightingMetrics } from './zenPondShadowLightingMetrics.js';

import {
  readZenWaterSurfaceFieldRainModelId,
} from './zenWaterSurfaceFieldRainModel.js';

import {
  readZenWaterSurfaceFieldYoonseulModelId,
} from './zenWaterSurfaceFieldYoonseulModel.js';

import {
  readZenPondBenthicMaterialOwnerId,
} from './zenPondBenthicMaterial.js';

import {
  readZenPondCanopyModelId,
} from './zenPondCanopyMaterial.js';

import {
  readZenPondCausticReceiverModelId,
  readZenPondCausticPresentationModelId,
  ZEN_POND_CAUSTIC_PRESENTATION_MODEL_IDS,
} from './zenPondCausticPresentation.js';

import { ZEN_SURFACE_DISTURBANCE_SOURCES } from '../runtime/surface/zenSurfaceDisturbance.js';

// One DTO projection for renderer observations on both sides of the Worker boundary.
// Sampling, first-frame readiness, journals and transport remain with their owners.

const isObject = (value) => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const normalizeSurfaceDisturbanceSourceCounts = (
  value,
) => {
  if (!isObject(value)) return null;
  const normalized = {};
  Object.values(ZEN_SURFACE_DISTURBANCE_SOURCES).forEach(
    (source) => {
      normalized[source] = toNonNegativeInt(
        value[source],
      );
    },
  );
  return normalized;
};

const round = (value, digits = 2, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Number(numeric.toFixed(digits));
};

const toNonNegativeInt = (value, fallback = 0) => {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
};

const normalizeStageMetrics = (value = null) => {
  if (!isObject(value)) return null;
  return {
    beginFrameMs: round(Number(value.beginFrameMs), 4, 0),
    readabilityMs: round(Number(value.readabilityMs), 4, 0),
    waterPassMs: round(Number(value.waterPassMs), 4, 0),
    cloudReflectionBakeMs: round(Number(value.cloudReflectionBakeMs), 4, 0),
    staticBaseBakeMs: round(Number(value.staticBaseBakeMs), 4, 0),
    entitySyncMs: round(Number(value.entitySyncMs), 4, 0),
    texturePruneFrame: value.texturePruneFrame === true,
  };
};

const normalizeNullableMs = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? round(numeric, 4, 0) : null;
};

const normalizeGpuTiming = (value = null) => {
  if (!isObject(value)) return null;
  return {
    enabled: value.enabled === true,
    supported: value.supported === true,
    api: typeof value.api === 'string' ? value.api : null,
    reason: typeof value.reason === 'string' ? value.reason : '',
    pendingQueryCount: Math.max(0, Math.floor(Number(value.pendingQueryCount) || 0)),
    sampleCount: Math.max(0, Math.floor(Number(value.sampleCount) || 0)),
    disjointCount: Math.max(0, Math.floor(Number(value.disjointCount) || 0)),
    droppedFrameCount: Math.max(0, Math.floor(Number(value.droppedFrameCount) || 0)),
    failedQueryCount: Math.max(0, Math.floor(Number(value.failedQueryCount) || 0)),
    lastGpuMs: normalizeNullableMs(value.lastGpuMs),
    avgGpuMs: normalizeNullableMs(value.avgGpuMs),
    minGpuMs: normalizeNullableMs(value.minGpuMs),
    maxGpuMs: normalizeNullableMs(value.maxGpuMs),
  };
};

const normalizeKoiRenderMetrics = (value = null) => {
  if (!isObject(value)) return null;
  return {
    fishCount: Math.max(0, Math.floor(Number(value.fishCount) || 0)),
    firstSiteRevealCount: value.firstSiteRevealCount,
    firstSiteMaterialPresence: value.firstSiteMaterialPresence,
    invitationEnteringCount: value.invitationEnteringCount,
    shadowSentinelCount: value.shadowSentinelCount,
    focusHoveredCount: value.focusHoveredCount,
    focusSelectedCount: value.focusSelectedCount,
    focusGlowVisibleCount: value.focusGlowVisibleCount,
    visibleFishCount: Math.max(0, Math.floor(Number(value.visibleFishCount) || 0)),
    createdFishCount: Math.max(0, Math.floor(Number(value.createdFishCount) || 0)),
    materialSignatureUpdates: Math.max(0, Math.floor(Number(value.materialSignatureUpdates) || 0)),
    materialWrites: Math.max(0, Math.floor(Number(value.materialWrites) || 0)),
    materialSkipCount: Math.max(0, Math.floor(Number(value.materialSkipCount) || 0)),
    fishShadowRequested: value.fishShadowRequested === true,
    shadowRequestedCount: Math.max(
      0,
      Math.floor(Number(value.shadowRequestedCount) || 0),
    ),
    shadowEnabledCount: Math.max(0, Math.floor(Number(value.shadowEnabledCount) || 0)),
    shadowTextureAllocatedCount: Math.max(
      0,
      Math.floor(
        Number(value.shadowTextureAllocatedCount) || 0,
      ),
    ),
    shadowGeometryUpdateCount: Math.max(
      0,
      Math.floor(
        Number(value.shadowGeometryUpdateCount) || 0,
      ),
    ),
    shadowPointWriteCount: Math.max(
      0,
      Math.floor(Number(value.shadowPointWriteCount) || 0),
    ),
    shadowCacheEntryCount: Math.max(
      0,
      Math.floor(Number(value.shadowCacheEntryCount) || 0),
    ),
    shadowCacheReferencedEntryCount: Math.max(
      0,
      Math.floor(
        Number(value.shadowCacheReferencedEntryCount) || 0,
      ),
    ),
    shadowCacheReferenceCount: Math.max(
      0,
      Math.floor(
        Number(value.shadowCacheReferenceCount) || 0,
      ),
    ),
    shadowAlphaWrites: Math.max(0, Math.floor(Number(value.shadowAlphaWrites) || 0)),
    shadowAlphaAvg: round(Number(value.shadowAlphaAvg), 5, 0),
    shadowAlphaMin: round(Number(value.shadowAlphaMin), 5, 0),
    shadowAlphaMax: round(Number(value.shadowAlphaMax), 5, 0),
    shadowLighting: readZenPondShadowLightingMetrics(value.shadowLighting),
  };
};

export const normalizeZenPondWaterEffectsMetrics = (value) => {
  if (!isObject(value)) return null;
  return {
    visible: value.visible === true,
    topShadowVisible: value.topShadowVisible === true,
    cloudsVisible: value.cloudsVisible === true,
    cloudsOnscreenVisible: value.cloudsOnscreenVisible === true,
    textureBakeSupported: value.textureBakeSupported === true,
    reason: typeof value.reason === 'string' ? value.reason : '',
    godRaysGate: round(Number(value.godRaysGate), 4, 0),
    stagedRayGate: round(Number(value.stagedRayGate), 4, 0),
    daylightCurve: round(Number(value.daylightCurve), 4, 0),
    sunOp: round(Number(value.sunOp), 4, 0),
    sunlightIntensity: round(Number(value.sunlightIntensity), 4, 0),
    godRayGain: round(Number(value.godRayGain), 4, 1),
    godRayDensity: round(Number(value.godRayDensity), 4, 1),
    godRayPulse: round(Number(value.godRayPulse), 4, 1),
    weatherGate: round(Number(value.weatherGate), 4, 0),
    topShadowGate: round(Number(value.topShadowGate), 4, 0),
    topShadowGainCurve: round(Number(value.topShadowGainCurve), 4, 1),
    topShadowDensityCurve: round(Number(value.topShadowDensityCurve), 4, 1),
    topShadowShadowGain: round(Number(value.topShadowShadowGain), 4, 1),
    baseOpTarget: round(Number(value.baseOpTarget), 5, 0),
    primaryAlpha: round(Number(value.primaryAlpha), 5, 0),
    shadowAlpha: round(Number(value.shadowAlpha), 5, 0),
    combinedAlpha: round(Number(value.combinedAlpha), 5, 0),
    cloudReflectionToggleGate: round(Number(value.cloudReflectionToggleGate), 4, 0),
    cloudReflectionComputeEnabled: value.cloudReflectionComputeEnabled === true,
    cloudReflectionEnabled: value.cloudReflectionEnabled === true,
    cloudReflectionSourceOwner: typeof value.cloudReflectionSourceOwner === 'string'
      ? value.cloudReflectionSourceOwner : null,
    cloudFieldSeed: toNonNegativeInt(value.cloudFieldSeed),
    cloudFieldTextureCount: toNonNegativeInt(value.cloudFieldTextureCount),
    cloudFieldTextureBytes: toNonNegativeInt(value.cloudFieldTextureBytes),
    cloudReflectionAdditionalPasses: toNonNegativeInt(value.cloudReflectionAdditionalPasses),
    sunTransmission: round(Number(value.sunTransmission), 6, 0),
    directSunlight: round(Number(value.directSunlight), 6, 0),
    diffuseSkylight: round(Number(value.diffuseSkylight), 6, 0),
    sceneBrightness: round(Number(value.sceneBrightness), 6, 0),
    cloudReflectionGate: round(Number(value.cloudReflectionGate), 5, 0),
    cloudShapeSignal: round(Number(value.cloudShapeSignal), 5, 0),
    skyReflectionSignal: round(Number(value.skyReflectionSignal), 5, 0),
    cloudReflectionBase: round(Number(value.cloudReflectionBase), 5, 0),
    cloudPrimaryAlphaBase: round(Number(value.cloudPrimaryAlphaBase), 5, 0),
    cloudDetailAlphaBase: round(Number(value.cloudDetailAlphaBase), 5, 0),
    activeCloudRatio: round(Number(value.activeCloudRatio), 5, 0),
    activePrimaryCount: Math.max(0, Math.floor(Number(value.activePrimaryCount) || 0)),
    activeDetailCount: Math.max(0, Math.floor(Number(value.activeDetailCount) || 0)),
    cloudVisibleCount: Math.max(0, Math.floor(Number(value.cloudVisibleCount) || 0)),
    cloudOnscreenCount: Math.max(0, Math.floor(Number(value.cloudOnscreenCount) || 0)),
    cloudScalePrimary: round(Number(value.cloudScalePrimary), 4, 0),
    cloudScaleDetail: round(Number(value.cloudScaleDetail), 4, 0),
    cloudDriftGain: round(Number(value.cloudDriftGain), 5, 0),
    surfaceOpticsGate: round(Number(value.surfaceOpticsGate), 4, 0),
    benthicGate: round(Number(value.benthicGate), 4, 0),
    causticGate: round(Number(value.causticGate), 4, 0),
    highlightsGate: round(Number(value.highlightsGate), 4, 0),
    atmosphereGate: round(Number(value.atmosphereGate), 4, 0),
    komorebiModelId: readZenPondCanopyModelId(
      value.komorebiModelId,
      {
        required: (
          value.komorebiRequested === true
          || value.komorebiTextureAllocated === true
        ),
      },
    ),
    komorebiRequested: value.komorebiRequested === true,
    komorebiActive: value.komorebiActive === true,
    komorebiAlpha: round(Number(value.komorebiAlpha), 6, 0),
    komorebiMaximumAlpha: round(
      Number(value.komorebiMaximumAlpha),
      6,
      0,
    ),
    komorebiTextureAllocated:
      value.komorebiTextureAllocated === true,
    komorebiTextureSize: toNonNegativeInt(
      value.komorebiTextureSize,
    ),
    komorebiTextureCount: toNonNegativeInt(value.komorebiTextureCount),
    komorebiRawTextureBytes: toNonNegativeInt(
      value.komorebiRawTextureBytes,
    ),
    komorebiTextureBuildMs: normalizeNullableMs(
      value.komorebiTextureBuildMs,
    ),
    komorebiMaskCoverageRatio: round(
      Number(value.komorebiMaskCoverageRatio),
      6,
      0,
    ),
    komorebiMaskPatchCount: toNonNegativeInt(
      value.komorebiMaskPatchCount,
    ),
    komorebiDrawCount: toNonNegativeInt(
      value.komorebiDrawCount,
    ),
    komorebiTextureBakeSupported:
      value.komorebiTextureBakeSupported === true,
    komorebiReason:
      typeof value.komorebiReason === 'string'
      && value.komorebiReason.trim()
        ? value.komorebiReason.trim()
        : null,
    komorebiDaylightGate: round(
      Number(value.komorebiDaylightGate),
      6,
      0,
    ),
    komorebiDirectLightGate: round(
      Number(value.komorebiDirectLightGate),
      6,
      0,
    ),
    komorebiWeatherGate: round(
      Number(value.komorebiWeatherGate),
      6,
      0,
    ),
    canopyTransferModelId: typeof value.canopyTransferModelId === 'string'
      ? value.canopyTransferModelId : null,
    canopyDrawCount: toNonNegativeInt(value.canopyDrawCount),
    canopyDirectContrast: round(Number(value.canopyDirectContrast), 6, 0),
    canopyDiffuseContrast: round(Number(value.canopyDiffuseContrast), 6, 0),
    canopyShadeCoverageRatio: round(Number(value.canopyShadeCoverageRatio), 6, 0),
    canopyFoliageLobeCount: toNonNegativeInt(value.canopyFoliageLobeCount),
    canopyOpenTransfer: Array.isArray(value.canopyOpenTransfer)
      ? value.canopyOpenTransfer.map((channel) => round(channel, 6)) : null,
    canopyGapTransfer: Array.isArray(value.canopyGapTransfer)
      ? value.canopyGapTransfer.map((channel) => round(channel, 6)) : null,
    canopyShadeTransfer: Array.isArray(value.canopyShadeTransfer)
      ? value.canopyShadeTransfer.map((channel) => round(channel, 6)) : null,
    atmosphereAlpha: round(Number(value.atmosphereAlpha), 5, 0),
    refractedGuideAlpha: round(Number(value.refractedGuideAlpha), 5, 0),
    causticPrimaryAlpha: round(Number(value.causticPrimaryAlpha), 5, 0),
    causticSecondaryAlpha: round(Number(value.causticSecondaryAlpha), 5, 0),
    highlightPrimaryAlpha: round(Number(value.highlightPrimaryAlpha), 5, 0),
    highlightMicroAlpha: round(Number(value.highlightMicroAlpha), 5, 0),
    bottomVisibility: round(Number(value.bottomVisibility), 5, 0),
    pebbleAlpha: round(Number(value.pebbleAlpha), 5, 0),
    pebbleDetailAlpha: round(Number(value.pebbleDetailAlpha), 5, 0),
    benthicOwnerId: readZenPondBenthicMaterialOwnerId(
      value.benthicOwnerId,
      {
        required: (
          toNonNegativeInt(value.benthicSourceSpriteCount) > 0
          || Number(value.benthicGate) > 0
        ),
      },
    ),
    benthicSourceSpriteCount: toNonNegativeInt(
      value.benthicSourceSpriteCount,
    ),
    benthicVisibleSpriteCount: toNonNegativeInt(
      value.benthicVisibleSpriteCount,
    ),
    benthicPrimaryAlphaScale: round(
      Number(value.benthicPrimaryAlphaScale),
      4,
      0,
    ),
    benthicDetailAlphaScale: round(
      Number(value.benthicDetailAlphaScale),
      4,
      0,
    ),
    backgroundFxTickMs: round(Number(value.backgroundFxTickMs), 4, 0),
    waterEffectsTickMs: round(Number(value.waterEffectsTickMs), 4, 0),
    waterSurfaceFilterTickMs: round(Number(value.waterSurfaceFilterTickMs), 4, 0),
    surfacePipelineMode: typeof value.surfacePipelineMode === 'string' ? value.surfacePipelineMode : '',
    effectRevealProgress: round(Number(value.effectRevealProgress), 4, 0),
    waterReflectionAlgorithmMode: round(Number(value.waterReflectionAlgorithmMode), 4, 0),
    waterReflectionStability: round(Number(value.waterReflectionStability), 4, 0),
    waterReflectionSpatialStability: round(Number(value.waterReflectionSpatialStability), 4, 0),
    waterReflectionDetailStability: round(Number(value.waterReflectionDetailStability), 4, 0),
    waterReflectionTemporalStability: round(Number(value.waterReflectionTemporalStability), 4, 0),
    waterReflectionSoftKnee: round(Number(value.waterReflectionSoftKnee), 4, 0),
    yoonseulTime: round(Number(value.yoonseulTime), 4, 0),
    yoonseulTimeDelta: round(Number(value.yoonseulTimeDelta), 4, 0),
    yoonseulWaterTime: round(Number(value.yoonseulWaterTime), 4, 0),
    yoonseulIntensity: round(Number(value.yoonseulIntensity), 4, 0),
    yoonseulOpacity: round(Number(value.yoonseulOpacity), 4, 0),
    yoonseulDrive: round(Number(value.yoonseulDrive), 4, 0),
    surfaceFieldRainVisibilityDrive: round(
      Number(value.surfaceFieldRainVisibilityDrive),
      4,
      0,
    ),
    yoonseulFocus: round(Number(value.yoonseulFocus), 4, 0),
    surfaceMaterialRoughness: round(Number(value.surfaceMaterialRoughness), 4, 0),
    surfacePhaseRate: round(Number(value.surfacePhaseRate), 4, 0),
    yoonseulPatchScale: round(Number(value.yoonseulPatchScale), 4, 0),
    yoonseulMotion: round(Number(value.yoonseulMotion), 4, 0),
    yoonseulFlickerAmount: round(Number(value.yoonseulFlickerAmount), 4, 0),
    yoonseulTemporalCoherence: round(Number(value.yoonseulTemporalCoherence), 4, 0),
    yoonseulLowBand: round(Number(value.yoonseulLowBand), 4, 0),
    yoonseulMicroBand: round(Number(value.yoonseulMicroBand), 4, 0),
    yoonseulGlintStability: round(Number(value.yoonseulGlintStability), 4, 0),
    yoonseulBeatDamping: round(Number(value.yoonseulBeatDamping), 4, 0),
    yoonseulEnabled: value.yoonseulEnabled === true,
    surfaceFieldYoonseulModelId: readZenWaterSurfaceFieldYoonseulModelId(
      value.surfaceFieldYoonseulModelId,
      {
        required: (
          value.yoonseulEnabled === true
          && (
            value.surfaceFieldActive === true
            || value.surfaceFieldReady === true
          )
        ),
      },
    ),
    yoonseulTopViewBlendMin: round(Number(value.yoonseulTopViewBlendMin), 4, 0),
    yoonseulTopViewBlendMax: round(Number(value.yoonseulTopViewBlendMax), 4, 0),
    yoonseulCoverageRoughnessMin: round(
      Number(value.yoonseulCoverageRoughnessMin),
      4,
      0,
    ),
    yoonseulCoverageRoughnessMax: round(
      Number(value.yoonseulCoverageRoughnessMax),
      4,
      0,
    ),
    yoonseulCoverageWeightUnfocused: round(
      Number(value.yoonseulCoverageWeightUnfocused),
      4,
      0,
    ),
    yoonseulCoverageWeightFocused: round(
      Number(value.yoonseulCoverageWeightFocused),
      4,
      0,
    ),
    surfaceOpticsEnabled: value.surfaceOpticsEnabled === true,
    surfaceNormalEnabled: value.surfaceNormalEnabled === true,
    screenRefractionEnabled: value.screenRefractionEnabled === true,
    surfaceReflectionEnabled: value.surfaceReflectionEnabled === true,
    rgbSplitEnabled: value.rgbSplitEnabled === true,
    surfaceFieldActive: value.surfaceFieldActive === true,
    surfaceFieldReady: value.surfaceFieldReady === true,
    surfaceFieldRainModelId: readZenWaterSurfaceFieldRainModelId(
      value.surfaceFieldRainModelId,
      {
        required: (
          value.surfaceFieldActive === true
          || value.surfaceFieldReady === true
        ),
      },
    ),
    surfaceFieldCausticModelId:
      readZenPondCausticPresentationModelId(
        value.surfaceFieldCausticModelId,
        {
          required:
            value.surfaceFieldCausticsRequested === true,
        },
      ),
    surfaceFieldCausticsRequested:
      value.surfaceFieldCausticsRequested === true,
    surfaceFieldCausticsEnabled:
      value.surfaceFieldCausticsEnabled === true,
    surfaceFieldCausticsSuppressed:
      value.surfaceFieldCausticsSuppressed === true,
    surfaceFieldCausticRequestedStrength: round(
      Number(value.surfaceFieldCausticRequestedStrength),
      4,
      0,
    ),
    surfaceFieldCausticStrength: round(Number(value.surfaceFieldCausticStrength), 4, 0),
    surfaceFieldCausticDrawCount: toNonNegativeInt(
      value.surfaceFieldCausticDrawCount,
    ),
    surfaceFieldCausticFieldTextureFetchesPerPixel:
      toNonNegativeInt(
        value.surfaceFieldCausticFieldTextureFetchesPerPixel,
      ),
    surfaceFieldCausticReceiverModelId:
      readZenPondCausticReceiverModelId(
        value.surfaceFieldCausticReceiverModelId,
        {
          required: (
            value.surfaceFieldCausticModelId
              === ZEN_POND_CAUSTIC_PRESENTATION_MODEL_IDS
                .CONNECTED_SUNWEB
            && value.surfaceFieldCausticsRequested === true
          ),
        },
      ),
    surfaceFieldCausticReceiverTextureFetchesPerPixel:
      toNonNegativeInt(
        value
          .surfaceFieldCausticReceiverTextureFetchesPerPixel,
      ),
    surfaceFieldCausticTotalTextureFetchesPerPixel:
      toNonNegativeInt(
        value.surfaceFieldCausticTotalTextureFetchesPerPixel,
      ),
    surfaceFieldCausticGateOff: round(
      Number(value.surfaceFieldCausticGateOff),
      4,
      0,
    ),
    surfaceFieldCausticGateOn: round(
      Number(value.surfaceFieldCausticGateOn),
      4,
      0,
    ),
    surfaceFieldCausticGateTransitionCount:
      toNonNegativeInt(
        value.surfaceFieldCausticGateTransitionCount,
      ),
    surfaceFieldWidth: toNonNegativeInt(value.surfaceFieldWidth),
    surfaceFieldHeight: toNonNegativeInt(value.surfaceFieldHeight),
    surfaceFieldCadenceTier: typeof value.surfaceFieldCadenceTier === 'string'
      ? value.surfaceFieldCadenceTier
      : '',
    surfaceFieldDisturbanceCount: toNonNegativeInt(value.surfaceFieldDisturbanceCount),
    surfaceFieldDisturbanceCandidateCount: toNonNegativeInt(value.surfaceFieldDisturbanceCandidateCount),
    surfaceFieldDisturbanceDroppedCount: toNonNegativeInt(value.surfaceFieldDisturbanceDroppedCount),
    koiWakeDisturbanceRequested:
      value.koiWakeDisturbanceRequested === true,
    tapDisturbanceRequested:
      value.tapDisturbanceRequested === true,
    petalDisturbanceRequested:
      value.petalDisturbanceRequested === true,
    surfaceFieldDisturbanceSourceCounts:
      isObject(value.surfaceFieldDisturbanceSourceCounts)
        ? {
          candidate:
            normalizeSurfaceDisturbanceSourceCounts(
              value.surfaceFieldDisturbanceSourceCounts
                .candidate,
            ),
          selected:
            normalizeSurfaceDisturbanceSourceCounts(
              value.surfaceFieldDisturbanceSourceCounts
                .selected,
            ),
          dropped:
            normalizeSurfaceDisturbanceSourceCounts(
              value.surfaceFieldDisturbanceSourceCounts
                .dropped,
            ),
        }
        : null,
    surfaceFieldRainIntensity: round(Number(value.surfaceFieldRainIntensity), 4, 0),
    surfaceFieldRainRippleTargetBudget: toNonNegativeInt(value.surfaceFieldRainRippleTargetBudget),
    surfaceFieldRainRippleCellCount: toNonNegativeInt(value.surfaceFieldRainRippleCellCount),
    surfaceFieldRainCandidateEvaluationsPerPixel: toNonNegativeInt(
      value.surfaceFieldRainCandidateEvaluationsPerPixel,
    ),
    weatherRegime: typeof value.weatherRegime === 'string' ? value.weatherRegime : '',
    weatherEventScheduled: value.weatherEventScheduled === true,
    weatherEventActive: value.weatherEventActive === true,
    weatherEventId: typeof value.weatherEventId === 'string' ? value.weatherEventId : '',
    weatherEventKind: typeof value.weatherEventKind === 'string' ? value.weatherEventKind : '',
    weatherEventPhase: typeof value.weatherEventPhase === 'string' ? value.weatherEventPhase : '',
    weatherEventProgress: round(Number(value.weatherEventProgress), 4, 0),
    weatherEventPhaseProgress: round(Number(value.weatherEventPhaseProgress), 4, 0),
    weatherFrontWeight: round(Number(value.weatherFrontWeight), 4, 0),
    postRainWeight: round(Number(value.postRainWeight), 4, 0),
    guaranteedRainDay: value.guaranteedRainDay === true,
    surfaceFieldSubmitMs: round(Number(value.surfaceFieldSubmitMs), 4, 0),
    surfaceEffectsEnabled: value.surfaceEffectsEnabled === true,
    surfaceEffectsRequested: value.surfaceEffectsRequested === true,
    surfaceEffectsDeferredForFirstFrame: value.surfaceEffectsDeferredForFirstFrame === true,
    waterLayerRequested: value.waterLayerRequested === true,
    waterLayerApplyReady: value.waterLayerApplyReady === true,
    waterLayerApplyStatus: typeof value.waterLayerApplyStatus === 'string'
      ? value.waterLayerApplyStatus
      : '',
    waterLayerRequestedSignature:
      typeof value.waterLayerRequestedSignature === 'string'
        ? value.waterLayerRequestedSignature
        : '',
    waterLayerActiveSignature:
      typeof value.waterLayerActiveSignature === 'string'
        ? value.waterLayerActiveSignature
        : '',
    waterLayerApplyGeneration: toNonNegativeInt(
      value.waterLayerApplyGeneration,
    ),
    waterLayerApplyError: typeof value.waterLayerApplyError === 'string'
      ? value.waterLayerApplyError
      : '',
    waterLayerRetainedActive: value.waterLayerRetainedActive === true,
    surfaceUniformFullUpdate: value.surfaceUniformFullUpdate === true,
    waterBenthicContainerAlpha: round(Number(value.waterBenthicContainerAlpha), 5, 0),
    frameBottomVisibility: round(Number(value.frameBottomVisibility), 5, 0),
    frameSceneBrightness: round(Number(value.frameSceneBrightness), 5, 0),
    frameDaylight: round(Number(value.frameDaylight), 5, 0),
  };
};

export const normalizeZenPondFrameMetrics = (value = null) => {
  if (!isObject(value)) return null;
  return {
    updateMs: round(Number(value.updateMs), 4, 0),
    renderMs: round(Number(value.renderMs), 4, 0),
    worldRenderMs: round(Number(value.worldRenderMs), 4, 0),
    stageRenderMs: round(Number(value.stageRenderMs), 4, 0),
    frameMs: round(Number(value.frameMs), 4, 0),
    gpuTiming: normalizeGpuTiming(value.gpuTiming),
    stageMs: normalizeStageMetrics(value.stageMs),
    koiRender: normalizeKoiRenderMetrics(value.koiRender),
    waterEffects: normalizeZenPondWaterEffectsMetrics(value.waterEffects),
  };
};
