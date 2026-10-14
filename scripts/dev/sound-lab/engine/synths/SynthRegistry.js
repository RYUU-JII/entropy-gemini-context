/**
 * SynthRegistry maps sound target IDs to their modular synth engine implementations.
 */

import { ShishiOdoshiClackSynth } from './zen/ShishiOdoshiClackSynth.js';
import { ShishiOdoshiWaterLoopSynth } from './zen/ShishiOdoshiWaterLoopSynth.js';
import { ZenFurinGlassClinkSynth } from './zen/ZenFurinGlassClinkSynth.js';
import { ZenKoiHydroAcousticsSynth } from './zen/ZenKoiHydroAcousticsSynth.js';
import { ZenRoom478BreathingSynth } from './zen/ZenRoom478BreathingSynth.js';
import { ZenGlobalSentinelRiftSynth } from './zen/ZenGlobalSentinelRiftSynth.js';
import { ZenSingingBowlSynth } from './zen/ZenSingingBowlSynth.js';
import { TerminalDataPulseSynth } from './entropy/TerminalDataPulseSynth.js';
import { IndustrialConsoleHumSynth } from './entropy/IndustrialConsoleHumSynth.js';
import { NeonGlitchClickSynth } from './cyberpunk/NeonGlitchClickSynth.js';
import { DigitalRainCascadeSynth } from './matrix/DigitalRainCascadeSynth.js';
import { ModalResonanceBank } from '../primitives/ModalResonanceBank.js';

export class SynthRegistry {
  constructor() {
    this.registry = new Map();
    this.registerDefaults();
  }

  register(soundId, synthHandler) {
    this.registry.set(soundId, synthHandler);
  }

  get(soundId) {
    const handler = this.registry.get(soundId);
    if (!handler) throw new Error(`SOUND_LAB_SYNTH_UNREGISTERED:${soundId}`);
    return handler;
  }

  has(soundId) {
    return this.registry.has(soundId);
  }

