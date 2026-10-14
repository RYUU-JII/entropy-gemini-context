#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const srcRoot = path.resolve(rootDir, 'src')

const requiredFiles = [
  'src/domains/stats/projection/index.js',
  'src/domains/stats/projection/statsPolicyLens.js',
  'src/domains/stats/projection/projectStatsDay.js',
  'src/domains/stats/projection/projectStatsWindow.js',
  'src/domains/stats/projection/projectStatsSummary.js',
  'src/domains/stats/projection/projectStatsDomainSeries.js',
  'src/domains/stats/shared/dateMath.js',
  'src/domains/stats/facts/index.js',
  'src/domains/stats/facts/domainUsageSummary.js',
  'src/domains/stats/analysis/index.js',
  'src/domains/stats/analysis/scoringEngine.js',
  'src/domains/stats/analysis/cycleScoring.js',
  'src/domains/stats/background/query/statsTrendQueryService.js',
  'src/domains/stats/background/query/statsActivityDayUsageQueryService.js',
  'src/domains/stats/background/aggregation/statsAggregateScaffold.js',
  'src/domains/stats/background/aggregation/statsAggregator.js',
  'src/domains/tracking/popup/query/popupSiteSnapshotQueryService.js',
  'src/domains/tracking/background/cycleRecommendationService.js',
]

const forbiddenFiles = [
  'src/domains/stats/query/policyContext.js',
  'src/domains/stats/query/types.js',
  'src/domains/stats/query/projectDay.js',
  'src/domains/stats/query/projectWindow.js',
  'src/domains/stats/query/projectSummary.js',
  'src/domains/stats/query/projectDomainSeries.js',
  'src/domains/stats/query/dateMath.js',
  'src/domains/stats/query/deriveDomainUsage.js',
  'src/domains/stats/query/index.js',
  'src/domains/stats/background/contracts/statsContracts.js',
  'src/domains/stats/background/contracts/statsEvents.js',
  'src/domains/stats/background/contracts/interventionEffectContracts.js',
  'src/domains/stats/background/contracts/index.js',
  'src/domains/stats/background/aggregation/index.js',
  'src/domains/stats/background/collection/index.js',
  'src/domains/stats/background/persistence/index.js',
  'src/domains/stats/background/runtime/index.js',
]

const forbiddenSourceTokens = [
  'domains/stats/query/',
  'virtualDayStartHour',
]

const forbiddenBackgroundToDashboardImports = [
  'apps/dashboard/scoring/cycleScoring.js',
  'apps/dashboard/scoring/scoringEngine.js',
]

