import fs from 'node:fs/promises';
import path from 'node:path';

import {
  createBrowserExecutionEnvironment,
} from '../../browser-qa/contracts/browserExecutionContract.mjs';
import {
  SITE_RUN_OUTCOMES,
  combineSiteRunOutcomes,
} from '../../e2e/sites/siteRuntimeReport.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';

const SITE_RUNTIME_OUTCOME_VALUES = new Set(Object.values(SITE_RUN_OUTCOMES));
const SITE_RUNTIME_REPORT_KEYS = Object.freeze([
  'browser',
  'builds',
  'controls',
  'extensionDisabledControl',
  'generatedAt',
  'lanes',
  'options',
  'outcome',
  'performanceBaselines',
  'profile',
  'reportRoot',
  'reproductionCommands',
  'runs',
  'scenarioComparisons',
  'schemaVersion',
  'suite',
  'takeoverCheckpoints',
]);
const FEED_CONSUMPTION_EXACT_MATCH_ACCEPTANCE_KIND = 'feed_consumption_exact_match';
const FEED_CONSUMPTION_EXACT_MATCH_CONTRACT_ID = 'feed-consumption-exact-match';
const FEED_CONSUMPTION_MEASURED_REASON = 'opportunities_matched_exactly_once';
const FEED_CONSUMPTION_ARMED_IDLE_REASON = (
  'bounded_inputs_produced_no_independent_opportunity'
);
const FEED_CONSUMPTION_EXACT_MATCH_COUNT_KEYS = Object.freeze([
  'armedIdleCount',
  'detectorEventCount',
  'duplicateCount',
  'falseNegativeCount',
  'falsePositiveCount',
  'insufficientStepCount',
  'opportunityCount',
  'precision',
  'recall',
  'truePositiveCount',
]);
const FEED_CONSUMPTION_EXACT_MATCH_INTEGER_COUNT_KEYS = Object.freeze([
  'opportunityCount',
  'armedIdleCount',
  'insufficientStepCount',
  'detectorEventCount',
  'truePositiveCount',
  'falseNegativeCount',
  'falsePositiveCount',
  'duplicateCount',
]);
const SITE_RUNTIME_REPORT_ACCEPTANCE_KEYS = Object.freeze([
  'kind',
  'minimumOpportunityCountPerRun',
  'scenarioId',
]);
const SITE_RUNTIME_REPEAT_ISOLATION_FRESH_DISPOSABLE_BROWSER = (
  'fresh_disposable_browser'
);
const SITE_RUNTIME_REPEAT_ISOLATION_EVIDENCE_KEYS = Object.freeze([
  'browserEpochDigest',
  'browserProcessOwnership',
  'cleanupState',
  'epochOrdinal',
  'mode',
  'profileEpochDigest',
  'profileOwnership',
  'profileRetained',
  'temporaryExtensionRetained',
  'version',
]);
const SHA256_SCALAR_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function createFailure(code, detail = '', cause = null) {
  const hasDetail = detail !== '' && detail !== null && detail !== undefined;
  const error = new Error(
    hasDetail ? `${code}:${String(detail)}` : code,
    cause ? { cause } : undefined,
  );
  error.code = code;
  return error;
}

function fail(code, detail = '', cause = null) {
  throw createFailure(code, detail, cause);
}

function isRecord(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function sameStringArray(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function requireExactKeys(value, expectedKeys, code) {
  const actualKeys = Object.keys(value).sort();
  const canonicalKeys = [...expectedKeys].sort();
  if (!sameStringArray(actualKeys, canonicalKeys)) {
    const missing = canonicalKeys.filter((key) => !actualKeys.includes(key));
    const unexpected = actualKeys.filter((key) => !canonicalKeys.includes(key));
    fail(
      code,
      `missing=${missing.join(',') || 'none'};unexpected=${unexpected.join(',') || 'none'}`,
    );
  }
}

function requireRecord(value, code) {
  if (!isRecord(value)) fail(code);
  return value;
}

function requireString(value, code) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    fail(code, value || 'missing');
  }
  return value;
}

function requireSiteRuntimeOutcome(value, code) {
  if (!SITE_RUNTIME_OUTCOME_VALUES.has(value)) fail(code, value || 'missing');
  return value;
}

function requirePositiveInteger(value, code) {
  if (!Number.isSafeInteger(value) || value < 1) fail(code, value);
  return value;
}

function expectedSiteRuntimeLanes(expectedLane) {
  if (!['diagnostic', 'release', 'both'].includes(expectedLane)) {
    fail('QA_SITE_RUNTIME_EXPECTED_LANE_INVALID', expectedLane || 'missing');
  }
  return expectedLane === 'both'
    ? ['diagnostic', 'release']
    : [expectedLane];
}

function projectSiteRuntimeOutcome(outcome) {
  if (outcome === SITE_RUN_OUTCOMES.PASS) return QA_RUN_STATUSES.PASS;
  if (outcome === SITE_RUN_OUTCOMES.FAIL) return QA_RUN_STATUSES.FAIL;
  return QA_RUN_STATUSES.INCONCLUSIVE;
}

