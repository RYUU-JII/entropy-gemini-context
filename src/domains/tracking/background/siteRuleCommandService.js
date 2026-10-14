import { normalizeDomain } from '../../../lib/domain.js';
import {
  normalizeProtectionPresetAssignments,
  normalizeProtectionPresetId,
} from '../../protection/catalog/presetContract.js';
import { buildResolvedProtectionPresetCatalog } from '../../protection/catalog/presetCatalog.js';
import {
  assessSiteRuleAdmission,
  SITE_RULE_ADMISSION_STATUS,
} from '../../settings/config/siteRuleAdmissionPolicy.js';
import { completeSettingsOwnerAcknowledgement } from '../../settings/config/settingsCommitAcknowledgement.js';
import { resolveSiteGoalChange } from '../../settings/config/siteGoalPolicy.js';
import { buildFirstUsePolicyPatch, FIRST_USE_POLICY_KEYS } from '../../settings/config/firstUsePolicy.js';

function createSiteRuleCommandError(code, extra = {}) {
  const message = typeof code === 'string' && code.trim()
    ? code.trim()
    : 'SITE_RULE_COMMAND_FAILED';
  const error = new Error(message);
  error.code = message;
  Object.assign(error, extra);
  return error;
}

function resolveSiteRuleType(value) {
  if (value === 'blocked' || value === 'allowed') return value;
  throw createSiteRuleCommandError('INVALID_SITE_RULE_TYPE', { type: value });
}

