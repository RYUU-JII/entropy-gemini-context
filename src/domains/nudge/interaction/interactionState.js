import { resolveClickDelayDistribution } from '../../settings/config/filterValueSemantics.js';

// Canonical mutable runtime state for the interaction manager. A single shared
// object reference imported by every interaction submodule; all mutations are
// visible across modules because they operate on this exact instance.
export const state = {
  clickDelayMs: 0,
  clickDelayDistribution: resolveClickDelayDistribution(0),
  ensoGateEnabled: false,
  ensoGateConfig: null,
  scrollDelayTime: 0,
  scrollActive: false,
  pendingClick: null,
  ensoGate: null,
  suppressedClick: null,
  interactionListenerOwners: new Set(),
  interactionListenersAttached: false,
  replayGuard: new WeakSet(),
  selectorFailureKeys: new Set(),
};
