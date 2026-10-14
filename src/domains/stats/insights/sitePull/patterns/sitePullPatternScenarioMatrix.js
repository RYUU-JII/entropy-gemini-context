export const SITE_PULL_PATTERN_SCENARIO_MATRIX_VERSION = 'site-pull-pattern-scenario-matrix-v1';
export const SITE_PULL_PATTERN_SHADOW_DIAGNOSTIC_VERSION = 'site-pull-pattern-shadow-diagnostics-v1';

const MATCHED_VISIBLE = 'matched_visible';
const MATCHED_SUPPRESSED = 'matched_suppressed';
const MISSING_DATA = 'missing_data';
const NOT_OBSERVED = 'not_observed';

function freezeScenario(scenario) {
  return Object.freeze({
    ...scenario,
    patternIds: Object.freeze([...(scenario.patternIds || [])]),
    expectedVisiblePatternIds: Object.freeze([...(scenario.expectedVisiblePatternIds || [])]),
    requiredDataFamilies: Object.freeze([...(scenario.requiredDataFamilies || [])]),
    dataFamilyGates: Object.freeze((scenario.dataFamilyGates || []).map((gate) => (
      Object.freeze({
        ...gate,
        anyOf: Object.freeze([...(gate.anyOf || [])]),
      })
    ))),
  });
}

export const SITE_PULL_PATTERN_SCENARIO_MATRIX = Object.freeze([
  freezeScenario({
    id: 'controlled_brief_check',
    label: 'Controlled brief check',
    polarity: 'positive',
    conflictGroup: 'checking_control',
    patternIds: ['controlled_brief_check'],
    expectedVisiblePatternIds: ['controlled_brief_check'],
    requiredDataFamilies: ['usage'],
    dataFamilyGates: [{ id: 'entry_or_session', anyOf: ['entry', 'session'] }],
  }),
  freezeScenario({
    id: 'focused_block',
    label: 'Sustained domain block',
    polarity: 'neutral',
    patternIds: ['focused_block'],
    expectedVisiblePatternIds: ['focused_block'],
    requiredDataFamilies: ['usage', 'hourly'],
  }),
  freezeScenario({
    id: 'checking_carousel',
    label: 'Checking carousel',
    polarity: 'negative',
    conflictGroup: 'checking_control',
    patternIds: [
      'checking_carousel',
      'quick_return_loop',
      'switch_churn_loop',
      'session_fragmentation',
    ],
    expectedVisiblePatternIds: ['checking_carousel'],
    requiredDataFamilies: ['usage'],
    dataFamilyGates: [{ id: 'behavior_or_baseline', anyOf: ['behavior', 'personal_baseline'] }],
  }),
  freezeScenario({
    id: 'route_return_loop',
    label: 'Protected route return',
    polarity: 'negative',
    conflictGroup: 'checking_control',
    patternIds: ['protected_route_return', 'domain_pair_loop', 'loop_route_hint'],
    expectedVisiblePatternIds: [],
    requiredDataFamilies: ['transition_edges'],
  }),
  freezeScenario({
    id: 'feed_loop',
    label: 'Feed progression without independent loop evidence',
    polarity: 'negative',
    patternIds: ['feed_loop_pattern', 'feed_skimming', 'fast_scroll_bursts'],
    expectedVisiblePatternIds: [],
    requiredDataFamilies: ['behavior'],
  }),
  freezeScenario({
    id: 'late_night_binge',
    label: 'Late-night binge',
    polarity: 'negative',
    patternIds: ['late_night_binge', 'late_night'],
    expectedVisiblePatternIds: ['late_night_binge'],
    requiredDataFamilies: ['usage', 'hourly'],
  }),
  freezeScenario({
    id: 'intervention_resistance_loop',
    label: 'Intervention resistance loop',
    polarity: 'negative',
    conflictGroup: 'intervention_outcome',
    patternIds: ['intervention_resistance_loop', 'intervention_reentry'],
    expectedVisiblePatternIds: ['intervention_resistance_loop', 'intervention_reentry'],
    requiredDataFamilies: ['intervention'],
  }),
  freezeScenario({
    id: 'intervention_recovery',
    label: 'Intervention recovery',
    polarity: 'positive',
    conflictGroup: 'intervention_outcome',
    patternIds: ['intervention_recovery'],
    expectedVisiblePatternIds: ['intervention_recovery'],
    requiredDataFamilies: ['intervention'],
  }),
  freezeScenario({
    id: 'goal_overrun',
    label: 'Goal overrun',
    polarity: 'negative',
    patternIds: ['goal_exceeded_repeated', 'goal_exceeded'],
    expectedVisiblePatternIds: ['goal_exceeded_repeated', 'goal_exceeded'],
    requiredDataFamilies: ['usage'],
  }),
  freezeScenario({
    id: 'no_activity',
    label: 'No activity',
    polarity: 'neutral',
    patternIds: ['no_activity'],
    expectedVisiblePatternIds: ['no_activity'],
    requiredDataFamilies: [],
  }),
].map(freezeScenario));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function patternIds(patterns = []) {
  return asArray(patterns)
    .map((pattern) => pattern?.id)
    .filter((id) => typeof id === 'string' && id.length > 0);
}

