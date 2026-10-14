const REQUIRED_GROUPS = [
  'policy',
  'statsQueries',
  'protectionRuntime',
  'popupDomain',
  'storageSupport',
  'supportDebug',
  'settings',
  'nudgeCycle',
  'indicatorNavigation',
];

const REQUIRED_GROUP_ERROR_CODES = {
  policy: 'TRACKING_MESSAGE_POLICY_DEPENDENCIES_REQUIRED',
  statsQueries: 'TRACKING_MESSAGE_STATS_QUERIES_DEPENDENCIES_REQUIRED',
  protectionRuntime: 'TRACKING_MESSAGE_PROTECTION_RUNTIME_DEPENDENCIES_REQUIRED',
  popupDomain: 'TRACKING_MESSAGE_POPUP_DOMAIN_DEPENDENCIES_REQUIRED',
  storageSupport: 'TRACKING_MESSAGE_STORAGE_SUPPORT_DEPENDENCIES_REQUIRED',
  supportDebug: 'TRACKING_MESSAGE_SUPPORT_DEBUG_DEPENDENCIES_REQUIRED',
  settings: 'TRACKING_MESSAGE_SETTINGS_DEPENDENCIES_REQUIRED',
  nudgeCycle: 'TRACKING_MESSAGE_NUDGE_CYCLE_DEPENDENCIES_REQUIRED',
  indicatorNavigation: 'TRACKING_MESSAGE_INDICATOR_NAVIGATION_DEPENDENCIES_REQUIRED',
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readRequiredTrackingMessageDependencyGroup(dependencies, groupName) {
  const group = dependencies[groupName];
  if (!isPlainObject(group)) {
    throw new Error(REQUIRED_GROUP_ERROR_CODES[groupName] || 'TRACKING_MESSAGE_DEPENDENCY_GROUP_REQUIRED');
  }
  return group;
}

export function resolveTrackingMessageHandlerDependencies(dependencies = {}) {
  if (!isPlainObject(dependencies)) {
    throw new Error('TRACKING_MESSAGE_DEPENDENCIES_REQUIRED');
  }

  const resolved = REQUIRED_GROUPS.reduce((acc, groupName) => {
    acc[groupName] = readRequiredTrackingMessageDependencyGroup(dependencies, groupName);
    return acc;
  }, {});
  resolved.specialSession = isPlainObject(dependencies.specialSession)
    ? dependencies.specialSession
    : {};
  return resolved;
}
