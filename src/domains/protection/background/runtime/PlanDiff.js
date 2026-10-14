import {
  normalizeInterventionPlan,
} from '../../contracts/protectionContracts.js';

function serialize(value) {
  return JSON.stringify(value ?? null);
}

export function diffInterventionPlans(previousPlan, nextPlan) {
  const previous = previousPlan ? normalizeInterventionPlan(previousPlan) : null;
  const next = normalizeInterventionPlan(nextPlan);

  const stateChanged = serialize(previous?.state) !== serialize(next.state);
  const lanesChanged = serialize(previous?.lanes) !== serialize(next.lanes);
  const filtersChanged = serialize(previous?.filterPlan) !== serialize(next.filterPlan);
  const artifactsChanged = serialize(previous?.artifacts) !== serialize(next.artifacts);
  const traceChanged = serialize(previous?.trace) !== serialize(next.trace);
  const changed = !previous
    || stateChanged
    || lanesChanged
    || filtersChanged
    || artifactsChanged
    || traceChanged;

  return {
    changed,
    stateChanged,
    lanesChanged,
    filtersChanged,
    artifactsChanged,
    traceChanged,
    previous,
    next,
  };
}