function compactIdList(values = []) {
  const seen = new Set();
  return asArray(values).filter((value) => {
    if (typeof value !== 'string' || value.length === 0 || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function buildFamilyIndex(dataFamilyDiagnostics = []) {
  const index = new Map();
  asArray(dataFamilyDiagnostics).forEach((entry) => {
    if (typeof entry?.family === 'string' && entry.family.length > 0) {
      index.set(entry.family, entry);
    }
  });
  return index;
}

function isFamilyUnavailable(entry) {
  return entry?.status === 'unavailable' || entry?.status === 'partial';
}

function missingDataForScenario(scenario, familyIndex) {
  const missingFamilies = [];
  asArray(scenario.requiredDataFamilies).forEach((family) => {
    const entry = familyIndex.get(family);
    if (isFamilyUnavailable(entry)) missingFamilies.push(family);
  });
  asArray(scenario.dataFamilyGates).forEach((gate) => {
    const familyEntries = asArray(gate.anyOf).map((family) => familyIndex.get(family));
    const hasAvailableFamily = familyEntries.some((entry) => entry && !isFamilyUnavailable(entry));
    if (!hasAvailableFamily) {
      missingFamilies.push(gate.id || asArray(gate.anyOf).join('_or_'));
    }
  });
  return compactIdList(missingFamilies);
}

function buildSuppressionMap(suppressedPatterns = []) {
  const index = new Map();
  asArray(suppressedPatterns).forEach((suppression) => {
    if (typeof suppression?.id === 'string' && suppression.id.length > 0) {
      index.set(suppression.id, suppression);
    }
  });
  return index;
}

function buildScenarioRow(scenario, context) {
  const observedPatternIds = scenario.patternIds.filter((id) => context.patternIdSet.has(id));
  const visiblePatternIds = scenario.expectedVisiblePatternIds.filter((id) => context.visiblePatternIdSet.has(id));
  const suppressedPatternIds = observedPatternIds.filter((id) => context.suppressionIndex.has(id));
  const missingDataFamilies = missingDataForScenario(scenario, context.familyIndex);
  const status = visiblePatternIds.length > 0
    ? MATCHED_VISIBLE
    : observedPatternIds.length > 0
      ? MATCHED_SUPPRESSED
      : missingDataFamilies.length > 0
        ? MISSING_DATA
        : NOT_OBSERVED;

  return {
    id: scenario.id,
    label: scenario.label,
    polarity: scenario.polarity,
    conflictGroup: scenario.conflictGroup || null,
    status,
    observedPatternIds,
    visiblePatternIds,
    suppressedPatternIds,
    missingDataFamilies,
    expectedVisiblePatternIds: [...scenario.expectedVisiblePatternIds],
  };
}

function buildConflictRows(rows = []) {
  const byGroup = new Map();
  rows
    .filter((row) => row.status === MATCHED_VISIBLE && row.conflictGroup)
    .forEach((row) => {
      const groupRows = byGroup.get(row.conflictGroup) || [];
      groupRows.push(row);
      byGroup.set(row.conflictGroup, groupRows);
    });

  return [...byGroup.entries()]
    .map(([group, groupRows]) => {
      const polarities = new Set(groupRows.map((row) => row.polarity));
      if (!(polarities.has('positive') && polarities.has('negative'))) return null;
      return {
        group,
        scenarioIds: groupRows.map((row) => row.id),
        visiblePatternIds: compactIdList(groupRows.flatMap((row) => row.visiblePatternIds)),
      };
    })
    .filter(Boolean);
}

export function buildSitePullPatternShadowReport(patternLayers = {}, {
  dataFamilyDiagnostics = [],
} = {}) {
  const visiblePatterns = asArray(patternLayers.presentationPatterns);
  const rowsContext = {
    patternIdSet: new Set(patternIds(patternLayers.patterns)),
    visiblePatternIdSet: new Set(patternIds(visiblePatterns)),
    suppressionIndex: buildSuppressionMap(patternLayers.suppressedPatterns),
    familyIndex: buildFamilyIndex(dataFamilyDiagnostics),
  };
  const scenarioRows = SITE_PULL_PATTERN_SCENARIO_MATRIX.map((scenario) => (
    buildScenarioRow(scenario, rowsContext)
  ));
  const conflictRows = buildConflictRows(scenarioRows);
  const matchedVisibleScenarioIds = scenarioRows
    .filter((row) => row.status === MATCHED_VISIBLE)
    .map((row) => row.id);
  const matchedSuppressedScenarioIds = scenarioRows
    .filter((row) => row.status === MATCHED_SUPPRESSED)
    .map((row) => row.id);
  const missingDataScenarioIds = scenarioRows
    .filter((row) => row.status === MISSING_DATA)
    .map((row) => row.id);

  return {
    version: SITE_PULL_PATTERN_SHADOW_DIAGNOSTIC_VERSION,
    matrixVersion: SITE_PULL_PATTERN_SCENARIO_MATRIX_VERSION,
    summary: {
      scenarioCount: scenarioRows.length,
      matchedVisibleCount: matchedVisibleScenarioIds.length,
      matchedSuppressedCount: matchedSuppressedScenarioIds.length,
      missingDataCount: missingDataScenarioIds.length,
      conflictCount: conflictRows.length,
    },
    matchedVisibleScenarioIds,
    matchedSuppressedScenarioIds,
    missingDataScenarioIds,
    conflictRows,
    scenarioRows,
  };
}
