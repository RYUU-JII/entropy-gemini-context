#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const sitePullRoot = path.resolve(rootDir, 'src/domains/stats/insights/sitePull');
const patternRoot = path.resolve(rootDir, 'src/domains/stats/insights/sitePull/patterns');
const detectorRoot = path.join(patternRoot, 'detectors');
const boundaryMapPath = 'docs/architecture/repository/site-pull-pattern-boundary-map.md';
const label = 'site-pull-pattern-architecture';
const forbiddenRuntimeBoundaryTokens = [
  'platform/storage',
  'dbManager',
  'runtimeSendMessage',
  'chrome.',
  'localStorage',
  'sessionStorage',
  'indexedDB',
];

function fail(message) {
  console.error(`[${label}] FAIL: ${message}`);
  process.exit(1);
}

async function readFile(relativePath) {
  return fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
}

async function listJsFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractCreatedPatternIds(source) {
  return [...source.matchAll(/\bid\s*:\s*['"]([^'"]+)['"]/gu)]
    .map((match) => match[1]);
}

function unique(values) {
  return [...new Set(values)];
}

async function importSitePullIndex() {
  const moduleUrl = pathToFileURL(path.resolve(
    rootDir,
    'src/domains/stats/insights/sitePull/index.js',
  )).href;
  return import(moduleUrl);
}

async function assertNoDetectorCompositeEmit(compositeIds) {
  const detectorFiles = await listJsFiles(detectorRoot);
  for (const filePath of detectorFiles) {
    const relativePath = path.relative(rootDir, filePath);
    const source = await fs.readFile(filePath, 'utf8');
    const emittedIds = unique(extractCreatedPatternIds(source));
    for (const id of emittedIds) {
      if (compositeIds.has(id)) {
        fail(`${relativePath} must not emit composite pattern "${id}" directly; use sitePullPatternComposer.js.`);
      }
    }
  }
}

async function assertNoRuntimeBoundaryAccess() {
  const files = await listJsFiles(sitePullRoot);
  for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath);
    const source = await fs.readFile(filePath, 'utf8');
    for (const token of forbiddenRuntimeBoundaryTokens) {
      if (source.includes(token)) {
        fail(`${relativePath} must stay pure over site-pull facts and must not access runtime/storage boundary token "${token}".`);
      }
    }
  }
}

async function assertNoFeedDecisionEvidence() {
  const interpretationFiles = await listJsFiles(path.resolve(rootDir, 'src/domains/stats/insights'));
  for (const filePath of interpretationFiles) {
    const source = await fs.readFile(filePath, 'utf8');
    for (const field of ['feedPressureSignals', 'feedInterruptSignals']) {
      if (source.includes(field)) {
        fail(`${path.relative(rootDir, filePath)} must not read feed detector decision ${field} as behavioral evidence; retain it only in historical facts.`);
      }
    }
  }
  const contentProfilePath = 'src/domains/stats/insights/sitePull/patterns/sitePullContentFlowEvidenceProfile.js';
  const source = await readFile(contentProfilePath);
  assertIncludes(source, 'corroboratingEvidenceFamilyCount >= 2', contentProfilePath);
  ['strongSupplyAlone', 'channelConfirmationScore', 'loopChannelCount'].forEach((token) => {
    assertExcludes(source, token, contentProfilePath);
  });
}

async function assertAnalysisInputDirection() {
  const insightRoot = path.resolve(rootDir, 'src/domains/stats/insights');
  const files = await listJsFiles(insightRoot);
  const graph = new Map();
  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    const imports = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/gu)]
      .map((match) => match[1]).filter((entry) => entry.startsWith('.') || entry.startsWith('@/'))
      .map((entry) => entry.startsWith('@/')
        ? path.resolve(rootDir, 'src', entry.slice(2))
        : path.resolve(path.dirname(file), entry));
    graph.set(file, imports);
  }
  const finalNames = new Set([
    'computeSitePullProfile.js', 'buildSiteInsightModel.js', 'synthesizeSiteInsight.js',
    'sitePullInterpretation.js', 'sitePullInterpretationEvidence.js', 'sitePullPatternLayers.js', 'sitePullPatternComposer.js',
    'sitePullPatternPresenter.js', 'sitePullFeedbackSurfacePresenter.js',
  ]);
  const upstream = files.filter((file) => /(?:[\\/]features[\\/]|[\\/]scoring[\\/]|[\\/]detectors[\\/]|[\\/]personalBaseline[^\\/]*\.js$|[\\/]buildSitePullFacts\.js$|[\\/]sitePullFactSummaries\.js$|[\\/]temporalEvidence\.js$|EvidenceProfile\.js$)/u.test(file));
  for (const source of upstream) {
    const visit = (file, chain, seen) => {
      if (seen.has(file)) return;
      seen.add(file);
      if (file !== source && finalNames.has(path.basename(file))) {
        fail(`interpretation feedback dependency: ${[...chain, file].map((item) => path.relative(rootDir, item)).join(' -> ')}`);
      }
      for (const dependency of graph.get(file) || []) visit(dependency, [...chain, file], seen);
    };
    visit(source, [], new Set());
  }
  const factsPath = 'src/domains/stats/insights/sitePull/buildSitePullFacts.js';
  const factsSource = await readFile(factsPath);
  assertIncludes(factsSource, 'assertSiteAnalysisSourceInput', factsPath);
  assertIncludes(factsSource, 'SITE_PULL_FACTS_REDUNDANT_FEATURE_VECTOR', factsPath);
  assertExcludes(factsSource, 'facts.featureVector', factsPath);
  for (const inputPath of [
    'src/domains/stats/insights/features/buildSiteFeatureVector.js',
    'src/domains/stats/insights/buildSiteInsightModel.js',
  ]) assertIncludes(await readFile(inputPath), 'assertSiteAnalysisSourceInput', inputPath);
  const goalPath = 'src/domains/stats/insights/contracts/siteGoalContext.js';
  assertIncludes(await readFile(goalPath), 'SITE_GOAL_METRICS_RELATION_INVALID', goalPath);
  const zenPath = 'src/themes/plugins/zen/widgets/sites/ZenTargetPanel.jsx';
  const zenSource = await readFile(zenPath);
  assertIncludes(zenSource, 'SiteDecisionWorkspace', zenPath);
  assertExcludes(zenSource, 'OBSERVATION_PATTERN_EXCLUSIONS', zenPath);
  const presentationPath = 'src/themes/core/widgets/shared/sites/siteIntelPresentation.js';
  const presentationSource = await readFile(presentationPath);
  for (const token of ['requireSitePullInterpretation', 'reading.primaryEvidence', 'expandedSurfaceItemIds']) {
    assertIncludes(presentationSource, token, presentationPath);
  }
  for (const token of ['computeSitePullProfile', 'buildSiteFeatureVector', 'recommendedNudge', 'contributionBreakdown']) {
    assertExcludes(presentationSource, token, presentationPath);
  }
  const uiPath = 'src/themes/core/widgets/shared/sites/TargetBehaviorProfile.js';
  const uiSource = await readFile(uiPath);
  assertIncludes(uiSource, 'requireSitePullInterpretation', uiPath);
  for (const token of ['function pickHeadline', 'confidence_fallback', 'score >= 75', 'TARGET_BEHAVIOR_HEADLINE_COPY_BY_PATTERN', 'function evidenceChip', 'evidenceSurfaceItemIds.map']) {
    assertExcludes(uiSource, token, uiPath);
  }
  const readingPath = 'src/domains/stats/insights/sitePull/sitePullInterpretation.js';
  const reading = await readFile(readingPath);
  ['primaryEvidenceIds', 'SITE_PULL_READING_PROVENANCE_INVALID', 'policySurfaceItemIds', 'claim_metrics_unavailable']
    .forEach((token) => assertIncludes(reading, token, readingPath));
}

function assertIncludes(source, token, filePath) {
  if (!source.includes(token)) {
    fail(`${filePath} must include site-pull architecture token: ${token}`);
  }
}

function assertExcludes(source, token, filePath) {
  if (source.includes(token)) {
    fail(`${filePath} must not include site-pull architecture token: ${token}`);
  }
}

function assertFunctionSourceExcludes(source, functionName, tokens, filePath) {
  const marker = `function ${functionName}(`;
  const start = source.indexOf(marker);
  if (start < 0) {
    fail(`${filePath} must include site-pull architecture function: ${functionName}`);
  }
  const candidates = [
    source.indexOf('\nfunction ', start + marker.length),
    source.indexOf('\nexport function ', start + marker.length),
  ].filter((index) => index >= 0);
  const nextFunction = candidates.length > 0 ? Math.min(...candidates) : -1;
  const functionSource = source.slice(start, nextFunction >= 0 ? nextFunction : source.length);
  tokens.forEach((token) => {
    if (functionSource.includes(token)) {
      fail(`${filePath} function ${functionName} must not include site-pull architecture token: ${token}`);
    }
  });
}

function assertOrdered(source, tokens, filePath) {
  let cursor = 0;
  for (const token of tokens) {
    const index = source.indexOf(token, cursor);
    if (index < 0) {
      fail(`${filePath} must preserve site-pull architecture order; missing token: ${token}`);
    }
    cursor = index + token.length;
  }
}

async function assertFactSummaryOwnership() {
  const featureVectorPath = 'src/domains/stats/insights/features/buildSiteFeatureVector.js';
  const factsPath = 'src/domains/stats/insights/sitePull/buildSitePullFacts.js';
  const profilePath = 'src/domains/stats/insights/sitePull/computeSitePullProfile.js';
  const summaryPath = 'src/domains/stats/insights/sitePull/sitePullFactSummaries.js';
  const featureVectorSource = await readFile(featureVectorPath);
  const factsSource = await readFile(factsPath);
  const profileSource = await readFile(profilePath);
  const summarySource = await readFile(summaryPath);

  [
    "from '../sitePull/baselineSeriesSource.js'",
    'normalizeSitePullBaselineSeriesSource(intel || {}, {',
    'baselineCurrentDateStr: baselineSource.currentDateStr,',
    'const todayTotalSource = intel?.todayTotal;',
    'const todayVisitsSource = intel?.todayVisits;',
    'const weeklyVisitsSource = intel?.weeklyVisits;',
    'const weeklySessionStatsSource = intel?.weeklySessionStats;',
    'const weeklyBehaviorStatsSource = intel?.weeklyBehaviorStats;',
    'const weeklyInterventionStatsSource = intel?.weeklyInterventionStats;',
    'const weeklyNavigationStatsSource = intel?.weeklyNavigationStats;',
    'const todayObserved = intel.todayObserved;',
    'SITE_FEATURE_VECTOR_TODAY_OBSERVED_INVALID',
  ].forEach((token) => assertIncludes(featureVectorSource, token, featureVectorPath));

  [
    'SITE_FEATURE_VECTOR_INPUT_ALIASES',
    'function readIntelField',
    'intel?.baselineSeries || intel?.personalBaselineSeries',
    'toNumber(intel?.totalMs)',
    'Math.floor(toNumber(intel?.visits))',
    'Math.floor(toNumber(intel?.weeklyVisits))',
    'intel?.weeklySessionStats || {',
    'intel?.weeklyBehaviorStats || {',
    'intel?.weeklyInterventionStats || {',
    'intel?.weeklyNavigationStats || {',
    'intel?.todayHourlyVisits || intel?.hourlyVisits',
    'intel?.todaySessionStats || intel?.sessionStats',
    'intel?.todayBehaviorStats || intel?.behaviorStats',
    'intel?.todayInterventionStats || intel?.interventionStats',
    'intel?.todayNavigationStats || intel?.navigationStats',
  ].forEach((token) => assertExcludes(featureVectorSource, token, featureVectorPath));

  [
    'SITE_PULL_FACTS_INPUT_AUTHORITY_CONFLICT',
    'SITE_PULL_FACTS_INPUT_INVALID',
    'SITE_PULL_FACTS_PUBLIC_INPUT_INVALID',
    'SITE_PULL_FACTS_BUILD_INPUT_MISSING',
    'SITE_PULL_FACTS_FEATURE_VECTOR_INPUT_INVALID',
    'export function assertSitePullFactsInputAuthority',
    'function assertSitePullFactBuildInput',
    'function hasOwn',
    "from './baselineSeriesSource.js'",
    'normalizeSitePullBaselineSeriesSource(usage, {',
    'normalizeSitePullBaselineSeriesSource(resolvedFeatureVector, {',
    'baselineCurrentDateStr: baselineSource.currentDateStr,',
    'const goalMetrics = requireSiteGoalMetrics(goal);',
    "const entryTodayVisitsSource = hasOwn(entry, 'todayVisits') ? entry.todayVisits : undefined;",
    "const entryWeeklyVisitsSource = hasOwn(entry, 'weeklyVisits') ? entry.weeklyVisits : undefined;",
    "const featureTodayVisitsSource = hasOwn(resolvedFeatureVector, 'todayVisits')",
    "const featureWeeklyVisitsSource = hasOwn(resolvedFeatureVector, 'weeklyVisits')",
    "from './sitePullFactSummaries.js'",
    'buildSessionSummary',
    'buildBehaviorSummary',
    'buildInterventionSummary',
    'buildNavigationSummary',
    'buildTransitionEdgeSummary',
    'SITE_PULL_TODAY_OBSERVED_INVALID',
    'SITE_PULL_TODAY_OBSERVED_RELATION_INVALID',
    'requireTodayObservationRelation',
  ].forEach((token) => assertIncludes(factsSource, token, factsPath));

  [
    "if (!facts || typeof facts !== 'object') return null;",
    'usage.baselineSeries || weeklySeries',
    'resolvedFeatureVector.baselineSeries || weeklySeries',
    'baselineSeries.length > 0 ? baselineSeries : weeklySeries',
    'toNumber(goal.goalMs) || goalMinutes * MINUTE_MS',
    'Math.floor(toNumber(entry.todayVisits)),\n    sumVisits(todayHourlyVisits),',
    'Math.max(Math.floor(toNumber(entry.weeklyVisits)), todayVisits)',
    'Math.floor(toNumber(resolvedFeatureVector.todayVisits)),\n    sumVisits(todayHourlyVisits),',
    'Math.max(Math.floor(toNumber(resolvedFeatureVector.weeklyVisits)), todayVisits)',
    'facts || buildSitePullFacts',
    'hasBaselineFacts',
    'STATS_REENTRY_GAP_BUCKET_KEYS',
    'function buildSessionSummary',
    'function normalizeBehaviorStats',
    'function normalizeInterventionEffectSummary',
    'function buildTransitionEdgeSummary',
    'effectCountersToInterventionStats',
  ].forEach((token) => assertExcludes(factsSource, token, factsPath));

  [
    'assertSitePullFactsInputAuthority',
    'function resolveSitePullProfileFacts',
    'const sitePullFacts = resolveSitePullProfileFacts',
    'const resolvedFeatureVector = resolveSitePullFeatureVector({',
  ].forEach((token) => assertIncludes(profileSource, token, profilePath));

  [
    'const sitePullFacts = facts || buildSitePullFacts',
    'facts: sitePullFacts,\n    intel,\n    featureVector,',
    'sitePullAggregateAnalysis',
  ].forEach((token) => assertExcludes(profileSource, token, profilePath));

  [
    'export function buildSessionSummary',
    'export function buildBehaviorSummary',
    'export function buildInterventionSummary',
    'export function buildNavigationSummary',
    'export function buildTransitionEdgeSummary',
    'export function normalizeWeeklySeries',
  ].forEach((token) => assertIncludes(summarySource, token, summaryPath));

  [
    'export function buildSitePullFacts',
    'export function buildFeatureVectorFromSitePullFacts',
    'buildPersonalBaseline',
    'buildSitePullTemporalEvidence',
    'toPublicPersonalBaseline',
  ].forEach((token) => assertExcludes(summarySource, token, summaryPath));
}

