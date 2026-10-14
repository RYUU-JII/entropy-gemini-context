import { buildSitePullPatternShadowReport } from './sitePullPatternScenarioMatrix.js';
import { buildSitePullAggregatePatternPlan } from './sitePullAggregatePatternSpec.js';
import {
  SITE_PULL_PERSONAL_BASELINE_METRIC_IDS,
  getSitePullPersonalBaselineMetric,
} from '../personalBaselineMetrics.js';
import { countObservedWeeklyEntries } from '../../contracts/weeklyObservationContract.js';

export const SITE_PULL_PATTERN_DIAGNOSTIC_VERSION = 'site-pull-pattern-diagnostics-v1';
export const SITE_PULL_AUXILIARY_EVIDENCE_COVERAGE_VERSION =
  'site-pull-auxiliary-evidence-coverage-v1';

const AUXILIARY_EVIDENCE_PROFILE_DEFINITIONS = Object.freeze([
  {
    id: 'checking',
    dataFamilies: ['entry', 'session', 'behavior', 'personal_baseline'],
    affectedPatternIds: [
      'checking_carousel',
      'checking_pattern',
      'quick_return_loop',
      'switch_churn_loop',
      'session_fragmentation',
      'new_tab_loop',
      'duplicate_tab_entry',
      'tab_hoarding_context',
    ],
  },
  {
    id: 'controlledBrief',
    dataFamilies: ['usage', 'session', 'behavior', 'transition_edges', 'intervention'],
    affectedPatternIds: ['controlled_brief_check'],
  },
  {
    id: 'timePressure',
    dataFamilies: ['usage', 'weekly', 'personal_baseline'],
    affectedPatternIds: ['time_heavy_today', 'goal_exceeded', 'goal_exceeded_repeated'],
  },
  {
    id: 'trendPressure',
    dataFamilies: ['weekly', 'personal_baseline'],
    affectedPatternIds: ['rising_trend'],
  },
  {
    id: 'habitConsistency',
    dataFamilies: ['usage', 'weekly', 'entry', 'personal_baseline'],
    affectedPatternIds: ['daily_habit'],
  },
  {
    id: 'nightPressure',
    dataFamilies: ['hourly', 'entry', 'weekly'],
    affectedPatternIds: ['late_night', 'late_night_binge'],
  },
  {
    id: 'routePressure',
    dataFamilies: ['transition_edges'],
    affectedPatternIds: ['domain_pair_loop', 'protected_route_return', 'loop_route_hint'],
  },
  {
    id: 'sustainedBlock',
    dataFamilies: ['hourly', 'session', 'behavior'],
    affectedPatternIds: ['focused_block'],
  },
  {
    id: 'immersion',
    dataFamilies: ['hourly', 'session', 'behavior', 'navigation', 'intervention', 'personal_baseline'],
    affectedPatternIds: ['deep_immersion'],
  },
  {
    id: 'sessionDepth',
    dataFamilies: ['session', 'personal_baseline'],
    affectedPatternIds: ['session_depth_spike'],
  },
  {
    id: 'interventionOutcome',
    dataFamilies: ['intervention'],
    affectedPatternIds: ['intervention_reentry', 'intervention_resistance_loop', 'intervention_recovery'],
  },
  {
    id: 'backgroundResidency',
    dataFamilies: ['behavior'],
    affectedPatternIds: ['background_residency'],
  },
  {
    id: 'contentFlow',
    dataFamilies: ['behavior'],
    affectedPatternIds: ['feed_skimming', 'fast_scroll_bursts', 'feed_loop_pattern'],
  },
  {
    id: 'tabContext',
    dataFamilies: ['behavior'],
    affectedPatternIds: ['new_tab_loop', 'duplicate_tab_entry', 'tab_hoarding_context'],
  },
]);

const AUXILIARY_EVIDENCE_PROFILE_INDEX = new Map(
  AUXILIARY_EVIDENCE_PROFILE_DEFINITIONS.map((definition) => [definition.id, definition]),
);

