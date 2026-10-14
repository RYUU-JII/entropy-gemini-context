import {
  SITE_PULL_AGGREGATE_FEEDBACK_PATTERN_IDS,
  SITE_PULL_AGGREGATE_FEEDBACK_ROLES,
  SITE_PULL_AGGREGATE_FEEDBACK_SURFACES,
} from './sitePullAggregateFeedback.js';
import { SITE_PULL_AGGREGATE_PATTERN_SPECS } from './sitePullAggregatePatternSpec.js';
import { SITE_PULL_PATTERN_DEFINITIONS } from './sitePullPatternDefinitions.js';
import {
  SITE_PULL_PATTERN_FEEDBACK_ROLES,
  SITE_PULL_PATTERN_FEEDBACK_SCOPES,
  SITE_PULL_PATTERN_FEEDBACK_SPEC,
  SITE_PULL_PATTERN_FEEDBACK_SURFACES,
} from './sitePullPatternFeedbackSpec.js';

export const SITE_PULL_FEEDBACK_SURFACE_INVENTORY_VERSION =
  'site-pull-feedback-surface-inventory-v1';
export const SITE_PULL_FEEDBACK_SURFACE_INVENTORY_AUDIT_VERSION =
  'site-pull-feedback-surface-inventory-audit-v1';

export const SITE_PULL_FEEDBACK_SURFACE_INVENTORY_KINDS = Object.freeze({
  DOMAIN_PATTERN: 'domain_pattern',
  AGGREGATE_PATTERN: 'aggregate_pattern',
});

export const SITE_PULL_FEEDBACK_CONSUMER_IDS = Object.freeze({
  DOMAIN_BADGE: 'site_pull_domain_badge_view_model',
  DOMAIN_DETAIL: 'site_pull_domain_detail_panel',
  DOMAIN_RECAP: 'site_pull_domain_recap_candidate',
  DOMAIN_DIAGNOSTIC: 'site_pull_domain_diagnostic_report',
  AGGREGATE_SITES_OVERVIEW: 'sites_workspace_aggregate_feedback',
  AGGREGATE_RECAP: 'site_pull_aggregate_recap_candidate',
  AGGREGATE_DIAGNOSTIC: 'site_pull_aggregate_diagnostic_report',
});

const { DOMAIN_PATTERN, AGGREGATE_PATTERN } = SITE_PULL_FEEDBACK_SURFACE_INVENTORY_KINDS;
const { SUPPORTING_EVIDENCE, USER_FEEDBACK } = SITE_PULL_PATTERN_FEEDBACK_ROLES;
const { DOMAIN } = SITE_PULL_PATTERN_FEEDBACK_SCOPES;
const { BADGE, DETAIL, RECAP, DIAGNOSTIC } = SITE_PULL_PATTERN_FEEDBACK_SURFACES;
const { SITES_OVERVIEW } = SITE_PULL_AGGREGATE_FEEDBACK_SURFACES;

const DOMAIN_USER_VISIBLE_SURFACES = new Set([BADGE, DETAIL, RECAP]);
const KNOWN_DOMAIN_SURFACES = new Set(Object.values(SITE_PULL_PATTERN_FEEDBACK_SURFACES));
const AGGREGATE_USER_VISIBLE_SURFACES = new Set([
  SITES_OVERVIEW,
  SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP,
]);
const AGGREGATE_FEEDBACK_PATTERN_ID_SET = new Set(SITE_PULL_AGGREGATE_FEEDBACK_PATTERN_IDS);
const KNOWN_AGGREGATE_SURFACES = new Set(Object.values(SITE_PULL_AGGREGATE_FEEDBACK_SURFACES));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function freezeArray(values = []) {
  return Object.freeze([...values]);
}

