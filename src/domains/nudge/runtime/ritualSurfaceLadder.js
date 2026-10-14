/** Surface type/order metadata shared by presentation diagnostics.
 * Numeric order is not permission to interrupt or destroy a tab.
 * interventionPolicy owns the mandatory exception; the background admission
 * service owns session exclusion, recovery and exact conclusion authorization. */
export const RITUAL_SURFACE_TYPES = Object.freeze({
  PRESAGE: 'presage',
  ENSO_GATE: 'enso_gate',
  SITE_FURIN: 'site_furin',
  GLOBAL_SENTINEL: 'global_sentinel',
  GATE_INTERSTITIAL: 'gate_interstitial',
});

export const RITUAL_SURFACE_PRIORITIES = Object.freeze({
  [RITUAL_SURFACE_TYPES.PRESAGE]: 10,
  [RITUAL_SURFACE_TYPES.ENSO_GATE]: 40,
  [RITUAL_SURFACE_TYPES.SITE_FURIN]: 60,
  [RITUAL_SURFACE_TYPES.GLOBAL_SENTINEL]: 80,
  [RITUAL_SURFACE_TYPES.GATE_INTERSTITIAL]: 100,
});

export function requireRitualSurfacePriority(type) {
  if (!Object.prototype.hasOwnProperty.call(RITUAL_SURFACE_PRIORITIES, type)) {
    throw new Error(`RITUAL_SURFACE_TYPE_INVALID:${String(type)}`);
  }
  return RITUAL_SURFACE_PRIORITIES[type];
}