const fileRules = [
  {
    file: 'src/domains/stats/background/query/statsActivityDayUsageQueryService.js',
    requiredTokens: ['getStatsFactsRange', 'getCycleState', 'effectiveResetHour', 'projectStatsWindow', "basis: 'activity-day'"],
    forbiddenTokens: ['chrome.storage', 'dbManager', 'localStorage', 'settingsStore.set'],
  },
  {
    file: 'src/domains/protection/background/ProtectionRuntimeInputProvider.js',
    requiredTokens: ['getActivityDayUsageRange', 'PROTECTION_RUNTIME_INPUT_ACTIVITY_DAY_BASIS_REQUIRED'],
    forbiddenTokens: ['getStatsCache', 'loadStatsCache'],
  },
  {
    file: 'src/domains/stats/projection/projectStatsDay.js',
    requiredTokens: [
      'buildStatsDomainCollectionObservation',
      'collectionObservation,',
    ],
    forbiddenTokens: [],
  },
  {
    file: 'src/domains/stats/projection/projectStatsWindow.js',
    requiredTokens: [
      'collectionObservationOverlapsWindow',
      'mergeTimelineCollectionObservations',
      'sourceDomainCount: Math.max',
      'mergedObservationKeys',
    ],
    forbiddenTokens: [],
  },
  {
    file: 'src/domains/tracking/background/trackingMessageHandlers/popupHandlers.js',
    requiredTokens: [
      'popup/query/popupSiteSnapshotQueryService.js',
      'getPopupSiteSnapshot',
    ],
    forbiddenTokens: [
      'buildDomainUsageWindowSummary',
      'resolveDomainUsageMs',
      'resolveTrackedUsageMs',
      'function resolvePopupSiteScope(',
      'function buildPopupSiteSnapshot(',
    ],
  },
  {
    file: 'src/domains/tracking/popup/query/popupSiteSnapshotQueryService.js',
    requiredTokens: [
      'POPUP_SITE_SNAPSHOT_QUERY_PERMISSIONS_REQUIRED',
      'POPUP_SITE_SNAPSHOT_QUERY_PERMISSIONS_RESULT_INVALID',
      'POPUP_SITE_SNAPSHOT_QUERY_FACTS_RESULT_INVALID',
      'requireStatsFactsRange',
      'getActivityDayUsageRange',
      'POPUP_SITE_SNAPSHOT_QUERY_ACTIVITY_DAY_BASIS_REQUIRED',
    ],
    forbiddenTokens: [
      'permissionsGetAll',
      "platform/chrome/ChromeService.js",
      'granted?.origins',
      'statsRange?.dates',
      'getLocalDateStr',
      'getStatsFactsRange',
    ],
  },
  {
    file: 'src/domains/tracking/background/CycleStateManager.js',
    requiredTokens: [
      'cycleRecommendationService.analyzeCycleResetPolicy(',
    ],
    forbiddenTokens: [
      '../../stats/projection/',
      'estimateSleepPattern',
      'projectStatsDay',
      'getCycleBoundary',
      'function buildDailyProjectionSeries(',
    ],
  },
  {
    file: 'src/domains/stats/background/aggregation/statsAggregator.js',
    requiredTokens: [
      './statsAggregateScaffold.js',
      'ensureDomainRecord',
      'activeCommittedThroughAt',
      'appliedElapsedMs',
    ],
    forbiddenTokens: [
      'createEmptyDomainBehaviorStats',
      'createEmptyDomainCollectionStats',
      'createEmptyCategoryTotals',
      'export function ensureStatsDayRecord',
      'export function ensureDomainScaffold',
      'export function touchDomainTrackPoint',
    ],
  },
  {
    file: 'src/domains/stats/background/aggregation/statsAggregateScaffold.js',
    requiredTokens: [
      'createEmptyDomainBehaviorStats',
      'export function ensureStatsDayRecord',
      'export function ensureDomainRecord',
      'export function touchDomainTrackPoint',
    ],
    forbiddenTokens: [
      'export function accumulateDomainElapsed',
      'export function recordDomainIntervention',
      'export function recordDomainNavigationIntent',
    ],
  },
]

async function walk(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath))
      continue
    }
    files.push(fullPath)
  }

  return files
}

function fail(message) {
  console.error(`[stats-projection-architecture] FAIL: ${message}`)
  process.exit(1)
}

async function pathExists(relativePath) {
  try {
    await fs.access(path.resolve(rootDir, relativePath))
    return true
  } catch {
    return false
  }
}

async function main() {
  for (const relativePath of requiredFiles) {
    if (!await pathExists(relativePath)) {
      fail(`required file missing: ${relativePath}`)
    }
  }

  for (const relativePath of forbiddenFiles) {
    if (await pathExists(relativePath)) {
      fail(`retired path must stay deleted: ${relativePath}`)
    }
  }

  const sourceFiles = (await walk(srcRoot)).filter((filePath) => filePath.endsWith('.js') || filePath.endsWith('.jsx'))

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(rootDir, filePath).split(path.sep).join('/')
    const source = await fs.readFile(filePath, 'utf8')

    for (const token of forbiddenSourceTokens) {
      if (!source.includes(token)) continue
      fail(`${relativePath} must not include forbidden stats projection token: ${token}`)
    }

    const isBackgroundOrDomainSource = relativePath.startsWith('src/apps/background/')
      || relativePath.startsWith('src/domains/')
    if (!isBackgroundOrDomainSource) continue

    for (const token of forbiddenBackgroundToDashboardImports) {
      if (!source.includes(token)) continue
      fail(`${relativePath} must not import dashboard scoring logic directly: ${token}`)
    }
  }

  for (const rule of fileRules) {
    const source = await fs.readFile(path.resolve(rootDir, rule.file), 'utf8')

    for (const token of rule.requiredTokens || []) {
      if (!source.includes(token)) {
        fail(`${rule.file} must include required architecture token: ${token}`)
      }
    }

    for (const token of rule.forbiddenTokens || []) {
      if (source.includes(token)) {
        fail(`${rule.file} must not include forbidden architecture token: ${token}`)
      }
    }
  }

  console.log('[stats-projection-architecture] PASS: canonical stats projection and analysis seams are active, and legacy/dashboard cross-owner paths stay deleted.')
}

main().catch((error) => {
  console.error('[stats-projection-architecture] Unexpected error:', error)
  process.exit(1)
})