const DATA_FAMILY_DEFINITIONS = Object.freeze([
  {
    family: 'usage',
    requiredSignals: ['facts.dataCoverage.hasUsageFacts', 'facts.usage.todayTotalMs'],
    affectedPatternIds: ['time_heavy_today', 'goal_missing', 'controlled_brief_check', 'steady'],
  },
  {
    family: 'hourly',
    requiredSignals: ['facts.dataCoverage.hasHourlyFacts', 'facts.usage.todayHourly', 'facts.usage.habitHourly'],
    affectedPatternIds: [
      'deep_immersion',
      'focused_block',
      'checking_pattern_proxy',
      'late_night',
      'late_night_binge',
    ],
  },
  {
    family: 'weekly',
    requiredSignals: ['facts.dataCoverage.hasWeeklyFacts', 'facts.usage.weeklySeries'],
    affectedPatternIds: ['daily_habit', 'rising_trend'],
  },
  {
    family: 'entry',
    requiredSignals: ['facts.dataCoverage.hasEntryFacts', 'facts.entry.hasVisitFacts'],
    affectedPatternIds: ['checking_pattern', 'controlled_brief_check'],
    fallbackPatternIds: ['checking_pattern_proxy'],
  },
  {
    family: 'session',
    requiredSignals: [
      'facts.dataCoverage.hasSessionFacts',
      'facts.dataCoverage.hasEstimatedSessionFacts',
      'facts.session.hasMeasuredSessionFacts',
      'facts.session.hasEstimatedSessionFacts',
    ],
    affectedPatternIds: ['session_fragmentation', 'controlled_brief_check'],
  },
  {
    family: 'behavior',
    permissionKey: 'contentBehavior',
    requiredSignals: ['facts.dataCoverage.hasBehaviorFacts', 'facts.behavior.hasBehaviorFacts'],
    affectedPatternIds: [
      'quick_return_loop',
      'switch_churn_loop',
      'new_tab_loop',
      'duplicate_tab_entry',
      'tab_hoarding_context',
      'feed_skimming',
      'fast_scroll_bursts',
    ],
    limitedPatternIds: ['focused_block', 'controlled_brief_check'],
  },
  {
    family: 'navigation',
    permissionKey: 'webNavigation',
    requiredSignals: ['facts.dataCoverage.hasNavigationFacts', 'facts.navigation.hasNavigationFacts'],
    affectedPatternIds: ['habitual_entry', 'reload_checking'],
  },
  {
    family: 'transition_edges',
    requiredSignals: [
      'facts.dataCoverage.hasTransitionEdgeFacts',
      'facts.transitionEdges.hasTransitionEdgeFacts',
    ],
    affectedPatternIds: ['domain_pair_loop', 'protected_route_return', 'loop_route_hint'],
  },
  {
    family: 'intervention',
    permissionKey: 'interventions',
    requiredSignals: ['facts.dataCoverage.hasInterventionFacts', 'facts.intervention.hasInterventionFacts'],
    affectedPatternIds: [
      'intervention_reentry',
      'intervention_resistance_loop',
      'intervention_recovery',
    ],
  },
  {
    family: 'personal_baseline',
    requiredSignals: [
      'personalBaseline.metrics.active_ms.confidence>=0.35',
      'personalBaseline.metrics.active_ms.sample.observedCount',
    ],
    affectedPatternIds: [
      'personal_spike',
      'visit_spike',
      'reentry_spike',
      'quick_return_loop',
      'switch_churn_loop',
      'session_depth_spike',
    ],
  },
]);

const KNOWN_DATA_FAMILIES = new Set(DATA_FAMILY_DEFINITIONS.map((definition) => definition.family));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function patternIds(patterns) {
  return asArray(patterns)
    .map((pattern) => pattern?.id)
    .filter(Boolean);
}

function evidenceKeys(pattern) {
  return Object.keys(pattern?.evidence || {}).sort();
}

function objectEvidenceKeys(value) {
  return Object.keys(isPlainObject(value?.evidence) ? value.evidence : {}).sort();
}

function compactNumber(value) {
  return Number.isFinite(Number(value)) ? Number(Number(value).toFixed(4)) : null;
}

