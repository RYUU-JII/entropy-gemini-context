#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const failures = [];

const files = Object.freeze({
  vocabulary: 'src/lib/personalBaselineContract.js',
  libPublic: 'src/lib/index.js',
  statsCore: 'src/domains/stats/baseline/personalBaselineCore.js',
  statsPublic: 'src/domains/stats/baseline/index.js',
  usage: 'src/domains/stats/analysis/usageBaseline.js',
  scoringEngine: 'src/domains/stats/analysis/scoringEngine.js',
  scoreReference: 'src/domains/stats/analysis/scoreRuleReference.js',
  scoreLedger: 'src/domains/stats/analysis/scoreLedger.js',
  scoreSetup: 'src/domains/stats/analysis/scoreSetupRecommendations.js',
  scoreSetupCandidateHelper: 'src/domains/stats/background/query/statsSiteIntelReadModelHelpers.js',
  scoreSetupSitesReadModel: 'src/domains/stats/background/query/statsSitesSnapshotReadModel.js',
  scoreSetupStatusReadModel: 'src/domains/stats/background/query/statsStatusSnapshotReadModel.js',
  scoreSetupReview: 'src/themes/core/widgets/shared/sites/SiteGoalRecommendation.jsx',
  sitesRouteAdapter: 'src/apps/dashboard/tabs/sites/SitesTab.jsx',
  sitesManagementSurface: 'src/apps/dashboard/workspaces/sites/SitesManagementSurface.jsx',
  scoreSetupMutations: 'src/apps/dashboard/tabs/sites/controller/useSitesMutations.js',
  rollingPressure: 'src/domains/stats/analysis/rollingPressureModel.js',
  statusQueryShared: 'src/domains/stats/background/query/statsAnalysisQueryShared.js',
  statusCandidatePool: 'src/domains/stats/analysis/buildStatusDomainCandidatePool.js',
  homeScan: 'src/apps/dashboard/tabs/main/home/buildHomeScanSnapshot.js',
  homeRollingPressureEvidence: 'src/apps/dashboard/tabs/main/home/rollingPressureEvidence.js',
  homeInsightPresentation: 'src/apps/dashboard/tabs/main/home/homeInsightPresentation.js',
  sessionSummaryNarrationInput: 'src/apps/dashboard/ai/sessionSummaryPresentation.js',
  usageInsightNarrationInput: 'src/domains/ai/tasks/usageInsight/buildUsageInsightNarrationInput.js',
  sitesHud: 'src/apps/dashboard/tabs/sites/components/SitesHud.jsx',
  sitesCapAdmission: 'src/apps/dashboard/tabs/sites/components/sitesCapAdmission.js',
  sitesCapControl: 'src/apps/dashboard/tabs/sites/components/SitesCapControl.jsx',
  sitesSiteCap: 'src/apps/dashboard/tabs/sites/components/SitesSiteCap.jsx',
  sitesCapEditor: 'src/apps/dashboard/tabs/sites/components/useSitesCapEditor.js',
  sitesGlobalCapEditor: 'src/apps/dashboard/tabs/sites/components/useSitesGlobalCapEditor.js',
  sitesWorkspace: 'src/apps/dashboard/tabs/sites/components/SitesWorkspace.jsx',
  sitesGlobalCapTrigger: 'src/apps/dashboard/tabs/sites/components/ZenSitesGlobalCapTrigger.jsx',
  sitesBoundaryMap: 'docs/architecture/repository/sites-schedule-boundary-map.md',
  sitesGlobalCapModel: 'src/apps/dashboard/tabs/sites/components/sitesGlobalCapModel.js',
  sitesGlobalExposureAverageContract: 'src/domains/stats/contracts/sitesGlobalExposureAverageContract.js',
  basicStrategy: 'src/domains/protection/strategy/catalog/basicStrategyPolicy.js',
  basicContextContract: 'src/domains/protection/strategy/contracts/basicStrategyContextContract.js',
  basicTrajectory: 'src/domains/protection/domain/basicProtectionRecentTrajectory.js',
  basicOrchestrator: 'src/domains/protection/background/strategy/BasicStrategyOrchestrator.js',
  strategyContract: 'src/domains/protection/strategy/contracts/strategyContracts.js',
  protectionDecision: 'src/domains/protection/domain/protectionRuntimeDecision.js',
  runtimeInputProvider: 'src/domains/protection/background/ProtectionRuntimeInputProvider.js',
  protectionSnapshotBridge: 'src/domains/protection/contracts/protectionRuntimeSnapshotBridge.js',
  protectionRuntimeInsights: 'src/apps/dashboard/utils/protectionRuntimeInsights.js',
  dashboardLaunchContext: 'src/apps/dashboard/bootstrap/dashboardLaunchContext.js',
  protectionNudgeDispatchContext: 'src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchContext.js',
  filterLocaleEn: 'src/i18n/locales/en/filter.js',
  filterLocaleKo: 'src/i18n/locales/ko/filter.js',
  basicPolicyTest: 'tests/basicStrategyPolicy.test.js',
  basicStrategyDoc: 'docs/product/dashboard/basic-protection-strategy-prd.md',
  siteFeatureVector: 'src/domains/stats/insights/features/buildSiteFeatureVector.js',
  siteInsightModel: 'src/domains/stats/insights/buildSiteInsightModel.js',
  targetPanelViewModel: 'src/apps/dashboard/tabs/sites/presentation/targetPanelViewModel.js',
  siteDecisionWorkspace: 'src/themes/core/widgets/shared/sites/SiteDecisionWorkspace.jsx',
  sitesGlobalExposureAverageReadModel: 'src/domains/stats/background/query/sitesGlobalExposureAverageReadModel.js',
  sitesCompletedActivityDays: 'src/domains/stats/background/query/sitesCompletedActivityDays.js',
  sitePullBaseline: 'src/domains/stats/insights/sitePull/personalBaseline.js',
  sitePullBaselineSource: 'src/domains/stats/insights/sitePull/baselineSeriesSource.js',
  sitePullFacts: 'src/domains/stats/insights/sitePull/buildSitePullFacts.js',
  sitePullBaselinePublicContract: 'src/domains/stats/insights/sitePull/personalBaselinePublicContract.js',
  sitePullMetrics: 'src/domains/stats/insights/sitePull/personalBaselineMetrics.js',
  sitePullPolicy: 'src/domains/stats/insights/sitePull/personalBaselinePolicy.js',
  sitePullTemporal: 'src/domains/stats/insights/sitePull/temporalEvidence.js',
  sitePullTrendPressure: 'src/domains/stats/insights/sitePull/patterns/sitePullTrendPressureEvidenceProfile.js',
  sitePullScoreModel: 'src/domains/stats/insights/sitePull/scoring/sitePullScoreModel.js',
  sitePullProfile: 'src/domains/stats/insights/sitePull/computeSitePullProfile.js',
  siteIntelReadModelHelpers: 'src/domains/stats/background/query/statsSiteIntelReadModelHelpers.js',
  sitesSiteDetailReadModel: 'src/domains/stats/background/query/statsSitesSiteDetailReadModel.js',
  sitesSiteDetailQuery: 'src/domains/stats/background/query/statsSitesSiteDetailQueryService.js',
  sitesEvidenceQuery: 'src/domains/stats/background/query/statsSitesEvidenceQuery.js',
  clseContract: 'src/platform/storage/clse/clseBaselineStorageContract.js',
  clseRecordContracts: 'src/platform/storage/internal/indexeddb/stores/clseRecordContracts.js',
  clseStore: 'src/platform/storage/internal/indexeddb/stores/ClseStore.js',
  clseRepository: 'src/platform/storage/clse/ClseRepository.js',
  clseImportPreflight: 'src/platform/storage/internal/indexeddb/dbImportSnapshot.js',
  clseSnapshotRepository: 'src/platform/storage/internal/indexeddb/IndexedDbSnapshotRepository.js',
  clseStatePolicy: 'src/domains/behavior/clseBaselineStatePolicy.js',
  clseRead: 'src/domains/behavior/clseBaselineReadContract.js',
  clseStatus: 'src/domains/behavior/clseStatusContract.js',
  clseBaseline: 'src/domains/behavior/detection/BaselineManager.js',
  clseDetectionPolicy: 'src/domains/behavior/detection/clseDetectionPolicy.js',
  clseRiskReference: 'src/domains/behavior/detection/clseRiskOnlyReference.js',
  clseAggression: 'src/domains/behavior/detection/BehaviorAggressionScorer.js',
  clseSustained: 'src/domains/behavior/detection/SustainedLoadDetector.js',
  clseStorageMutationLifecycle: 'src/domains/behavior/clseStorageMutationLifecycle.js',
  clseService: 'src/domains/behavior/CLSEService.js',
  clseServicePublic: 'src/domains/behavior/CLSEService.public.js',
  clseServiceClient: 'src/domains/behavior/CLSEServiceClient.js',
  clseLab: 'src/apps/dashboard/tabs/experiment/clse/CLSELab.jsx',
  dopamineDetector: 'src/domains/nudge/attention/dopamineBingeDetector.js',
  dopamineRuntime: 'src/domains/nudge/attention/dopamineBingeEvidenceRuntime.js',
  dopamineReadiness: 'src/domains/nudge/interaction/ensoGateReadiness.js',
  feedTempoContracts: 'src/domains/nudge/feed-flow/tempo/feedTempoContracts.js',
  feedTempoEpisodeAssembler: 'src/domains/nudge/feed-flow/tempo/FeedTempoEpisodeAssembler.js',
  feedTempoAdaptiveModel: 'src/domains/nudge/feed-flow/tempo/feedTempoAdaptiveProfileModel.js',
  feedTempoProfileLearner: 'src/domains/nudge/feed-flow/tempo/FeedTempoProfileLearner.js',
  feedTempoPersistenceService: 'src/domains/nudge/feed-flow/tempo/FeedTempoPersistentProfileService.js',
  feedTempoRuntime: 'src/domains/nudge/feed-flow/tempo/FeedTempoRuntime.js',
  feedTempoCheckpointContract: 'src/platform/storage/model/FeedTempoProfileCheckpointContract.js',
  feedTempoCheckpointRepository: 'src/platform/storage/model/FeedTempoProfileCheckpointRepository.js',
  feedTempoDiagnosticState: 'src/domains/nudge/feed-flow/diagnostics/feedFlowDiagnosticState.js',
  feedFlowRuntime: 'src/domains/nudge/feed-flow/index.js',
  feedFlowJudge: 'src/domains/nudge/feed-flow/judge/FeedFlowJudge.js',
  boundaryMap: 'docs/architecture/repository/personal-baseline-boundary-map.md',
});

const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);

function fail(message) {
  failures.push(message);
}

function absolute(relativePath) {
  return path.resolve(rootDir, relativePath);
}

async function read(relativePath) {
  try {
    return await fs.readFile(absolute(relativePath), 'utf8');
  } catch (error) {
    fail(`${relativePath}: required personal-baseline architecture file is missing.`);
    return '';
  }
}

function requireIncludes(source, relativePath, markers) {
  markers.forEach((marker) => {
    if (!source.includes(marker)) {
      fail(`${relativePath}: missing required marker: ${marker}`);
    }
  });
}

function requireExcludes(source, relativePath, markers) {
  markers.forEach((marker) => {
    if (source.includes(marker)) {
      fail(`${relativePath}: forbidden marker is present: ${marker}`);
    }
  });
}

function requirePattern(source, relativePath, pattern, explanation) {
  if (!pattern.test(source)) {
    fail(`${relativePath}: ${explanation}`);
  }
}

function forbidPattern(source, relativePath, pattern, explanation) {
  if (pattern.test(source)) {
    fail(`${relativePath}: ${explanation}`);
  }
}

function requireOrdered(source, relativePath, markers, explanation) {
  let cursor = 0;
  for (const marker of markers) {
    const next = source.indexOf(marker, cursor);
    if (next < 0) {
      fail(`${relativePath}: ${explanation}; missing or out-of-order marker: ${marker}`);
      return;
    }
    cursor = next + marker.length;
  }
}

function readSection(source, startMarker, endMarker = null) {
  const start = source.indexOf(startMarker);
  if (start < 0) return '';
  const end = endMarker ? source.indexOf(endMarker, start + startMarker.length) : -1;
  return source.slice(start, end >= 0 ? end : undefined);
}

async function collectSourceFiles(relativeDir) {
  const entries = await fs.readdir(absolute(relativeDir), { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name).replaceAll(path.sep, '/');
    if (entry.isDirectory()) {
      result.push(...await collectSourceFiles(relativePath));
      continue;
    }
    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      result.push(relativePath);
    }
  }
  return result;
}

