#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { enforceSoftModuleBudget } from './architectureGuardUtils.mjs';

const rootDir = process.cwd();

const files = {
  orchestrator: 'src/domains/stats/background/query/statsAnalysisQueryService.js',
  trendQuery: 'src/domains/stats/background/query/statsTrendQueryService.js',
  precisionRawDataQuery: 'src/domains/stats/background/query/precisionRawDataQueryService.js',
  factsQuery: 'src/domains/stats/background/query/statsFactsQueryService.js',
  factsReadModelContracts: 'src/domains/stats/background/contracts/statsReadModelContracts.js',
  statsRuntimeEpochContract: 'src/domains/stats/contracts/statsRuntimeEpochContracts.js',
  factsRepositoryReadUtils: 'src/domains/stats/background/query/statsFactsRepositoryReadUtils.js',
  analysisStatsRange: 'src/domains/stats/background/query/statsAnalysisStatsRange.js',
  normalizedRangeRegistry: 'src/domains/stats/background/contracts/statsNormalizedRangeRegistry.js',
  sitesEvidenceQuery: 'src/domains/stats/background/query/statsSitesEvidenceQuery.js',
  policySnapshot: 'src/domains/stats/analysis/policySnapshot.js',
  shared: 'src/domains/stats/background/query/statsAnalysisQueryShared.js',
  statusSnapshotContract: 'src/domains/stats/contracts/statsStatusSnapshotContract.js',
  statusReadModel: 'src/domains/stats/background/query/statsStatusSnapshotReadModel.js',
  siteInsightSynthesis: 'src/domains/stats/insights/synthesis/synthesizeSiteInsight.js',
  statusVisibleDomainReadModel: 'src/domains/stats/background/query/statsStatusVisibleDomainReadModel.js',
  sitesReadModel: 'src/domains/stats/background/query/statsSitesSnapshotReadModel.js',
  sitesRegistryReadModel: 'src/domains/stats/background/query/statsSitesRegistryReadModel.js',
  sitesSiteDetailContract: 'src/domains/stats/contracts/sitesSiteDetailContracts.js',
  sitesSiteDetailReadModel: 'src/domains/stats/background/query/statsSitesSiteDetailReadModel.js',
  sitesSiteDetailQuery: 'src/domains/stats/background/query/statsSitesSiteDetailQueryService.js',
  siteIntelReadModel: 'src/domains/stats/background/query/statsSiteIntelReadModel.js',
  siteRecurringTimeEvidence: 'src/domains/stats/background/query/statsSiteRecurringTimeEvidence.js',
  siteLongTermPatterns: 'src/domains/stats/background/query/statsSiteLongTermPatterns.js',
  siteLongTermPatternContract: 'src/domains/stats/contracts/siteLongTermPatternContract.js',
  siteTodayNotes: 'src/domains/stats/background/query/statsSiteTodayNotes.js',
  siteTodayNotesContract: 'src/domains/stats/contracts/siteTodayNotesContract.js',
  siteIntelEvidenceContract: 'src/domains/stats/background/query/statsSiteIntelEvidenceContract.js',
  siteIntelMetricStats: 'src/domains/stats/background/query/statsSiteIntelMetricStats.js',
  siteTransitionEdges: 'src/domains/stats/background/query/statsSiteTransitionEdges.js',
  siteInterventionEffects: 'src/domains/stats/background/query/statsSiteInterventionEffects.js',
  statusController: 'src/apps/dashboard/hooks/useStatusController.js',
  sitesController: 'src/apps/dashboard/tabs/sites/useSitesController.js',
  sitesPolicyHook: 'src/apps/dashboard/tabs/sites/controller/useSitesPolicySnapshot.js',
  sitesPolicyResource: 'src/apps/dashboard/tabs/sites/controller/sitesPolicySnapshotResource.js',
  sitesDetailResource: 'src/apps/dashboard/tabs/sites/controller/sitesSiteDetailResource.js',
  sitesPreloader: 'src/apps/dashboard/tabs/sites/preloadSitesTabData.js',
  analysisResponseContracts: 'src/apps/dashboard/stores/analysisStoreResponseContracts.js',
  statsRepository: 'src/domains/stats/background/persistence/statsRepository.js',
  statsAggregator: 'src/domains/stats/background/aggregation/statsAggregator.js',
  statsCollector: 'src/domains/stats/background/collection/statsCollector.js',
  statsRuntimePersistenceService: 'src/domains/stats/background/persistence/statsRuntimePersistenceService.js',
  statsBucketMaterializer: 'src/domains/stats/background/persistence/statsBucketMaterializer.js',
  statsHourlyProjectionCommitter: 'src/domains/stats/background/persistence/statsHourlyProjectionCommitter.js',
  statsRetentionJob: 'src/domains/stats/background/persistence/statsRetentionJob.js',
  statsRuntimeService: 'src/domains/stats/background/runtime/statsRuntimeService.js',
  statsRuntimeCache: 'src/domains/stats/background/runtime/statsRuntimeCache.js',
  statsRuntimeHealthLedger: 'src/domains/stats/background/runtime/statsRuntimeHealthLedger.js',
  statsAggregateRepository: 'src/platform/storage/stats/StatsAggregateRepository.js',
  statsAggregateStore: 'src/platform/storage/internal/indexeddb/stores/StatsAggregateStore.js',
  dbStatsNormalizers: 'src/platform/storage/internal/indexeddb/dbStatsNormalizers.js',
  dbImportSnapshot: 'src/platform/storage/internal/indexeddb/dbImportSnapshot.js',
  statsContracts: 'src/domains/stats/contracts/statsContracts.js',
  preparedHourlyBucketRegistry: 'src/domains/stats/contracts/statsPreparedHourlyBucketRegistry.js',
  baselineDoc: 'docs/domains/stats/stats-engine-baseline.md',
  sitesBoundaryDoc: 'docs/architecture/repository/sites-schedule-boundary-map.md',
  factsQueryTest: 'tests/statsFactsQueryService.test.js',
  statsRuntimeCacheTest: 'tests/statsRuntimeCache.test.js',
  analysisResponseContractsTest: 'tests/analysisStoreResponseContracts.test.js',
  serviceTest: 'tests/statsAnalysisQueryService.test.js',
  statusReadModelTest: 'tests/statsStatusSnapshotReadModel.test.js',
  statusVisibleDomainReadModelTest: 'tests/statsStatusVisibleDomainReadModel.test.js',
  sitesReadModelTest: 'tests/statsSitesSnapshotReadModel.test.js',
  sitesSiteDetailReadModelTest: 'tests/statsSitesSiteDetailReadModel.test.js',
  sitesSiteDetailQueryTest: 'tests/statsSitesSiteDetailQueryService.test.js',
  sitesPolicyHookTest: 'tests/useSitesPolicySnapshot.test.jsx',
  sitesDetailHookTest: 'tests/useSitesSiteDetail.test.jsx',
  sitesPreloaderTest: 'tests/sitesTabDataPreload.test.js',
  siteIntelReadModelTest: 'tests/statsSiteIntelReadModel.test.js',
  siteTodayNotesTest: 'tests/statsSiteTodayNotes.test.js',
  siteRecurringTimeEvidenceTest: 'tests/statsSiteRecurringTimeEvidence.test.js',
  siteTransitionEdgesTest: 'tests/statsSiteTransitionEdges.test.js',
  siteInterventionEffectsTest: 'tests/statsSiteInterventionEffects.test.js',
  dbStatsNormalizersTest: 'tests/dbStatsNormalizers.test.js',
  importHardeningTest: 'tests/indexedDbImportSnapshotHardening.test.js',
  trendQueryTest: 'tests/statsTrendQueryService.test.js',
  runtimeServiceTest: 'tests/statsRuntimeServiceRuntimePath.test.js',
  rolloverLockTest: 'tests/statsRolloverLockOrdering.test.js',
  analysisStatsRangeTest: 'tests/statsAnalysisStatsRange.test.js',
  statsRuntimeHealthLedgerTest: 'tests/statsRuntimeHealthLedger.test.js',
  statsRuntimeHealthIsolationTest: 'tests/statsRuntimeHealthIsolation.test.js',
  statsRepositoryReadPathTest: 'tests/statsRepositoryReadPath.test.js',
  statsAggregateStoreTest: 'tests/statsAggregateStore.test.js',
};

const forbiddenFiles = [
  'docs/domains/stats/stats-cutover-plan.md',
  'src/domains/stats/background/query/statsQueryService.js',
  'src/domains/stats/background/query/zenClosedDayRecapSnapshotQueryService.js',
  'src/domains/stats/background/query/zenClosedDayRecapSnapshotReadModel.js',
  'tests/statsQueryService.test.js',
];

const readModelFiles = [
  files.shared,
  files.statusReadModel,
  files.statusVisibleDomainReadModel,
  files.sitesReadModel,
  files.sitesRegistryReadModel,
  files.sitesSiteDetailReadModel,
  files.siteIntelReadModel,
  files.siteRecurringTimeEvidence,
  files.siteLongTermPatterns,
  files.siteLongTermPatternContract,
  files.siteTodayNotes,
  files.siteTodayNotesContract,
  files.siteIntelEvidenceContract,
  files.siteIntelMetricStats,
  files.siteTransitionEdges,
  files.siteInterventionEffects,
];

function fail(message) {
  console.error(`[stats-read-model-architecture] FAIL: ${message}`);
  process.exit(1);
}