function compactPattern(pattern) {
  if (!pattern?.id) return null;
  return {
    id: pattern.id,
    level: pattern.level || null,
    polarity: pattern.polarity || null,
    category: pattern.category || null,
    group: pattern.presentation?.group || pattern.category || null,
    slot: pattern.presentation?.slot || null,
    source: pattern.source || null,
    sourceList: asArray(pattern.sourceList),
    mergedSignalCount: Number.isFinite(Number(pattern.mergedSignalCount))
      ? Math.max(1, Math.floor(Number(pattern.mergedSignalCount)))
      : 1,
    componentIds: asArray(pattern.componentIds),
    supportingPatternIds: asArray(pattern.supportingPatternIds),
    evidenceKeys: evidenceKeys(pattern),
    score: compactNumber(pattern.score),
    confidence: compactNumber(pattern.confidence),
    calibration: pattern.calibration
      ? {
        status: pattern.calibration.status || null,
        sensitivity: pattern.calibration.sensitivity || null,
        visibility: pattern.calibration.visibility || null,
        scoreMeaning: pattern.calibration.scoreMeaning || null,
        evidenceStrength: compactNumber(pattern.calibration.evidenceStrength),
        sampleCount: compactNumber(pattern.calibration.sampleCount),
        minConfidence: compactNumber(pattern.calibration.minConfidence),
        minSampleCount: compactNumber(pattern.calibration.minSampleCount),
        sampleKeys: asArray(pattern.calibration.sampleKeys),
        decisionQuality: pattern.calibration.decisionQuality
          ? {
            version: pattern.calibration.decisionQuality.version || null,
            kind: pattern.calibration.decisionQuality.kind || null,
            status: pattern.calibration.decisionQuality.status || null,
            score: compactNumber(pattern.calibration.decisionQuality.score),
            boundaryMargin: compactNumber(pattern.calibration.decisionQuality.boundaryMargin),
            nearBoundary: pattern.calibration.decisionQuality.nearBoundary === true,
            evidenceFamilyIds: asArray(pattern.calibration.decisionQuality.evidenceFamilyIds),
            caveats: asArray(pattern.calibration.decisionQuality.caveats),
            caveatPenalty: compactNumber(pattern.calibration.decisionQuality.caveatPenalty),
          }
          : null,
      }
      : null,
  };
}

function compactSuppression(suppression) {
  if (!suppression?.id) return null;
  return {
    id: suppression.id,
    suppressedBy: suppression.suppressedBy || null,
    reason: suppression.reason || null,
    group: suppression.group || null,
    level: suppression.level || null,
  };
}

function compactRejection(rejection) {
  if (!rejection?.id) return null;
  return {
    id: rejection.id,
    reason: rejection.reason || null,
    failures: asArray(rejection.failures),
    source: rejection.source || null,
    level: rejection.level || null,
    category: rejection.category || null,
  };
}

function compactEvidenceProfileEntry(entry) {
  if (!entry?.id) return null;
  return {
    id: entry.id,
    status: entry.status || null,
    strength: compactNumber(entry.strength),
    canEmitAtomic: entry.canEmitAtomic === true,
    canSupportComposite: entry.canSupportComposite === true,
    caveats: asArray(entry.caveats),
    authorityKeys: asArray(entry.authorityKeys),
    evidence: { ...(entry.evidence || {}) },
    criteria: { ...(entry.criteria || {}) },
  };
}

function compactCheckingEvidenceProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const entries = [
    'checkingLoop',
    'quickReturn',
    'switchChurn',
    'sessionFragmentation',
    'habitualEntry',
    'reloadChecking',
    'newTabLoop',
    'duplicateTabEntry',
    'tabHoardingContext',
  ].reduce((result, key) => {
    const compact = compactEvidenceProfileEntry(profile[key]);
    if (compact) result[key] = compact;
    return result;
  }, {});
  return {
    version: profile.version || null,
    statusSemantics: { ...(profile.statusSemantics || {}) },
    counterAuthority: { ...(profile.counterAuthority || {}) },
    entries,
  };
}

function collectTrueCapabilityFlags(value = {}) {
  if (!isPlainObject(value)) return [];
  return Object.entries(value)
    .filter(([key, flag]) => (
      flag === true
      && /^can(?:Emit|Support)[A-Z0-9_]/.test(key)
    ))
    .map(([key]) => key)
    .sort();
}

function compactCaveats(values = []) {
  return mergeUniqueIds(values)
    .slice(0, 16);
}

function collectEvidenceCaveats(value = {}) {
  const direct = asArray(value?.caveats);
  const evidence = asArray(value?.evidence?.caveats);
  return compactCaveats([...direct, ...evidence]);
}

