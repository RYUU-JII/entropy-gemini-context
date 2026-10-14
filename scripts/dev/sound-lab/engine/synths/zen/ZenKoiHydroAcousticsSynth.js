/**
 * ZenKoiHydroAcousticsSynth - Physical Hydro-Acoustic Synthesizer for Site Furin Koi Ritual.
 * Synthesizes fluid dynamics: surface tension emergence, laminar hydrofoil glide,
 * cross-current rendezvous, deep submerge dive, and tranquil water surface settlement.
 */

import { NoiseGenerator } from '../../primitives/NoiseGenerator.js';
import { FluidAcoustics } from '../../primitives/FluidAcoustics.js';

export class ZenKoiHydroAcousticsSynth {
  /**
   * 1. 잉어 수면 부상음 (Koi Wake Emerge)
   * 깊은 물속에서 가이드 잉어가 솟아오르며 표면 장력을 밀어올리는 부드러운 수류 스웰과 미세 기포
   */
  static playWakeSurface(ctx, destination, {
    intensity = 0.75,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const duration = 1.1;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.35 * safeIntensity, now);
    master.connect(destination);

    // 1. Hydro-Acoustic Swell (220Hz -> 680Hz Bandpass Sweep)
    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(680, now + duration * 0.65);
    filter.frequency.exponentialRampToValueAtTime(320, now + duration);
    filter.Q.setValueAtTime(3.5, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.75 * safeIntensity, now + duration * 0.45);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);

    source.start(now);
    source.stop(now + duration + 0.05);

    // 2. Surface Tension Break Micro-Bubble (t = 0.42s)
    FluidAcoustics.scheduleDroplet(ctx, master, {
      startAt: now + 0.42,
      startFreq: 380,
      endFreq: 920,
      duration: 0.07,
      gain: 0.28 * safeIntensity,
    });

    FluidAcoustics.scheduleDroplet(ctx, master, {
      startAt: now + 0.58,
      startFreq: 520,
      endFreq: 1180,
      duration: 0.05,
      gain: 0.18 * safeIntensity,
    });

    return true;
  }

  /**
   * 2. 잉어 유영 수류음 루프 (Koi Hydrofoil Glide Loop)
   * 물살을 유선형으로 가르며 나아가는 340Hz/850Hz 듀얼 밴드패스 층류 수류음 + 0.85Hz 꼬리 유영 모듈레이션
   */
  static playGlideLoop(ctx, destination, {
    intensity = 0.75,
    duration = 2.4,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.26 * safeIntensity, now);
    master.connect(destination);

    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.3);

    // Stream Layer 1: Body Laminar Flow (340 Hz)
    const src1 = ctx.createBufferSource();
    src1.buffer = noiseBuffer;
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.frequency.setValueAtTime(340, now);
    filter1.Q.setValueAtTime(2.8, now);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.65 * safeIntensity, now + 0.35);
    gain1.gain.setValueAtTime(0.65 * safeIntensity, now + duration - 0.4);
    gain1.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    src1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(master);
    src1.start(now);
    src1.stop(now + duration + 0.05);

    // Stream Layer 2: Fin & Wake Hydrofoil (850 Hz)
    const src2 = ctx.createBufferSource();
    src2.buffer = noiseBuffer;
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'bandpass';
    filter2.frequency.setValueAtTime(850, now);
    filter2.Q.setValueAtTime(4.2, now);

    // Tail-sweep wave modulation (0.85 Hz LFO)
    const steps = Math.floor(duration * 12);
    for (let i = 0; i <= steps; i += 1) {
      const t = now + (i / steps) * duration;
      const wave = Math.sin((i / steps) * duration * Math.PI * 2 * 0.85);
      const modulatedFreq = 850 + wave * 180;
      filter2.frequency.exponentialRampToValueAtTime(Math.max(200, modulatedFreq), t);
    }

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.35 * safeIntensity, now + 0.35);
    gain2.gain.setValueAtTime(0.35 * safeIntensity, now + duration - 0.4);
    gain2.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    src2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(master);
    src2.start(now);
    src2.stop(now + duration + 0.05);

    return true;
  }

  /**
   * 3. 동료 잉어 합류음 (Companion Koi Rendezvous)
   * 두 물살이 교차하며 소용돌이치는 유체 스월(450Hz -> 920Hz)과 조화로운 수면 리플
   */
  static playRendezvous(ctx, destination, {
    intensity = 0.75,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const duration = 0.9;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.32 * safeIntensity, now);
    master.connect(destination);

    // Cross-Current Swirl (450Hz -> 920Hz -> 480Hz)
    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(920, now + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(480, now + duration);
    filter.Q.setValueAtTime(4.0, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.70 * safeIntensity, now + duration * 0.35);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);

    source.start(now);
    source.stop(now + duration + 0.05);

    // Convergent Ripple Droplet (Harmonious Water Chirp)
    FluidAcoustics.scheduleDroplet(ctx, master, {
      startAt: now + 0.28,
      startFreq: 460,
      endFreq: 1040,
      duration: 0.08,
      gain: 0.30 * safeIntensity,
    });

    return true;
  }

  /**
   * 4. 잉어 군집 잠수음 (School Descent Dive)
   * 5마리가 심연으로 잠수하는 하향 900Hz -> 180Hz 수중 필터 스윕과 묵직한 서브 글라이드
   */
  static playDescentDive(ctx, destination, {
    intensity = 0.75,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const duration = 1.4;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.34 * safeIntensity, now);
    master.connect(destination);

    // 1. Downward Hydro-Filter Sweep (900Hz -> 180Hz)
    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + duration * 0.85);
    filter.Q.setValueAtTime(3.2, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.80 * safeIntensity, now + 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);

    source.start(now);
    source.stop(now + duration + 0.05);

    // 2. Sub-Frequency Hydro Damping Wave (135Hz -> 58Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(135, now);
    subOsc.frequency.exponentialRampToValueAtTime(58, now + duration * 0.9);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 0.30);
    subGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    subOsc.connect(subGain);
    subGain.connect(master);

    subOsc.start(now);
    subOsc.stop(now + duration + 0.05);

    return true;
  }

  /**
   * 5. 수면 안정 잔물결음 (Water Surface Settle)
   * 잔물결이 잦아들며 고요로 돌아가는 400Hz 로우패스 잔물결 감쇠음
   */
  static playWaterSettle(ctx, destination, {
    intensity = 0.75,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const duration = 1.6;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28 * safeIntensity, now);
    master.connect(destination);

    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + duration);
    filter.Q.setValueAtTime(1.5, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.55 * safeIntensity, now + 0.20);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);

    source.start(now);
    source.stop(now + duration + 0.05);

    return true;
  }
}