function unique(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    if (typeof value !== 'string' || value.length === 0 || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function hasSurface(surfaces = [], surface) {
  return asArray(surfaces).includes(surface);
}

function hasAnySurface(surfaces = [], surfaceSet) {
  return asArray(surfaces).some((surface) => surfaceSet.has(surface));
}

function domainConsumerIds(surfaces = []) {
  return unique([
    hasSurface(surfaces, BADGE) ? SITE_PULL_FEEDBACK_CONSUMER_IDS.DOMAIN_BADGE : null,
    hasSurface(surfaces, DETAIL) ? SITE_PULL_FEEDBACK_CONSUMER_IDS.DOMAIN_DETAIL : null,
    hasSurface(surfaces, RECAP) ? SITE_PULL_FEEDBACK_CONSUMER_IDS.DOMAIN_RECAP : null,
    hasSurface(surfaces, DIAGNOSTIC) ? SITE_PULL_FEEDBACK_CONSUMER_IDS.DOMAIN_DIAGNOSTIC : null,
  ].filter(Boolean));
}

function aggregateConsumerIds(surfaces = []) {
  return unique([
    hasSurface(surfaces, SITES_OVERVIEW) ? SITE_PULL_FEEDBACK_CONSUMER_IDS.AGGREGATE_SITES_OVERVIEW : null,
    hasSurface(surfaces, SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP)
      ? SITE_PULL_FEEDBACK_CONSUMER_IDS.AGGREGATE_RECAP
      : null,
    hasSurface(surfaces, SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.DIAGNOSTIC)
      ? SITE_PULL_FEEDBACK_CONSUMER_IDS.AGGREGATE_DIAGNOSTIC
      : null,
  ].filter(Boolean));
}

function finiteRank(value) {
  const rank = Number(value);
  return Number.isFinite(rank) ? rank : null;
}

function buildDomainPatternInventoryRows() {
  return Object.entries(SITE_PULL_PATTERN_DEFINITIONS)
    .map(([id, definition]) => {
      const spec = SITE_PULL_PATTERN_FEEDBACK_SPEC[id] || null;
      const surfaces = freezeArray(spec?.surfaces || []);
      const presentation = definition?.presentation || {};
      return Object.freeze({
        id,
        kind: DOMAIN_PATTERN,
        enabled: true,
        definitionPresent: true,
        feedbackSpecPresent: !!spec,
        level: definition?.level || null,
        polarity: definition?.polarity || null,
        componentIds: freezeArray(definition?.componentIds || []),
        suppresses: freezeArray(definition?.suppresses || []),
        role: spec?.role || null,
        feedbackScope: spec?.feedbackScope || null,
        surfaces,
        badgeEligible: hasSurface(surfaces, BADGE),
        detailEligible: hasSurface(surfaces, DETAIL),
        recapEligible: hasSurface(surfaces, RECAP),
        diagnosticEligible: hasSurface(surfaces, DIAGNOSTIC),
        userVisible: hasAnySurface(surfaces, DOMAIN_USER_VISIBLE_SURFACES),
        consumerIds: freezeArray(domainConsumerIds(surfaces)),
        recommendationFamily: spec?.recommendationFamily || null,
        aggregationHint: spec?.aggregationHint || null,
        decisionRequired: spec?.decisionRequired === true,
        userValue: spec?.userValue || null,
        slot: presentation.slot || 'badge',
        group: presentation.group || null,
        rank: finiteRank(presentation.rank),
      });
    })
    .sort((left, right) => (
      (left.rank ?? 1_000) - (right.rank ?? 1_000)
      || left.id.localeCompare(right.id)
    ));
}

function resolveAggregateRole(surfaces = []) {
  if (hasSurface(surfaces, SITES_OVERVIEW)) {
    return SITE_PULL_AGGREGATE_FEEDBACK_ROLES.USER_FEEDBACK;
  }
  if (hasSurface(surfaces, SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP)) {
    return SITE_PULL_AGGREGATE_FEEDBACK_ROLES.RECAP_CONTEXT;
  }
  return SITE_PULL_AGGREGATE_FEEDBACK_ROLES.DIAGNOSTIC;
}

function buildAggregatePatternInventoryRows({ includeDisabledAggregate = true } = {}) {
  return Object.entries(SITE_PULL_AGGREGATE_PATTERN_SPECS)
    .filter(([, spec]) => includeDisabledAggregate || spec.enabled === true)
    .map(([id, spec]) => {
      const surfaces = freezeArray(spec.outputSurfaces || []);
      const feedbackBuilderReady = AGGREGATE_FEEDBACK_PATTERN_ID_SET.has(id);
      return Object.freeze({
        id,
        kind: AGGREGATE_PATTERN,
        enabled: spec.enabled === true,
        definitionPresent: true,
        feedbackSpecPresent: true,
        level: 'aggregate',
        polarity: null,
        componentIds: freezeArray([]),
        suppresses: freezeArray([]),
        role: resolveAggregateRole(surfaces),
        feedbackScope: spec.scope || null,
        surfaces,
        outputSurfaces: surfaces,
        badgeEligible: false,
        detailEligible: false,
        recapEligible: hasSurface(surfaces, SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.RECAP),
        diagnosticEligible: hasSurface(surfaces, SITE_PULL_AGGREGATE_FEEDBACK_SURFACES.DIAGNOSTIC),
        sitesOverviewEligible: hasSurface(surfaces, SITES_OVERVIEW),
        userVisible: spec.enabled === true && hasAnySurface(surfaces, AGGREGATE_USER_VISIBLE_SURFACES),
        consumerIds: freezeArray(aggregateConsumerIds(surfaces)),
        recommendationFamily: spec.recommendationFamily || null,
        aggregationHint: null,
        decisionRequired: false,
        userValue: spec.userValue || null,
        slot: 'aggregate',
        group: 'aggregate',
        rank: null,
        costClass: spec.costClass || null,
        timeAxes: freezeArray(spec.timeAxes || []),
        signalFamilies: freezeArray(spec.signalFamilies || []),
        entityProjection: spec.entityProjection || null,
        baselineModes: freezeArray(spec.baselineModes || []),
        analysisMethods: freezeArray(spec.analysisMethods || []),
        feedbackBuilderReady,
      });
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function increment(target, key) {
  if (!key) return;
  target[key] = (target[key] || 0) + 1;
}

function buildInventorySummary(rows = []) {
  return rows.reduce((summary, row) => {
    summary.totalRows += 1;
    increment(summary.byKind, row.kind);
    increment(summary.byRole, row.role);
    increment(summary.byScope, row.feedbackScope);
    asArray(row.surfaces).forEach((surface) => increment(summary.bySurface, surface));
    if (row.userVisible) summary.userVisibleRows += 1;
    if (row.badgeEligible) summary.badgeEligibleRows += 1;
    if (row.recapEligible) summary.recapEligibleRows += 1;
    if (row.kind === AGGREGATE_PATTERN && row.enabled) summary.enabledAggregateRows += 1;
    return summary;
  }, {
    totalRows: 0,
    userVisibleRows: 0,
    badgeEligibleRows: 0,
    recapEligibleRows: 0,
    enabledAggregateRows: 0,
    byKind: {},
    byRole: {},
    byScope: {},
    bySurface: {},
  });
}

export function listSitePullFeedbackSurfaceInventoryRows({
  includeDomainPatterns = true,
  includeAggregatePatterns = true,
  includeDisabledAggregate = true,
} = {}) {
  return [
    ...(includeDomainPatterns ? buildDomainPatternInventoryRows() : []),
    ...(includeAggregatePatterns ? buildAggregatePatternInventoryRows({ includeDisabledAggregate }) : []),
  ];
}

export function buildSitePullFeedbackSurfaceInventory(options = {}) {
  const rows = listSitePullFeedbackSurfaceInventoryRows(options);
  return {
    version: SITE_PULL_FEEDBACK_SURFACE_INVENTORY_VERSION,
    rows,
    summary: buildInventorySummary(rows),
  };
}

function inventoryIssue(row, code, message) {
  return {
    id: row?.id || null,
    kind: row?.kind || null,
    code,
    message,
  };
}

function auditDomainRow(row) {
  const issues = [];
  asArray(row.surfaces).forEach((surface) => {
    if (!KNOWN_DOMAIN_SURFACES.has(surface)) {
      issues.push(inventoryIssue(row, 'unknown_domain_surface', `Unknown domain surface: ${surface}`));
    }
  });
  if (!row.feedbackSpecPresent) {
    issues.push(inventoryIssue(row, 'missing_feedback_spec', 'Domain patterns need a feedback spec row.'));
  }
  if (row.badgeEligible && row.role === SUPPORTING_EVIDENCE) {
    issues.push(inventoryIssue(row, 'supporting_evidence_badge_surface', 'Supporting evidence must not render as a standalone badge.'));
  }
  if (row.badgeEligible && row.feedbackScope !== DOMAIN) {
    issues.push(inventoryIssue(row, 'non_domain_badge_surface', 'Non-domain feedback must not render as a domain badge.'));
  }
  if (row.badgeEligible && row.slot !== 'badge') {
    issues.push(inventoryIssue(row, 'badge_surface_slot_mismatch', 'Badge-eligible feedback must use the badge presentation slot.'));
  }
  if (row.userVisible && !row.userValue) {
    issues.push(inventoryIssue(row, 'visible_feedback_without_user_value', 'Visible feedback needs a user-value explanation.'));
  }
  if (row.userVisible && row.consumerIds.length === 0) {
    issues.push(inventoryIssue(row, 'visible_feedback_without_consumer', 'Visible feedback needs at least one consumer contract.'));
  }
  if (row.badgeEligible && (!row.group || row.rank === null)) {
    issues.push(inventoryIssue(row, 'badge_feedback_without_presentation_rank', 'Badge feedback needs a presentation group and rank.'));
  }
  if (row.role === USER_FEEDBACK && !row.userVisible) {
    issues.push(inventoryIssue(row, 'user_feedback_without_user_surface', 'User feedback needs badge, detail, or recap visibility.'));
  }
  return issues;
}

function auditAggregateRow(row) {
  const issues = [];
  asArray(row.outputSurfaces).forEach((surface) => {
    if (!KNOWN_AGGREGATE_SURFACES.has(surface)) {
      issues.push(inventoryIssue(row, 'unknown_aggregate_surface', `Unknown aggregate surface: ${surface}`));
    }
  });
  if (!row.enabled && row.sitesOverviewEligible) {
    issues.push(inventoryIssue(
      row,
      'disabled_aggregate_sites_overview_surface',
      'Disabled aggregate patterns must not target the Rules overview surface.',
    ));
  }
  if (row.enabled && row.sitesOverviewEligible && !row.feedbackBuilderReady) {
    issues.push(inventoryIssue(
      row,
      'aggregate_sites_overview_without_builder',
      'Rules overview aggregate feedback needs a concrete feedback builder.',
    ));
  }
  if (row.userVisible && !row.userValue) {
    issues.push(inventoryIssue(row, 'visible_aggregate_without_user_value', 'Visible aggregate feedback needs a user-value explanation.'));
  }
  if (row.userVisible && !row.recommendationFamily) {
    issues.push(inventoryIssue(
      row,
      'visible_aggregate_without_recommendation_family',
      'Visible aggregate feedback needs a recommendation family.',
    ));
  }
  if (row.userVisible && row.consumerIds.length === 0) {
    issues.push(inventoryIssue(
      row,
      'visible_aggregate_without_consumer',
      'Visible aggregate feedback needs at least one consumer contract.',
    ));
  }
  return issues;
}

function findFeedbackSpecsWithoutDefinitions() {
  const definitionIds = new Set(Object.keys(SITE_PULL_PATTERN_DEFINITIONS));
  return Object.keys(SITE_PULL_PATTERN_FEEDBACK_SPEC)
    .filter((id) => !definitionIds.has(id))
    .map((id) => inventoryIssue(
      { id, kind: DOMAIN_PATTERN },
      'feedback_spec_without_definition',
      'Feedback specs need a matching pattern definition.',
    ));
}

export function buildSitePullFeedbackSurfaceInventoryAudit(options = {}) {
  const inventory = buildSitePullFeedbackSurfaceInventory(options);
  const blockingIssues = [
    ...findFeedbackSpecsWithoutDefinitions(),
    ...inventory.rows.flatMap((row) => (
      row.kind === DOMAIN_PATTERN ? auditDomainRow(row) : auditAggregateRow(row)
    )),
  ];

  return {
    version: SITE_PULL_FEEDBACK_SURFACE_INVENTORY_AUDIT_VERSION,
    inventoryVersion: SITE_PULL_FEEDBACK_SURFACE_INVENTORY_VERSION,
    ok: blockingIssues.length === 0,
    rowCount: inventory.rows.length,
    summary: inventory.summary,
    blockingIssues,
  };
}