function looksLikeEvidenceEntry(value = {}) {
  return isPlainObject(value)
    && (
      typeof value.status === 'string'
      || Number.isFinite(Number(value.strength))
      || Number.isFinite(Number(value.score))
      || Number.isFinite(Number(value.confidence))
      || value.canEmitAtomic === true
      || value.canSupportComposite === true
      || collectTrueCapabilityFlags(value).length > 0
      || isPlainObject(value.evidence)
      || isPlainObject(value.criteria)
    );
}

function compactAuxiliaryEvidenceEntry(id, entry = {}) {
  if (!id || !looksLikeEvidenceEntry(entry)) return null;
  return {
    id,
    status: entry.status || null,
    strength: compactNumber(entry.strength ?? entry.score),
    score: compactNumber(entry.score),
    confidence: compactNumber(entry.confidence),
    canEmitAtomic: entry.canEmitAtomic === true,
    canSupportComposite: entry.canSupportComposite === true,
    capabilityFlags: collectTrueCapabilityFlags(entry),
    caveats: collectEvidenceCaveats(entry),
    authorityKeys: asArray(entry.authorityKeys),
    evidenceKeys: objectEvidenceKeys(entry),
    criteriaKeys: Object.keys(isPlainObject(entry.criteria) ? entry.criteria : {}).sort(),
  };
}

function extractAuxiliaryEvidenceEntries(profileId, profile = {}) {
  if (!isPlainObject(profile)) return [];
  const entries = [];
  const rootEntry = compactAuxiliaryEvidenceEntry(profileId, {
    ...profile,
    id: profileId,
    strength: profile.strength ?? profile.score,
  });
  if (rootEntry) entries.push(rootEntry);

  Object.entries(profile).forEach(([key, value]) => {
    if (!isPlainObject(value) || !looksLikeEvidenceEntry(value)) return;
    if (key === 'evidence' || key === 'criteria' || key === 'statusSemantics' || key === 'counterAuthority') return;
    const entry = compactAuxiliaryEvidenceEntry(`${profileId}.${key}`, {
      ...value,
      id: value.id || `${profileId}.${key}`,
    });
    if (entry) entries.push(entry);
  });

  const seen = new Set();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).slice(0, 12);
}

function buildFamilyStatusIndex(dataFamilyDiagnostics = []) {
  const index = new Map();
  asArray(dataFamilyDiagnostics).forEach((entry) => {
    if (entry?.family) index.set(entry.family, entry);
  });
  return index;
}

function resolveMissingDataFamilies(definition = {}, familyIndex = new Map()) {
  return asArray(definition.dataFamilies)
    .map((family) => {
      assertSitePullPatternDiagnosticDataFamily(family);
      const familyDiagnostic = familyIndex.get(family) || null;
      if (!familyDiagnostic) {
        if (familyIndex.size > 0) {
          throw new Error(`SITE_PULL_PATTERN_DIAGNOSTIC_FAMILY_STATUS_MISSING:${family}`);
        }
        return {
          family,
          status: 'unavailable',
          reason: 'family diagnostic unavailable',
        };
      }
      if (familyDiagnostic.status === 'available') return null;
      if (familyDiagnostic.status === 'not_applicable' && familyDiagnostic.reason === 'no_activity') return null;
      return {
        family,
        status: familyDiagnostic.status,
        reason: familyDiagnostic.reason,
        ...(familyDiagnostic.permissionKey ? { permissionKey: familyDiagnostic.permissionKey } : {}),
        ...(Object.prototype.hasOwnProperty.call(familyDiagnostic, 'permissionGranted')
          ? { permissionGranted: familyDiagnostic.permissionGranted }
          : {}),
      };
    })
    .filter(Boolean);
}

function entryHasAtomicCapability(entry = {}) {
  return entry.canEmitAtomic === true || asArray(entry.capabilityFlags).some((flag) => (
    flag.startsWith('canEmit') && !flag.includes('Support')
  ));
}

function entryHasSupportCapability(entry = {}) {
  return entry.canSupportComposite === true
    || asArray(entry.capabilityFlags).some((flag) => flag.startsWith('canSupport') || flag.includes('Support'));
}

function entryHasObservedEvidence(entry = {}) {
  return entryHasAtomicCapability(entry)
    || entryHasSupportCapability(entry)
    || toNumber(entry.strength) > 0
    || toNumber(entry.score) > 0
    || (typeof entry.status === 'string' && entry.status.length > 0 && !statusLooksInsufficient(entry.status));
}