function resolveGoalMinutes(value) {
  const minutes = Math.floor(Number(value));
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function hasOwnProperty(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const SITE_RULE_LIST_ACK_KEYS = Object.freeze([
  'blockedUrls',
  'allowedUrls',
  'siteRuleTimeline',
]);

const SITE_RULE_BLOCKED_METADATA_ACK_KEYS = Object.freeze([
  'siteGoals',
  'siteGoalMeta',
  'protectionPresetAssignments',
]);

function collectSiteRuleRequiredCommittedKeys(preparedItems) {
  const attemptedKeys = new Set(Object.keys(isPlainObject(preparedItems) ? preparedItems : {}));
  if (
    attemptedKeys.has('blockedUrls')
    || attemptedKeys.has('allowedUrls')
    || attemptedKeys.has('siteRuleTimeline')
  ) {
    attemptedKeys.add('siteRuleTimeline');
  }
  if (attemptedKeys.has('siteGoals') || attemptedKeys.has('siteGoalMeta')) {
    attemptedKeys.add('siteGoalMeta');
  }
  return Array.from(attemptedKeys);
}

function areValuesEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      if (!areValuesEqual(a[index], b[index])) return false;
    }
    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let index = 0; index < aKeys.length; index += 1) {
      const key = aKeys[index];
      if (key !== bKeys[index]) return false;
      if (!areValuesEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

function appendDomain(list = [], domain) {
  const next = Array.isArray(list) ? [...list] : [];
  if (!next.includes(domain)) {
    next.push(domain);
  }
  return next;
}

function removeDomain(list = [], domain) {
  return Array.isArray(list)
    ? list.filter((entry) => entry !== domain)
    : [];
}

function omitDomainEntry(map, domain) {
  const base = isPlainObject(map) ? map : {};
  if (!domain || !hasOwnProperty(base, domain)) return base;
  const next = { ...base };
  delete next[domain];
  return next;
}

export function createSiteRuleCommandService({
  settingsService,
} = {}) {
  if (!settingsService || typeof settingsService.commitSettingsMutation !== 'function') {
    throw new Error('SITE_RULE_COMMAND_SETTINGS_SERVICE_REQUIRED');
  }

  async function applySiteRuleChange({
    actionReason,
    acknowledgementKeys = [],
    prepare,
    sender,
  }) {
    let settingsSnapshot = null;
    let preparedItems = null;
    const result = await settingsService.commitSettingsMutation({
      actionReason,
      prepare: (snapshot) => {
        settingsSnapshot = snapshot;
        preparedItems = prepare(snapshot);
        return preparedItems;
      },
      sender,
      emitSettingsUpdated: false,
      invalidateFilterCache: true,
      refreshForBroadcast: false,
      reportBroadcastAsRefresh: false,
    });
    const responseItems = completeSettingsOwnerAcknowledgement({
      committedItems: result?.committedItems,
      requiredCommittedKeys: collectSiteRuleRequiredCommittedKeys(preparedItems),
      settingsSnapshot,
      acknowledgementKeys,
    });
    return {
      ...result,
      items: responseItems,
    };
  }

  async function upsertSiteRule(input = {}) {
    const {
      domain,
      type = 'blocked',
      goalMinutes = null,
      confirmExactMove = false,
      firstUseRecording,
      sender = null,
      actionReason = 'upsert_site_rule',
    } = input && typeof input === 'object' ? input : {};
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      throw createSiteRuleCommandError('INVALID_DOMAIN');
    }

    const resolvedType = resolveSiteRuleType(type);
    const resolvedGoalMinutes = resolveGoalMinutes(goalMinutes);
    const hasFirstUseChoice = firstUseRecording !== undefined;
    let firstUseResult;
    if (hasFirstUseChoice && (typeof firstUseRecording !== 'boolean' || resolvedType !== 'blocked' || goalMinutes !== null)) {
      throw createSiteRuleCommandError('FIRST_USE_SITE_INTENT_INVALID');
    }

    const result = await applySiteRuleChange({
      actionReason,
      acknowledgementKeys: [...(hasFirstUseChoice ? FIRST_USE_POLICY_KEYS : []), ...(confirmExactMove
        ? [...SITE_RULE_LIST_ACK_KEYS, ...SITE_RULE_BLOCKED_METADATA_ACK_KEYS]
        : [
          resolvedType === 'allowed' ? 'allowedUrls' : 'blockedUrls',
          'siteRuleTimeline',
          ...(resolvedType !== 'allowed' && resolvedGoalMinutes !== null
            ? ['siteGoals', 'siteGoalMeta']
            : []),
        ])],
      prepare: (settingsCache) => {
        const nextItems = hasFirstUseChoice ? buildFirstUsePolicyPatch(settingsCache, firstUseRecording) : {};
        const blockedUrls = Array.isArray(settingsCache.blockedUrls) ? settingsCache.blockedUrls : [];
        const allowedUrls = Array.isArray(settingsCache.allowedUrls) ? settingsCache.allowedUrls : [];
        const siteGoals = isPlainObject(settingsCache.siteGoals) ? settingsCache.siteGoals : {};
        const admission = assessSiteRuleAdmission({
          domain: normalizedDomain,
          type: resolvedType,
          blockedUrls,
          allowedUrls,
        });
        const exactSameSide = (
          admission.status === SITE_RULE_ADMISSION_STATUS.REDUNDANT_SAME_SIDE
          && admission.existingDomain === normalizedDomain
        );
        if (hasFirstUseChoice) firstUseResult = exactSameSide ? 'already_protected' : 'registered';
        const confirmedExactMove = (
          admission.status === SITE_RULE_ADMISSION_STATUS.MOVE_EXACT_OPPOSITE
          && confirmExactMove === true
        );
        if (
          admission.status === SITE_RULE_ADMISSION_STATUS.OPPOSITE_CONFLICT
          || (
            admission.status === SITE_RULE_ADMISSION_STATUS.MOVE_EXACT_OPPOSITE
            && !confirmedExactMove
          )
        ) {
          throw createSiteRuleCommandError('SITE_RULE_ADMISSION_REJECTED', { admission });
        }
        if (
          admission.status === SITE_RULE_ADMISSION_STATUS.REDUNDANT_SAME_SIDE
          && !exactSameSide
        ) {
          if (hasFirstUseChoice) throw createSiteRuleCommandError('SITE_RULE_ADMISSION_REJECTED', { admission });
          return {};
        }

        if (resolvedType === 'blocked') {
          const nextBlockedUrls = appendDomain(blockedUrls, normalizedDomain);
          if (nextBlockedUrls.length !== blockedUrls.length) {
            nextItems.blockedUrls = nextBlockedUrls;
          }
          const nextAllowedUrls = removeDomain(allowedUrls, normalizedDomain);
          if (nextAllowedUrls.length !== allowedUrls.length) {
            nextItems.allowedUrls = nextAllowedUrls;
          }

          if (resolvedGoalMinutes !== null) {
            const currentMinutes = hasOwnProperty(siteGoals, normalizedDomain) ? siteGoals[normalizedDomain] : 0;
            const { appliedMinutes } = resolveSiteGoalChange({
              currentMinutes,
              requestedMinutes: resolvedGoalMinutes,
            });
            if (currentMinutes !== appliedMinutes) {
              nextItems.siteGoals = {
                ...siteGoals,
                [normalizedDomain]: appliedMinutes,
              };
            }
          }
        } else {
          const nextAllowedUrls = appendDomain(allowedUrls, normalizedDomain);
          if (nextAllowedUrls.length !== allowedUrls.length) {
            nextItems.allowedUrls = nextAllowedUrls;
          }
          const nextBlockedUrls = removeDomain(blockedUrls, normalizedDomain);
          if (nextBlockedUrls.length !== blockedUrls.length) {
            nextItems.blockedUrls = nextBlockedUrls;
          }
          const nextSiteGoals = omitDomainEntry(siteGoals, normalizedDomain);
          if (nextSiteGoals !== siteGoals) {
            nextItems.siteGoals = nextSiteGoals;
          }
          const currentAssignments = normalizeProtectionPresetAssignments(
            settingsCache.protectionPresetAssignments,
          );
          const nextSitePresetIds = omitDomainEntry(
            currentAssignments.sitePresetIds,
            normalizedDomain,
          );
          const nextAssignments = normalizeProtectionPresetAssignments({
            ...currentAssignments,
            sitePresetIds: nextSitePresetIds,
          });
          if (!areValuesEqual(currentAssignments, nextAssignments)) {
            nextItems.protectionPresetAssignments = nextAssignments;
          }
        }
        return nextItems;
      },
      sender,
    });

    return {
      ...result,
      domain: normalizedDomain,
      type: resolvedType,
      goalMinutes: resolvedGoalMinutes,
      ...(hasFirstUseChoice ? { firstUseResult } : {}),
    };
  }

  async function completeFirstUse({ sender = null } = {}) {
    return applySiteRuleChange({
      actionReason: 'complete_first_use_without_recording',
      acknowledgementKeys: FIRST_USE_POLICY_KEYS,
      prepare: (snapshot) => buildFirstUsePolicyPatch(snapshot, false),
      sender,
    });
  }

  async function removeSiteRule(input = {}) {
    const {
      domain,
      type = null,
      sender = null,
      actionReason = 'remove_site_rule',
    } = input && typeof input === 'object' ? input : {};
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      throw createSiteRuleCommandError('INVALID_DOMAIN');
    }

    if (type !== null && type !== 'blocked' && type !== 'allowed') {
      throw createSiteRuleCommandError('INVALID_SITE_RULE_TYPE', { type });
    }
    const resolvedType = type || 'all';

    const result = await applySiteRuleChange({
      actionReason,
      acknowledgementKeys: [
        ...(resolvedType !== 'allowed'
          ? ['blockedUrls', ...SITE_RULE_BLOCKED_METADATA_ACK_KEYS]
          : []),
        ...(resolvedType !== 'blocked' ? ['allowedUrls'] : []),
        'siteRuleTimeline',
      ],
      prepare: (settingsCache) => {
        const nextItems = {};

        if (resolvedType !== 'allowed') {
          const blockedUrls = Array.isArray(settingsCache.blockedUrls) ? settingsCache.blockedUrls : [];
          const nextBlockedUrls = removeDomain(blockedUrls, normalizedDomain);
          if (nextBlockedUrls.length !== blockedUrls.length) {
            nextItems.blockedUrls = nextBlockedUrls;
          }

          const siteGoals = isPlainObject(settingsCache.siteGoals) ? settingsCache.siteGoals : {};
          const nextSiteGoals = omitDomainEntry(siteGoals, normalizedDomain);
          if (nextSiteGoals !== siteGoals) {
            nextItems.siteGoals = nextSiteGoals;
          }

          const currentAssignments = normalizeProtectionPresetAssignments(
            settingsCache.protectionPresetAssignments,
          );
          const nextSitePresetIds = omitDomainEntry(currentAssignments.sitePresetIds, normalizedDomain);
          const nextAssignments = normalizeProtectionPresetAssignments({
            ...currentAssignments,
            sitePresetIds: nextSitePresetIds,
          });
          if (!areValuesEqual(currentAssignments, nextAssignments)) {
            nextItems.protectionPresetAssignments = nextAssignments;
          }
        }

        if (resolvedType !== 'blocked') {
          const allowedUrls = Array.isArray(settingsCache.allowedUrls) ? settingsCache.allowedUrls : [];
          const nextAllowedUrls = removeDomain(allowedUrls, normalizedDomain);
          if (nextAllowedUrls.length !== allowedUrls.length) {
            nextItems.allowedUrls = nextAllowedUrls;
          }
        }
        return nextItems;
      },
      sender,
    });

    return {
      ...result,
      domain: normalizedDomain,
      type: resolvedType,
    };
  }

  async function updateSiteRule(input = {}) {
    const source = input && typeof input === 'object' ? input : {};
    const unsupportedField = Object.keys(source).find((key) => ![
      'domain',
      'sender',
      'actionReason',
      'goalMinutes',
      'presetId',
    ].includes(key));
    if (unsupportedField) {
      throw createSiteRuleCommandError('UPDATE_SITE_RULE_INPUT_FIELD_UNSUPPORTED', {
        field: unsupportedField,
      });
    }
    const {
      domain,
      sender = null,
      actionReason = 'update_site_rule',
    } = source;
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      throw createSiteRuleCommandError('INVALID_DOMAIN');
    }

    const result = await applySiteRuleChange({
      actionReason,
      acknowledgementKeys: [
        ...(hasOwnProperty(source, 'goalMinutes') ? ['siteGoals', 'siteGoalMeta'] : []),
        ...(hasOwnProperty(source, 'presetId') ? ['protectionPresetAssignments'] : []),
      ],
      prepare: (settingsCache) => {
        const nextItems = {};
        const updatesBlockedMetadata = (
          hasOwnProperty(source, 'goalMinutes')
          || hasOwnProperty(source, 'presetId')
        );
        if (updatesBlockedMetadata) {
          const blockedUrls = Array.isArray(settingsCache.blockedUrls)
            ? settingsCache.blockedUrls
            : [];
          if (!blockedUrls.includes(normalizedDomain)) {
            throw createSiteRuleCommandError('SITE_RULE_BLOCKED_TARGET_REQUIRED', {
              domain: normalizedDomain,
            });
          }
        }

        if (hasOwnProperty(source, 'goalMinutes')) {
          const siteGoals = isPlainObject(settingsCache.siteGoals) ? settingsCache.siteGoals : {};
          const resolvedGoalMinutes = resolveGoalMinutes(source.goalMinutes);
          if (resolvedGoalMinutes !== null) {
            // Policy is evaluated inside the mutation lane against the latest
            // committed goal; a Dashboard preview is never write authority.
            const currentMinutes = hasOwnProperty(siteGoals, normalizedDomain) ? siteGoals[normalizedDomain] : 0;
            const { appliedMinutes } = resolveSiteGoalChange({
              currentMinutes,
              requestedMinutes: resolvedGoalMinutes,
            });
            if (currentMinutes !== appliedMinutes) {
              nextItems.siteGoals = {
                ...siteGoals,
                [normalizedDomain]: appliedMinutes,
              };
            }
          } else {
            const nextSiteGoals = omitDomainEntry(siteGoals, normalizedDomain);
            if (nextSiteGoals !== siteGoals) {
              nextItems.siteGoals = nextSiteGoals;
            }
          }
        }

        if (hasOwnProperty(source, 'presetId')) {
          const currentAssignments = normalizeProtectionPresetAssignments(
            settingsCache.protectionPresetAssignments,
          );
          const nextSitePresetIds = {
            ...(currentAssignments.sitePresetIds || {}),
          };
          const resolvedPresetId = normalizeProtectionPresetId(source.presetId, '');
          if (resolvedPresetId) {
            const resolvedCatalog = buildResolvedProtectionPresetCatalog(
              settingsCache.protectionPresetCatalog,
            );
            if (!resolvedCatalog[resolvedPresetId]) {
              throw createSiteRuleCommandError('PROTECTION_PRESET_NOT_FOUND', {
                presetId: resolvedPresetId,
              });
            }
            nextSitePresetIds[normalizedDomain] = resolvedPresetId;
          } else {
            delete nextSitePresetIds[normalizedDomain];
          }
          const nextAssignments = normalizeProtectionPresetAssignments({
            ...currentAssignments,
            sitePresetIds: nextSitePresetIds,
          });
          if (!areValuesEqual(currentAssignments, nextAssignments)) {
            nextItems.protectionPresetAssignments = nextAssignments;
          }
        }
        return nextItems;
      },
      sender,
    });

    return {
      ...result,
      domain: normalizedDomain,
    };
  }

  return {
    completeFirstUse,
    removeSiteRule,
    updateSiteRule,
    upsertSiteRule,
  };
}

export default createSiteRuleCommandService;
