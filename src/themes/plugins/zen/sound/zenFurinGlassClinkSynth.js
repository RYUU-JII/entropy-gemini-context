import {
  getSharedAudioContext,
  resumeAudioContextIfSuspended,
} from '../../../../platform/audio/webAudioEngine.js';

function reportAudioFailure(phase, error, {
  diagnosticReporter = null,
  consoleRef = console,
} = {}) {
  if (typeof diagnosticReporter === 'function') {
    return diagnosticReporter(phase, error, consoleRef);
  }
  const diagnostic = {
    code: `zen_furin_glass_clink_${phase || 'unknown'}_failed`,
    error: String(error?.message || error || 'audio_failed'),
  };
  consoleRef?.warn?.('[zen sound] furin glass clink failed', diagnostic);
  return diagnostic;
}

export function playZenFurinGlassClinkSynth({
  protocolScope = 'site',
  intensity = 0.75,
  basePitch = 3136,
  audioContext = null,
  AudioContextCtor = null,
  consoleRef = console,
  diagnosticReporter = null,
} = {}) {
  const ctx = getSharedAudioContext({
    audioContext,
    AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
    onError: (error) => reportAudioFailure('context_create', error, {
      diagnosticReporter,
      consoleRef,
    }),
  });
  if (!ctx) return false;
  resumeAudioContextIfSuspended(ctx, {
    onError: (error) => reportAudioFailure('resume', error, {
      diagnosticReporter,
      consoleRef,
    }),
  });

  try {
    const now = ctx.currentTime + 0.002;
    const isGlobal = protocolScope === 'global';
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const jitter = 0.998 + Math.random() * 0.004;

    const fCup = (isGlobal ? 2093 : (basePitch || 3136)) * jitter;
    const fRod = fCup * 1.578; // Transverse free-rod mode (4950 Hz)
    const fRimFlash = fCup * 2.63; // Elastic strike sparkle (8250 Hz)

    const master = ctx.createGain();
    master.gain.setValueAtTime((isGlobal ? 0.28 : 0.22) * safeIntensity, now);
    master.connect(ctx.destination);

    // 1. STRIKE INSTANT (t = 0ms): Solid Glass Rod Ring & Elastic Flash
    const oscFlash = ctx.createOscillator();
    const gainFlash = ctx.createGain();
    oscFlash.type = 'sine';
    oscFlash.frequency.setValueAtTime(fRimFlash, now);

    gainFlash.gain.setValueAtTime(0.0001, now);
    gainFlash.gain.linearRampToValueAtTime(0.22 * safeIntensity, now + 0.0002);
    gainFlash.gain.exponentialRampToValueAtTime(0.00001, now + 0.06);

    oscFlash.connect(gainFlash);
    gainFlash.connect(master);
    oscFlash.start(now);
    oscFlash.stop(now + 0.08);

    const fRodTwin = fRod + (isGlobal ? 1.5 : 2.4);
    const rodDecay = isGlobal ? 0.8 : 0.48;

    const oscRodA = ctx.createOscillator();
    const gainRodA = ctx.createGain();
    oscRodA.type = 'sine';
    oscRodA.frequency.setValueAtTime(fRod, now);

    const peakRodA = 0.58 * safeIntensity;
    gainRodA.gain.setValueAtTime(0.0001, now);
    gainRodA.gain.linearRampToValueAtTime(peakRodA, now + 0.0003);
    gainRodA.gain.exponentialRampToValueAtTime(0.00001, now + rodDecay);

    oscRodA.connect(gainRodA);
    gainRodA.connect(master);
    oscRodA.start(now);
    oscRodA.stop(now + rodDecay + 0.03);

    const oscRodB = ctx.createOscillator();
    const gainRodB = ctx.createGain();
    oscRodB.type = 'sine';
    oscRodB.frequency.setValueAtTime(fRodTwin, now);

    const peakRodB = 0.36 * safeIntensity;
    gainRodB.gain.setValueAtTime(0.0001, now);
    gainRodB.gain.linearRampToValueAtTime(peakRodB, now + 0.0003);
    gainRodB.gain.exponentialRampToValueAtTime(0.00001, now + rodDecay * 0.85);

    oscRodB.connect(gainRodB);
    gainRodB.connect(master);
    oscRodB.start(now);
    oscRodB.stop(now + rodDecay + 0.03);

    // 2. CUP RESONANCE BLOOM (t = +14ms): Inverted Glass Cup Body (3136 Hz, 1.30s)
    const cupOnset = now + 0.014;
    const totalCupDecay = isGlobal ? 2.0 : 1.30;
    const stage1CupTime = cupOnset + (isGlobal ? 0.18 : 0.12);
    const fCupTwin = fCup + (isGlobal ? 1.8 : 3.2);

    const oscCupA = ctx.createOscillator();
    const gainCupA = ctx.createGain();
    oscCupA.type = 'sine';
    oscCupA.frequency.setValueAtTime(fCup, cupOnset);

    const peakCupA = 0.65 * safeIntensity;
    const stage1CupA = peakCupA * 0.38;

    gainCupA.gain.setValueAtTime(0.0001, cupOnset);
    gainCupA.gain.linearRampToValueAtTime(peakCupA, cupOnset + 0.0004);
    gainCupA.gain.exponentialRampToValueAtTime(Math.max(0.0001, stage1CupA), stage1CupTime);
    gainCupA.gain.exponentialRampToValueAtTime(0.00001, cupOnset + totalCupDecay);

    oscCupA.connect(gainCupA);
    gainCupA.connect(master);
    oscCupA.start(cupOnset);
    oscCupA.stop(cupOnset + totalCupDecay + 0.03);

    const oscCupB = ctx.createOscillator();
    const gainCupB = ctx.createGain();
    oscCupB.type = 'sine';
    oscCupB.frequency.setValueAtTime(fCupTwin, cupOnset);

    const peakCupB = 0.42 * safeIntensity;
    const stage1CupB = peakCupB * 0.35;

    gainCupB.gain.setValueAtTime(0.0001, cupOnset);
    gainCupB.gain.linearRampToValueAtTime(peakCupB, cupOnset + 0.0004);
    gainCupB.gain.exponentialRampToValueAtTime(Math.max(0.0001, stage1CupB), stage1CupTime);
    gainCupB.gain.exponentialRampToValueAtTime(0.00001, cupOnset + totalCupDecay * 0.9);

    oscCupB.connect(gainCupB);
    gainCupB.connect(master);
    oscCupB.start(cupOnset);
    oscCupB.stop(cupOnset + totalCupDecay + 0.03);

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, {
      diagnosticReporter,
      consoleRef,
    });
    return false;
  }
}