async function assertBaselineSeriesSourceContract() {
  const baselineSourcePath = 'src/domains/stats/insights/sitePull/baselineSeriesSource.js';
  const featureVectorPath = 'src/domains/stats/insights/features/buildSiteFeatureVector.js';
  const factsPath = 'src/domains/stats/insights/sitePull/buildSitePullFacts.js';
  const personalBaselinePath = 'src/domains/stats/insights/sitePull/personalBaseline.js';
  const querySharedPath = 'src/domains/stats/background/query/statsAnalysisQueryShared.js';
  const projectionHelperPath = 'src/domains/stats/background/query/statsSiteIntelReadModelHelpers.js';
  const detailReadModelPath = 'src/domains/stats/background/query/statsSitesSiteDetailReadModel.js';
  const detailQueryPath = 'src/domains/stats/background/query/statsSitesSiteDetailQueryService.js';
  const evidenceQueryPath = 'src/domains/stats/background/query/statsSitesEvidenceQuery.js';
  const statusReadModelPath = 'src/domains/stats/background/query/statsStatusSnapshotReadModel.js';
  const sources = Object.fromEntries(await Promise.all([
    baselineSourcePath,
    featureVectorPath,
    factsPath,
    personalBaselinePath,
    querySharedPath,
    projectionHelperPath,
    detailReadModelPath,
    detailQueryPath,
    evidenceQueryPath,
    statusReadModelPath,
  ].map(async (filePath) => [filePath, await readFile(filePath)])));

  [
    'SITE_PULL_BASELINE_SOURCE_TARGET_DAYS',
    "if (!hasOwn(source, 'baselineSeries'))",
    "if (!hasOwn(source, 'baselineCurrentDateStr'))",
    'SITE_PULL_BASELINE_SERIES_MISSING',
    'SITE_PULL_BASELINE_CURRENT_DATE_MISSING',
    'SITE_PULL_BASELINE_SERIES_LENGTH_INVALID',
    'SITE_PULL_BASELINE_DATE_RANGE_INVALID',
    'SITE_PULL_BASELINE_OBSERVED_INVALID',
    'SITE_PULL_BASELINE_MISSING_ACTIVE_MS_INVALID',
    'shiftDateStr(',
    "windowBasis: 'completed_calendar_day'",
    'excludeCurrent: true',
    'activeMs: entry.observed ? entry.activeMs : null',
  ].forEach((token) => assertIncludes(sources[baselineSourcePath], token, baselineSourcePath));

  [
    'weeklySeries.at(-1)',
    'baselineSeries || weeklySeries',
    'baselineSeries ?? weeklySeries',
    'baselineSeries.length > 0 ? baselineSeries : weeklySeries',
  ].forEach((token) => {
    assertExcludes(sources[featureVectorPath], token, featureVectorPath);
    assertExcludes(sources[factsPath], token, factsPath);
    assertExcludes(sources[personalBaselinePath], token, personalBaselinePath);
  });

  [
    'SITE_PULL_BASELINE_DAYS = SITE_PULL_BASELINE_SOURCE_TARGET_DAYS',
    'SITE_PULL_BASELINE_READ_DAYS = SITE_PULL_BASELINE_DAYS + 1',
  ].forEach((token) => assertIncludes(sources[querySharedPath], token, querySharedPath));

  [
    'export function buildSitePullBaselineProjectionSeries',
    "typeof projection.hasStatsDay !== 'boolean'",
    'activeMs: entry.observed ? entry.activeMs : null',
    'normalizeSitePullBaselineSeriesSource({',
    'const collectionObservation = domainEntry?.collectionObservation',
    'observed: collectionObservation.observed',
  ].forEach((token) => assertIncludes(sources[projectionHelperPath], token, projectionHelperPath));

  [
    'const currentDateStr = getLocalDateStr(now);',
    'getRecentDateStrings(SITE_PULL_BASELINE_READ_DAYS, now)',
    'baselineSourceDates.slice(0, SITE_PULL_BASELINE_DAYS)',
    'Array.from(new Set([...baselineDates, ...weeklyDates]))',
    'baselineDates,',
    'baselineDayProjections,',
    'currentDateStr,',
  ].forEach((token) => assertIncludes(sources[detailReadModelPath], token, detailReadModelPath));

  [
    'resolveStatsDaysBack(SITE_PULL_BASELINE_READ_DAYS',
    'STATS_SITES_SITE_DETAIL_BASELINE_READ_SPAN_UNAVAILABLE',
  ].forEach((token) => assertIncludes(sources[detailQueryPath], token, detailQueryPath));
  assertIncludes(
    sources[evidenceQueryPath],
    'getRecentDateStrings(SITE_PULL_BASELINE_READ_DAYS, now)',
    evidenceQueryPath,
  );
  [
    'hasStatsDay: statsDateSet.has(dateStr)',
    'weeklyDayProjections,',
  ].forEach((token) => assertIncludes(sources[statusReadModelPath], token, statusReadModelPath));
}

async function assertTemporalEvidenceSourceContract() {
  const temporalPath = 'src/domains/stats/insights/sitePull/temporalEvidence.js';
  const factsPath = 'src/domains/stats/insights/sitePull/buildSitePullFacts.js';
  const profilePath = 'src/domains/stats/insights/sitePull/computeSitePullProfile.js';
  const temporalSource = await readFile(temporalPath);
  const factsSource = await readFile(factsPath);
  const profileSource = await readFile(profilePath);

  [
    "SITE_PULL_TEMPORAL_EVIDENCE_VERSION = 'site-pull-temporal-evidence-v2'",
    'SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODES',
    'SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODE_INVALID',
    'SITE_PULL_TEMPORAL_EVIDENCE_FACT_FAMILY_MISSING',
    'SITE_PULL_TEMPORAL_EVIDENCE_FACT_FAMILY_INVALID',
    'function resolveTemporalEvidenceFactSource',
    'function resolveTodayFactFamily',
    'function entryVisitCount(source)',
    'function buildTodayContext',
    "basis: 'current_domain_temporal_facts'",
    'today: buildTodayContext(featureVector, entryVisitSummary)',
    'buildReentryIntervalProfile(factSource)',
    'buildBackgroundResidencyProfile(featureVector, factSource)',
    'buildTabBurstProfile(factSource)',
    'buildInDomainNavigationDensity(featureVector, factSource)',
    'buildCyclePositionProxy(featureVector)',
    'factProfileMethod:',
  ].forEach((token) => assertIncludes(temporalSource, token, temporalPath));

  [
    'facts?.behavior || featureVector?.todayBehaviorStats',
    'facts?.navigation || featureVector?.todayNavigationStats',
    'facts?.entry || featureVector?.todayEntryStats',
    'trendRatio: roundNumber(toNumber(featureVector?.trendRatio) || 1)',
    "if (personalBaseline && typeof personalBaseline === 'object')",
    'personalBaseline.observedDays',
    'personalBaseline.activeDays',
    'personalBaseline.medianDailyMs',
    'personalBaseline.p75DailyMs',
    'personalBaseline.p90DailyMs',
    'personalBaseline.madMs',
    'personalBaseline.totalBaselineMs',
    'personalBaseline.policyVersion ||',
    'personalBaseline.status ||',
    "requirePersonalBaselineString(personalBaseline, 'policyVersion')",
    "requirePersonalBaselineString(personalBaseline, 'status')",
    'personalBaseline.adaptiveReference?.referenceMs',
    'personalBaseline.recentTrajectory?.state',
    'resolveSitePullPersonalBaselinePolicyContext',
    "from './personalBaselineMetrics.js'",
    'buildPersonalBaselineWindow',
    'requireTemporalPersonalBaseline',
    'SITE_PULL_TEMPORAL_PERSONAL_BASELINE_MISSING',
    'getSitePullPersonalBaselineMetric',
    'weighted7d',
    'recent3d',
    'recent7d',
    'baseline30d',
    'weightedTrendRatio',
    'todayVsWeighted7d',
    'robustZ',
    'comparison:',
  ].forEach((token) => assertExcludes(temporalSource, token, temporalPath));

  [
    'buildReentryIntervalProfile',
    'buildTabBurstProfile',
  ].forEach((functionName) => {
    assertFunctionSourceExcludes(temporalSource, functionName, ['featureVector'], temporalPath);
  });

  assertFunctionSourceExcludes(temporalSource, 'buildTodayContext', [
    'featureVector?.todayVisits',
    'featureVector?.todayHourlyVisits',
  ], temporalPath);
  [
    'sumVisits(featureVector?.todayHourlyVisits)',
    'countVisitHours(featureVector?.todayHourlyVisits)',
  ].forEach((token) => assertExcludes(temporalSource, token, temporalPath));

  [
    'buildSitePullTemporalEvidence(sitePullFeatureVector',
    'sourceMode: SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODES.FACT_DRAFT',
  ].forEach((token) => assertIncludes(factsSource, token, factsPath));
  assertExcludes(
    factsSource,
    'personalBaseline,\n    sourceMode: SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODES.FACT_DRAFT',
    factsPath,
  );

  [
    'requireSitePullProfileFactsObject',
    'const personalBaseline = toPublicPersonalBaseline(',
    "requireSitePullProfileFactsObject(sitePullFacts, 'personalBaseline')",
    "requireSitePullProfileFactsObject(sitePullFacts, 'temporalEvidence')",
    'const validatedSitePullFacts = {',
    'facts: validatedSitePullFacts',
  ].forEach((token) => assertIncludes(profileSource, token, profilePath));
  assertOrdered(profileSource, [
    'const personalBaseline = toPublicPersonalBaseline(',
    'const validatedSitePullFacts = {',
    'const resolvedFeatureVector = resolveSitePullFeatureVector({',
    'const subscores01 = computeSubscores(',
    'const patternLayers = buildPatternLayers(',
  ], profilePath);

  [
    'buildPersonalBaseline(resolvedFeatureVector)',
    'buildSitePullTemporalEvidence(resolvedFeatureVector',
    'sourceMode: SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODES.FACTS',
    'SITE_PULL_PROFILE_TEMPORAL_BASELINE_SOURCE_INVALID',
    'temporalEvidence?.windows',
    'facts: sitePullFacts,\n  });',
  ].forEach((token) => assertExcludes(profileSource, token, profilePath));
}

