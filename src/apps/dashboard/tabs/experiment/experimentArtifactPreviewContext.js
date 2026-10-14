import { getCanonicalArtifactDefinition } from '@/domains/protection/catalog/artifactFamilyCatalog.js';
import { assertCanonicalThemeId } from '@/themes/core/ids.js';
import { TOOLS_ARTIFACT_DEFINITIONS } from '@/themes/core/tools/artifacts.js';
import {
  buildArtifactActivityState,
  buildArtifactPresentationState,
  resolveArtifactRenderState,
} from '@/themes/core/tools/artifactPresentation.js';
import { buildArtifactRenderContext } from '@/themes/core/tools/artifactRenderContext.js';

// This development-only fixture describes a preview, never persisted settings or
// evidence that an artifact performed protection, cleanup or a ritual.
export function buildExperimentArtifactPreviewContext({
  themeId,
  widgetType,
  isActive,
  isRuntimeActive,
  reducedMotion,
  color,
  cycleState = null,
}) {
  assertCanonicalThemeId(themeId, 'Experiment artifact preview');
  if (themeId === 'zen') {
    throw new Error('EXPERIMENT_ARTIFACT_PREVIEW_ZEN_RITUAL_OWNER_REQUIRED');
  }
  const definition = TOOLS_ARTIFACT_DEFINITIONS.find(artifact => artifact.widgetType === widgetType);
  if (!definition) {
    throw new Error(`EXPERIMENT_ARTIFACT_PREVIEW_WIDGET_INVALID:${String(widgetType)}`);
  }
  if ([isActive, isRuntimeActive, reducedMotion].some(value => typeof value !== 'boolean')
    || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) {
    throw new Error(`EXPERIMENT_ARTIFACT_PREVIEW_INPUT_INVALID:${definition.id}`);
  }
  const catalog = getCanonicalArtifactDefinition(definition.id);
  if (!catalog || catalog.id !== definition.id || !Array.isArray(catalog.releaseChildren) || catalog.releaseChildren.length === 0) {
    throw new Error(`EXPERIMENT_ARTIFACT_PREVIEW_CATALOG_INVALID:${definition.id}`);
  }
  const visualState = Object.freeze({
    activeCount: isActive ? catalog.releaseChildren.length : 0,
    stageCount: catalog.releaseChildren.length,
    children: Object.freeze(Object.fromEntries(catalog.releaseChildren.map(childId => [childId, Object.freeze({
      enabled: isActive,
      configuredEnabled: isActive,
      ratio: isActive ? 1 : 0,
    })]))),
  });
  const admitted = isActive && isRuntimeActive;
  const artifactActivity = buildArtifactActivityState({
    artifactId: definition.id,
    configuredActive: isActive,
    runtimeState: isActive ? (admitted ? 'engaged' : 'armed') : 'disabled',
    isRuntimeActive: admitted,
  });
  const artifactPresentation = buildArtifactPresentationState({
    artifactId: definition.id,
    visualKey: definition.visualKey,
    artifactActivity,
    artifactVisualState: visualState,
  });
  const artifactRenderState = resolveArtifactRenderState({
    artifactActivity,
    artifactPresentation,
    visualActivityWeight: isActive ? 1 : 0,
    shouldAnimate: admitted,
    reducedMotion,
  });
  return buildArtifactRenderContext({
    systemMode: themeId,
    visualKey: definition.visualKey,
    color,
    cycleState,
    artifactActivity,
    artifactPresentation,
    artifactRenderState,
    artifactVisualState: visualState,
    diagnostics: {
      fixture: Object.freeze({ source: 'experiment_synthetic', scope: 'artifact_preview', persisted: false }),
      rendererWidget: { status: 'ready', themeId, visualKey: definition.visualKey, widgetName: widgetType },
    },
  });
}
