export const CHERRY_RHYTHM_MODEL_ID = 'zen_cherry_rhythm_v1';
export const CHERRY_RHYTHM_ANNUAL_MODEL_ID = 'zen_cherry_rhythm_annual_v1';
export const CHERRY_RHYTHM_VARIANTS = Object.freeze(['baseline', 'cadence', 'renewal']);

export const CHERRY_RHYTHM_PROFILE = Object.freeze({
  id: 'annual-long-short-rhythm-prior-v1',
  modelId: CHERRY_RHYTHM_MODEL_ID,
  annualModelId: CHERRY_RHYTHM_ANNUAL_MODEL_ID,
  status: 'uncalibrated-developmental-ablation',
  startsCycle: 2,
  maxLongRun: 2,
  baseline: 'Exact preserved cherry-annual simulator: a terminal continues its axis birth kind.',
  cadence: 'On a born-long axis, two consecutive realized long annual units (foundation included) are followed by one short unit; the next eligible annual unit may be long again.',
  renewal: 'A born-long terminal receives independent annual development credit (2 nominal long costs + 1 nominal short cost) / 3. Opening credit is zero on its first controlled year. Actual complete shoot cost is debited only after the shared construction ledger commits it; unused credit carries forward.',
  controlledOrgans: 'Existing vegetative terminal buds on axes born long. A new lateral axis still pays only the original family construction ledger at birth; its terminal first receives credit in a later spring. Axes born short remain short.',
  currentKindOwner: 'AnnualUnit.kind records the actual shoot. Axis.kind remains the immutable birth kind; axis.currentKind tracks the last realized unit. Floral induction and lateral activation read the supporting annual unit.',
  resourceScope: 'Development credit is a dimensionless experimental opportunity account, not physiological carbon or measured meristem vigor. It does not change the preserved family construction allocation.',
  sharedPriors: 'No changes to flower count, size, induction probability, bud randomness, foundation geometry or first-year decisions. No target silhouette and no additional bud creation rule.',
});
