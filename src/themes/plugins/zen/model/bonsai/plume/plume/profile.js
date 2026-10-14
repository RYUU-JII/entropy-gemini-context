export const CHERRY_PLUME_MODEL_ID = 'zen_cherry_plume_v1';

// Dimensionless observation priors, not measured Prunus inflorescence traits.
export const CHERRY_PLUME_PROFILE = Object.freeze({
  lengthMin: 2.3,
  lengthRange: 1.6,
  widthMin: 0.88,
  widthRange: 0.48,
  tiltRange: 0.62,
  coreSpan: 0.9,
  fringeStationMin: 1.05,
  fringeStationRange: 0.32,
  fringeRadius: 0.84,
  coreRadius: 1.04,
  radiusJitter: 0.10,
  orientationMix: 0.25,
  semantics: 'World-space flower pose over exact Cloud v1 anatomy. A shared annual-unit flow, asymmetric core and sparse fringe reshape existing flower centers; squared radii are conserved per bud at full strength. No flowers, wood, support sites or annual fates are added or removed.',
});