  registerDefaults() {
    // Zen Shishi-odoshi
    this.register('zen.shishi_odoshi.clack', (ctx, dest, opts) => ShishiOdoshiClackSynth.play(ctx, dest, opts));
    this.register('zen.shishi_odoshi.water_loop', (ctx, dest, opts) => ShishiOdoshiWaterLoopSynth.play(ctx, dest, opts));
    this.register('zen.shishi_odoshi.overflow_loop', (ctx, dest, opts) => ShishiOdoshiWaterLoopSynth.playOverflow(ctx, dest, opts));

    // Zen Furin Glass Clink
    this.register('ritual.site_furin.prelude_chime', (ctx, dest, opts) => ZenFurinGlassClinkSynth.play(ctx, dest, { ...opts, protocolScope: 'site' }));
    this.register('ritual.global_sentinel.koi_accept', (ctx, dest, opts) => ZenFurinGlassClinkSynth.play(ctx, dest, { ...opts, protocolScope: 'global' }));
    this.register('ritual.site_furin.settle_complete', (ctx, dest, opts) => ZenSingingBowlSynth.play(ctx, dest, opts));

    // Zen Site Furin Koi Hydro Protocol
    this.register('ritual.site_furin.koi_wake_surface', (ctx, dest, opts) => ZenKoiHydroAcousticsSynth.playWakeSurface(ctx, dest, opts));
    this.register('ritual.site_furin.koi_glide_loop', (ctx, dest, opts) => ZenKoiHydroAcousticsSynth.playGlideLoop(ctx, dest, opts));
    this.register('ritual.site_furin.koi_rendezvous', (ctx, dest, opts) => ZenKoiHydroAcousticsSynth.playRendezvous(ctx, dest, opts));
    this.register('ritual.site_furin.koi_descent_dive', (ctx, dest, opts) => ZenKoiHydroAcousticsSynth.playDescentDive(ctx, dest, opts));
    this.register('ritual.site_furin.water_settle_calm', (ctx, dest, opts) => ZenKoiHydroAcousticsSynth.playWaterSettle(ctx, dest, opts));

    // Zen Room 478 (4-7-8 Breathing Suite)
    this.register('room478.breath.inhale_swell', (ctx, dest, opts) => ZenRoom478BreathingSynth.playInhaleSwell(ctx, dest, opts));
    this.register('room478.breath.hold_drone', (ctx, dest, opts) => ZenRoom478BreathingSynth.playHoldDrone(ctx, dest, opts));
    this.register('room478.breath.exhale_release', (ctx, dest, opts) => ZenRoom478BreathingSynth.playExhaleRelease(ctx, dest, opts));
    this.register('room478.bell.phase_chime', (ctx, dest, opts) => ZenRoom478BreathingSynth.playPhaseChime(ctx, dest, opts));
    this.register('room478.grounding.charge', (ctx, dest, opts) => ZenRoom478BreathingSynth.playGroundingCharge(ctx, dest, opts));

    // Zen Global Sentinel Rift Suite
    this.register('ritual.global_sentinel.simulation_rupture', (ctx, dest, opts) => ZenGlobalSentinelRiftSynth.playSimulationRupture(ctx, dest, opts));
    this.register('ritual.global_sentinel.repair_telegraph', (ctx, dest, opts) => ZenGlobalSentinelRiftSynth.playRepairTelegraph(ctx, dest, opts));
    this.register('ritual.global_sentinel.intervention_hit', (ctx, dest, opts) => ZenGlobalSentinelRiftSynth.playInterventionHit(ctx, dest, opts));
    this.register('ritual.global_sentinel.terminal_breach', (ctx, dest, opts) => ZenGlobalSentinelRiftSynth.playTerminalBreach(ctx, dest, opts));
    this.register('ritual.global_sentinel.failure_seal', (ctx, dest, opts) => ZenGlobalSentinelRiftSynth.playFailureSeal(ctx, dest, opts));

    // Zen Ambient Soundscapes
    this.register('ritual.site_furin.soundscape', (ctx, dest, opts = {}) => {
      const now = ctx.currentTime + 0.005;
      const intensity = opts.intensity || 0.7;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.25 * intensity, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
      master.connect(dest);

      // Pentatonic chord pads (D - F# - A - B)
      [293.66, 369.99, 440.0, 493.88].forEach((freq, idx) => {
        ModalResonanceBank.schedulePartial(ctx, master, {
          frequency: freq,
          startAt: now + idx * 0.05,
          duration: 2.2,
          attack: 0.15,
          gain: 0.25 * intensity,
          type: 'sine',
        });
      });
      return true;
    });

    this.register('ritual.site_furin.underwater_loop', (ctx, dest, opts = {}) => {
      const now = ctx.currentTime + 0.005;
      const intensity = opts.intensity || 0.7;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.3 * intensity, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
      master.connect(dest);

      // Deep cavern sub drone
      const sub = ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(75, now);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, now);
      sg.gain.exponentialRampToValueAtTime(0.4 * intensity, now + 0.1);
      sg.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
      sub.connect(sg);
      sg.connect(master);
      sub.start(now);
      sub.stop(now + 2.05);
      return true;
    });

    // Entropy Theme
    this.register('entropy.data_overflow.pulse', (ctx, dest, opts) => TerminalDataPulseSynth.play(ctx, dest, opts));
    this.register('entropy.console.idle_drone', (ctx, dest, opts) => IndustrialConsoleHumSynth.play(ctx, dest, opts));

    // Cyberpunk Theme
    this.register('cyberpunk.neon.glitch_click', (ctx, dest, opts) => NeonGlitchClickSynth.play(ctx, dest, opts));

    // Matrix Theme
    this.register('matrix.digital_rain.chime', (ctx, dest, opts) => DigitalRainCascadeSynth.play(ctx, dest, opts));
  }
}

let defaultSynthRegistry = null;

export function getDefaultSynthRegistry() {
  if (!defaultSynthRegistry) {
    defaultSynthRegistry = new SynthRegistry();
  }
  return defaultSynthRegistry;
}