export function resolveSiteRuntimeInvocation(plan) {
  const site = plan?.protocolOptions?.siteSelection === true
    ? requireString(plan?.parameters?.site, 'QA_SITE_RUNTIME_SITE_REQUIRED')
    : null;
  const profile = plan?.parameters?.profile === undefined
    ? null
    : requireString(plan.parameters.profile, 'QA_SITE_RUNTIME_PROFILE_REQUIRED');
  const repeatIsolation = plan?.protocolOptions?.repeatIsolation === undefined
    ? null
    : requireString(
      plan.protocolOptions.repeatIsolation,
      'QA_SITE_RUNTIME_REPEAT_ISOLATION_INVALID',
    );
  if (
    repeatIsolation !== null
    && repeatIsolation !== SITE_RUNTIME_REPEAT_ISOLATION_FRESH_DISPOSABLE_BROWSER
  ) {
    fail('QA_SITE_RUNTIME_REPEAT_ISOLATION_INVALID', repeatIsolation);
  }
  if (repeatIsolation !== null && profile !== null) {
    fail('QA_SITE_RUNTIME_REPEAT_ISOLATION_PROFILE_FORBIDDEN');
  }
  const featureGroups = plan?.protocolOptions?.featureGroups;
  let featureGroup = null;
  if (featureGroups !== undefined) {
    if (!isRecord(featureGroups)) {
      fail('QA_SITE_RUNTIME_FEATURE_GROUPS_INVALID');
    }
    const feature = requireString(
      plan?.parameters?.feature,
      'QA_SITE_RUNTIME_FEATURE_REQUIRED',
    );
    if (!Object.hasOwn(featureGroups, feature)) {
      fail('QA_SITE_RUNTIME_FEATURE_INVALID', feature);
    }
    featureGroup = featureGroups[feature];
    if (
      featureGroup !== null
      && (typeof featureGroup !== 'string' || !featureGroup.trim())
    ) {
      fail('QA_SITE_RUNTIME_FEATURE_INVALID', feature);
    }
  }
  const profiles = plan?.protocolOptions?.measurementProfiles;
  if (profiles === undefined) {
    if (repeatIsolation !== null && plan?.parameters?.lane !== 'diagnostic') {
      fail('QA_SITE_RUNTIME_REPEAT_ISOLATION_DIAGNOSTIC_LANE_REQUIRED');
    }
    return Object.freeze({
      lane: plan?.parameters?.lane,
      repeat: plan?.parameters?.repeat,
      measurementProfile: null,
      site,
      ...(repeatIsolation ? { repeatIsolation } : {}),
      ...(featureGroup ? { featureGroup } : {}),
      ...(profile ? { profile } : {}),
    });
  }
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    fail('QA_SITE_RUNTIME_MEASUREMENT_PROFILES_INVALID');
  }
  const measurementProfile = plan?.parameters?.measurement;
  const route = profiles[measurementProfile];
  if (!route || typeof route !== 'object' || Array.isArray(route)) {
    fail('QA_SITE_RUNTIME_MEASUREMENT_PROFILE_INVALID', measurementProfile || 'missing');
  }
  if (!['diagnostic', 'release', 'both'].includes(route.lane)) {
    fail('QA_SITE_RUNTIME_MEASUREMENT_LANE_INVALID', route.lane || 'missing');
  }
  const samples = plan?.parameters?.samples;
  const repeat = Number.isSafeInteger(route.fixedRepeat)
    ? route.fixedRepeat
    : samples;
  if (!Number.isSafeInteger(repeat) || repeat < 1 || repeat > 20) {
    fail('QA_SITE_RUNTIME_MEASUREMENT_SAMPLE_COUNT_INVALID', repeat);
  }
  if (
    Number.isSafeInteger(route.minimumSamples)
    && repeat < route.minimumSamples
  ) {
    fail(
      'QA_SITE_RUNTIME_MEASUREMENT_SAMPLE_FLOOR_UNMET',
      `${measurementProfile}:${repeat}:${route.minimumSamples}`,
    );
  }
  if (repeatIsolation !== null && route.lane !== 'diagnostic') {
    fail('QA_SITE_RUNTIME_REPEAT_ISOLATION_DIAGNOSTIC_LANE_REQUIRED');
  }
  return Object.freeze({
    lane: route.lane,
    repeat,
    measurementProfile,
    site,
    ...(repeatIsolation ? { repeatIsolation } : {}),
    ...(featureGroup ? { featureGroup } : {}),
    ...(profile ? { profile } : {}),
  });
}

async function requireLstat(targetPath, {
  missingCode,
  readCode,
}) {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (error?.code === 'ENOENT') fail(missingCode, '', error);
    fail(readCode, error?.code || error?.name || 'unknown', error);
  }
}

async function readReportJson(reportJsonPath) {
  let source;
  try {
    source = await fs.readFile(reportJsonPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      fail('QA_SITE_RUNTIME_REPORT_FILE_MISSING', '', error);
    }
    fail(
      'QA_SITE_RUNTIME_REPORT_FILE_READ_FAILED',
      error?.code || error?.name || 'unknown',
      error,
    );
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    fail('QA_SITE_RUNTIME_REPORT_JSON_INVALID', error?.name || 'parse', error);
  }
}

function validateGeneratedAt(value) {
  if (typeof value !== 'string') {
    fail('QA_SITE_RUNTIME_REPORT_GENERATED_AT_INVALID', value || 'missing');
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    fail('QA_SITE_RUNTIME_REPORT_GENERATED_AT_INVALID', value);
  }
}

