import { SOCIAL_METRIC_ATTRS } from '../../../core/constants.js';
import {
  SOCIAL_METRIC_GROUPS,
  getMetricGroupForFilterKey,
} from '../contracts/socialMetricContracts.js';

const SHARED_ATTRIBUTE_NAMES = Object.freeze([
  'aria-label',
  'data-testid',
  'href',
]);

export const SOCIAL_METRIC_MUTATION_GROUP_RULES = Object.freeze({
  engagement: Object.freeze({
    mutationKinds: Object.freeze(['childList', 'characterData']),
    attributeNames: Object.freeze([
      ...SHARED_ATTRIBUTE_NAMES,
      SOCIAL_METRIC_ATTRS.ENGAGEMENT,
      SOCIAL_METRIC_ATTRS.INSTAGRAM_COLLAPSE,
    ]),
  }),
  exposure: Object.freeze({
    mutationKinds: Object.freeze(['childList', 'characterData']),
    attributeNames: Object.freeze([
      ...SHARED_ATTRIBUTE_NAMES,
      SOCIAL_METRIC_ATTRS.EXPOSURE,
      SOCIAL_METRIC_ATTRS.INSTAGRAM_COLLAPSE,
    ]),
  }),
});

function addMutationSignal(kindSet, attributeNameSet, mutation) {
  const kind = String(mutation?.type || '').trim();
  if (kind === 'childList' || kind === 'characterData') {
    kindSet.add(kind);
    return;
  }
  if (kind !== 'attributes') return;

  kindSet.add(kind);
  const attributeName = String(mutation?.attributeName || '').trim();
  if (attributeName) attributeNameSet.add(attributeName);
}

export function summarizeSocialMetricMutationPayload(payload = {}) {
  const mutationKinds = new Set();
  const attributeNames = new Set();
  const mutations = Array.isArray(payload?.mutations) ? payload.mutations : [];

  if (mutations.length > 0) {
    mutations.forEach((mutation) => {
      addMutationSignal(mutationKinds, attributeNames, mutation);
    });
  } else {
    if (
      (Array.isArray(payload?.addedNodes) && payload.addedNodes.length > 0)
      || (Array.isArray(payload?.removedNodes) && payload.removedNodes.length > 0)
    ) {
      mutationKinds.add('childList');
    }
    if (Array.isArray(payload?.textNodes) && payload.textNodes.length > 0) {
      mutationKinds.add('characterData');
    }
    if (Array.isArray(payload?.attributeTargets) && payload.attributeTargets.length > 0) {
      mutationKinds.add('attributes');
    }
  }

  return Object.freeze({
    mutationKinds: Object.freeze(Array.from(mutationKinds)),
    attributeNames: Object.freeze(Array.from(attributeNames)),
  });
}

function normalizeActiveGroups(activeGroups) {
  if (!Array.isArray(activeGroups) || activeGroups.length === 0) return [];
  const contractsByGroup = new Map();

  activeGroups.forEach((entry) => {
    const group = entry?.group;
    if (!SOCIAL_METRIC_GROUPS.includes(group)) return;
    const filterKeys = Array.isArray(entry?.filterKeys) ? entry.filterKeys : [];
    const validFilterKeys = filterKeys.filter((key) => (
      getMetricGroupForFilterKey(key) === group
    ));
    if (validFilterKeys.length === 0) return;

    const current = contractsByGroup.get(group) || {
      filterKeys: new Set(),
      attributeNames: new Set(),
    };
    validFilterKeys.forEach((key) => current.filterKeys.add(key));
    const attributeNames = Array.isArray(entry?.attributeNames) ? entry.attributeNames : [];
    attributeNames.forEach((attributeName) => {
      if (typeof attributeName === 'string' && attributeName.trim()) {
        current.attributeNames.add(attributeName.trim());
      }
    });
    contractsByGroup.set(group, current);
  });

  return SOCIAL_METRIC_GROUPS.flatMap((group) => {
    const contract = contractsByGroup.get(group);
    return contract
      ? [{
        group,
        filterKeys: Array.from(contract.filterKeys),
        attributeNames: Array.from(contract.attributeNames),
      }]
      : [];
  });
}

function matchMutationRule(signals, rule, activeAttributeNames = []) {
  const allowedAttributeNames = new Set([
    ...rule.attributeNames,
    ...activeAttributeNames,
  ]);
  const matchedMutationKinds = signals.mutationKinds.filter((kind) => (
    kind !== 'attributes' && rule.mutationKinds.includes(kind)
  ));
  const matchedAttributeNames = signals.attributeNames.filter((attributeName) => (
    allowedAttributeNames.has(attributeName)
  ));
  if (matchedAttributeNames.length > 0) matchedMutationKinds.push('attributes');

  return {
    mutationKinds: Array.from(new Set(matchedMutationKinds)),
    attributeNames: matchedAttributeNames,
  };
}

function createRootRelevanceError(cause, group, filterKeys) {
  const error = new Error('SOCIAL_METRIC_MUTATION_ROOT_RELEVANCE_FAILED', { cause });
  error.code = 'SOCIAL_METRIC_MUTATION_ROOT_RELEVANCE_FAILED';
  error.details = Object.freeze({
    group,
    filterKeys: Object.freeze([...filterKeys]),
  });
  return error;
}

export function routeSocialMetricMutationGroups({
  payload = {},
  activeGroups = [],
  roots = [],
  isRootRelevant,
  recordDisposition = null,
} = {}) {
  if (typeof isRootRelevant !== 'function') {
    throw new Error('SOCIAL_METRIC_MUTATION_ROOT_RELEVANCE_REQUIRED');
  }
  if (recordDisposition !== null && typeof recordDisposition !== 'function') {
    throw new Error('SOCIAL_METRIC_MUTATION_DISPOSITION_RECORDER_INVALID');
  }

  const signals = summarizeSocialMetricMutationPayload(payload);
  const normalizedGroups = normalizeActiveGroups(activeGroups);
  const uniqueRoots = Array.from(new Set(Array.isArray(roots) ? roots : []))
    .filter((root) => root != null);
  if (signals.mutationKinds.length === 0 || normalizedGroups.length === 0 || uniqueRoots.length === 0) {
    return Object.freeze([]);
  }

  const routes = normalizedGroups.flatMap(({ group, filterKeys, attributeNames }) => {
    const rule = SOCIAL_METRIC_MUTATION_GROUP_RULES[group];
    if (!rule) return [];
    const matched = matchMutationRule(signals, rule, attributeNames);
    if (matched.mutationKinds.length === 0) {
      recordDisposition?.(Object.freeze({ group, disposition: 'mutation_rule_skipped' }));
      return [];
    }

    const relevantRoots = uniqueRoots.filter((root) => {
      try {
        return isRootRelevant(root, group, filterKeys) === true;
      } catch (cause) {
        throw createRootRelevanceError(cause, group, filterKeys);
      }
    });
    if (relevantRoots.length === 0) {
      recordDisposition?.(Object.freeze({ group, disposition: 'host_root_relevance_skipped' }));
      return [];
    }

    recordDisposition?.(Object.freeze({ group, disposition: 'routed' }));

    return [Object.freeze({
      group,
      filterKeys: Object.freeze([...filterKeys]),
      roots: Object.freeze(relevantRoots),
      mutationKinds: Object.freeze(matched.mutationKinds),
      attributeNames: Object.freeze(matched.attributeNames),
    })];
  });

  return Object.freeze(routes);
}
