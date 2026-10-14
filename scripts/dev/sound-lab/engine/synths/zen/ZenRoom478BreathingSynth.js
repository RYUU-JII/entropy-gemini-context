/**
 * ZenRoom478BreathingSynth - Pure Meditative Physical Synthesizer for 4-7-8 Breathing Room.
 * Synthesizes 4s Inhale Swell, 7s Hold Stillness Drone, 8s Exhale Release, and Phase Transition Singing Bowl.
 */

import { NoiseGenerator } from '../../primitives/NoiseGenerator.js';

export class ZenRoom478BreathingSynth {
  /**
   * 1. 4s Inhale Breath Swell (4초 들숨 수렴음)
   * 4초 동안 우주 공간에서 맑은 공기가 차오르는 108Hz 성스러운 기음 기반 화음 스웰 + 에어 텍스처
   */
  static playInhaleSwell(ctx, destination, {
    intensity = 0.75,
    basePitch = 108,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const duration = 4.0;
    const f0 = basePitch || 108;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.30 * safeIntensity, now);
    master.connect(destination);

    // Cosmic Harmonic Series Stack (f0, 2*f0, 3*f0, 4*f0 -> 108Hz, 216Hz, 324Hz, 432Hz)
    const chordFrequencies = [f0, f0 * 2, f0 * 3, f0 * 4];
    const chordGain = ctx.createGain();
    chordGain.gain.setValueAtTime(0.0001, now);
    chordGain.gain.exponentialRampToValueAtTime(0.68 * safeIntensity, now + duration * 0.85);
    chordGain.gain.exponentialRampToValueAtTime(0.00001, now + duration + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(130, now);
    filter.frequency.exponentialRampToValueAtTime(850, now + duration);
    filter.Q.setValueAtTime(1.4, now);

    chordFrequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + (idx * 0.25 - 0.35), now);
      osc.connect(chordGain);
      osc.start(now);
      osc.stop(now + duration + 0.4);
    });

    chordGain.connect(filter);
    filter.connect(master);

    // Celestial Air Inflow Shimmer
    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.5);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.setValueAtTime(350, now);
    airFilter.frequency.exponentialRampToValueAtTime(900, now + duration);
    airFilter.Q.setValueAtTime(2.5, now);

    const airGain = ctx.createGain();
    airGain.gain.setValueAtTime(0.0001, now);
    airGain.gain.linearRampToValueAtTime(0.18 * safeIntensity, now + duration * 0.80);
    airGain.gain.exponentialRampToValueAtTime(0.00001, now + duration + 0.25);

    noiseSource.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(master);

    noiseSource.start(now);
    noiseSource.stop(now + duration + 0.4);

    return true;
  }

  /**
   * 2. 7s Hold Stillness Drone (7초 지식 정적 드론)
   * 7초 동안 무중력의 정적과 평온을 유지하는 216Hz 티베탄 싱잉볼 드론 + 1.2Hz 느린 맥놀이
   */
  static playHoldDrone(ctx, destination, {
    intensity = 0.75,
    basePitch = 216,
    duration = 7.0,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const f0 = basePitch || 216;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.26 * safeIntensity, now);
    master.connect(destination);

    // Mode 1: Primary Zero-Gravity Drone (216 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f0, now);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.50 * safeIntensity, now + 0.8);
    gain1.gain.setValueAtTime(0.50 * safeIntensity, now + duration - 0.8);
    gain1.gain.exponentialRampToValueAtTime(0.00001, now + duration + 0.4);

    osc1.connect(gain1);
    gain1.connect(master);
    osc1.start(now);
    osc1.stop(now + duration + 0.5);

    // Mode 2: 1.2Hz Binaural Theta Drift (217.2 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f0 + 1.2, now);

    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.38 * safeIntensity, now + 0.8);
    gain2.gain.setValueAtTime(0.38 * safeIntensity, now + duration - 0.8);
    gain2.gain.exponentialRampToValueAtTime(0.00001, now + duration + 0.4);

    osc2.connect(gain2);
    gain2.connect(master);
    osc2.start(now);
    osc2.stop(now + duration + 0.5);

    // Mode 3: 108Hz Deep Sub-Anchor
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(f0 * 0.5, now);

    gain3.gain.setValueAtTime(0.0001, now);
    gain3.gain.linearRampToValueAtTime(0.30 * safeIntensity, now + 1.0);
    gain3.gain.setValueAtTime(0.30 * safeIntensity, now + duration - 0.9);
    gain3.gain.exponentialRampToValueAtTime(0.00001, now + duration + 0.4);

    osc3.connect(gain3);
    gain3.connect(master);
    osc3.start(now);
    osc3.stop(now + duration + 0.5);

    // Mode 4: 648 Hz Starlight Singing Tone
    const osc4 = ctx.createOscillator();
    const gain4 = ctx.createGain();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(f0 * 3, now);

    gain4.gain.setValueAtTime(0.0001, now);
    gain4.gain.linearRampToValueAtTime(0.12 * safeIntensity, now + 1.2);
    gain4.gain.setValueAtTime(0.12 * safeIntensity, now + duration - 1.0);
    gain4.gain.exponentialRampToValueAtTime(0.00001, now + duration + 0.4);

    osc4.connect(gain4);
    gain4.connect(master);
    osc4.start(now);
    osc4.stop(now + duration + 0.5);

    return true;
  }

  /**
   * 3. 8s Exhale Release (8초 날숨 이완음)
   * 8초 동안 몸의 긴장이 풀리며 낮게 가라앉는 하향 필터 스윕과 온화한 서브 베이스 릴리즈
   */
  static playExhaleRelease(ctx, destination, {
    intensity = 0.75,
    basePitch = 108,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const duration = 8.0;
    const f0 = basePitch || 108;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28 * safeIntensity, now);
    master.connect(destination);

    // 1. Grounding Tone (108Hz fundamental + 54Hz sub-bass)
    const oscMain = ctx.createOscillator();
    const gainMain = ctx.createGain();
    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(f0, now);

    gainMain.gain.setValueAtTime(0.0001, now);
    gainMain.gain.linearRampToValueAtTime(0.52 * safeIntensity, now + 0.5);
    gainMain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    oscMain.connect(gainMain);
    gainMain.connect(master);
    oscMain.start(now);
    oscMain.stop(now + duration + 0.1);

    const oscSub = ctx.createOscillator();
    const gainSub = ctx.createGain();
    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(f0 * 0.5, now);

    gainSub.gain.setValueAtTime(0.0001, now);
    gainSub.gain.linearRampToValueAtTime(0.38 * safeIntensity, now + 0.6);
    gainSub.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    oscSub.connect(gainSub);
    gainSub.connect(master);
    oscSub.start(now);
    oscSub.stop(now + duration + 0.1);

    // 2. Downward Vacuum Exhalation Air Release (950Hz -> 75Hz)
    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.5);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(75, now + duration * 0.85);
    filter.Q.setValueAtTime(1.2, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.30 * safeIntensity, now + 0.3);
    noiseGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);

    noiseSource.start(now);
    noiseSource.stop(now + duration + 0.1);

    return true;
  }

  /**
   * 4. Deep Cosmic Temple Gong (묵직한 108Hz 대종 / 범종 타종음)
   * 풍경 소리가 아닌, 묵직하고 깊은 108Hz 청동 대종 타종음과 1.2Hz 맥놀이 여운
   */
  static playPhaseChime(ctx, destination, {
    intensity = 0.75,
    basePitch = 108,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.002;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const duration = 4.8;
    const f0 = basePitch || 108;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.30 * safeIntensity, now);
    master.connect(destination);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(1800, now);
    masterFilter.Q.setValueAtTime(1.2, now);
    masterFilter.connect(master);

    // 1. Heavy Wooden Mallet Impact Thud (당목 타격 저음)
    const oscMallet = ctx.createOscillator();
    const gainMallet = ctx.createGain();
    oscMallet.type = 'sine';
    oscMallet.frequency.setValueAtTime(140, now);
    oscMallet.frequency.exponentialRampToValueAtTime(80, now + 0.05);

    gainMallet.gain.setValueAtTime(0.0001, now);
    gainMallet.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 0.003);
    gainMallet.gain.exponentialRampToValueAtTime(0.00001, now + 0.08);

    oscMallet.connect(gainMallet);
    gainMallet.connect(masterFilter);
    oscMallet.start(now);
    oscMallet.stop(now + 0.1);

    // 2. Fundamental 108Hz Sacred Bronze Tone (108Hz 대종 기음)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f0, now);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.72 * safeIntensity, now + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.28 * safeIntensity, now + 0.9);
    gain1.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    osc1.connect(gain1);
    gain1.connect(masterFilter);
    osc1.start(now);
    osc1.stop(now + duration + 0.1);

    // 3. 1.2Hz Undulating Beating Twin (대종 맥놀이)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f0 + 1.2, now);

    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.52 * safeIntensity, now + 0.006);
    gain2.gain.exponentialRampToValueAtTime(0.00001, now + duration * 0.9);

    osc2.connect(gain2);
    gain2.connect(masterFilter);
    osc2.start(now);
    osc2.stop(now + duration + 0.1);

    // 4. Bronze Resonant Harmonics (216Hz, 324Hz, 540Hz, 864Hz)
    const harmonics = [
      { mult: 2.0, gain: 0.35, dur: 3.8 },
      { mult: 3.0, gain: 0.20, dur: 2.5 },
      { mult: 5.0, gain: 0.10, dur: 1.6 },
      { mult: 8.0, gain: 0.04, dur: 0.9 },
    ];

    harmonics.forEach(({ mult, gain, dur }) => {
      const oscH = ctx.createOscillator();
      const gainH = ctx.createGain();
      oscH.type = 'sine';
      oscH.frequency.setValueAtTime(f0 * mult, now);

      gainH.gain.setValueAtTime(0.0001, now);
      gainH.gain.linearRampToValueAtTime(gain * safeIntensity, now + 0.004);
      gainH.gain.exponentialRampToValueAtTime(0.00001, now + dur);

      oscH.connect(gainH);
      gainH.connect(masterFilter);
      oscH.start(now);
      oscH.stop(now + dur + 0.05);
    });

    return true;
  }

  /**
   * 5. Somatic Grounding Friction Charge (감압 접지 충전음)
   * 스페이스바를 누르는 1.8초 동안 심신을 가라앉히는 72Hz->108Hz 상승 마찰음과 보텍스 압축감
   */
  static playGroundingCharge(ctx, destination, {
    intensity = 0.75,
    basePitch = 108,
    duration = 1.8,
    startAt = null,
    stopRef = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const f0 = basePitch || 108;
    const chargeDuration = Math.max(0.5, Number(duration) || 1.8);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28 * safeIntensity, now);
    master.connect(destination);

    // 1. Somatic Core Osc (72Hz -> 108Hz sweep)
    const oscCore = ctx.createOscillator();
    const gainCore = ctx.createGain();
    oscCore.type = 'sine';
    oscCore.frequency.setValueAtTime(f0 * 0.667, now);
    oscCore.frequency.exponentialRampToValueAtTime(f0, now + chargeDuration);

    gainCore.gain.setValueAtTime(0.0001, now);
    gainCore.gain.exponentialRampToValueAtTime(0.50 * safeIntensity, now + chargeDuration);

    oscCore.connect(gainCore);
    gainCore.connect(master);
    oscCore.start(now);
    oscCore.stop(now + chargeDuration + 0.2);

    // 2. Sub-Harmonic Weight (36Hz -> 54Hz sweep)
    const oscSub = ctx.createOscillator();
    const gainSub = ctx.createGain();
    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(f0 * 0.333, now);
    oscSub.frequency.exponentialRampToValueAtTime(f0 * 0.5, now + chargeDuration);

    gainSub.gain.setValueAtTime(0.0001, now);
    gainSub.gain.exponentialRampToValueAtTime(0.35 * safeIntensity, now + chargeDuration);

    oscSub.connect(gainSub);
    gainSub.connect(master);
    oscSub.start(now);
    oscSub.stop(now + chargeDuration + 0.2);

    // 3. Resonant Harmonic Emergence (144Hz -> 216Hz, later half)
    const oscOvertone = ctx.createOscillator();
    const gainOvertone = ctx.createGain();
    oscOvertone.type = 'sine';
    oscOvertone.frequency.setValueAtTime(f0 * 1.333, now);
    oscOvertone.frequency.exponentialRampToValueAtTime(f0 * 2.0, now + chargeDuration);

    gainOvertone.gain.setValueAtTime(0.0001, now);
    gainOvertone.gain.setValueAtTime(0.0001, now + chargeDuration * 0.4);
    gainOvertone.gain.exponentialRampToValueAtTime(0.28 * safeIntensity, now + chargeDuration);

    oscOvertone.connect(gainOvertone);
    gainOvertone.connect(master);
    oscOvertone.start(now);
    oscOvertone.stop(now + chargeDuration + 0.2);

    // 4. Cosmic Vortex Air Charge (180Hz -> 420Hz bandpass)
    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, chargeDuration + 0.3);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const vortexFilter = ctx.createBiquadFilter();
    vortexFilter.type = 'bandpass';
    vortexFilter.frequency.setValueAtTime(180, now);
    vortexFilter.frequency.exponentialRampToValueAtTime(420, now + chargeDuration);
    vortexFilter.Q.setValueAtTime(2.5, now);

    const vortexGain = ctx.createGain();
    vortexGain.gain.setValueAtTime(0.0001, now);
    vortexGain.gain.exponentialRampToValueAtTime(0.22 * safeIntensity, now + chargeDuration);

    noiseSource.connect(vortexFilter);
    vortexFilter.connect(vortexGain);
    vortexGain.connect(master);

    noiseSource.start(now);
    noiseSource.stop(now + chargeDuration + 0.2);

    if (stopRef && typeof stopRef === 'object') {
      stopRef.stop = (fadeSec = 0.15) => {
        try {
          const stopTime = ctx.currentTime + 0.002;
          master.gain.setValueAtTime(master.gain.value, stopTime);
          master.gain.exponentialRampToValueAtTime(0.00001, stopTime + fadeSec);
          const haltTime = stopTime + fadeSec + 0.05;
          oscCore.stop(haltTime);
          oscSub.stop(haltTime);
          oscOvertone.stop(haltTime);
          noiseSource.stop(haltTime);
        } catch {
          // Already stopped
        }
      };
    }

    return true;
  }
}
