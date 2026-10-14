import { isKnownDomainClassId } from './classCatalog.js';

export const DOMAIN_CLASS_RULES = Object.freeze([
  Object.freeze({
    id: 'blocked_by_mode',
    classId: 'blocked',
    priority: 400,
    specificity: 300,
    match: (flags) => flags?.isBlockedDomain === true,
  }),
  Object.freeze({
    id: 'allowed_listed',
    classId: 'allowed',
    priority: 300,
    specificity: 200,
    match: (flags) => flags?.isBlockedDomain !== true && flags?.isAllowedListed === true,
  }),
  Object.freeze({
    id: 'managed_listed',
    classId: 'managed',
    priority: 200,
    specificity: 100,
    match: (flags) => flags?.isBlockedDomain !== true && flags?.isBlockedListed === true,
  }),
  Object.freeze({
    id: 'default_unmanaged',
    classId: 'unmanaged',
    priority: 0,
    specificity: 0,
    match: () => true,
  }),
]);

function compareRuleRank(a, b) {
  const priorityDelta = Number(b.priority || 0) - Number(a.priority || 0);
  if (priorityDelta !== 0) return priorityDelta;

  const specificityDelta = Number(b.specificity || 0) - Number(a.specificity || 0);
  if (specificityDelta !== 0) return specificityDelta;

  return String(a.id || '').localeCompare(String(b.id || ''));
}

export function resolveDomainClassByRules(flags, { rules = DOMAIN_CLASS_RULES } = {}) {
  const matched = (Array.isArray(rules) ? rules : [])
    .filter((rule) => typeof rule?.match === 'function' && rule.match(flags))
    .sort(compareRuleRank);

  if (matched.length === 0) {
    return {
      ok: false,
      domainClassId: null,
      matchedRuleId: null,
      error: 'NO_MATCHING_SCOPE_RULE',
    };
  }

  const selectedRule = matched[0];
  const topPriority = Number(selectedRule?.priority || 0);
  const topSpecificity = Number(selectedRule?.specificity || 0);
  const tieRules = matched.filter((rule) => (
    Number(rule?.priority || 0) === topPriority
    && Number(rule?.specificity || 0) === topSpecificity
  ));

  // If two or more rules are perfectly tied at top rank, fail-closed.
  if (tieRules.length > 1) {
    return {
      ok: false,
      domainClassId: null,
      matchedRuleId: null,
      error: 'SCOPE_RULE_TIE',
      tieRuleIds: tieRules.map((rule) => rule.id),
      rankedCandidates: matched.map((rule) => ({
        id: rule.id,
        classId: rule.classId,
        priority: Number(rule.priority || 0),
        specificity: Number(rule.specificity || 0),
      })),
    };
  }

  if (!isKnownDomainClassId(selectedRule.classId)) {
    return {
      ok: false,
      domainClassId: null,
      matchedRuleId: selectedRule.id || null,
      error: 'UNKNOWN_DOMAIN_CLASS_ID',
    };
  }

  return {
    ok: true,
    domainClassId: selectedRule.classId,
    matchedRuleId: selectedRule.id,
    rankedCandidates: matched.map((rule) => ({
      id: rule.id,
      classId: rule.classId,
      priority: Number(rule.priority || 0),
      specificity: Number(rule.specificity || 0),
    })),
  };
}
