import {
  SPIKE_PROTOCOL_VERSION,
  SPIKE_SIGNAL_TYPE,
  normalizeSpikeSignals,
} from './SpikeSignalSchema.js';

export const SPIKE_PROTOCOL_MODE = Object.freeze({
  OBSERVE_ONLY: 'observe_only',
});

export const SPIKE_PROTOCOL_SUGGESTION = Object.freeze({
  NONE: 'none',
  SOFT_NUDGE_CANDIDATE: 'soft_nudge_candidate',
  INTERRUPT_CANDIDATE: 'interrupt_candidate',
});

const clamp = (value, min = 0, max = 1) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
};

const round = (value, digits = 4) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
};

const resolveSignalWeight = (signal) => {
  switch (signal?.type) {
    case SPIKE_SIGNAL_TYPE.COMPOSITE:
      return 1.18;
    case SPIKE_SIGNAL_TYPE.SUSTAINED_DRIFT:
      return 1.12;
    case SPIKE_SIGNAL_TYPE.MEDIA_SEEK:
      return 0.92;
    default:
      return 1;
  }
};

const average = (values = []) => {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return 0;
  return finite.reduce((acc, value) => acc + value, 0) / finite.length;
};

const collectReasonCodes = (signals = []) => Array.from(new Set(
  signals.flatMap((signal) => (
    Array.isArray(signal.reasonCodes) ? signal.reasonCodes : []
  )),
));

const resolvePrimaryPattern = (signals = []) => {
  if (!signals.length) return null;
  return [...signals].sort((left, right) => {
    const leftScore = Number(left.severity || 0) * Number(left.confidence || 0) * resolveSignalWeight(left);
    const rightScore = Number(right.severity || 0) * Number(right.confidence || 0) * resolveSignalWeight(right);
    return rightScore - leftScore;
  })[0]?.type || null;
};

const resolveSuggestedProtocol = ({ intensity, confidence, signalCount } = {}) => {
  if (signalCount <= 0) return SPIKE_PROTOCOL_SUGGESTION.NONE;
  if (intensity >= 0.82 && confidence >= 0.58) return SPIKE_PROTOCOL_SUGGESTION.INTERRUPT_CANDIDATE;
  if (intensity >= 0.48 && confidence >= 0.42) return SPIKE_PROTOCOL_SUGGESTION.SOFT_NUDGE_CANDIDATE;
  return SPIKE_PROTOCOL_SUGGESTION.NONE;
};

export function buildSpikeProtocolSnapshot({
  signals = [],
  now = Date.now(),
  mode = SPIKE_PROTOCOL_MODE.OBSERVE_ONLY,
} = {}) {
  const observedAtMs = Math.floor(Number(now) || Date.now());
  const normalizedSignals = normalizeSpikeSignals(signals);
  const signalWeights = normalizedSignals.map(resolveSignalWeight);
  const weightTotal = signalWeights.reduce((acc, value) => acc + value, 0);
  const weightedIntensity = weightTotal > 0
    ? normalizedSignals.reduce((acc, signal, index) => (
      acc + (Number(signal.severity || 0) * signalWeights[index])
    ), 0) / weightTotal
    : 0;
  const confidence = average(normalizedSignals.map((signal) => Number(signal.confidence || 0)));
  const intensity = clamp(
    (weightedIntensity * 0.82)
    + (Math.min(1, normalizedSignals.length / 3) * 0.18),
    0,
    1,
  );
  const detected = normalizedSignals.length > 0;
  const primaryPattern = resolvePrimaryPattern(normalizedSignals);
  const reasonCodes = collectReasonCodes(normalizedSignals);
  const suggestedProtocol = resolveSuggestedProtocol({
    intensity,
    confidence,
    signalCount: normalizedSignals.length,
  });

  return {
    protocolVersion: SPIKE_PROTOCOL_VERSION,
    mode,
    observedAtMs,
    detected,
    intensity: round(intensity),
    confidence: round(confidence),
    primaryPattern,
    reasonCodes,
    signals: normalizedSignals,
    suggestedProtocol,
    contract: {
      observeOnly: true,
      affectsScore: false,
      affectsBonsai: false,
      emitsNudge: false,
      emitsInterrupt: false,
      scoreImpact: 0,
    },
  };
}

export function createNoSpikeProtocolSnapshot(options = {}) {
  return buildSpikeProtocolSnapshot({
    ...options,
    signals: [],
  });
}

export default buildSpikeProtocolSnapshot;
