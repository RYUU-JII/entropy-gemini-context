import { normalizeStrategyDecision } from '../../strategy/contracts/strategyContracts.js';

function normalizeHost(host) {
  return typeof host === 'string' ? host.trim().toLowerCase() : '';
}

const RECOVERY_STATE_SET = new Set(['armed', 'presented', 'cooldown', 'idle']);

function normalizeRecoveryState(value, fallback = 'idle') {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return RECOVERY_STATE_SET.has(normalized) ? normalized : fallback;
}

export function createRecoveryFlowResolver() {
  function resolve({ host = '', strategy = null, effectiveness = null } = {}) {
    const normalizedHost = normalizeHost(host);
    const normalizedStrategy = normalizeStrategyDecision(strategy);
    const pending = effectiveness?.pending && typeof effectiveness.pending === 'object'
      ? effectiveness.pending
      : null;
    const summary = effectiveness?.summary && typeof effectiveness.summary === 'object'
      ? effectiveness.summary
      : null;
    const action = normalizedStrategy.recoveryAction;
    const shouldArm = action !== 'none'
      && (normalizedStrategy.state === 'constrain'
        || normalizedStrategy.state === 'interrupt'
        || normalizedStrategy.state === 'recover'
        || normalizedStrategy.state === 'lock');

    const state = pending
      ? 'presented'
      : (shouldArm ? 'armed' : 'idle');

    return {
      host: normalizedHost,
      action,
      state: normalizeRecoveryState(state),
      suggested: shouldArm,
      strategyState: normalizedStrategy.state,
      lifecyclePhase: normalizedStrategy.lifecyclePhase,
      lastOutcome: typeof summary?.lastOutcome === 'string' ? summary.lastOutcome : null,
      lastOutcomeAt: Number(summary?.lastOutcomeAt) || 0,
    };
  }

  return {
    resolve,
  };
}
