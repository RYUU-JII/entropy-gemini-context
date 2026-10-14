/** Uncalibrated morphology priors for an isolated branch-family experiment. */
export const CHERRY_ANNUAL_MODEL_ID = 'zen_cherry_annual_v1';

export const CHERRY_ANNUAL_PROFILE = Object.freeze({
  id: 'ornamental-cherry-branch-prior-v1',
  modelId: CHERRY_ANNUAL_MODEL_ID,
  status: 'uncalibrated-research-prior',
  scope: 'One branch family; virtual annual seasons, not climate or carbon prediction.',
  botanicalReference: 'P. avium architecture informs the long/short shoot and lateral flowering distinction; constants are design priors, not cultivar measurements.',
  coordinateUnit: 'arbitrary-world-unit',
  maxYears: 6,
  maxNodes: 2400,
  maxAxes: 500,
  maxBuds: 3000,
  foundationLength: 57,
  longNodes: 6,
  shortNodes: 3,
  longLength: 47,
  shortLength: 6.2,
  basalLimit: 0.34,
  distalStart: 0.73,
  floralInductionProbability: 0.88,
  initialAnnualBudget: 106,
  additionalAnnualBudget: 20,
  budgetUnit: 'abstract-construction',
  budgetScope: 'Complete annual shoot proposals: length, biological nodes, bud sites and terminal closure. Flowers and secondary thickening are outside this ledger; this is not a physiological carbon balance.',
});
