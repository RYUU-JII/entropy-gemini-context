export const CLASS_CATALOG = Object.freeze([
  Object.freeze({ id: 'blocked', displayName: 'Blocked', priority: 100 }),
  Object.freeze({ id: 'managed', displayName: 'Managed', priority: 80 }),
  Object.freeze({ id: 'allowed', displayName: 'Allowed', priority: 60 }),
  Object.freeze({ id: 'unmanaged', displayName: 'Unmanaged', priority: 40 }),
]);

export const DOMAIN_CLASS_IDS = Object.freeze(CLASS_CATALOG.map((entry) => entry.id));
export const DOMAIN_CLASS_ID_SET = new Set(DOMAIN_CLASS_IDS);

export function isKnownDomainClassId(classId) {
  return typeof classId === 'string' && DOMAIN_CLASS_ID_SET.has(classId);
}