async function pathExists(relativePath) {
  try {
    await fs.access(path.resolve(rootDir, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readSource(relativePath) {
  return fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
}

async function listJavaScriptFiles(relativeDir) {
  const entries = await fs.readdir(path.resolve(rootDir, relativeDir), { withFileTypes: true });
  const filesInTree = await Promise.all(entries.map(async (entry) => {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(relativePath);
    return entry.isFile() && entry.name.endsWith('.js') ? [relativePath] : [];
  }));
  return filesInTree.flat();
}

function assertIncludes(source, file, tokens) {
  tokens.forEach((token) => {
    if (!source.includes(token)) {
      fail(`${file} must include required stats read-model token: ${token}`);
    }
  });
}

function assertExcludes(source, file, tokens) {
  tokens.forEach((token) => {
    if (source.includes(token)) {
      fail(`${file} must not include forbidden stats read-model token: ${token}`);
    }
  });
}

function assertNotMatches(source, file, rules) {
  rules.forEach(({ pattern, reason }) => {
    if (pattern.test(source)) {
      fail(`${file} violates stats read-model architecture: ${reason}`);
    }
  });
}

function assertFunctionSourceExcludes(source, file, functionName, tokens) {
  const marker = `function ${functionName}(`;
  const start = source.indexOf(marker);
  if (start < 0) {
    fail(`${file} must include stats read-model function: ${functionName}`);
  }
  const candidates = [
    source.indexOf('\nfunction ', start + marker.length),
    source.indexOf('\nexport function ', start + marker.length),
  ].filter((index) => index >= 0);
  const nextFunction = candidates.length > 0 ? Math.min(...candidates) : -1;
  const functionSource = source.slice(start, nextFunction >= 0 ? nextFunction : source.length);
  tokens.forEach((token) => {
    if (functionSource.includes(token)) {
      fail(`${file} function ${functionName} must not include stats read-model token: ${token}`);
    }
  });
}

async function main() {
  for (const relativePath of Object.values(files)) {
    if (!await pathExists(relativePath)) {
      fail(`required file missing: ${relativePath}`);
    }
  }

  for (const relativePath of forbiddenFiles) {
    if (await pathExists(relativePath)) {
      fail(`retired stats read-model path must stay deleted: ${relativePath}`);
    }
  }

  const preparedBucketRegistrarOwners = [];
  for (const relativePath of await listJavaScriptFiles('src')) {
    const source = await readSource(relativePath);
    if (source.includes('registerPreparedStatsHourlyBucket')) {
      preparedBucketRegistrarOwners.push(relativePath);
    }
  }
  const expectedPreparedBucketRegistrarOwners = [
    files.statsBucketMaterializer,
    files.preparedHourlyBucketRegistry,
  ].sort();
  if (
    JSON.stringify(preparedBucketRegistrarOwners.sort())
    !== JSON.stringify(expectedPreparedBucketRegistrarOwners)
  ) {
    fail(
      `prepared hourly bucket registration must stay materializer-only; found ${preparedBucketRegistrarOwners.join(', ')}`,
    );
  }

  const preparedBucketConsumerOwners = [];
  for (const relativePath of await listJavaScriptFiles('src')) {
    const source = await readSource(relativePath);
    if (source.includes('consumePreparedStatsHourlyBucket')) {
      preparedBucketConsumerOwners.push(relativePath);
    }
  }
  const expectedPreparedBucketConsumerOwners = [
    files.statsAggregateStore,
    files.preparedHourlyBucketRegistry,
  ].sort();
  if (
    JSON.stringify(preparedBucketConsumerOwners.sort())
    !== JSON.stringify(expectedPreparedBucketConsumerOwners)
  ) {
    fail(
      `prepared hourly bucket consumption must stay aggregate-store-only; found ${preparedBucketConsumerOwners.join(', ')}`,
    );
  }

  const orchestratorSource = await readSource(files.orchestrator);
  const trendQuerySource = await readSource(files.trendQuery);
  const precisionRawDataQuerySource = await readSource(files.precisionRawDataQuery);
  const factsQuerySource = await readSource(files.factsQuery);
  const factsReadModelContractsSource = await readSource(files.factsReadModelContracts);
  const statsRuntimeEpochContractSource = await readSource(files.statsRuntimeEpochContract);
  const factsRepositoryReadUtilsSource = await readSource(files.factsRepositoryReadUtils);
  const analysisStatsRangeSource = await readSource(files.analysisStatsRange);
  const normalizedRangeRegistrySource = await readSource(files.normalizedRangeRegistry);
  const sitesEvidenceQuerySource = await readSource(files.sitesEvidenceQuery);
  const policySnapshotSource = await readSource(files.policySnapshot);
  const sharedSource = await readSource(files.shared);
  const statusSnapshotContractSource = await readSource(files.statusSnapshotContract);
  const statusReadModelSource = await readSource(files.statusReadModel);
  const siteInsightSynthesisSource = await readSource(files.siteInsightSynthesis);
  const statusVisibleDomainReadModelSource = await readSource(files.statusVisibleDomainReadModel);
  const sitesReadModelSource = await readSource(files.sitesReadModel);
  const sitesRegistryReadModelSource = await readSource(files.sitesRegistryReadModel);
  const sitesSiteDetailContractSource = await readSource(files.sitesSiteDetailContract);
  const sitesSiteDetailReadModelSource = await readSource(files.sitesSiteDetailReadModel);
  const sitesSiteDetailQuerySource = await readSource(files.sitesSiteDetailQuery);
  const siteIntelSource = await readSource(files.siteIntelReadModel);
  const siteRecurringTimeEvidenceSource = await readSource(files.siteRecurringTimeEvidence);
  const siteLongTermPatternsSource = await readSource(files.siteLongTermPatterns);
  const siteLongTermPatternContractSource = await readSource(files.siteLongTermPatternContract);
  const siteTodayNotesSource = await readSource(files.siteTodayNotes);
  const siteTodayNotesContractSource = await readSource(files.siteTodayNotesContract);
  const siteIntelEvidenceContractSource = await readSource(files.siteIntelEvidenceContract);
  const siteIntelMetricStatsSource = await readSource(files.siteIntelMetricStats);
  const siteTransitionEdgesSource = await readSource(files.siteTransitionEdges);
  const siteInterventionEffectsSource = await readSource(files.siteInterventionEffects);
  const statusControllerSource = await readSource(files.statusController);
  const sitesControllerSource = await readSource(files.sitesController);
  const sitesPolicyHookSource = await readSource(files.sitesPolicyHook);
  const sitesPolicyResourceSource = await readSource(files.sitesPolicyResource);
  const sitesDetailResourceSource = await readSource(files.sitesDetailResource);
  const sitesPreloaderSource = await readSource(files.sitesPreloader);
  const analysisResponseContractsSource = await readSource(files.analysisResponseContracts);
  const statsRepositorySource = await readSource(files.statsRepository);
  const statsAggregatorSource = await readSource(files.statsAggregator);
  const statsCollectorSource = await readSource(files.statsCollector);
  const statsBucketMaterializerSource = await readSource(files.statsBucketMaterializer);
  const statsHourlyProjectionCommitterSource = await readSource(files.statsHourlyProjectionCommitter);
  const statsRetentionJobSource = await readSource(files.statsRetentionJob);
  const statsRuntimeServiceSource = await readSource(files.statsRuntimeService);
  const statsRuntimeCacheSource = await readSource(files.statsRuntimeCache);
  const statsRuntimeHealthLedgerSource = await readSource(files.statsRuntimeHealthLedger);
  const statsRuntimePersistenceServiceSource = await readSource(files.statsRuntimePersistenceService);
  const statsAggregateRepositorySource = await readSource(files.statsAggregateRepository);
  const statsAggregateStoreSource = await readSource(files.statsAggregateStore);
  const dbStatsNormalizersSource = await readSource(files.dbStatsNormalizers);
  const dbImportSnapshotSource = await readSource(files.dbImportSnapshot);
  const statsContractsSource = await readSource(files.statsContracts);
  const preparedHourlyBucketRegistrySource = await readSource(files.preparedHourlyBucketRegistry);
  const baselineDocSource = await readSource(files.baselineDoc);
  const sitesBoundaryDocSource = await readSource(files.sitesBoundaryDoc);
  const factsQueryTestSource = await readSource(files.factsQueryTest);
  const statsRuntimeCacheTestSource = await readSource(files.statsRuntimeCacheTest);
  const analysisResponseContractsTestSource = await readSource(files.analysisResponseContractsTest);
  const serviceTestSource = await readSource(files.serviceTest);
  const statusReadModelTestSource = await readSource(files.statusReadModelTest);
  const statusVisibleDomainReadModelTestSource = await readSource(files.statusVisibleDomainReadModelTest);
  const sitesReadModelTestSource = await readSource(files.sitesReadModelTest);
  const sitesSiteDetailReadModelTestSource = await readSource(files.sitesSiteDetailReadModelTest);
  const sitesSiteDetailQueryTestSource = await readSource(files.sitesSiteDetailQueryTest);
  const sitesPolicyHookTestSource = await readSource(files.sitesPolicyHookTest);
  const sitesDetailHookTestSource = await readSource(files.sitesDetailHookTest);
  const sitesPreloaderTestSource = await readSource(files.sitesPreloaderTest);
  const siteIntelReadModelTestSource = await readSource(files.siteIntelReadModelTest);
  const siteRecurringTimeEvidenceTestSource = await readSource(files.siteRecurringTimeEvidenceTest);
  const siteTransitionEdgesTestSource = await readSource(files.siteTransitionEdgesTest);
  const siteInterventionEffectsTestSource = await readSource(files.siteInterventionEffectsTest);
  const dbStatsNormalizersTestSource = await readSource(files.dbStatsNormalizersTest);
  const importHardeningTestSource = await readSource(files.importHardeningTest);
  const trendQueryTestSource = await readSource(files.trendQueryTest);
  const runtimeServiceTestSource = await readSource(files.runtimeServiceTest);
  const rolloverLockTestSource = await readSource(files.rolloverLockTest);
  const analysisStatsRangeTestSource = await readSource(files.analysisStatsRangeTest);
  const statsRuntimeHealthLedgerTestSource = await readSource(files.statsRuntimeHealthLedgerTest);
  const statsRuntimeHealthIsolationTestSource = await readSource(files.statsRuntimeHealthIsolationTest);
  const statsRepositoryReadPathTestSource = await readSource(files.statsRepositoryReadPathTest);
  const statsAggregateStoreTestSource = await readSource(files.statsAggregateStoreTest);

  assertIncludes(orchestratorSource, files.orchestrator, [
    "from './statsFactsRepositoryReadUtils.js'",
    "from './statsAnalysisQueryShared.js'",
    "from './statsStatusSnapshotReadModel.js'",
    "from './statsSitesSnapshotReadModel.js'",
    "from './statsSitesSiteDetailQueryService.js'",
    "from './statsSitesEvidenceQuery.js'",
    "from './statsAnalysisStatsRange.js'",
    'STATS_ANALYSIS_QUERY_CYCLE_STATE_INVALID',
    'buildCycleProjection(',
    'buildStatusSnapshot(',
    'buildSitesSnapshot(',
    'getSitesSiteDetail: sitesSiteDetailQueryService.getSitesSiteDetail',
    'prepareAnalysisStatsRange(statsRange)',
  ]);
  assertIncludes(analysisStatsRangeSource, files.analysisStatsRange, [
    'const analysisStatsRangeTokens = new WeakMap();',
    "from '../contracts/statsNormalizedRangeRegistry.js'",
    'normalizeAnalysisStatsRangeAtBoundary',
    'propagateNormalizedAnalysisStatsRange',
    'prepareAnalysisStatsRange',
    'readAnalysisStatsRange',
    'STATS_ANALYSIS_DERIVED_RANGE_INVALID',
  ]);
  assertIncludes(normalizedRangeRegistrySource, files.normalizedRangeRegistry, [
    'const normalizedStatsRanges = new WeakSet();',
    'markStatsRangeNormalized',
    'isStatsRangeNormalized',
    'STATS_NORMALIZED_RANGE_REGISTRY_INVALID',
  ]);
  assertIncludes(factsRepositoryReadUtilsSource, files.factsRepositoryReadUtils, [
    'normalizeAnalysisStatsRangeAtBoundary(range)',
  ]);
  assertIncludes(sharedSource, files.shared, [
    'readAnalysisStatsRange(value)',
  ]);
  assertExcludes(factsRepositoryReadUtilsSource, files.factsRepositoryReadUtils, [
    'normalizeStatsRange(range)',
  ]);
  assertIncludes(sitesEvidenceQuerySource, files.sitesEvidenceQuery, [
    'STATS_ANALYSIS_QUERY_INTERVENTION_EFFECTS_REQUIRED',
    'STATS_ANALYSIS_QUERY_INTERVENTION_EFFECTS_INVALID',
  ]);
  assertIncludes(sitesReadModelSource, files.sitesReadModel, [
    "from './statsSitesRegistryReadModel.js'",
    'buildSitesRegistryReadModel',
    'SITES_SITE_INTEL_DETAIL_TIER.ANALYSIS',
    'SITES_SITE_INTEL_ANALYSIS_LIMIT',
    'analysisDetailCount',
    'deferredAnalysisCount',
    'registryEntryCount',
    'buildSitesSiteDetailRevision',
    'siteDetailRevision',
  ]);
  assertIncludes(sitesSiteDetailContractSource, files.sitesSiteDetailContract, [
    'STATS_SITES_SITE_DETAIL_DOMAIN_INVALID',
    'SITES_SITE_DETAIL_QUERY_RESULT_INVALID',
    'requireSitesSiteDetailDomain',
    'requireSitesSiteDetailQueryResult',
    'createSitesSiteDetailRevision',
    'requireSitesSiteDetailRevision',
    'SITES_SITE_DETAIL_REVISION_VERSION',
    'SITES_SITE_DETAIL_REVISION_VERSION = 2',
    '`epoch:${normalizedFactsRuntimeEpoch}`',
  ]);
  assertIncludes(sitesSiteDetailReadModelSource, files.sitesSiteDetailReadModel, [
    'STATS_SITES_SITE_DETAIL_INTERVENTION_EFFECTS_REQUIRED',
    'SITES_SITE_INTEL_DETAIL_TIER.FULL',
    'buildSitesSiteDetail',
    'resolveSitesSiteDetailProjectionDomains',
    'scopeSitesSiteDetailStatsRange',
    'domains: projectionDomains',
    'projectedDomainCount',
  ]);
  assertIncludes(sitesSiteDetailQuerySource, files.sitesSiteDetailQuery, [
    'SITES_SITE_DETAIL_CACHE_TTL_MS',
    'SITES_SITE_DETAIL_CACHE_MAX_ENTRIES',
    'SITES_SITE_DETAIL_EVIDENCE_CACHE_TTL_MS',
    'SITES_SITE_DETAIL_EVIDENCE_CACHE_MAX_ENTRIES',
    'createSitesSiteDetailQueryService',
    'getStatsSitesInterventionEvidenceBaselineRange',
    'statsRange',
    'inFlight',
    'interventionEvidenceInFlight',
    'resolvedCacheTtlMs > 0',
    'requireSitesSiteDetailQueryResult',
    'STATS_SITES_SITE_DETAIL_FACTS_OWNER_REQUIRED',
    'STATS_SITES_SITE_DETAIL_INTERVENTION_EVIDENCE_OWNER_REQUIRED',
    'buildSitesSiteDetailRevision',
    'siteDetailRevision',
  ]);
  assertIncludes(sitesRegistryReadModelSource, files.sitesRegistryReadModel, [
    'SITES_REGISTRY_USAGE_BASIS',
    'SITES_REGISTRY_PROTECTION_BASIS',
    'resolveSitesRegistryDomain',
    'buildSitesRegistryReadModel',
  ]);
  assertIncludes(sharedSource, files.shared, [
    'readRequiredStatsSettingsSnapshot',
    'STATS_POLICY_OVERRIDE_INVALID',
    'readOptionalStatsCycleState',
  ]);
  assertIncludes(trendQuerySource, files.trendQuery, [
    'STATS_TREND_QUERY_CYCLE_STATE_REQUIRED',
    'STATS_TREND_QUERY_CYCLE_STATE_INVALID',
    'STATS_TREND_QUERY_START_DATE_INVALID',
    'STATS_TREND_QUERY_END_DATE_INVALID',
    'STATS_TREND_QUERY_RANGE_ORDER_INVALID',
    'STATS_TREND_QUERY_RANGE_SPAN_EXCEEDED',
  ]);
  assertIncludes(precisionRawDataQuerySource, files.precisionRawDataQuery, [
    'PRECISION_RAW_DATA_QUERY_INVALID_STATS_RANGE',
  ]);
  assertIncludes(factsQuerySource, files.factsQuery, [
    'STALE_STATS_FACTS_RANGE_QUERY_FAILED',
    'const revisionInvalidationErrors = new WeakSet()',
    'if (!revisionInvalidationErrors.has(error)) throw error;',
    'return readStatsFactsRangeAttempt(options);',
    'STATS_FACTS_QUERY_REVISION_RETRY',
    'hourlyReadDiagnostics:',
    'getStatsRuntimeEpochFor(runtime)',
    'runtimeEpoch: range?.readModel?.runtimeEpoch',
  ]);
  assertIncludes(factsReadModelContractsSource, files.factsReadModelContracts, [
    'requireStatsRuntimeEpoch(runtimeEpoch)',
    'runtimeEpoch: normalizedRuntimeEpoch',
    'requireStatsFactsRuntimeEpoch',
  ]);
  assertIncludes(statsRuntimeEpochContractSource, files.statsRuntimeEpochContract, [
    'STATS_RUNTIME_EPOCH_HEX_LENGTH = 32',
    'STATS_RUNTIME_EPOCH_INVALID',
    '/^[0-9a-f]+$/u',
  ]);
  assertIncludes(statsRuntimeCacheSource, files.statsRuntimeCache, [
    'STATS_RUNTIME_EPOCH_BYTE_LENGTH = 16',
    'STATS_RUNTIME_EPOCH_CRYPTO_OWNER_REQUIRED',
    'cryptoOwner.getRandomValues.call(cryptoOwner, bytes)',
    'createStatsRuntimeState({ runtimeEpoch })',
  ]);
  assertFunctionSourceExcludes(statsRuntimeCacheSource, files.statsRuntimeCache, 'createStatsRuntimeEpoch', [
    'Date.now',
    'Math.random',
  ]);
  assertIncludes(orchestratorSource, files.orchestrator, [
    'STATS_ANALYSIS_QUERY_INTERVENTION_EFFECTS_REQUIRED',
  ]);
  assertExcludes(orchestratorSource, files.orchestrator, [
    'getSettingsSnapshot() || {}',
    'Promise.resolve(getSettingsSnapshot() || {})',
    'async () => []',
    'STATS_ANALYSIS_QUERY_TRANSITION_EDGES_REQUIRED',
    'StatsTransitionEdgeRepository',
    'getStatsTransitionEdgesRange = null',
    'getStatsTransitionEdgesRange',
    'getInterventionEffectsRange = null',
    'readTransitionEdgesRange = typeof getStatsTransitionEdgesRange',
    'readInterventionEffectsRange = typeof getInterventionEffectsRange',
    '(await Promise.resolve(getCycleState({ now }))) || null',
  ]);
  assertExcludes(sitesEvidenceQuerySource, files.sitesEvidenceQuery, [
    'async () => []',
    'getStatsTransitionEdgesRange',
    'readTransitionEdgesRange = typeof getStatsTransitionEdgesRange',
    'readInterventionEffectsRange = typeof getInterventionEffectsRange',
  ]);
  assertExcludes(trendQuerySource, files.trendQuery, [
    'getSettingsSnapshot() || {}',
    'Promise.resolve(getSettingsSnapshot() || {})',
    "&& typeof getCycleState === 'function'",
    'function normalizePolicyOverride',
    'fallback || {}',
    '(await Promise.resolve(getCycleState({ now }))) || null',
  ]);
  assertExcludes(precisionRawDataQuerySource, files.precisionRawDataQuery, [
    'domainData.behavior || {}',
    'domainData.navigation || {}',
    'domainData.sessions || {}',
  ]);
  assertExcludes(factsQuerySource, files.factsQuery, [
    '.catch(() => {})',
    '.catch(() => { })',
    'getHourlyReadDiagnostics',
    'getStatsFactsForDate',
  ]);
  assertExcludes(factsRepositoryReadUtilsSource, files.factsRepositoryReadUtils, [
    'buildStatusSnapshot',
    'buildSitesSnapshot',
    'buildCycleProjection',
    'chrome.storage',
    'indexedDB',
    'normalizeStatsQueryDate',
    'readStatsFactsDateRangeFromRepository',
  ]);
  assertExcludes(policySnapshotSource, files.policySnapshot, [
    'policy.siteGoals || {}',
    'policy.sitePolicies || {}',
  ]);
  assertExcludes(orchestratorSource, files.orchestrator, [
    'projectStatsDay',
    'projectStatsWindow',
    'createStatsExposureReadModel',
    'buildRuleSiteIntel',
    'buildRulesSiteIntelDetailPlan',
    'buildStatusDomainCandidatePool',
    'buildSiteInsightModel',
    'function buildStatusSnapshot',
    'function buildSitesSnapshot',
    'function buildRuleSiteIntel',
    'function buildSiteDetails',
    'function buildRhythmDayProjection',
    'function normalizeSiteSessionStats',
    'function normalizeSiteBehaviorStats',
    'function buildTransitionEdgeIndex',
  ]);
  enforceSoftModuleBudget({
    file: files.orchestrator,
    source: orchestratorSource,
    softLines: 260,
    maxTopLevelFunctionDeclarations: 6,
    maxClassDeclarations: 0,
    maxControlFlowTokens: 26,
    minLocalHelperImportsWhenOverSoft: 3,
    fail,
    label: 'stats-read-model-architecture',
  });
  enforceSoftModuleBudget({
    file: files.siteIntelReadModel,
    source: siteIntelSource,
    softLines: 360,
    maxTopLevelFunctionDeclarations: 3,
    maxClassDeclarations: 0,
    maxControlFlowTokens: 58,
    minLocalHelperImportsWhenOverSoft: 3,
    fail,
    label: 'stats-read-model-architecture',
  });

  assertExcludes(statusReadModelSource, files.statusReadModel, [
    './statsSitesSnapshotReadModel.js',
    './statsAnalysisQueryService.js',
    'getSitesSnapshot',
    'sitesSnapshot',
    'readSitesSnapshotCache',
    'DEFAULT_VISIBLE_DOMAIN_COUNT',
    'resolveVisibleDomainCandidateUsageMs',
    'selectVisibleDomainCandidates',
    'function buildStatusHabitFeedback',
    'function buildVisibleDomainSelection',
    'dashboardPolicy.blockedUrls || []',
    'dashboardPolicy.allowedUrls || []',
    'dashboardPolicy.siteGoals || {}',
    'dashboardPolicy.sitePolicies || {}',
    'Object.keys(siteGoalMap || {})',
    'dailyScoring.ledger || []',
    'dailyScoring.scoreSummary || null',
    'dailyScoring.scoreInsights || []',
  ]);
  assertIncludes(statusReadModelSource, files.statusReadModel, [
    "from './statsStatusVisibleDomainReadModel.js'",
    "from '../../contracts/statsStatusSnapshotContract.js'",
    'buildStatusHabitFeedback',
    'buildVisibleDomainSelection',
    'requireCanonicalStatsStatusSnapshot({',
  ]);
  assertIncludes(statusSnapshotContractSource, files.statusSnapshotContract, [
    'findStatsStatusSnapshotNonCanonicalPath',
    'requireCanonicalStatsStatusSnapshot',
    'STATS_STATUS_SNAPSHOT_NON_CANONICAL',
    'new WeakSet()',
  ]);
  assertExcludes(statusSnapshotContractSource, files.statusSnapshotContract, [
    'JSON.stringify',
    'JSON.parse',
    'structuredClone',
  ]);
  assertIncludes(siteInsightSynthesisSource, files.siteInsightSynthesis, [
    'requireFeatureSummaryTrendRole',
    'PERSONAL_BASELINE_ROLES.RECENT_TRAJECTORY',
    'if (value === undefined || value === null) return null;',
    'trendRole: requireFeatureSummaryTrendRole(featureVector.trendRole)',
  ]);
  assertIncludes(statusVisibleDomainReadModelSource, files.statusVisibleDomainReadModel, [
    'export function buildEmptyStatusHabitFeedback',
    'export function buildStatusHabitFeedback',
    'export function buildVisibleDomainSelection',
    'selectVisibleDomainCandidates',
  ]);
  assertExcludes(statusVisibleDomainReadModelSource, files.statusVisibleDomainReadModel, [
    './statsStatusSnapshotReadModel.js',
    './statsSitesSnapshotReadModel.js',
    'buildStatusSnapshot',
    'buildSitesSnapshot',
    'projectStatsDay',
    'projectStatsWindow',
  ]);
  assertExcludes(sitesReadModelSource, files.sitesReadModel, [
    './statsStatusSnapshotReadModel.js',
    './statsAnalysisQueryService.js',
    'getStatusSnapshot',
    'statusSnapshot',
    'dashboardPolicy.blockedUrls || []',
    'dashboardPolicy.allowedUrls || []',
    'dashboardPolicy.siteGoals || {}',
    'dashboardPolicy.sitePolicies || {}',
    'transitionEdgesRange = []',
    'interventionEffectsRange = []',
    'buildTransitionEdgeIndex',
    'buildInterventionEffectIndex',
    'sitePullAggregateAnalysis',
  ]);

  for (const relativePath of readModelFiles) {
    const source = relativePath === files.shared
      ? sharedSource
      : relativePath === files.statusReadModel
        ? statusReadModelSource
        : relativePath === files.statusVisibleDomainReadModel
          ? statusVisibleDomainReadModelSource
          : relativePath === files.sitesReadModel
            ? sitesReadModelSource
            : relativePath === files.sitesRegistryReadModel
              ? sitesRegistryReadModelSource
              : relativePath === files.sitesSiteDetailReadModel
                ? sitesSiteDetailReadModelSource
                : relativePath === files.siteIntelReadModel
                  ? siteIntelSource
              : relativePath === files.siteRecurringTimeEvidence
                ? siteRecurringTimeEvidenceSource
              : relativePath === files.siteLongTermPatterns
                ? siteLongTermPatternsSource
              : relativePath === files.siteLongTermPatternContract
                ? siteLongTermPatternContractSource
              : relativePath === files.siteTodayNotes
                ? siteTodayNotesSource
              : relativePath === files.siteTodayNotesContract
                ? siteTodayNotesContractSource
              : relativePath === files.siteIntelEvidenceContract
                ? siteIntelEvidenceContractSource
              : relativePath === files.siteIntelMetricStats
                ? siteIntelMetricStatsSource
                : relativePath === files.siteTransitionEdges
                  ? siteTransitionEdgesSource
                  : siteInterventionEffectsSource;

    assertExcludes(source, relativePath, [
      './statsAnalysisQueryService.js',
      '@/apps/dashboard',
      'apps/dashboard',
      'useAnalysisStore',
      'useStatusSnapshot',
      'useSitesSnapshot',
      'chrome.storage',
      'indexedDB',
      'dbManager',
      'DBManager',
    ]);
  }

  assertExcludes(sitesSiteDetailQuerySource, files.sitesSiteDetailQuery, [
    '@/apps/dashboard',
    'apps/dashboard',
    'chrome.storage',
    'indexedDB',
    'dbManager',
  ]);

  assertExcludes(sharedSource, files.shared, [
    './statsStatusSnapshotReadModel.js',
    './statsSitesSnapshotReadModel.js',
    'fallback || {}',
  ]);
  assertExcludes(siteIntelSource, files.siteIntelReadModel, [
    './statsStatusSnapshotReadModel.js',
    './statsSitesSnapshotReadModel.js',
    "trackingScope: 'blocked'",
    'resolveTrackingScopeFromDataCollectionMode',
    'trackingScope:',
    'Object.keys(siteGoalMap || {})',
    'buildRulesSiteIntelDetailPlan',
    'priority_full_detail_summary_tail',
  ]);
  assertIncludes(siteIntelSource, files.siteIntelReadModel, [
    'dataCollectionMode',
    'sitePullDataCollectionMode',
    'requireTransitionEdgeIndex',
    'requireInterventionEffectIndex',
    'analysis_index_selected_full_detail',
    'calendar-date-set',
    'buildSitesSiteRecurringTimeEvidence',
    'createUnloadedSitesSiteRecurringTimeEvidence',
    'recurringTimeEvidence',
    'buildSitesSiteLongTermPatterns',
    'createUnloadedSiteLongTermPatterns',
    'longTermPatterns',
    'buildSitesSiteTodayNotes',
    'createUnloadedSiteTodayNotes',
    'todayNotes',
  ]);
  assertIncludes(siteLongTermPatternsSource, files.siteLongTermPatterns, [
    'normalizeSitePullBaselineSeriesSource',
    'requireSiteLongTermPatterns',
    'SITE_LONG_TERM_PATTERN_SESSION_FACTS_REQUIRED',
    'SITE_LONG_TERM_PATTERN_HOURLY_TOTAL_MISMATCH',
    'currentDayExcluded: true',
  ]);
  assertExcludes(siteLongTermPatternsSource, files.siteLongTermPatterns, [
    'sitePullProfile', 'goalMinutes', 'todayHourly', 'habitHourly',
  ]);
  assertIncludes(siteLongTermPatternContractSource, files.siteLongTermPatternContract, [
    "'sites-site-long-term-patterns-v2'",
    "'completed-calendar-day-hourly-domain-activity'",
    'SITE_LONG_TERM_PATTERNS_WINDOW_DAYS = 30',
    'requireSiteLongTermPatterns',
  ]);
  assertIncludes(siteTodayNotesSource, files.siteTodayNotes, [
    'requireSiteTodayNotes',
    'SITE_TODAY_NOTES_SOURCE_INVALID',
    "intel.todayBasis !== 'calendar-day'",
    "intel.todayHorizon !== 'calendar_today'",
  ]);
  assertExcludes(siteTodayNotesSource, files.siteTodayNotes, [
    'sitePullProfile', 'buildSitePullFacts', 'goalMinutes', 'intel.totalMs',
    'usageEntry', 'habitHourly', '??',
  ]);
  assertIncludes(siteTodayNotesContractSource, files.siteTodayNotesContract, [
    "'sites-site-today-notes-v1'",
    "'local-calendar-day-hour'",
    'SITE_TODAY_NOTES_CONTRACT_INVALID',
    'requireSiteTodayNotes',
    'createUnloadedSiteTodayNotes',
  ]);
  assertIncludes(siteRecurringTimeEvidenceSource, files.siteRecurringTimeEvidence, [
    "SITES_SITE_RECURRING_TIME_EVIDENCE_VERSION = 'sites-site-recurring-time-evidence-v1'",
    "'completed-calendar-day-hourly-domain-activity'",
    'STATS_RULE_SITE_RECURRING_TIME_CURRENT_DAY_INCLUDED',
    'MIN_OBSERVED_DAY_COUNT = 7',
    'MIN_ACTIVE_DAY_COUNT = 4',
    'MIN_REPEATED_DAY_COUNT = 3',
    'MAX_DOMINANT_DAY_SHARE = 0.5',
    'buildSitesSiteRecurringTimeEvidence',
  ]);
  assertExcludes(siteRecurringTimeEvidenceSource, files.siteRecurringTimeEvidence, [
    '@/apps/dashboard',
    'apps/dashboard',
    'chrome.storage',
    'indexedDB',
    'dbManager',
    'todayHourly',
    'habitHourly',
  ]);
  assertIncludes(siteTransitionEdgesSource, files.siteTransitionEdges, [
    'fromInsideScope !== toInsideScope',
  ]);
  assertIncludes(siteIntelEvidenceContractSource, files.siteIntelEvidenceContract, [
    'STATS_RULE_SITE_INTEL_TRANSITION_EDGE_INDEX_REQUIRED',
    'STATS_RULE_SITE_INTEL_INTERVENTION_EFFECT_INDEX_REQUIRED',
    'export function requireTransitionEdgeIndex',
    'export function requireInterventionEffectIndex',
  ]);
  assertExcludes(siteIntelEvidenceContractSource, files.siteIntelEvidenceContract, [
    './statsStatusSnapshotReadModel.js',
    './statsSitesSnapshotReadModel.js',
    './statsSiteIntelReadModel.js',
  ]);
  assertExcludes(siteIntelMetricStatsSource, files.siteIntelMetricStats, [
    './statsStatusSnapshotReadModel.js',
    './statsSitesSnapshotReadModel.js',
    './statsSiteIntelReadModel.js',
  ]);
  assertExcludes(siteTransitionEdgesSource, files.siteTransitionEdges, [
    './statsStatusSnapshotReadModel.js',
    './statsSitesSnapshotReadModel.js',
    './statsSiteIntelReadModel.js',
  ]);
  assertIncludes(siteTransitionEdgesSource, files.siteTransitionEdges, [
    'STATS_TRANSITION_EDGE_INDEX_STATS_RANGE_REQUIRED',
    'STATS_TRANSITION_EDGE_INDEX_DATES_REQUIRED',
    'normalizeStatsTransitionEdges',
  ]);
  assertFunctionSourceExcludes(siteTransitionEdgesSource, files.siteTransitionEdges, 'buildTransitionEdgeIndex', [
    'edges = []',
    'Array.isArray(edges) ? edges : []',
  ]);
  assertIncludes(siteInterventionEffectsSource, files.siteInterventionEffects, [
    'buildInterventionEffectIndex',
    'getDomainInterventionEffectSummary',
    'STATS_INTERVENTION_EFFECT_INDEX_ROWS_REQUIRED',
    'STATS_INTERVENTION_EFFECT_ROW_INVALID',
    'requireInterventionEffectRows',
    'requireInterventionEffectRow',
  ]);
  assertExcludes(siteInterventionEffectsSource, files.siteInterventionEffects, [
    './statsStatusSnapshotReadModel.js',
    './statsSitesSnapshotReadModel.js',
    './statsSiteIntelReadModel.js',
    "const artifactId = normalizeString(row?.artifactId, { maxLength: 128 }) || 'unknown'",
    "const artifactFamily = normalizeString(row?.artifactFamily, { maxLength: 80 }) || 'gate'",
  ]);
  assertFunctionSourceExcludes(siteInterventionEffectsSource, files.siteInterventionEffects, 'buildInterventionEffectIndex', [
    'rows = []',
    'Array.isArray(rows) ? rows : []',
  ]);

  assertExcludes(statusControllerSource, files.statusController, [
    'fallbackSiteDetails',
    'cycleSnapshot?.window?.siteDetails',
    'cycleSnapshot?.window.siteDetails',
    'cycleSnapshot.window?.siteDetails',
    'cycleSnapshot.window.siteDetails',
    'sitesSnapshot',
    'useSitesSnapshot',
  ]);
  assertExcludes(sitesControllerSource, files.sitesController, [
    'fallbackSiteDetails',
    'statusSnapshot',
    'useStatusSnapshot',
    'cycleSnapshot?.window?.siteDetails',
    'cycleSnapshot.window.siteDetails',
    'snapshotVersion',
  ]);
  // Computation time may be exposed as nonvisual diagnostics, but must never
  // replace the semantic revision used for query identity or scheduling.
  const sitesDiagnosticTimestampProjection = 'sitesSnapshotComputedAt: sitesSnapshot?.computedAtEpochMs ?? null,';
  assertIncludes(sitesControllerSource, files.sitesController, [sitesDiagnosticTimestampProjection]);
  assertExcludes(sitesControllerSource.replace(sitesDiagnosticTimestampProjection, ''), files.sitesController, ['computedAtEpochMs']);
  assertIncludes(sitesControllerSource, files.sitesController, [
    'siteDetailRevision',
    'retrySiteDetail',
    'retrySitesSnapshot',
    'onRevisionMismatch: admitSitesSiteDetailRevisionMismatch',
  ]);
  assertIncludes(sitesPolicyHookSource, files.sitesPolicyHook, [
    'SITES_STATS_REFRESH_COALESCE_MS',
    'resolveSitesStatsRefreshDelay',
    'enabled = true',
    'retrySitesSnapshot',
    'admitSitesPolicySnapshotRefreshForDetailRevisionMismatch',
    'admitSitesSiteDetailRevisionMismatch',
    "telemetrySource: 'render'",
  ]);
  assertIncludes(sitesPolicyResourceSource, files.sitesPolicyResource, [
    'admitSitesPolicySnapshotRefreshForDetailRevisionMismatch',
    'currentRevision !== requestedRevision',
    'useAnalysisStore.setState({ sitesSnapshotStale: true })',
    'SITES_POLICY_SNAPSHOT_STORED_REVISION_INVALID',
    "telemetrySource = 'render'",
    'source: resolvedTelemetrySource',
  ]);
  assertIncludes(sitesDetailResourceSource, files.sitesDetailResource, [
    'requireSitesSiteDetailRevision',
    'siteDetailRevision: resolved.siteDetailRevision',
    'response?.siteDetailRevision',
    'SITES_SITE_DETAIL_RESPONSE_REVISION_MISMATCH',
    'responseCachePrewarmed = true',
    'responseRevision !== resolved.siteDetailRevision',
    "telemetrySource = 'render'",
    'source: resolved.telemetrySource',
  ]);
  assertExcludes(sitesDetailResourceSource, files.sitesDetailResource, [
    'snapshotVersion',
    'computedAtEpochMs',
  ]);
  assertIncludes(sitesPreloaderSource, files.sitesPreloader, [
    'requireSitesSiteDetailRevision',
    'sitesSnapshot?.siteDetailRevision',
    'SITES_DATA_PRELOAD_ABORT_SIGNAL_INVALID',
    'SITES_DATA_PRELOAD_ABORTED',
    'throwIfPreloadAborted(resolvedSignal)',
    'isSitesSiteDetailRevisionMismatchError',
    'admitSitesPolicySnapshotRefreshForDetailRevisionMismatch',
    "telemetrySource: 'boot'",
  ]);
  assertExcludes(sitesPreloaderSource, files.sitesPreloader, [
    'snapshotVersion',
    'sitesSnapshot?.computedAtEpochMs',
  ]);
  assertIncludes(analysisResponseContractsSource, files.analysisResponseContracts, [
    'requireCanonicalStatsStatusSnapshot',
    'requireStatusSnapshotField',
    'requireSitesSnapshotSemanticRevision',
    'requireSitesSiteDetailRevision(sitesSnapshot.siteDetailRevision)',
    'includeSitesSnapshot',
    'SITES_SNAPSHOT_SITE_DETAIL_REVISION_INVALID',
  ]);
  assertIncludes(statusReadModelTestSource, files.statusReadModelTest, [
    'featureSummary?.trendRole)',
    '.toBeNull()',
    'JSON.parse(JSON.stringify(statusSnapshot))',
  ]);
  assertIncludes(analysisResponseContractsTestSource, files.analysisResponseContractsTest, [
    'rejects a non-canonical status DTO at the dashboard transport boundary',
    'ANALYSIS_BOOTSTRAP_STATUS_SNAPSHOT_INVALID:status.domainInsights.example.com.analysis.featureSummary.trendRole',
  ]);
  assertNotMatches(statusControllerSource, files.statusController, [
    {
      pattern: /statusSnapshot\?\.window\?\.siteDetails\s*(?:\|\||\?\?)\s*cycleSnapshot/gu,
      reason: 'Status controller must not repair status siteDetails from cycleSnapshot.',
    },
  ]);
  assertNotMatches(sitesControllerSource, files.sitesController, [
    {
      pattern: /sitesSnapshot\?\.siteDetails\s*(?:\|\||\?\?)\s*(?:statusSnapshot|cycleSnapshot)/gu,
      reason: 'Sites controller must not repair rules siteDetails from sibling snapshots.',
    },
  ]);

  assertExcludes(statsAggregateRepositorySource, files.statsAggregateRepository, [
    'getRuntimeCheckpoint',
    'setRuntimeCheckpoint',
    'clearRuntimeCheckpoint',
    'clearHourlyBucketsForDate',
    'createEmptyDay',
    'upsertHourlyBuckets',
    'upsertDailySummary',
    'upsertDailyMaterializedSummary',
    "typeof this.statsAggregateStore.getHourlyReadDiagnostics === 'function'",
    'getHourlyReadDiagnostics',
  ]);
  assertIncludes(statsAggregateRepositorySource, files.statsAggregateRepository, [
    'STATS_AGGREGATE_REPOSITORY_HOURLY_RANGE_READER_REQUIRED',
    'STATS_AGGREGATE_REPOSITORY_HISTORICAL_RECOVERY_FINALIZER_REQUIRED',
    'STATS_AGGREGATE_REPOSITORY_HISTORICAL_MATERIALIZATION_INDEX_READER_REQUIRED',
    'this.readHourlyBucketsRangeOwner = requireStatsAggregateStoreMethod(',
    'this.readHistoricalMaterializationDateIndexOwner = requireStatsAggregateStoreMethod(',
    'this.finalizeRecoveredHistoricalDayFactsOwner = requireStatsAggregateStoreMethod(',
    'return this.readHourlyBucketsRangeOwner(bounds);',
    'return this.readHistoricalMaterializationDateIndexOwner(bounds);',
    'return this.finalizeRecoveredHistoricalDayFactsOwner(facts);',
  ]);
  assertExcludes(statsAggregateStoreSource, files.statsAggregateStore, [
    'getRuntimeCheckpoint',
    'setRuntimeCheckpoint',
    'RuntimeSessionStore',
    'STORAGE_SESSION_KEYS',
    'clearRuntimeCheckpoint',
    'clearHourlyBucketsForDate',
    'createEmptyDay',
    'sessionStore',
    'upsertHourlyBuckets',
    'upsertDailySummary',
    'upsertDailyMaterializedSummary',
    'statsHourlyReadDiagnostics',
    'getHourlyReadDiagnostics',
  ]);
  assertIncludes(statsAggregateStoreSource, files.statsAggregateStore, [
    'STATS_AGGREGATE_STORE_HOURLY_BUCKET_CANONICAL_REQUIRED',
    'STATS_AGGREGATE_STORE_HOURLY_RANGE_ROW_INVALID',
    'const normalizedBucket = normalizeStatsHourlyBucketReadRow(bucket);',
    'async readHourlyBucketsRange(',
    'buildStatsHourlyRangeReadDiagnostics({',
    'async readHistoricalMaterializationDateIndex(',
    "hourlyDateIndex.openKeyCursor(dateRange, 'nextunique')",
    'dailyStore.getAllKeys(dateRange)',
    "dailyStore.index('finalizedAt')",
    'dailyFinalizedAtIndex.openKeyCursor()',
    'STATS_AGGREGATE_STORE_HISTORICAL_DAILY_MARKER_INVALID',
    'STATS_AGGREGATE_STORE_HISTORICAL_DAILY_MARKER_KEY_INVALID',
    'async finalizeRecoveredHistoricalDayFacts({ hourlyBuckets, dailySummary } = {})',
    'STATS_AGGREGATE_STORE_RECOVERY_HOURLY_FACTS_CHANGED',
    "hourlyStore.index('dateStr').getAll(dailyRow.dateStr)",
    ".filter((row) => row.status === 'open')",
    'consumePreparedStatsHourlyBucket(bucket)',
    'rows.forEach((bucket) => store.put(bucket));',
    'tx.abort();',
    'rejectOnce(error);',
  ]);
  assertIncludes(preparedHourlyBucketRegistrySource, files.preparedHourlyBucketRegistry, [
    'const preparedStatsHourlyBucketRegistrations = new WeakMap();',
    'const domainsDeltaRevisions = new WeakMap();',
    'const transitionEdgesDeltaRevisions = new WeakMap();',
    'registerPreparedStatsHourlyBucket',
    'isPreparedStatsHourlyBucket',
    'consumePreparedStatsHourlyBucket',
    'STATS_PREPARED_HOURLY_BUCKET_INVALID',
    'STATS_PREPARED_HOURLY_BUCKET_INVALIDATED',
    'captureShallowBucketSnapshot',
    'bumpProjectionMapRevision',
  ]);
  assertIncludes(dbStatsNormalizersSource, files.dbStatsNormalizers, [
    'normalizeStatsHourlyBucketStatus(value)',
    'normalizeStatsDomainKey(domain) === domain',
    'isStatsHourlyBucketIdentityValid({',
    'row.schemaVersion !== STATS_SCHEMA_VERSION',
    'STATS_HOURLY_TOTAL_DELTA_KEYS',
    'STATS_HOURLY_DOMAIN_DELTA_KEYS',
    'STATS_HOURLY_DOMAIN_BEHAVIOR_KEYS',
    'STATS_HOURLY_DOMAIN_INTERVENTION_KEYS',
    'STATS_HOURLY_DOMAIN_NAVIGATION_KEYS',
    'hasExactOwnKeys',
    'isNonNegativeFiniteNumber',
    'isNonNegativeSafeInteger',
    'isReadableStatsHourlyDomainDelta',
    "'protectedActive',",
    'delta.protectedActive <= delta.active + 0.001',
    "!hasOwn(row, 'bucketUtcOffsetMinutes')",
    "'transitionEdgesDelta'",
    'normalizeStatsTransitionEdgeDeltas(row.transitionEdgesDelta)',
  ]);
  assertExcludes(dbStatsNormalizersSource, files.dbStatsNormalizers, [
    "fallback = 'sealed'",
    "return fallback === 'open' ? 'open' : 'sealed'",
    'migrateStatsHourlyBucketCursorCheckpoint',
  ]);
  assertIncludes(statsContractsSource, files.statsContracts, [
    'export const STATS_SCHEMA_VERSION = 2;',
    'protectedActive: 0,',
    'hourlyProtectedActive: Array(STATS_HOURLY_BUCKETS).fill(0)',
    'export function requireStatsProtectedActive(value, active)',
    'export function requireStatsProtectedActiveFacts(domain)',
    'const protectedFacts = requireStatsProtectedActiveFacts(src);',
    'domain.protectedActive = protectedFacts.protectedActive;',
    'domain.hourlyProtectedActive = protectedFacts.hourlyProtectedActive;',
    'STATS_PROTECTED_ACTIVE_CONTRACT_INVALID',
    'STATS_PROTECTED_ACTIVE_HOURLY_CONTRACT_INVALID',
    'export function normalizeStatsDomainKey(value)',
    'export function resolveStatsHourlyBucketStartTs(dateStr, hour)',
    'export function deriveStatsHourlyBucketUtcOffsetMinutes({',
    'export function isStatsHourlyBucketIdentityValid({',
    'export function normalizeStatsUtcOffsetMinutes(value)',
    "new Set(['__proto__', 'constructor', 'prototype'])",
    'const hostname = normalizeStatsDomainKey(hostnameRaw);',
    'export function buildStatsTransitionEdgeKey({ fromDomain, toDomain } = {})',
    'export function normalizeStatsTransitionEdges(rawEdges)',
    'export function normalizeStatsTransitionEdgeDeltas(rawDeltas)',
    'transitionEdges: {},',
  ]);
  assertIncludes(statsAggregatorSource, files.statsAggregator, [
    'if (isActive && isBlockedDomain)',
    'domainData.protectedActive += appliedElapsed;',
    'domainData.hourlyProtectedActive[hourIdx] += sliceMs;',
    'export function recordStatsSwitch({',
    'incrementStatsTransitionEdge({',
    'dayData.transitionEdges[edgeKey]',
  ]);
  assertIncludes(dbImportSnapshotSource, files.dbImportSnapshot, [
    'export function preflightIndexedDbV1ImportSnapshot(json)',
    'const source = validateIndexedDbV1SnapshotEnvelope(json);',
    'acc[spec.fieldName] = preflightImportRows(source[spec.fieldName], spec);',
    'requireCanonicalClseEpochRelation(normalized);',
    'const snapshot = {',
    'meta: { ...source.meta },',
    '...normalized,',
    'INDEXED_DB_SNAPSHOT_META_FIELDS_INVALID',
    'INDEXED_DB_SNAPSHOT_ROW_INVALID',
    'return requireCanonicalImportRow(clone, normalizeStatsHourlyBucketReadRow(clone));',
    'clone.dayData.schemaVersion !== STATS_SCHEMA_VERSION',
  ]);
  assertExcludes(dbImportSnapshotSource, files.dbImportSnapshot, [
    'PREFLIGHTED_INDEXED_DB_V1_IMPORT_SNAPSHOTS',
    'migrateStatsHourlyBucketCursorCheckpoint',
    'legacyPayloadKeys',
    'hasCanonicalDayData',
    'assertLosslessIndexedDbReplaceImport',
  ]);
  assertExcludes(statsRepositorySource, files.statsRepository, [
    'upsertDailySummary',
    'loadHistoricalDayFromMaterializedSummaryOrHourlyFacts',
    'rebuiltDay',
    'sourceHourlyRevision: hourlyBuckets.length',
    "typeof aggregateStore.getHourlyReadDiagnostics === 'function'",
    'getHourlyReadDiagnostics',
    'statsAggregateStore = null',
    '|| statsAggregateStore',
    'statsAggregateStore ||',
    'saveStatsDay',
    'createEmptyRange',
    'getStatsRepository',
    'hasOpenHourlyFactBucket',
    'requireOpen: true',
    'readHourlyBucketsRangeOwner(bounds)',
  ]);
  assertIncludes(statsRepositorySource, files.statsRepository, [
    'STATS_REPOSITORY_DIRECT_AGGREGATE_STORE_UNSUPPORTED',
    'STATS_REPOSITORY_HOURLY_RANGE_READER_REQUIRED',
    'STATS_REPOSITORY_HOURLY_RANGE_RESULT_INVALID',
    'STATS_REPOSITORY_HISTORICAL_DAILY_SUMMARY_REQUIRED',
    "Object.prototype.hasOwnProperty.call(options, 'statsAggregateStore')",
    'statsAggregateRepository = StatsAggregateRepository.getInstance()',
    'const readHourlyBucketsRangeOwner = requireStatsRepositoryAggregateMethod(',
    'const readHistoricalMaterializationDateIndexOwner = requireStatsRepositoryAggregateMethod(',
    'async readPendingHistoricalDayMaterializations({',
    'STATS_REPOSITORY_HISTORICAL_RECOVERY_RANGE_INVALID',
    'STATS_REPOSITORY_HISTORICAL_MATERIALIZATION_INDEX_INVALID',
    'STATS_REPOSITORY_HISTORICAL_RECOVERY_FACTS_CHANGED',
    'const boundedDays = Math.min(STATS_RANGE_MAX_DAYS',
    'await readHistoricalMaterializationDateIndexOwner(bounds)',
    'const orphanDateStrs = materializationIndex.hourlyDateStrs',
    'for (const dateStr of orphanDateStrs)',
    'statsAggregateRepository.getHourlyBuckets({ dateStr })',
    'hourlyBuckets: buckets',
    'const includesToday',
    'startDateStr: todayDateStr',
    'endDateStr: todayDateStr',
    'readDiagnostics:',
    'hourly:',
  ]);
  assertIncludes(statsBucketMaterializerSource, files.statsBucketMaterializer, [
    'STATS_HOURLY_BUCKET_VERSION_UNSUPPORTED',
    'requireStatsProtectedActive(domainDelta.protectedActive, domainDelta.active)',
    'requireStatsProtectedActive(domainStats.hourlyProtectedActive[normalizedHour], active)',
    'domain.protectedActive += protectedActive;',
    'domain.hourlyProtectedActive[hour] += protectedActive;',
    'STATS_HOURLY_BUCKET_totalsDelta_INVALID',
    'STATS_HOURLY_BUCKET_DOMAIN_CURSOR_REQUIRED',
    'STATS_HOURLY_CURSOR_CHECKPOINT_VERSION',
    'activeCommittedThroughAt',
    'bucketUtcOffsetMinutes',
    'isCommitCursorInBucket',
    'requireHourlyBucketPayload',
    'return resolveStatsHourlyBucketStartTs(normalizedDateStr, normalizedHour);',
    'prepareStatsDayForHourlyMaterialization',
    'const preparedStatsDays = new WeakSet();',
    'baseTransitionEdgesDelta',
    'selectedTransitionEdgeKeys',
    'baseDomainsDelta',
    'selectedDomainKeys',
    'registerPreparedStatsHourlyBucket({',
    'normalizeStatsTransitionEdgeDeltas(bucket?.transitionEdgesDelta)',
  ]);
  assertExcludes(statsBucketMaterializerSource, files.statsBucketMaterializer, [
    'bucket?.totalsDelta || {}',
    'bucket?.byCategoryDelta?.[categoryId] || {}',
    'bucket?.sessionsDelta || {}',
    'bucket?.switchesDelta?.[key]',
    'bucket?.domainsDelta || {}',
    'bucket?.transitionEdgesDelta || {}',
    'legacyCommittedThroughAt',
    'hasCommittedThroughAt',
  ]);
  assertExcludes(statsHourlyProjectionCommitterSource, files.statsHourlyProjectionCommitter, [
    'bucket.domainsDelta || {}',
    'bucket.switchesDelta || {}',
    'Object.keys(bucket.domainsDelta)',
    'Object.keys(bucket.transitionEdgesDelta)',
    'domainsDelta: { ...bucket.domainsDelta }',
    'transitionEdgesDelta: { ...bucket.transitionEdgesDelta }',
  ]);
  assertIncludes(statsHourlyProjectionCommitterSource, files.statsHourlyProjectionCommitter, [
    'STATS_HOURLY_PROJECTION_COMMITTER_REPOSITORY_REQUIRED',
    'const materializedHourCache = new Map();',
    'dirtyHourScopes = {}',
    'materializeCurrentDayHour({',
    'finalizeHistoricalDayFacts.call(aggregateStore, {',
    'commitRecoveredHistoricalDayProjection({',
    'finalizeRecoveredHistoricalDayFacts.call(aggregateStore, {',
    "status: 'recovered_historical_day'",
    'hasEnumerableKey(bucket.domainsDelta)',
    'hasEnumerableKey(bucket.transitionEdgesDelta)',
    'return bucket;',
    'didWriteFacts: buckets.length > 0',
    'didWriteFacts: true',
  ]);
  assertIncludes(statsRetentionJobSource, files.statsRetentionJob, [
    'statsCleanup',
    'STATS_RETENTION_CLEANUP_FAILED',
    'STATS_RETENTION_SESSION_STORE_REQUIRED',
    'STATS_RETENTION_STATS_REPOSITORY_REQUIRED',
    'STATS_RETENTION_CLEANUP_TASKS_INVALID',
    'STATS_RETENTION_CLEANUP_TASK_REQUIRED',
    'STATS_RETENTION_SESSION_KEY_REQUIRED',
    'markerRead',
    'skipped: !!force',
  ]);
  assertExcludes(statsRetentionJobSource, files.statsRetentionJob, [
    'RuntimeSessionRepository.getInstance()',
    'getStatsRepository()',
    'DEFAULT_SESSION_KEY',
    'if (!Array.isArray(cleanupTasks)) return []',
    'cleanupTasks.filter((task) => typeof task === \'function\')',
    'catch (_) {\n          lastRunDateStr = null;',
  ]);
  assertIncludes(statsRuntimeServiceSource, files.statsRuntimeService, [
    'STATS_RUNTIME_SERVICE_HEALTH_LEDGER_REQUIRED',
    'getStatsRuntimeHealth: () => statsRuntimeHealthLedger.getSnapshot()',
    'initStatsRuntimeHealth: (options) => statsRuntimeHealthLedger.init(options)',
  ]);
  assertIncludes(statsRuntimeHealthLedgerSource, files.statsRuntimeHealthLedger, [
    'STATS_RUNTIME_HEALTH_SAVE_PERSIST_INTERVAL_MS = 5_000',
    'COALESCED_ACTIVE_SEAL_STATUSES',
    'IMMEDIATE_ACTIVE_SEAL_INCIDENT_CODES',
    'resolveActiveSealPersistMode',
    "persistMode: force ? 'immediate' : 'memory'",
    "persistMode: force ? 'immediate' : 'throttled'",
    'let writePromise = null;',
    'let preHydrationPatch = {};',
    'persistedRevision = revision;',
    'STATS_RUNTIME_HEALTH_HYDRATION_FAILED',
    'STATS_RUNTIME_HEALTH_PERSIST_FAILED',
    'await flushOwned();',
  ]);
  assertExcludes(statsRuntimeHealthLedgerSource, files.statsRuntimeHealthLedger, [
    'operationTail',
    'enqueueOperation',
    'async function update(',
    'async function updateOwned(',
  ]);
  assertIncludes(statsRuntimeServiceSource, files.statsRuntimeService, [
    'return persistenceQuiesce.then(async (persistenceResult)',
    'await statsRuntimeHealthLedger.quiesceForProfileMutation(context)',
  ]);
  assertIncludes(statsRuntimeHealthIsolationTestSource, files.statsRuntimeHealthIsolationTest, [
    'merges a bounded pre-hydration delta exactly once including explicit error clears',
    'bounds delayed writes to one active snapshot plus latest RAM and drains before deletion',
    'retains newer counters after a mirror failure with no self-retry and allows explicit drain retry',
    'never overwrites unread history after hydration failure and retries only at an explicit boundary',
  ]);
  assertIncludes(statsRuntimePersistenceServiceSource, files.statsRuntimePersistenceService, [
    'STATS_RUNTIME_PERSISTENCE_HEALTH_LEDGER_REQUIRED',
    'STATS_RUNTIME_PERSISTENCE_COMMITTED_EVENT_OWNER_REQUIRED',
    'STATS_RUNTIME_PERSISTENCE_RESET_EVENT_OWNER_REQUIRED',
    'STATS_RUNTIME_PERSISTENCE_ROLLOVER_EVENT_OWNER_REQUIRED',
    'STATS_RUNTIME_PERSISTENCE_COMMIT_EVENT_POLICY_REQUIRED',
    'statsRuntimeHealthLedger.recordSaveStarted({ force: saveForce })',
    'statsRuntimeHealthLedger.recordSaveCompleted({ force: saveForce })',
    'statsRuntimeHealthLedger.recordSaveFailed({ force: saveForce, error })',
    'let saveDrainTail = Promise.resolve();',
    'let resetTail = Promise.resolve();',
    'function assignLoadPromise(dateStr, observedAt, revision)',
    'recoverHistoricalDaysBeforeInitialLoad({',
    'readPendingHistoricalDayMaterializations({',
    'commitRecoveredHistoricalDayProjection({',
    'hourlyBuckets: pendingDay.hourlyBuckets',
    'function runStatsReset(task, options = {})',
    'STATS_RESET_IN_PROGRESS',
    'while (true) {',
    'STATS_LOAD_TARGET_BEFORE_RUNTIME_DATE',
    'prepareStatsDayForHourlyMaterialization(snapshot.dayData',
    'dirtyHourScopes: getStatsRuntimeDirtyHourScopes(runtime, dateStr)',
    'STATS_SAVE_PROJECTION_WRITE_DISPOSITION_REQUIRED',
    'if (factsWritten && isStatsRuntimeRevisionFor(runtime, revision))',
  ]);
  assertIncludes(statsCollectorSource, files.statsCollector, [
    'STATS_COLLECTOR_COMMIT_OWNER_REQUIRED',
    'await commitDirtyStats({',
    'const result = recordStatsSwitch({',
    'const dirtyDomainKeysByHour = new Map();',
    'const dirtyTransitionEdgeKeysByHour = new Map();',
    'hourScopes,',
  ]);
  assertExcludes(statsRuntimeServiceSource, files.statsRuntimeService, [
    'statsRuntimeHealthLedger = null',
    'statsFeaturePackRepository',
    'statsRuntimeHealthLedger?.getSnapshot?.() ?? null',
    'statsRuntimeHealthLedger?.init?.(options)',
  ]);
  assertExcludes(statsRuntimePersistenceServiceSource, files.statsRuntimePersistenceService, [
    'statsRuntimeHealthLedger = null',
    'statsFeaturePackRepository',
    'statsRuntimeHealthLedger?.recordSaveStarted?.',
    'statsRuntimeHealthLedger?.recordSaveCompleted?.',
    'statsRuntimeHealthLedger?.recordSaveFailed?.',
    "const emitCommitted = typeof emitStatsCommitted === 'function' ? emitStatsCommitted : () => {};",
    "const emitReset = typeof emitStatsReset === 'function' ? emitStatsReset : () => {};",
    "const emitRollover = typeof emitStatsRollover === 'function' ? emitStatsRollover : () => {};",
    "const shouldEmitCommitted = typeof shouldEmitStatsCommittedEvent === 'function'",
  ]);
  assertExcludes(statsHourlyProjectionCommitterSource, files.statsHourlyProjectionCommitter, [
    'statsFeaturePackRepository',
    'featurePackStore',
    "typeof featurePackStore?.upsertDailyFeaturePacksFromDay === 'function'",
  ]);
  assertExcludes(statsCollectorSource, files.statsCollector, [
    'commitStatsMutation = null',
    'statsTransitionEdgeRepository = null',
    'recordAuxiliaryDiagnostic = null',
    "const commitDirtyStats = typeof commitStatsMutation === 'function'",
    "&& typeof statsTransitionEdgeRepository.recordSwitches === 'function'\n    ? statsTransitionEdgeRepository\n    : null",
    'if (commitDirtyStats) {',
    'pendingTransitionEdges.length > 0 && transitionEdgeRepository',
  ]);
  assertIncludes(dbStatsNormalizersTestSource, files.dbStatsNormalizersTest, [
    'uses one strict domain-key contract across stats maps and hourly rows',
    'requires real calendar dates and one exact date-hour-bucket identity',
    'validates hourly identity with the recorded offset instead of the current timezone',
  ]);
  assertIncludes(importHardeningTestSource, files.importHardeningTest, [
    'exports and accepts only the exact release V1 envelope',
    'rejects predecessor stats records instead of transforming them',
    'preflights %s before opening or mutating IndexedDB',
  ]);
  assertIncludes(trendQueryTestSource, files.trendQueryTest, [
    'rejects invalid explicit trend dates before reading facts',
    'rejects reversed and over-retention explicit trend ranges before reading facts',
  ]);
  assertIncludes(runtimeServiceTestSource, files.runtimeServiceTest, [
    'cold-start settles an unfinished checkpoint day before loading today',
    'cold-start directly materializes orphan hourly days without a tracking checkpoint',
    'reset barrier drains an active write before clearing and blocks reload until reset completes',
    'catches up a later date request that joins an earlier initial load',
    'catches up a later date request that joins an active rollover',
    'force-finalizes a clean historical runtime day',
    'a clean forced save causes no fact, revision, event, or health churn',
    'a fact-free closed-hour seal advances only the runtime watermark',
  ]);
  assertIncludes(rolloverLockTestSource, files.rolloverLockTest, [
    'finishes rollover before a normal foreground seal enters the seal owner queue',
  ]);
  assertIncludes(analysisStatsRangeTestSource, files.analysisStatsRangeTest, [
    'keeps its validation token query-local and out of the serializable fact graph',
    'normalizes each node once for a 90-day $fixture bootstrap',
    'Cycle, Status, and Rules do not mutate the shared normalized range',
    'fails loudly when a derived range replaces a normalized day graph',
  ]);
  assertIncludes(statsRuntimeHealthLedgerTestSource, files.statsRuntimeHealthLedgerTest, [
    'coalesces routine alarm and tick milestones into one trailing mirror with exact counters',
    'a failed tick immediately persists earlier milestones and absorbs their scheduled mirror',
    'coalesces successful save diagnostics while retaining exact in-memory counters',
    'coalesces routine active-seal diagnostics while retaining exact in-memory counters',
    'persists failed and important active-seal incidents immediately without a trailing duplicate',
    'flushes one latest diagnostic after a quiet successful-save burst',
    'quiesce absorbs a pending trailing diagnostic without a later duplicate write',
    'does not schedule a trailing timer after quiesce closes admission',
    'bounds repeated persistence failures and preserves exact in-memory counters',
  ]);
  assertIncludes(statsRepositoryReadPathTestSource, files.statsRepositoryReadPathTest, [
    'reads full hourly payloads only for key-indexed orphan historical days',
    'keeps a fully finalized cold-start discovery payload-free',
    'getHourlyBuckets).toHaveBeenCalledTimes(1)',
    'readHourlyBucketsRange).not.toHaveBeenCalled()',
    'getDailySummariesRange).not.toHaveBeenCalled()',
  ]);
  assertIncludes(statsAggregateStoreTestSource, files.statsAggregateStoreTest, [
    'discovers historical materialization dates through key-only scans',
    "direction: 'nextunique'",
    'dailyGetAllKeys: 1',
    'dailyFinalizedOpenKeyCursor: 1',
    'rejects a daily primary key that lacks the finalized marker index entry',
    'expect(diagnostics.rawRangeMatched).toBe(diagnostics.returned)',
    'expect(domainMapOwnKeyReads).toBe(2)',
  ]);
  assertExcludes(statsRuntimeServiceSource, files.statsRuntimeService, [
    'using raw data',
    'using main thread',
    'stats.worker.js?worker&url',
    'createWorkerRequestClient',
    'NORMALIZE_STATS_RANGE',
    'STATS_WORKER_NORMALIZE_FAILED',
    'workerNormalizationFailed',
    'initStatsWorker',
  ]);
  assertExcludes(baselineDocSource, files.baselineDoc, [
    '재구성 가능',
    'compatibility alias',
    'durable_plus_open_hour_overlay',
    'stats.worker.js',
  ]);

  assertExcludes(serviceTestSource, files.serviceTest, [
    'STATS_READ_MODEL_BASIS',
    'STATS_EXPOSURE_READ_SOURCE',
    'STATS_FACTS_RUNTIME_OVERLAY',
    'buildStatusSnapshot',
    'buildSitesSnapshot',
    'sitePullFacts',
    'registryDay',
  ]);
  assertIncludes(statusReadModelTestSource, files.statusReadModelTest, [
    'buildStatusSnapshot',
  ]);
  assertIncludes(statusVisibleDomainReadModelTestSource, files.statusVisibleDomainReadModelTest, [
    'buildVisibleDomainSelection',
    'buildStatusHabitFeedback',
  ]);
  assertIncludes(sitesReadModelTestSource, files.sitesReadModelTest, [
    'buildSitesSnapshot',
    'analysis_index_selected_full_detail',
    'SITES_SITE_INTEL_ANALYSIS_LIMIT',
    'deferredAnalysisCount',
    'observedSiteDetails',
    'protectionBudget',
    'separates equal numeric facts revisions from different stats runtime epochs',
  ]);
  assertIncludes(sitesSiteDetailReadModelTestSource, files.sitesSiteDetailReadModelTest, [
    'buildSitesSiteDetail',
    'STATS_SITES_SITE_DETAIL_INTERVENTION_EFFECTS_REQUIRED',
    "detailTier: 'full'",
    'calendar-date-set',
    'STATS_SITES_SITE_DETAIL_DOMAIN_INVALID',
    'UNRELATED_DOMAIN_METRICS_MUST_NOT_BE_NORMALIZED',
    'projectedDomainCount: 2',
  ]);
  assertIncludes(sitesSiteDetailQueryTestSource, files.sitesSiteDetailQueryTest, [
    'fails fast when a required query owner is missing',
    'coalesces identical in-flight reads',
    'shares one short-lived evidence range across domains while keeping projections separate',
    'does not cache a rejected shared evidence read across domains',
    'cacheTtlMs: 0',
    'STATS_SITES_SITE_DETAIL_DOMAIN_INVALID',
    'requires the shared semantic detail revision before reading facts',
    'sites-site-detail:v1',
  ]);
  assertIncludes(sitesPolicyHookTestSource, files.sitesPolicyHookTest, [
    'refreshes immediately when no semantic snapshot revision exists',
    'coalesces a stale stats refresh against the last completed snapshot time',
    'parks refresh work while the Rules runtime is inactive',
    'exposes an explicit retry after a snapshot refresh failure',
    'admits an immediate refresh when detail resolves against newer semantic facts',
    'does not stale a snapshot that already superseded the mismatched request',
  ]);
  assertIncludes(sitesDetailHookTestSource, files.sitesDetailHookTest, [
    'waits for the semantic snapshot revision instead of issuing a version-zero request',
    'retries the same semantic detail revision after an explicit user action',
    'parks a resolved detail without clearing the outgoing presentation',
    'rejects a stale caller while prewarming the response semantic revision',
    'admits a snapshot refresh without committing mismatched detail to the old request',
    "source: 'render'",
  ]);
  assertIncludes(sitesPreloaderTestSource, files.sitesPreloaderTest, [
    'refreshes the snapshot once and reuses a mismatched response-key prewarm',
    'does not start detail IO when the warmup signal aborts after snapshot completion',
    'rejects invalid or already-aborted warmup signals before snapshot IO',
    "source: 'boot'",
  ]);
  assertIncludes(factsQueryTestSource, files.factsQueryTest, [
    'surfaces repeated runtime revision invalidation after one fresh read',
    'does not retry a repository error with a matching invalidation code',
    'surfaces a repository failure on the fresh read without retrying it',
    'runtimeEpoch: TEST_RUNTIME_EPOCH',
    'shortRange.readModel.runtimeEpoch',
    'fullRange.readModel.runtimeEpoch',
  ]);
  assertIncludes(statsRuntimeCacheTestSource, files.statsRuntimeCacheTest, [
    'STATS_RUNTIME_EPOCH_CRYPTO_OWNER_REQUIRED',
    '000102030405060708090a0b0c0d0e0f',
    'resetStatsRuntimeStateFor(state)',
  ]);
  assertIncludes(analysisResponseContractsTestSource, files.analysisResponseContractsTest, [
    'admits the v2 runtime epoch revision',
    'rejects a previous-worker v1 response',
    'includeSitesSnapshot: true',
  ]);
  assertIncludes(siteIntelReadModelTestSource, files.siteIntelReadModelTest, [
    'STATS_RULE_SITE_INTEL_TRANSITION_EDGE_INDEX_REQUIRED',
    'STATS_RULE_SITE_INTEL_INTERVENTION_EFFECT_INDEX_REQUIRED',
    'SITES_SITE_INTEL_DETAIL_TIER.ANALYSIS',
  ]);
  assertIncludes(siteRecurringTimeEvidenceTestSource, files.siteRecurringTimeEvidenceTest, [
    'publishes a compact recurring window from completed observed days',
    'does not mistake one dominant day plus tiny matching days for recurrence',
    'fails loudly if the partial current day enters the completed-day source',
  ]);
  assertIncludes(siteTransitionEdgesTestSource, files.siteTransitionEdgesTest, [
    'STATS_TRANSITION_EDGE_INDEX_STATS_RANGE_REQUIRED',
    'buildTransitionEdgeIndex',
    'getDomainTransitionEdges',
    'excludes same-root moves',
  ]);
  assertIncludes(siteInterventionEffectsTestSource, files.siteInterventionEffectsTest, [
    'STATS_INTERVENTION_EFFECT_INDEX_ROWS_REQUIRED',
    'STATS_INTERVENTION_EFFECT_ROW_INVALID',
    'buildInterventionEffectIndex',
    'getDomainInterventionEffectSummary',
  ]);
  assertIncludes(baselineDocSource, files.baselineDoc, [
    'analysis_index_selected_full_detail',
    'GET_SITES_SITE_DETAIL',
    'readHistoricalMaterializationDateIndex',
    '`nextunique` key cursor',
    'finalizeRecoveredHistoricalDayFacts',
    'open → sealed',
    'protectionBudget.chargedMs',
    'calendar-date-set',
    'analysisLimit',
    'projectionScope.projectedDomainCount',
    'recurringTimeEvidence',
      'longTermPatterns',
    'siteDetailRevision',
    '128-bit `runtimeEpoch`',
    'runtime epoch/revision',
    'response revision key',
    'typed mismatch',
    'statsStatusSnapshotContract.js',
    '`recent_trajectory | null`',
    'JSON stringify sanitize',
  ]);
  assertIncludes(sitesBoundaryDocSource, files.sitesBoundaryDoc, [
    '`readModel.runtimeEpoch` plus `readModel.runtimeRevision`',
    'restarted',
    'initially inactive Rules mount remains idle',
    'response-key cache prewarm',
    'after snapshot completion, immediately before starting detail IO',
    '`source: boot`',
  ]);
  enforceSoftModuleBudget({
    file: files.serviceTest,
    source: serviceTestSource,
    softLines: 260,
    maxTopLevelFunctionDeclarations: 0,
    maxClassDeclarations: 0,
    maxControlFlowTokens: 18,
    fail,
    label: 'stats-read-model-architecture',
  });

  const budgetPath = 'src/domains/stats/projection/projectProtectionBudget.js';
  const activityBudgetPath = 'src/domains/stats/background/query/statsActivityDayUsageQueryService.js';
  const budgetSource = await readSource(budgetPath);
  assertIncludes(budgetSource, budgetPath, ['projectProtectionBudgetWindow', 'hourlyProtectedActive', 'requireProtectionCharge']);
  assertExcludes(budgetSource, budgetPath, ['classifyDomain(', 'activeUsageIntervals', 'Date.now(']);
  assertIncludes(await readSource(activityBudgetPath), activityBudgetPath, ['projectProtectionBudgetWindow({', 'blockedActive: protectedActive']);
  assertIncludes(sitesRegistryReadModelSource, files.sitesRegistryReadModel, ['projectProtectionBudgetWindow({', 'totalExposure: budget.totalExposure']);
  assertExcludes(sitesRegistryReadModelSource, files.sitesRegistryReadModel, ["entry?.categoryId !== 'blocked'"]);
  for (const consumer of [
    'src/domains/protection/background/ProtectionRuntimeInputAssembler.js',
    'src/domains/protection/background/TrackingProtectionService.js',
  ]) assertIncludes(await readSource(consumer), consumer, ['protectedActive', 'requireProtectionCharge']);

  console.log('[stats-read-model-architecture] PASS: stats read models remain one-way and dashboard controllers do not repair from sibling snapshots.');
}

main().catch((error) => {
  console.error('[stats-read-model-architecture] Unexpected error:', error);
  process.exit(1);
});
