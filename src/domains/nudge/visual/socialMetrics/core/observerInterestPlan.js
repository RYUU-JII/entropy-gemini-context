import {
  compileSelectorAttributeDependencyPlan,
} from '../../../../../lib/dom/selectorAttributeDependencies.js';
import { SOCIAL_METRIC_GROUPS } from '../contracts/socialMetricContracts.js';

function normalizeSelectors(rootSelector, plans) {
  return [
    ...(typeof rootSelector === 'string' && rootSelector.trim() ? [rootSelector] : []),
    ...plans.flatMap((plan) => (
      Array.isArray(plan?.list) ? plan.list : []
    )),
  ];
}

function requirePlan(plan, index) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error(`SOCIAL_METRIC_OBSERVER_INTEREST_PLAN_REQUIRED:${index}`);
  }
  if (!SOCIAL_METRIC_GROUPS.includes(plan.group)) {
    throw new Error(`SOCIAL_METRIC_OBSERVER_INTEREST_GROUP_INVALID:${index}`);
  }
  if (!Array.isArray(plan.list)) {
    throw new Error(`SOCIAL_METRIC_OBSERVER_INTEREST_SELECTORS_REQUIRED:${index}`);
  }
  return plan;
}

export function compileSocialMetricObserverInterest({
  rootSelector = '',
  plans = [],
  semanticMutationAttributes = [],
  ownerMutationAttributes = [],
} = {}) {
  if (!Array.isArray(plans)) {
    throw new Error('SOCIAL_METRIC_OBSERVER_INTEREST_PLANS_REQUIRED');
  }
  if (typeof rootSelector !== 'string') {
    throw new Error('SOCIAL_METRIC_OBSERVER_INTEREST_ROOT_SELECTOR_REQUIRED');
  }

  const normalizedPlans = plans.map(requirePlan);
  const completePlan = compileSelectorAttributeDependencyPlan({
    selectors: normalizeSelectors(rootSelector, normalizedPlans),
    semanticAttributes: semanticMutationAttributes,
    requiredObservedAttributes: ownerMutationAttributes,
  });
  const groupAttributeNames = Object.freeze(Object.fromEntries(
    SOCIAL_METRIC_GROUPS.map((group) => {
      const groupPlans = normalizedPlans.filter((plan) => plan.group === group);
      if (groupPlans.length === 0) return [group, Object.freeze([])];
      const groupPlan = compileSelectorAttributeDependencyPlan({
        selectors: normalizeSelectors(rootSelector, groupPlans),
        semanticAttributes: semanticMutationAttributes,
      });
      return [group, groupPlan.observedAttributes];
    }),
  ));

  return Object.freeze({
    observedAttributes: completePlan.observedAttributes,
    initialScanOnlyAttributes: completePlan.initialScanOnlyAttributes,
    groupAttributeNames,
    signature: JSON.stringify({
      observedAttributes: completePlan.observedAttributes,
      initialScanOnlyAttributes: completePlan.initialScanOnlyAttributes,
      groupAttributeNames,
    }),
  });
}
