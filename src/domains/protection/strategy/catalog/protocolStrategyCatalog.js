export const PROTOCOL_STRATEGY_IDS = Object.freeze({
  FIXED: 'fixed',
  DYNAMIC: 'dynamic',
});

const {
  FIXED,
  DYNAMIC,
} = PROTOCOL_STRATEGY_IDS;

export const DEFAULT_PROTOCOL_STRATEGY_ID = FIXED;

export const PROTOCOL_STRATEGY_CATALOG = Object.freeze({
  [FIXED]: Object.freeze({
    id: FIXED,
    titleKey: 'global_protocol.strategy.fixed_title',
    descriptionKey: 'global_protocol.strategy.fixed_desc',
    usesGlobalGoalAsActivationGate: false,
    usesGlobalGoalAsOverflowThreshold: true,
    releaseEnabled: true,
  }),
  [DYNAMIC]: Object.freeze({
    id: DYNAMIC,
    titleKey: 'global_protocol.strategy.dynamic_title',
    descriptionKey: 'global_protocol.strategy.dynamic_desc',
    usesGlobalGoalAsActivationGate: false,
    usesGlobalGoalAsOverflowThreshold: true,
    releaseEnabled: false,
  }),
});

export function getProtocolStrategyDefinition(strategyId) {
  return PROTOCOL_STRATEGY_CATALOG?.[strategyId] || null;
}

export function normalizeProtocolStrategyId(value, fallback = DEFAULT_PROTOCOL_STRATEGY_ID) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return Object.prototype.hasOwnProperty.call(PROTOCOL_STRATEGY_CATALOG, normalized)
    ? normalized
    : fallback;
}