function validateReportOptions(options, {
  reportRoot,
  expectedSuite,
  expectedLane,
  expectedRepeat,
  expectedMeasurementProfile,
  expectedSite = null,
  expectedFeatureGroup = null,
  expectedRepeatIsolation = null,
}) {
  requireRecord(options, 'QA_SITE_RUNTIME_REPORT_OPTIONS_INVALID');
  if (options.suite !== expectedSuite) {
    fail('QA_SITE_RUNTIME_REPORT_OPTIONS_SUITE_MISMATCH', options.suite || 'missing');
  }
  if (options.lane !== expectedLane) {
    fail('QA_SITE_RUNTIME_REPORT_OPTIONS_LANE_MISMATCH', options.lane || 'missing');
  }
  requirePositiveInteger(options.repeat, 'QA_SITE_RUNTIME_REPORT_OPTIONS_REPEAT_INVALID');
  if (expectedRepeat !== null && options.repeat !== expectedRepeat) {
    fail('QA_SITE_RUNTIME_REPORT_OPTIONS_REPEAT_MISMATCH', options.repeat);
  }
  if (
    typeof expectedMeasurementProfile === 'string'
    && options.measurementProfile !== expectedMeasurementProfile
  ) {
    fail(
      'QA_SITE_RUNTIME_REPORT_OPTIONS_MEASUREMENT_PROFILE_MISMATCH',
      options.measurementProfile || 'missing',
    );
  }
  if (expectedSite !== null && options.site !== expectedSite) {
    fail('QA_SITE_RUNTIME_REPORT_OPTIONS_SITE_MISMATCH', options.site || 'missing');
  }
  if (expectedFeatureGroup !== null && options.featureGroup !== expectedFeatureGroup) {
    fail(
      'QA_SITE_RUNTIME_REPORT_OPTIONS_FEATURE_GROUP_MISMATCH',
      options.featureGroup || 'missing',
    );
  }
  const hasRepeatIsolation = Object.hasOwn(options, 'repeatIsolation');
  if (expectedRepeatIsolation === null && hasRepeatIsolation) {
    fail(
      'QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_UNEXPECTED',
      options.repeatIsolation ?? 'null',
    );
  }
  if (
    expectedRepeatIsolation !== null
    && (!hasRepeatIsolation || options.repeatIsolation !== expectedRepeatIsolation)
  ) {
    fail(
      'QA_SITE_RUNTIME_REPORT_OPTIONS_REPEAT_ISOLATION_MISMATCH',
      options.repeatIsolation || 'missing',
    );
  }
  if (
    expectedRepeatIsolation !== null
    && (options.profile !== null || options.keepProfile !== false)
  ) {
    fail('QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_TOPOLOGY_INVALID', 'options');
  }
  if (
    typeof options.reportDir !== 'string'
    || path.resolve(options.reportDir) !== reportRoot
  ) {
    fail('QA_SITE_RUNTIME_REPORT_OPTIONS_ROOT_MISMATCH');
  }
  if (options.failOnInconclusive !== false) {
    fail(
      'QA_SITE_RUNTIME_REPORT_FAIL_ON_INCONCLUSIVE_INVALID',
      options.failOnInconclusive,
    );
  }
  return options.repeat;
}

function validateReportRepeatIsolationTopology(report, {
  expectedLanes,
  expectedRepeatIsolation,
}) {
  if (expectedRepeatIsolation === null) return;
  if (!sameStringArray(expectedLanes, ['diagnostic'])) {
    fail('QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_TOPOLOGY_INVALID', 'lanes');
  }
  if (
    !isRecord(report.browser)
    || typeof report.browser.product !== 'string'
    || report.browser.product.length === 0
    || typeof report.browser.protocolVersion !== 'string'
    || report.browser.protocolVersion.length === 0
    || typeof report.browser.executable !== 'string'
    || report.browser.executable.length === 0
    || typeof report.browser.headless !== 'boolean'
  ) {
    fail('QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_TOPOLOGY_INVALID', 'browser');
  }
  const profile = report.profile;
  if (
    profile.mode !== 'disposable'
    || profile.path !== null
    || profile.retained !== false
    || profile.controlPath !== null
  ) {
    fail('QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_TOPOLOGY_INVALID', 'profile');
  }
  const diagnosticBuild = report.builds.diagnostic;
  if (
    !isRecord(diagnosticBuild)
    || diagnosticBuild.temporaryExtensionPath !== null
    || diagnosticBuild.temporaryExtensionRetained !== false
    || diagnosticBuild.temporaryExtensionLifecycle !== 'temporary_removed_after_lane'
  ) {
    fail('QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_TOPOLOGY_INVALID', 'build');
  }
}

function normalizeReportAcceptance(acceptance, expectedSite) {
  if (acceptance === undefined) return null;
  requireRecord(acceptance, 'QA_SITE_RUNTIME_ACCEPTANCE_CONFIG_INVALID');
  requireExactKeys(
    acceptance,
    SITE_RUNTIME_REPORT_ACCEPTANCE_KEYS,
    'QA_SITE_RUNTIME_ACCEPTANCE_CONFIG_INVALID',
  );
  if (acceptance.kind !== FEED_CONSUMPTION_EXACT_MATCH_ACCEPTANCE_KIND) {
    fail(
      'QA_SITE_RUNTIME_ACCEPTANCE_CONFIG_INVALID',
      `kind=${String(acceptance.kind)}`,
    );
  }
  const minimumOpportunityCountPerRun = acceptance.minimumOpportunityCountPerRun;
  if (
    !Number.isSafeInteger(minimumOpportunityCountPerRun)
    || minimumOpportunityCountPerRun < 1
  ) {
    fail(
      'QA_SITE_RUNTIME_ACCEPTANCE_CONFIG_INVALID',
      `minimumOpportunityCountPerRun=${String(minimumOpportunityCountPerRun)}`,
    );
  }
  return Object.freeze({
    kind: acceptance.kind,
    minimumOpportunityCountPerRun,
    scenarioId: requireString(
      acceptance.scenarioId,
      'QA_SITE_RUNTIME_ACCEPTANCE_CONFIG_INVALID',
    ),
    siteId: requireString(
      expectedSite,
      'QA_SITE_RUNTIME_ACCEPTANCE_CONFIG_INVALID',
    ),
  });
}

