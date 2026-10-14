import {
  normalizePressureSignals,
} from '../../contracts/protectionContracts.js';

const CONTEXT_PRESSURE_SIGNAL_FLAGS = Object.freeze([
  ['longSession', 'LONG_SESSION'],
  ['highContextSwitch', 'HIGH_CONTEXT_SWITCH'],
  ['highScrollVelocity', 'HIGH_SCROLL_VELOCITY'],
  ['clseAgitation', 'CLSE_AGITATION'],
  ['reentryAfterBlock', 'REENTRY_AFTER_BLOCK'],
]);

function sortSignals(signals = []) {
  return [...signals].sort((left, right) => left.localeCompare(right));
}

export function createPressureSignalResolver({
  longSessionMs = 10 * 60_000,
} = {}) {
  function resolve({
    context = {},
    snapshot = {},
  } = {}) {
    const signals = new Set(normalizePressureSignals(context?.pressureSignals));

    CONTEXT_PRESSURE_SIGNAL_FLAGS.forEach(([flagKey, signal]) => {
      if (context?.[flagKey]) {
        signals.add(signal);
      }
    });

    return sortSignals(signals);
  }

  return {
    resolve,
  };
}
