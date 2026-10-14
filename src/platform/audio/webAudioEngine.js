let sharedAudioContext = null;

export function resetSharedAudioContextForTests() {
  sharedAudioContext = null;
}

export function getSharedAudioContext({
  audioContext = null,
  AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext,
  onError = null,
} = {}) {
  if (audioContext) return audioContext;
  if (sharedAudioContext) return sharedAudioContext;
  if (typeof AudioContextCtor !== 'function') return null;
  try {
    sharedAudioContext = new AudioContextCtor();
    return sharedAudioContext;
  } catch (error) {
    sharedAudioContext = null;
    onError?.(error);
    return null;
  }
}

export function resumeAudioContextIfSuspended(ctx, {
  onError = null,
} = {}) {
  if (!ctx || ctx.state !== 'suspended' || typeof ctx.resume !== 'function') {
    return false;
  }
  void ctx.resume().catch((error) => {
    onError?.(error);
  });
  return true;
}

export function scheduleOscillatorPartial(ctx, destination, {
  frequency,
  startAt,
  duration,
  gain,
  detune = 0,
  type = 'sine',
} = {}) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  oscillator.detune.setValueAtTime(detune, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), startAt + 0.018);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gainNode);
  gainNode.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
}
