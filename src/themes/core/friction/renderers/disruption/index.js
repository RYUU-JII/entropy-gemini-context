import { clinicalPulseDisruptionRenderer } from './clinicalPulseRenderer.js';
import { signalDisruptionRenderer } from './signalDisruptionRenderer.js';
import { zenAfterglowDisruptionRenderer } from './zenAfterglowRenderer.js';

export const DEFAULT_DISRUPTION_RENDERER_ID = signalDisruptionRenderer.id;

const DISRUPTION_RENDERERS = Object.freeze({
  [signalDisruptionRenderer.id]: signalDisruptionRenderer,
  [clinicalPulseDisruptionRenderer.id]: clinicalPulseDisruptionRenderer,
  [zenAfterglowDisruptionRenderer.id]: zenAfterglowDisruptionRenderer,
});

export function resolveDisruptionRenderer(rendererId) {
  if (rendererId && DISRUPTION_RENDERERS[rendererId]) {
    return DISRUPTION_RENDERERS[rendererId];
  }
  return DISRUPTION_RENDERERS[DEFAULT_DISRUPTION_RENDERER_ID];
}