function statusLooksInsufficient(status = '') {
  return typeof status === 'string'
    && (
      status.includes('insufficient')
      || status.includes('absent')
      || status === 'unavailable'
    );
}

function resolveAuxiliaryProfileCoverageStatus({
  profile = null,
  entries = [],
  missingDataFamilies = [],
} = {}) {
  if (!profile) return 'unavailable';
  if (entries.some(entryHasAtomicCapability)) return 'emitting';
  if (entries.some(entryHasSupportCapability)) return 'supporting';
  if (entries.some(entryHasObservedEvidence)) return 'observed';
  if (missingDataFamilies.length > 0 || statusLooksInsufficient(profile.status)) return 'insufficient';
  return 'observed';
}

function compactAuxiliaryEvidenceProfile(profileId, profile, {
  definition,
  familyIndex,
  patternIndex,
} = {}) {
  const profileDefinition = definition || AUXILIARY_EVIDENCE_PROFILE_INDEX.get(profileId) || {
    id: profileId,
    dataFamilies: [],
    affectedPatternIds: [],
  };
  const missingDataFamilies = resolveMissingDataFamilies(profileDefinition, familyIndex);
  const entries = extractAuxiliaryEvidenceEntries(profileId, profile);
  const coverageStatus = resolveAuxiliaryProfileCoverageStatus({
    profile,
    entries,
    missingDataFamilies,
  });
  const affectedPatternIds = compactIdList(profileDefinition.affectedPatternIds);

  return {
    id: profileId,
    status: profile?.status || null,
    coverageStatus,
    score: compactNumber(profile?.score),
    confidence: compactNumber(profile?.confidence),
    dataFamilies: compactIdList(profileDefinition.dataFamilies),
    missingDataFamilies,
    limitedByMissingData: missingDataFamilies.length > 0,
    affectedPatternIds,
    presentPatternIds: affectedPatternIds.filter((id) => patternIndex.has(id)),
    skippedPatternIds: affectedPatternIds.filter((id) => !patternIndex.has(id)),
    capabilityFlags: collectTrueCapabilityFlags(profile),
    caveats: compactCaveats([
      ...collectEvidenceCaveats(profile),
      ...entries.flatMap((entry) => asArray(entry.caveats)),
    ]),
    evidenceKeys: objectEvidenceKeys(profile).slice(0, 48),
    entryCount: entries.length,
    emittingEntryIds: entries.filter(entryHasAtomicCapability).map((entry) => entry.id),
    supportingEntryIds: entries.filter(entryHasSupportCapability).map((entry) => entry.id),
    observedEntryIds: entries.filter(entryHasObservedEvidence).map((entry) => entry.id),
    entries,
  };
}

function buildAuxiliaryEvidenceCoverage(patternLayers = {}, dataFamilyDiagnostics = []) {
  const profiles = patternLayers.primaryEvidenceProfiles || {};
  const familyIndex = buildFamilyStatusIndex(dataFamilyDiagnostics);
  const patternIndex = buildPatternIndex(asArray(patternLayers.patterns));
  const profileIds = mergeUniqueIds([
    ...AUXILIARY_EVIDENCE_PROFILE_DEFINITIONS.map((definition) => definition.id),
    ...Object.keys(profiles),
  ]);
  const profileCoverage = profileIds.map((profileId) => compactAuxiliaryEvidenceProfile(
    profileId,
    profiles[profileId] || null,
    {
      definition: AUXILIARY_EVIDENCE_PROFILE_INDEX.get(profileId),
      familyIndex,
      patternIndex,
    },
  ));
  const countByStatus = profileCoverage.reduce((result, entry) => {
    result[entry.coverageStatus] = (result[entry.coverageStatus] || 0) + 1;
    return result;
  }, {});

  return {
    version: SITE_PULL_AUXILIARY_EVIDENCE_COVERAGE_VERSION,
    summary: {
      totalProfiles: profileCoverage.length,
      emittingProfiles: countByStatus.emitting || 0,
      supportingProfiles: countByStatus.supporting || 0,
      observedProfiles: countByStatus.observed || 0,
      insufficientProfiles: countByStatus.insufficient || 0,
      unavailableProfiles: countByStatus.unavailable || 0,
      limitedByMissingDataProfiles: profileCoverage.filter((entry) => entry.limitedByMissingData).length,
      caveatCount: profileCoverage.reduce((sum, entry) => sum + entry.caveats.length, 0),
    },
    profiles: profileCoverage,
  };
}

