function requireAudioContextConstructor(windowRef) {
  const AudioContextCtor = windowRef?.AudioContext || windowRef?.webkitAudioContext;
  if (typeof AudioContextCtor !== 'function') {
    throw new Error('LANDING_AUDIO_CONTEXT_UNAVAILABLE');
  }
  return AudioContextCtor;
}
function scheduleTone(context, destination, {
  frequency,
  gain,
  startAt,
  duration,
  type = 'sine',
  detune = 0,
}) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  oscillator.detune.setValueAtTime(detune, startAt);
  envelope.gain.setValueAtTime(0.0001, startAt);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), startAt + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
}

function scheduleNoiseClick(context, destination, startAt) {
  const duration = 0.19;
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    const decay = Math.exp(-index / (sampleCount * 0.13));
    channel[index] = ((Math.random() * 2) - 1) * decay;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(760, startAt);
  filter.Q.setValueAtTime(1.7, startAt);
  envelope.gain.setValueAtTime(0.18, startAt);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(destination);
  source.start(startAt);
}

export function createLandingAudioEngine({ windowRef = globalThis.window } = {}) {
  let context = null;
  let master = null;
  let disposed = false;

  const getContext = () => {
    if (disposed) throw new Error('LANDING_AUDIO_ENGINE_DISPOSED');
    if (context) return context;
    const AudioContextCtor = requireAudioContextConstructor(windowRef);
    context = new AudioContextCtor();
    master = context.createGain();
    master.gain.setValueAtTime(0.52, context.currentTime);
    master.connect(context.destination);
    return context;
  };

  const resume = async () => {
    const activeContext = getContext();
    if (activeContext.state === 'suspended') {
      await activeContext.resume();
    }
    if (activeContext.state !== 'running') {
      throw new Error(`LANDING_AUDIO_CONTEXT_NOT_RUNNING:${activeContext.state}`);
    }
    return activeContext;
  };

  return Object.freeze({
    async enable() {
      await resume();
      return true;
    },
    async playFurin() {
      const activeContext = await resume();
      const startAt = activeContext.currentTime + 0.012;
      [
        { frequency: 880, gain: 0.12, duration: 1.15, detune: 2 },
        { frequency: 1320, gain: 0.07, duration: 0.84, detune: -4 },
        { frequency: 1760, gain: 0.025, duration: 0.58, detune: 7 },
      ].forEach((partial, index) => scheduleTone(activeContext, master, {
        ...partial,
        startAt: startAt + (index * 0.022),
      }));
      return true;
    },
    async playShishi() {
      const activeContext = await resume();
      const startAt = activeContext.currentTime + 0.008;
      scheduleNoiseClick(activeContext, master, startAt);
      scheduleTone(activeContext, master, {
        frequency: 312,
        gain: 0.08,
        startAt,
        duration: 0.24,
        type: 'triangle',
        detune: -10,
      });
      scheduleTone(activeContext, master, {
        frequency: 624,
        gain: 0.025,
        startAt: startAt + 0.018,
        duration: 0.16,
        type: 'sine',
      });
      return true;
    },
    async dispose() {
      disposed = true;
      if (context && context.state !== 'closed') {
        await context.close();
      }
      context = null;
      master = null;
    },
  });
}
