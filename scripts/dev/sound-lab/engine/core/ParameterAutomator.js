/**
 * ParameterAutomator provides helper utilities for WebAudio audio-rate parameter scheduling,
 * ADSR envelopes, exponential decays, and micro-jitter humanization.
 */

export class ParameterAutomator {
  static applyJitter(value, jitterRatio = 0.03) {
    const range = jitterRatio * 2;
    const factor = (1 - jitterRatio) + Math.random() * range;
    return value * factor;
  }

  static scheduleDecayEnvelope(param, {
    startAt,
    peakValue = 1.0,
    minValue = 0.0001,
    attackDuration = 0.002,
    decayDuration = 0.2,
  } = {}) {
    param.setValueAtTime(minValue, startAt);
    param.exponentialRampToValueAtTime(
      Math.max(minValue, peakValue),
      startAt + Math.max(0.001, attackDuration),
    );
    param.exponentialRampToValueAtTime(
      minValue,
      startAt + attackDuration + decayDuration,
    );
  }

  static scheduleAdsr(param, {
    startAt,
    peakValue = 1.0,
    sustainValue = 0.5,
    minValue = 0.0001,
    attack = 0.01,
    decay = 0.05,
    sustain = 0.2,
    release = 0.1,
  } = {}) {
    param.setValueAtTime(minValue, startAt);
    param.exponentialRampToValueAtTime(Math.max(minValue, peakValue), startAt + attack);
    param.exponentialRampToValueAtTime(Math.max(minValue, sustainValue), startAt + attack + decay);
    param.setValueAtTime(Math.max(minValue, sustainValue), startAt + attack + decay + sustain);
    param.exponentialRampToValueAtTime(minValue, startAt + attack + decay + sustain + release);
  }
}