async function requirePathAbsent(relativePath, explanation) {
  try {
    await fs.access(absolute(relativePath));
    fail(`${relativePath}: ${explanation}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function checkSharedVocabularyAndBuilder(sources) {
  const vocabulary = sources[files.vocabulary];
  requireIncludes(vocabulary, files.vocabulary, [
    'PERSONAL_BASELINE_ROLES',
    "OBSERVED_BASELINE: 'observed_baseline'",
    "RECENT_TRAJECTORY: 'recent_trajectory'",
    "ADAPTIVE_REFERENCE: 'adaptive_reference'",
    "NORMATIVE_ANCHOR: 'normative_anchor'",
    'PERSONAL_BASELINE_STATUSES',
    "SPARSE: 'sparse'",
    "FORMING: 'forming'",
    "STABLE: 'stable'",
    'PERSONAL_BASELINE_REFERENCE_MODES',
    "NORMATIVE_ONLY: 'normative_only'",
    "BOUNDED_ADAPTIVE: 'bounded_adaptive'",
    'PERSONAL_BASELINE_METRIC_GRAINS',
    "DAY: 'day'",
    "BUCKET_10S: 'bucket_10s'",
    "BUCKET_60S: 'bucket_60s'",
    "PAGED_ITEM_DWELL: 'paged_item_dwell'",
    'PERSONAL_BASELINE_METRIC_DIRECTIONS',
    "HIGHER: 'higher'",
  ]);

  requireIncludes(sources[files.libPublic], files.libPublic, [
    'PERSONAL_BASELINE_ROLES',
    'PERSONAL_BASELINE_STATUSES',
    'PERSONAL_BASELINE_REFERENCE_MODES',
    'PERSONAL_BASELINE_METRIC_GRAINS',
    'PERSONAL_BASELINE_METRIC_DIRECTIONS',
    "from './personalBaselineContract.js'",
  ]);

  requireIncludes(sources[files.statsCore], files.statsCore, [
    "STATS_PERSONAL_BASELINE_CORE_VERSION = 'stats-personal-baseline-core-v3'",
    'personalBaselineContract.js',
    'buildPersonalBaselineMetricProfile',
    'buildPersonalBaselineMetricProfileMap',
    'derivePersonalBaselineMetricAnomaly',
    'STATS_PERSONAL_BASELINE_ROLES.OBSERVED_BASELINE',
    'observedCount',
    'eligibleCount',
    'ineligibleCount',
    'missingCount',
    'exposureTotal',
    'provenance',
    'resolveStatsOptions',
    'resolveAnomalyOptions',
    'resolveConfidenceOptions',
    'STATS_PERSONAL_BASELINE_METRIC_OPTION_FIELD_INVALID',
    'STATS_PERSONAL_BASELINE_METRIC_PROFILE_NUMBER_INVALID',
    'STATS_PERSONAL_BASELINE_METRIC_OBSERVATION_SHAPE_INVALID',
    'Math.max(sample.valueTotal, sample.exposureTotal)',
    'currentObserved: current.observed',
    '/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/',
  ]);
  requireExcludes(sources[files.statsCore], files.statsCore, [
    'confidenceInput',
    'baseConfidence',
    'computeTrendAnomaly',
    'includeTrend',
    'trendOptions',
    'anomalyComputeOptions',
    'descriptor.confidence =',
  ]);
  forbidPattern(
    sources[files.statsCore],
    files.statsCore,
    /today(?:Value|Ms):\s*currentValue[\s\S]{0,240}\.\.\.anomalyOptions/gu,
    'canonical current facts must be applied after policy options so options cannot override them.',
  );

  requireIncludes(sources[files.statsPublic], files.statsPublic, [
    'STATS_PERSONAL_BASELINE_ROLES',
    'STATS_PERSONAL_BASELINE_METRIC_GRAINS',
    'STATS_PERSONAL_BASELINE_METRIC_DIRECTIONS',
    'buildPersonalBaselineMetricProfile',
    'buildPersonalBaselineMetricProfileMap',
    'derivePersonalBaselineMetricAnomaly',
    "from './personalBaselineCore.js'",
  ]);
  requireExcludes(sources[files.statsPublic], files.statsPublic, [
    'computeRobustStats',
    'computeRobustValueStats',
    'computeBaselineConfidence',
    'computeInteractionConfidence',
    'computeTimeAnomaly',
    'computeValueAnomaly',
    'percentile',
    'toBaselineNumber',
  ]);
}

async function checkNoStatsCoreDeepImports() {
  const sourceFiles = await collectSourceFiles('src');
  const allowedPath = files.statsPublic;
  const deepImportPattern = /(?:from\s*|import\s*\()\s*['"][^'"]*personalBaselineCore\.js['"]/u;
  for (const relativePath of sourceFiles) {
    if (relativePath === allowedPath) continue;
    const source = await read(relativePath);
    if (deepImportPattern.test(source)) {
      fail(`${relativePath}: consumers must import the stats personal-baseline core through ${allowedPath}.`);
    }
  }
}

function checkDailyConsumers(sources) {
  const usage = sources[files.usage];
  requireIncludes(usage, files.usage, [
    "from '../baseline/index.js'",
    'personalBaselineContract.js',
    'PERSONAL_BASELINE_STATUSES',
    'USAGE_BASELINE_STATUS = PERSONAL_BASELINE_STATUSES',
    'buildPersonalBaselineMetricProfile',
    'STATS_PERSONAL_BASELINE_METRIC_GRAINS.DAY',
    'STATS_PERSONAL_BASELINE_ROLES.OBSERVED_BASELINE',
    'USAGE_BASELINE_PROFILE_KEYS',
    "'status', 'observationValues'",
    'requireCanonicalUsageObservationValues',
    'USAGE_BASELINE_OBSERVATION_VALUES_INVALID',
    'USAGE_BASELINE_DERIVATION_MISMATCH',
    'profile.currentObserved !== false',
    'requireExpectedUsageBaselineIdentity',
    'USAGE_BASELINE_CONTEXT_MISMATCH',
    'USAGE_BASELINE_STATS_RELATION_INVALID',
    'sample.positiveCount !== sample.eligibleCount',
    'sample.exposureTotal !== sample.valueTotal',
    'date.setDate(date.getDate() - ageDays)',
    'USAGE_BASELINE_DAY_DOMAIN_ACTIVE_INVALID',
    'USAGE_BASELINE_STATS_DATES_INVALID',
    "windowBasis: 'completed_day'",
    'excludeCurrent: true',
    'windowDays: 28',
  ]);
  forbidPattern(
    usage,
    files.usage,
    /(?:function|const)\s+(?:median|mad|percentile|weightedMedian|medianAbsoluteDeviation|computeRobustStats)\b/iu,
    'usage observed baseline must not own a second median/MAD/robust-stats implementation.',
  );
  forbidPattern(
    usage,
    files.usage,
    /\b(?:winsori[sz]e|winsori[sz]ed|recencyWeight|decayWeight|weightedMedian)\b/iu,
    'recency/winsorized weighting belongs to a trajectory or decision policy, not the observed usage baseline.',
  );
  requireExcludes(usage, files.usage, [
    "SPARSE: 'sparse'",
    "FORMING: 'forming'",
    "STABLE: 'stable'",
    'DAY_MS',
  ]);

  const sitePullMetrics = sources[files.sitePullMetrics];
  requireIncludes(sitePullMetrics, files.sitePullMetrics, [
    "SITE_PULL_PERSONAL_BASELINE_METRICS_VERSION = 'site-pull-personal-baseline-metrics-v3'",
    "from '../../baseline/index.js'",
    'buildPersonalBaselineMetricProfileMap',
    'getSitePullPersonalBaselineMetricDefinition',
    'getSitePullPersonalBaselineMetricAnomalyOptions',
    'deriveSitePullPersonalBaselineMetricAnomaly',
    'derivePersonalBaselineMetricAnomaly',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_ANOMALY_OPTIONS',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_PROVENANCE',
    'STATS_PERSONAL_BASELINE_METRIC_GRAINS.DAY',
    "windowBasis: 'completed_day'",
    'excludeCurrent: true',
    'buildMissingObservation',
    'buildBaselineValueObservation',
    'buildCurrentValueObservation',
    'requireBaselineEntries',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_ENTRIES_INVALID',
    'baselineEntries',
    'currentObserved',
  ]);
  requireExcludes(sitePullMetrics, files.sitePullMetrics, [
    'robustSigmaFromMad = 1.4826',
    'observedEntries',
    'confidenceInput',
    'buildInteractionConfidenceInput',
    'computeBaselineConfidence',
    'computeTimeAnomaly',
    'computeTrendAnomaly',
    'includeTrend',
    'anomalyComputeOptions',
    'descriptor.confidence =',
  ]);

  const sitePullPolicy = sources[files.sitePullPolicy];
  requireIncludes(sitePullPolicy, files.sitePullPolicy, [
    "SITE_PULL_PERSONAL_BASELINE_POLICY_VERSION = 'site-pull-personal-baseline-policy-v3'",
    'PERSONAL_BASELINE_ROLES',
    'PERSONAL_BASELINE_STATUSES',
    'PERSONAL_BASELINE_REFERENCE_MODES',
    'SITE_PULL_PERSONAL_BASELINE_ROLES = PERSONAL_BASELINE_ROLES',
    'SITE_PULL_PERSONAL_BASELINE_STATUSES = PERSONAL_BASELINE_STATUSES',
    'SITE_PULL_PERSONAL_BASELINE_ROLES.OBSERVED_BASELINE',
    'SITE_PULL_PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY',
    'SITE_PULL_PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE',
    'SITE_PULL_PERSONAL_BASELINE_ROLES.NORMATIVE_ANCHOR',
    'deriveSitePullRecentTrajectoryProjection',
    'deriveSitePullAdaptiveReferenceProjection',
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
    'comparisonDays: comparisonHistoryValues.length + (currentObserved ? 1 : 0)',
    'const recentComparisonValues = currentObserved',
    "caveats.push('current_day_unobserved')",
    'todayVsReferenceRatio = currentObserved',
    'const reboundScore = currentObserved',
    'referenceMode:',
    'const referenceMs = baselineStatus === SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE',
  ]);
  requireExcludes(sitePullPolicy, files.sitePullPolicy, [
    "OBSERVED_BASELINE: 'observed_baseline'",
    "RECENT_TRAJECTORY: 'recent_trajectory'",
    "ADAPTIVE_REFERENCE: 'adaptive_reference'",
    "NORMATIVE_ANCHOR: 'normative_anchor'",
    "SPARSE: 'sparse'",
    "FORMING: 'forming'",
    "STABLE: 'stable'",
    'const recentValues = values.slice(-policy.recentDays)',
    'const momentumValues = values.slice(-policy.momentumDays)',
    'const comparisonHistoryValues = values.slice(-6)',
  ]);

  const sitePullBaseline = sources[files.sitePullBaseline];
  requireIncludes(sitePullBaseline, files.sitePullBaseline, [
    "from './baselineSeriesSource.js'",
    'normalizeSitePullBaselineSeriesSource(featureVector, {',
    "from './personalBaselinePublicContract.js'",
    'export { SITE_PULL_PERSONAL_BASELINE_VERSION, toPublicPersonalBaseline };',
    'baselineEntries: entries,',
    'materializeMetricBaselineEntries',
    'baselineEntries: metricBaselineEntries,',
    'currentObserved',
    'todayMs: toNumber(featureVector.todayTotalMs)',
  ]);
  requireExcludes(sitePullBaseline, files.sitePullBaseline, [
    'baselineSeries.length > 0 ? baselineSeries : weeklySeries',
    'featureVector.weeklySeries.at(-1)',
    'function toPublicMetricProfile',
    'function toPublicRecentTrajectory',
    'function toPublicAdaptiveReference',
    'baselineEntries: observedEntries,',
  ]);

  requireIncludes(sources[files.sitePullBaselineSource], files.sitePullBaselineSource, [
    'SITE_PULL_BASELINE_SOURCE_TARGET_DAYS',
    'SITE_PULL_BASELINE_SERIES_MISSING',
    'SITE_PULL_BASELINE_CURRENT_DATE_MISSING',
    'SITE_PULL_BASELINE_SERIES_LENGTH_INVALID',
    'SITE_PULL_BASELINE_DATE_RANGE_INVALID',
    'SITE_PULL_BASELINE_OBSERVED_INVALID',
    'SITE_PULL_BASELINE_MISSING_ACTIVE_MS_INVALID',
    "windowBasis: 'completed_calendar_day'",
    'excludeCurrent: true',
    'activeMs: entry.observed ? entry.activeMs : null',
  ]);
  [files.siteFeatureVector, files.sitePullFacts].forEach((relativePath) => {
    requireIncludes(sources[relativePath], relativePath, [
      'normalizeSitePullBaselineSeriesSource(',
      'baselineCurrentDateStr: baselineSource.currentDateStr',
      'todayObserved',
    ]);
    requireExcludes(sources[relativePath], relativePath, [
      'baselineSeries || weeklySeries',
      'baselineSeries ?? weeklySeries',
    ]);
  });
  requireIncludes(sources[files.siteIntelReadModelHelpers], files.siteIntelReadModelHelpers, [
    'export function buildSitePullBaselineProjectionSeries',
    'const collectionObservation = domainEntry?.collectionObservation',
    'observed: collectionObservation.observed',
    "typeof projection.hasStatsDay !== 'boolean'",
    'activeMs: entry.observed ? entry.activeMs : null',
  ]);
  requireIncludes(sources[files.sitesSiteDetailReadModel], files.sitesSiteDetailReadModel, [
    'SITE_PULL_BASELINE_READ_DAYS',
    'baselineSourceDates.slice(0, SITE_PULL_BASELINE_DAYS)',
    'Array.from(new Set([...baselineDates, ...weeklyDates]))',
    'goalContext,',
    'buildSitesCompletedActivityDays({',
  ]);
  requireIncludes(sources[files.sitesSiteDetailQuery], files.sitesSiteDetailQuery, [
    'resolveStatsDaysBack(SITE_PULL_BASELINE_READ_DAYS',
    'STATS_SITES_SITE_DETAIL_BASELINE_READ_SPAN_UNAVAILABLE',
  ]);
  requireIncludes(sources[files.sitesEvidenceQuery], files.sitesEvidenceQuery, [
    'getRecentDateStrings(SITE_PULL_BASELINE_READ_DAYS, now)',
  ]);

  const sitePullBaselinePublicContract = sources[files.sitePullBaselinePublicContract];
  requireIncludes(
    sitePullBaselinePublicContract,
    files.sitePullBaselinePublicContract,
    [
      'PUBLIC_METRIC_PROFILE_KEYS',
      "SITE_PULL_PERSONAL_BASELINE_VERSION = 'site-pull-personal-baseline-v3'",
      'PUBLIC_PERSONAL_BASELINE_KEYS',
      'PUBLIC_METRIC_PROVENANCE_KEYS',
      'PUBLIC_METRIC_SAMPLE_KEYS',
      'PUBLIC_METRIC_ANOMALY_KEYS',
      'PUBLIC_RECENT_TRAJECTORY_KEYS',
      'PUBLIC_ADAPTIVE_REFERENCE_KEYS',
      'function requireNoUnexpectedFields',
      'function requireExactFields',
      'SITE_PULL_PERSONAL_BASELINE_METRIC_ID_UNEXPECTED',
      'SITE_PULL_PERSONAL_BASELINE_METRIC_ID_MISSING',
      'SITE_PULL_PERSONAL_BASELINE_METRIC_SAMPLE_RELATION_INVALID',
      'sampleProjection.observedCount + sampleProjection.missingCount',
      'SITE_PULL_PERSONAL_BASELINE_POLICY.observedBaseline.targetDays',
      'metric.sample.missingCount !== coverageAuthority.missingCount',
      'currentObserved',
      'metric.currentObserved',
      'getSitePullPersonalBaselineMetricDefinition',
      'SITE_PULL_PERSONAL_BASELINE_METRIC_PROVENANCE',
      'deriveSitePullRecentTrajectoryProjection',
      'deriveSitePullAdaptiveReferenceProjection',
      'deriveSitePullPersonalBaselineMetricAnomaly',
      'SITE_PULL_PERSONAL_BASELINE_METRIC_ANOMALY_RELATION_INVALID',
      'canonicalPublicAnomaly',
      'expectedAnomalyScore',
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
      'function toPublicPersonalBaselinePolicy',
      'function toPublicRecentTrajectory',
      'function toPublicAdaptiveReference',
    ],
  );
  requireExcludes(sitePullBaselinePublicContract, files.sitePullBaselinePublicContract, [
    'buildSitePullPersonalBaselineMetricProfiles',
    'buildSitePullRecentTrajectory',
    'buildSitePullAdaptiveReference',
    'provenance: { ...provenance }',
    '...recentTrajectory',
    '...adaptiveReference',
    'Object.entries(reference).reduce',
  ]);

  const sitePullTemporal = sources[files.sitePullTemporal];
  requireIncludes(sitePullTemporal, files.sitePullTemporal, [
    "SITE_PULL_TEMPORAL_EVIDENCE_VERSION = 'site-pull-temporal-evidence-v2'",
    "basis: 'current_domain_temporal_facts'",
    'function buildTodayContext',
    'today: buildTodayContext(featureVector, entryVisitSummary)',
    'factProfileMethod:',
  ]);
  requireExcludes(sitePullTemporal, files.sitePullTemporal, [
    'personalBaseline',
    'weighted7d',
    'recent3d',
    'recent7d',
    'baseline30d',
    'weightedTrendRatio',
    'robustZ',
    'comparison:',
  ]);

  const sitePullTrendPressure = sources[files.sitePullTrendPressure];
  requireIncludes(sitePullTrendPressure, files.sitePullTrendPressure, [
    'requireSitePullRecentTrajectory',
    'getSitePullPersonalBaselineMetric',
    'SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS',
    'recentTrajectory.singleDaySpikeScore',
    'recentTrajectory.comparisonDays',
    'recentTrajectory.recentActiveDays',
    'activeAnomaly.robustZ',
    'SITE_PULL_PERSONAL_BASELINE_STATUSES.SPARSE',
  ]);
  requireExcludes(sitePullTrendPressure, files.sitePullTrendPressure, [
    'function buildWeeklyShape',
    'function buildTemporalShape',
    'function computeSingleDaySpikeScore',
    'weeklySeries',
    'weighted7d',
    'recent3d',
    'recent7d',
    'baseline30d',
    "baselineStatus === 'sparse'",
  ]);

  const trendAcceleration = readSection(
    sources[files.sitePullScoreModel],
    'function computeTrendAcceleration',
    'function computeCircadianRisk',
  );
  requireIncludes(trendAcceleration, files.sitePullScoreModel, [
    'personalBaselineContext?.recentTrajectory',
    'recentTrajectory.risingScore',
  ]);
  requireExcludes(trendAcceleration, files.sitePullScoreModel, [
    'weeklyAverageMs',
    'todayTotalMs',
    'durationNorm(',
    'ratioNorm(',
  ]);

  requireIncludes(sources[files.sitePullProfile], files.sitePullProfile, [
    'const personalBaseline = toPublicPersonalBaseline(',
    'const validatedSitePullFacts = {',
    'facts: validatedSitePullFacts',
  ]);
  requireOrdered(sources[files.sitePullProfile], files.sitePullProfile, [
    'const personalBaseline = toPublicPersonalBaseline(',
    'const validatedSitePullFacts = {',
    'const resolvedFeatureVector = resolveSitePullFeatureVector({',
    'const subscores01 = computeSubscores(',
    'const patternLayers = buildPatternLayers(',
  ], 'profile scoring and pattern evaluation must follow canonical personal-baseline validation');
}

function checkScoreDecision(sources) {
  requireIncludes(sources[files.scoreReference], files.scoreReference, [
    'personalBaselineContract.js',
    'PERSONAL_BASELINE_REFERENCE_MODES',
    'SCORE_RULE_REFERENCE_MODE = PERSONAL_BASELINE_REFERENCE_MODES',
    'deductBaselineMultiplier: 0.7',
    'deductGoalMultiplierMax: 2',
    'USAGE_BASELINE_STATUS.SPARSE',
    'baselineMetricId',
    'baselineScope',
    'const baselineMinutes = observedBaseline.stats.median;',
    'Math.min(deductBaselineCandidateMinutes, deductRefCapMinutes)',
    'Math.max(',
  ]);
  requireExcludes(sources[files.scoreReference], files.scoreReference, [
    "NORMATIVE_ONLY: 'normative_only'",
    "BOUNDED_ADAPTIVE: 'bounded_adaptive'",
  ]);
  requireIncludes(sources[files.scoreLedger], files.scoreLedger, [
    'USAGE_BASELINE_METRIC_IDS.MANAGED_DAILY_MINUTES',
    'USAGE_BASELINE_METRIC_IDS.SITE_DAILY_MINUTES',
    'resolveScoreRuleReference',
    'referenceMode',
    'deductRefMinutes',
    'const hasCreditReference =',
    'SCORE_RULE_DEDUCTION_REFERENCE_INVALID',
  ]);
  requireExcludes(sources[files.scoreReference], files.scoreReference, [
    'round(observedBaseline.stats.median',
    'round(Math.min(',
  ]);
  requireExcludes(sources[files.scoringEngine], files.scoringEngine, [
    'calculateBaselineFocusScore',
    'DEFAULT_BASELINE_DELTA_WEIGHT',
  ]);
}

function checkScoreSetupReference(sources) {
  const scoreSetup = sources[files.scoreSetup];
  requireIncludes(scoreSetup, files.scoreSetup, [
    'PERSONAL_BASELINE_ROLES',
    'PERSONAL_BASELINE_STATUSES',
    'PERSONAL_BASELINE_REFERENCE_MODES',
    "SCORE_SETUP_RECOMMENDATION_POLICY_VERSION = 'score_setup_recent_active_days_v1'",
    "SCORE_SETUP_RECENT_TRAJECTORY_VERSION = 'score_setup_recent_trajectory_v2'",
    'RECENT_WINDOW_DAYS: 7',
    'MIN_ACTIVE_DAYS: 3',
    'MIN_TOTAL_MINUTES: 45',
    'TARGET_MULTIPLIER: 0.85',
    'MIN_SUGGESTED_MINUTES: 10',
    'MAX_SUGGESTED_MINUTES: 180',
    'buildScoreSetupRecentTrajectory',
    'RECENT_TRAJECTORY_KEYS',
    'RECENT_TRAJECTORY_OBSERVATION_KEYS',
    'hasExactTrajectoryValue',
    'observations: observations.map((observation)',
    'Date.UTC(year, month - 1, day)',
    'activeMs !== null',
    'PERSONAL_BASELINE_STATUSES.STABLE',
    "source: 'stats_dates_domain_active'",
    "via: 'sites_domain_candidate'",
    "sourceField: 'scoreSetupRecentTrajectory'",
    'excludeCurrent: true',
    'role: PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE',
    'PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE',
    'PERSONAL_BASELINE_REFERENCE_MODES.NORMATIVE_ONLY',
    'requiresUserReview: true',
    'autoApply: false',
    'SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_MISSING',
    'SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_SHAPE_INVALID',
    'SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_RELATION_INVALID',
    'SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_EVIDENCE_INVALID',
    'SCORE_SETUP_CANDIDATE_RECENT_TRAJECTORY_DERIVATION_MISMATCH',
    'currentDateStr: new Date(finalDate.epochMs + 86_400_000)',
    'SCORE_SETUP_DRAFT_INPUT_INVALID',
    'SCORE_SETUP_DOMAIN_CANDIDATE_DUPLICATE',
    'SCORE_SETUP_MAX_RECOMMENDATIONS_INVALID',
  ]);
  requireExcludes(scoreSetup, files.scoreSetup, [
    'candidate?.weeklyTotal',
    'candidate?.recentAverageMs',
    'candidate?.todayActiveMs',
    'recentAverageMs *',
  ]);

  requireIncludes(sources[files.scoreSetupCandidateHelper], files.scoreSetupCandidateHelper, [
    'attachScoreSetupRecentTrajectoryToDomainCandidates',
    'buildScoreSetupRecentTrajectory',
    'SCORE_SETUP_DAY_PROJECTION_MISSING',
    'SCORE_SETUP_DAY_OBSERVATION_MARKER_INVALID',
    'SCORE_SETUP_DAY_COLLECTION_RELATION_INVALID',
    "typeof projection.hasStatsDay !== 'boolean'",
    'const collectionObservation = domainEntry?.collectionObservation',
    'if (!collectionObservation.observed)',
    'activeMs: null',
  ]);
  [files.scoreSetupSitesReadModel, files.scoreSetupStatusReadModel].forEach((relativePath) => {
    requireIncludes(sources[relativePath], relativePath, [
      'SCORE_SETUP_RECOMMENDATION_POLICY.RECENT_WINDOW_DAYS + 1',
      ').slice(0, -1)',
      'attachScoreSetupRecentTrajectoryToDomainCandidates',
      'scoreSetupDayProjections',
      'hasStatsDay:',
      'currentDateStr:',
    ]);
  });
  requireIncludes(sources[files.scoreSetupReview], files.scoreSetupReview, [
    'score-setup-recommendation-confirmation',
    "t('site_workspace.goal_recommendation_confirm_description'",
    "t('site_workspace.goal_recommendation_confirm_action'",
    'setConfirming(true)',
    'await onApply(draft)',
    'SITES_SCORE_SETUP_APPLY_HANDLER_MISSING',
  ]);
  requireIncludes(sources[files.scoreSetupMutations], files.scoreSetupMutations, [
    'applyScoreSetupDraft',
    'return handleSiteGoalChange(domain, suggestedMinutes)',
  ]);
  [files.sitesRouteAdapter, files.sitesManagementSurface, files.scoreSetupMutations].forEach((relativePath) => {
    requireExcludes(sources[relativePath], relativePath, [
      'handleApplyScoreSetupDrafts',
      'appliedCount',
      'failedDomains',
    ]);
  });
  requireExcludes(sources[files.sitesManagementSurface], files.sitesManagementSurface, [
    'handleDismissScoreSetupDraft',
    'onDismissScoreSetupDraft',
  ]);
}

function checkSitesCapAdmissionContinuity(sources) {
  requirePattern(
    sources[files.sitesRouteAdapter],
    files.sitesRouteAdapter,
    /^\s*import React from ['"]react['"];\s*import SitesManagementSurface from ['"]\.\.\/\.\.\/workspaces\/sites\/SitesManagementSurface\.jsx['"];\s*export \{ resolveSelectedSiteType \} from ['"]\.\.\/\.\.\/workspaces\/sites\/SitesManagementSurface\.jsx['"];\s*export default function SitesTab\(props\) \{\s*return <SitesManagementSurface \{\.\.\.props\} \/>;\s*\}\s*$/u,
    'SitesTab must remain the thin route adapter to the canonical SitesManagementSurface owner.',
  );
  requireIncludes(sources[files.sitesCapAdmission], files.sitesCapAdmission, [
    "new Set(['ready', 'loading', 'error'])",
    "['ready', 'refreshing', 'refresh_error'].includes(snapshotStatus)",
    "currentSnapshotReady === false && ['loading', 'error'].includes(snapshotStatus)",
    'SITES_CAP_SNAPSHOT_ADMISSION_INVALID',
    'SITES_CAP_ADMISSION_STATUS_INVALID',
    "status !== 'ready' || available !== true",
    'SITES_CAP_MUTATION_NOT_ADMITTED',
  ]);
  requireExcludes(sources[files.sitesCapAdmission], files.sitesCapAdmission, [
    'chrome.storage', 'localStorage', 'useState', 'useRef', 'setTimeout',
  ]);
  requireIncludes(sources[files.sitesManagementSurface], files.sitesManagementSurface, [
    'const currentSnapshotReady = globalExposureAverage !== null',
    'const [workspaceAdmitted, setWorkspaceAdmitted] = useState(() => presentation.workspaceAdmitted === true)',
    'if (currentSnapshotReady) { setWorkspaceAdmitted(true); presentation.workspaceAdmitted = true; }',
    'resolveSitesCapAdmissionStatus({ currentSnapshotReady, snapshotStatus: sitesSnapshotStatus })',
    'const selectedEntry = currentSnapshotReady',
    'resolveSelectedSiteType(selectedDomain, {',
    'Object.hasOwn(siteGoals, selectedDomain)',
    'SITES_CAP_CURRENT_ENTRY_REQUIRED',
    'if (!workspaceAdmitted && !currentSnapshotReady)',
    'const registryPane = currentSnapshotReady ? (',
    ") : !currentSnapshotReady ? (",
    'data-sites-read-error-owner={sitesSnapshotError ? \'stats.GET_SITES_SNAPSHOT\' : undefined}',
    'onRetry={retrySitesSnapshot}',
    'admissionStatus={capAdmissionStatus}',
    'goalMinutes={selectedGoalMinutes}',
    "detailEnabled: workspaceMode === 'notebook' && registrationRequest === null && !globalCapOpen",
    "presentation={themeId === 'zen' ? 'workspace' : 'inline'} isPresented={themeId !== 'zen' || globalCapOpen}",
    'presentationState={presentation.globalCapDraft}',
    'onRequestClose={closeGlobalCap}',
    'policyControl={globalCapTrigger}',
    'utilityOpen={globalCapOpen}',
    'id="zen-sites-global-cap"',
    "querySelectorAll('[data-sites-global-cap-trigger]')",
  ]);
  const surface = sources[files.sitesManagementSurface];
  if ((surface.match(/<SitesHud\b/gu) || []).length !== 1) {
    fail(`${files.sitesManagementSurface}: exactly one retained global-cap HUD owner is required for inline/workspace placement.`);
  }
  requireIncludes(sources[files.sitesWorkspace], files.sitesWorkspace, [
    "if (!['ledger', 'notebook'].includes(mode))",
    "hidden={utilityOpen || mode !== 'ledger'}",
    "hidden={utilityOpen || mode !== 'notebook'}",
    'hidden={!utilityOpen}>{utilityPane}',
  ]);
  requireIncludes(sources[files.sitesGlobalCapTrigger], files.sitesGlobalCapTrigger, [
    'requireGlobalGoalMinutes(goalMinutes)',
    'data-sites-global-cap-trigger',
    'aria-controls="zen-sites-global-cap"',
    'onClick={onClick}',
  ]);
  [files.sitesHud, files.sitesSiteCap, files.sitesCapControl].forEach(relativePath => {
    requireIncludes(sources[relativePath], relativePath, [
      "from './sitesCapAdmission.js'", 'requireSitesCapAdmissionStatus(admissionStatus)',
      "const admissionReady = admissionStatus === 'ready'",
    ]);
  });
  requireIncludes(sources[files.sitesHud], files.sitesHud, [
    'if (admissionReady) requireSitesRecordingPolicy(recording)',
    'requireSitesCapMutationAdmission(admissionStatus, recording?.globalCapAvailable)',
  ]);
  requireIncludes(sources[files.sitesSiteCap], files.sitesSiteCap, [
    'if (enabled && admissionReady) requireSitesCapAvailability(capAvailability)',
    'requireSitesCapMutationAdmission(admissionStatus, enabled && capAvailability?.available)',
    'key={`${domain}:${type}`}',
  ]);
  requireIncludes(sources[files.sitesCapControl], files.sitesCapControl, [
    'const mutationBlocked = !admissionReady || Boolean(unavailableMessage)',
    "const inputReadOnly = admissionStatus === 'loading'",
    "const inputDisabled = editor.isLocked || admissionStatus === 'error' || Boolean(unavailableMessage)",
    'disabled={inputDisabled} readOnly={inputReadOnly}',
    'onSubmit={event => { event.preventDefault(); if (!mutationBlocked) void editor.finishEditing(); }}',
    'disabled={editor.isLocked || mutationBlocked || !editor.isDraftValid || !editor.hasChanged}',
    'if (!mutationBlocked) editor.handleGoalInputChange(event)',
    '{admissionReady && evidence}',
    "if (presentation !== 'inline' && presentation !== 'workspace')",
    'SITES_CAP_PRESENTATION_INVALID',
    'SITES_CAP_WORKSPACE_CLOSE_HANDLER_REQUIRED',
    'hidden={isWorkspace && !isPresented}',
    "onRequestClose('cancel')",
    "onRequestClose('applied')",
    'const focusActive = isRuntimeActive && isPresented',
    'focusActive && document.activeElement === document.body',
    'trigger.current?.focus({ preventScroll: true })',
    'editor.updateDraftGoal(recommendation.recommendedTargetMinutes); setOpen(true)',
  ]);
  if ((sources[files.sitesCapControl].match(/editor\.finishEditing\(/gu) || []).length !== 1) {
    fail(`${files.sitesCapControl}: explicit form submit must be the only save entrypoint; blur, outside click and recommendation review must not save.`);
  }
  const editor = sources[files.sitesCapEditor];
  requireIncludes(editor, files.sitesCapEditor, [
    'if (isLocked || savingRef.current || !isDraftValid) return',
    "SITES_CAP_SAVE_HANDLER_REQUIRED",
    'if (!Number.isFinite(appliedMinutes) || appliedMinutes < 0)',
    'SITES_CAP_APPLIED_VALUE_REQUIRED',
    'if (presentationState) presentationState.pendingOperation = operation',
    'if (presentationState?.pendingOperation === pendingOperation) presentationState.pendingOperation = null',
    'if (active) { setDraftGoal(String(appliedMinutes)); setIsEditing(false); setIsNumericEditing(false); setSavePhase(\'success\'); }',
    "if (active) { setSavePhase('error'); setSaveError(saveErrorMessage); }",
    'window.setTimeout(finish, SITES_GLOBAL_CAP_SAVE_SETTLE_MS)',
  ]);
  requireOrdered(readSection(editor, 'const finishEditing = async () => {', '\n  return {'), files.sitesCapEditor, [
    'savingRef.current = true',
    'Promise.resolve(onSave(draftGoalMinutes))',
    'operation = operation.then((appliedMinutes)',
    'SITES_CAP_APPLIED_VALUE_REQUIRED',
    'setPendingOperation(operation)',
  ], 'save locking and applied-value validation must precede mounted ACK settlement');
  requireIncludes(sources[files.sitesGlobalCapEditor], files.sitesGlobalCapEditor, [
    'return useSitesCapEditor(',
    'await onGlobalGoalChange(minutes)',
    'return minutes',
  ]);
  requireIncludes(sources[files.sitesSiteCap], files.sitesSiteCap, [
    'const result = await onGoalChange(domain, minutes)',
    'result?.ok !== true || !Number.isFinite(result.appliedMinutes)',
    'return result.appliedMinutes',
    'resolveSiteGoalChange({ currentMinutes: goalMinutes, requestedMinutes: editor.draftGoalMinutes })',
    'editor.updateDraftGoal(requestedMinutes)',
  ]);
  requireIncludes(sources[files.scoreSetupMutations], files.scoreSetupMutations, [
    'goalMinutes: requestedMinutes',
    'const appliedMinutes = persistResult?.appliedMinutes',
    'SITE_GOAL_ACKNOWLEDGEMENT_INVALID',
    'const result = await setGlobalGoal(globalGoal)',
    'return requireProtocolSyncSuccess(result)',
  ]);
  requireIncludes(sources[files.sitesBoundaryMap], files.sitesBoundaryMap, [
    '`workspaceAdmitted` frame-lifetime boolean',
    'It retains no snapshot payload or cached analysis',
    '`sitesCapAdmission.js` owns the strict UI tuple matrix',
    'blur do not dismiss or save; Cancel/Escape restores committed state',
    'presentation="workspace"',
    '`SitesWorkspace.utilityPane` even while hidden',
    '420ms success settlement',
  ]);
  requirePattern(
    sources[files.sitesBoundaryMap],
    files.sitesBoundaryMap,
    /Draft\s+mutation and Apply require ready admission/u,
    'cap draft mutation and explicit Apply must require ready admission in the owner contract.',
  );
}

function checkClseSameGrainContract(sources) {
  const contract = sources[files.clseContract];
  requireIncludes(contract, files.clseContract, [
    'personalBaselineContract.js',
    'PERSONAL_BASELINE_ROLES',
    'PERSONAL_BASELINE_METRIC_GRAINS',
    'PERSONAL_BASELINE_METRIC_DIRECTIONS',
    'CLSE_BASELINE_GRAINS',
    'BUCKET_10S',
    'BUCKET_60S',
    'CLSE_BASELINE_FEATURES',
    'CLSE_BASELINE_GRAIN_EVIDENCE_LIMITS',
    'createEmptyClseBaselineValue',
    'normalizeClseBaselineRow',
    'reset_epoch',
    'profiles',
    'const CLSE_BASELINE_RECORD_SCHEMA_VERSION = 1;',
  ]);
  requireExcludes(contract, files.clseContract, [
    'export const CLSE_BASELINE_RECORD_SCHEMA_VERSION',
    "CLSE_BASELINE_ROLE = 'observed_baseline'",
    "CLSE_BASELINE_DIRECTION = 'higher'",
    "BUCKET_10S: 'bucket_10s'",
    "BUCKET_60S: 'bucket_60s'",
    "'status'",
    "'confidence'",
  ]);

  requireIncludes(sources[files.clseStatePolicy], files.clseStatePolicy, [
    'CLSE_BASELINE_GRAIN_POLICIES',
    'CLSE_BASELINE_FEATURE_SCALE_FLOORS',
    'getCLSEBaselineFeatureSigma',
    'resolveCLSEBaselineProfileState',
    'CLSE_BASELINE_PROFILE_FUTURE_EVIDENCE',
    'confidence.overall',
  ]);

  requireIncludes(sources[files.clseRead], files.clseRead, [
    'buildCLSEBaselineSummary',
    'requireCanonicalCLSEBaselineSummary',
    'resolveCLSEBaselineProfileState',
    'evaluatedAt',
    'hasCanonicalDerivedProfileState',
    'status',
    'confidence',
  ]);

  requireIncludes(sources[files.clseStatus], files.clseStatus, [
    'CLSE_STATUS_FIELDS',
    'CLSE_SUSTAINED_LOAD_STATE_FIELDS',
    'CLSE_LOOP_STATS_FIELDS',
    'CLSE_ALERT_FIELDS',
    'requireExactFields(value, CLSE_STATUS_FIELDS, errorCode)',
    'requireCanonicalCLSEBaselineSummary',
    'baselineResetEpoch',
    'requireCanonicalCLSESustainedBaselineReference',
    'sustainedBaselineReference',
    'disabledRuntimeState',
    'initializedRuntimeState',
    'inactiveBaseline',
  ]);
  requireExcludes(sources[files.clseStatus], files.clseStatus, [
    '...value,',
  ]);

  requireIncludes(sources[files.clseBaseline], files.clseBaseline, [
    'CLSE_BASELINE_GRAIN_POLICIES',
    'HUBER_CLIP_SIGMA',
    'updateFeatureStats',
    'buildCLSEBaselineObservation',
    'observeCompletedBucket',
    'CLSE_BASELINE_BUCKET_NOT_COMPLETED',
    'buildCLSEBaselineSummary',
    'getZScore',
    "reason: 'insufficient_exposure'",
    '_persistenceMutationTail',
    'expectedResetEpoch: currentResetEpoch',
    'reloadFromStorage()',
    'loadOrCreateCanonicalCLSEBaseline',
  ]);
  requireExcludes(sources[files.clseBaseline], files.clseBaseline, [
    'function resolveProfileState',
    'function getFreshness',
    'const GRAIN_POLICIES',
    'CLSE_CONSTANTS',
    '_sensitivityScale',
    'setSensitivityScale',
    'getSensitivityScale',
  ]);
  const clseReloadSection = readSection(
    sources[files.clseBaseline],
    'reloadFromStorage()',
    'reset()',
  );
  requireOrdered(clseReloadSection, files.clseBaseline, [
    'await pendingInit',
    'this.baseline = null;',
    'reloaded = await loadOrCreateCanonicalCLSEBaseline({',
    'this.baseline = reloaded;',
  ], 'CLSE storage reload must invalidate singleton memory before the canonical read');

  requireIncludes(sources[files.clseDetectionPolicy], files.clseDetectionPolicy, [
    "CLSE_DETECTION_POLICY_VERSION = 'clse_detection_sensitivity_v1'",
    'createCLSEDetectionPolicy',
    'requireCanonicalCLSEDetectionPolicy',
    'resolveCLSEDetectionThreshold',
    'resolveCLSEPositiveZThresholdBand',
    'baseThreshold * policy.sensitivityScale',
  ]);

  requireIncludes(sources[files.clseRiskReference], files.clseRiskReference, [
    'requireCLSEDetectorReference',
    'resolvePositiveZLift',
    'PERSONAL_BASELINE_REFERENCE_MODES.NORMATIVE_ONLY',
    'PERSONAL_BASELINE_REFERENCE_MODES.BOUNDED_ADAPTIVE',
    'profile.status === PERSONAL_BASELINE_STATUSES.STABLE',
    'baselineResetEpoch: summary.resetEpoch',
  ]);
  requireIncludes(sources[files.clseAggression], files.clseAggression, [
    'MAX_ADAPTIVE_AGGRESSION_LIFT = 0.2',
    'normativeAggressiveScore',
    'adaptiveLift',
    'aggressiveScore: clamp01(boundedNormativeScore + adaptiveLift)',
    'resolveCLSEDetectionThreshold',
    'resolveCLSEPositiveZThresholdBand',
    'requireCanonicalCLSEDetectionPolicy(detectionPolicy)',
  ]);
  requireExcludes(sources[files.clseAggression], files.clseAggression, [
    'meetsZGate',
    'isBaselineCalibrated',
  ]);
  requireIncludes(sources[files.clseSustained], files.clseSustained, [
    'MAX_ADAPTIVE_SUSTAINED_LIFT = 0.25',
    'SUSTAINED_NORMATIVE_THRESHOLDS',
    'isElevated: normativeElevated || adaptiveElevated',
    'referenceMode',
    'baselineStatus',
    'baselineGrain',
    'baselineResetEpoch',
    'resolveCLSEDetectionThreshold',
    'resolveCLSEPositiveZThresholdBand',
    'requireCanonicalCLSEDetectionPolicy(detectionPolicy)',
  ]);
  requireExcludes(sources[files.clseSustained], files.clseSustained, [
    'isBaselineCalibrated',
  ]);
  const sustainedAnalyzeSection = readSection(
    sources[files.clseSustained],
    'analyze(bucket60s, detectionPolicy)',
    '    _evaluate(observation, detectionPolicy)',
  );
  requireOrdered(sustainedAnalyzeSection, files.clseSustained, [
    'if (bucket60s.ts_start <= this._lastAnalyzedTs) return null;',
    'const observation = buildCLSEBaselineObservation(',
    'const evaluation = this._evaluate(observation, policy);',
    'this._lastAnalyzedTs = bucket60s.ts_start;',
  ], '60-second duplicate state must commit only after baseline evaluation succeeds');
  forbidPattern(
    sustainedAnalyzeSection,
    files.clseSustained,
    /this\._lastAnalyzedTs = bucket60s\.ts_start;[\s\S]*const evaluation = this\._evaluate/,
    '60-second evaluation failures must leave the completed bucket retryable',
  );

  requireIncludes(sources[files.clseRecordContracts], files.clseRecordContracts, [
    'const CLSE_AGGRESSION_LOG_SCHEMA_VERSION = 1;',
    "'baseline_reset_epoch'",
    'row.baseline_grain !== CLSE_BASELINE_GRAINS.BUCKET_10S',
    'row.bucket_ts < row.baseline_reset_epoch',
    'row.baseline_status !== PERSONAL_BASELINE_STATUSES.STABLE',
  ]);
  requireExcludes(sources[files.clseRecordContracts], files.clseRecordContracts, [
    'export const CLSE_AGGRESSION_LOG_SCHEMA_VERSION',
  ]);
  requireIncludes(sources[files.clseStore], files.clseStore, [
    'runBaselineEpochTransaction',
    'CLSE_STORE_BASELINE_RESET_EPOCH_MISMATCH',
    'CLSE_STORE_AGGRESSION_LOG_RESET_EPOCH_MISMATCH',
    'expectedResetEpoch',
  ]);
  requireExcludes(sources[files.clseStore], files.clseStore, [
    'deleteBaseline()',
  ]);
  requireIncludes(sources[files.clseRepository], files.clseRepository, [
    'enqueueBaselineEpochWrite',
    'baselineEpochWriteTail',
    'runSnapshotEpochOperation',
    'flushBaselineEpochWrites',
    'this.clseStore.resetBaseline(baseline, options)',
    'this.enqueueBaselineEpochWrite(() => this.clseStore.pruneTiers(options))',
    'this.enqueueBaselineEpochWrite(() => this.clseStore.clear())',
  ]);
  requireExcludes(sources[files.clseRepository], files.clseRepository, [
    'deleteBaseline()',
  ]);
  requireIncludes(sources[files.clseImportPreflight], files.clseImportPreflight, [
    'requireCanonicalClseEpochRelation',
    'INDEXED_DB_SNAPSHOT_CLSE_BASELINE_CARDINALITY_INVALID',
    'INDEXED_DB_SNAPSHOT_CLSE_AGGRESSION_BASELINE_REQUIRED',
    'INDEXED_DB_SNAPSHOT_CLSE_AGGRESSION_RESET_EPOCH_MISMATCH',
  ]);
  requireIncludes(sources[files.clseSnapshotRepository], files.clseSnapshotRepository, [
    'this.clseRepository.runSnapshotEpochOperation',
    'snapshot.clseBaseline.length === 1',
    'tx.objectStore(STORES.CLSE_AGGRESSION_LOGS).clear()',
  ]);
  requireIncludes(
    sources[files.clseStorageMutationLifecycle],
    files.clseStorageMutationLifecycle,
    [
      'runCLSEStorageMutationLifecycle',
      'CLSE_STORAGE_MUTATION_BASELINE_RELOAD_FAILED',
      'CLSE_STORAGE_MUTATION_RUNTIME_RESUME_FAILED',
      'primaryError.clseStorageRecoveryError = recoveryError',
    ],
  );
  requireIncludes(sources[files.clseService], files.clseService, [
    'baseline_reset_epoch: entry.data.baselineResetEpoch',
    'if (initPromise === pendingInit) await invalidateFailedCLSERuntimeStart()',
    'throw err',
    'await initCLSE()',
    'createCLSEDetectionPolicy',
    'function getCurrentCLSEDetectionPolicy()',
    'runSerializedCLSEStorageMutation',
    'runCLSEStorageMutationLifecycle',
    'CLSE_STORAGE_MUTATION_RUNTIME_DISPOSITIONS',
    "RESUME: 'resume'",
    "TERMINATE: 'terminate'",
    'await clseRuntimeStorageWorkTail',
    'await clseRepository.flushBaselineEpochWrites()',
    'await baselineManager.reloadFromStorage()',
    'runCLSEBaselineResetMutation()',
    'runSerializedQuiescedCLSETerminalMutation',
    'assertCLSEProfileMutationQuiesced()',
    'quiesceCLSEForProfileMutation',
    '{ runtimeDisposition: CLSE_STORAGE_MUTATION_RUNTIME_DISPOSITIONS.TERMINATE }',
  ]);
  requireExcludes(sources[files.clseService], files.clseService, [
    'baselineManager.setSensitivityScale',
    'baselineManager.getSensitivityScale',
    'sustainedDetector?.resetBaselineReferenceState()',
    'await resetCLSEBaseline();',
  ]);
  requireIncludes(sources[files.clseServicePublic], files.clseServicePublic, [
    'runCLSEStorageSnapshotImport',
    'quiesceCLSEForProfileMutation',
    'assertProfileMutationQuiesced()',
    'enqueueTerminalMutation',
    'clseRepository.flushBaselineEpochWrites()',
    'clearAllCLSEStorage',
  ]);
  requireExcludes(sources[files.clseServicePublic], files.clseServicePublic, [
    'runCLSEStorageMutationLifecycle',
    'loadOrCreateCanonicalCLSEBaseline',
    'resumePublicCLSEAfterStorageMutation',
  ]);
  requireIncludes(sources[files.clseServiceClient], files.clseServiceClient, [
    'runCLSEStorageSnapshotImport',
    'CLSEServiceModule.runCLSEStorageSnapshotImport(importTask)',
  ]);

  const clseNormalBaselineResetSection = readSection(
    sources[files.clseService],
    'export async function resetCLSEBaseline()',
    '/**\n * Full app-reset owner',
  );
  requireOrdered(clseNormalBaselineResetSection, files.clseService, [
    'assertCLSEProfileMutationAdmissionOpen();',
    'await runCLSEBaselineResetMutation();',
  ], 'normal explicit CLSE baseline reset must use the resumable lifecycle while admission is open');
  requireExcludes(clseNormalBaselineResetSection, files.clseService, [
    'runSerializedQuiescedCLSETerminalMutation',
    'CLSE_STORAGE_MUTATION_RUNTIME_DISPOSITIONS.TERMINATE',
  ]);

  const clseTerminalMutationSection = readSection(
    sources[files.clseService],
    'function runSerializedQuiescedCLSETerminalMutation',
    'export function quiesceCLSEForProfileMutation()',
  );
  requireOrdered(clseTerminalMutationSection, files.clseService, [
    'assertCLSEProfileMutationQuiesced();',
    'const pending = clseStorageMutationTail.then',
    'await clseRuntimeStorageWorkTail;',
    'result = await mutationTask();',
    'await clseRepository.flushBaselineEpochWrites();',
    'baselineManager = null;',
    'isInitialized = false;',
    'initPromise = null;',
  ], 'terminal CLSE mutation must drain, mutate, flush, and discard old-worker memory without reopening it');
  requireExcludes(clseTerminalMutationSection, files.clseService, [
    'runCLSEStorageMutationLifecycle',
    'reloadFromStorage()',
    'await initCLSE()',
  ]);

  const clseProfileQuiesceSection = readSection(
    sources[files.clseService],
    'export function quiesceCLSEForProfileMutation()',
    '/** Explicit one-shot rewrite owner',
  );
  requireOrdered(clseProfileQuiesceSection, files.clseService, [
    'CLSE_PROFILE_MUTATION_PHASES.QUIESCING',
    'runSerializedCLSEStorageMutation(',
    '{ runtimeDisposition: CLSE_STORAGE_MUTATION_RUNTIME_DISPOSITIONS.TERMINATE }',
    'CLSE_PROFILE_MUTATION_PHASES.QUIESCED',
  ], 'profile-mutation quiesce must terminally close the old CLSE runtime before durable mutation');

  const clseTerminalResetSection = readSection(
    sources[files.clseService],
    'export async function resetCLSEData()',
    '/**\n * Snapshot-import lifecycle owner',
  );
  requireOrdered(clseTerminalResetSection, files.clseService, [
    'runSerializedQuiescedCLSETerminalMutation',
    'baselineManager = getBaselineManager();',
    'await baselineManager.reset();',
    'clearCLSEHistoricalData',
  ], 'full profile reset must rewrite CLSE under the terminal quiesced owner');
  requireExcludes(clseTerminalResetSection, files.clseService, [
    'reloadFromStorage()',
    'await initCLSE()',
  ]);

  const publicTerminalSection = readSection(
    sources[files.clseServicePublic],
    'export async function resetCLSEData()',
    'export function recordCLSEShortDwell()',
  );
  requireOrdered(publicTerminalSection, files.clseServicePublic, [
    'assertProfileMutationQuiesced();',
    'enqueueTerminalMutation(() => clearAllCLSEStorage())',
    'export function quiesceCLSEForProfileMutation()',
    'clseRepository.flushBaselineEpochWrites()',
    'export function runCLSEStorageSnapshotImport(importTask)',
    'assertProfileMutationQuiesced();',
    'return enqueueTerminalMutation(importTask);',
  ], 'public CLSE terminal reset/import must flush and mutate without reload or resume');

  requireIncludes(sources[files.clseLab], files.clseLab, [
    'PERSONAL_BASELINE_METRIC_GRAINS',
    'profile.grain === PERSONAL_BASELINE_METRIC_GRAINS.BUCKET_10S',
  ]);
  requireExcludes(sources[files.clseLab], files.clseLab, [
    "profile.grain === 'bucket_10s'",
    'profile.grain === "bucket_10s"',
  ]);

  const spikeSection = readSection(
    sources[files.clseService],
    'function analyzeSpikeBuckets',
    'async function logAggressionDiagnostics',
  );
  requireOrdered(spikeSection, files.clseService, [
    'scoreCLSEBucketAggression(',
    'getCurrentCLSEDetectionPolicy()',
    'logAggressionDiagnostics(',
    'spikeDetector.analyze(bucket, aggressionScores)',
    'baselineManager.observeCompletedBucket(',
    'CLSE_BASELINE_GRAINS.BUCKET_10S',
  ], '10-second CLSE detection must compare before the completed bucket updates its profile');

  const rollupSection = readSection(
    sources[files.clseService],
    'async function rollup60s',
    'async function rollup5min',
  );
  requireOrdered(rollupSection, files.clseService, [
    'sustainedDetector.analyze(',
    'getCurrentCLSEDetectionPolicy()',
    'baselineManager.observeCompletedBucket(',
    'CLSE_BASELINE_GRAINS.BUCKET_60S',
  ], '60-second CLSE detection must compare before the completed bucket updates its profile');

  const heartbeatSection = readSection(
    sources[files.clseService],
    'async function handleHeartbeat',
    'function analyzeSpikeBuckets',
  );
  requireOrdered(heartbeatSection, files.clseService, [
    'analyzeSpikeBuckets(now)',
    'maybeRollup60s(now)',
    'baselineManager.flush()',
  ], 'CLSE must flush the materialized baseline after completed-bucket processing');
}

function checkRoleBoundaries(sources) {
  requireIncludes(sources[files.rollingPressure], files.rollingPressure, [
    "from '../baseline/index.js'",
    "ROLLING_PRESSURE_RECENT_TRAJECTORY_VERSION = 'rolling-pressure-recent-trajectory-v2'",
    'role: STATS_PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY',
    'grain: STATS_PERSONAL_BASELINE_METRIC_GRAINS.DAY',
    "windowBasis: ROLLING_PRESSURE_TRAJECTORY_WINDOW_BASIS",
    "weighting: 'completed_period_recency'",
    'excludeCurrent: true',
    'completedWeightsByRecency',
    'weightedDailyAverageMs',
    'weightedMeanAbsoluteDeviationMs',
    'weightedRelativeDispersion',
    'deriveRecentTrajectory',
    'resolveRecentTrajectoryStatus',
    'requireRollingPressureRecentTrajectory',
    "'observations'",
    "['activityDateStr', 'ageDays', 'observed', 'activeMs', 'weight']",
    "['activityDateStr', 'observed', 'activeMs']",
    "let comparisonState = 'current_missing'",
    'ROLLING_PRESSURE_RECENT_TRAJECTORY_OBSERVATION_COUNT_INVALID',
    'ROLLING_PRESSURE_RECENT_TRAJECTORY_REFERENCE_RELATION_INVALID',
    'ROLLING_PRESSURE_PERIOD_DATE_AGE_RELATION_INVALID',
    'ROLLING_PRESSURE_PERIOD_AGE_DUPLICATED',
    'ROLLING_PRESSURE_PROJECTION_DOMAIN_ACTIVE_INVALID',
    'requireStatsDomainCollectionObservation',
    'domainObservationMap',
    'ROLLING_PRESSURE_PROJECTION_DOMAIN_COLLECTION_RELATION_INVALID',
    'ROLLING_PRESSURE_PERIOD_COLLECTION_RELATION_INVALID',
    'ROLLING_PRESSURE_RECENT_TRAJECTORY_COMPARISON_RELATION_INVALID',
    'PERSONAL_BASELINE_STATUSES.SPARSE',
    'PERSONAL_BASELINE_STATUSES.FORMING',
    'PERSONAL_BASELINE_STATUSES.STABLE',
  ]);
  requireExcludes(sources[files.rollingPressure], files.rollingPressure, [
    'entry?.activeMs ?? entry?.totalMs',
    'domainEntry?.activeMs ?? domainEntry?.totalMs',
    'entries.length - 1 - index',
    'period.current === true || ageDays === 0',
    'const observedActivityDates',
  ]);

  requireIncludes(sources[files.scoreSetupStatusReadModel], files.scoreSetupStatusReadModel, [
    'count: DEFAULT_ROLLING_PRESSURE_WINDOW_DAYS + 1',
    'hasCompleteStatsDateCoverage',
    'attachRollingPressurePeriodEvidence',
    'const observed = hasCompleteStatsDateCoverage(entry?.period, statsDateSet)',
    'if (entry?.period?.current || observed)',
    'domainTotals: []',
    'hourlyBuckets: []',
    'evidence: {',
    'evidence: { observed: false }',
  ]);
  requireExcludes(sources[files.scoreSetupStatusReadModel], files.scoreSetupStatusReadModel, [
    'recentAverageDates',
    'recentDomainMaps',
    'buildProjectionDomainMap',
    'statsDateKeys.slice(',
  ]);
  requireExcludes(sources[files.statusQueryShared], files.statusQueryShared, [
    'export function average(',
    'export function buildProjectionDomainMap(',
  ]);

  requireIncludes(sources[files.statusCandidatePool], files.statusCandidatePool, [
    'projectCandidateTrajectorySignals',
    'requireRollingPressureRecentTrajectory',
    'pressureEntry?.recentTrajectory',
    'recentTrajectory,',
    'weightedRelativeDispersion',
    'recentAverageMs: hasReference',
    'trajectoryDispersion: trajectoryDispersion ?? 0',
  ]);
  requireExcludes(sources[files.statusCandidatePool], files.statusCandidatePool, [
    'insight?.recentAverageMs',
    'todayActiveMs / recentAverageMs',
    'Math.abs(todayActiveMs - recentAverageMs)',
  ]);

  requireIncludes(sources[files.homeRollingPressureEvidence], files.homeRollingPressureEvidence, [
    'findRollingPressureDomain',
    'resolveRollingPressureRecentTrajectory',
    'projectRollingPressureRecentTrajectoryScalars',
    "recentTrajectory?.current?.observed === true",
    'recentTrajectory?.reference?.weightedDailyAverageMs',
    'recentTrajectory?.comparison?.deltaMs',
    'recentAverageMs: hasReference ? recentAverageMs : null',
    'deltaMs: hasReference ? deltaMs : null',
  ]);
  requireIncludes(sources[files.homeScan], files.homeScan, [
    'resolveRollingPressureRecentTrajectory',
    'projectRollingPressureRecentTrajectoryScalars',
    'recentTrajectory,',
    'hasRecentReference',
    'const neutralRecentDeltaMs = deltaMs ?? 0',
    'recentDeltaMs: neutralRecentDeltaMs',
  ]);
  requireExcludes(sources[files.homeScan], files.homeScan, [
    'function findRollingPressureDomain',
    'function resolveRecentTrajectory',
    'function projectRecentTrajectoryScalars',
    'ctrl?.domainInsights?.[domain]?.recentAverageMs',
    'lensUsedMs - recentAverageMs',
  ]);
  requireIncludes(sources[files.homeInsightPresentation], files.homeInsightPresentation, [
    'recentDeltaMs = 0',
    'toNumber(recentDeltaMs)',
  ]);
  requireExcludes(sources[files.homeInsightPresentation], files.homeInsightPresentation, [
    'focusUsedMs - recentAverageMs',
  ]);
  requireIncludes(sources[files.sessionSummaryNarrationInput], files.sessionSummaryNarrationInput, [
    'readRecentTrajectory',
    'hasRecentTrajectoryReference',
    'recentTrajectory?.reference?.weightedDailyAverageMs',
    'recentTrajectory?.comparison?.deltaMs',
    'recentTrajectoryStatus',
    'recentTrajectoryMissingDays',
    'recentTrajectoryZeroDays',
  ]);
  requireExcludes(sources[files.sessionSummaryNarrationInput], files.sessionSummaryNarrationInput, [
    'toMinutes(scanSnapshot.recentAverageMs)',
    'toFiniteNumber(scanSnapshot.deltaMs)',
  ]);
  requireIncludes(sources[files.usageInsightNarrationInput], files.usageInsightNarrationInput, [
    'buildHomeRecentTrajectoryProjection',
    'homeScanSnapshot?.recentTrajectory',
    'referenceState',
    'excludeCurrent: trajectory.excludeCurrent === true',
  ]);
  requireExcludes(sources[files.usageInsightNarrationInput], files.usageInsightNarrationInput, [
    'toPositiveMinutes(homeScanSnapshot?.recentAverageMs)',
    'toFiniteNumber(homeScanSnapshot?.deltaMs)',
  ]);

  requireIncludes(sources[files.scoreSetupSitesReadModel], files.scoreSetupSitesReadModel, [
    'buildSitesGlobalExposureAverage', 'globalExposureAverage',
  ]);
  requireIncludes(sources[files.sitesGlobalExposureAverageReadModel], files.sitesGlobalExposureAverageReadModel, [
    'buildSitesCompletedActivityDays', 'completedDays', 'averageMs:', 'observedDayCount:', 'window.windowDayCount',
  ]);
  requireIncludes(sources[files.sitesCompletedActivityDays], files.sitesCompletedActivityDays, [
    'buildActivityDayPeriodSeries', 'filter((period) => !period.current)',
    'entry.collectionObservation.observed || entry.totalMs > 0 || entry.visits > 0',
    'projectActivityDayPeriodSeries', 'observedDayCount:', 'windowDayCount: SITES_OVERVIEW_DAYS',
  ]);
  requireIncludes(
    sources[files.sitesGlobalExposureAverageContract],
    files.sitesGlobalExposureAverageContract,
    [
      'requireSitesGlobalExposureAverage',
      'averageMs === null',
      'observedDayCount === 0',
      'observedDayCount > 0',
      'SITES_GLOBAL_EXPOSURE_AVERAGE_INVALID',
    ],
  );
  requireIncludes(sources[files.sitesHud], files.sitesHud, [
    'buildSitesGlobalCapViewModel',
    'globalExposureAverage',
    "const admissionReady = admissionStatus === 'ready'",
    'const model = admissionReady ? buildSitesGlobalCapViewModel(',
    'const average = model?.average',
    "const difference = !admissionReady || average.averageMs === null ? null",
    "average.averageMs === null ? t('sites_hud.average_collecting') : formatDuration(average.averageMs)",
    "t('sites_hud.average_evidence', { observed: average.observedDayCount, window: average.windowDayCount })",
    "evidence={admissionReady && recording.effectiveScope !== 'off'",
  ]);
  requireIncludes(sources[files.sitesGlobalCapModel], files.sitesGlobalCapModel, [
    'requireSitesGlobalExposureAverage(globalExposureAverage)',
    'average.averageMs === null',
  ]);
  requireExcludes(sources[files.scoreSetupSitesReadModel], files.scoreSetupSitesReadModel, [
    'globalWeeklyAverageMs',
  ]);
  requireExcludes(sources[files.sitesHud], files.sitesHud, [
    'globalWeeklyAverageMs',
  ]);

  requireIncludes(sources[files.basicStrategy], files.basicStrategy, [
    'PERSONAL_BASELINE_ROLES',
    'recentUsageWindowDays: BASIC_RECENT_USAGE_WINDOW_DAYS',
    'recentUsageRole: PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY',
    'recommendedTargetRole: PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE',
    'BASIC_TARGET_NORMATIVE_DEFAULT_MINUTES',
    'BASIC_TARGET_MAX_RECOMMENDED_MINUTES',
    'normativeDefaultTargetMinutes: BASIC_TARGET_NORMATIVE_DEFAULT_MINUTES',
    'maxRecommendedTargetMinutes: BASIC_TARGET_MAX_RECOMMENDED_MINUTES',
    "normativeDefaultSource: BASIC_TARGET_NORMATIVE_DEFAULT_SOURCE",
    "lifecyclePhase: 'stabilize'",
    "effectiveTargetSource: 'declared_target'",
    'buildBasicTargetRecommendation',
    'deriveBasicTargetRecommendationRelation',
    'recentUsageAverageDailyMs: trajectory.averageDailyMs',
    'currentPartialDayMinutes: todayMinutes',
    'requireBasicTargetRecommendationForTrajectory',
    'requiresUserReview: true',
    'autoApply: false',
  ]);
  requireExcludes(sources[files.basicStrategy], files.basicStrategy, [
    'BASIC_TARGET_RECOMMENDATION_SOURCES.RECENT_TRAJECTORY',
    'fallbackRecommendedTargetMinutes',
    'baselineMinutes',
    'BASIC_STRATEGY_PHASES',
    'adaptationDays',
    'convergeDays',
    'acclimateTargetWeights',
    'resolveBasicStrategyPhase',
    'resolveBasicEffectiveTargetMinutes',
    'export function resolveBasicRecommendedTargetMinutes',
    'daysSinceGoalSet',
  ]);
  requireIncludes(sources[files.basicContextContract], files.basicContextContract, [
    "BASIC_RECENT_USAGE_TRAJECTORY_VERSION = 'basic-protection-recent-trajectory-v1'",
    "BASIC_TARGET_RECOMMENDATION_VERSION = 'basic-target-recommendation-v2'",
    'BASIC_RECENT_USAGE_WINDOW_DAYS = 7',
    'BASIC_TARGET_NORMATIVE_DEFAULT_MINUTES = 30',
    'BASIC_TARGET_MAX_RECOMMENDED_MINUTES = 180',
    "RECENT_USAGE_TRAJECTORY: 'recent_usage_trajectory'",
    'PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY',
    'PERSONAL_BASELINE_METRIC_GRAINS.DAY',
    'resolveBasicRecentUsageStatus',
    "source', 'windowBasis', 'excludeCurrent'",
    "!['completed_calendar_days', 'completed_activity_days'].includes(value.provenance.windowBasis)",
    'value.averageDailyMs !== null',
    'requireBasicTargetRecommendation',
    'PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE',
    'BASIC_TARGET_NORMATIVE_DEFAULT_SOURCE',
    'deriveBasicTargetRecommendationRelation',
    'recentUsageAverageDailyMs',
    'currentPartialDayMinutes',
    'value.source !== expected.source',
    'uncappedRecommendedTargetMinutes',
    'maxRecommendedTargetMinutes',
    'requireBasicTargetRecommendationForTrajectory',
    'BASIC_TARGET_RECOMMENDATION_TRAJECTORY_RELATION_INVALID',
    'value.requiresUserReview !== true',
    'value.autoApply !== false',
  ]);
  requireIncludes(sources[files.basicTrajectory], files.basicTrajectory, [
    'buildBasicProtectionRecentUsageTrajectory',
    'getBasicRecentUsageDateWindow',
    'index - BASIC_RECENT_USAGE_WINDOW_DAYS',
    'Object.prototype.hasOwnProperty.call(dates, dateStr)',
    'return { observed: false, activeMs: null }',
    'return { observed: true, activeMs: 0 }',
    'BASIC_RECENT_USAGE_DAY_FACT_INVALID',
    'BASIC_RECENT_USAGE_DOMAIN_ACTIVE_FACT_INVALID',
    'averageDailyMs: observedDays > 0 ? activeTotalMs / observedDays : null',
    'requireBasicRecentUsageTrajectory',
  ]);
  requireExcludes(sources[files.basicTrajectory], files.basicTrajectory, [
    'buildDomainUsageWindowSummary',
    '.slice(-7)',
    'ensureNumber(',
  ]);
  requireIncludes(sources[files.protectionDecision], files.protectionDecision, [
    'buildBasicProtectionRecentUsageTrajectory',
    'recentUsageTrajectory',
    'targetRecommendation',
    'effectiveTargetMinutes: normalizedDeclaredTargetMinutes',
    'effectiveTargetSource: BASIC_STRATEGY_POLICY_DEFAULTS.effectiveTargetSource',
  ]);
  requireExcludes(sources[files.protectionDecision], files.protectionDecision, [
    'buildProtectionRecentUsageSummary',
    'recentAverageDailyMinutes',
    'daysSinceGoalSet',
  ]);
  requireIncludes(sources[files.runtimeInputProvider], files.runtimeInputProvider, [
    'getBasicRecentUsageDateWindow(now, statsCache)',
    'const selectedDateStrs = [...completedDateStrs, dateStr]',
    'Object.prototype.hasOwnProperty.call(dates, entryDate)',
    'PROTECTION_RUNTIME_INPUT_STATS_DAY_INVALID',
    'PROTECTION_RUNTIME_INPUT_STATS_DOMAIN_ACTIVE_INVALID',
    'active: domainStats.active',
  ]);
  requireExcludes(sources[files.runtimeInputProvider], files.runtimeInputProvider, [
    '.slice(-7)',
    'active: ensureNumber(dayStats?.domains',
  ]);
  requireIncludes(sources[files.basicOrchestrator], files.basicOrchestrator, [
    "strategyContext.lifecyclePhase !== 'stabilize'",
    "strategyContext.effectiveTargetSource !== 'declared_target'",
    'BASIC_STRATEGY_EFFECTIVE_TARGET_RELATION_INVALID',
    'requireBasicRecentUsageTrajectory',
    'requireBasicTargetRecommendationForTrajectory',
    'strategyContext.targetRecommendation,',
    'recentUsageTrajectory,',
    'recentUsageTrajectory: normalizedStrategyContext.recentUsageTrajectory',
    'targetRecommendation: normalizedStrategyContext.targetRecommendation',
  ]);
  requireExcludes(sources[files.basicOrchestrator], files.basicOrchestrator, [
    "lifecyclePhase === 'acclimate'",
    'effective_target_softened',
  ]);
  requireIncludes(sources[files.strategyContract], files.strategyContract, [
    'STRATEGY_LIFECYCLE_PHASES = Object.freeze([',
    "'stabilize'",
    'STRATEGY_LIFECYCLE_PHASE_INVALID',
    'cloneRecentUsageTrajectory',
    'cloneTargetRecommendation',
    'requireBasicTargetRecommendationForTrajectory',
    'const recentUsageTrajectory = cloneRecentUsageTrajectory(source.recentUsageTrajectory)',
    'source.targetRecommendation,',
    'recentUsageTrajectory,',
    'effectiveTargetSource: normalizeEffectiveTargetSource(source.effectiveTargetSource)',
  ]);
  requireExcludes(sources[files.strategyContract], files.strategyContract, [
    "  'acclimate',",
    "  'converge',",
    'export function normalizeStrategyLifecyclePhase',
  ]);
  requireIncludes(sources[files.protectionSnapshotBridge], files.protectionSnapshotBridge, [
    'runtime.strategy ? normalizeStrategyDecision(runtime.strategy) : null',
  ]);
  requireIncludes(sources[files.protectionRuntimeInsights], files.protectionRuntimeInsights, [
    'PERSONAL_BASELINE_ROLES',
    'strategy.targetRecommendation?.role === PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE',
    'strategy.targetRecommendation.requiresUserReview === true',
    'strategy.targetRecommendation.autoApply === false',
    'strategy.targetRecommendation.recommendedTargetMinutes',
    "runtime_insights.target_meta_declared",
    "recovery: 'reviewGoal'",
  ]);
  requireExcludes(sources[files.protectionRuntimeInsights], files.protectionRuntimeInsights, [
    "role === 'adaptive_reference'",
    "strategy.lifecyclePhase === 'acclimate'",
    'runtime_insights.target_settling',
    'runtime_insights.target_meta_acclimate',
    'runtime_insights.target_meta_effective',
    'Number(strategy.recommendedTargetMinutes)',
  ]);
  requireIncludes(sources[files.dashboardLaunchContext], files.dashboardLaunchContext, [
    "domain = (query.get('domain') || '').trim().toLowerCase()",
    "recovery: (query.get('recovery') || '').trim() || null",
  ]);
  requireExcludes(sources[files.dashboardLaunchContext], files.dashboardLaunchContext, [
    "query.get('recommendedTargetMinutes')",
    "query.get('declaredTargetMinutes')",
    'function normalizeMinutes(',
  ]);
  requireIncludes(sources[files.protectionNudgeDispatchContext], files.protectionNudgeDispatchContext, [
    "params.set('tab', 'sites')",
    "params.set('domain', hostname)",
    "params.set('recovery', recoveryAction)",
  ]);
  requireExcludes(sources[files.protectionNudgeDispatchContext], files.protectionNudgeDispatchContext, [
    "params.set('recommendedTargetMinutes'",
    "params.set('declaredTargetMinutes'",
    'readOptionalRecoveryTargetMinutes',
    'resolveRecoveryStrategy',
  ]);
  requireIncludes(sources[files.sitesManagementSurface], files.sitesManagementSurface, [
    'snapshot: normalizedRuntimeInsightSnapshot',
    'PERSONAL_BASELINE_ROLES',
    'targetRecommendation?.role !== PERSONAL_BASELINE_ROLES.ADAPTIVE_REFERENCE',
    'targetRecommendation.requiresUserReview !== true',
    'targetRecommendation.autoApply !== false',
    'targetRecommendation.recommendedTargetMinutes',
  ]);
  requireExcludes(sources[files.sitesManagementSurface], files.sitesManagementSurface, [
    "role !== 'adaptive_reference'",
    'routeRecommendedTargetMinutes',
    'routeDeclaredTargetMinutes',
    'actionParams.recommendedTargetMinutes',
    'actionParams.declaredTargetMinutes',
  ]);
  [files.filterLocaleEn, files.filterLocaleKo].forEach((localePath) => {
    requireIncludes(sources[localePath], localePath, [
      'target_meta_declared',
    ]);
    requireExcludes(sources[localePath], localePath, [
      'target_settling_title',
      'target_meta_acclimate',
      'target_soft_walls_title',
      'target_meta_effective',
    ]);
  });
  requireIncludes(sources[files.filterLocaleEn], files.filterLocaleEn, [
    'recommendations are review-only',
  ]);
  requireIncludes(sources[files.filterLocaleKo], files.filterLocaleKo, [
    '추천은 검토용으로만 제공됩니다',
  ]);
  requireExcludes(sources[files.basicPolicyTest], files.basicPolicyTest, [
    'resolveBasicStrategyPhase',
    'resolveBasicEffectiveTargetMinutes',
    'resolveBasicRecommendedTargetMinutes',
    'acclimation',
  ]);
  requireIncludes(sources[files.basicStrategyDoc], files.basicStrategyDoc, [
    'exact previous seven completed calendar days',
    '`observed=false`, `activeMs=null`',
    '`observed=true`, `activeMs=0`',
    '`requiresUserReview=true`',
    '`autoApply=false`',
    '`maxRecommendedTargetMinutes=180`',
    '`recentUsageAverageDailyMs`',
    '`currentPartialDayMinutes`',
    're-derives source, mode, uncapped, and capped values',
    'effectiveTargetMinutes = declaredTargetMinutes',
    'Basic has one current runtime lifecycle value: `stabilize`',
    'Dashboard URLs carry navigation intent only',
  ]);

  requireExcludes(sources[files.siteFeatureVector], files.siteFeatureVector, [
    'PERSONAL_BASELINE_ROLES',
    'recentWindow',
    'baselineWindow',
    'hasTrendComparison',
    'trendRole:',
    'trendRatio',
  ]);
  requireIncludes(sources[files.siteInsightModel], files.siteInsightModel, [
    'projectSitePullRecentTrajectory',
    'recentTrajectory = null',
    '...projectSitePullRecentTrajectory(recentTrajectory)',
  ]);
  requireIncludes(sources[files.targetPanelViewModel], files.targetPanelViewModel, [
    'requireWeeklyObservationState',
    'deriveWeeklyObservationSummary',
    'const weeklyObservationSummary = deriveWeeklyObservationSummary(weeklySeries',
    'observedDayCount: observedWeeklySeries.length',
    'requireCanonicalWeeklySummary',
    'TARGET_PANEL_WEEKLY_SUMMARY_RELATION_INVALID',
    'TARGET_PANEL_WEEKLY_SERIES_MISSING',
    'PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY',
    'intel?.analysis?.featureSummary',
    'requireRecentTrajectorySummary',
    'TARGET_PANEL_FEATURE_SUMMARY_INVALID',
    'TARGET_PANEL_RECENT_TRAJECTORY_ROLE_INVALID',
    'recentTrajectorySummary?.hasTrendComparison === true',
    'recentTrajectorySummary.trendRatio',
    "trendAuthorityState = recentTrajectorySummary === null",
    "? 'absent'",
    ": 'insufficient'",
  ]);
  requireExcludes(sources[files.targetPanelViewModel], files.targetPanelViewModel, [
    'observed !== false',
    'entry?.observed !== false',
    'activeDays / WEEK_DAYS',
    'Number.isFinite(intel?.weeklyTotal)',
    'function computeStreakDays',
    'baselineObservedSeries',
    'recentObservedSeries',
    'baselineAverageMs = average',
    'weeklySeries.slice(-3)',
    'weeklySeries.slice(0, -3)',
    'recentAvg',
    'pastAvg',
  ]);
  requireIncludes(sources[files.siteDecisionWorkspace], files.siteDecisionWorkspace, [
    'viewModel={targetPanelViewModel}',
    'projectionError={targetPanelError}',
    "'site_workspace.detail_pending_label'",
    'SiteIntelReadingSurface',
    'SiteIntelBoundary',
    'SiteGoalRecommendation',
    'onApply={onApplyScoreSetupDraft}',
  ]);
  requireExcludes(sources[files.siteDecisionWorkspace], files.siteDecisionWorkspace, [
    'observed !== false',
    'entry?.observed !== false',
    'buildTargetPanelViewModel',
    'weeklyObservationContract.js',
    'viewModel.weeklySeries',
    'viewModel.dailySeries',
    'intel?.todayHourly',
    'intel?.habitHourly',
  ]);

  requireExcludes(sources[files.dopamineDetector], files.dopamineDetector, [
    'personalContext',
    'PERSONAL_LIFT_MAX',
    'bounded_personal_risk_lift',
  ]);
  requireExcludes(sources[files.dopamineRuntime], files.dopamineRuntime, [
    'personalContext',
    'setPersonalContext',
  ]);
  requireExcludes(sources[files.dopamineReadiness], files.dopamineReadiness, [
    'personalLift',
    'bingeDetection.personal',
  ]);
}

function checkBoundaryMap(source) {
  requireIncludes(source, files.boundaryMap, [
    '- Status: Active',
    'src/lib/personalBaselineContract.js',
    'observed_baseline',
    'recent_trajectory',
    'adaptive_reference',
    'normative_anchor',
    'bucket_10s',
    'bucket_60s',
    'descriptive baseline and a prescriptive decision are different objects',
    'normative_only',
    'bounded_adaptive',
    'one-step lag',
    'Huber-bounded',
    'Detection is risk-only adaptive',
    'personal history\ncannot reduce or veto',
    'rhythm profile',
    'Basic protection recommendation',
    'the feed-tempo profile is shadow-only; no personal lift enters this detector',
    'Zen model/golden baselines',
    'IndexedDB `clse_baseline`',
    'flat summary fields are derived from the metric authority and are never accepted as a second input shape',
    'A shape-valid DTO cannot relabel a known metric',
    'derivePersonalBaselineMetricAnomaly()',
    'deriveSitePullRecentTrajectoryProjection()',
    'deriveSitePullAdaptiveReferenceProjection()',
    'sparse self-history does\nnot become a decision reference',
    'check:personal-baseline:architecture',
    'Score Setup target draft',
    'score_setup_recent_active_days_v1',
    'score_setup_recent_trajectory_v2',
    'retains all seven canonical',
    'reruns `buildScoreSetupRecentTrajectory()`',
    'stats_dates_domain_active',
    'observed=false, activeMs=null',
    'referenceMode=bounded_adaptive',
    'second inline action',
    'Sites HUD weekly average',
    'read-only activity-day presentation trajectory',
    'completed-period weight schedule',
    'reference.state=zero',
    'reference.state=missing',
    '`baselineSeries` and `baselineCurrentDateStr` form one mandatory Site Pull source',
    'reads 31 calendar days',
    '`observed=true, activeMs=0`',
    '`observed=false, activeMs=null`',
    'never substitutes `weeklySeries`',
    '`observedWeeklyDays`',
    '`observed=false` is missing evidence',
    'Missing compatibility scalars remain `null`',
    'does not\ninfer identity by array position',
    '`targetPanelViewModel.computeHabitScore()` is app-owned consumer scoring only',
    'trendAuthorityState=absent',
    'does not label them as stable',
    '`basic-protection-recent-trajectory-v1`',
    '`basic-target-recommendation-v2`',
    '`normativeDefaultSource=normative_default`',
    '`requiresUserReview=true`',
    '`autoApply=false`',
    '`maxRecommendedTargetMinutes=180`',
    '`recentUsageAverageDailyMs`',
    '`currentPartialDayMinutes`',
    're-derives source, mode, uncapped, and capped',
    '`effectiveTargetMinutes = declaredTargetMinutes`',
    '`effectiveTargetSource=declared_target`',
    'Sites/recovery URLs retain navigation state only',
  ]);
  requirePattern(
    source,
    files.boundaryMap,
    /Completed-day\s+profiles exclude the current day/iu,
    'completed-day profiles must explicitly exclude the current day.',
  );
  requirePattern(
    source,
    files.boundaryMap,
    /Missing, observed zero, and observed but\s+ineligible/iu,
    'missing, observed zero, and ineligible observation states must remain distinct.',
  );
}

function checkFeedTempoShadowBoundary(sources) {
  requireIncludes(sources[files.feedTempoContracts], files.feedTempoContracts, [
    'PERSONAL_BASELINE_METRIC_GRAINS',
    'PERSONAL_BASELINE_REFERENCE_MODES',
    'PERSONAL_BASELINE_STATUSES',
    'FEED_TEMPO_PROFILE_STATUSES = PERSONAL_BASELINE_STATUSES',
    'FEED_TEMPO_REFERENCE_MODES = PERSONAL_BASELINE_REFERENCE_MODES',
    'FEED_TEMPO_METRIC_GRAIN = PERSONAL_BASELINE_METRIC_GRAINS.PAGED_ITEM_DWELL',
    'normalizeFeedTempoDiagnosticSnapshot',
  ]);
  requireExcludes(sources[files.feedTempoContracts], files.feedTempoContracts, [
    "SPARSE: 'sparse'",
    "FORMING: 'forming'",
    "STABLE: 'stable'",
    "NORMATIVE_ONLY: 'normative_only'",
    "BOUNDED_ADAPTIVE: 'bounded_adaptive'",
  ]);

  requireIncludes(
    sources[files.feedTempoEpisodeAssembler],
    files.feedTempoEpisodeAssembler,
    [
      'recordAdvance(event = {})',
      'FEED_TEMPO_METRIC_GRAIN',
      'eligibleForObservedBaseline',
      'this._episode.interventionState === FEED_TEMPO_INTERVENTION_STATES.UNASSISTED',
      'this._episode.censoredDwellCount += 1',
      "reason: 'idle_timeout'",
    ],
  );
  requireExcludes(
    sources[files.feedTempoEpisodeAssembler],
    files.feedTempoEpisodeAssembler,
    [
      'MutationObserver',
      'querySelector',
      'localStorage',
      'chrome.storage',
      'indexedDB',
    ],
  );

  const learner = sources[files.feedTempoProfileLearner];
  requireIncludes(learner, files.feedTempoProfileLearner, [
    'hydrateProfileState(surface, profileState',
    'FEED_TEMPO_METRIC_GRAIN',
    'FEED_TEMPO_PROFILE_PERSISTENCE',
    "throw new Error('FEED_TEMPO_PROFILE_DURABLE_COMMIT_REQUIRED')",
  ]);
  const adaptiveModel = sources[files.feedTempoAdaptiveModel];
  requireIncludes(adaptiveModel, files.feedTempoAdaptiveModel, [
    'HUBER_CLIP_SIGMA = 3',
    'evaluateFeedTempoEpisodeAgainstProfile({',
    'applyEligibleEpisodeToFeedTempoCheckpoint({',
    'FEED_TEMPO_PROFILE_POLICY.evidenceHalfLifeMs',
    'FEED_TEMPO_PROFILE_POLICY.confidenceHalfLifeMs',
    'FEED_TEMPO_PROFILE_POLICY.maximumCenterStepRatio',
    'fact.interventionState !== FEED_TEMPO_INTERVENTION_STATES.UNASSISTED',
  ]);
  requireOrdered(
    readSection(
      adaptiveModel,
      'export function applyEligibleEpisodeToFeedTempoCheckpoint({',
      'export function restoreFeedTempoAdaptiveProfile({',
    ),
    files.feedTempoAdaptiveModel,
    [
      'const evaluation = evaluateFeedTempoEpisodeAgainstProfile({',
      'const nextProfile = applyEpisodeToProfile(',
      'const nextCheckpoint = requireFeedTempoProfileCheckpoint({',
    ],
    'feed tempo must compare a finalized episode before learning from it',
  );
  requireExcludes(learner, files.feedTempoProfileLearner, [
    'localStorage',
    'chrome.storage',
    'indexedDB',
  ]);

  requireIncludes(sources[files.feedTempoRuntime], files.feedTempoRuntime, [
    "mode: 'observe_only'",
    'FEED_TEMPO_PROFILE_PERSISTENCE',
    "mode: 'persisted_shadow'",
    "backend: 'indexeddb_model_state'",
    'this._persistenceClient.restoreSurface(normalizedSurface)',
    'this._persistenceClient.commitEpisode(fact)',
    'this._profileLearner.hydrateProfileState(',
    'summarizeFeedTempoEpisodeFact(this._lastEpisode)',
    '_measureOperation(kind, operation)',
    'measurementState: operationCount > 0 ?',
    'advanceOperationCount',
    'finalizedEpisodeCount',
  ]);
  requireIncludes(
    sources[files.feedTempoCheckpointContract],
    files.feedTempoCheckpointContract,
    [
      "'feed_tempo_adaptive_profile_checkpoint_v1'",
      "FEED_TEMPO_PROFILE_PERSISTENCE = 'indexeddb_checkpoint'",
      'normativePagedDwellMs: 5_000',
      'evidenceHalfLifeMs: 30 * 24 * 60 * 60 * 1000',
      'confidenceHalfLifeMs: 7 * 24 * 60 * 60 * 1000',
      'maximumCenterStepRatio: 0.04',
      'minimumLearningConfidence: 0.5',
    ],
  );
  requireIncludes(
    sources[files.feedTempoCheckpointRepository],
    files.feedTempoCheckpointRepository,
    [
      'getEntryWithProfileEpoch',
      'compareAndSetValueWithProfileEpoch',
      'expectedRevision',
    ],
  );
  requireIncludes(
    sources[files.feedTempoPersistenceService],
    files.feedTempoPersistenceService,
    [
      'resolveProfileResetGeneration(lifecycle)',
      'this._assertWriteAdmission({ expectedResetId: profileEpoch })',
      'this._casAttemptLimit',
      'FEED_TEMPO_PERSISTED_CHECKPOINT_CONFLICT_EXHAUSTED',
    ],
  );
  requireIncludes(
    sources[files.feedTempoDiagnosticState],
    files.feedTempoDiagnosticState,
    [
      'normalizeFeedTempoDiagnosticSnapshot(snapshot)',
      'latestTempoSnapshot',
    ],
  );
  requireExcludes(
    sources[files.feedTempoDiagnosticState],
    files.feedTempoDiagnosticState,
    ['cloneContentFreeValue'],
  );
  // Consumption cadence replaced the production tempo observer. Retained
  // research contracts must not be reconnected to the runtime dependency graph.
  requireExcludes(sources[files.feedFlowRuntime], files.feedFlowRuntime, [
    'FeedTempoRuntime', '_tempoRuntime',
  ]);
  requireExcludes(sources[files.feedFlowRuntime], files.feedFlowRuntime, [
    'this._tempoRuntime.markIntervention(',
  ]);
  requireExcludes(sources[files.feedFlowJudge], files.feedFlowJudge, [
    'FeedTempo',
    'personalBaseline',
    'personal_profile',
  ]);
  requireIncludes(sources[files.boundaryMap], files.boundaryMap, [
    '`paged_item_dwell`',
    'Retained Feed Tempo research profile',
    'persistent adaptive profile',
    '`feed_tempo_adaptive_profile_checkpoint_v1`',
    'evidence weight has a 30-day half-life',
    'confidence freshness has a separate 7-day half-life',
    'at most 4%',
    'compare before observe',
    'There is no legacy',
    'not consumed by `FeedFlowJudge`',
  ]);
}

async function main() {
  const entries = await Promise.all(Object.values(files).map(async (relativePath) => (
    [relativePath, await read(relativePath)]
  )));
  const sources = Object.fromEntries(entries);

  checkSitesCapAdmissionContinuity(sources);

  await checkSharedVocabularyAndBuilder(sources);
  await checkNoStatsCoreDeepImports();
  await requirePathAbsent(
    'src/apps/dashboard/tabs/sites/components/SitesScoreSetupDraftPanel.jsx',
    'retired orphaned bulk Score Setup UI must not return beside the canonical selected-site review flow.',
  );
  await requirePathAbsent(
    'tests/sitesScoreSetupDraftPanel.test.jsx',
    'direct-only coverage for the retired bulk Score Setup UI must not return.',
  );
  checkDailyConsumers(sources);
  checkScoreDecision(sources);
  checkScoreSetupReference(sources);
  checkClseSameGrainContract(sources);
  checkFeedTempoShadowBoundary(sources);
  checkRoleBoundaries(sources);
  checkBoundaryMap(sources[files.boundaryMap]);

  if (failures.length > 0) {
    failures.forEach((message) => console.error(`[personal-baseline-architecture] FAIL: ${message}`));
    process.exit(1);
  }

  console.log('[personal-baseline-architecture] PASS');
}

main().catch((error) => {
  console.error('[personal-baseline-architecture] FAIL:', error);
  process.exit(1);
});
