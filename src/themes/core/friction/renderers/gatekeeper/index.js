import { defaultGatekeeperRenderer } from './defaultGatekeeperRenderer.js';
import { zenIshidouroGatekeeperRenderer } from './zenIshidouroRenderer.js';

export const DEFAULT_GATEKEEPER_RENDERER_ID = defaultGatekeeperRenderer.id;

const GATEKEEPER_RENDERERS = Object.freeze({
  [defaultGatekeeperRenderer.id]: defaultGatekeeperRenderer,
  [zenIshidouroGatekeeperRenderer.id]: zenIshidouroGatekeeperRenderer,
});

export function resolveGatekeeperRenderer(rendererId) {
  if (rendererId && GATEKEEPER_RENDERERS[rendererId]) {
    return GATEKEEPER_RENDERERS[rendererId];
  }
  return GATEKEEPER_RENDERERS[DEFAULT_GATEKEEPER_RENDERER_ID];
}
