import { recordProtectionFeatureError } from './protectionRuntimeDiagnostics.js';

function recordSignalGateCleanupFailure(featureKey, error, details) {
  try {
    recordProtectionFeatureError(featureKey, error, {
      phase: 'signal_gate_cleanup',
      ...details,
    });
  } catch (diagnosticsError) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[SignalGate] failed to record cleanup diagnostics:',
        diagnosticsError?.message || diagnosticsError,
      );
    }
  }
}

class SignalGate {
  constructor() {
    this._featureState = new Map();
    this._cleanupHooks = new Map();
  }

  isFeatureEnabled(featureKey) {
    return this._featureState.get(featureKey) === true;
  }

  setFeatureEnabled(featureKey, enabled, { reason = null } = {}) {
    if (typeof featureKey !== 'string' || !featureKey.trim()) return;
    const normalizedKey = featureKey.trim();
    const nextEnabled = !!enabled;
    const prevEnabled = this.isFeatureEnabled(normalizedKey);

    this._featureState.set(normalizedKey, nextEnabled);

    if (!prevEnabled || nextEnabled) return;

    const hooks = this._cleanupHooks.get(normalizedKey);
    if (!hooks || hooks.size === 0) return;

    hooks.forEach((hook) => {
      try {
        hook({ featureKey: normalizedKey, reason: reason || 'gate_off' });
      } catch (error) {
        recordSignalGateCleanupFailure(normalizedKey, error, {
          reason: reason || 'gate_off',
        });
        console.warn('[SignalGate] cleanup hook failed:', error?.message || error);
      }
    });
  }

  registerCleanup(featureKey, hook) {
    if (typeof featureKey !== 'string' || !featureKey.trim()) return () => {};
    if (typeof hook !== 'function') return () => {};

    const normalizedKey = featureKey.trim();
    const bucket = this._cleanupHooks.get(normalizedKey) || new Set();
    bucket.add(hook);
    this._cleanupHooks.set(normalizedKey, bucket);

    return () => {
      const current = this._cleanupHooks.get(normalizedKey);
      if (!current) return;
      current.delete(hook);
      if (current.size === 0) this._cleanupHooks.delete(normalizedKey);
    };
  }
}

const signalGate = new SignalGate();
export default signalGate;