function nonNull(values) {
  return values.filter(Boolean);
}

function hasDiagnosticContext(context) {
  return Boolean(context?.featureVector || context?.facts || context?.personalBaseline);
}

function hasAnyActivity(context) {
  const facts = context?.facts || {};
  return toNumber(facts?.usage?.todayTotalMs) > 0
    || toNumber(facts?.usage?.weeklyTotalMs) > 0;
}

function hasUsageFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  if (coverage.hasUsageFacts === true) return true;
  const usage = context?.facts?.usage || {};
  return toNumber(usage.todayTotalMs) > 0 || toNumber(usage.weeklyTotalMs) > 0;
}

function hasHourlyFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  return coverage.hasHourlyFacts === true;
}

function hasWeeklyFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  const usage = context?.facts?.usage || {};
  return coverage.hasWeeklyFacts === true
    || countObservedWeeklyEntries(usage.weeklySeries, {
      source: 'sitePullPatternDiagnostics.weeklySeries',
    }) > 0;
}

function hasEntryFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  const entry = context?.facts?.entry || {};
  return coverage.hasEntryFacts === true
    || entry.hasVisitFacts === true
    || toNumber(entry.todayVisits) > 0;
}

function hasSessionFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  const session = context?.facts?.session || {};
  return coverage.hasSessionFacts === true
    || coverage.hasEstimatedSessionFacts === true
    || session.hasMeasuredSessionFacts === true
    || session.hasEstimatedSessionFacts === true;
}

function hasMeasuredSessionFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  const session = context?.facts?.session || {};
  return coverage.hasSessionFacts === true || session.hasMeasuredSessionFacts === true;
}

function hasBehaviorFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  return coverage.hasBehaviorFacts === true || context?.facts?.behavior?.hasBehaviorFacts === true;
}

function hasNavigationFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  return coverage.hasNavigationFacts === true || context?.facts?.navigation?.hasNavigationFacts === true;
}

function hasTransitionEdgeFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  return coverage.hasTransitionEdgeFacts === true
    || context?.facts?.transitionEdges?.hasTransitionEdgeFacts === true;
}

function hasInterventionFacts(context) {
  const coverage = context?.facts?.dataCoverage || {};
  return coverage.hasInterventionFacts === true
    || context?.facts?.intervention?.hasInterventionFacts === true;
}

function personalBaselineActiveMetric(context) {
  const personalBaseline = context?.personalBaseline;
  if (personalBaseline === null || personalBaseline === undefined) return null;
  return getSitePullPersonalBaselineMetric(
    personalBaseline,
    SITE_PULL_PERSONAL_BASELINE_METRIC_IDS.ACTIVE_MS,
  );
}

function hasPersonalBaselineFacts(context) {
  const activeMetric = personalBaselineActiveMetric(context);
  return toNumber(activeMetric?.confidence) >= 0.35
    || Math.floor(toNumber(activeMetric?.sample?.observedCount)) >= 7;
}

export function assertSitePullPatternDiagnosticDataFamily(family) {
  if (!KNOWN_DATA_FAMILIES.has(family)) {
    throw new Error(`SITE_PULL_PATTERN_DIAGNOSTIC_DATA_FAMILY_UNKNOWN:${family || 'missing'}`);
  }
}

