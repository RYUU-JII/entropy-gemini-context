import React, { useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import { buildExperimentArtifactPreviewContext } from './experimentArtifactPreviewContext.js';

export default function ExperimentArtifactPreview({
  Component,
  themeId,
  widgetType,
  isActive,
  isRuntimeActive,
  color,
  cycleState,
  tuning,
}) {
  const reducedMotion = useReducedMotion() === true;
  const artifactRenderContext = useMemo(() => buildExperimentArtifactPreviewContext({
    themeId, widgetType, isActive, isRuntimeActive, reducedMotion, color, cycleState,
  }), [themeId, widgetType, isActive, isRuntimeActive, reducedMotion, color, cycleState]);
  return <Component
    isActive={isActive}
    isEnabled={isActive}
    color={color}
    cycleState={cycleState}
    tuning={tuning}
    artifactRenderContext={artifactRenderContext}
  />;
}
