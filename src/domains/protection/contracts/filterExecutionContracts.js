export const FILTER_EXECUTION_SOURCES = Object.freeze({
  INACTIVE: 'inactive',
  USER_CONFIG: 'user_config',
  POLICY: 'policy',
  RUNTIME_ARTIFACT: 'runtime_artifact',
});

const FILTER_EXECUTION_SOURCE_SET = new Set(Object.values(FILTER_EXECUTION_SOURCES));

export function normalizeFilterExecutionSource(value, fallback = FILTER_EXECUTION_SOURCES.INACTIVE) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return FILTER_EXECUTION_SOURCE_SET.has(normalized) ? normalized : fallback;
}
