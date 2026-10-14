import {
  FLOW_CANDIDATE_SOURCE_FILES,
  flowRecoveryTimeMs,
  validateFlowCandidateConfig,
} from './continuousFlowCandidate.mjs';

export const FLOW_CANDIDATE_RECOVERY_AUDIT_SOURCE_FILES = Object.freeze([
  'scripts/dev/usage-flow-evaluation/flowCandidateRecoveryAudit.mjs',
  ...FLOW_CANDIDATE_SOURCE_FILES,
]);

function requireNumber(value, detail, minimum = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new Error(`FLOW_CANDIDATE_RECOVERY_AUDIT_INVALID:${detail}`);
  }
}

/**
 * Stable equilibrium of the infinitesimal continuous-drive limit, not a human
 * rate estimate or a finite-callback simulation. A = v * recoveryMs / massScale.
 * Only 0 <= curvature <= 0.5 is reviewed here. At A <= 1 the clipped zero state
 * is the equilibrium; above it solve 2*g*p^2 + (1-2*g)*p = 1 - 1/A.
 */
export function equilibriumPressure(normalizedDrive, curvature) {
  requireNumber(normalizedDrive, 'normalized_drive');
  requireNumber(curvature, 'curvature');
  if (curvature > 0.5) {
    throw new Error('FLOW_CANDIDATE_RECOVERY_AUDIT_UNREVIEWED_CURVATURE');
  }
  if (normalizedDrive <= 1) return 0;
  const excess = (normalizedDrive - 1) / normalizedDrive;
  const linear = 1 - 2 * curvature;
  // Rationalized positive root avoids cancellation near A=1 and includes the
  // linear g=0 control without dividing by curvature.
  const result = 2 * excess / (linear + Math.sqrt(linear * linear + 8 * curvature * excess));
  requireNumber(result, 'equilibrium');
  if (result > 1) throw new Error('FLOW_CANDIDATE_RECOVERY_AUDIT_INVALID:equilibrium_bound');
  return result;
}

/**
 * Independent structural audit of the recovery shape under steady infinitesimal
 * drive. For p>0, dp/dt = (1-p)*v/M - 1/[tau*(1+2*g*p)]. The equilibrium equation
 * is A*(1-p)*(1+2*g*p)=1. Its gain term decreases on [0,1] when g<=0.5; g>0.5 can
 * first rise, admitting multiple roots and possible bistability below A=1.
 *
 * At g<0.5 the equilibrium's onset derivative at A=1+ is 1/(1-2*g). At g=0.5
 * it is sqrt(1-1/A), continuous with unbounded right slope. Finite slope is a local
 * property: values approaching the boundary can still be highly sensitive.
 */
export function auditFlowCandidateRecovery(config) {
  validateFlowCandidateConfig(config);
  const criticalRate = config.massScale / config.recoveryMs;
  requireNumber(criticalRate, 'critical_rate');
  if (criticalRate === 0) throw new Error('FLOW_CANDIDATE_RECOVERY_AUDIT_INVALID:critical_rate_underflow');
  const finiteOnset = config.curvature < 0.5;
  const atBoundary = config.curvature === 0.5;
  const onsetRightSlope = finiteOnset ? 1 / (1 - 2 * config.curvature) : null;
  if (onsetRightSlope !== null) requireNumber(onsetRightSlope, 'onset_slope');
  return {
    status: finiteOnset ? 'finite_onset_in_continuous_drive_limit' : 'review',
    config: Object.freeze({ ...config }),
    scope: 'local_onset_in_infinitesimal_continuous_drive_limit_only',
    normalizedDriveDefinition: 'A = v * recoveryMs / massScale',
    criticalRate,
    criticalRateUnits: 'declared_native_units_per_ms',
    steadyEquation: 'A * (1 - p) * (1 + 2 * curvature * p) = 1',
    reviewedEquilibriumCurvatureRange: [0, 0.5],
    onsetRightSlope,
    onsetSlopeVariable: 'normalized_drive_A_at_1_from_above',
    onsetClassification: finiteOnset ? 'finite_right_slope'
      : atBoundary ? 'unbounded_right_slope' : 'possible_bistability',
    recoveryAtHalfMs: flowRecoveryTimeMs(0.5, config),
    maxRecoveryMs: flowRecoveryTimeMs(1, config),
    reviewReasons: finiteOnset ? [] : atBoundary
      ? ['unbounded_right_slope']
      : ['possible_bistability', 'curvature_above_reviewed_range'],
    promotion: config.curvature > 0.5
      ? 'unsupported_in_unreviewed_curvature_range'
      : 'runtime_promotion_not_established_by_this_audit',
    limitations: [
      'The critical rate is a policy consequence in the declared native unit, not a measured human sensory rate.',
      'Finite onset slope is local; approaching curvature 0.5 can remain highly sensitive without becoming discontinuous.',
      'Finite observation intervals, missing coverage, and temporal rebinning are outside the continuous-drive limit.',
      'This audit does not calibrate intended intervention strength, infer intention, or certify runtime behavior.',
    ],
  };
}