async function assertWeeklyObservationContract() {
  const contractPath = 'src/domains/stats/insights/contracts/weeklyObservationContract.js';
  const featurePath = 'src/domains/stats/insights/features/buildSiteFeatureVector.js';
  const factsPath = 'src/domains/stats/insights/sitePull/buildSitePullFacts.js';
  const summariesPath = 'src/domains/stats/insights/sitePull/sitePullFactSummaries.js';
  const scorePath = 'src/domains/stats/insights/sitePull/scoring/sitePullScoreModel.js';
  const requirementsPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternRequirements.js';
  const diagnosticsPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternDiagnostics.js';
  const habitPath = 'src/domains/stats/insights/sitePull/patterns/sitePullHabitConsistencyEvidenceProfile.js';
  const targetPanelPath = 'src/apps/dashboard/tabs/sites/presentation/targetPanelViewModel.js';
  const workspacePath = 'src/themes/core/widgets/shared/sites/SiteDecisionWorkspace.jsx';
  const siteIntelPath = 'src/domains/stats/background/query/statsSiteIntelReadModel.js';
  const contractSource = await readFile(contractPath);
  const featureSource = await readFile(featurePath);
  const factsSource = await readFile(factsPath);
  const summariesSource = await readFile(summariesPath);
  const scoreSource = await readFile(scorePath);
  const requirementsSource = await readFile(requirementsPath);
  const diagnosticsSource = await readFile(diagnosticsPath);
  const habitSource = await readFile(habitPath);
  const targetPanelSource = await readFile(targetPanelPath);
  const workspaceSource = await readFile(workspacePath);
  const siteIntelSource = await readFile(siteIntelPath);

  [
    'requireWeeklyObservationState',
    'selectObservedWeeklyEntries',
    'countObservedWeeklyEntries',
    'countTrailingObservedActiveDays',
    'deriveWeeklyObservationSummary',
    'SITE_WEEKLY_OBSERVATION_SERIES_INVALID',
    'SITE_WEEKLY_OBSERVATION_STATE_MISSING',
    'SITE_WEEKLY_OBSERVATION_STATE_INVALID',
    'SITE_WEEKLY_ACTIVE_MS_INVALID',
    'SITE_WEEKLY_OVER_LIMIT_STATE_INVALID',
    "typeof entry.observed !== 'boolean'",
  ].forEach((token) => assertIncludes(contractSource, token, contractPath));

  [
    'const weeklySeries = normalizeWeeklySeries(intel?.weeklySeries);',
    'const weeklyObservationSummary = deriveWeeklyObservationSummary(weeklySeries',
    'const observedWeeklySeries = weeklyObservationSummary.observedEntries;',
    'observedWeeklyDays: weeklyObservationSummary.observedDays',
    'streakDays: weeklyObservationSummary.streakDays',
    'requireWeeklyObservationState(entry, index',
  ].forEach((token) => assertIncludes(featureSource, token, featurePath));
  [
    'weeklyTotal = weeklySeries.reduce',
    'weeklyAverageMs = weeklySeries.length',
    'observedWeeklyDays: weeklySeries.length',
    'hasWeeklyHistory: weeklySeries.some',
    'historyDays: weeklySeries.filter',
  ].forEach((token) => assertExcludes(featureSource, token, featurePath));
  [
    'deriveWeeklyObservationSummary',
    'const weeklyObservationSummary = deriveWeeklyObservationSummary(weeklySeries',
    'observedWeeklyDays',
    'SITE_PULL_WEEKLY_USAGE_RELATION_INVALID',
    'SITE_PULL_WEEKLY_COVERAGE_RELATION_INVALID',
    'requireWeeklyUsageRelation',
    'requireWeeklyCoverageRelation',
    'const streakDays = weeklyObservationSummary.streakDays;',
    'hasWeeklyFacts: observedWeeklyDays > 0',
    'buildFeatureVectorFromSitePullFacts(publicFacts);',
  ].forEach((token) => assertIncludes(factsSource, token, factsPath));
  [
    'const weeklyTotal = observedWeeklySeries.reduce',
    'observedWeeklyDays: observedWeeklySeries.length',
    'activeDays: observedWeeklySeries.filter',
    'countTrailingObservedActiveDays(weeklySeries',
    'overLimitDays: observedWeeklySeries.filter',
  ].forEach((token) => {
    assertExcludes(featureSource, token, featurePath);
    assertExcludes(factsSource, token, factsPath);
  });
  [
    'requireWeeklyObservationState(entry, index',
  ].forEach((token) => assertIncludes(summariesSource, token, summariesPath));
  [
    'selectObservedWeeklyEntries',
    'computePlanFriction(featureVector, observedWeeklySeries)',
    'computeCheckingLoopProxy(featureVector, observedWeeklySeries)',
    'const dailyValues = observedWeeklySeries',
    'const weeklyDayCount = selectObservedWeeklyEntries',
    'weeklyDayCount >= 5',
  ].forEach((token) => assertIncludes(scoreSource, token, scorePath));
  [
    'countObservedWeeklyEntries',
  ].forEach((token) => {
    assertIncludes(requirementsSource, token, requirementsPath);
    assertIncludes(diagnosticsSource, token, diagnosticsPath);
  });
  [
    'selectObservedWeeklyEntries(weeklyCalendarEntries',
    'const activeDays = countActiveDays(weeklyEntries);',
    'const weeklyTotalMs = weeklyEntries.reduce',
    'countTrailingObservedActiveDays(weeklyCalendarEntries',
  ].forEach((token) => assertIncludes(habitSource, token, habitPath));
  [
    'requireWeeklyObservationState',
    'deriveWeeklyObservationSummary',
    'const weeklyObservationSummary = deriveWeeklyObservationSummary(weeklySeries',
    'observedDayCount: observedWeeklySeries.length',
    'requireCanonicalWeeklySummary',
    'TARGET_PANEL_WEEKLY_SUMMARY_RELATION_INVALID',
    'TARGET_PANEL_WEEKLY_SERIES_MISSING',
  ].forEach((token) => assertIncludes(targetPanelSource, token, targetPanelPath));
  [
    'deriveWeeklyObservationSummary',
    "source: 'buildRuleSiteIntel.weeklySeries'",
    'const observedWeeklySeries = weeklyObservationSummary.observedEntries;',
    'const weeklyTotal = weeklyObservationSummary.activeMsTotal;',
    'sumSiteSessionStats(observedWeeklySeries)',
    'sumSiteBehaviorStats(observedWeeklySeries)',
    'sumSiteInterventionStats(observedWeeklySeries)',
    'sumSiteNavigationStats(observedWeeklySeries)',
    'const activeDays = weeklyObservationSummary.activeDays;',
    'const overLimitDays = weeklyObservationSummary.overLimitDays;',
    'const streakDays = weeklyObservationSummary.streakDays;',
    'const todayCollectionObservation = todayDomainEntry?.collectionObservation',
    'const todayObserved = todayCollectionObservation.observed;',
  ].forEach((token) => assertIncludes(siteIntelSource, token, siteIntelPath));
  assertIncludes(workspaceSource, 'viewModel={targetPanelViewModel}', workspacePath);
  assertIncludes(workspaceSource, 'projectionError={targetPanelError}', workspacePath);
  const readingSurfacePath = 'src/themes/core/widgets/shared/sites/SiteIntelReadingSurface.jsx';
  const readingSurfaceSource = await readFile(readingSurfacePath);
  assertIncludes(readingSurfaceSource, 'SITES_TARGET_PANEL_VIEW_MODEL_REQUIRED', readingSurfacePath);
  assertIncludes(readingSurfaceSource, 'if (projectionError) throw projectionError', readingSurfacePath);
  assertIncludes(workspaceSource, 'SiteIntelReadingSurface', workspacePath);
  assertIncludes(workspaceSource, 'SiteIntelBoundary', workspacePath);
  // Release Intel has no expanded history consumer. The new temporal display
  // facts are a query output, never an interpretation/baseline input.
  const temporalPath = 'src/domains/stats/contracts/siteIntelTemporalContext.js';
  const temporalSource = await readFile(temporalPath);
  const hourlyPath = 'src/themes/core/widgets/shared/sites/siteIntelHourlyContext.js';
  const hourlySource = await readFile(hourlyPath);
  assertIncludes(siteIntelSource, 'temporalContext: buildSiteIntelTemporalContext(baseIntel)', siteIntelPath);
  assertIncludes(temporalSource, 'site-intel-temporal-context-v1', temporalPath);
  assertIncludes(temporalSource, 'day-has-records-not-continuous-coverage', temporalPath);
  assertIncludes(hourlySource, 'requireSiteIntelTemporalSeries', hourlyPath);
  assertIncludes(hourlySource, 'SITE_INTEL_TEMPORAL_EVIDENCE_MISMATCH', hourlyPath);
  [featureSource, factsSource, scoreSource].forEach((source, index) => {
    assertExcludes(source, 'temporalContext', [featurePath, factsPath, scorePath][index]);
  });
  const temporalCode = temporalSource.replace(/^\s*\/\/.*$/gm, '');
  ['sitePullProfile', 'interpretation', 'personalBaseline'].forEach(token => assertExcludes(temporalCode, token, temporalPath));
  assertExcludes(readingSurfaceSource, 'recurringTimeEvidence', readingSurfacePath);
  assertExcludes(workspaceSource, 'buildTargetPanelViewModel', workspacePath);
  assertExcludes(workspaceSource, 'weeklyObservationContract.js', workspacePath);
  [
    'viewModel.weeklySeries',
    'viewModel.dailySeries',
    'intel?.todayHourly',
    'intel?.habitHourly',
  ].forEach((token) => assertExcludes(workspaceSource, token, workspacePath));
  [
    'todayHourly[currentHour] = ms',
    'preferProjectedMetricStats',
    'habitHourly[hour] = todayHourly[hour]',
  ].forEach((token) => assertExcludes(siteIntelSource, token, siteIntelPath));

  [featureSource, factsSource, summariesSource, scoreSource, requirementsSource,
    diagnosticsSource, habitSource, targetPanelSource, workspaceSource].forEach((source, index) => {
    const sourcePath = [featurePath, factsPath, summariesPath, scorePath, requirementsPath,
      diagnosticsPath, habitPath, targetPanelPath, workspacePath][index];
    assertExcludes(source, 'observed !== false', sourcePath);
    assertExcludes(source, 'entry?.observed !== false', sourcePath);
  });
  [
    'activeDays / WEEK_DAYS',
    'Number.isFinite(intel?.weeklyTotal)',
    'function computeStreakDays',
  ].forEach((token) => assertExcludes(targetPanelSource, token, targetPanelPath));
  [
    'weeklySeries.reduce((acc, entry) => acc + entry.activeMs',
    'sumSiteSessionStats(weeklySeries)',
    'sumSiteBehaviorStats(weeklySeries)',
    'sumSiteInterventionStats(weeklySeries)',
    'sumSiteNavigationStats(weeklySeries)',
    'weeklySeries.filter((entry) => entry.activeMs > 0)',
    'weeklySeries.filter((entry) => entry.overLimit)',
    'if (!weeklySeries.some((entry) => entry.activeMs > 0)',
  ].forEach((token) => assertExcludes(siteIntelSource, token, siteIntelPath));
  [
    'featureVector.weeklySeries.length',
    'featureVector.weeklySeries?.length',
    'featureVector?.weeklySeries.length',
  ].forEach((token) => assertExcludes(scoreSource, token, scorePath));
  [
    'Math.max(toCount(featureVector.activeDays), countActiveDays(weeklyEntries))',
    'Math.max(toCount(featureVector.streakDays), computeActiveStreak(weeklyEntries))',
    '.filter((entry) => entry.observed)\n    .slice(-7)',
    'toNumber(featureVector.weeklyTotalMs)\n    ||',
  ].forEach((token) => assertExcludes(habitSource, token, habitPath));
}

