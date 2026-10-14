import { requireConsumptionFlowState } from '../../tracking/background/trackingConsumptionFlowState.js';
import { requireConsumptionEnvironment } from '../../tracking/background/trackingConsumptionEnvironment.js';

// Pure explanation from a single Tracking read. No second state writer, clocks,
// history queries, candidate selection, CLSE dependency, or implicit weights.
export function projectProtectedConsumptionContext(flow, evaluatedAt) {
  if (!flow || flow.basis !== 'collection-admitted-foreground'
    || !Object.hasOwn(flow, 'environment') || !Number.isSafeInteger(evaluatedAt) || evaluatedAt < 0) {
    throw new Error('PROTECTED_CONSUMPTION_CONTEXT_INPUT_INVALID');
  }
  const { schemaVersion, lastSegment, protectedForegroundMs, protectedRun, outsideRun, contexts } = flow;
  requireConsumptionFlowState({ schemaVersion, lastSegment, protectedForegroundMs, protectedRun, outsideRun, contexts });
  const environment = flow.environment === null ? null : requireConsumptionEnvironment(flow.environment);
  const usageThroughAt = lastSegment === null ? null : lastSegment.endedAt;
  const environmentAt = environment === null ? null : environment.observedAt;
  const coverage = environment === null ? 'unobserved'
    : environment.admission === 'disabled' ? 'disabled'
      : environmentAt > evaluatedAt || (usageThroughAt !== null && usageThroughAt > evaluatedAt) ? 'clock_regressed'
        : usageThroughAt !== null && environmentAt < usageThroughAt ? 'superseded'
          : 'observed';
  const observation = coverage === 'observed' ? environment : null;
  const state = observation?.foreground === 'protected' ? 'protected_foreground'
    : observation?.protectedMedia === 'present' ? 'protected_media'
      : observation?.foreground === 'outside' && observation?.protectedMedia === 'absent' ? 'outside_foreground'
        : 'unknown';
  const blockers = [];
  if (observation?.foreground === 'protected') blockers.push('protected_foreground');
  if (observation?.protectedMedia === 'present') blockers.push('protected_audible_media');
  if (!observation || observation.foreground === 'unknown') blockers.push('foreground_unobserved');
  if (!observation || observation.protectedMedia === 'unknown') blockers.push('media_unobserved');

  return {
    contract: 'protected_consumption_context_v1',
    evaluatedAt,
    state,
    stateAsOf: observation === null ? null : environmentAt,
    idleState: observation === null ? 'unknown' : observation.idleState,
    coverage: { status: coverage, environmentAt, usageThroughAt,
      unobservedMs: environmentAt === null ? null : Math.max(0, evaluatedAt - environmentAt),
      mediaKind: 'browser_audible_point' },
    usage: { protectedForegroundMs, latestProtectedRun: protectedRun === null ? null : { ...protectedRun } },
    departure: { observedOutsideRun: outsideRun === null ? null : { ...outsideRun } },
    recovery: { status: 'not_evaluated', blockingEvidence: blockers },
    // Explicit support state, not an implicit zero contribution. The future
    // interpreter will consume Navigation transitions joined to usage lineage.
    switching: { status: 'not_evaluated' },
    pressure: { status: 'not_evaluated' },
  };
}
