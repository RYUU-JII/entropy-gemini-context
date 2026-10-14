export const CHERRY_CLOUD_MODEL_ID = 'zen_cherry_cloud_v1';

// Dimensionless / scaffold-relative research priors, not measured Prunus physiology.
export const CHERRY_CLOUD_PROFILE = Object.freeze({
  minSupportRadius: 1.65,
  maxSupportRadius: 8.5,
  minHeightFraction: 0.32,
  reservationReach: 38,
  reservationRadius: 30,
  reservationSeparation: 1.0,
  initialLength: 57,
  extensionLength: 27,
  shortLength: 14,
  annualAllowanceBase: 21,
  annualAllowancePerRadius: 4.5,
  floralInductionProbability: 0.9,
  lateralActivationProbability: 0.88,
  maxModuleNodes: 240,
  semantics: 'Explicit initialized lateral buds on inert F4 wood; spatially admitted annual shoot modules. Construction credits are finite abstract development units, not calibrated carbon or physiology. Fixed world-space occupancy limits additional growth without moving or rewriting the source tree.',
});