async function assertPersonalBaselineContract() {
  const personalBaselinePath = 'src/domains/stats/insights/sitePull/personalBaseline.js';
  const personalBaselinePublicContractPath = 'src/domains/stats/insights/sitePull/personalBaselinePublicContract.js';
  const personalBaselineMetricsPath = 'src/domains/stats/insights/sitePull/personalBaselineMetrics.js';
  const baselinePatternsPath = 'src/domains/stats/insights/sitePull/patterns/detectors/baselinePatterns.js';
  const checkingRoutePath = 'src/domains/stats/insights/sitePull/patterns/detectors/checkingRoutePatterns.js';
  const checkingEvidencePath = 'src/domains/stats/insights/sitePull/patterns/sitePullCheckingEvidenceProfile.js';
  const immersionEvidencePath = 'src/domains/stats/insights/sitePull/patterns/sitePullImmersionEvidenceProfile.js';
  const sessionDepthPath = 'src/domains/stats/insights/sitePull/patterns/sitePullSessionDepthEvidenceProfile.js';
  const sustainedBlockPath = 'src/domains/stats/insights/sitePull/patterns/sitePullSustainedBlockEvidenceProfile.js';
  const timePressurePath = 'src/domains/stats/insights/sitePull/patterns/sitePullTimePressureEvidenceProfile.js';
  const trendPressurePath = 'src/domains/stats/insights/sitePull/patterns/sitePullTrendPressureEvidenceProfile.js';
  const habitConsistencyPath = 'src/domains/stats/insights/sitePull/patterns/sitePullHabitConsistencyEvidenceProfile.js';
  const scoreModelPath = 'src/domains/stats/insights/sitePull/scoring/sitePullScoreModel.js';
  const composerPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternComposer.js';
  const baselineCorePath = 'src/domains/stats/baseline/personalBaselineCore.js';
  const baselineIndexPath = 'src/domains/stats/baseline/index.js';
  const personalBaselinePolicyPath = 'src/domains/stats/insights/sitePull/personalBaselinePolicy.js';
  const factsPath = 'src/domains/stats/insights/sitePull/buildSitePullFacts.js';
  const contributionBreakdownPath = 'src/domains/stats/insights/sitePull/scoring/sitePullContributionBreakdown.js';
  const personalBaselineSource = await readFile(personalBaselinePath);
  const personalBaselinePublicContractSource = await readFile(personalBaselinePublicContractPath);
  const personalBaselineMetricsSource = await readFile(personalBaselineMetricsPath);
  const personalBaselinePolicySource = await readFile(personalBaselinePolicyPath);
  const factsSource = await readFile(factsPath);
  const contributionBreakdownSource = await readFile(contributionBreakdownPath);
  const baselinePatternsSource = await readFile(baselinePatternsPath);
  const checkingRouteSource = await readFile(checkingRoutePath);
  const checkingEvidenceSource = await readFile(checkingEvidencePath);
  const immersionEvidenceSource = await readFile(immersionEvidencePath);
  const sessionDepthSource = await readFile(sessionDepthPath);
  const sustainedBlockSource = await readFile(sustainedBlockPath);
  const timePressureSource = await readFile(timePressurePath);
  const trendPressureSource = await readFile(trendPressurePath);
  const habitConsistencySource = await readFile(habitConsistencyPath);
  const scoreModelSource = await readFile(scoreModelPath);
  const composerSource = await readFile(composerPath);
  const baselineCoreSource = await readFile(baselineCorePath);
  const baselineIndexSource = await readFile(baselineIndexPath);

  [
    'Object.hasOwn',
    "from './personalBaselineMetrics.js'",
    "from './baselineSeriesSource.js'",
    'buildSitePullPersonalBaselineMetricProfiles',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_IDS',
    'normalizeSitePullBaselineSeriesSource(featureVector, {',
    "const todayVisitsSource = Object.hasOwn(featureVector, 'todayVisits')",
    'const { metrics } = buildSitePullPersonalBaselineMetricProfiles',
    'materializeMetricBaselineEntries',
    'baselineEntries: metricBaselineEntries,',
    'currentObserved,',
    'const activeMsMetric = metrics[SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS];',
    'const metricScores = buildSitePullPersonalBaselineMetricScores(metrics);',
    'const todayRevisitRate = toNumber(revisitRateMetric.currentValue);',
    "from './personalBaselinePublicContract.js'",
    'export { SITE_PULL_PERSONAL_BASELINE_VERSION, toPublicPersonalBaseline };',
  ].forEach((token) => assertIncludes(personalBaselineSource, token, personalBaselinePath));

  [
    "SITE_PULL_PERSONAL_BASELINE_VERSION = 'site-pull-personal-baseline-v3'",
    'getSitePullPersonalBaselineMetric',
    'resolveSitePullPersonalBaselineMetricScores',
    'function buildPublicPersonalBaselineMetricProjection',
    'const metric = (metricId) => getSitePullPersonalBaselineMetric(baseline, metricId);',
    'const metricScores = resolveSitePullPersonalBaselineMetricScores(baseline);',
    'const metrics = toPublicPersonalBaselineMetrics(baseline.metrics);',
    'const metricProjection = buildPublicPersonalBaselineMetricProjection(baseline, recentTrajectory);',
    'function toPublicMetricProfile',
    'function requireMetricProfileField',
    'function toPublicMetricReference',
    'function requireNoUnexpectedFields',
    'PUBLIC_PERSONAL_BASELINE_KEYS',
    'requireExactFields(',
    'PUBLIC_METRIC_PROFILE_KEYS',
    'PUBLIC_RECENT_TRAJECTORY_KEYS',
    'PUBLIC_ADAPTIVE_REFERENCE_KEYS',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_ID_UNEXPECTED',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_SAMPLE_RELATION_INVALID',
    'getSitePullPersonalBaselineMetricDefinition',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_PROVENANCE',
    'deriveSitePullRecentTrajectoryProjection',
    'deriveSitePullAdaptiveReferenceProjection',
    'deriveSitePullPersonalBaselineMetricAnomaly',
    'currentObserved',
    'sampleProjection.observedCount + sampleProjection.missingCount',
    'SITE_PULL_PERSONAL_BASELINE_POLICY.observedBaseline.targetDays',
    'metric.sample.missingCount !== coverageAuthority.missingCount',
    'metric.currentObserved',
    'comparisonDays',
    'recentActiveDays',
    'previousActiveDays',
    'recentTotalMs',
    'recentPreviousMaxMs',
    'todayShareOfRecent',
    'singleDaySpikeScore',
    'recentMeanAbsoluteDeviationMs',
    'referenceMode',
    'SITE_PULL_PERSONAL_BASELINE_RECENT_TRAJECTORY_CANONICAL_RELATION_INVALID',
    'SITE_PULL_PERSONAL_BASELINE_ADAPTIVE_REFERENCE_CANONICAL_RELATION_INVALID',
    'function toPublicRecentTrajectory',
    'function toPublicAdaptiveReference',
    'const recentTrajectory = toPublicRecentTrajectory(',
  ].forEach((token) => assertIncludes(
    personalBaselinePublicContractSource,
    token,
    personalBaselinePublicContractPath,
  ));

  [
    'const source = baselineSeries.length > 0 ? baselineSeries : weeklySeries;',
    'featureVector.weeklySeries.slice(0, -1)',
    'featureVector.weeklySeries.at(-1)',
    'const todayVisits = Math.max(',
    'toCount(featureVector.todayVisits),\n    Array.isArray(featureVector.todayHourlyVisits)',
    'const todaySessionCount = Math.max(todaySession.count, todayVisits > 0 ? todayVisits : 0);',
    'trendValues.length > 0 ? trendValues : normalizeSeries(featureVector.weeklySeries).map((entry) => entry.activeMs)',
    'function percentile',
    'function computeRobustStats',
    'function computeRobustValueStats',
    'function computeBaselineConfidence',
    'function computeInteractionConfidence',
    'function computeValueAnomaly',
    'function computeRatioAnomaly',
    'function computeTimeAnomaly',
    'function computeTrendAnomaly',
    'const trendValues = observedEntries.map((entry) => entry.activeMs);',
    'function computeSitePullRobustValueStats',
    'function computeSitePullInteractionConfidence',
    'const visitStats =',
    'const revisitStats =',
    'const switchChurnStats =',
    'baseline.version ||',
    'baseline.policyVersion ||',
    'baseline.policy ||',
    'baseline.status ||',
    "if (!baseline || typeof baseline !== 'object') return null;",
    'activeMsMetric.trend ||',
    'computeTrendAnomaly',
    'provenance: { ...provenance }',
    '...recentTrajectory',
    '...adaptiveReference',
    'Object.entries(reference).reduce',
  ].forEach((token) => assertExcludes(personalBaselineSource, token, personalBaselinePath));

  [
    'buildSitePullPersonalBaselineMetricProfiles',
    'buildSitePullRecentTrajectory',
    'buildSitePullAdaptiveReference',
    'provenance: { ...provenance }',
    '...recentTrajectory',
    '...adaptiveReference',
    'Object.entries(reference).reduce',
  ].forEach((token) => assertExcludes(
    personalBaselinePublicContractSource,
    token,
    personalBaselinePublicContractPath,
  ));

  [
    'baseline.observedDays',
    'baseline.activeDays',
    'baseline.activeDayRate',
    'baseline.totalBaselineMs',
    'baseline.medianDailyMs',
    'baseline.p75DailyMs',
    'baseline.p90DailyMs',
    'baseline.activeMedianMs',
    'baseline.p75ReferenceMs',
    'baseline.p90ReferenceMs',
    'baseline.robustSigmaMs',
    'baseline.todayVsP75Ratio',
    'baseline.robustZ',
    'baseline.timeAnomalyScore',
    'baseline.trendAnomalyScore',
    'baseline.todayVisits',
    'baseline.visitMedian',
    'baseline.visitP75',
    'baseline.visitP90',
    'baseline.visitAnomalyScore',
    'baseline.todayRevisitWithin10m',
    'baseline.todayRevisitRate',
    'baseline.revisitMedian',
    'baseline.revisitP75',
    'baseline.revisitP90',
    'baseline.todaySwitchIns',
    'baseline.todaySwitchOuts',
    'baseline.todaySwitchChurn',
    'baseline.switchChurnMedian',
    'baseline.switchChurnP75',
    'baseline.todaySessionCount',
    'baseline.todayShortSessionCount',
    'baseline.todayLongSessionCount',
    'baseline.todayMaxSessionMs',
    'baseline.maxSessionP75Ms',
    'baseline.sessionDepthAnomalyScore',
    'baseline.recentAverageMs',
    'baseline.baselineAverageMs',
    'baseline.trendRatio',
  ].forEach((token) => {
    assertFunctionSourceExcludes(
      personalBaselinePublicContractSource,
      'toPublicPersonalBaseline',
      [token],
      personalBaselinePublicContractPath,
    );
    assertFunctionSourceExcludes(
      personalBaselinePublicContractSource,
      'buildPublicPersonalBaselineMetricProjection',
      [token],
      personalBaselinePublicContractPath,
    );
  });

  [
    "SITE_PULL_PERSONAL_BASELINE_METRICS_VERSION = 'site-pull-personal-baseline-metrics-v3'",
    'SITE_PULL_PERSONAL_BASELINE_METRIC_IDS',
    'buildSitePullPersonalBaselineMetricProfiles',
    'buildPersonalBaselineMetricProfileMap',
    'buildDescriptor',
    'getSitePullPersonalBaselineMetricDefinition',
    'getSitePullPersonalBaselineMetricAnomalyOptions',
    'deriveSitePullPersonalBaselineMetricAnomaly',
    'derivePersonalBaselineMetricAnomaly',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_ANOMALY_OPTIONS',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_PROVENANCE',
    'getSitePullPersonalBaselineMetric',
    'resolveSitePullPersonalBaselineMetricScores',
    'function requireMetricScoreSection',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_SCORE_SECTION_MISSING',
    'buildSitePullPersonalBaselineMetricScores',
    'ACTIVE_MS',
    'VISIT_COUNT',
    'REVISIT_RATE',
    'SWITCH_IN_COUNT',
    'SWITCH_OUT_COUNT',
    'QUICK_RETURN_RATE',
    'MAX_SESSION_MS',
    'SITE_PULL_PERSONAL_BASELINE_METRICS_VERSION',
    'function buildObservedRateObservation',
    'buildMissingObservation',
    'buildBaselineValueObservation',
    'buildCurrentValueObservation',
    'requireBaselineEntries',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_ENTRIES_INVALID',
    'baselineEntries',
    'currentObserved',
    'return { metrics: builtMetrics };',
  ].forEach((token) => assertIncludes(personalBaselineMetricsSource, token, personalBaselineMetricsPath));

  [
    'export function buildPersonalBaseline',
    'toPublicPersonalBaseline',
    'buildSitePullAdaptiveReference',
    'buildSitePullRecentTrajectory',
    'activeMsMetric.trend?.score || 0',
    'includeTrend',
    'trendOptions',
    'anomalyComputeOptions',
    'computeTrendAnomaly',
    'computeBaselineConfidence',
    'computeTimeAnomaly',
    'descriptor.confidence =',
    'observedEntries',
  ].forEach((token) => assertExcludes(personalBaselineMetricsSource, token, personalBaselineMetricsPath));

  [
    "STATS_PERSONAL_BASELINE_CORE_VERSION = 'stats-personal-baseline-core-v3'",
    'STATS_PERSONAL_BASELINE_CORE_VERSION',
    'currentObserved: current.observed',
    'STATS_PERSONAL_BASELINE_METRIC_DIRECTIONS',
    'STATS_PERSONAL_BASELINE_METRIC_GRAINS',
    'STATS_PERSONAL_BASELINE_METRIC_KINDS',
    'STATS_PERSONAL_BASELINE_ROLES',
    'export function percentile',
    'export function computeRobustStats',
    'export function computeRobustValueStats',
    'export function computeBaselineConfidence',
    'export function computeInteractionConfidence',
    'export function computeValueAnomaly',
    'export function computeRatioAnomaly',
    'export function computeTimeAnomaly',
    'export function buildPersonalBaselineMetricProfile',
    'export function buildPersonalBaselineMetricProfileMap',
    'export function derivePersonalBaselineMetricAnomaly',
    'function requireMetricObservation',
    'observedCount:',
    'eligibleCount:',
    'ineligibleCount:',
    'exposureTotal:',
    'STATS_PERSONAL_BASELINE_METRIC_CURRENT_MISSING',
    'STATS_PERSONAL_BASELINE_METRIC_ID_DUPLICATE',
    'STATS_PERSONAL_BASELINE_METRIC_OPTION_FIELD_INVALID',
    'STATS_PERSONAL_BASELINE_METRIC_PROFILE_NUMBER_INVALID',
    'reference,',
  ].forEach((token) => assertIncludes(baselineCoreSource, token, baselineCorePath));

  [
    'SITE_PULL_',
    'sitePull',
    'personalBaselinePolicy',
    'computeTrendAnomaly',
    'includeTrend',
    'trendOptions',
    'anomalyComputeOptions',
    'descriptor.confidence =',
  ].forEach((token) => assertExcludes(baselineCoreSource, token, baselineCorePath));

  [
    'STATS_PERSONAL_BASELINE_CORE_VERSION',
    'STATS_PERSONAL_BASELINE_METRIC_KINDS',
    'buildPersonalBaselineMetricProfile',
    'buildPersonalBaselineMetricProfileMap',
    'derivePersonalBaselineMetricAnomaly',
  ].forEach((token) => assertIncludes(baselineIndexSource, token, baselineIndexPath));

  [
    'computeRobustStats',
    'computeRobustValueStats',
    'computeBaselineConfidence',
    'computeInteractionConfidence',
    'computeValueAnomaly',
    'computeRatioAnomaly',
    'computeTimeAnomaly',
  ].forEach((token) => assertExcludes(baselineIndexSource, token, baselineIndexPath));

  [
    "SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION = 'site-pull-personal-baseline-policy-v3'",
    'export function resolveSitePullPersonalBaselinePolicyContext',
    'SITE_PULL_PERSONAL_BASELINE_POLICY_CONTEXT_FIELD_MISSING',
    'SITE_PULL_PERSONAL_BASELINE_POLICY_CONTEXT_STATUS_INVALID',
    'SITE_PULL_PERSONAL_BASELINE_POLICY.personalWeight.cap',
    'export function requireSitePullRecentTrajectory',
    'export function projectSitePullRecentTrajectory',
    'export function deriveSitePullRecentTrajectoryProjection',
    'export function deriveSitePullAdaptiveReferenceProjection',
    'function computeSitePullSingleDaySpikeScore',
    'comparisonDays',
    'recentActiveDays',
    'previousActiveDays',
    'recentTotalMs',
    'recentPreviousMaxMs',
    'todayShareOfRecent',
    'singleDaySpikeScore',
    'const recentCalendarEntries = calendarEntries.slice(-policy.recentDays);',
    'const momentumCalendarEntries = calendarEntries.slice(-policy.momentumDays);',
    'const comparisonHistoryEntries = calendarEntries.slice(-6);',
    'const recentValues = normalizeActiveValues(recentCalendarEntries);',
    'const momentumValues = normalizeActiveValues(momentumCalendarEntries);',
    'comparisonDays: comparisonHistoryValues.length + (currentObserved ? 1 : 0)',
    'const recentComparisonValues = currentObserved',
    "caveats.push('current_day_unobserved')",
    'todayVsReferenceRatio = currentObserved',
    'const reboundScore = currentObserved',
    'PERSONAL_BASELINE_REFERENCE_MODES',
    'referenceMode:',
    'const referenceMs = baselineStatus === SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE',
  ].forEach((token) => assertIncludes(personalBaselinePolicySource, token, personalBaselinePolicyPath));
  [
    'const recentValues = values.slice(-policy.recentDays)',
    'const momentumValues = values.slice(-policy.momentumDays)',
    'const comparisonHistoryValues = values.slice(-6)',
  ].forEach((token) => assertExcludes(personalBaselinePolicySource, token, personalBaselinePolicyPath));

  assertIncludes(
    personalBaselineSource,
    'baselineEntries: entries,',
    personalBaselinePath,
  );
  assertExcludes(
    personalBaselineSource,
    'baselineEntries: observedEntries,',
    personalBaselinePath,
  );

  [
    'resolveSitePullPersonalBaselinePolicyContext',
    'const personalBaselinePolicyContext = resolveSitePullPersonalBaselinePolicyContext(personalBaseline);',
    'hasPersonalBaselineFacts: personalBaselinePolicyContext.hasPersonalBaselineFacts',
    'personalBaselineStatus: personalBaselinePolicyContext.status',
    'const recentTrajectoryProjection = projectSitePullRecentTrajectory(',
    'buildSitePullTemporalEvidence(sitePullFeatureVector,',
  ].forEach((token) => assertIncludes(factsSource, token, factsPath));

  [
    'personalBaseline?.status !==',
    'personalBaseline?.status ||',
  ].forEach((token) => assertExcludes(factsSource, token, factsPath));

  [
    'function createPublicPersonalBaselineResolver',
    'evidence: buildContributionEvidence(featureVector, key, facts, resolvePublicPersonalBaseline)',
    'personalBaseline: resolvePublicPersonalBaseline()',
  ].forEach((token) => assertIncludes(contributionBreakdownSource, token, contributionBreakdownPath));

  assertFunctionSourceExcludes(
    contributionBreakdownSource,
    'buildContributionEvidence',
    ['toPublicPersonalBaseline(personalBaseline)'],
    contributionBreakdownPath,
  );

  [
    'getSitePullPersonalBaselineMetric',
    'resolveSitePullPersonalBaselineMetricScores',
    'resolveSitePullPersonalBaselinePolicyContext',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_IDS',
    'ACTIVE_MS',
    'VISIT_COUNT',
    'REVISIT_COUNT',
    'SWITCH_IN_COUNT',
    'SWITCH_CHURN_COUNT',
  ].forEach((token) => assertIncludes(baselinePatternsSource, token, baselinePatternsPath));

  [
    'personalBaseline?.visitConfidence',
    'personalBaseline?.visitAnomalyScore',
    'personalBaseline.visitAnomalyScore',
    'personalBaseline.revisitAnomalyScore',
    'personalBaseline.quickReturnAnomalyScore',
    'personalBaseline.switchChurnAnomalyScore',
    'personalBaseline.todaySwitchIns',
    'baseline.timeAnomalyScore',
    'baseline.p75ReferenceMs',
    'baseline.p90ReferenceMs',
    'baseline.todayVsP75Ratio',
    'baseline.robustZ',
    'baseline.trendAnomalyScore',
    'baseline.trendRatio',
    'baseline.status',
    'baseline.personalWeight',
    'policyContext?.status ||',
    'policyContext?.personalWeight ||',
    'function resolveMetricScores',
    'buildSitePullPersonalBaselineMetricScores',
  ].forEach((token) => assertExcludes(baselinePatternsSource, token, baselinePatternsPath));

  [
    'getSitePullPersonalBaselineMetric',
    'QUICK_RETURN_RATE',
    'SWITCH_CHURN_COUNT',
  ].forEach((token) => assertIncludes(checkingRouteSource, token, checkingRoutePath));

  [
    'personalBaseline?.quickReturnRateP75',
    'personalBaseline?.switchChurnP75',
    'personalBaseline?.todayVsSwitchChurnP75Ratio',
  ].forEach((token) => assertExcludes(checkingRouteSource, token, checkingRoutePath));

  [
    'getSitePullPersonalBaselineMetric',
    'resolveSitePullPersonalBaselineMetricScores',
    'MAX_SESSION_MS',
    'LONG_SESSION_RATE',
  ].forEach((token) => assertIncludes(sessionDepthSource, token, sessionDepthPath));

  [
    'personalBaseline?.todayMaxSessionMs',
    'personalBaseline?.maxSessionP75Ms',
    'personalBaseline?.sessionDepthAnomalyScore',
    'personalBaseline?.sessionConfidence',
    'personalBaseline?.todayLongSessionRate',
    'buildSitePullPersonalBaselineMetricScores',
  ].forEach((token) => assertExcludes(sessionDepthSource, token, sessionDepthPath));

  [
    'getSitePullPersonalBaselineMetric',
    'resolveSitePullPersonalBaselineMetricScores',
    'SWITCH_IN_COUNT',
    'SWITCH_OUT_COUNT',
    'SWITCH_BACK_COUNT',
    'SWITCH_CHURN_COUNT',
  ].forEach((token) => assertIncludes(checkingEvidenceSource, token, checkingEvidencePath));

  [
    'personalBaseline?.quickReturnAnomalyScore',
    'personalBaseline?.switchChurnAnomalyScore',
    'personalBaseline?.shortSessionAnomalyScore',
    'personalBaseline?.visitAnomalyScore',
    'personalBaseline?.sessionConfidence',
    'personalBaseline?.loopConfidence',
    'personalBaseline?.todaySwitchIns',
    'personalBaseline?.todaySwitchOuts',
    'function resolvePersonalBaselineMetricScores',
    'buildSitePullPersonalBaselineMetricScores',
  ].forEach((token) => assertExcludes(checkingEvidenceSource, token, checkingEvidencePath));

  [
    'resolveSitePullPersonalBaselineMetricScores',
  ].forEach((token) => assertExcludes(immersionEvidenceSource, token, immersionEvidencePath));

  [
    'personalBaseline?.sessionDepthAnomalyScore',
    'personalBaseline?.sessionConfidence',
    'function resolvePersonalBaselineMetricScores',
    'buildSitePullPersonalBaselineMetricScores',
  ].forEach((token) => assertExcludes(immersionEvidenceSource, token, immersionEvidencePath));

  [
    'resolveSitePullPersonalBaselineMetricScores',
  ].forEach((token) => assertExcludes(sustainedBlockSource, token, sustainedBlockPath));

  [
    'personalBaseline?.sessionDepthAnomalyScore',
    'personalBaseline?.sessionConfidence',
    'function resolvePersonalBaselineMetricScores',
    'buildSitePullPersonalBaselineMetricScores',
  ].forEach((token) => assertExcludes(sustainedBlockSource, token, sustainedBlockPath));

  [
    'getSitePullPersonalBaselineMetric',
    'resolveSitePullPersonalBaselineMetricScores',
    'ACTIVE_MS',
    'resolveSitePullPersonalBaselinePolicyContext',
    'requireSitePullRecentTrajectory',
    'const policyContext = resolveSitePullPersonalBaselinePolicyContext(personalBaseline);',
  ].forEach((token) => assertIncludes(timePressureSource, token, timePressurePath));

  [
    'personalBaseline?.timeAnomalyScore',
    'personalBaseline?.p75ReferenceMs',
    'personalBaseline?.p90ReferenceMs',
    'personalBaseline?.todayVsP75Ratio',
    'personalBaseline?.trendAnomalyScore',
    'personalBaseline?.personalWeight',
    'policyContext?.personalWeight ||',
    'function resolvePersonalBaselineMetricScores',
    'buildSitePullPersonalBaselineMetricScores',
  ].forEach((token) => assertExcludes(timePressureSource, token, timePressurePath));

  [
    'resolveSitePullPersonalBaselineMetricScores',
    'requireSitePullRecentTrajectory',
    'SITE_PULL_PERSONAL_TRAJECTORY_STATES',
    'SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE',
    'const recentRiseScore = clamp01(recentTrajectory.risingScore);',
    'getSitePullPersonalBaselineMetric',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS',
    'recentTrajectory.singleDaySpikeScore',
    'recentTrajectory.comparisonDays',
    'recentTrajectory.recentActiveDays',
    'recentTrajectory.recentTotalMs',
    'recentTrajectory.todayShareOfRecent',
    'activeAnomaly.robustZ',
    'resolveSitePullPersonalBaselinePolicyContext',
    'const policyContext = resolveSitePullPersonalBaselinePolicyContext(personalBaseline);',
  ].forEach((token) => assertIncludes(trendPressureSource, token, trendPressurePath));

  [
    'personalBaseline?.confidence',
    'personalBaseline?.trendAnomalyScore',
    'personalBaseline?.trendRatio',
    'activeMsMetric?.trend',
    'personalBaseline?.personalWeight',
    'policyContext?.personalWeight ||',
    'function resolvePersonalBaselineMetricScores',
    'buildSitePullPersonalBaselineMetricScores',
    'function buildWeeklyShape',
    'function buildTemporalShape',
    'function computeSingleDaySpikeScore',
    'weeklySeries',
    'weighted7d',
    'recent3d',
    'recent7d',
    'baseline30d',
    "baselineStatus === 'sparse'",
  ].forEach((token) => assertExcludes(trendPressureSource, token, trendPressurePath));

  [
    'getSitePullPersonalBaselineMetric',
    'ACTIVE_MS',
    'function resolvePersonalBaselineActivityShape',
  ].forEach((token) => assertIncludes(habitConsistencySource, token, habitConsistencyPath));

  [
    'personalBaseline?.confidence',
    'personalBaseline?.activeDayRate',
    'personalBaseline?.activeDays',
  ].forEach((token) => assertExcludes(habitConsistencySource, token, habitConsistencyPath));

  [
    'resolveSitePullPersonalBaselineMetricScores',
    'resolveSitePullPersonalBaselinePolicyContext',
    'function resolvePersonalBaselineScoringContext',
    'const personalBaselineContext = resolvePersonalBaselineScoringContext(personalBaseline);',
    'metricScores: resolveSitePullPersonalBaselineMetricScores(personalBaseline)',
    'policyContext: resolveSitePullPersonalBaselinePolicyContext(personalBaseline)',
    'recentTrajectory: personalBaseline === null || personalBaseline === undefined',
    'requireSitePullRecentTrajectory(personalBaseline)',
  ].forEach((token) => assertIncludes(scoreModelSource, token, scoreModelPath));

  [
    'function resolvePersonalBaselineActiveMetric',
    'function resolvePersonalBaselinePolicyContext',
    'personalBaseline?.visitConfidence',
    'personalBaseline?.revisitConfidence',
    'personalBaseline?.loopConfidence',
    'personalBaseline?.sessionConfidence',
    'personalBaseline?.visitAnomalyScore',
    'personalBaseline?.revisitAnomalyScore',
    'personalBaseline?.quickReturnAnomalyScore',
    'personalBaseline?.switchChurnAnomalyScore',
    'personalBaseline?.shortSessionAnomalyScore',
    'personalBaseline?.sessionDepthAnomalyScore',
    'personalBaseline?.timeAnomalyScore',
    'personalBaseline?.trendAnomalyScore',
    'personalBaseline?.confidence',
    'personalBaseline?.personalWeight',
    'personalBaseline.personalWeight',
    'personalBaseline.activeDayRate',
    'personalBaseline.activeDays',
    'buildSitePullPersonalBaselineMetricScores',
  ].forEach((token) => assertExcludes(scoreModelSource, token, scoreModelPath));
  assertFunctionSourceExcludes(scoreModelSource, 'computeTrendAcceleration', [
    'weeklyAverageMs',
    'todayTotalMs',
    'durationNorm(',
    'ratioNorm(',
  ], scoreModelPath);

  [
    'resolveSitePullEntryVisitSummary',
    'resolveSitePullSessionShape',
  ].forEach((token) => assertIncludes(composerSource, token, composerPath));
  assertExcludes(composerSource, 'personalBaselineMetrics.js', composerPath);
  assertExcludes(composerSource, 'firstPositiveNumber', composerPath);

  [
    'personalBaseline?.loopConfidence',
    'personalBaseline?.quickReturnAnomalyScore',
    'personalBaseline?.switchChurnAnomalyScore',
    'personalBaseline?.visitAnomalyScore',
    'personalBaseline?.shortSessionAnomalyScore',
    'personalBaseline?.todaySwitchBackWithin10m',
    'personalBaseline?.todaySwitchChurn',
    'personalBaseline?.todayVisits',
    'personalBaseline?.todayShortSessionCount',
    'personalBaseline.loopConfidence',
    'function resolvePersonalBaselineMetricScores',
    'buildSitePullPersonalBaselineMetricScores',
  ].forEach((token) => assertExcludes(composerSource, token, composerPath));
}