function validateReportRuns(runs, {
  expectedLanes,
  expectedRepeat,
  expectedRepeatIsolation = null,
  reportAcceptance = null,
}) {
  if (!Array.isArray(runs) || runs.length === 0) {
    fail('QA_SITE_RUNTIME_REPORT_RUNS_INVALID');
  }
  const laneCoverage = new Set();
  const identitiesByLane = new Map(expectedLanes.map((lane) => [lane, new Set()]));
  const identities = new Set();
  const isolationEvidenceByEpoch = new Map();
  const browserEpochOwners = new Map();
  const profileEpochOwners = new Map();
  const outcomes = [];
  runs.forEach((run, index) => {
    requireRecord(run, 'QA_SITE_RUNTIME_REPORT_RUN_INVALID');
    requireSiteRuntimeOutcome(
      run.outcome,
      'QA_SITE_RUNTIME_REPORT_RUN_OUTCOME_INVALID',
    );
    if (!expectedLanes.includes(run.lane)) {
      fail('QA_SITE_RUNTIME_REPORT_RUN_LANE_INVALID', `${index}:${run.lane || 'missing'}`);
    }
    const scenarioId = requireString(
      run.scenarioId,
      'QA_SITE_RUNTIME_REPORT_RUN_SCENARIO_INVALID',
    );
    const repeatIndex = requirePositiveInteger(
      run.repeatIndex,
      'QA_SITE_RUNTIME_REPORT_RUN_REPEAT_INVALID',
    );
    if (repeatIndex > expectedRepeat) {
      fail('QA_SITE_RUNTIME_REPORT_RUN_REPEAT_INVALID', repeatIndex);
    }
    const hasRepeatIsolationEvidence = isRecord(run.configuration)
      && Object.hasOwn(run.configuration, 'repeatIsolation');
    if (expectedRepeatIsolation === null && hasRepeatIsolationEvidence) {
      fail(
        'QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_UNEXPECTED',
        `${run.lane}:${scenarioId}:${repeatIndex}`,
      );
    }
    if (expectedRepeatIsolation !== null) {
      const evidence = requireRecord(
        run.configuration?.repeatIsolation,
        'QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_EVIDENCE_INVALID',
      );
      requireExactKeys(
        evidence,
        SITE_RUNTIME_REPEAT_ISOLATION_EVIDENCE_KEYS,
        'QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_EVIDENCE_INVALID',
      );
      if (
        evidence.version !== 1
        || evidence.mode !== expectedRepeatIsolation
        || evidence.epochOrdinal !== repeatIndex
        || !SHA256_SCALAR_PATTERN.test(evidence.browserEpochDigest || '')
        || !SHA256_SCALAR_PATTERN.test(evidence.profileEpochDigest || '')
        || evidence.browserProcessOwnership !== 'owned'
        || evidence.profileOwnership !== 'harness_disposable'
        || evidence.profileRetained !== false
        || evidence.temporaryExtensionRetained !== false
        || evidence.cleanupState !== 'completed'
      ) {
        fail(
          'QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_EVIDENCE_INVALID',
          `${run.lane}:${scenarioId}:${repeatIndex}`,
        );
      }
      const epochKey = `${run.lane}\u0000${repeatIndex}`;
      const priorEvidence = isolationEvidenceByEpoch.get(epochKey);
      if (priorEvidence) {
        if (
          priorEvidence.browserEpochDigest !== evidence.browserEpochDigest
          || priorEvidence.profileEpochDigest !== evidence.profileEpochDigest
        ) {
          fail(
            'QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_EVIDENCE_INVALID',
            `${run.lane}:${scenarioId}:${repeatIndex}:epoch_inconsistent`,
          );
        }
      } else {
        const priorBrowserEpoch = browserEpochOwners.get(evidence.browserEpochDigest);
        const priorProfileEpoch = profileEpochOwners.get(evidence.profileEpochDigest);
        if (
          (priorBrowserEpoch && priorBrowserEpoch !== epochKey)
          || (priorProfileEpoch && priorProfileEpoch !== epochKey)
        ) {
          fail(
            'QA_SITE_RUNTIME_REPORT_REPEAT_ISOLATION_EPOCH_REUSED',
            `${run.lane}:${scenarioId}:${repeatIndex}`,
          );
        }
        isolationEvidenceByEpoch.set(epochKey, evidence);
        browserEpochOwners.set(evidence.browserEpochDigest, epochKey);
        profileEpochOwners.set(evidence.profileEpochDigest, epochKey);
      }
    }
    if (reportAcceptance !== null) {
      if (run.siteId !== reportAcceptance.siteId) {
        failFeedConsumptionAcceptance(
          run,
          `siteId=${String(run.siteId)};expected=${reportAcceptance.siteId}`,
        );
      }
      if (scenarioId !== reportAcceptance.scenarioId) {
        failFeedConsumptionAcceptance(
          run,
          `scenarioId=${scenarioId};expected=${reportAcceptance.scenarioId}`,
        );
      }
    }
    const identity = `${run.lane}\u0000${scenarioId}\u0000${repeatIndex}`;
    if (identities.has(identity)) {
      fail('QA_SITE_RUNTIME_REPORT_RUN_DUPLICATE', `${run.lane}:${scenarioId}:${repeatIndex}`);
    }
    identities.add(identity);
    laneCoverage.add(run.lane);
    identitiesByLane.get(run.lane).add(`${scenarioId}\u0000${repeatIndex}`);
    outcomes.push(run.outcome);
  });
  const missingLanes = expectedLanes.filter((lane) => !laneCoverage.has(lane));
  if (missingLanes.length > 0) {
    fail('QA_SITE_RUNTIME_REPORT_LANE_COVERAGE_INVALID', missingLanes.join(','));
  }
  for (const [lane, laneIdentities] of identitiesByLane) {
    const scenarioIds = new Set(
      [...laneIdentities].map((identity) => identity.split('\u0000')[0]),
    );
    for (const scenarioId of scenarioIds) {
      for (let repeatIndex = 1; repeatIndex <= expectedRepeat; repeatIndex += 1) {
        if (!laneIdentities.has(`${scenarioId}\u0000${repeatIndex}`)) {
          fail(
            'QA_SITE_RUNTIME_REPORT_RUN_REPEAT_COVERAGE_INVALID',
            `${lane}:${scenarioId}:${repeatIndex}`,
          );
        }
      }
    }
  }
  const [referenceLane, ...comparedLanes] = expectedLanes;
  const referenceIdentities = [...identitiesByLane.get(referenceLane)].sort();
  for (const lane of comparedLanes) {
    if (!sameStringArray(
      [...identitiesByLane.get(lane)].sort(),
      referenceIdentities,
    )) {
      fail(
        'QA_SITE_RUNTIME_REPORT_LANE_COVERAGE_INVALID',
        `${referenceLane}:${lane}`,
      );
    }
  }
  if (
    reportAcceptance !== null
    && runs.length !== expectedLanes.length * expectedRepeat
  ) {
    fail(
      'QA_SITE_RUNTIME_ACCEPTANCE_GATE_FAILED',
      [
        reportAcceptance.kind,
        'coverage',
        `runCount=${runs.length};expected=${expectedLanes.length * expectedRepeat}`,
      ].join(':'),
    );
  }
  return Object.freeze({
    outcomes,
    releaseIdentities: identitiesByLane.get('release') || new Set(),
  });
}