function resolveFamilyStatus(definition, context) {
  assertSitePullPatternDiagnosticDataFamily(definition?.family);
  if (!hasAnyActivity(context) && definition.family !== 'usage') {
    return { status: 'not_applicable', reason: 'no_activity' };
  }
  switch (definition.family) {
    case 'usage':
      if (!hasAnyActivity(context)) return { status: 'not_applicable', reason: 'no_activity' };
      return hasUsageFacts(context)
        ? { status: 'available', reason: 'usage facts available' }
        : { status: 'unavailable', reason: 'usage facts unavailable' };
    case 'hourly':
      return hasHourlyFacts(context)
        ? { status: 'available', reason: 'hourly facts available' }
        : { status: 'unavailable', reason: 'hourly facts unavailable' };
    case 'weekly':
      return hasWeeklyFacts(context)
        ? { status: 'available', reason: 'weekly facts available' }
        : { status: 'unavailable', reason: 'weekly facts unavailable' };
    case 'entry':
      return hasEntryFacts(context)
        ? { status: 'available', reason: 'entry facts available' }
        : { status: 'unavailable', reason: 'entry facts unavailable' };
    case 'session':
      if (hasMeasuredSessionFacts(context)) return { status: 'available', reason: 'measured session facts available' };
      return hasSessionFacts(context)
        ? { status: 'available', reason: 'estimated session facts available' }
        : { status: 'unavailable', reason: 'session facts unavailable' };
    case 'behavior':
      return hasBehaviorFacts(context)
        ? { status: 'available', reason: 'behavior facts available' }
        : { status: 'unavailable', reason: 'behavior facts unavailable' };
    case 'navigation':
      return hasNavigationFacts(context)
        ? { status: 'available', reason: 'navigation facts available' }
        : { status: 'unavailable', reason: 'navigation facts unavailable' };
    case 'transition_edges':
      return hasTransitionEdgeFacts(context)
        ? { status: 'available', reason: 'transition edge facts available' }
        : { status: 'unavailable', reason: 'transition edge facts unavailable' };
    case 'intervention':
      return hasInterventionFacts(context)
        ? { status: 'available', reason: 'intervention facts available' }
        : { status: 'unavailable', reason: 'intervention facts unavailable' };
    case 'personal_baseline':
      return hasPersonalBaselineFacts(context)
        ? { status: 'available', reason: 'personal baseline available' }
        : { status: 'unavailable', reason: 'personal baseline sparse' };
    default:
      throw new Error(`SITE_PULL_PATTERN_DIAGNOSTIC_DATA_FAMILY_UNHANDLED:${definition.family}`);
  }
}

function buildPatternIndex(patterns) {
  const index = new Set();
  patterns.forEach((pattern) => {
    if (pattern?.id) index.add(pattern.id);
  });
  return index;
}

function compactIdList(values = []) {
  return mergeUniqueIds(asArray(values));
}