async function assertNavigationIntentMetricsContract() {
  const navigationIntentPath = 'src/domains/stats/insights/sitePull/navigationIntentMetrics.js';
  const navigationIntentSource = await readFile(navigationIntentPath);

  [
    'SITE_PULL_NAVIGATION_INTENT_FACTS_INVALID',
    'SITE_PULL_NAVIGATION_INTENT_ENTRY_FACTS_INVALID',
    'function resolveNavigationFacts',
    'function resolveEntryFacts',
  ].forEach((token) => assertIncludes(navigationIntentSource, token, navigationIntentPath));

  [
    'featureVector',
    'featureVector?.todayNavigationStats',
    'facts?.navigation || featureVector',
  ].forEach((token) => assertExcludes(navigationIntentSource, token, navigationIntentPath));
}

async function assertImmersionEvidenceSourceContract() {
  const immersionPath = 'src/domains/stats/insights/sitePull/patterns/sitePullImmersionEvidenceProfile.js';
  const immersionSource = await readFile(immersionPath);

  [
    'SITE_PULL_IMMERSION_NAVIGATION_FACTS_INVALID',
    'function resolveNavigationFacts',
    'const sustainedBlockMs = sustainedProfile.evidence.sustainedBlockMs',
  ].forEach((token) => assertIncludes(immersionSource, token, immersionPath));

  [
    'facts.navigation || featureVector.todayNavigationStats',
    'featureVector.todayNavigationStats || {}',
  ].forEach((token) => assertExcludes(immersionSource, token, immersionPath));
}

async function assertContextModelMeaningContract() {
  const root = 'src/domains/stats/insights/sitePull/patterns/';
  for (const name of ['ControlledBrief', 'Immersion', 'SustainedBlock', 'HabitConsistency', 'NightPressure', 'BackgroundResidency']) {
    const path = `${root}sitePull${name}EvidenceProfile.js`;
    const source = await readFile(path);
    ['featureVector.goalMs', 'featureVector.usageRatio', 'goalOverrunScore', 'contextRiskScore',
      'exitResistanceScore', 'quietEvidenceCoverageScore'].forEach(token => assertExcludes(source, token, path));
  }
  const backgroundPath = `${root}sitePullBackgroundResidencyEvidenceProfile.js`;
  const background = await readFile(backgroundPath);
  assertExcludes(background, 'temporalEvidence', backgroundPath);
  assertIncludes(background, 'selectObservedWeeklyEntries', backgroundPath);
  const trendPath = `${root}sitePullTrendPressureEvidenceProfile.js`;
  const trend = await readFile(trendPath);
  assertIncludes(trend, 'comparisonDays < 7', trendPath);
  assertIncludes(trend, 'Math.min(clamp01(recentTrajectory.confidence)', trendPath);
  const immersionPath = `${root}sitePullImmersionEvidenceProfile.js`;
  assertExcludes(await readFile(immersionPath), 'intervention.continued', immersionPath);
  const habitPath = `${root}sitePullHabitConsistencyEvidenceProfile.js`;
  assertExcludes(await readFile(habitPath), 'trendPressureEvidenceProfile', habitPath);
}

async function assertCheckingEvidenceEntrySourceContract() {
  const checkingPath = 'src/domains/stats/insights/sitePull/patterns/sitePullCheckingEvidenceProfile.js';
  const composerPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternComposer.js';
  const mathPath = 'src/domains/stats/insights/sitePull/sitePullMath.js';
  const patternUtilsPath = 'src/domains/stats/insights/sitePull/patterns/patternUtils.js';
  const checkingSource = await readFile(checkingPath);
  const composerSource = await readFile(composerPath);
  const mathSource = await readFile(mathPath);
  const patternUtilsSource = await readFile(patternUtilsPath);
  const entryConsumerPaths = [
    'src/domains/stats/insights/sitePull/scoring/sitePullContributionBreakdown.js',
    'src/domains/stats/insights/sitePull/scoring/sitePullScoreModel.js',
    'src/domains/stats/insights/sitePull/patterns/detectors/dataPlanPatterns.js',
    'src/domains/stats/insights/sitePull/patterns/sitePullControlledBriefEvidenceProfile.js',
    'src/domains/stats/insights/sitePull/patterns/sitePullHabitConsistencyEvidenceProfile.js',
    'src/domains/stats/insights/sitePull/patterns/sitePullNightPressureEvidenceProfile.js',
    'src/domains/stats/insights/sitePull/patterns/sitePullSustainedBlockEvidenceProfile.js',
    'src/domains/stats/insights/sitePull/patterns/sitePullTabContextEvidenceProfile.js',
  ];

  [
    'function resolveEntryShape(facts)',
    'function resolveUsageShape(facts)',
  ].forEach((token) => assertIncludes(checkingSource, token, checkingPath));

  [
    'buildCheckingLoopEvidence',
    'buildSwitchChurnEvidence',
    'buildDistributedVisitsEvidence',
    'buildNavigationEvidence',
  ].forEach((functionName) => {
    assertFunctionSourceExcludes(checkingSource, functionName, ['featureVector'], checkingPath);
  });

  for (const filePath of entryConsumerPaths) {
    const source = await readFile(filePath);
    [
      'featureVector.todayVisits',
      'featureVector?.todayVisits',
      'featureVector.todayHourlyVisits',
      'featureVector?.todayHourlyVisits',
      'hasVisitFacts(featureVector)',
    ].forEach((token) => assertExcludes(source, token, filePath));
  }

  assertFunctionSourceExcludes(composerSource, 'composeCheckingCarousel', ['featureVector'], composerPath);
  assertExcludes(mathSource, 'export function hasVisitFacts(featureVector)', mathPath);
  assertExcludes(patternUtilsSource, 'hasVisitFacts', patternUtilsPath);
}

async function assertDataCoverageContract() {
  const dataCoveragePath = 'src/domains/stats/insights/sitePull/scoring/sitePullDataCoverage.js';
  const dataCoverageSource = await readFile(dataCoveragePath);

  [
    'SITE_PULL_DATA_COVERAGE_MISSING',
    'SITE_PULL_DATA_COVERAGE_INVALID',
    'SITE_PULL_DATA_COVERAGE_FIELD_INVALID',
    'function resolveFactCoverage',
    'function requireBooleanCoverageField',
  ].forEach((token) => assertIncludes(dataCoverageSource, token, dataCoveragePath));

  [
    'options?.dataCollectionMode',
    'personalBaseline?.status',
    'hasBaselineFacts',
    'hasHourlyData',
    'hasVisitFacts',
  ].forEach((token) => assertExcludes(dataCoverageSource, token, dataCoveragePath));
}

async function assertSessionEvidenceSourceContract() {
  const helperPath = 'src/domains/stats/insights/sitePull/patterns/sitePullSessionFactSource.js';
  const helperSource = await readFile(helperPath);
  [
    'export function resolveSitePullSessionFacts',
    'export function resolveSitePullSessionShape',
    'SITE_PULL_SESSION_FACTS_INVALID',
  ].forEach((token) => assertIncludes(helperSource, token, helperPath));

  const sessionConsumerPaths = [
    'src/domains/stats/insights/sitePull/patterns/sitePullCheckingEvidenceProfile.js',
    'src/domains/stats/insights/sitePull/patterns/sitePullControlledBriefEvidenceProfile.js',
    'src/domains/stats/insights/sitePull/patterns/sitePullImmersionEvidenceProfile.js',
    'src/domains/stats/insights/sitePull/patterns/sitePullSustainedBlockEvidenceProfile.js',
  ];
  for (const filePath of sessionConsumerPaths) {
    const source = await readFile(filePath);
    [
      'resolveSitePullSessionShape',
    ].forEach((token) => assertIncludes(source, token, filePath));
    [
      'featureVector?.todaySessionStats',
      'featureVector.todaySessionStats',
      'featureSession',
      'function countValue(',
      'function positiveDuration(',
    ].forEach((token) => assertExcludes(source, token, filePath));
  }
  const detectorPath = 'src/domains/stats/insights/sitePull/patterns/detectors/sessionShapePatterns.js';
  const detectorSource = await readFile(detectorPath);
  ['resolveSessionShape', 'resolveSitePullSessionFacts', 'todaySessionStats'].forEach(
    (token) => assertExcludes(detectorSource, token, detectorPath),
  );
  for (const name of ['TimePressure', 'SustainedBlock']) {
    const filePath = `src/domains/stats/insights/sitePull/patterns/sitePull${name}EvidenceProfile.js`;
    const source = await readFile(filePath);
    ['goalMs', 'hasGoal', 'usageRatio', 'overGoal', 'goal_overrun'].forEach(
      (token) => assertExcludes(source, token, filePath),
    );
  }
}

