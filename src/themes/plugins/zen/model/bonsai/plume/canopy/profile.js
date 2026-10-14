export const CHERRY_CANOPY_MODEL_ID = 'zen_cherry_canopy_v1';

export const CHERRY_CANOPY_PROFILE = Object.freeze({
  id: 'fixed-f4-annual-organ-docking-v1',
  modelId: CHERRY_CANOPY_MODEL_ID,
  status: 'uncalibrated-composition-experiment',
  scaleDenominator: 1100,
  scaleRule: 'One uniform world scale = fixed F4 scaffold height / 1100; lengths, wood radii, flower radii and pedicels share it.',
  foundationPolicy: 'retained-extension',
  foundationDescription: 'Each attached annual family retains its preexisting one-year foundation shoot beyond the F4 tip. Only the origin node is welded; no F4 bud or annual history is invented.',
  attachmentPolicy: 'Every visible F4 leaf tip from the scaffold adapter, without aesthetic filtering.',
  framePolicy: 'The actual first foundation segment tangent is aligned to the F4 incoming tip tangent with a fixed orthonormal frame.',
  growthScope: 'Independent annual branch families on an inert F4 scaffold. Local-up rotates with each frame; no globally coupled light, gravity, root supply, competition or collision solver.',
  budgetScope: 'Sum of independent dimensionless annual-family construction ledgers. No transfers between families; no whole-tree carbon balance.',
  maxFamilies: 256,
  maxSnapshotNodes: 100000,
});
