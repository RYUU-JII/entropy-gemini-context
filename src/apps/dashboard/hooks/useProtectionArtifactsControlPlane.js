import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getArtifactRecommendation } from '@/domains/protection/catalog/artifactRecommendationCatalog.js';
import { selectCanonicalProtectionArtifactRuntimeState, selectCanonicalProtectionArtifactChildRuntimeStates } from '@/domains/protection/runtime/canonicalArtifactTelemetry.js';
import { useProtectionArtifactCapabilityState } from './useProtectionArtifactCapabilityState.js';
import { useProtectionRuntimeSubscription } from './useProtectionRuntimeSubscription.js';
import { decorateArtifactFamilyWithControlState } from './useProtectionArtifactControlState.js';
import { useArtifactFamilyProtocolSlice } from './artifactSettings/useArtifactFamilyProtocolSlice.js';
import { createArtifactProjectionSelector } from './artifactSettings/artifactProjectionIdentity.js';

const NO_MEMORY_FAMILIES = Object.freeze({});

export function createArtifactRuntimeSelector(artifactId) {
  return createArtifactProjectionSelector((snapshot) => {
    // Observation clocks/revisions must not invalidate an unchanged family.
    const { capturedAt, revision, ...summary } = selectCanonicalProtectionArtifactRuntimeState(snapshot, artifactId);
    return { summary, children: selectCanonicalProtectionArtifactChildRuntimeStates(snapshot, artifactId) };
  });
}

export function useProtectionArtifactsControlPlane(familyController, isActive = true) {
  const { artifactId, artifactFamily, artifactFamilyHandlers } = familyController;
  const selectControl = useMemo(() => (state) => ({
    globallyPaused: state.artifactControlState.globalPaused,
    suspended: state.artifactControlState.familySuspensions[artifactId],
    setFamilySuspended: state.setArtifactFamilySuspended,
    permissionMode: state.permissionMode,
    blockedUrls: state.blockedUrls,
    allowedUrls: state.allowedUrls,
  }), [artifactId]);
  const { globallyPaused, suspended, setFamilySuspended, permissionMode, blockedUrls, allowedUrls } =
    useArtifactFamilyProtocolSlice(selectControl, isActive);
  const selectSnapshot = useMemo(() => createArtifactRuntimeSelector(artifactId), [artifactId]);
  const { snapshot: artifactRuntimeProjection, error: artifactRuntimeSnapshotError, refreshSnapshot } =
    useProtectionRuntimeSubscription({ enabled: isActive, selectSnapshot });
  const decoratedFamily = useMemo(() => decorateArtifactFamilyWithControlState(artifactFamily, {
    suspended, globallyPaused,
  }), [artifactFamily, suspended, globallyPaused]);
  const artifactFamilies = useMemo(() => ({ [artifactId]: decoratedFamily }), [artifactId, decoratedFamily]);
  const { artifactCapabilityState: capabilitySnapshot, refreshArtifactCapabilityState } = useProtectionArtifactCapabilityState({
    isActive, permissionMode, blockedUrls, allowedUrls,
    artifactFamilies: artifactId === 'echo' ? artifactFamilies : NO_MEMORY_FAMILIES,
  });
  const selectCapability = useMemo(() => createArtifactProjectionSelector((snapshot) => ({
    artifacts: { [artifactId]: snapshot.artifacts[artifactId] },
  })), [artifactId]);
  const artifactCapabilityState = selectCapability(capabilitySnapshot);
  const setSuspended = useCallback(async (next) => {
    const result = await setFamilySuspended(artifactId, next);
    if (result?.error) throw result.error;
    return result;
  }, [artifactId, setFamilySuspended]);
  const applyRecommendation = useCallback(async (recommendationId = 'gentle_start_v1') => {
    const recommendation = getArtifactRecommendation(artifactId, recommendationId);
    if (!recommendation || typeof artifactFamilyHandlers.commitConfig !== 'function') {
      throw new Error(`ARTIFACT_RECOMMENDATION_CONFIG_OWNER_REQUIRED:${artifactId}`);
    }
    const result = await artifactFamilyHandlers.commitConfig(recommendation.config);
    if (result === false || result?.ok === false) {
      throw new Error(`ARTIFACT_RECOMMENDATION_NOT_APPLIED:${artifactId}`);
    }
    await setSuspended(false);
    return { familyId: artifactId, recommendationId, result };
  }, [artifactId, artifactFamilyHandlers, setSuspended]);
  const handlers = useMemo(() => ({
    ...artifactFamilyHandlers, setSuspended, applyRecommendation,
  }), [artifactFamilyHandlers, setSuspended, applyRecommendation]);
  const lastFamilyRef = useRef(decoratedFamily);
  useEffect(() => {
    const changed = lastFamilyRef.current !== decoratedFamily;
    lastFamilyRef.current = decoratedFamily;
    if (isActive && changed) void refreshSnapshot().catch(() => undefined);
  }, [decoratedFamily, isActive, refreshSnapshot]);
  const artifactState = useMemo(() => ({
    artifactFamilies,
    artifactCapabilityState,
    artifactWorkflowReviews: { [artifactId]: familyController.workflowReview },
    echoWorkflowState: familyController.workflowState,
    artifactRuntimeSnapshotError,
  }), [artifactFamilies, artifactCapabilityState, artifactId, familyController.workflowReview,
    familyController.workflowState, artifactRuntimeSnapshotError]);
  const artifactHandlers = useMemo(() => ({
    artifactFamilies: { [artifactId]: handlers },
    artifactWorkflowReviews: { [artifactId]: familyController.workflowReviewHandlers },
    refreshArtifactCapabilityState,
    refreshArtifactRuntimeSnapshot: refreshSnapshot,
  }), [artifactId, handlers, familyController.workflowReviewHandlers, refreshArtifactCapabilityState, refreshSnapshot]);
  return useMemo(() => ({
    artifactId, artifactState, artifactHandlers, artifactRuntimeProjection,
    artifactRuntimeSnapshotError, navigationBlocked: familyController.navigationBlocked === true,
  }), [artifactId, artifactState, artifactHandlers, artifactRuntimeProjection,
    artifactRuntimeSnapshotError, familyController.navigationBlocked]);
}