async function assertQuickReturnCounterAuthorityNaming() {
  const checkingProfilePath = 'src/domains/stats/insights/sitePull/patterns/sitePullCheckingEvidenceProfile.js';
  const thresholdAuditPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternThresholdAudit.js';
  const checkingProfileSource = await readFile(checkingProfilePath);
  const thresholdAuditSource = await readFile(thresholdAuditPath);

  [
    'coarse_switch_back_counter',
    'impulseCoarseSwitchBackScore',
  ].forEach((token) => assertIncludes(checkingProfileSource, token, checkingProfilePath));

  [
    'legacy_switch_back_counter',
    'impulseLegacySwitchBackScore',
  ].forEach((token) => assertExcludes(checkingProfileSource, token, checkingProfilePath));

  [
    'coarseCounterGate',
    'coarse_counter_without_bucket_shape',
  ].forEach((token) => assertIncludes(thresholdAuditSource, token, thresholdAuditPath));

  [
    'legacyFallback',
    'legacy_counter_fallback',
  ].forEach((token) => assertExcludes(thresholdAuditSource, token, thresholdAuditPath));
}

async function assertFeedbackSurfacePresenterContract() {
  const patternFeedbackSpecPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternFeedbackSpec.js';
  const presenterPath = 'src/domains/stats/insights/sitePull/patterns/sitePullFeedbackSurfacePresenter.js';
  const patternFeedbackSpecSource = await readFile(patternFeedbackSpecPath);
  const presenterSource = await readFile(presenterPath);

  [
    'SITE_PULL_PATTERN_FEEDBACK_SURFACE_INVALID',
    'export function requireSitePullPatternFeedbackSurface(surface)',
    'const resolvedSurface = requireSitePullPatternFeedbackSurface(surface);',
    'surface_not_allowed',
  ].forEach((token) => assertIncludes(patternFeedbackSpecSource, token, patternFeedbackSpecPath));

  [
    'SITE_PULL_FEEDBACK_SURFACE_INVALID',
    'SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY',
    'function requireKnownSurface(surface)',
    'function claimVisibility(row, surface)',
    'const resolvedSurface = requireKnownSurface(surface);',
    'surfaceVisibility',
    'claimVisibility: claimVisibility(row, surface)',
  ].forEach((token) => assertIncludes(presenterSource, token, presenterPath));

  [
    'DEFAULT_SURFACE_LIMITS[surface] || DEFAULT_SURFACE_LIMITS[DETAIL]',
    'const fallback = DEFAULT_SURFACE_LIMITS[surface]',
  ].forEach((token) => assertExcludes(presenterSource, token, presenterPath));
}

async function assertAggregateAnalysisFactsContract() {
  const aggregateAnalysisPath = 'src/domains/stats/insights/sitePull/patterns/sitePullAggregateAnalysis.js';
  const aggregateAnalysisSource = await readFile(aggregateAnalysisPath);

  [
    'SITE_PULL_AGGREGATE_FACTS_INVALID',
    'function resolveAggregateSitePullFacts(domain, intel = {})',
    'const facts = resolveAggregateSitePullFacts(domain, intel);',
    'resolveSitePullEntryVisitSummary({ facts })',
  ].forEach((token) => assertIncludes(aggregateAnalysisSource, token, aggregateAnalysisPath));

  [
    'const facts = intel?.sitePullFacts || {}',
    'const todayVisits = toCount(entry.todayVisits)',
    'entry.hasVisitFacts === true || todayVisits > 0 || weeklyVisits > 0',
    'toCount(intel.todayVisits)',
    'toNumber(intel.todayTotal)',
    'toNumber(intel.totalMs)',
    'sitePullProfile',
  ].forEach((token) => assertExcludes(aggregateAnalysisSource, token, aggregateAnalysisPath));
}

async function assertAggregateCostBudgetContract() {
  const aggregateSpecPath = 'src/domains/stats/insights/sitePull/patterns/sitePullAggregatePatternSpec.js';
  const aggregateSpecSource = await readFile(aggregateSpecPath);

  [
    'SITE_PULL_AGGREGATE_COST_BUDGET_INVALID',
    'SITE_PULL_AGGREGATE_COST_CLASS_INVALID',
    'function requireKnownAggregateCostBudget(costBudget)',
    'const resolvedCostBudget = requireKnownAggregateCostBudget(costBudget);',
    'AGGREGATE_PLAN_DATA_FAMILIES',
    'SITE_PULL_AGGREGATE_PLAN_DATA_FAMILY_UNKNOWN',
    'SITE_PULL_AGGREGATE_PLAN_FAMILY_STATUS_INVALID',
    "status: 'unavailable'",
  ].forEach((token) => assertIncludes(aggregateSpecSource, token, aggregateSpecPath));

  [
    'COST_RANK[costBudget] || COST_RANK[CHEAP]',
    'COST_RANK[spec?.costClass] || COST_RANK[CHEAP]',
    "status: 'unknown'",
    "familyDiagnostic.status || 'unknown'",
  ].forEach((token) => assertExcludes(aggregateSpecSource, token, aggregateSpecPath));
}

async function assertAggregateFeedbackSurfaceContract() {
  const aggregateFeedbackPath = 'src/domains/stats/insights/sitePull/patterns/sitePullAggregateFeedback.js';
  const habitCandidatesPath = 'src/domains/stats/insights/sitePull/patterns/sitePullHabitFeedbackCandidates.js';
  const aggregateFeedbackSource = await readFile(aggregateFeedbackPath);
  const habitCandidatesSource = await readFile(habitCandidatesPath);

  [
    'SITE_PULL_AGGREGATE_FEEDBACK_SURFACE_INVALID',
    'SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY',
    'export function requireSitePullAggregateFeedbackSurface(surface)',
    'function resolveClaimVisibility(surface)',
    'const resolvedSurface = requireSitePullAggregateFeedbackSurface(surface);',
    'surface: resolvedSurface',
    'surfaceVisibility',
    'claimVisibility: resolveClaimVisibility(surface)',
  ].forEach((token) => assertIncludes(aggregateFeedbackSource, token, aggregateFeedbackPath));

  [
    'requireSitePullAggregateFeedbackSurface',
    'const resolvedSurface = requireSitePullAggregateFeedbackSurface(surface);',
    'USER_VISIBLE_SOURCE_SURFACES.has(resolvedSurface)',
  ].forEach((token) => assertIncludes(habitCandidatesSource, token, habitCandidatesPath));

  [
    "typeof surface === 'string' && surface.length > 0",
    ': SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP',
  ].forEach((token) => assertExcludes(habitCandidatesSource, token, habitCandidatesPath));
}

async function assertHabitFeedbackCandidateContract() {
  const habitCandidatesPath = 'src/domains/stats/insights/sitePull/patterns/sitePullHabitFeedbackCandidates.js';
  const habitCandidatesSource = await readFile(habitCandidatesPath);

  [
    'function normalizeDomainProfileRows',
    'const profile = value;',
    'const profile = entry;',
    'USER_VISIBLE_SOURCE_SURFACES',
    'SITE_PULL_HABIT_FEEDBACK_SOURCE_SURFACE_NOT_VISIBLE',
    'function requireCandidateSourceItem',
    'SITE_PULL_HABIT_FEEDBACK_AGGREGATE_ITEM_SURFACE_MISMATCH',
    'SITE_PULL_HABIT_FEEDBACK_AGGREGATE_ITEM_VISIBILITY_INVALID',
    'SITE_PULL_HABIT_FEEDBACK_AGGREGATE_ITEM_SURFACE_VISIBILITY_INVALID',
    'SITE_PULL_HABIT_FEEDBACK_AGGREGATE_ITEM_CLAIM_VISIBILITY_INVALID',
    'SITE_PULL_HABIT_FEEDBACK_DOMAIN_ITEM_SURFACE_MISMATCH',
    'SITE_PULL_HABIT_FEEDBACK_DOMAIN_ITEM_VISIBILITY_INVALID',
    'SITE_PULL_HABIT_FEEDBACK_DOMAIN_ITEM_SURFACE_VISIBILITY_INVALID',
    'SITE_PULL_HABIT_FEEDBACK_DOMAIN_ITEM_CLAIM_VISIBILITY_INVALID',
    'expectedClaimVisibilities',
    'claimVisibility: item.claimVisibility',
    'surfaceVisibility: item.surfaceVisibility',
  ].forEach((token) => assertIncludes(habitCandidatesSource, token, habitCandidatesPath));

  [
    'sitePullProfile ||',
    'entry?.sitePullProfile',
    'value?.sitePullProfile',
    "visibility: item.visibility || 'visible'",
    'visibility: item.visibility || "visible"',
  ].forEach((token) => assertExcludes(habitCandidatesSource, token, habitCandidatesPath));
}

async function assertFeedbackSurfaceInventorySourceContract() {
  const inventoryPath = 'src/domains/stats/insights/sitePull/patterns/sitePullFeedbackSurfaceInventory.js';
  const inventorySource = await readFile(inventoryPath);

  [
    'const KNOWN_DOMAIN_SURFACES = new Set(Object.values(SITE_PULL_PATTERN_FEEDBACK_SURFACES));',
    'unknown_domain_surface',
    'KNOWN_AGGREGATE_SURFACES',
    'unknown_aggregate_surface',
  ].forEach((token) => assertIncludes(inventorySource, token, inventoryPath));
}

async function assertPatternDiagnosticsSourceContract() {
  const diagnosticsPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternDiagnostics.js';
  const diagnosticsSource = await readFile(diagnosticsPath);

  [
    'function hasUsageFacts(context)',
    'function hasHourlyFacts(context)',
    'function hasWeeklyFacts(context)',
    'function hasEntryFacts(context)',
    'getSitePullPersonalBaselineMetric',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS',
    'function personalBaselineActiveMetric(context)',
    'const KNOWN_DATA_FAMILIES = new Set(DATA_FAMILY_DEFINITIONS.map((definition) => definition.family));',
    'export function assertSitePullPatternDiagnosticDataFamily(family)',
    'SITE_PULL_PATTERN_DIAGNOSTIC_DATA_FAMILY_UNKNOWN',
    'SITE_PULL_PATTERN_DIAGNOSTIC_FAMILY_STATUS_MISSING',
    'personalBaseline.metrics.active_ms.confidence>=0.35',
    'personalBaseline.metrics.active_ms.sample.observedCount',
  ].forEach((token) => assertIncludes(diagnosticsSource, token, diagnosticsPath));

  [
    'featureVector.hasVisitFacts',
    'featureVector.todayVisits',
    'featureVector.todayHourly',
    'featureVector.habitHourly',
    'featureVector.weeklySeries',
    'featureVector.todayTotalMs',
    'featureVector.weeklyTotalMs',
    'context?.personalBaseline?.metrics?.active_ms',
    'personalBaseline.confidence>=0.35',
    'personalBaseline.observedDays',
    "return { status: 'unknown', reason: 'unknown data family' }",
    "status: 'unknown',\n          reason: 'family diagnostic unavailable'",
  ].forEach((token) => assertExcludes(diagnosticsSource, token, diagnosticsPath));
}

async function assertPatternAuditSummarySourceContract() {
  const calibrationPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternCalibration.js';
  const calibrationAuditPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternCalibrationAudit.js';
  const thresholdAuditPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternThresholdAudit.js';
  const calibrationSource = await readFile(calibrationPath);
  const calibrationAuditSource = await readFile(calibrationAuditPath);
  const thresholdAuditSource = await readFile(thresholdAuditPath);

  [
    'SITE_PULL_PATTERN_CALIBRATION_RESULT_STATUS_INVALID',
    'function requireCalibrationResultStatus(result)',
    'const key = requireCalibrationResultStatus(result);',
  ].forEach((token) => assertIncludes(calibrationSource, token, calibrationPath));

  [
    "const key = result.status || 'unknown'",
  ].forEach((token) => assertExcludes(calibrationSource, token, calibrationPath));

  [
    '`missing:${key}`',
  ].forEach((token) => {
    assertIncludes(calibrationAuditSource, token, calibrationAuditPath);
    assertIncludes(thresholdAuditSource, token, thresholdAuditPath);
  });

  [
    "const value = row[key] || 'unknown'",
  ].forEach((token) => {
    assertExcludes(calibrationAuditSource, token, calibrationAuditPath);
    assertExcludes(thresholdAuditSource, token, thresholdAuditPath);
  });
}

async function assertDecisionQualityAndLabelBurdenContract() {
  const decisionQualityPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternDecisionQuality.js';
  const calibrationPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternCalibration.js';
  const composerPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternComposer.js';
  const requirementsPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternRequirements.js';
  const presenterPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternPresenter.js';
  const layersPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternLayers.js';
  const decisionQualitySource = await readFile(decisionQualityPath);
  const calibrationSource = await readFile(calibrationPath);
  const composerSource = await readFile(composerPath);
  const requirementsSource = await readFile(requirementsPath);
  const presenterSource = await readFile(presenterPath);
  const layersSource = await readFile(layersPath);

  [
    'SITE_PULL_PATTERN_DECISION_QUALITY_VERSION',
    "kind: 'heuristic_evidence_quality'",
    'boundaryMargin',
    'evidenceFamilyIds',
    'caveats',
    'caveatPenalty',
  ].forEach((token) => assertIncludes(decisionQualitySource, token, decisionQualityPath));
  [
    'buildSitePullPatternDecisionQuality(pattern, spec, metrics)',
    'decisionQualityVersion: SITE_PULL_PATTERN_DECISION_QUALITY_VERSION',
    "sampleKeys: ['todayVisits']",
  ].forEach((token) => assertIncludes(calibrationSource, token, calibrationPath));
  [
    'groups.length < 2',
    'corroboratingEvidenceFamilyIds',
    'corroboratingEvidenceFamilyCount',
    'day_cooccurrence_not_ordered_loop',
  ].forEach((token) => assertIncludes(composerSource, token, composerPath));
  assertIncludes(
    requirementsSource,
    "'evidence.corroboratingEvidenceFamilyCount>=2'",
    requirementsPath,
  );
  [
    'function applyRecommendationFamilyBurden',
    "reason: 'recommendation_family_burden'",
    'function applySurfaceLabelLimit',
    "reason: 'surface_label_limit'",
  ].forEach((token) => assertIncludes(presenterSource, token, presenterPath));
  [
    'score: Number(primary.score || 0)',
    'confidence: Number(primary.confidence || 0)',
  ].forEach((token) => assertIncludes(layersSource, token, layersPath));
}

