/**
 * Noise generation and shaping primitives for WebAudio synthesis.
 */

let sharedNoiseBuffer = null;
let sharedPinkNoiseBuffer = null;

/**
 * Creates or retrieves a cached white noise AudioBuffer.
 * @param {AudioContext} ctx
 * @param {number} durationSeconds
 * @returns {AudioBuffer}
 */
export function getWhiteNoiseBuffer(ctx, durationSeconds = 0.5) {
  const sampleRate = ctx.sampleRate || 44100;
  const targetSamples = Math.floor(sampleRate * durationSeconds);

  if (sharedNoiseBuffer && sharedNoiseBuffer.length >= targetSamples) {
    return sharedNoiseBuffer;
  }

  const buffer = ctx.createBuffer(1, targetSamples, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < targetSamples; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  sharedNoiseBuffer = buffer;
  return buffer;
}

/**
 * Creates or retrieves a cached pink noise (1/f) AudioBuffer using Paul Kellet's filtered algorithm.
 * @param {AudioContext} ctx
 * @param {number} durationSeconds
 * @returns {AudioBuffer}
 */
export function getPinkNoiseBuffer(ctx, durationSeconds = 0.5) {
  const sampleRate = ctx.sampleRate || 44100;
  const targetSamples = Math.floor(sampleRate * durationSeconds);

  if (sharedPinkNoiseBuffer && sharedPinkNoiseBuffer.length >= targetSamples) {
    return sharedPinkNoiseBuffer;
  }

  const buffer = ctx.createBuffer(1, targetSamples, sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let i = 0; i < targetSamples; i += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }

  sharedPinkNoiseBuffer = buffer;
  return buffer;
}

/**
 * Schedules an envelope-shaped filtered noise burst.
 */
export function scheduleNoiseBurst(ctx, destination, {
  startAt,
  duration = 0.05,
  attack = 0.002,
  gain = 0.5,
  noiseType = 'white',
  filterType = 'bandpass',
  filterFrequency = 1000,
  filterQ = 4,
} = {}) {
  const noiseBuffer = noiseType === 'pink'
    ? getPinkNoiseBuffer(ctx, Math.max(duration + 0.1, 0.5))
    : getWhiteNoiseBuffer(ctx, Math.max(duration + 0.1, 0.5));

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFrequency, startAt);
  filter.Q.setValueAtTime(filterQ, startAt);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, gain),
    startAt + Math.max(0.001, attack),
  );
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(destination);

  source.start(startAt);
  source.stop(startAt + duration + 0.02);

  return { source, filter, gainNode };
}