function failFeedConsumptionAcceptance(run, detail) {
  fail(
    'QA_SITE_RUNTIME_ACCEPTANCE_GATE_FAILED',
    [
      FEED_CONSUMPTION_EXACT_MATCH_ACCEPTANCE_KIND,
      run.lane,
      run.scenarioId,
      run.repeatIndex,
      detail,
    ].join(':'),
  );
}

function validateFeedConsumptionExactMatchAcceptance(runs, acceptance, {
  expectedLanes,
  expectedRepeat,
}) {
  const minimumOpportunityCount = acceptance.minimumOpportunityCountPerRun;
  const insufficientRuns = [];
  for (const run of runs) {
    const contracts = Array.isArray(run.contracts) ? run.contracts : [];
    const matchingContracts = contracts.filter((contract) => (
      contract?.id === FEED_CONSUMPTION_EXACT_MATCH_CONTRACT_ID
    ));
    if (matchingContracts.length !== 1) {
      failFeedConsumptionAcceptance(
        run,
        `contractCount=${matchingContracts.length}`,
      );
    }
    const [contract] = matchingContracts;
    if (!isRecord(contract.evidence)) {
      failFeedConsumptionAcceptance(run, 'evidence=invalid');
    }
    if (contract.evidence.version !== 1) {
      failFeedConsumptionAcceptance(
        run,
        `evidenceVersion=${String(contract.evidence.version)}`,
      );
    }
    const measured = contract.status === SITE_RUN_OUTCOMES.PASS
      && contract.evidence.state === 'measured'
      && contract.evidence.reason === FEED_CONSUMPTION_MEASURED_REASON;
    const armedIdle = contract.status === SITE_RUN_OUTCOMES.WARN
      && run.outcome === SITE_RUN_OUTCOMES.WARN
      && contract.evidence.state === 'armed_idle'
      && contract.evidence.reason === FEED_CONSUMPTION_ARMED_IDLE_REASON;
    if (!measured && !armedIdle) {
      failFeedConsumptionAcceptance(
        run,
        [
          `contractStatus=${String(contract.status)}`,
          `runOutcome=${String(run.outcome)}`,
          `evidenceState=${String(contract.evidence.state)}`,
          `reason=${String(contract.evidence.reason)}`,
        ].join(';'),
      );
    }
    const counts = contract.evidence.counts;
    if (!isRecord(counts)) {
      failFeedConsumptionAcceptance(run, 'counts=invalid');
    }
    const countKeys = Object.keys(counts).sort();
    const expectedCountKeys = [...FEED_CONSUMPTION_EXACT_MATCH_COUNT_KEYS].sort();
    if (!sameStringArray(countKeys, expectedCountKeys)) {
      failFeedConsumptionAcceptance(
        run,
        `countKeys=${countKeys.join(',') || 'none'}`,
      );
    }
    for (const field of FEED_CONSUMPTION_EXACT_MATCH_INTEGER_COUNT_KEYS) {
      if (!Number.isSafeInteger(counts[field]) || counts[field] < 0) {
        failFeedConsumptionAcceptance(run, `${field}=${String(counts[field])}`);
      }
    }
    if (
      counts.opportunityCount
      !== counts.truePositiveCount + counts.falseNegativeCount
    ) {
      failFeedConsumptionAcceptance(run, 'opportunityConservation=mismatch');
    }
    if (
      counts.detectorEventCount
      !== counts.truePositiveCount + counts.falsePositiveCount + counts.duplicateCount
    ) {
      failFeedConsumptionAcceptance(run, 'detectorConservation=mismatch');
    }
    if (measured) {
      if (counts.opportunityCount < 1) {
        failFeedConsumptionAcceptance(run, 'opportunityCount=0');
      }
      for (const field of [
        'insufficientStepCount',
        'falseNegativeCount',
        'falsePositiveCount',
        'duplicateCount',
      ]) {
        if (counts[field] !== 0) {
          failFeedConsumptionAcceptance(run, `${field}=${String(counts[field])}`);
        }
      }
      for (const field of ['precision', 'recall']) {
        if (counts[field] !== 1) {
          failFeedConsumptionAcceptance(run, `${field}=${String(counts[field])}`);
        }
      }
    } else {
      for (const field of [
        'opportunityCount',
        'insufficientStepCount',
        'detectorEventCount',
        'truePositiveCount',
        'falseNegativeCount',
        'falsePositiveCount',
        'duplicateCount',
      ]) {
        if (counts[field] !== 0) {
          failFeedConsumptionAcceptance(run, `${field}=${String(counts[field])}`);
        }
      }
      if (counts.armedIdleCount < 1) {
        failFeedConsumptionAcceptance(
          run,
          `armedIdleCount=${String(counts.armedIdleCount)}`,
        );
      }
      for (const field of ['precision', 'recall']) {
        if (counts[field] !== null) {
          failFeedConsumptionAcceptance(run, `${field}=${String(counts[field])}`);
        }
      }
    }
    if (counts.opportunityCount < minimumOpportunityCount) {
      insufficientRuns.push(Object.freeze({
        lane: run.lane,
        scenarioId: run.scenarioId,
        repeatIndex: run.repeatIndex,
        evidenceState: contract.evidence.state,
        opportunityCount: counts.opportunityCount,
      }));
    }
  }
  const floorUnmet = insufficientRuns.length > 0;
  return Object.freeze({
    kind: FEED_CONSUMPTION_EXACT_MATCH_ACCEPTANCE_KIND,
    status: floorUnmet ? QA_RUN_STATUSES.INCONCLUSIVE : QA_RUN_STATUSES.PASS,
    code: floorUnmet
      ? 'QA_SITE_RUNTIME_ACCEPTANCE_OPPORTUNITY_FLOOR_UNMET'
      : null,
    siteId: acceptance.siteId,
    scenarioId: acceptance.scenarioId,
    lanes: Object.freeze([...expectedLanes]),
    repeat: expectedRepeat,
    runCount: runs.length,
    minimumOpportunityCountPerRun: minimumOpportunityCount,
    insufficientRuns: Object.freeze(insufficientRuns),
  });
}