async function assertPatternRequirementsDataFamilyContract() {
  const requirementsPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternRequirements.js';
  const requirementsSource = await readFile(requirementsPath);

  [
    'function hasUsageFacts(context)',
    'function hasHourlyFacts(context)',
    'function hasWeeklyFacts(context)',
    'function hasVisitFacts(context)',
    'getSitePullPersonalBaselineMetric',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS',
    'function personalBaselineObservedDays',
  ].forEach((token) => assertIncludes(requirementsSource, token, requirementsPath));

  [
    'context?.personalBaseline?.observedDays',
    'personalBaseline.observedDays',
    'personalBaseline?.observedDays',
  ].forEach((token) => assertExcludes(requirementsSource, token, requirementsPath));

  ['hasUsageFacts', 'hasHourlyFacts', 'hasWeeklyFacts', 'hasVisitFacts'].forEach((functionName) => {
    assertFunctionSourceExcludes(requirementsSource, functionName, [
      'featureVector',
      'hasAnyActivity(context)',
    ], requirementsPath);
  });
}

async function assertPatternEvaluationContextContract() {
  const evaluatorPath = 'src/domains/stats/insights/sitePull/patterns/evaluateSitePullPatterns.js';
  const entryFactsPath = 'src/domains/stats/insights/sitePull/sitePullEntryFacts.js';
  const dataPlanDetectorPath = 'src/domains/stats/insights/sitePull/patterns/detectors/dataPlanPatterns.js';
  const habitConsistencyPath = 'src/domains/stats/insights/sitePull/patterns/sitePullHabitConsistencyEvidenceProfile.js';
  const scoreModelPath = 'src/domains/stats/insights/sitePull/scoring/sitePullScoreModel.js';
  const contributionBreakdownPath = 'src/domains/stats/insights/sitePull/scoring/sitePullContributionBreakdown.js';
  const evaluatorSource = await readFile(evaluatorPath);
  const entryFactsSource = await readFile(entryFactsPath);
  const dataPlanDetectorSource = await readFile(dataPlanDetectorPath);
  const habitConsistencySource = await readFile(habitConsistencyPath);
  const scoreModelSource = await readFile(scoreModelPath);
  const contributionBreakdownSource = await readFile(contributionBreakdownPath);

  [
    'function resolveEntryVisitSummary',
    'buildSitePullPatternContext',
  ].forEach((token) => assertIncludes(evaluatorSource, token, evaluatorPath));
  assertIncludes(
    contributionBreakdownSource,
    'resolveSitePullEntryVisitSummary',
    contributionBreakdownPath,
  );

  [
    [evaluatorPath, evaluatorSource],
    [entryFactsPath, entryFactsSource],
    [dataPlanDetectorPath, dataPlanDetectorSource],
    [habitConsistencyPath, habitConsistencySource],
    [scoreModelPath, scoreModelSource],
    [contributionBreakdownPath, contributionBreakdownSource],
  ].forEach(([path, source]) => {
    [
      'allowFeatureVectorFallback',
      'hasVisitFacts(featureVector)',
      'import { hasVisitFacts',
    ].forEach((token) => assertExcludes(source, token, path));
  });
}

async function assertDetectorEvidenceProfileConsumerContract() {
  const helperPath = 'src/domains/stats/insights/sitePull/patterns/detectors/detectorEvidenceProfiles.js';
  const evaluatorPath = 'src/domains/stats/insights/sitePull/patterns/evaluateSitePullPatterns.js';
  const composerPath = 'src/domains/stats/insights/sitePull/patterns/sitePullPatternComposer.js';
  const detectorPaths = [
    'src/domains/stats/insights/sitePull/patterns/detectors/baselinePatterns.js',
    'src/domains/stats/insights/sitePull/patterns/detectors/checkingRoutePatterns.js',
    'src/domains/stats/insights/sitePull/patterns/detectors/dataPlanPatterns.js',
    'src/domains/stats/insights/sitePull/patterns/detectors/navigationFlowPatterns.js',
    'src/domains/stats/insights/sitePull/patterns/detectors/sessionShapePatterns.js',
  ];
  const helperSource = await readFile(helperPath);
  const evaluatorSource = await readFile(evaluatorPath);
  const composerSource = await readFile(composerPath);

  [
    'export function requireSitePullDetectorEvidenceProfile',
    'SITE_PULL_DETECTOR_EVIDENCE_PROFILE_MISSING',
  ].forEach((token) => assertIncludes(helperSource, token, helperPath));

  [
    'buildSitePullCheckingEvidenceProfile({ ...options, tabContextEvidenceProfile })',
    'buildSitePullTimePressureEvidenceProfile(options)',
    'buildSitePullTrendPressureEvidenceProfile',
    'buildSitePullSessionDepthEvidenceProfile(options)',
  ].forEach((token) => assertIncludes(evaluatorSource, token, evaluatorPath));

  const forbiddenDetectorTokens = [
    '|| buildSitePull',
    'buildSitePullCheckingEvidenceProfile',
    'buildSitePullTimePressureEvidenceProfile',
    'buildSitePullTrendPressureEvidenceProfile',
    'buildSitePullHabitConsistencyEvidenceProfile',
    'buildSitePullImmersionEvidenceProfile',
    'buildSitePullNightPressureEvidenceProfile',
    'buildSitePullSustainedBlockEvidenceProfile',
    'buildSitePullSessionDepthEvidenceProfile',
    'buildSitePullControlledBriefEvidenceProfile',
    'buildSitePullInterventionOutcomeEvidenceProfile',
    'buildSitePullBackgroundResidencyEvidenceProfile',
    'buildSitePullContentFlowEvidenceProfile',
    'buildSitePullTabContextEvidenceProfile',
    'buildSitePullRoutePressureEvidenceProfile',
  ];

  for (const detectorPath of detectorPaths) {
    const source = await readFile(detectorPath);
    assertIncludes(source, 'requireSitePullDetectorEvidenceProfile', detectorPath);
    forbiddenDetectorTokens.forEach((token) => assertExcludes(source, token, detectorPath));
  }

  [
    'function requireComposerEvidenceProfile',
    'SITE_PULL_COMPOSER_EVIDENCE_PROFILE_MISSING',
    'requireComposerEvidenceProfile(',
  ].forEach((token) => assertIncludes(composerSource, token, composerPath));

  [
    'buildSitePullInterventionOutcomeEvidenceProfile',
    '|| buildSitePullInterventionOutcomeEvidenceProfile',
  ].forEach((token) => assertExcludes(composerSource, token, composerPath));
}

async function assertBoundaryMapContract() {
  const source = await readFile(boundaryMapPath);
  [
    'Status: Active',
    'Canonical for: site-pull facts, evidence profiles, pattern detection, calibration, presentation, and proxy/fallback classification',
    'Function Path Map',
    'Proxy And Fallback Policy',
    'sitePullPatternDecisionQuality.js',
    'heuristic_evidence_quality',
    'corroboratingEvidenceFamilyCount',
    'recommendation family',
    'coarse_switch_back_counter',
    'impulseCoarseSwitchBackScore',
    'SITE_PULL_FEEDBACK_SURFACE_INVALID',
    'SITE_PULL_PATTERN_FEEDBACK_SURFACE_INVALID',
    'SITE_PULL_AGGREGATE_FEEDBACK_SURFACE_INVALID',
    'SITE_PULL_AGGREGATE_COST_BUDGET_INVALID',
    'claimVisibility',
    'SITE_PULL_DETECTOR_EVIDENCE_PROFILE_MISSING',
    'SITE_PULL_COMPOSER_EVIDENCE_PROFILE_MISSING',
    'SITE_PULL_FACTS_INPUT_AUTHORITY_CONFLICT',
    'SITE_PULL_FACTS_PUBLIC_INPUT_INVALID',
    'SITE_PULL_FACTS_BUILD_INPUT_MISSING',
    'SITE_PULL_AGGREGATE_FACTS_INVALID',
    '`baselineSeries` and `baselineCurrentDateStr` are both required',
    '`observed=true, activeMs=0`',
    '`observed=false, activeMs=null`',
    'requests 31',
    'weeklySeries` never derives or repairs',
    'Legacy runtime fallback',
    'Silent empty repair',
    'check:site-pull-pattern:architecture',
  ].forEach((token) => assertIncludes(source, token, boundaryMapPath));
}

function assertDefinitionsAndRequirementsMatch({ definitions, requirements }) {
  const definitionIds = Object.keys(definitions).sort();
  const requirementIds = Object.keys(requirements).sort();
  const missingRequirements = definitionIds.filter((id) => !requirements[id]);
  const missingDefinitions = requirementIds.filter((id) => !definitions[id]);
  if (missingRequirements.length > 0) {
    fail(`pattern definitions without requirements: ${missingRequirements.join(', ')}`);
  }
  if (missingDefinitions.length > 0) {
    fail(`pattern requirements without definitions: ${missingDefinitions.join(', ')}`);
  }
}

function assertDefinitionsAndCalibrationMatch({ definitions, calibration }) {
  const definitionIds = Object.keys(definitions).sort();
  const calibrationIds = Object.keys(calibration).sort();
  const missingCalibration = definitionIds.filter((id) => !calibration[id]);
  const missingDefinitions = calibrationIds.filter((id) => !definitions[id]);
  if (missingCalibration.length > 0) {
    fail(`pattern definitions without calibration specs: ${missingCalibration.join(', ')}`);
  }
  if (missingDefinitions.length > 0) {
    fail(`pattern calibration specs without definitions: ${missingDefinitions.join(', ')}`);
  }
}

function assertComponentIdsAreDefined(definitions) {
  const definitionIds = new Set(Object.keys(definitions));
  for (const [id, definition] of Object.entries(definitions)) {
    for (const componentId of definition.componentIds || []) {
      if (!definitionIds.has(componentId)) {
        fail(`pattern "${id}" references undefined componentId "${componentId}".`);
      }
    }
  }
}

function assertComposerEmitsOnlyComposite({ definitions, composerSource }) {
  const composerIds = unique(extractCreatedPatternIds(composerSource));
  for (const id of composerIds) {
    const definition = definitions[id];
    if (!definition) {
      fail(`composer emits undefined pattern "${id}".`);
    }
    if (definition.level !== 'composite') {
      fail(`composer emits non-composite pattern "${id}".`);
    }
  }
}

function assertPresentationGroupsHaveLimits({ definitions, groupLimits }) {
  const groups = unique(Object.values(definitions)
    .map((definition) => definition?.presentation?.group)
    .filter(Boolean));
  const missingGroups = groups.filter((group) => groupLimits[group] === undefined);
  if (missingGroups.length > 0) {
    fail(`presentation groups without slot limits: ${missingGroups.join(', ')}`);
  }
}

function assertPublicExports(api) {
  const requiredExports = [
    'SITE_PULL_CHECKING_COUNTER_AUTHORITY',
    'SITE_PULL_CHECKING_EVIDENCE_PROFILE_VERSION',
    'SITE_PULL_EVIDENCE_STATUS',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_IDS',
    'SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY',
    'SITE_PULL_AGGREGATE_FEEDBACK_SURFACES',
    'SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES',
    'SITE_PULL_HABIT_FEEDBACK_CANDIDATE_SOURCES',
    'SITE_PULL_PATTERN_CALIBRATION',
    'SITE_PULL_PATTERN_CALIBRATION_AUDIT_VERSION',
    'SITE_PULL_PATTERN_CALIBRATION_DECISION_HINTS',
    'SITE_PULL_PATTERN_CALIBRATION_VERSION',
    'SITE_PULL_PATTERN_CALIBRATION_VISIBILITY_FEEDBACK_POLICY',
    'SITE_PULL_PATTERN_COMPOSER_VERSION',
    'SITE_PULL_PATTERN_DECISION_GATES',
    'SITE_PULL_PATTERN_DECISION_QUALITY_STATUSES',
    'SITE_PULL_PATTERN_DECISION_QUALITY_VERSION',
    'SITE_PULL_PATTERN_DEFINITIONS',
    'SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY',
    'SITE_PULL_FEEDBACK_SURFACE_INVENTORY_AUDIT_VERSION',
    'SITE_PULL_FEEDBACK_SURFACE_INVENTORY_VERSION',
    'SITE_PULL_FEEDBACK_SURFACE_PRESENTER_VERSION',
    'SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY',
    'SITE_PULL_PATTERN_FEEDBACK_ROLES',
    'SITE_PULL_PATTERN_FEEDBACK_SURFACES',
    'SITE_PULL_PATTERN_LAYER_VERSION',
    'SITE_PULL_PATTERN_PRESENTATION_GROUP_LIMITS',
    'SITE_PULL_PATTERN_PRESENTATION_SURFACE_LIMITS',
    'SITE_PULL_PATTERN_PRESENTER_VERSION',
    'SITE_PULL_PATTERN_REQUIREMENTS',
    'SITE_PULL_PATTERN_REQUIREMENTS_VERSION',
    'SITE_PULL_PATTERN_THRESHOLD_AUDIT_VERSION',
    'SITE_PULL_PATTERN_THRESHOLD_SPECS',
    'SITE_PULL_TEMPORAL_EVIDENCE_SOURCE_MODES',
    'SITE_PULL_THRESHOLD_GATE_TYPES',
    'SITE_PULL_THRESHOLD_SHAPES',
    'SITE_PULL_THRESHOLD_STAGES',
    'SITE_PULL_PATTERN_TUNING_SURFACES',
    'assertSitePullFactsInputAuthority',
    'buildSitePullCheckingEvidenceProfile',
    'buildSitePullDomainBadgeFeedbackItems',
    'buildSitePullDomainDetailFeedbackItems',
    'buildSitePullDomainDiagnosticFeedbackRows',
    'buildSitePullDomainFeedbackItems',
    'buildSitePullDomainFeedbackSurfaceModel',
    'buildSitePullDomainRecapFeedbackCandidates',
    'buildSitePullAggregateFeedbackItems',
    'buildSitePullHabitFeedbackCandidateModel',
    'buildSitePullFeedbackSurfaceInventoryAudit',
    'buildSitePullPersonalBaselineMetricProfiles',
    'buildSitePullPersonalBaselineMetricScores',
    'resolveSitePullPersonalBaselineMetricScores',
    'buildSitePullPatternCalibrationAuditReport',
    'buildSitePullPatternDecisionQuality',
    'buildSitePullPatternLayers',
    'buildSitePullPatternThresholdAuditReport',
    'calibrateSitePullPatternSignal',
    'calibrateSitePullPatternSignals',
    'getSitePullPatternCalibration',
    'getSitePullPersonalBaselineMetric',
    'isSitePullEvidenceStatusAtLeast',
    'presentSitePullPatterns',
    'requireSitePullAggregateFeedbackSurface',
    'requireSitePullPatternFeedbackSurface',
    'validateSitePullPatternSignal',
  ];
  const missingExports = requiredExports.filter((name) => api[name] === undefined);
  if (missingExports.length > 0) {
    fail(`sitePull index is missing pattern architecture exports: ${missingExports.join(', ')}`);
  }
}

