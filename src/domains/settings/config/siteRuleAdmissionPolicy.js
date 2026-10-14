import { normalizeDomain } from '../../../lib/domain.js';
import { isSiteRuleMatch } from '../../../lib/siteIdentity.js';

function normalizeRuleList(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeDomain(value))
        .filter(Boolean),
    ),
  );
}

function isMutualSiteMatch(left, right) {
  return isSiteRuleMatch(left, right) && isSiteRuleMatch(right, left);
}

export const SITE_RULE_ADMISSION_STATUS = Object.freeze({
  ALLOW: 'allow',
  REDUNDANT_SAME_SIDE: 'redundant_same_side',
  MOVE_EXACT_OPPOSITE: 'move_exact_opposite',
  OPPOSITE_CONFLICT: 'opposite_conflict',
});

export const SITE_RULE_OPPOSITE_CONFLICT_KIND = Object.freeze({
  ALIAS: 'alias_conflict',
  COVERED_BY_OPPOSITE_RULE: 'covered_by_opposite_rule',
  CONTAINS_OPPOSITE_RULE: 'contains_opposite_rule',
});

function buildAdmissionMessageDescriptor(status, {
  domain = '',
  type = 'blocked',
  existingDomain = '',
  conflictKind = '',
  oppositeType = '',
} = {}) {
  if (status === SITE_RULE_ADMISSION_STATUS.REDUNDANT_SAME_SIDE) {
    return {
      key: 'admission.redundant_same_side',
      params: {
        domain,
        type,
        existingDomain,
      },
    };
  }

  if (status === SITE_RULE_ADMISSION_STATUS.MOVE_EXACT_OPPOSITE) {
    return {
      key: 'admission.move_exact_opposite',
      params: {
        domain,
        type,
        oppositeType,
      },
    };
  }

  if (status === SITE_RULE_ADMISSION_STATUS.OPPOSITE_CONFLICT) {
    if (conflictKind === SITE_RULE_OPPOSITE_CONFLICT_KIND.ALIAS) {
      return {
        key: 'admission.conflict_alias',
        params: {
          domain,
          existingDomain,
        },
      };
    }
    if (conflictKind === SITE_RULE_OPPOSITE_CONFLICT_KIND.COVERED_BY_OPPOSITE_RULE) {
      return {
        key: 'admission.conflict_covered_by_opposite',
        params: {
          domain,
          existingDomain,
        },
      };
    }
    if (conflictKind === SITE_RULE_OPPOSITE_CONFLICT_KIND.CONTAINS_OPPOSITE_RULE) {
      return {
        key: 'admission.conflict_contains_opposite',
        params: {
          domain,
          existingDomain,
        },
      };
    }
  }

  return {
    key: '',
    params: {},
  };
}