function validateReportAcceptance(runs, acceptance, coverage) {
  if (acceptance === null) return null;
  return validateFeedConsumptionExactMatchAcceptance(runs, acceptance, coverage);
}

function validateReportControls(controls, {
  controlSummary,
  expectedLanes,
  expectedRepeat,
  releaseIdentities,
}) {
  if (!Array.isArray(controls)) {
    fail('QA_SITE_RUNTIME_REPORT_CONTROLS_INVALID');
  }
  if (controls.length > 0 && !expectedLanes.includes('release')) {
    fail('QA_SITE_RUNTIME_REPORT_CONTROL_RELEASE_LANE_REQUIRED');
  }
  const controlStates = new Set([
    'not_requested',
    'not_applicable',
    'unavailable',
    'measured',
    'partial',
  ]);
  if (!controlStates.has(controlSummary.state)) {
    fail(
      'QA_SITE_RUNTIME_REPORT_CONTROL_SUMMARY_STATE_INVALID',
      controlSummary.state || 'missing',
    );
  }
  const releaseRequested = expectedLanes.includes('release');
  if (
    (!releaseRequested && controlSummary.state !== 'not_requested')
    || (releaseRequested && controlSummary.state === 'not_requested')
  ) {
    fail('QA_SITE_RUNTIME_REPORT_CONTROL_SUMMARY_MISMATCH', controlSummary.state);
  }
  const expectedEmptyStates = new Set(['not_requested', 'not_applicable', 'unavailable']);
  if (
    (controls.length === 0 && !expectedEmptyStates.has(controlSummary.state))
    || (controls.length > 0 && !['measured', 'partial'].includes(controlSummary.state))
  ) {
    fail('QA_SITE_RUNTIME_REPORT_CONTROL_SUMMARY_MISMATCH', controlSummary.state);
  }
  const identities = new Set();
  const outcomes = controls.map((control, index) => {
    requireRecord(control, 'QA_SITE_RUNTIME_REPORT_CONTROL_INVALID');
    requireSiteRuntimeOutcome(
      control.outcome,
      'QA_SITE_RUNTIME_REPORT_CONTROL_OUTCOME_INVALID',
    );
    if (control.lane !== 'control' || control.runKind !== 'extension_disabled_control') {
      fail('QA_SITE_RUNTIME_REPORT_CONTROL_KIND_INVALID', index);
    }
    const scenarioId = requireString(
      control.scenarioId,
      'QA_SITE_RUNTIME_REPORT_CONTROL_SCENARIO_INVALID',
    );
    const repeatIndex = requirePositiveInteger(
      control.repeatIndex,
      'QA_SITE_RUNTIME_REPORT_CONTROL_REPEAT_INVALID',
    );
    if (repeatIndex > expectedRepeat) {
      fail('QA_SITE_RUNTIME_REPORT_CONTROL_REPEAT_INVALID', repeatIndex);
    }
    const identity = `${scenarioId}\u0000${repeatIndex}`;
    if (identities.has(identity)) {
      fail('QA_SITE_RUNTIME_REPORT_CONTROL_DUPLICATE', `${scenarioId}:${repeatIndex}`);
    }
    identities.add(identity);
    return control.outcome;
  });
  if (
    controls.length > 0
    && !sameStringArray([...identities].sort(), [...releaseIdentities].sort())
  ) {
    fail('QA_SITE_RUNTIME_REPORT_CONTROL_COVERAGE_INVALID');
  }
  return outcomes;
}