function assertCalibrationAuditPasses(api) {
  const report = api.buildSitePullPatternCalibrationAuditReport();
  if (report.status !== 'pass' || report.blockingIssues.length > 0) {
    fail(`calibration audit has blocking issues: ${report.blockingIssues.map((entry) => `${entry.id}:${entry.code}`).join(', ')}`);
  }
  const quickReturn = report.rows.find((row) => row.id === 'quick_return_loop');
  if (
    quickReturn?.feedbackRole !== api.SITE_PULL_PATTERN_FEEDBACK_ROLES.SUPPORTING_EVIDENCE
    || quickReturn.badgeEligible !== false
    || quickReturn.diagnosticEligible !== true
  ) {
    fail('calibration audit must bind shadow quick_return_loop to supporting diagnostic feedback only.');
  }
  const shadowPolicy = api.SITE_PULL_PATTERN_CALIBRATION_VISIBILITY_FEEDBACK_POLICY?.shadow;
  if (
    shadowPolicy?.requiredRole !== api.SITE_PULL_PATTERN_FEEDBACK_ROLES.SUPPORTING_EVIDENCE
    || !shadowPolicy.forbiddenSurfaces?.includes(api.SITE_PULL_PATTERN_FEEDBACK_SURFACES.BADGE)
    || !shadowPolicy.requiredSurfaces?.includes(api.SITE_PULL_PATTERN_FEEDBACK_SURFACES.DIAGNOSTIC)
  ) {
    fail('calibration visibility feedback policy must keep shadow labels out of badge feedback.');
  }
}

function assertCheckingEvidenceProfileContract(api) {
  const profile = api.buildSitePullCheckingEvidenceProfile({
    featureVector: { todayVisits: 4 },
    facts: {
      behavior: {
        hasBehaviorFacts: true,
        switchIns: 2,
        switchBackWithin10m: 1,
      },
    },
  });
  if (profile?.quickReturn?.status !== api.SITE_PULL_EVIDENCE_STATUS.WEAK) {
    fail('checking evidence profile must preserve weak quick-return evidence before detector emission.');
  }
  if (profile.quickReturn.canEmitAtomic !== false || profile.quickReturn.canSupportComposite !== true) {
    fail('weak quick-return evidence must support composites without emitting atomic labels.');
  }
  if (!profile.counterAuthority?.switchBackWithin10m?.owner) {
    fail('checking evidence profile must expose counter authority metadata.');
  }
  if (!api.isSitePullEvidenceStatusAtLeast(
    api.SITE_PULL_EVIDENCE_STATUS.CANDIDATE,
    api.SITE_PULL_EVIDENCE_STATUS.WEAK,
  )) {
    fail('checking evidence status ordering is invalid.');
  }
}

function assertThresholdAuditContract(api) {
  const report = api.buildSitePullPatternThresholdAuditReport();
  if (report.status !== 'pass' || report.blockingIssues.length > 0) {
    fail(`threshold audit has blocking issues: ${report.blockingIssues.map((entry) => `${entry.id}:${entry.code}`).join(', ')}`);
  }
  const thresholdIds = new Set(report.thresholdRows.map((row) => row.id));
  if (!thresholdIds.has('collection.reentry_gap_buckets')) {
    fail('threshold audit must include reentry gap bucket boundaries.');
  }
  if (!thresholdIds.has('status.session_fragmentation.candidate')) {
    fail('threshold audit must include session fragmentation status thresholds.');
  }
  if (!Array.isArray(report.reviewQueues?.bucketIntervals)) {
    fail('threshold audit must expose bucket interval review queue.');
  }
  const hasFeedbackBadgePolicy = report.thresholdRows.some((row) => (
    row.patternId === 'protected_route_return'
    && row.id === 'feedback_surface.badge_policy'
  ));
  if (!hasFeedbackBadgePolicy) {
    fail('threshold audit must include feedback surface badge policy rows for non-badge patterns.');
  }
  if (!report.reviewQueues?.presentation?.includes('protected_route_return')) {
    fail('threshold audit presentation review queue must include non-badge feedback policies.');
  }
}

function assertFeedbackSurfaceInventoryAuditPasses(api) {
  const report = api.buildSitePullFeedbackSurfaceInventoryAudit();
  if (report.ok !== true || report.blockingIssues.length > 0) {
    const issueSummary = report.blockingIssues
      .map((entry) => `${entry.id}:${entry.code}`)
      .join(', ');
    fail(`feedback surface inventory audit has blocking issues: ${issueSummary}`);
  }
  if (report.summary?.badgeEligibleRows <= 0) {
    fail('feedback surface inventory must expose badge-eligible domain rows.');
  }
  if (report.summary?.enabledAggregateRows <= 0) {
    fail('feedback surface inventory must expose enabled aggregate rows.');
  }
  const detailItems = api.buildSitePullDomainDetailFeedbackItems([
    { id: 'quick_return_loop', score: 72, confidence: 0.66 },
  ]);
  const quickReturn = detailItems.find((item) => item.patternId === 'quick_return_loop');
  if (
    quickReturn?.visibility !== api.SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY.VISIBLE
    || quickReturn.surfaceVisibility !== api.SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY.VISIBLE
    || quickReturn.claimVisibility !== api.SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY.SUPPORTING
  ) {
    fail('domain detail feedback must keep quick_return_loop visible as supporting evidence, not a primary claim.');
  }
  const diagnosticRows = api.buildSitePullDomainDiagnosticFeedbackRows([
    { id: 'visit_spike', score: 70, confidence: 0.66 },
  ]);
  const visitSpike = diagnosticRows.find((item) => item.patternId === 'visit_spike');
  if (
    visitSpike?.visibility !== api.SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY.DIAGNOSTIC
    || visitSpike.surfaceVisibility !== api.SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY.DIAGNOSTIC
    || visitSpike.claimVisibility !== api.SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY.DIAGNOSTIC
  ) {
    fail('domain diagnostic feedback must keep visit_spike diagnostic-only.');
  }
}

function assertAggregateFeedbackRuntimeContract(api) {
  const analysis = {
    enabled: true,
    patterns: [{
      id: 'protected_checking_pressure',
      outputSurfaces: [
        api.SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.SITES_OVERVIEW,
        api.SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP,
        api.SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.DIAGNOSTIC,
      ],
      recommendationFamily: 'checking_cooldown',
      status: api.SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.ELEVATED,
      score: 70,
      confidence: 0.72,
      evidence: {
        analyzedDomainCount: 2,
        todayVisits: 8,
        quickReturnEvents: 3,
      },
    }],
  };
  const sitesOverview = api.buildSitePullAggregateFeedbackItems(analysis, {
    surface: api.SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.SITES_OVERVIEW,
  })[0];
  const recap = api.buildSitePullAggregateFeedbackItems(analysis, {
    surface: api.SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP,
  })[0];
  const diagnostic = api.buildSitePullAggregateFeedbackItems(analysis, {
    surface: api.SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.DIAGNOSTIC,
  })[0];

  if (
    sitesOverview?.surfaceVisibility !== api.SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY.VISIBLE
    || sitesOverview.claimVisibility !== api.SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY.PRIMARY
  ) {
    fail('aggregate rules overview feedback must remain a visible primary claim.');
  }
  if (
    recap?.surfaceVisibility !== api.SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY.VISIBLE
    || recap.claimVisibility !== api.SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY.RECAP_CONTEXT
  ) {
    fail('aggregate recap feedback must remain visible recap context, not a primary claim.');
  }
  if (
    diagnostic?.surfaceVisibility !== api.SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY.DIAGNOSTIC
    || diagnostic.claimVisibility !== api.SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY.DIAGNOSTIC
  ) {
    fail('aggregate diagnostic feedback must remain diagnostic-only.');
  }
}

function assertHabitFeedbackCandidateRuntimeContract(api) {
  const domainRecapItems = api.buildSitePullDomainRecapFeedbackCandidates([
    {
      id: 'quick_return_loop',
      score: 66,
      confidence: 0.64,
      evidence: {
        todaySwitchBackWithin10m: 3,
        todaySwitchIns: 6,
      },
    },
  ]);
  const model = api.buildSitePullHabitFeedbackCandidateModel({
    domainProfiles: {
      'social.example': {
        domain: 'social.example',
        feedbackSurfaces: { recap: domainRecapItems },
      },
    },
    aggregateAnalysis: {
      enabled: true,
      patterns: [{
        id: 'protected_checking_pressure',
        outputSurfaces: [api.SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP],
        recommendationFamily: 'checking_cooldown',
        status: api.SITE_PULL_AGGREGATE_PATTERN_RESULT_STATUSES.ELEVATED,
        score: 81,
        confidence: 0.8,
        evidence: {
          analyzedDomainCount: 2,
          todayVisits: 8,
          quickReturnEvents: 3,
        },
      }],
    },
    surface: api.SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP,
  });
  const aggregateCandidate = model.candidates.find((candidate) => (
    candidate.source === api.SITE_PULL_HABIT_FEEDBACK_CANDIDATE_SOURCES.AGGREGATE_RECAP
  ));
  const quickReturnCandidate = model.candidates.find((candidate) => (
    candidate.patternId === 'quick_return_loop'
  ));

  if (
    aggregateCandidate?.surfaceVisibility !== api.SITE_PULL_AGGREGATE_FEEDBACK_VISIBILITY.VISIBLE
    || aggregateCandidate.claimVisibility !== api.SITE_PULL_AGGREGATE_FEEDBACK_CLAIM_VISIBILITY.RECAP_CONTEXT
  ) {
    fail('habit feedback aggregate recap candidates must preserve recap-context claim visibility.');
  }
  if (
    quickReturnCandidate?.surfaceVisibility !== api.SITE_PULL_FEEDBACK_SURFACE_ITEM_VISIBILITY.VISIBLE
    || quickReturnCandidate.claimVisibility !== api.SITE_PULL_FEEDBACK_SURFACE_CLAIM_VISIBILITY.SUPPORTING
  ) {
    fail('habit feedback domain recap candidates must preserve supporting-evidence claim visibility.');
  }
}

async function main() {
  const api = await importSitePullIndex();
  assertPublicExports(api);
  await assertNoFeedDecisionEvidence();
  await assertAnalysisInputDirection();

  const definitions = api.SITE_PULL_PATTERN_DEFINITIONS;
  const requirements = api.SITE_PULL_PATTERN_REQUIREMENTS;
  const calibration = api.SITE_PULL_PATTERN_CALIBRATION;
  const groupLimits = api.SITE_PULL_PATTERN_PRESENTATION_GROUP_LIMITS;
  const compositeIds = new Set(Object.entries(definitions)
    .filter(([, definition]) => definition.level === 'composite')
    .map(([id]) => id));

  assertDefinitionsAndRequirementsMatch({ definitions, requirements });
  assertDefinitionsAndCalibrationMatch({ definitions, calibration });
  assertCalibrationAuditPasses(api);
  assertCheckingEvidenceProfileContract(api);
  assertThresholdAuditContract(api);
  assertFeedbackSurfaceInventoryAuditPasses(api);
  assertAggregateFeedbackRuntimeContract(api);
  assertHabitFeedbackCandidateRuntimeContract(api);
  await assertFactSummaryOwnership();
  await assertBaselineSeriesSourceContract();
  await assertWeeklyObservationContract();
  await assertTemporalEvidenceSourceContract();
  await assertPersonalBaselineContract();
  await assertNavigationIntentMetricsContract();
  await assertImmersionEvidenceSourceContract();
  await assertContextModelMeaningContract();
  await assertSequenceCompositionContract();
  await assertCheckingEvidenceEntrySourceContract();
  await assertDataCoverageContract();
  await assertSessionEvidenceSourceContract();
  await assertQuickReturnCounterAuthorityNaming();
  await assertFeedbackSurfacePresenterContract();
  await assertAggregateAnalysisFactsContract();
  await assertAggregateCostBudgetContract();
  await assertAggregateFeedbackSurfaceContract();
  await assertHabitFeedbackCandidateContract();
  await assertFeedbackSurfaceInventorySourceContract();
  await assertPatternDiagnosticsSourceContract();
  await assertPatternAuditSummarySourceContract();
  await assertDecisionQualityAndLabelBurdenContract();
  await assertPatternRequirementsDataFamilyContract();
  await assertPatternEvaluationContextContract();
  await assertDetectorEvidenceProfileConsumerContract();
  await assertBoundaryMapContract();
  assertComponentIdsAreDefined(definitions);
  assertPresentationGroupsHaveLimits({ definitions, groupLimits });
  await assertNoRuntimeBoundaryAccess();
  await assertNoDetectorCompositeEmit(compositeIds);
  assertComposerEmitsOnlyComposite({
    definitions,
    composerSource: await readFile('src/domains/stats/insights/sitePull/patterns/sitePullPatternComposer.js'),
  });

  console.log(
    `[${label}] PASS: pattern definitions, requirements, calibration audit, threshold audit, `
      + 'feedback surface inventory, fact-summary ownership, temporal evidence source contract, navigation/session evidence source contracts, data coverage contract, feedback surface contract, aggregate surface contract, aggregate cost contract, composer ownership, and presenter group limits are aligned.',
  );
}

async function assertSequenceCompositionContract() {
  const prefix = 'src/domains/stats/insights/sitePull/';
  const routePath = `${prefix}patterns/sitePullRoutePressureEvidenceProfile.js`;
  const route = await readFile(routePath);
  ['featureVector', 'weekly.count ||', 'weekly.returnWithin10m ||', 'transitionEdgeFacts.confidence ||']
    .forEach(token => assertExcludes(route, token, routePath));
  ['edge.scopeDirection === direction', 'orderedSequenceObserved: false', 'normalizeSeries(series).slice(-7)']
    .forEach(token => assertIncludes(route, token, routePath));
  const tabsPath = `${prefix}patterns/sitePullTabContextEvidenceProfile.js`;
  const tabs = await readFile(tabsPath);
  ['checkingEvidenceProfile', 'channelConfirmationScore', 'facts?.navigation?.total']
    .forEach(token => assertExcludes(tabs, token, tabsPath));
  assertIncludes(tabs, 'totalEntrances: null, newTabShare: null, duplicateShare: null', tabsPath);
  const checkingPath = `${prefix}patterns/sitePullCheckingEvidenceProfile.js`;
  assertExcludes(await readFile(checkingPath), 'function buildTabContextEvidence', checkingPath);
  const outcomePath = `${prefix}patterns/sitePullInterventionOutcomeEvidenceProfile.js`;
  const outcome = await readFile(outcomePath);
  assertExcludes(outcome, 'subscores', outcomePath);
  ["'resistanceEligible'", "'effectivenessEligible'", "followupMaturity: 'unavailable'"]
    .forEach(token => assertIncludes(outcome, token, outcomePath));
  const helperPath = `${prefix}sitePullInterventionFacts.js`;
  assertFunctionSourceExcludes(await readFile(helperPath), 'computeSitePullInterventionReentryIntensity',
    ['continued', 'escapeClosed', 'reentry5Rate'], helperPath);
  const qualityPath = `${prefix}patterns/sitePullPatternDecisionQuality.js`;
  const quality = await readFile(qualityPath);
  ['corroborationStrength', 'caveats.length *', 'evidenceFamilyIds.length /']
    .forEach(token => assertExcludes(quality, token, qualityPath));
  assertIncludes(quality, 'Math.min(confidenceStrength', qualityPath);
  const layerPath = `${prefix}patterns/sitePullPatternLayers.js`;
  assertIncludes(await readFile(layerPath), 'evidence: primary.evidence', layerPath);
}

main().catch((error) => {
  console.error(`[${label}] Unexpected error:`, error);
  process.exit(1);
});
