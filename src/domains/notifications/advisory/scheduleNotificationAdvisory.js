export function normalizeScheduleNotificationRouteIntent(value) {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return candidate === 'notifications' ? candidate : null;
}
