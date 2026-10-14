import { isDeepStrictEqual } from 'node:util';
import { measureUsageFlowTrace } from '../../../src/domains/nudge/feed-flow/observation/UsageFlowObservationWindow.js';

function equivalent(actual, expected) {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return Number.isFinite(actual) && Number.isFinite(expected)
      && Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected));
  }
  return isDeepStrictEqual(actual, expected);
}

function check(id, actual, expected) {
  return { id, passed: equivalent(actual, expected), expected, actual };
}

function requireCollection(scenarios, relations) {
  if (!Array.isArray(scenarios) || scenarios.length === 0 || !Array.isArray(relations)) {
    throw new Error('USAGE_FLOW_EVALUATION_CORPUS_REQUIRED');
  }
  const ids = new Set();
  for (const scenario of scenarios) {
    if (typeof scenario.id !== 'string' || !scenario.id || ids.has(scenario.id)) {
      throw new Error('USAGE_FLOW_EVALUATION_SCENARIO_ID_INVALID');
    }
    ids.add(scenario.id);
    if (!scenario.expected || Object.keys(scenario.expected).length === 0) {
      throw new Error(`USAGE_FLOW_EVALUATION_EXPECTATION_REQUIRED:${scenario.id}`);
    }
  }
  for (const relation of relations) {
    if (!ids.has(relation.left) || !ids.has(relation.right)) {
      throw new Error('USAGE_FLOW_EVALUATION_RELATION_TARGET_INVALID');
    }
    if (!['equal', 'less_than', 'greater_than'].includes(relation.relation)) {
      throw new Error('USAGE_FLOW_EVALUATION_RELATION_INVALID');
    }
  }
}

export function evaluateUsageFlowCorpus({ scenarios, relations, measureTrace = measureUsageFlowTrace }) {
  requireCollection(scenarios, relations);
  const results = scenarios.map((scenario) => {
    try {
      // Narrative, oracle, expected values and id never enter the measurement owner.
      const measurements = measureTrace(structuredClone(scenario.trace));
      if (!measurements || typeof measurements !== 'object') throw new Error('MEASUREMENT_RESULT_MISSING');
      const checks = Object.entries(scenario.expected).map(([key, expected]) => (
        check(key, measurements[key], expected)
      ));
      // These invariants supplement, rather than regenerate, authored expectations.
      checks.push(
        check('time_partition', measurements.visibleMs + measurements.hiddenMs, measurements.elapsedMs),
        check('feed_coverage_partition', measurements.feedObservedVisibleMs
          + measurements.feedUnavailableVisibleMs + measurements.feedUnsupportedVisibleMs, measurements.visibleMs),
        check('input_coverage_partition', measurements.inputObservedVisibleMs
          + measurements.inputUnavailableVisibleMs, measurements.visibleMs),
      );
      return {
        id: scenario.id, title: scenario.title,
        status: checks.every((entry) => entry.passed) ? 'pass' : 'fail',
        measurements, checks,
        // This is a review checklist, not an automatically passed intent test.
        inferenceReview: { status: 'not_automated', ...scenario.oracle },
      };
    } catch (error) {
      return { id: scenario.id, title: scenario.title, status: 'invalid', error: String(error.message) };
    }
  });
  const byId = new Map(results.map((result) => [result.id, result]));
  const traces = new Map(scenarios.map((scenario) => [scenario.id, scenario.trace]));
  const relationResults = relations.map((relation) => {
    const leftResult = byId.get(relation.left);
    const rightResult = byId.get(relation.right);
    const metricValue = (result) => (
      relation.metric === 'trace' ? traces.get(result.id)
        : relation.metric === 'measurements' ? result.measurements
          : result.measurements?.[relation.metric]
    );
    const left = metricValue(leftResult);
    const right = metricValue(rightResult);
    const available = left !== undefined && right !== undefined
      && leftResult.status !== 'invalid' && rightResult.status !== 'invalid';
    const numbers = typeof left === 'number' && Number.isFinite(left)
      && typeof right === 'number' && Number.isFinite(right);
    const passed = available && (relation.relation === 'equal'
      ? equivalent(left, right)
      : numbers && (relation.relation === 'less_than' ? left < right : left > right));
    return { ...relation, passed };
  });
  return {
    scope: 'offline_measurement_contract',
    status: results.every((result) => result.status === 'pass')
      && relationResults.every((result) => result.passed) ? 'pass' : 'fail',
    expectedScenarioCount: scenarios.length,
    evaluatedScenarioCount: results.length,
    passedScenarioCount: results.filter((result) => result.status === 'pass').length,
    invalidScenarioCount: results.filter((result) => result.status === 'invalid').length,
    relationCount: relationResults.length,
    passedRelationCount: relationResults.filter((result) => result.passed).length,
    liveCaptureAccuracy: 'not_evaluated',
    behavioralValidity: 'not_evaluated',
    interventionBehavior: 'not_evaluated',
    scenarios: results,
    relations: relationResults,
  };
}
