import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ArtifactSvgStage from '@/themes/core/artifacts/scene/ArtifactSvgStage.jsx';

export function createZenSvgScope(prefix) {
  return { get: (name) => `${prefix}-${name}`, url: (name) => `url(#${prefix}-${name})` };
}

// Canonical vector preparation, shared by retained canvas and DOM presenters.
// No raster/engine dependency or independent animation clock here.
export function zenSvgDocument(scene, bounds) {
  const markup = renderToStaticMarkup(<ArtifactSvgStage width={bounds[2]} height={bounds[3]}
    viewBox={bounds.join(' ')} defs={scene.defs} nodes={scene.nodes} xmlns="http://www.w3.org/2000/svg" />);
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (svg.querySelector('parsererror')) throw new Error('ZEN_ARTIFACT_SVG_RECIPE_INVALID');
  if (svg.querySelector('foreignObject, image, script, animate, animateTransform')) {
    throw new Error('ZEN_ARTIFACT_SVG_RECIPE_NOT_STATIC');
  }
  return svg;
}