export function assessSiteRuleAdmission({
  domain,
  type = 'blocked',
  blockedUrls = [],
  allowedUrls = [],
} = {}) {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedType = type === 'allowed' ? 'allowed' : 'blocked';
  const sameSideRules = normalizeRuleList(
    normalizedType === 'blocked' ? blockedUrls : allowedUrls,
  );
  const oppositeType = normalizedType === 'blocked' ? 'allowed' : 'blocked';
  const oppositeSideRules = normalizeRuleList(
    normalizedType === 'blocked' ? allowedUrls : blockedUrls,
  );

  if (!normalizedDomain) {
    return {
      status: SITE_RULE_ADMISSION_STATUS.OPPOSITE_CONFLICT,
      conflictKind: SITE_RULE_OPPOSITE_CONFLICT_KIND.COVERED_BY_OPPOSITE_RULE,
      normalizedDomain: '',
      type: normalizedType,
      existingDomain: '',
      existingType: oppositeType,
      messageKey: 'errors.invalid_domain',
      messageParams: {},
      isValid: false,
    };
  }

  const sameSideCoveringRule = sameSideRules.find((existingDomain) => (
    isSiteRuleMatch(normalizedDomain, existingDomain)
  ));
  if (sameSideCoveringRule) {
    const message = buildAdmissionMessageDescriptor(SITE_RULE_ADMISSION_STATUS.REDUNDANT_SAME_SIDE, {
      domain: normalizedDomain,
      type: normalizedType,
      existingDomain: sameSideCoveringRule,
    });
    return {
      status: SITE_RULE_ADMISSION_STATUS.REDUNDANT_SAME_SIDE,
      normalizedDomain,
      type: normalizedType,
      existingDomain: sameSideCoveringRule,
      existingType: normalizedType,
      messageKey: message.key,
      messageParams: message.params,
      isValid: true,
    };
  }

  const exactOppositeRule = oppositeSideRules.find((existingDomain) => existingDomain === normalizedDomain);
  if (exactOppositeRule) {
    const message = buildAdmissionMessageDescriptor(SITE_RULE_ADMISSION_STATUS.MOVE_EXACT_OPPOSITE, {
      domain: normalizedDomain,
      type: normalizedType,
      oppositeType,
    });
    return {
      status: SITE_RULE_ADMISSION_STATUS.MOVE_EXACT_OPPOSITE,
      normalizedDomain,
      type: normalizedType,
      existingDomain: exactOppositeRule,
      existingType: oppositeType,
      messageKey: message.key,
      messageParams: message.params,
      isValid: true,
    };
  }

  const aliasConflictRule = oppositeSideRules.find((existingDomain) => (
    existingDomain !== normalizedDomain
    && isMutualSiteMatch(normalizedDomain, existingDomain)
  ));
  if (aliasConflictRule) {
    const message = buildAdmissionMessageDescriptor(SITE_RULE_ADMISSION_STATUS.OPPOSITE_CONFLICT, {
      domain: normalizedDomain,
      type: normalizedType,
      existingDomain: aliasConflictRule,
      conflictKind: SITE_RULE_OPPOSITE_CONFLICT_KIND.ALIAS,
    });
    return {
      status: SITE_RULE_ADMISSION_STATUS.OPPOSITE_CONFLICT,
      conflictKind: SITE_RULE_OPPOSITE_CONFLICT_KIND.ALIAS,
      normalizedDomain,
      type: normalizedType,
      existingDomain: aliasConflictRule,
      existingType: oppositeType,
      messageKey: message.key,
      messageParams: message.params,
      isValid: true,
    };
  }

  const broaderOppositeRule = oppositeSideRules.find((existingDomain) => (
    isSiteRuleMatch(normalizedDomain, existingDomain)
  ));
  if (broaderOppositeRule) {
    const message = buildAdmissionMessageDescriptor(SITE_RULE_ADMISSION_STATUS.OPPOSITE_CONFLICT, {
      domain: normalizedDomain,
      type: normalizedType,
      existingDomain: broaderOppositeRule,
      conflictKind: SITE_RULE_OPPOSITE_CONFLICT_KIND.COVERED_BY_OPPOSITE_RULE,
    });
    return {
      status: SITE_RULE_ADMISSION_STATUS.OPPOSITE_CONFLICT,
      conflictKind: SITE_RULE_OPPOSITE_CONFLICT_KIND.COVERED_BY_OPPOSITE_RULE,
      normalizedDomain,
      type: normalizedType,
      existingDomain: broaderOppositeRule,
      existingType: oppositeType,
      messageKey: message.key,
      messageParams: message.params,
      isValid: true,
    };
  }

  const narrowerOppositeRule = oppositeSideRules.find((existingDomain) => (
    isSiteRuleMatch(existingDomain, normalizedDomain)
  ));
  if (narrowerOppositeRule) {
    const message = buildAdmissionMessageDescriptor(SITE_RULE_ADMISSION_STATUS.OPPOSITE_CONFLICT, {
      domain: normalizedDomain,
      type: normalizedType,
      existingDomain: narrowerOppositeRule,
      conflictKind: SITE_RULE_OPPOSITE_CONFLICT_KIND.CONTAINS_OPPOSITE_RULE,
    });
    return {
      status: SITE_RULE_ADMISSION_STATUS.OPPOSITE_CONFLICT,
      conflictKind: SITE_RULE_OPPOSITE_CONFLICT_KIND.CONTAINS_OPPOSITE_RULE,
      normalizedDomain,
      type: normalizedType,
      existingDomain: narrowerOppositeRule,
      existingType: oppositeType,
      messageKey: message.key,
      messageParams: message.params,
      isValid: true,
    };
  }

  return {
    status: SITE_RULE_ADMISSION_STATUS.ALLOW,
    normalizedDomain,
    type: normalizedType,
    existingDomain: '',
    existingType: '',
    messageKey: '',
    messageParams: {},
    isValid: true,
  };
}
