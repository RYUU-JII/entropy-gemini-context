export const STATS_RUNTIME_EPOCH_HEX_LENGTH = 32;

export function requireStatsRuntimeEpoch(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    normalized.length !== STATS_RUNTIME_EPOCH_HEX_LENGTH
    || !/^[0-9a-f]+$/u.test(normalized)
  ) {
    const error = new Error('STATS_RUNTIME_EPOCH_INVALID');
    error.code = 'STATS_RUNTIME_EPOCH_INVALID';
    throw error;
  }
  return normalized;
}
