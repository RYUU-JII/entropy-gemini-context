export const QUALIFIED_USE_FACTS_CONTRACT = 'qualified_use_facts_v1';

export function requireQualifiedUseDayCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('QUALIFIED_USE_DAY_COUNT_INVALID');
  }
  return value;
}

export function buildQualifiedUseFacts({ canonicalDayCount, effectiveDayCount, lastActivityDayKey }) {
  requireQualifiedUseDayCount(canonicalDayCount);
  requireQualifiedUseDayCount(effectiveDayCount);
  if (typeof lastActivityDayKey !== 'string'
    || (canonicalDayCount === 0) !== (lastActivityDayKey === '')) {
    throw new Error('QUALIFIED_USE_ACTIVITY_DAY_KEY_INVALID');
  }
  if (lastActivityDayKey !== '') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lastActivityDayKey);
    const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
    if (!date || date.toISOString().slice(0, 10) !== lastActivityDayKey) {
      throw new Error('QUALIFIED_USE_ACTIVITY_DAY_KEY_INVALID');
    }
  }
  return Object.freeze({ contract: QUALIFIED_USE_FACTS_CONTRACT,
    canonicalDayCount, effectiveDayCount, lastActivityDayKey });
}

export function requireQualifiedUseFacts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.contract !== QUALIFIED_USE_FACTS_CONTRACT
    || Object.keys(value).length !== 4) {
    throw new Error('QUALIFIED_USE_FACTS_INVALID');
  }
  buildQualifiedUseFacts(value);
  return value;
}