function validateReportShape(report, {
  reportRoot,
  reportDirectoryPath,
  expectedSuite,
  expectedLane,
  expectedRepeat,
  expectedMeasurementProfile,
  expectedSite = null,
  expectedFeatureGroup = null,
  expectedRepeatIsolation = null,
  reportAcceptance = undefined,
}) {
  requireRecord(report, 'QA_SITE_RUNTIME_REPORT_OBJECT_REQUIRED');
  requireExactKeys(
    report,
    SITE_RUNTIME_REPORT_KEYS,
    'QA_SITE_RUNTIME_REPORT_SHAPE_INVALID',
  );
  if (report.schemaVersion !== 1) {
    fail('QA_SITE_RUNTIME_REPORT_SCHEMA_INVALID', report.schemaVersion);
  }
  validateGeneratedAt(report.generatedAt);
  if (report.suite !== expectedSuite) {
    fail('QA_SITE_RUNTIME_REPORT_SUITE_MISMATCH', report.suite || 'missing');
  }
  const expectedLanes = expectedSiteRuntimeLanes(expectedLane);
  if (!sameStringArray(report.lanes, expectedLanes)) {
    fail('QA_SITE_RUNTIME_REPORT_LANES_MISMATCH');
  }
  requireSiteRuntimeOutcome(
    report.outcome,
    'QA_SITE_RUNTIME_REPORT_OUTCOME_INVALID',
  );
  const reportRepeat = validateReportOptions(report.options, {
    reportRoot,
    expectedSuite,
    expectedLane,
    expectedRepeat,
    expectedMeasurementProfile,
    expectedSite,
    expectedFeatureGroup,
    expectedRepeatIsolation,
  });
  const normalizedReportAcceptance = normalizeReportAcceptance(
    reportAcceptance,
    expectedSite,
  );
  if (
    typeof report.reportRoot !== 'string'
    || path.resolve(report.reportRoot) !== reportDirectoryPath
  ) {
    fail('QA_SITE_RUNTIME_REPORT_ROOT_OWNERSHIP_MISMATCH');
  }
  if (report.browser !== null) {
    requireRecord(report.browser, 'QA_SITE_RUNTIME_REPORT_BROWSER_INVALID');
  }
  [
    ['builds', 'QA_SITE_RUNTIME_REPORT_BUILDS_INVALID'],
    ['profile', 'QA_SITE_RUNTIME_REPORT_PROFILE_INVALID'],
    ['extensionDisabledControl', 'QA_SITE_RUNTIME_REPORT_CONTROL_SUMMARY_INVALID'],
    ['performanceBaselines', 'QA_SITE_RUNTIME_REPORT_BASELINES_INVALID'],
  ].forEach(([field, code]) => requireRecord(report[field], code));
  validateReportRepeatIsolationTopology(report, {
    expectedLanes,
    expectedRepeatIsolation,
  });
  [
    ['takeoverCheckpoints', 'QA_SITE_RUNTIME_REPORT_TAKEOVER_CHECKPOINTS_INVALID'],
    ['reproductionCommands', 'QA_SITE_RUNTIME_REPORT_REPRODUCTION_COMMANDS_INVALID'],
    ['scenarioComparisons', 'QA_SITE_RUNTIME_REPORT_SCENARIO_COMPARISONS_INVALID'],
  ].forEach(([field, code]) => {
    if (!Array.isArray(report[field])) fail(code);
  });
  if (!report.reproductionCommands.every((command) => (
    typeof command === 'string' && command.trim() === command && command.length > 0
  ))) {
    fail('QA_SITE_RUNTIME_REPORT_REPRODUCTION_COMMANDS_INVALID');
  }
  if (expectedRepeatIsolation !== null) {
    const repeatArgument = `--repeat=${reportRepeat}`;
    const isolationArgument = `--repeat-isolation=${expectedRepeatIsolation.replaceAll('_', '-')}`;
    if (
      report.reproductionCommands.length === 0
      || report.reproductionCommands.some((command) => {
        const args = command.split(/\s+/u);
        return !args.includes(repeatArgument) || !args.includes(isolationArgument);
      })
    ) {
      fail(
        'QA_SITE_RUNTIME_REPORT_REPRODUCTION_COMMANDS_INVALID',
        'repeat_isolation_contract',
      );
    }
  }
  const runEvidence = validateReportRuns(report.runs, {
    expectedLanes,
    expectedRepeat: reportRepeat,
    expectedRepeatIsolation,
    reportAcceptance: normalizedReportAcceptance,
  });
  const controlOutcomes = validateReportControls(report.controls, {
    controlSummary: report.extensionDisabledControl,
    expectedLanes,
    expectedRepeat: reportRepeat,
    releaseIdentities: runEvidence.releaseIdentities,
  });
  const recomputedOutcome = combineSiteRunOutcomes([
    ...runEvidence.outcomes,
    ...controlOutcomes,
  ]);
  if (report.outcome !== recomputedOutcome) {
    fail(
      'QA_SITE_RUNTIME_REPORT_OUTCOME_MISMATCH',
      `${recomputedOutcome}:${report.outcome}`,
    );
  }
  const acceptance = validateReportAcceptance(
    report.runs,
    normalizedReportAcceptance,
    {
      expectedLanes,
      expectedRepeat: reportRepeat,
    },
  );
  return Object.freeze({
    expectedLanes: Object.freeze([...expectedLanes]),
    runCount: report.runs.length,
    controlCount: report.controls.length,
    acceptance,
  });
}

function isReportBearingChildFailure(error) {
  return error?.code === undefined
    && Number.isSafeInteger(error?.exitCode)
    && error.exitCode > 0
    && error.signal === null
    && String(error?.message || '').startsWith('QA_CHILD_PROCESS_FAILED:');
}

export async function readSiteRuntimeProtocolReport({
  reportRoot,
  expectedSuite,
  expectedLane,
  expectedRepeat = null,
  expectedMeasurementProfile = undefined,
  expectedSite = null,
  expectedFeatureGroup = null,
  expectedRepeatIsolation = null,
  reportAcceptance = undefined,
}) {
  if (typeof reportRoot !== 'string' || reportRoot.trim().length === 0) {
    fail('QA_SITE_RUNTIME_REPORT_ROOT_REQUIRED');
  }
  const resolvedReportRoot = path.resolve(reportRoot);
  const reportRootStat = await requireLstat(resolvedReportRoot, {
    missingCode: 'QA_SITE_RUNTIME_REPORT_ROOT_MISSING',
    readCode: 'QA_SITE_RUNTIME_REPORT_ROOT_STAT_FAILED',
  });
  if (reportRootStat.isSymbolicLink()) {
    fail('QA_SITE_RUNTIME_REPORT_ROOT_INVALID', 'symlink');
  }
  if (!reportRootStat.isDirectory()) {
    fail('QA_SITE_RUNTIME_REPORT_ROOT_INVALID', 'not_directory');
  }
  let entries;
  try {
    entries = await fs.readdir(resolvedReportRoot, { withFileTypes: true });
  } catch (error) {
    fail(
      'QA_SITE_RUNTIME_REPORT_ROOT_READ_FAILED',
      error?.code || error?.name || 'unknown',
      error,
    );
  }
  if (entries.length !== 1) {
    fail('QA_SITE_RUNTIME_REPORT_DIRECTORY_COUNT_INVALID', entries.length);
  }
  const [reportDirectory] = entries;
  if (reportDirectory.isSymbolicLink() || !reportDirectory.isDirectory()) {
    fail(
      'QA_SITE_RUNTIME_REPORT_DIRECTORY_INVALID',
      reportDirectory.isSymbolicLink() ? 'symlink' : 'not_directory',
    );
  }
  const reportDirectoryPath = path.join(resolvedReportRoot, reportDirectory.name);
  const reportDirectoryStat = await requireLstat(reportDirectoryPath, {
    missingCode: 'QA_SITE_RUNTIME_REPORT_DIRECTORY_MISSING',
    readCode: 'QA_SITE_RUNTIME_REPORT_DIRECTORY_STAT_FAILED',
  });
  if (reportDirectoryStat.isSymbolicLink() || !reportDirectoryStat.isDirectory()) {
    fail('QA_SITE_RUNTIME_REPORT_DIRECTORY_INVALID');
  }
  const reportJsonPath = path.join(reportDirectoryPath, 'report.json');
  const reportStat = await requireLstat(reportJsonPath, {
    missingCode: 'QA_SITE_RUNTIME_REPORT_FILE_MISSING',
    readCode: 'QA_SITE_RUNTIME_REPORT_FILE_STAT_FAILED',
  });
  if (reportStat.isSymbolicLink()) {
    fail('QA_SITE_RUNTIME_REPORT_FILE_INVALID', 'symlink');
  }
  if (!reportStat.isFile()) {
    fail('QA_SITE_RUNTIME_REPORT_FILE_INVALID', 'not_file');
  }
  const report = await readReportJson(reportJsonPath);
  const evidence = validateReportShape(report, {
    reportRoot: resolvedReportRoot,
    reportDirectoryPath,
    expectedSuite,
    expectedLane,
    expectedRepeat,
    expectedMeasurementProfile,
    expectedSite,
    expectedFeatureGroup,
    expectedRepeatIsolation,
    reportAcceptance,
  });
  const suiteStatus = projectSiteRuntimeOutcome(report.outcome);
  const status = suiteStatus === QA_RUN_STATUSES.FAIL
    ? QA_RUN_STATUSES.FAIL
    : evidence.acceptance?.status === QA_RUN_STATUSES.INCONCLUSIVE
      ? QA_RUN_STATUSES.INCONCLUSIVE
      : suiteStatus;
  return Object.freeze({
    status,
    suiteOutcome: report.outcome,
    reportJsonPath,
    lanes: evidence.expectedLanes,
    runCount: evidence.runCount,
    controlCount: evidence.controlCount,
    ...(evidence.acceptance ? { acceptance: evidence.acceptance } : {}),
  });
}

