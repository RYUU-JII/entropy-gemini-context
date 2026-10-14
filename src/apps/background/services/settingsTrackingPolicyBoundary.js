const TRACKING_POLICY_KEYS = Object.freeze([
  'dataCollectionMode', 'insightsConsent', 'trackingExcludedUrls',
  'blockedUrls', 'allowedUrls', 'filteringMode', 'relaxationSchedule',
]);

// Goal values and preset identities do not change recording membership. A
// goal edit must not retime the foreground source or erase accrued usage.
export function changesTrackingPolicyBoundary(current, items) {
  if (TRACKING_POLICY_KEYS.some(key => Object.hasOwn(items, key)
    && JSON.stringify(current[key]) !== JSON.stringify(items[key]))) return true;
  if (Object.hasOwn(items, 'siteGoals')
    && JSON.stringify(Object.keys(current.siteGoals).sort())
      !== JSON.stringify(Object.keys(items.siteGoals).sort())) return true;
  if (Object.hasOwn(items, 'protectionPresetAssignments')
    && JSON.stringify(Object.keys(current.protectionPresetAssignments.sitePresetIds).sort())
      !== JSON.stringify(Object.keys(items.protectionPresetAssignments.sitePresetIds).sort())) return true;
  return false;
}
