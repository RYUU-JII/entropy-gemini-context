// Browser tab presentation is independent of Gate's intervention policy.
export const DEFAULT_TAB_MANAGEMENT = Object.freeze({ groupProtectedTabs: false });

export function normalizeTabManagement(value) {
  if (value === undefined) return { ...DEFAULT_TAB_MANAGEMENT };
  return requireTabManagement(value);
}

export function requireTabManagement(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 1
    || !Object.hasOwn(value, 'groupProtectedTabs')
    || typeof value.groupProtectedTabs !== 'boolean') {
    throw new Error('TAB_MANAGEMENT_CONFIG_INVALID');
  }
  return { groupProtectedTabs: value.groupProtectedTabs };
}