export async function executeQaProtocol({
  plan,
  browser,
  attachmentsDir,
  runChild,
  readProtocolReport = readSiteRuntimeProtocolReport,
}) {
  if (plan.protocolOptions.artifactOwnership !== 'site_runtime_lane') {
    throw new Error('QA_SITE_RUNTIME_ARTIFACT_OWNERSHIP_INVALID');
  }
  if (browser?.processOwnership !== 'owned' || !browser.chrome) {
    throw new Error('QA_SITE_RUNTIME_OWNED_BROWSER_REQUIRED');
  }
  const invocation = resolveSiteRuntimeInvocation(plan);
  const reportRoot = path.join(attachmentsDir, 'site-runtime');
  const args = [
    path.join(plan.rootDir, 'scripts/e2e/siteRuntimeE2E.mjs'),
    `--suite=${plan.protocolOptions.suite}`,
    `--lane=${invocation.lane}`,
    `--repeat=${invocation.repeat}`,
    `--report-dir=${reportRoot}`,
    `--chrome=${browser.chrome}`,
    plan.browserExecution.headless === false ? '--headed' : '--headless',
  ];
  if (invocation.measurementProfile) {
    args.push(`--measurement-profile=${invocation.measurementProfile}`);
  }
  if (invocation.site) args.push(`--site=${invocation.site}`);
  if (invocation.featureGroup) args.push(`--feature-group=${invocation.featureGroup}`);
  if (invocation.profile) args.push(`--profile=${invocation.profile}`);
  if (invocation.repeatIsolation) {
    args.push(`--repeat-isolation=${invocation.repeatIsolation.replaceAll('_', '-')}`);
  }
  if (plan.parameters.rebuild !== true) {
    args.push('--no-build');
    if (invocation.lane === 'diagnostic' || invocation.lane === 'both') {
      args.push(`--diagnostic-dist=${plan.artifactPaths.devExtension}`);
    }
    if (invocation.lane === 'release' || invocation.lane === 'both') {
      args.push(`--release-dist=${plan.artifactPaths.publicExtension}`);
    }
  }
  let childFailure = null;
  try {
    await runChild({
      command: process.execPath,
      args,
      env: {
        ...process.env,
        ...browser.launchEnvironment,
        ...createBrowserExecutionEnvironment(plan.browserExecution),
        QA_BROWSER_RENDERING_REQUIREMENT: plan.browserExecution.renderingRequirement,
      },
    });
  } catch (error) {
    if (!isReportBearingChildFailure(error)) throw error;
    childFailure = error;
  }
  let reportResult;
  try {
    reportResult = await readProtocolReport({
      reportRoot,
      expectedSuite: plan.protocolOptions.suite,
      expectedLane: invocation.lane,
      expectedRepeat: invocation.repeat,
      expectedMeasurementProfile: invocation.measurementProfile,
      expectedSite: invocation.site,
      expectedFeatureGroup: invocation.featureGroup || null,
      expectedRepeatIsolation: invocation.repeatIsolation || null,
      reportAcceptance: plan.protocolOptions.reportAcceptance,
    });
  } catch (error) {
    if (
      !childFailure
      || error?.code === 'QA_SITE_RUNTIME_ACCEPTANCE_GATE_FAILED'
    ) {
      throw error;
    }
    throw createFailure(
      'QA_SITE_RUNTIME_CHILD_REPORT_REQUIRED_AFTER_NONZERO',
      `${childFailure.exitCode}:${error?.code || error?.name || 'unknown'}`,
      error,
    );
  }
  const childExitCode = childFailure?.exitCode || 0;
  if (
    (childExitCode === 0 && reportResult.suiteOutcome === SITE_RUN_OUTCOMES.FAIL)
    || (childExitCode !== 0 && (
      childExitCode !== 1
      || reportResult.suiteOutcome !== SITE_RUN_OUTCOMES.FAIL
    ))
  ) {
    fail(
      'QA_SITE_RUNTIME_CHILD_EXIT_OUTCOME_MISMATCH',
      `${childExitCode}:${reportResult.suiteOutcome || 'missing'}`,
      childFailure,
    );
  }
  return Object.freeze({
    status: reportResult.status,
    protocol: 'site_runtime',
    suite: plan.protocolOptions.suite,
    lane: invocation.lane,
    measurementProfile: invocation.measurementProfile,
    site: invocation.site,
    featureGroup: invocation.featureGroup || null,
    repeat: invocation.repeat,
    repeatIsolation: invocation.repeatIsolation || null,
    suiteOutcome: reportResult.suiteOutcome,
    childExitCode,
    runCount: reportResult.runCount,
    controlCount: reportResult.controlCount,
    ...(reportResult.acceptance ? { acceptance: reportResult.acceptance } : {}),
    artifactOwnership: plan.protocolOptions.artifactOwnership,
    reportRoot,
    reportJsonPath: reportResult.reportJsonPath,
  });
}
