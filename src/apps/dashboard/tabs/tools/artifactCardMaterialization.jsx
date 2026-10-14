import { buildToolsArtifactDisplayCopy, buildToolsArtifactShell } from './artifactShells.js';
import { buildArtifactActivityState, buildArtifactPresentationState, resolveArtifactPreviewRenderState } from '@/themes/core/tools/artifactPresentation.js';
import React from 'react';
import { buildArtifactStatusBlockModel, materializeArtifactControlSurface } from './artifactCards/shared.jsx';
import ArtifactApplicationFeedback from './components/ArtifactApplicationFeedback.jsx';
import { COOLING_CURVE_FAMILY_IDS } from '../../../../domains/settings/config/coolingCurvePolicy.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function assertToolsArtifactFamilyContract({
  state = {},
  handlers = {},
  artifactCardSchemaEntries = [],
} = {}) {
  const artifactFamilies = state.artifactFamilies;
  const artifactFamilyHandlers = handlers.artifactFamilies;
  if (!isPlainObject(artifactFamilies)) {
    throw new Error('[buildToolsArtifacts] Missing artifact family state map.');
  }
  if (!isPlainObject(artifactFamilyHandlers)) {
    throw new Error('[buildToolsArtifacts] Missing artifact family handler map.');
  }

  artifactCardSchemaEntries.forEach(({ definition }) => {
    if (!isPlainObject(artifactFamilies[definition.id])) {
      throw new Error(`[buildToolsArtifacts] Missing artifact family state for "${definition.id}".`);
    }
    if (!isPlainObject(artifactFamilyHandlers[definition.id])) {
      throw new Error(`[buildToolsArtifacts] Missing artifact family handlers for "${definition.id}".`);
    }
    if (typeof artifactFamilyHandlers[definition.id].setSuspended !== 'function') {
      throw new Error(`[buildToolsArtifacts] Missing artifact family suspension handler for "${definition.id}".`);
    }
    if (typeof artifactFamilyHandlers[definition.id].applyRecommendation !== 'function') {
      throw new Error(`[buildToolsArtifacts] Missing artifact family recommendation handler for "${definition.id}".`);
    }
  });
}

function buildArtifactVisualState(schema, artifactState) {
  if (typeof schema.buildVisualState !== 'function') {
    return null;
  }
  return schema.buildVisualState(artifactState);
}

function assertMaterializedArtifactControlSurface(artifactId, controlSurface) {
  if (!isPlainObject(controlSurface)) {
    throw new Error(`[buildToolsArtifacts] Missing materialized control surface for "${artifactId}".`);
  }
  if (!isPlainObject(controlSurface.dock)) {
    throw new Error(`[buildToolsArtifacts] Missing materialized dock surface for "${artifactId}".`);
  }
  if (!controlSurface.dock.content) {
    throw new Error(`[buildToolsArtifacts] Missing materialized dock content for "${artifactId}".`);
  }
  if (!Array.isArray(controlSurface.dock.blocks) || controlSurface.dock.blocks.length === 0) {
    throw new Error(`[buildToolsArtifacts] Missing dock block metadata for "${artifactId}".`);
  }
}

function assertArtifactWorkflowReview(artifactId, workflowReview) {
  if (workflowReview === null || typeof workflowReview === 'undefined') return;
  if (!isPlainObject(workflowReview)) {
    throw new Error(`[buildToolsArtifacts] Invalid workflow review for "${artifactId}".`);
  }
  if (typeof workflowReview.key !== 'string' || !workflowReview.key.trim()) {
    throw new Error(`[buildToolsArtifacts] Missing workflow review key for "${artifactId}".`);
  }
  if (!workflowReview.content) {
    throw new Error(`[buildToolsArtifacts] Missing workflow review content for "${artifactId}".`);
  }
}

export function buildMaterializedArtifact({
  activationDerivedState,
  artifactDisclosureSnapshot,
  components,
  definition,
  handlers,
  schema,
  t,
}) {
  const artifactActivationState = activationDerivedState.artifactActivationStates[definition.id];
  const artifactState = {
    ...activationDerivedState,
    artifactActivationState,
  };
  const configuredActive = artifactActivationState.configuredEnabled;
  const shell = buildToolsArtifactShell({
    artifactId: definition.id,
    activationState: artifactActivationState,
    themeId: components.themeId,
    t,
  });
  const copy = buildToolsArtifactDisplayCopy(shell, t);
  const card = schema.build({
    shell,
    t,
    state: artifactState,
    handlers,
  });
  const applicationStatus = shell.applicationStatus;
  const baseControlSurface = definition.id !== 'flare' && applicationStatus?.action ? {
    ...card.controlSurface,
    dock: { ...card.controlSurface.dock, blocks: [...card.controlSurface.dock.blocks,
      buildArtifactStatusBlockModel({ status: { ...applicationStatus,
        detail: <ArtifactApplicationFeedback status={applicationStatus} handlers={handlers} /> } }),
    ] },
  } : card.controlSurface;
  const sourceControlSurface = COOLING_CURVE_FAMILY_IDS.includes(definition.id) ? {
    ...baseControlSurface,
    dock: { ...baseControlSurface.dock, blocks: [
      { kind: 'cooling-curve-mode', familyId: definition.id }, ...baseControlSurface.dock.blocks,
    ] },
  } : baseControlSurface;
  const controlSurface = materializeArtifactControlSurface(sourceControlSurface);
  assertMaterializedArtifactControlSurface(definition.id, controlSurface);
  assertArtifactWorkflowReview(definition.id, card.workflowReview);
  const artifactVisualState = buildArtifactVisualState(schema, artifactState);
  const artifactActivity = buildArtifactActivityState({
    artifactId: definition.id,
    runtimeState: artifactActivationState.runtimeState,
    isRuntimeActive: artifactActivationState.isRuntimeActive,
    configuredActive,
  });
  const artifactPresentation = buildArtifactPresentationState({
    artifactId: definition.id,
    visualKey: definition.visualKey,
    runtimeState: shell.runtimeState,
    isRuntimeActive: shell.isRuntimeActive,
    configuredActive,
    artifactActivity,
    artifactVisualState,
  });
  const artifactPreviewRenderState = resolveArtifactPreviewRenderState({
    artifactActivity,
    artifactPresentation,
    isRuntimeActive: shell.isRuntimeActive,
    isPreviewActive: shell.isPreviewActive,
  });

  return {
    ...shell,
    ...copy,
    ...card,
    controlSurface,
    workflowReview: card.workflowReview || null,
    artifactVisualState,
    artifactActivity,
    artifactPresentation,
    artifactPreviewRenderState,
    artifactDisclosure: artifactDisclosureSnapshot.entriesByFamilyId?.[definition.id] || null,
  };
}