function mergeUniqueIds(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    if (typeof value !== 'string' || value.length === 0 || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function buildDataFamilyDiagnostics(context, patternIndex) {
  if (!hasDiagnosticContext(context)) return [];
  const permissionCoverage = context?.facts?.dataCoverage?.permissionCoverage || {};
  return DATA_FAMILY_DEFINITIONS.map((definition) => {
    const { status, reason } = resolveFamilyStatus(definition, context);
    const affectedPatternIds = compactIdList(definition.affectedPatternIds);
    const presentPatternIds = affectedPatternIds.filter((id) => patternIndex.has(id));
    const skippedPatternIds = affectedPatternIds.filter((id) => !patternIndex.has(id));
    const fallbackPatternIds = compactIdList(definition.fallbackPatternIds)
      .filter((id) => patternIndex.has(id));
    const limitedPatternIds = compactIdList(definition.limitedPatternIds);
    return {
      family: definition.family,
      status,
      reason,
      requiredSignals: compactIdList(definition.requiredSignals),
      ...(definition.permissionKey ? { permissionKey: definition.permissionKey } : {}),
      ...(definition.permissionKey
        ? { permissionGranted: permissionCoverage[definition.permissionKey] === true }
        : {}),
      affectedPatternIds,
      skippedPatternIds,
      presentPatternIds,
      fallbackPatternIds,
      limitedPatternIds,
    };
  });
}

function buildAggregateAnalysisPlan(context = {}, dataFamilyDiagnostics = []) {
  const aggregateOptions = isPlainObject(context.aggregateAnalysis)
    ? context.aggregateAnalysis
    : {};
  return buildSitePullAggregatePatternPlan({
    enabled: aggregateOptions.enabled === true,
    requestedPatternIds: asArray(aggregateOptions.requestedPatternIds),
    costBudget: aggregateOptions.costBudget,
    dataFamilyDiagnostics,
  });
}

function buildMissingDataDiagnostics(dataFamilyDiagnostics) {
  return dataFamilyDiagnostics
    .filter((entry) => (
      (entry.status === 'unavailable' || entry.status === 'partial')
      && asArray(entry.skippedPatternIds).length > 0
    ))
    .map((entry) => ({
      family: entry.family,
      status: entry.status,
      reason: entry.reason,
      requiredSignals: entry.requiredSignals,
      ...(entry.permissionKey ? { permissionKey: entry.permissionKey } : {}),
      ...(entry.permissionKey ? { permissionGranted: entry.permissionGranted } : {}),
      skippedPatternIds: entry.skippedPatternIds,
      fallbackPatternIds: entry.fallbackPatternIds,
      limitedPatternIds: entry.limitedPatternIds,
    }));
}

export function buildSitePullPatternDiagnosticReport(patternLayers = {}, context = {}) {
  const patterns = asArray(patternLayers.patterns);
  const atomicPatterns = asArray(patternLayers.atomicPatterns);
  const compositePatterns = asArray(patternLayers.compositePatterns);
  const statePatterns = asArray(patternLayers.statePatterns);
  const presentationPatterns = asArray(patternLayers.presentationPatterns);
  const suppressedPatterns = asArray(patternLayers.suppressedPatterns);
  const rejectedPatterns = asArray(patternLayers.rejectedPatterns);
  const patternIndex = buildPatternIndex(patterns);
  const dataFamilyDiagnostics = buildDataFamilyDiagnostics(context, patternIndex);
  const auxiliaryEvidenceCoverage = buildAuxiliaryEvidenceCoverage(patternLayers, dataFamilyDiagnostics);
  const aggregateAnalysisPlan = buildAggregateAnalysisPlan(context, dataFamilyDiagnostics);

  return {
    version: SITE_PULL_PATTERN_DIAGNOSTIC_VERSION,
    layerVersion: patternLayers.version || null,
    calibrationVersion: patternLayers.calibrationVersion || null,
    definitionVersion: patternLayers.definitionVersion || null,
    presenterVersion: patternLayers.presenterVersion || null,
    requirementsVersion: patternLayers.requirementsVersion || null,
    calibration: patternLayers.calibration
      ? {
        version: patternLayers.calibration.version || null,
        detector: {
          summary: { ...(patternLayers.calibration.detector?.summary || {}) },
        },
        final: {
          summary: { ...(patternLayers.calibration.final?.summary || {}) },
        },
        rows: asArray(patternLayers.calibration.rows).map((row) => ({
          stage: row.stage || null,
          id: row.id || null,
          status: row.status || null,
          sensitivity: row.sensitivity || null,
          visibility: row.visibility || null,
          scoreMeaning: row.scoreMeaning || null,
          score: compactNumber(row.score),
          confidence: compactNumber(row.confidence),
          evidenceStrength: compactNumber(row.evidenceStrength),
          sampleCount: compactNumber(row.sampleCount),
          failures: asArray(row.failures),
        })),
      }
      : null,
    primaryEvidenceProfiles: {
      checking: compactCheckingEvidenceProfile(
        patternLayers.primaryEvidenceProfiles?.checking
        || context.checkingEvidenceProfile,
      ),
    },
    counts: {
      total: patterns.length,
      atomic: atomicPatterns.length,
      composite: compositePatterns.length,
      state: statePatterns.length,
      presentation: presentationPatterns.length,
      suppressed: suppressedPatterns.length,
      rejected: rejectedPatterns.length,
    },
    patternIds: patternIds(patterns),
    atomicPatternIds: patternIds(atomicPatterns),
    compositePatternIds: patternIds(compositePatterns),
    statePatternIds: patternIds(statePatterns),
    presentationPatternIds: patternIds(presentationPatterns),
    suppressedPatternIds: asArray(patternLayers.suppressedPatternIds).length > 0
      ? asArray(patternLayers.suppressedPatternIds)
      : patternIds(suppressedPatterns),
    rejectedPatternIds: patternIds(rejectedPatterns),
    visiblePatterns: nonNull(presentationPatterns.map(compactPattern)),
    suppressedPatterns: nonNull(suppressedPatterns.map(compactSuppression)),
    rejectedPatterns: nonNull(rejectedPatterns.map(compactRejection)),
    dataFamilyDiagnostics,
    missingDataDiagnostics: buildMissingDataDiagnostics(dataFamilyDiagnostics),
    auxiliaryEvidenceCoverage,
    aggregateAnalysisPlan,
    shadowReport: buildSitePullPatternShadowReport(patternLayers, {
      dataFamilyDiagnostics,
    }),
    compositeEdges: asArray(patternLayers.graph?.compositeEdges).map((edge) => ({
      id: edge.id,
      componentIds: asArray(edge.componentIds),
    })),
    presentationPolicy: {
      groupLimits: { ...(patternLayers.presentationPolicy?.groupLimits || {}) },
    },
  };
}
