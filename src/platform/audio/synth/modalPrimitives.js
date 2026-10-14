/**
 * Physical modal resonance and pitch shaping primitives for WebAudio synthesis.
 */

/**
 * Schedules a single decaying modal partial tone with optional pitch drop.
 */
export function scheduleModalPartial(ctx, destination, {
  frequency = 440,
  startAt = 0,
  duration = 0.2,
  attack = 0.002,
  gain = 0.5,
  type = 'sine',
  detune = 0,
  pitchDrop = false,
  pitchDropRatio = 2.4,
  pitchDropDuration = 0.01,
} = {}) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.detune.setValueAtTime(detune, startAt);

  if (pitchDrop) {
    osc.frequency.setValueAtTime(frequency * pitchDropRatio, startAt);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(10, frequency),
      startAt + pitchDropDuration,
    );
  } else {
    osc.frequency.setValueAtTime(frequency, startAt);
  }

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, gain),
    startAt + Math.max(0.001, attack),
  );
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gainNode);
  gainNode.connect(destination);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);

  return { osc, gainNode };
}

/**
 * Schedules a bank of modal partials representing a physical resonator (bamboo, wood, bell, metal, etc.).
 * @param {AudioContext} ctx
 * @param {AudioNode} destination
 * @param {Object} options
 * @param {Array<{frequency: number, gain: number, duration: number, detune?: number, type?: string}>} options.partials
 * @param {number} options.startAt
 * @param {number} options.gainMultiplier
 * @param {number} options.frequencyMultiplier
 */
export function scheduleModalResonatorBank(ctx, destination, {
  partials = [],
  startAt = 0,
  gainMultiplier = 1,
  frequencyMultiplier = 1,
} = {}) {
  return partials.map((partial) => scheduleModalPartial(ctx, destination, {
    ...partial,
    frequency: partial.frequency * frequencyMultiplier,
    gain: partial.gain * gainMultiplier,
    startAt: startAt + (partial.timeOffset || 0),
  }));
}
