export const PROTECTION_REASON_CODES = Object.freeze({
  BUDGET_RATIO_ELEVATED: 'budget_ratio_elevated',
  BUDGET_RATIO_HIGH: 'budget_ratio_high',
  BUDGET_RATIO_CRITICAL: 'budget_ratio_critical',
  PRESSURE_SIGNAL_PRESENT: 'pressure_signal_present',
  DIRECT_TRIGGER_PRESENT: 'direct_trigger_present',
  MANUAL_RESET: 'manual_reset',
});

export const PROTECTION_REASON_CODE_SET = new Set(Object.values(PROTECTION_REASON_CODES));

export function isProtectionReasonCode(value) {
  return typeof value === 'string' && PROTECTION_REASON_CODE_SET.has(value);
}
