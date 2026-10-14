globalThis.ENTROPY_SOUND_LAB_BUILD_REVISION = "95e9919427b7452d2c2a86fc3538fd420c3bd3bb3a677380043170ccda9a5176";
(() => {
  // src/domains/sound/catalog/soundCueIds.js
  var SOUND_MIX_BUS_IDS = Object.freeze({
    SFX: "sfx",
    RITUAL: "ritual",
    AMBIENT: "ambient",
    MUSIC: "music"
  });
  var SOUND_CUE_IDS = Object.freeze({
    RITUAL_SITE_FURIN_PRELUDE_CHIME: "ritual.site_furin.prelude_chime",
    RITUAL_SITE_FURIN_SUBMERGE_IN: "ritual.site_furin.submerge_in",
    RITUAL_SITE_FURIN_KOI_ACCEPT: "ritual.site_furin.koi_accept",
    RITUAL_SITE_FURIN_SURFACE_OUT: "ritual.site_furin.surface_out",
    RITUAL_SITE_FURIN_KOI_WAKE_SURFACE: "ritual.site_furin.koi_wake_surface",
    RITUAL_SITE_FURIN_KOI_RENDEZVOUS: "ritual.site_furin.koi_rendezvous",
    RITUAL_SITE_FURIN_KOI_DESCENT_DIVE: "ritual.site_furin.koi_descent_dive",
    RITUAL_SITE_FURIN_WATER_SETTLE_CALM: "ritual.site_furin.water_settle_calm",
    RITUAL_SITE_FURIN_SETTLE_COMPLETE: "ritual.site_furin.settle_complete",
    RITUAL_GLOBAL_SENTINEL_KOI_ACCEPT: "ritual.global_sentinel.koi_accept",
    RITUAL_GLOBAL_SENTINEL_SIMULATION_RUPTURE: "ritual.global_sentinel.simulation_rupture",
    RITUAL_GLOBAL_SENTINEL_INTERVENTION_HIT: "ritual.global_sentinel.intervention_hit",
    RITUAL_GLOBAL_SENTINEL_TERMINAL_BREACH: "ritual.global_sentinel.terminal_breach",
    RITUAL_GLOBAL_SENTINEL_FAILURE_SEAL: "ritual.global_sentinel.failure_seal",
    ROOM478_BREATH_INHALE_SWELL: "room478.breath.inhale_swell",
    ROOM478_BREATH_EXHALE_RELEASE: "room478.breath.exhale_release",
    ROOM478_BELL_PHASE_CHIME: "room478.bell.phase_chime",
    ROOM478_GROUNDING_CHARGE: "room478.grounding.charge",
    ZEN_SHISHI_ODOSHI_CLACK: "zen.shishi_odoshi.clack"
  });
  var SOUND_SCENE_IDS = Object.freeze({
    RITUAL_SITE_FURIN_KOI_GLIDE_LOOP: "ritual.site_furin.koi_glide_loop",
    RITUAL_SITE_FURIN_SOUNDSCAPE: "ritual.site_furin.soundscape",
    RITUAL_SITE_FURIN_UNDERWATER_LOOP: "ritual.site_furin.underwater_loop",
    RITUAL_GLOBAL_SENTINEL_REPAIR_TELEGRAPH: "ritual.global_sentinel.repair_telegraph",
    ROOM478_BREATH_HOLD_DRONE: "room478.breath.hold_drone",
    ZEN_SHISHI_ODOSHI_WATER_LOOP: "zen.shishi_odoshi.water_loop",
    ZEN_SHISHI_ODOSHI_OVERFLOW_LOOP: "zen.shishi_odoshi.overflow_loop"
  });
  var SOUND_CUE_ID_SET = new Set(Object.values(SOUND_CUE_IDS));
  var SOUND_SCENE_ID_SET = new Set(Object.values(SOUND_SCENE_IDS));

  // src/domains/sound/catalog/soundDescriptorKinds.js
  var SOUND_DESCRIPTOR_KINDS = Object.freeze({
    SYNTH: "synth",
    ASSET: "asset",
    SILENT: "silent"
  });

  // src/platform/audio/webAudioEngine.js
  var sharedAudioContext = null;
  function getSharedAudioContext({
    audioContext = null,
    AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext,
    onError = null
  } = {}) {
    if (audioContext) return audioContext;
    if (sharedAudioContext) return sharedAudioContext;
    if (typeof AudioContextCtor !== "function") return null;
    try {
      sharedAudioContext = new AudioContextCtor();
      return sharedAudioContext;
    } catch (error) {
      sharedAudioContext = null;
      onError?.(error);
      return null;
    }
  }
  function resumeAudioContextIfSuspended(ctx, {
    onError = null
  } = {}) {
    if (!ctx || ctx.state !== "suspended" || typeof ctx.resume !== "function") {
      return false;
    }
    void ctx.resume().catch((error) => {
      onError?.(error);
    });
    return true;
  }

  // src/themes/plugins/zen/sound/zenFurinGlassClinkSynth.js
  function reportAudioFailure(phase, error, {
    diagnosticReporter = null,
    consoleRef = console
  } = {}) {
    if (typeof diagnosticReporter === "function") {
      return diagnosticReporter(phase, error, consoleRef);
    }
    const diagnostic = {
      code: `zen_furin_glass_clink_${phase || "unknown"}_failed`,
      error: String(error?.message || error || "audio_failed")
    };
    consoleRef?.warn?.("[zen sound] furin glass clink failed", diagnostic);
    return diagnostic;
  }
  function playZenFurinGlassClinkSynth({
    protocolScope = "site",
    intensity = 0.75,
    basePitch = 3136,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure("context_create", error, {
        diagnosticReporter,
        consoleRef
      })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure("resume", error, {
        diagnosticReporter,
        consoleRef
      })
    });
    try {
      const now = ctx.currentTime + 2e-3;
      const isGlobal = protocolScope === "global";
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const jitter = 0.998 + Math.random() * 4e-3;
      const fCup = (isGlobal ? 2093 : basePitch || 3136) * jitter;
      const fRod = fCup * 1.578;
      const fRimFlash = fCup * 2.63;
      const master = ctx.createGain();
      master.gain.setValueAtTime((isGlobal ? 0.28 : 0.22) * safeIntensity, now);
      master.connect(ctx.destination);
      const oscFlash = ctx.createOscillator();
      const gainFlash = ctx.createGain();
      oscFlash.type = "sine";
      oscFlash.frequency.setValueAtTime(fRimFlash, now);
      gainFlash.gain.setValueAtTime(1e-4, now);
      gainFlash.gain.linearRampToValueAtTime(0.22 * safeIntensity, now + 2e-4);
      gainFlash.gain.exponentialRampToValueAtTime(1e-5, now + 0.06);
      oscFlash.connect(gainFlash);
      gainFlash.connect(master);
      oscFlash.start(now);
      oscFlash.stop(now + 0.08);
      const fRodTwin = fRod + (isGlobal ? 1.5 : 2.4);
      const rodDecay = isGlobal ? 0.8 : 0.48;
      const oscRodA = ctx.createOscillator();
      const gainRodA = ctx.createGain();
      oscRodA.type = "sine";
      oscRodA.frequency.setValueAtTime(fRod, now);
      const peakRodA = 0.58 * safeIntensity;
      gainRodA.gain.setValueAtTime(1e-4, now);
      gainRodA.gain.linearRampToValueAtTime(peakRodA, now + 3e-4);
      gainRodA.gain.exponentialRampToValueAtTime(1e-5, now + rodDecay);
      oscRodA.connect(gainRodA);
      gainRodA.connect(master);
      oscRodA.start(now);
      oscRodA.stop(now + rodDecay + 0.03);
      const oscRodB = ctx.createOscillator();
      const gainRodB = ctx.createGain();
      oscRodB.type = "sine";
      oscRodB.frequency.setValueAtTime(fRodTwin, now);
      const peakRodB = 0.36 * safeIntensity;
      gainRodB.gain.setValueAtTime(1e-4, now);
      gainRodB.gain.linearRampToValueAtTime(peakRodB, now + 3e-4);
      gainRodB.gain.exponentialRampToValueAtTime(1e-5, now + rodDecay * 0.85);
      oscRodB.connect(gainRodB);
      gainRodB.connect(master);
      oscRodB.start(now);
      oscRodB.stop(now + rodDecay + 0.03);
      const cupOnset = now + 0.014;
      const totalCupDecay = isGlobal ? 2 : 1.3;
      const stage1CupTime = cupOnset + (isGlobal ? 0.18 : 0.12);
      const fCupTwin = fCup + (isGlobal ? 1.8 : 3.2);
      const oscCupA = ctx.createOscillator();
      const gainCupA = ctx.createGain();
      oscCupA.type = "sine";
      oscCupA.frequency.setValueAtTime(fCup, cupOnset);
      const peakCupA = 0.65 * safeIntensity;
      const stage1CupA = peakCupA * 0.38;
      gainCupA.gain.setValueAtTime(1e-4, cupOnset);
      gainCupA.gain.linearRampToValueAtTime(peakCupA, cupOnset + 4e-4);
      gainCupA.gain.exponentialRampToValueAtTime(Math.max(1e-4, stage1CupA), stage1CupTime);
      gainCupA.gain.exponentialRampToValueAtTime(1e-5, cupOnset + totalCupDecay);
      oscCupA.connect(gainCupA);
      gainCupA.connect(master);
      oscCupA.start(cupOnset);
      oscCupA.stop(cupOnset + totalCupDecay + 0.03);
      const oscCupB = ctx.createOscillator();
      const gainCupB = ctx.createGain();
      oscCupB.type = "sine";
      oscCupB.frequency.setValueAtTime(fCupTwin, cupOnset);
      const peakCupB = 0.42 * safeIntensity;
      const stage1CupB = peakCupB * 0.35;
      gainCupB.gain.setValueAtTime(1e-4, cupOnset);
      gainCupB.gain.linearRampToValueAtTime(peakCupB, cupOnset + 4e-4);
      gainCupB.gain.exponentialRampToValueAtTime(Math.max(1e-4, stage1CupB), stage1CupTime);
      gainCupB.gain.exponentialRampToValueAtTime(1e-5, cupOnset + totalCupDecay * 0.9);
      oscCupB.connect(gainCupB);
      gainCupB.connect(master);
      oscCupB.start(cupOnset);
      oscCupB.stop(cupOnset + totalCupDecay + 0.03);
      return true;
    } catch (error) {
      reportAudioFailure("schedule", error, {
        diagnosticReporter,
        consoleRef
      });
      return false;
    }
  }

  // src/platform/audio/synth/modalPrimitives.js
  function scheduleModalPartial(ctx, destination, {
    frequency = 440,
    startAt = 0,
    duration = 0.2,
    attack = 2e-3,
    gain = 0.5,
    type = "sine",
    detune = 0,
    pitchDrop = false,
    pitchDropRatio = 2.4,
    pitchDropDuration = 0.01
  } = {}) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.detune.setValueAtTime(detune, startAt);
    if (pitchDrop) {
      osc.frequency.setValueAtTime(frequency * pitchDropRatio, startAt);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(10, frequency),
        startAt + pitchDropDuration
      );
    } else {
      osc.frequency.setValueAtTime(frequency, startAt);
    }
    gainNode.gain.setValueAtTime(1e-4, startAt);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(1e-4, gain),
      startAt + Math.max(1e-3, attack)
    );
    gainNode.gain.exponentialRampToValueAtTime(1e-4, startAt + duration);
    osc.connect(gainNode);
    gainNode.connect(destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
    return { osc, gainNode };
  }

  // src/platform/audio/synth/noisePrimitives.js
  var sharedNoiseBuffer = null;
  var sharedPinkNoiseBuffer = null;
  function getWhiteNoiseBuffer(ctx, durationSeconds = 0.5) {
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
  function getPinkNoiseBuffer(ctx, durationSeconds = 0.5) {
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
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    sharedPinkNoiseBuffer = buffer;
    return buffer;
  }
  function scheduleNoiseBurst(ctx, destination, {
    startAt,
    duration = 0.05,
    attack = 2e-3,
    gain = 0.5,
    noiseType = "white",
    filterType = "bandpass",
    filterFrequency = 1e3,
    filterQ = 4
  } = {}) {
    const noiseBuffer = noiseType === "pink" ? getPinkNoiseBuffer(ctx, Math.max(duration + 0.1, 0.5)) : getWhiteNoiseBuffer(ctx, Math.max(duration + 0.1, 0.5));
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFrequency, startAt);
    filter.Q.setValueAtTime(filterQ, startAt);
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(1e-4, startAt);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(1e-4, gain),
      startAt + Math.max(1e-3, attack)
    );
    gainNode.gain.exponentialRampToValueAtTime(1e-4, startAt + duration);
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(destination);
    source.start(startAt);
    source.stop(startAt + duration + 0.02);
    return { source, filter, gainNode };
  }

  // src/themes/plugins/zen/sound/zenShishiOdoshiClackSynth.js
  function reportAudioFailure2(phase, error, {
    diagnosticReporter = null,
    consoleRef = console
  } = {}) {
    if (typeof diagnosticReporter === "function") {
      return diagnosticReporter(phase, error, consoleRef);
    }
    const diagnostic = {
      code: `zen_shishi_odoshi_clack_${phase || "unknown"}_failed`,
      error: String(error?.message || error || "audio_failed")
    };
    consoleRef?.warn?.("[zen sound] shishi-odoshi clack failed", diagnostic);
    return diagnostic;
  }
  function playZenShishiOdoshiClackSynth({
    intensity = 0.72,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure2("context_create", error, {
        diagnosticReporter,
        consoleRef
      })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure2("resume", error, {
        diagnosticReporter,
        consoleRef
      })
    });
    try {
      const now = ctx.currentTime + 4e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.72));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.26 * safeIntensity, now);
      master.gain.exponentialRampToValueAtTime(1e-4, now + 0.28);
      master.connect(ctx.destination);
      const jitter = 0.982 + Math.random() * 0.036;
      scheduleNoiseBurst(ctx, master, {
        startAt: now,
        duration: 0.018,
        gain: 0.65 * safeIntensity,
        filterType: "bandpass",
        filterFrequency: 2800 * jitter,
        filterQ: 3.2
      });
      scheduleModalPartial(ctx, master, {
        frequency: 580 * jitter,
        startAt: now,
        duration: 0.018,
        gain: 0.5 * safeIntensity,
        type: "sine",
        pitchDrop: true
      });
      scheduleNoiseBurst(ctx, master, {
        startAt: now + 1e-3,
        duration: 0.065,
        gain: 0.45 * safeIntensity,
        filterType: "bandpass",
        filterFrequency: 760 * jitter,
        filterQ: 5.5
      });
      scheduleModalPartial(ctx, master, {
        frequency: 118 * jitter,
        startAt: now,
        duration: 0.075,
        gain: 0.38 * safeIntensity,
        type: "triangle"
      });
      scheduleModalPartial(ctx, master, {
        frequency: 468 * jitter,
        startAt: now + 1e-3,
        duration: 0.165,
        gain: 0.52 * safeIntensity,
        type: "sine"
      });
      scheduleModalPartial(ctx, master, {
        frequency: 875 * jitter,
        startAt: now + 1e-3,
        duration: 0.125,
        gain: 0.36 * safeIntensity,
        type: "sine"
      });
      scheduleModalPartial(ctx, master, {
        frequency: 1540 * jitter,
        startAt: now + 2e-3,
        duration: 0.075,
        gain: 0.24 * safeIntensity,
        type: "sine"
      });
      scheduleModalPartial(ctx, master, {
        frequency: 2720 * jitter,
        startAt: now + 2e-3,
        duration: 0.042,
        gain: 0.14 * safeIntensity,
        type: "sine"
      });
      const dropOsc = ctx.createOscillator();
      const dropGain = ctx.createGain();
      const dropStart = now + 0.18;
      const dropDuration = 0.055;
      dropOsc.type = "sine";
      dropOsc.frequency.setValueAtTime(480 * jitter, dropStart);
      dropOsc.frequency.exponentialRampToValueAtTime(1150 * jitter, dropStart + dropDuration * 0.4);
      dropOsc.frequency.exponentialRampToValueAtTime(820 * jitter, dropStart + dropDuration);
      dropGain.gain.setValueAtTime(1e-4, dropStart);
      dropGain.gain.exponentialRampToValueAtTime(0.22 * safeIntensity, dropStart + 3e-3);
      dropGain.gain.exponentialRampToValueAtTime(1e-5, dropStart + dropDuration);
      dropOsc.connect(dropGain);
      dropGain.connect(master);
      dropOsc.start(dropStart);
      dropOsc.stop(dropStart + dropDuration + 0.01);
      return true;
    } catch (error) {
      reportAudioFailure2("schedule", error, {
        diagnosticReporter,
        consoleRef
      });
      return false;
    }
  }

  // src/themes/plugins/zen/sound/zenKoiHydroAcousticsSynth.js
  function reportAudioFailure3(phase, error, {
    diagnosticReporter = null,
    consoleRef = console
  } = {}) {
    if (typeof diagnosticReporter === "function") {
      return diagnosticReporter(phase, error, consoleRef);
    }
    const diagnostic = {
      code: `zen_koi_hydro_${phase || "unknown"}_failed`,
      error: String(error?.message || error || "audio_failed")
    };
    consoleRef?.warn?.("[zen sound] koi hydro acoustics failed", diagnostic);
    return diagnostic;
  }
  function getPinkNoiseBuffer2(ctx, durationSec = 1) {
    const sampleRate = ctx.sampleRate || 44100;
    const bufferSize = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }
  function scheduleDroplet(ctx, dest, { startAt = 0, startFreq = 400, endFreq = 1100, duration = 0.06, gain = 0.35 } = {}) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, startAt);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startAt + duration * 0.4);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq * 0.8), startAt + duration);
    gainNode.gain.setValueAtTime(1e-4, startAt);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(1e-4, gain), startAt + 3e-3);
    gainNode.gain.exponentialRampToValueAtTime(1e-5, startAt + duration);
    osc.connect(gainNode);
    gainNode.connect(dest);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.015);
  }
  function playZenKoiWakeSurfaceSynth({
    intensity = 0.75,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure3("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure3("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 1.1;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.35 * safeIntensity, now);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer2(ctx, duration + 0.2);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.exponentialRampToValueAtTime(680, now + duration * 0.65);
      filter.frequency.exponentialRampToValueAtTime(320, now + duration);
      filter.Q.setValueAtTime(3.5, now);
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1e-4, now);
      gainNode.gain.linearRampToValueAtTime(0.75 * safeIntensity, now + duration * 0.45);
      gainNode.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      source.start(now);
      source.stop(now + duration + 0.05);
      scheduleDroplet(ctx, master, {
        startAt: now + 0.42,
        startFreq: 380,
        endFreq: 920,
        duration: 0.07,
        gain: 0.28 * safeIntensity
      });
      scheduleDroplet(ctx, master, {
        startAt: now + 0.58,
        startFreq: 520,
        endFreq: 1180,
        duration: 0.05,
        gain: 0.18 * safeIntensity
      });
      return true;
    } catch (error) {
      reportAudioFailure3("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenKoiGlideLoopSynth({
    intensity = 0.75,
    duration = 2.4,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure3("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure3("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.26 * safeIntensity, now);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer2(ctx, duration + 0.3);
      const src1 = ctx.createBufferSource();
      src1.buffer = noiseBuffer;
      const filter1 = ctx.createBiquadFilter();
      filter1.type = "bandpass";
      filter1.frequency.setValueAtTime(340, now);
      filter1.Q.setValueAtTime(2.8, now);
      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(1e-4, now);
      gain1.gain.linearRampToValueAtTime(0.65 * safeIntensity, now + 0.35);
      gain1.gain.setValueAtTime(0.65 * safeIntensity, now + duration - 0.4);
      gain1.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      src1.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(master);
      src1.start(now);
      src1.stop(now + duration + 0.05);
      const src2 = ctx.createBufferSource();
      src2.buffer = noiseBuffer;
      const filter2 = ctx.createBiquadFilter();
      filter2.type = "bandpass";
      filter2.frequency.setValueAtTime(850, now);
      filter2.Q.setValueAtTime(4.2, now);
      const steps = Math.floor(duration * 12);
      for (let i = 0; i <= steps; i += 1) {
        const t = now + i / steps * duration;
        const wave = Math.sin(i / steps * duration * Math.PI * 2 * 0.85);
        const modulatedFreq = 850 + wave * 180;
        filter2.frequency.exponentialRampToValueAtTime(Math.max(200, modulatedFreq), t);
      }
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(1e-4, now);
      gain2.gain.linearRampToValueAtTime(0.35 * safeIntensity, now + 0.35);
      gain2.gain.setValueAtTime(0.35 * safeIntensity, now + duration - 0.4);
      gain2.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      src2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(master);
      src2.start(now);
      src2.stop(now + duration + 0.05);
      return true;
    } catch (error) {
      reportAudioFailure3("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenKoiRendezvousSynth({
    intensity = 0.75,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure3("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure3("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 0.9;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.32 * safeIntensity, now);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer2(ctx, duration + 0.2);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(920, now + duration * 0.45);
      filter.frequency.exponentialRampToValueAtTime(480, now + duration);
      filter.Q.setValueAtTime(4, now);
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1e-4, now);
      gainNode.gain.linearRampToValueAtTime(0.7 * safeIntensity, now + duration * 0.35);
      gainNode.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      source.start(now);
      source.stop(now + duration + 0.05);
      scheduleDroplet(ctx, master, {
        startAt: now + 0.28,
        startFreq: 460,
        endFreq: 1040,
        duration: 0.08,
        gain: 0.3 * safeIntensity
      });
      return true;
    } catch (error) {
      reportAudioFailure3("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenKoiDescentDiveSynth({
    intensity = 0.75,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure3("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure3("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 1.4;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.34 * safeIntensity, now);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer2(ctx, duration + 0.2);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + duration * 0.85);
      filter.Q.setValueAtTime(3.2, now);
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1e-4, now);
      gainNode.gain.linearRampToValueAtTime(0.8 * safeIntensity, now + 0.25);
      gainNode.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      source.start(now);
      source.stop(now + duration + 0.05);
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(135, now);
      subOsc.frequency.exponentialRampToValueAtTime(58, now + duration * 0.9);
      subGain.gain.setValueAtTime(1e-4, now);
      subGain.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 0.3);
      subGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(now);
      subOsc.stop(now + duration + 0.05);
      return true;
    } catch (error) {
      reportAudioFailure3("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenWaterSettleCalmSynth({
    intensity = 0.75,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure3("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure3("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 1.6;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * safeIntensity, now);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer2(ctx, duration + 0.2);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + duration);
      filter.Q.setValueAtTime(1.5, now);
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1e-4, now);
      gainNode.gain.linearRampToValueAtTime(0.55 * safeIntensity, now + 0.2);
      gainNode.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      source.start(now);
      source.stop(now + duration + 0.05);
      return true;
    } catch (error) {
      reportAudioFailure3("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }

  // src/themes/plugins/zen/sound/zenRoom478BreathingSynth.js
  function reportAudioFailure4(phase, error, {
    diagnosticReporter = null,
    consoleRef = console
  } = {}) {
    if (typeof diagnosticReporter === "function") {
      return diagnosticReporter(phase, error, consoleRef);
    }
    const diagnostic = {
      code: `zen_room478_${phase || "unknown"}_failed`,
      error: String(error?.message || error || "audio_failed")
    };
    consoleRef?.warn?.("[zen sound] room478 breathing failed", diagnostic);
    return diagnostic;
  }
  function getPinkNoiseBuffer3(ctx, durationSec = 1) {
    const sampleRate = ctx.sampleRate || 44100;
    const bufferSize = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }
  function playZenRoom478InhaleSwellSynth({
    intensity = 0.75,
    basePitch = 108,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure4("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure4("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 4;
      const f0 = basePitch || 108;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.3 * safeIntensity, now);
      master.connect(ctx.destination);
      const chordFrequencies = [f0, f0 * 2, f0 * 3, f0 * 4];
      const chordGain = ctx.createGain();
      chordGain.gain.setValueAtTime(1e-4, now);
      chordGain.gain.exponentialRampToValueAtTime(0.68 * safeIntensity, now + duration * 0.85);
      chordGain.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.35);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(130, now);
      filter.frequency.exponentialRampToValueAtTime(850, now + duration);
      filter.Q.setValueAtTime(1.4, now);
      chordFrequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq + (idx * 0.25 - 0.35), now);
        osc.connect(chordGain);
        osc.start(now);
        osc.stop(now + duration + 0.4);
      });
      chordGain.connect(filter);
      filter.connect(master);
      const noiseBuffer = getPinkNoiseBuffer3(ctx, duration + 0.5);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const airFilter = ctx.createBiquadFilter();
      airFilter.type = "bandpass";
      airFilter.frequency.setValueAtTime(350, now);
      airFilter.frequency.exponentialRampToValueAtTime(900, now + duration);
      airFilter.Q.setValueAtTime(2.5, now);
      const airGain = ctx.createGain();
      airGain.gain.setValueAtTime(1e-4, now);
      airGain.gain.linearRampToValueAtTime(0.18 * safeIntensity, now + duration * 0.8);
      airGain.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.25);
      noiseSource.connect(airFilter);
      airFilter.connect(airGain);
      airGain.connect(master);
      noiseSource.start(now);
      noiseSource.stop(now + duration + 0.4);
      return true;
    } catch (error) {
      reportAudioFailure4("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenRoom478HoldDroneSynth({
    intensity = 0.75,
    basePitch = 216,
    duration = 7,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure4("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure4("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const f0 = basePitch || 216;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.26 * safeIntensity, now);
      master.connect(ctx.destination);
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(f0, now);
      gain1.gain.setValueAtTime(1e-4, now);
      gain1.gain.linearRampToValueAtTime(0.5 * safeIntensity, now + 0.8);
      gain1.gain.setValueAtTime(0.5 * safeIntensity, now + duration - 0.8);
      gain1.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.4);
      osc1.connect(gain1);
      gain1.connect(master);
      osc1.start(now);
      osc1.stop(now + duration + 0.5);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(f0 + 1.2, now);
      gain2.gain.setValueAtTime(1e-4, now);
      gain2.gain.linearRampToValueAtTime(0.38 * safeIntensity, now + 0.8);
      gain2.gain.setValueAtTime(0.38 * safeIntensity, now + duration - 0.8);
      gain2.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.4);
      osc2.connect(gain2);
      gain2.connect(master);
      osc2.start(now);
      osc2.stop(now + duration + 0.5);
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(f0 * 0.5, now);
      gain3.gain.setValueAtTime(1e-4, now);
      gain3.gain.linearRampToValueAtTime(0.3 * safeIntensity, now + 1);
      gain3.gain.setValueAtTime(0.3 * safeIntensity, now + duration - 0.9);
      gain3.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.4);
      osc3.connect(gain3);
      gain3.connect(master);
      osc3.start(now);
      osc3.stop(now + duration + 0.5);
      const osc4 = ctx.createOscillator();
      const gain4 = ctx.createGain();
      osc4.type = "sine";
      osc4.frequency.setValueAtTime(f0 * 3, now);
      gain4.gain.setValueAtTime(1e-4, now);
      gain4.gain.linearRampToValueAtTime(0.12 * safeIntensity, now + 1.2);
      gain4.gain.setValueAtTime(0.12 * safeIntensity, now + duration - 1);
      gain4.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.4);
      osc4.connect(gain4);
      gain4.connect(master);
      osc4.start(now);
      osc4.stop(now + duration + 0.5);
      return true;
    } catch (error) {
      reportAudioFailure4("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenRoom478ExhaleReleaseSynth({
    intensity = 0.75,
    basePitch = 108,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure4("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure4("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 8;
      const f0 = basePitch || 108;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * safeIntensity, now);
      master.connect(ctx.destination);
      const oscMain = ctx.createOscillator();
      const gainMain = ctx.createGain();
      oscMain.type = "sine";
      oscMain.frequency.setValueAtTime(f0, now);
      gainMain.gain.setValueAtTime(1e-4, now);
      gainMain.gain.linearRampToValueAtTime(0.52 * safeIntensity, now + 0.5);
      gainMain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      oscMain.connect(gainMain);
      gainMain.connect(master);
      oscMain.start(now);
      oscMain.stop(now + duration + 0.1);
      const oscSub = ctx.createOscillator();
      const gainSub = ctx.createGain();
      oscSub.type = "sine";
      oscSub.frequency.setValueAtTime(f0 * 0.5, now);
      gainSub.gain.setValueAtTime(1e-4, now);
      gainSub.gain.linearRampToValueAtTime(0.38 * safeIntensity, now + 0.6);
      gainSub.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      oscSub.connect(gainSub);
      gainSub.connect(master);
      oscSub.start(now);
      oscSub.stop(now + duration + 0.1);
      const noiseBuffer = getPinkNoiseBuffer3(ctx, duration + 0.5);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(950, now);
      filter.frequency.exponentialRampToValueAtTime(75, now + duration * 0.85);
      filter.Q.setValueAtTime(1.2, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(1e-4, now);
      noiseGain.gain.linearRampToValueAtTime(0.3 * safeIntensity, now + 0.3);
      noiseGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);
      noiseSource.start(now);
      noiseSource.stop(now + duration + 0.1);
      return true;
    } catch (error) {
      reportAudioFailure4("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenRoom478PhaseChimeSynth({
    intensity = 0.75,
    basePitch = 108,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure4("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure4("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 2e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 4.8;
      const f0 = basePitch || 108;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.3 * safeIntensity, now);
      master.connect(ctx.destination);
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = "lowpass";
      masterFilter.frequency.setValueAtTime(1800, now);
      masterFilter.Q.setValueAtTime(1.2, now);
      masterFilter.connect(master);
      const oscMallet = ctx.createOscillator();
      const gainMallet = ctx.createGain();
      oscMallet.type = "sine";
      oscMallet.frequency.setValueAtTime(140, now);
      oscMallet.frequency.exponentialRampToValueAtTime(80, now + 0.05);
      gainMallet.gain.setValueAtTime(1e-4, now);
      gainMallet.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 3e-3);
      gainMallet.gain.exponentialRampToValueAtTime(1e-5, now + 0.08);
      oscMallet.connect(gainMallet);
      gainMallet.connect(masterFilter);
      oscMallet.start(now);
      oscMallet.stop(now + 0.1);
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(f0, now);
      gain1.gain.setValueAtTime(1e-4, now);
      gain1.gain.linearRampToValueAtTime(0.72 * safeIntensity, now + 5e-3);
      gain1.gain.exponentialRampToValueAtTime(0.28 * safeIntensity, now + 0.9);
      gain1.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      osc1.connect(gain1);
      gain1.connect(masterFilter);
      osc1.start(now);
      osc1.stop(now + duration + 0.1);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(f0 + 1.2, now);
      gain2.gain.setValueAtTime(1e-4, now);
      gain2.gain.linearRampToValueAtTime(0.52 * safeIntensity, now + 6e-3);
      gain2.gain.exponentialRampToValueAtTime(1e-5, now + duration * 0.9);
      osc2.connect(gain2);
      gain2.connect(masterFilter);
      osc2.start(now);
      osc2.stop(now + duration + 0.1);
      const harmonics = [
        { mult: 2, gain: 0.35, dur: 3.8 },
        { mult: 3, gain: 0.2, dur: 2.5 },
        { mult: 5, gain: 0.1, dur: 1.6 },
        { mult: 8, gain: 0.04, dur: 0.9 }
      ];
      harmonics.forEach(({ mult, gain, dur }) => {
        const oscH = ctx.createOscillator();
        const gainH = ctx.createGain();
        oscH.type = "sine";
        oscH.frequency.setValueAtTime(f0 * mult, now);
        gainH.gain.setValueAtTime(1e-4, now);
        gainH.gain.linearRampToValueAtTime(gain * safeIntensity, now + 4e-3);
        gainH.gain.exponentialRampToValueAtTime(1e-5, now + dur);
        oscH.connect(gainH);
        gainH.connect(masterFilter);
        oscH.start(now);
        oscH.stop(now + dur + 0.05);
      });
      return true;
    } catch (error) {
      reportAudioFailure4("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenRoom478GroundingChargeSynth({
    intensity = 0.75,
    basePitch = 108,
    duration = 1.8,
    stopRef = null,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure4("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure4("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const f0 = basePitch || 108;
      const chargeDuration = Math.max(0.5, Number(duration) || 1.8);
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * safeIntensity, now);
      master.connect(ctx.destination);
      const oscCore = ctx.createOscillator();
      const gainCore = ctx.createGain();
      oscCore.type = "sine";
      oscCore.frequency.setValueAtTime(f0 * 0.667, now);
      oscCore.frequency.exponentialRampToValueAtTime(f0, now + chargeDuration);
      gainCore.gain.setValueAtTime(1e-4, now);
      gainCore.gain.exponentialRampToValueAtTime(0.5 * safeIntensity, now + chargeDuration);
      oscCore.connect(gainCore);
      gainCore.connect(master);
      oscCore.start(now);
      oscCore.stop(now + chargeDuration + 0.2);
      const oscSub = ctx.createOscillator();
      const gainSub = ctx.createGain();
      oscSub.type = "sine";
      oscSub.frequency.setValueAtTime(f0 * 0.333, now);
      oscSub.frequency.exponentialRampToValueAtTime(f0 * 0.5, now + chargeDuration);
      gainSub.gain.setValueAtTime(1e-4, now);
      gainSub.gain.exponentialRampToValueAtTime(0.35 * safeIntensity, now + chargeDuration);
      oscSub.connect(gainSub);
      gainSub.connect(master);
      oscSub.start(now);
      oscSub.stop(now + chargeDuration + 0.2);
      const oscOvertone = ctx.createOscillator();
      const gainOvertone = ctx.createGain();
      oscOvertone.type = "sine";
      oscOvertone.frequency.setValueAtTime(f0 * 1.333, now);
      oscOvertone.frequency.exponentialRampToValueAtTime(f0 * 2, now + chargeDuration);
      gainOvertone.gain.setValueAtTime(1e-4, now);
      gainOvertone.gain.setValueAtTime(1e-4, now + chargeDuration * 0.4);
      gainOvertone.gain.exponentialRampToValueAtTime(0.28 * safeIntensity, now + chargeDuration);
      oscOvertone.connect(gainOvertone);
      gainOvertone.connect(master);
      oscOvertone.start(now);
      oscOvertone.stop(now + chargeDuration + 0.2);
      const noiseBuffer = getPinkNoiseBuffer3(ctx, chargeDuration + 0.3);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const vortexFilter = ctx.createBiquadFilter();
      vortexFilter.type = "bandpass";
      vortexFilter.frequency.setValueAtTime(180, now);
      vortexFilter.frequency.exponentialRampToValueAtTime(420, now + chargeDuration);
      vortexFilter.Q.setValueAtTime(2.5, now);
      const vortexGain = ctx.createGain();
      vortexGain.gain.setValueAtTime(1e-4, now);
      vortexGain.gain.exponentialRampToValueAtTime(0.22 * safeIntensity, now + chargeDuration);
      noiseSource.connect(vortexFilter);
      vortexFilter.connect(vortexGain);
      vortexGain.connect(master);
      noiseSource.start(now);
      noiseSource.stop(now + chargeDuration + 0.2);
      if (stopRef && typeof stopRef === "object") {
        stopRef.stop = (fadeSec = 0.15) => {
          try {
            const stopTime = ctx.currentTime + 2e-3;
            master.gain.setValueAtTime(master.gain.value, stopTime);
            master.gain.exponentialRampToValueAtTime(1e-5, stopTime + fadeSec);
            const haltTime = stopTime + fadeSec + 0.05;
            oscCore.stop(haltTime);
            oscSub.stop(haltTime);
            oscOvertone.stop(haltTime);
            noiseSource.stop(haltTime);
          } catch {
          }
        };
      }
      return true;
    } catch (error) {
      reportAudioFailure4("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }

  // src/themes/plugins/zen/sound/zenShishiOdoshiWaterLoopSynth.js
  function reportAudioFailure5(phase, error, {
    diagnosticReporter = null,
    consoleRef = console
  } = {}) {
    if (typeof diagnosticReporter === "function") {
      return diagnosticReporter(phase, error, consoleRef);
    }
    const diagnostic = {
      code: `zen_shishi_water_${phase || "unknown"}_failed`,
      error: String(error?.message || error || "audio_failed")
    };
    consoleRef?.warn?.("[zen sound] shishi-odoshi water failed", diagnostic);
    return diagnostic;
  }
  function getPinkNoiseBuffer4(ctx, durationSec = 1) {
    const sampleRate = ctx.sampleRate || 44100;
    const bufferSize = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }
  function scheduleDroplet2(ctx, dest, { startAt = 0, startFreq = 400, endFreq = 1100, duration = 0.055, gain = 0.3 } = {}) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, startAt);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startAt + duration * 0.4);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq * 0.8), startAt + duration);
    gainNode.gain.setValueAtTime(1e-4, startAt);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(1e-4, gain), startAt + 3e-3);
    gainNode.gain.exponentialRampToValueAtTime(1e-5, startAt + duration);
    osc.connect(gainNode);
    gainNode.connect(dest);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.015);
  }
  function playZenShishiOdoshiWaterLoopSynth({
    intensity = 0.7,
    duration = 3.5,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure5("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure5("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 5e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.7));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * safeIntensity, now);
      master.gain.exponentialRampToValueAtTime(1e-4, now + duration);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer4(ctx, duration + 0.2);
      const streamSrc = ctx.createBufferSource();
      streamSrc.buffer = noiseBuffer;
      const streamFilter = ctx.createBiquadFilter();
      streamFilter.type = "bandpass";
      streamFilter.frequency.setValueAtTime(680, now);
      streamFilter.Q.setValueAtTime(3.8, now);
      const streamGain = ctx.createGain();
      streamGain.gain.setValueAtTime(1e-4, now);
      streamGain.gain.linearRampToValueAtTime(0.28 * safeIntensity, now + 0.2);
      streamGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      streamSrc.connect(streamFilter);
      streamFilter.connect(streamGain);
      streamGain.connect(master);
      streamSrc.start(now);
      streamSrc.stop(now + duration + 0.05);
      const cavitySrc = ctx.createBufferSource();
      cavitySrc.buffer = noiseBuffer;
      const cavityFilter = ctx.createBiquadFilter();
      cavityFilter.type = "bandpass";
      cavityFilter.frequency.setValueAtTime(920, now);
      cavityFilter.Q.setValueAtTime(6, now);
      const cavityGain = ctx.createGain();
      cavityGain.gain.setValueAtTime(1e-4, now);
      cavityGain.gain.linearRampToValueAtTime(0.18 * safeIntensity, now + 0.2);
      cavityGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      cavitySrc.connect(cavityFilter);
      cavityFilter.connect(cavityGain);
      cavityGain.connect(master);
      cavitySrc.start(now);
      cavitySrc.stop(now + duration + 0.05);
      const dropTimings = [0.12, 0.48, 0.95, 1.45, 2.1, 2.8];
      dropTimings.forEach((offset, idx) => {
        if (offset < duration) {
          scheduleDroplet2(ctx, master, {
            startAt: now + offset,
            startFreq: 340 + idx % 3 * 90,
            endFreq: 980 + idx % 3 * 140,
            duration: 0.055,
            gain: (0.3 + idx % 2 * 0.1) * safeIntensity
          });
        }
      });
      return true;
    } catch (error) {
      reportAudioFailure5("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenShishiOdoshiOverflowLoopSynth({
    intensity = 0.8,
    duration = 2.2,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure5("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure5("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 4e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.8));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.32 * safeIntensity, now);
      master.gain.exponentialRampToValueAtTime(1e-4, now + duration);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer4(ctx, duration + 0.3);
      const src1 = ctx.createBufferSource();
      src1.buffer = noiseBuffer;
      const filter1 = ctx.createBiquadFilter();
      filter1.type = "bandpass";
      filter1.frequency.setValueAtTime(420, now);
      filter1.frequency.exponentialRampToValueAtTime(680, now + duration * 0.4);
      filter1.frequency.exponentialRampToValueAtTime(260, now + duration);
      filter1.Q.setValueAtTime(2.5, now);
      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(1e-4, now);
      gain1.gain.linearRampToValueAtTime(0.75 * safeIntensity, now + 0.25);
      gain1.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      src1.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(master);
      src1.start(now);
      src1.stop(now + duration + 0.05);
      const src2 = ctx.createBufferSource();
      src2.buffer = noiseBuffer;
      const filter2 = ctx.createBiquadFilter();
      filter2.type = "bandpass";
      filter2.frequency.setValueAtTime(1400, now);
      filter2.frequency.exponentialRampToValueAtTime(950, now + duration * 0.7);
      filter2.Q.setValueAtTime(3.5, now);
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(1e-4, now);
      gain2.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      src2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(master);
      src2.start(now);
      src2.stop(now + duration + 0.05);
      const splashOffsets = [0.18, 0.32, 0.52, 0.78, 1.1];
      splashOffsets.forEach((offset, idx) => {
        if (offset < duration) {
          scheduleDroplet2(ctx, master, {
            startAt: now + offset,
            startFreq: 420 + idx * 80,
            endFreq: 1200 + idx * 90,
            duration: 0.045,
            gain: (0.28 + idx % 2 * 0.08) * safeIntensity
          });
        }
      });
      return true;
    } catch (error) {
      reportAudioFailure5("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }

  // src/themes/plugins/zen/sound/zenFurinSoundscapeSynth.js
  function reportAudioFailure6(phase, error, {
    diagnosticReporter = null,
    consoleRef = console
  } = {}) {
    if (typeof diagnosticReporter === "function") {
      return diagnosticReporter(phase, error, consoleRef);
    }
    const diagnostic = {
      code: `zen_furin_soundscape_${phase || "unknown"}_failed`,
      error: String(error?.message || error || "audio_failed")
    };
    consoleRef?.warn?.("[zen sound] furin soundscape failed", diagnostic);
    return diagnostic;
  }
  function getPinkNoiseBuffer5(ctx, durationSec = 1) {
    const sampleRate = ctx.sampleRate || 44100;
    const bufferSize = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }
  function scheduleDroplet3(ctx, dest, {
    startAt = 0,
    startFreq = 420,
    endFreq = 1080,
    duration = 0.06,
    gain = 0.3
  } = {}) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, startAt);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startAt + duration * 0.4);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq * 0.8), startAt + duration);
    gainNode.gain.setValueAtTime(1e-4, startAt);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(1e-4, gain), startAt + 3e-3);
    gainNode.gain.exponentialRampToValueAtTime(1e-5, startAt + duration);
    osc.connect(gainNode);
    gainNode.connect(dest);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.015);
  }
  function playZenSiteFurinSoundscapeSynth({
    intensity = 0.7,
    duration = 5,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure6("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure6("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.7));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.22 * safeIntensity, now);
      master.gain.linearRampToValueAtTime(0.28 * safeIntensity, now + 0.8);
      master.gain.setValueAtTime(0.28 * safeIntensity, now + duration - 0.8);
      master.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer5(ctx, duration + 0.3);
      const breezeSrc = ctx.createBufferSource();
      breezeSrc.buffer = noiseBuffer;
      const breezeFilter = ctx.createBiquadFilter();
      breezeFilter.type = "bandpass";
      breezeFilter.frequency.setValueAtTime(360, now);
      breezeFilter.frequency.exponentialRampToValueAtTime(540, now + duration * 0.45);
      breezeFilter.frequency.exponentialRampToValueAtTime(320, now + duration);
      breezeFilter.Q.setValueAtTime(2.4, now);
      const breezeGain = ctx.createGain();
      breezeGain.gain.setValueAtTime(1e-4, now);
      breezeGain.gain.linearRampToValueAtTime(0.5 * safeIntensity, now + 0.6);
      breezeGain.gain.setValueAtTime(0.5 * safeIntensity, now + duration - 0.6);
      breezeGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      breezeSrc.connect(breezeFilter);
      breezeFilter.connect(breezeGain);
      breezeGain.connect(master);
      breezeSrc.start(now);
      breezeSrc.stop(now + duration + 0.05);
      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(1e-4, now);
      padGain.gain.linearRampToValueAtTime(0.32 * safeIntensity, now + 0.9);
      padGain.gain.setValueAtTime(0.32 * safeIntensity, now + duration - 0.9);
      padGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      [144, 216].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq + (idx === 0 ? 0.2 : -0.2), now);
        osc.connect(padGain);
        osc.start(now);
        osc.stop(now + duration + 0.05);
      });
      padGain.connect(master);
      const chimeFrequencies = [2093, 3136];
      chimeFrequencies.forEach((freq, idx) => {
        const chimeOsc = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        chimeOsc.type = "sine";
        chimeOsc.frequency.setValueAtTime(freq, now);
        const chimeStart = now + 0.4 + idx * 1.2;
        chimeGain.gain.setValueAtTime(1e-5, chimeStart);
        chimeGain.gain.linearRampToValueAtTime(0.04 * safeIntensity, chimeStart + 0.05);
        chimeGain.gain.exponentialRampToValueAtTime(1e-5, chimeStart + 1.6);
        chimeOsc.connect(chimeGain);
        chimeGain.connect(master);
        chimeOsc.start(chimeStart);
        chimeOsc.stop(chimeStart + 1.7);
      });
      return true;
    } catch (error) {
      reportAudioFailure6("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenSiteFurinUnderwaterLoopSynth({
    intensity = 0.75,
    duration = 4.5,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure6("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure6("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.3 * safeIntensity, now);
      master.gain.linearRampToValueAtTime(0.36 * safeIntensity, now + 0.6);
      master.gain.setValueAtTime(0.36 * safeIntensity, now + duration - 0.6);
      master.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer5(ctx, duration + 0.3);
      const waterSrc = ctx.createBufferSource();
      waterSrc.buffer = noiseBuffer;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(210, now);
      lowpass.frequency.exponentialRampToValueAtTime(270, now + duration * 0.5);
      lowpass.frequency.exponentialRampToValueAtTime(190, now + duration);
      lowpass.Q.setValueAtTime(2.6, now);
      const waterGain = ctx.createGain();
      waterGain.gain.setValueAtTime(1e-4, now);
      waterGain.gain.linearRampToValueAtTime(0.6 * safeIntensity, now + 0.5);
      waterGain.gain.setValueAtTime(0.6 * safeIntensity, now + duration - 0.5);
      waterGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      waterSrc.connect(lowpass);
      lowpass.connect(waterGain);
      waterGain.connect(master);
      waterSrc.start(now);
      waterSrc.stop(now + duration + 0.05);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(1e-4, now);
      subGain.gain.linearRampToValueAtTime(0.4 * safeIntensity, now + 0.8);
      subGain.gain.setValueAtTime(0.4 * safeIntensity, now + duration - 0.8);
      subGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      [55, 82.5].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(subGain);
        osc.start(now);
        osc.stop(now + duration + 0.05);
      });
      subGain.connect(master);
      scheduleDroplet3(ctx, master, {
        startAt: now + 0.8,
        startFreq: 260,
        endFreq: 520,
        duration: 0.07,
        gain: 0.15 * safeIntensity
      });
      scheduleDroplet3(ctx, master, {
        startAt: now + 2.1,
        startFreq: 310,
        endFreq: 640,
        duration: 0.06,
        gain: 0.12 * safeIntensity
      });
      return true;
    } catch (error) {
      reportAudioFailure6("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenSiteFurinSubmergeInSynth({
    intensity = 0.75,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure6("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure6("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 0.85;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.36 * safeIntensity, now);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer5(ctx, duration + 0.2);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(880, now);
      filter.frequency.exponentialRampToValueAtTime(130, now + duration * 0.85);
      filter.Q.setValueAtTime(3.4, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(1e-4, now);
      noiseGain.gain.linearRampToValueAtTime(0.75 * safeIntensity, now + 0.08);
      noiseGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);
      noiseSource.start(now);
      noiseSource.stop(now + duration + 0.05);
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(120, now);
      subOsc.frequency.exponentialRampToValueAtTime(44, now + duration * 0.7);
      subGain.gain.setValueAtTime(1e-4, now);
      subGain.gain.linearRampToValueAtTime(0.5 * safeIntensity, now + 0.05);
      subGain.gain.exponentialRampToValueAtTime(1e-5, now + duration * 0.75);
      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(now);
      subOsc.stop(now + duration + 0.05);
      scheduleDroplet3(ctx, master, {
        startAt: now + 0.12,
        startFreq: 240,
        endFreq: 580,
        duration: 0.09,
        gain: 0.32 * safeIntensity
      });
      return true;
    } catch (error) {
      reportAudioFailure6("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenSiteFurinSurfaceOutSynth({
    intensity = 0.75,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure6("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure6("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 0.95;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.34 * safeIntensity, now);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer5(ctx, duration + 0.2);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(160, now);
      filter.frequency.exponentialRampToValueAtTime(1150, now + duration * 0.45);
      filter.frequency.exponentialRampToValueAtTime(420, now + duration);
      filter.Q.setValueAtTime(2.8, now);
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1e-4, now);
      gainNode.gain.linearRampToValueAtTime(0.7 * safeIntensity, now + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      source.start(now);
      source.stop(now + duration + 0.05);
      scheduleDroplet3(ctx, master, {
        startAt: now + 0.1,
        startFreq: 520,
        endFreq: 1180,
        duration: 0.06,
        gain: 0.35 * safeIntensity
      });
      scheduleDroplet3(ctx, master, {
        startAt: now + 0.24,
        startFreq: 640,
        endFreq: 1320,
        duration: 0.05,
        gain: 0.28 * safeIntensity
      });
      return true;
    } catch (error) {
      reportAudioFailure6("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenSiteFurinSettleCompleteSynth({
    intensity = 0.75,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure6("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure6("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 2.4;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.32 * safeIntensity, now);
      master.connect(ctx.destination);
      const noiseBuffer = getPinkNoiseBuffer5(ctx, duration + 0.2);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 1.4);
      filter.Q.setValueAtTime(1.4, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(1e-4, now);
      noiseGain.gain.linearRampToValueAtTime(0.48 * safeIntensity, now + 0.15);
      noiseGain.gain.exponentialRampToValueAtTime(1e-5, now + 1.5);
      source.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);
      source.start(now);
      source.stop(now + 1.6);
      const chimeFrequencies = [1046.5, 1567.98, 2093];
      const chimeMasterGain = ctx.createGain();
      chimeMasterGain.gain.setValueAtTime(1e-4, now);
      chimeMasterGain.gain.linearRampToValueAtTime(0.42 * safeIntensity, now + 0.04);
      chimeMasterGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      chimeFrequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        const oscGain = ctx.createGain();
        const relativeAmp = idx === 0 ? 0.6 : idx === 1 ? 0.35 : 0.25;
        oscGain.gain.setValueAtTime(relativeAmp, now);
        osc.connect(oscGain);
        oscGain.connect(chimeMasterGain);
        osc.start(now);
        osc.stop(now + duration + 0.05);
      });
      chimeMasterGain.connect(master);
      return true;
    } catch (error) {
      reportAudioFailure6("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }

  // src/themes/plugins/zen/sound/zenGlobalSentinelRiftSynth.js
  function reportAudioFailure7(phase, error, {
    diagnosticReporter = null,
    consoleRef = console
  } = {}) {
    if (typeof diagnosticReporter === "function") {
      return diagnosticReporter(phase, error, consoleRef);
    }
    const diagnostic = {
      code: `zen_global_sentinel_${phase || "unknown"}_failed`,
      error: String(error?.message || error || "audio_failed")
    };
    consoleRef?.warn?.("[zen sound] global sentinel failed", diagnostic);
    return diagnostic;
  }
  function getPinkNoiseBuffer6(ctx, durationSec = 1) {
    const sampleRate = ctx.sampleRate || 44100;
    const bufferSize = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }
  function getWhiteNoiseBuffer2(ctx, durationSec = 1) {
    const sampleRate = ctx.sampleRate || 44100;
    const bufferSize = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
  function playZenGlobalSentinelSimulationRuptureSynth({
    intensity = 0.85,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure7("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure7("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.85));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.35 * safeIntensity, now);
      master.connect(ctx.destination);
      scheduleNoiseBurst(ctx, master, {
        startAt: now,
        duration: 0.035,
        gain: 0.75 * safeIntensity,
        filterType: "bandpass",
        filterFrequency: 3800,
        filterQ: 4.2
      });
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(120, now);
      subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.22);
      subGain.gain.setValueAtTime(1e-4, now);
      subGain.gain.linearRampToValueAtTime(0.65 * safeIntensity, now + 5e-3);
      subGain.gain.exponentialRampToValueAtTime(1e-5, now + 0.35);
      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(now);
      subOsc.stop(now + 0.38);
      const stutterOffsets = [0.04, 0.09, 0.15];
      stutterOffsets.forEach((offset, idx) => {
        scheduleNoiseBurst(ctx, master, {
          startAt: now + offset,
          duration: 0.012,
          gain: (0.4 - idx * 0.08) * safeIntensity,
          filterType: "bandpass",
          filterFrequency: 2200 + idx * 800,
          filterQ: 6
        });
      });
      return true;
    } catch (error) {
      reportAudioFailure7("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenGlobalSentinelRepairTelegraphSynth({
    intensity = 0.8,
    duration = 2.5,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure7("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure7("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.8));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.3 * safeIntensity, now);
      master.connect(ctx.destination);
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gainNode = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + duration * 0.85);
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(480, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + duration * 0.85);
      filter.Q.setValueAtTime(4.5, now);
      gainNode.gain.setValueAtTime(1e-4, now);
      gainNode.gain.linearRampToValueAtTime(0.55 * safeIntensity, now + 0.3);
      gainNode.gain.setValueAtTime(0.55 * safeIntensity, now + duration - 0.4);
      gainNode.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      osc.start(now);
      osc.stop(now + duration + 0.05);
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(65, now);
      subOsc.frequency.exponentialRampToValueAtTime(85, now + duration);
      subGain.gain.setValueAtTime(1e-4, now);
      subGain.gain.linearRampToValueAtTime(0.4 * safeIntensity, now + 0.5);
      subGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(now);
      subOsc.stop(now + duration + 0.05);
      return true;
    } catch (error) {
      reportAudioFailure7("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenGlobalSentinelInterventionHitSynth({
    intensity = 0.85,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure7("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure7("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 2e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.85));
      const duration = 0.45;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.36 * safeIntensity, now);
      master.connect(ctx.destination);
      scheduleNoiseBurst(ctx, master, {
        startAt: now,
        duration: 0.028,
        gain: 0.8 * safeIntensity,
        filterType: "bandpass",
        filterFrequency: 3400,
        filterQ: 5
      });
      const buzzOsc = ctx.createOscillator();
      const buzzGain = ctx.createGain();
      buzzOsc.type = "sawtooth";
      buzzOsc.frequency.setValueAtTime(720, now);
      buzzOsc.frequency.exponentialRampToValueAtTime(210, now + 0.04);
      buzzGain.gain.setValueAtTime(1e-4, now);
      buzzGain.gain.linearRampToValueAtTime(0.6 * safeIntensity, now + 2e-3);
      buzzGain.gain.exponentialRampToValueAtTime(1e-5, now + 0.08);
      buzzOsc.connect(buzzGain);
      buzzGain.connect(master);
      buzzOsc.start(now);
      buzzOsc.stop(now + 0.09);
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = "sine";
      kickOsc.frequency.setValueAtTime(85, now);
      kickOsc.frequency.exponentialRampToValueAtTime(42, now + 0.18);
      kickGain.gain.setValueAtTime(1e-4, now);
      kickGain.gain.linearRampToValueAtTime(0.7 * safeIntensity, now + 3e-3);
      kickGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      kickOsc.connect(kickGain);
      kickGain.connect(master);
      kickOsc.start(now);
      kickOsc.stop(now + duration + 0.02);
      return true;
    } catch (error) {
      reportAudioFailure7("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenGlobalSentinelTerminalBreachSynth({
    intensity = 0.9,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure7("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure7("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.4, Number(intensity) || 0.9));
      const duration = 1.8;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.38 * safeIntensity, now);
      master.connect(ctx.destination);
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(55, now);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.9);
      subGain.gain.setValueAtTime(1e-4, now);
      subGain.gain.linearRampToValueAtTime(0.85 * safeIntensity, now + 0.02);
      subGain.gain.exponentialRampToValueAtTime(1e-5, now + 1.4);
      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(now);
      subOsc.stop(now + 1.45);
      const shatterTimes = [0, 0.04, 0.09, 0.16, 0.25];
      shatterTimes.forEach((offset, idx) => {
        scheduleNoiseBurst(ctx, master, {
          startAt: now + offset,
          duration: 0.035,
          gain: (0.75 - idx * 0.1) * safeIntensity,
          filterType: "bandpass",
          filterFrequency: 4200 + idx % 3 * 600,
          filterQ: 4.8
        });
      });
      const noiseBuffer = getPinkNoiseBuffer6(ctx, duration + 0.2);
      const voidSrc = ctx.createBufferSource();
      voidSrc.buffer = noiseBuffer;
      const voidFilter = ctx.createBiquadFilter();
      voidFilter.type = "bandpass";
      voidFilter.frequency.setValueAtTime(1200, now);
      voidFilter.frequency.exponentialRampToValueAtTime(80, now + duration * 0.75);
      voidFilter.Q.setValueAtTime(6, now);
      const voidGain = ctx.createGain();
      voidGain.gain.setValueAtTime(1e-4, now);
      voidGain.gain.linearRampToValueAtTime(0.65 * safeIntensity, now + 0.15);
      voidGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      voidSrc.connect(voidFilter);
      voidFilter.connect(voidGain);
      voidGain.connect(master);
      voidSrc.start(now);
      voidSrc.stop(now + duration + 0.05);
      return true;
    } catch (error) {
      reportAudioFailure7("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }
  function playZenGlobalSentinelFailureSealSynth({
    intensity = 0.75,
    audioContext = null,
    AudioContextCtor = null,
    consoleRef = console,
    diagnosticReporter = null
  } = {}) {
    const ctx = getSharedAudioContext({
      audioContext,
      AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
      onError: (error) => reportAudioFailure7("context_create", error, { diagnosticReporter, consoleRef })
    });
    if (!ctx) return false;
    resumeAudioContextIfSuspended(ctx, {
      onError: (error) => reportAudioFailure7("resume", error, { diagnosticReporter, consoleRef })
    });
    try {
      const now = ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 1.2;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.32 * safeIntensity, now);
      master.connect(ctx.destination);
      scheduleModalPartial(ctx, master, {
        frequency: 840,
        startAt: now,
        duration: 0.35,
        gain: 0.6 * safeIntensity,
        type: "triangle"
      });
      scheduleModalPartial(ctx, master, {
        frequency: 1680,
        startAt: now,
        duration: 0.22,
        gain: 0.4 * safeIntensity,
        type: "sine"
      });
      const noiseBuffer = getWhiteNoiseBuffer2(ctx, duration + 0.2);
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(2400, now);
      filter.frequency.exponentialRampToValueAtTime(6e3, now + duration * 0.6);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(1e-4, now);
      noiseGain.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      noiseSrc.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);
      noiseSrc.start(now);
      noiseSrc.stop(now + duration + 0.05);
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = "sine";
      thudOsc.frequency.setValueAtTime(90, now);
      thudOsc.frequency.exponentialRampToValueAtTime(38, now + 0.25);
      thudGain.gain.setValueAtTime(1e-4, now);
      thudGain.gain.linearRampToValueAtTime(0.5 * safeIntensity, now + 5e-3);
      thudGain.gain.exponentialRampToValueAtTime(1e-5, now + 0.4);
      thudOsc.connect(thudGain);
      thudGain.connect(master);
      thudOsc.start(now);
      thudOsc.stop(now + 0.45);
      return true;
    } catch (error) {
      reportAudioFailure7("schedule", error, { diagnosticReporter, consoleRef });
      return false;
    }
  }

  // src/themes/plugins/zen/sound/zenSoundPack.js
  function createFurinSynthDescriptor(protocolScope = "site") {
    return Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenFurinGlassClinkSynth({
        ...context,
        protocolScope
      })
    });
  }
  function createShishiClackSynthDescriptor() {
    return Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.SFX,
      play: (context = {}) => playZenShishiOdoshiClackSynth(context)
    });
  }
  var ZEN_SOUND_CUES = Object.freeze({
    [SOUND_CUE_IDS.RITUAL_SITE_FURIN_PRELUDE_CHIME]: createFurinSynthDescriptor("site"),
    [SOUND_CUE_IDS.RITUAL_SITE_FURIN_SUBMERGE_IN]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenSiteFurinSubmergeInSynth(context)
    }),
    [SOUND_CUE_IDS.RITUAL_SITE_FURIN_KOI_ACCEPT]: createFurinSynthDescriptor("site"),
    [SOUND_CUE_IDS.RITUAL_SITE_FURIN_SURFACE_OUT]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenSiteFurinSurfaceOutSynth(context)
    }),
    [SOUND_CUE_IDS.RITUAL_SITE_FURIN_KOI_WAKE_SURFACE]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenKoiWakeSurfaceSynth(context)
    }),
    [SOUND_CUE_IDS.RITUAL_SITE_FURIN_KOI_RENDEZVOUS]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenKoiRendezvousSynth(context)
    }),
    [SOUND_CUE_IDS.RITUAL_SITE_FURIN_KOI_DESCENT_DIVE]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenKoiDescentDiveSynth(context)
    }),
    [SOUND_CUE_IDS.RITUAL_SITE_FURIN_WATER_SETTLE_CALM]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenWaterSettleCalmSynth(context)
    }),
    [SOUND_CUE_IDS.RITUAL_SITE_FURIN_SETTLE_COMPLETE]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenSiteFurinSettleCompleteSynth(context)
    }),
    [SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_KOI_ACCEPT]: createFurinSynthDescriptor("global"),
    [SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_SIMULATION_RUPTURE]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenGlobalSentinelSimulationRuptureSynth(context)
    }),
    [SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_INTERVENTION_HIT]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenGlobalSentinelInterventionHitSynth(context)
    }),
    [SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_TERMINAL_BREACH]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenGlobalSentinelTerminalBreachSynth(context)
    }),
    [SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_FAILURE_SEAL]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenGlobalSentinelFailureSealSynth(context)
    }),
    [SOUND_CUE_IDS.ROOM478_BREATH_INHALE_SWELL]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.AMBIENT,
      play: (context = {}) => playZenRoom478InhaleSwellSynth(context)
    }),
    [SOUND_CUE_IDS.ROOM478_BREATH_EXHALE_RELEASE]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.AMBIENT,
      play: (context = {}) => playZenRoom478ExhaleReleaseSynth(context)
    }),
    [SOUND_CUE_IDS.ROOM478_BELL_PHASE_CHIME]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenRoom478PhaseChimeSynth(context)
    }),
    [SOUND_CUE_IDS.ROOM478_GROUNDING_CHARGE]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenRoom478GroundingChargeSynth(context)
    }),
    [SOUND_CUE_IDS.ZEN_SHISHI_ODOSHI_CLACK]: createShishiClackSynthDescriptor()
  });
  var ZEN_SOUND_SCENES = Object.freeze({
    [SOUND_SCENE_IDS.RITUAL_SITE_FURIN_KOI_GLIDE_LOOP]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.SFX,
      play: (context = {}) => playZenKoiGlideLoopSynth(context)
    }),
    [SOUND_SCENE_IDS.RITUAL_GLOBAL_SENTINEL_REPAIR_TELEGRAPH]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.RITUAL,
      play: (context = {}) => playZenGlobalSentinelRepairTelegraphSynth(context)
    }),
    [SOUND_SCENE_IDS.ROOM478_BREATH_HOLD_DRONE]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.AMBIENT,
      play: (context = {}) => playZenRoom478HoldDroneSynth(context)
    }),
    [SOUND_SCENE_IDS.RITUAL_SITE_FURIN_SOUNDSCAPE]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.MUSIC,
      play: (context = {}) => playZenSiteFurinSoundscapeSynth(context)
    }),
    [SOUND_SCENE_IDS.RITUAL_SITE_FURIN_UNDERWATER_LOOP]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.AMBIENT,
      play: (context = {}) => playZenSiteFurinUnderwaterLoopSynth(context)
    }),
    [SOUND_SCENE_IDS.ZEN_SHISHI_ODOSHI_WATER_LOOP]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.AMBIENT,
      play: (context = {}) => playZenShishiOdoshiWaterLoopSynth(context)
    }),
    [SOUND_SCENE_IDS.ZEN_SHISHI_ODOSHI_OVERFLOW_LOOP]: Object.freeze({
      kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
      bus: SOUND_MIX_BUS_IDS.SFX,
      play: (context = {}) => playZenShishiOdoshiOverflowLoopSynth(context)
    })
  });
  var zenSoundPack = Object.freeze({
    id: "zen",
    cues: ZEN_SOUND_CUES,
    scenes: ZEN_SOUND_SCENES,
    resolveCue(cueId) {
      return ZEN_SOUND_CUES[cueId] || null;
    }
  });

  // scripts/dev/sound-lab/specs/soundTargets.js
  var SOUND_TARGET_SCOPES = Object.freeze({
    ARTIFACT: "artifact",
    APP_FX: "app_fx"
  });
  var SOUND_TARGET_CATEGORIES = Object.freeze({
    RITUAL: "ritual",
    FRICTION_GATE: "friction_gate",
    NUDGE: "nudge",
    AMBIENT: "ambient",
    UI_INTERACTION: "ui_interaction"
  });
  var SOUND_TARGET_STATUS = Object.freeze({
    SYNTH: "SYNTH",
    ASSET: "ASSET",
    SILENT: "SILENT",
    PLANNED: "PLANNED"
  });
  var PRODUCT_REVIEW_TARGETS = [
    ["ritual.site_furin.submerge_in", "furin", "cue", "ritual", 0.85, "\uC218\uBA74 \uC544\uB798\uB85C \uC9C4\uC785", "\uC218\uBA74\uC744 \uD1B5\uACFC\uD558\uBA70 \uAC10\uC2F8\uB294 \uC9E7\uC740 \uC218\uC911 \uC804\uD658", ["Water-entry noise sweep", "Low underwater resonance"]],
    ["ritual.site_furin.koi_accept", "furin", "cue", "ritual", 1.3, "\uC789\uC5B4 \uC0C1\uD638\uC791\uC6A9 \uC218\uB77D", "\uC0C1\uD638\uC791\uC6A9\uC744 \uBC1B\uC544\uB4E4\uC774\uB294 \uB9D1\uC740 \uC720\uB9AC \uD48D\uACBD", ["Glass cup resonance", "Glass striker transient"]],
    ["ritual.site_furin.surface_out", "furin", "cue", "ritual", 0.95, "\uC218\uBA74 \uC704\uB85C \uB3CC\uC544\uC624\uAE30", "\uC218\uC911\uC5D0\uC11C \uC77C\uC0C1\uC73C\uB85C \uB3CC\uC544\uC624\uB294 \uACF5\uAE30\uC640 \uBB3C\uC758 \uC804\uD658", ["Rising water texture", "Air release"]],
    ["ritual.site_furin.settle_complete", "furin", "cue", "ritual", 2.4, "\uD48D\uACBD \uC758\uC2DD \uB9C8\uBB34\uB9AC", "\uC794\uC794\uD55C \uACF5\uBA85\uC73C\uB85C \uC758\uC2DD\uC758 \uB05D\uACFC \uC5EC\uC6B4\uC744 \uC804\uB2EC", ["Soft harmonic resonance", "Decaying tail"]],
    ["ritual.global_sentinel.koi_accept", "sentinel_koi", "cue", "ritual", 1.3, "\uAE00\uB85C\uBC8C \uC789\uC5B4 \uC0C1\uD638\uC791\uC6A9 \uC218\uB77D", "\uAE00\uB85C\uBC8C \uC758\uC2DD\uC758 \uC218\uB77D\uC744 \uC54C\uB9AC\uB294 \uD48D\uACBD \uACF5\uBA85", ["Glass cup resonance", "Global chime partials"]],
    ["ritual.site_furin.soundscape", "furin", "scene", "music", 5, "\uD48D\uACBD \uC758\uC2DD \uBC30\uACBD\uC74C", "\uD48D\uACBD \uC758\uC2DD\uC758 \uACF5\uAC04\uAC10\uC744 \uC720\uC9C0\uD558\uB294 \uC794\uC794\uD55C \uBC30\uACBD", ["Harmonic atmosphere", "Water texture"]],
    ["ritual.site_furin.underwater_loop", "furin", "scene", "ambient", 4.5, "\uC218\uC911 \uACF5\uAC04\uC758 \uBC30\uACBD", "\uC218\uBA74 \uC544\uB798\uC758 \uAE4A\uC774\uC640 \uCC28\uBD84\uD568\uC744 \uC720\uC9C0\uD558\uB294 \uBC30\uACBD \uC9C8\uAC10", ["Underwater filtered noise", "Low resonance"]]
  ].map(([id, artifact, kind, bus, targetDuration, name, acousticConcept, physicalLayers]) => ({
    id,
    theme: "zen",
    scope: SOUND_TARGET_SCOPES.ARTIFACT,
    artifact,
    artifactName: artifact === "furin" ? "\u{1F390} Edo Glass Furin (\uC5D0\uB3C4 \uC720\uB9AC \uD48D\uACBD)" : "\u{1F41F} Global Sentinel Rift (\uCC28\uC6D0 \uADE0\uC5F4 & \uC13C\uD2F0\uB110)",
    fsPath: `zen/artifacts/${artifact}/${id.split(".").at(-1)}`,
    kind,
    bus,
    targetDuration,
    name,
    acousticConcept,
    physicalLayers,
    category: SOUND_TARGET_CATEGORIES.RITUAL,
    agentRecipePrompt: `${name}\uC758 \uC0AC\uC6A9 \uB9E5\uB77D\uACFC \uC81C\uD488 \uC5F0\uACB0\uBCF8\uC744 \uBA3C\uC800 \uAC80\uD1A0\uD558\uACE0, ${acousticConcept}\uC744 \uBAA9\uD45C\uB85C \uC0C8 \uC2DC\uC548\uC744 \uC81C\uC548\uD574\uC918.`
  }));
  var SOUND_TARGET_SPECS = Object.freeze([
    // =========================================================================
    // === ZEN THEME : ARTIFACTS ===
    // =========================================================================
    // --- Artifact: Shishi-odoshi (시시오도시) ---
    {
      id: "zen.shishi_odoshi.clack",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "shishi_odoshi",
      artifactName: "\u{1F38B} Shishi-odoshi (\uC2DC\uC2DC\uC624\uB3C4\uC2DC)",
      fsPath: "zen/artifacts/shishi_odoshi/clack",
      kind: "cue",
      bus: "sfx",
      name: "Bamboo Stone Strike (\uB300\uB098\uBB34 \uD0C0\uACA9\uC74C)",
      category: SOUND_TARGET_CATEGORIES.FRICTION_GATE,
      acousticConcept: "\uB300\uB098\uBB34 \uC6D0\uD1B5\uC774 \uBB3C\uC744 \uBE44\uC6B4 \uD6C4 \uB3CC\uBC1B\uCE68\uC5D0 \uB5A8\uC5B4\uC9C0\uBA70 \uB0B4\uB294 \uCDA9\uACA9\uC74C(Transient), \uC911\uACF5 \uACF5\uBA85(Hollow Cavity Modes), \uBC1B\uCE68\uB3CC \uC800\uC74C \uD761\uC218(Stone Sub Thud)",
      targetDuration: 0.28,
      physicalLayers: [
        "Contact Transient (2.8 kHz Bandpass + Pitch Drop)",
        "Woody Body Texture (760 Hz Resonant Noise)",
        "Hollow Cavity Modes (468Hz, 875Hz, 1540Hz, 2720Hz)",
        "Stone Absorption Sub (118Hz)"
      ],
      agentRecipePrompt: "WebAudio \uBB3C\uB9AC \uBAA8\uB378\uB9C1\uC73C\uB85C \uB300\uB098\uBB34 \uD0C0\uACA9 \uC21C\uAC04\uC758 2.8kHz \uACFC\uB3C4 \uC751\uB2F5, 468Hz \uAE30\uBC18 \uC911\uACF5 \uB300\uB098\uBB34 \uACF5\uBA85 \uBAA8\uB4DC, 118Hz \uBC1B\uCE68\uB3CC \uD761\uC218\uC74C\uC744 \uD569\uC131\uD574\uC918."
    },
    {
      id: "zen.shishi_odoshi.water_loop",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "shishi_odoshi",
      artifactName: "\u{1F38B} Shishi-odoshi (\uC2DC\uC2DC\uC624\uB3C4\uC2DC)",
      fsPath: "zen/artifacts/shishi_odoshi/water_loop",
      kind: "scene",
      bus: "ambient",
      name: "Water Inflow Trickle Loop (\uBB3C \uCC44\uC6CC\uC9C0\uB294 \uC18C\uB9AC \uB8E8\uD504)",
      category: SOUND_TARGET_CATEGORIES.FRICTION_GATE,
      acousticConcept: "\uB300\uB098\uBB34 \uBB3C\uBC1B\uC774\uC5D0 \uAC00\uB298\uAC8C \uD758\uB7EC\uB4DC\uB294 \uBB3C\uC904\uAE30\uC640 \uC794\uC794\uD55C \uBB3C\uBC29\uC6B8\uB4E4\uC774 \uD401\uB2F9 \uB5A8\uC5B4\uC9C0\uB294 \uC2DC\uACC4\uC5F4 \uC570\uBE44\uC5B8\uC2A4",
      targetDuration: 3.5,
      physicalLayers: [
        "Flowing Stream Base (Modulated 650Hz Bandpass Pink Noise)",
        "Stochastic Water Drops (350Hz -> 1100Hz Sine Sweeps every 0.3~0.8s)",
        "Hydro-resonant Cavity (920Hz Bandpass)"
      ],
      agentRecipePrompt: "WebAudio\uB85C \uD551\uD06C \uB178\uC774\uC988 \uAE30\uBC18 \uC218\uB958 \uD14D\uC2A4\uCC98\uC640 \uBD88\uADDC\uCE59\uD558\uAC8C \uD401\uB2F9 \uB5A8\uC5B4\uC9C0\uB294 \uC0AC\uC778\uD30C \uD53C\uCE58 \uC2A4\uC715 \uBB3C\uBC29\uC6B8 \uC18C\uB9AC\uB97C \uC870\uD569\uD55C zen.shishi_odoshi.water_loop \uC2E0\uC2A4\uB97C \uAD6C\uD604\uD574\uC918."
    },
    {
      id: "zen.shishi_odoshi.overflow_loop",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "shishi_odoshi",
      artifactName: "\u{1F38B} Shishi-odoshi (\uC2DC\uC2DC\uC624\uB3C4\uC2DC)",
      fsPath: "zen/artifacts/shishi_odoshi/overflow_loop",
      kind: "scene",
      bus: "sfx",
      name: "Water Overflow Rush (\uBB3C \uB118\uCE68 \uB8E8\uD504)",
      category: SOUND_TARGET_CATEGORIES.FRICTION_GATE,
      acousticConcept: "\uB300\uB098\uBB34 \uAD00\uC774 \uAC00\uB4DD \uCC28\uC11C \uBB3C\uC774 \uC138\uCC28\uAC8C \uC3DF\uC544\uC838 \uB098\uC624\uB294 \uD48D\uC131\uD55C \uC218\uB958 \uCDA9\uB3CC\uC74C",
      targetDuration: 2,
      physicalLayers: [
        "Cascading Water Torrent (Dual Bandpass 450Hz & 1200Hz)",
        "Splash Micro-droplets Granular Burst"
      ],
      agentRecipePrompt: "\uB300\uB098\uBB34\uC5D0\uC11C \uC3DF\uC544\uC9C0\uB294 \uBB3C\uC904\uAE30\uC758 \uB2E4\uC911 \uB300\uC5ED \uBC34\uB4DC\uD328\uC2A4 \uB178\uC774\uC988\uC640 \uBBF8\uC138 \uBB3C\uBC29\uC6B8 \uADF8\uB798\uB27C\uB7EC \uBC84\uC2A4\uD2B8\uB97C \uD569\uC131\uD574\uC918."
    },
    // --- Artifact: Edo Glass Furin (에도 유리 풍경) ---
    {
      id: "ritual.site_furin.prelude_chime",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "furin",
      artifactName: "\u{1F390} Edo Glass Furin (\uC5D0\uB3C4 \uC720\uB9AC \uD48D\uACBD)",
      fsPath: "zen/artifacts/furin/prelude_glass_clink",
      kind: "cue",
      bus: "ritual",
      name: "Edo Glass Clink (\uC720\uB9AC \uD48D\uACBD \uB9BC \uD0C0\uACA9\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      nativeBasePitch: 3136,
      acousticConcept: "\uB4A4\uC9D1\uC5B4\uC9C4 \uC5B4\uD56D\uD615 \uC587\uC740 \uC720\uB9AC \uCEF5(3136Hz G7, 1.3\uCD08 \uAC10\uC1E0)\uACFC \uC911\uC2EC \uC904\uC744 \uD1B5\uACFC\uD558\uB294 \uC194\uB9AC\uB4DC \uC720\uB9AC \uB9C9\uB300(4950Hz, 0.55\uCD08)\uC758 \uC870\uD654\uB86D\uACE0 \uC624\uBB18\uD55C \uB450 \uACB9\uC758 \uD06C\uB9AC\uC2A4\uD0C8 \uC774\uC911 \uACF5\uBA85\uC74C",
      targetDuration: 1.3,
      physicalLayers: [
        "Layer 1: Inverted Glass Cup (3136Hz G7, 1.30s 2-Stage Damping)",
        "Layer 2: Solid Glass Rod Striker (4950Hz, 0.55s Ring)",
        "Elastic Rim Strike Flash (8250Hz, 0.08s)",
        "Dual Asymmetric Flutter (+3.2Hz / +2.4Hz Beating)"
      ],
      agentRecipePrompt: "\uB4A4\uC9D1\uC5B4\uC9C4 \uC5B4\uD56D\uD615 \uC720\uB9AC \uCEF5 \uBCF8\uCCB4\uC640 \uC911\uC2EC \uC720\uB9AC \uB9C9\uB300\uC758 \uD6A1\uC9C4\uB3D9 \uBAA8\uB4DC\uAC00 \uACB0\uD569\uB41C \uC624\uBB18\uD55C \uB450 \uACB9\uC758 Edo Glass Clink \uC2E0\uC2A4\uB97C \uAD6C\uD604\uD574\uC918."
    },
    {
      id: "ritual.site_furin.koi_wake_surface",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "furin",
      artifactName: "\u{1F390} Edo Glass Furin (\uC5D0\uB3C4 \uC720\uB9AC \uD48D\uACBD)",
      fsPath: "zen/artifacts/furin/koi_wake_surface",
      kind: "cue",
      bus: "ritual",
      nativeBasePitch: 520,
      name: "Koi Wake Emerge (\uC789\uC5B4 \uC218\uBA74 \uBD80\uC0C1\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "\uAE4A\uC740 \uBB3C\uC18D\uC5D0\uC11C \uAC00\uC774\uB4DC \uC789\uC5B4\uAC00 \uC218\uBA74\uC73C\uB85C \uC870\uC6A9\uD788 \uC19F\uC544\uC624\uB974\uBA70 \uC218\uBA74 \uC7A5\uB825\uC744 \uBC00\uC5B4\uC62C\uB9AC\uB294 \uBD80\uB4DC\uB7EC\uC6B4 \uC218\uB958 \uD33D\uCC3D\uC74C\uACFC \uBBF8\uC138 \uAE30\uD3EC \uD14D\uC2A4\uCC98",
      targetDuration: 1.1,
      physicalLayers: [
        "Hydro-Acoustic Swell (220Hz -> 680Hz Bandpass Sweep)",
        "Delicate Surface Tension Break Micro-Bubble",
        "Gentle Water Wave Crest"
      ],
      agentRecipePrompt: "\uAE4A\uC740 \uACF3\uC5D0\uC11C \uC218\uBA74\uC73C\uB85C \uC19F\uC544\uC624\uB974\uB294 220Hz->680Hz \uC218\uB958 \uC2A4\uC6F0\uACFC \uD45C\uBA74 \uC7A5\uB825 \uB3CC\uD30C \uBBF8\uC138 \uAE30\uD3EC\uC74C\uC744 \uD569\uC131\uD574\uC918."
    },
    {
      id: "ritual.site_furin.koi_glide_loop",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "furin",
      artifactName: "\u{1F390} Edo Glass Furin (\uC5D0\uB3C4 \uC720\uB9AC \uD48D\uACBD)",
      fsPath: "zen/artifacts/furin/koi_glide_loop",
      kind: "scene",
      bus: "sfx",
      nativeBasePitch: 420,
      name: "Koi Hydrofoil Glide (\uC789\uC5B4 \uC720\uC601 \uC218\uB958\uC74C \uB8E8\uD504)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "\uC789\uC5B4\uAC00 \uC720\uC5F0\uD558\uAC8C \uBAB8\uC744 \uD754\uB4E4\uBA70 \uBB3C\uC0B4\uC744 \uAC00\uB974\uACE0 \uD5E4\uC5C4\uCCD0 \uB098\uC544\uAC00\uB294 \uC720\uC120\uD615 \uCE35\uB958 \uC218\uB958\uC74C (Laminar Fluid Flow)",
      targetDuration: 2.4,
      physicalLayers: [
        "Continuous Hydrofoil Stream (Dual Bandpass 340Hz & 850Hz)",
        "Subtle Tail-Sweep Wave Modulation (0.85Hz LFO)",
        "Silky Water Flow Granular Texture"
      ],
      agentRecipePrompt: "\uC789\uC5B4\uAC00 \uBB3C\uC0B4\uC744 \uAC00\uB974\uB294 340Hz/850Hz \uB4C0\uC5BC \uBC34\uB4DC\uD328\uC2A4 \uCE35\uB958 \uC218\uB958\uC74C\uACFC 0.85Hz \uAF2C\uB9AC \uC720\uC601 \uBAA8\uB4C8\uB808\uC774\uC158\uC744 \uD569\uC131\uD574\uC918."
    },
    {
      id: "ritual.site_furin.koi_rendezvous",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "furin",
      artifactName: "\u{1F390} Edo Glass Furin (\uC5D0\uB3C4 \uC720\uB9AC \uD48D\uACBD)",
      fsPath: "zen/artifacts/furin/koi_rendezvous",
      kind: "cue",
      bus: "ritual",
      nativeBasePitch: 640,
      name: "Companion Koi Rendezvous (\uB3D9\uB8CC \uC789\uC5B4 \uD569\uB958\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "\uB3D9\uB8CC \uC789\uC5B4\uAC00 \uC720\uB3C4 \uB300\uD615\uC5D0 \uD569\uB958\uD558\uBA70 \uB450 \uBB3C\uC0B4\uC774 \uBD80\uB4DC\uB7FD\uAC8C \uAD50\uCC28\uD558\uACE0 \uC18C\uC6A9\uB3CC\uC774\uCE58\uB294 \uC720\uCCB4 \uC2A4\uC6D4\uACFC \uB9D1\uC740 \uC218\uBA74 \uB9AC\uD50C",
      targetDuration: 0.9,
      physicalLayers: [
        "Fluid Swirl Cross-Current (450Hz -> 920Hz)",
        "Harmonious Water Droplet Chirp",
        "Convergent Hydro Wake"
      ],
      agentRecipePrompt: "\uB3D9\uB8CC \uC789\uC5B4\uAC00 \uD569\uB958\uD560 \uB54C \uBC1C\uC0DD\uD558\uB294 450Hz->920Hz \uC720\uCCB4 \uC2A4\uC6D4\uACFC \uC870\uD654\uB85C\uC6B4 \uC218\uBA74 \uB9AC\uD50C\uC744 \uD569\uC131\uD574\uC918."
    },
    {
      id: "ritual.site_furin.koi_descent_dive",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "furin",
      artifactName: "\u{1F390} Edo Glass Furin (\uC5D0\uB3C4 \uC720\uB9AC \uD48D\uACBD)",
      fsPath: "zen/artifacts/furin/koi_descent_dive",
      kind: "cue",
      bus: "ritual",
      nativeBasePitch: 280,
      name: "School Descent Dive (\uC789\uC5B4 \uAD70\uC9D1 \uC7A0\uC218\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "5\uB9C8\uB9AC\uC758 \uC789\uC5B4\uAC00 \uBAA9\uC801\uC9C0 \uC815\uB82C \uD6C4 \uC2EC\uC5F0 \uC544\uB798\uB85C \uC77C\uC81C\uD788 \uBA38\uB9AC\uB97C \uB3CC\uB824 \uAE4A\uAC8C \uC7A0\uC218\uD574 \uB4E4\uC5B4\uAC00\uB294 \uBB35\uC9C1\uD558\uACE0 \uACE0\uC694\uD55C \uC218\uC911 \uC7A0\uAC15\uC74C",
      targetDuration: 1.4,
      physicalLayers: [
        "Downward Hydro-Filter Sweep (900Hz -> 180Hz)",
        "Deep Water Resonance Sub-Glide",
        "Muffled Bubbling Plunge"
      ],
      agentRecipePrompt: "\uC789\uC5B4 \uAD70\uC9D1\uC774 \uC2EC\uC5F0\uC73C\uB85C \uC7A0\uC218\uD558\uB294 900Hz->180Hz \uD558\uD5A5 \uC218\uC911 \uD544\uD130 \uC2A4\uC715\uACFC \uB525 \uC6CC\uD130 \uC11C\uBE0C \uAE00\uB77C\uC774\uB4DC\uB97C \uD569\uC131\uD574\uC918."
    },
    {
      id: "ritual.site_furin.water_settle_calm",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "furin",
      artifactName: "\u{1F390} Edo Glass Furin (\uC5D0\uB3C4 \uC720\uB9AC \uD48D\uACBD)",
      fsPath: "zen/artifacts/furin/water_settle_calm",
      kind: "cue",
      bus: "ritual",
      nativeBasePitch: 360,
      name: "Water Surface Settle (\uC218\uBA74 \uC548\uC815 \uC794\uBB3C\uACB0\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "\uC789\uC5B4\uB4E4\uC774 \uC7A0\uC218\uD55C \uD6C4 \uB0A8\uACA8\uC9C4 \uC218\uBA74\uC758 \uC794\uBB3C\uACB0\uC774 \uC11C\uC11C\uD788 \uC7A6\uC544\uB4E4\uBA70 \uAC70\uC6B8 \uAC19\uC740 \uACE0\uC694\uB85C \uB3CC\uC544\uAC00\uB294 \uD3C9\uC628\uD55C \uC218\uBA74 \uC548\uC815\uC74C",
      targetDuration: 1.6,
      physicalLayers: [
        "Gentle Dissolving Ripple Waves",
        "Ultra-Soft Water Lap (Lowpass 400Hz)",
        "Serene Ambient Tail"
      ],
      agentRecipePrompt: "\uC794\uBB3C\uACB0\uC774 \uC7A6\uC544\uB4E4\uBA70 \uC218\uBA74\uC774 \uACE0\uC694\uD574\uC9C0\uB294 400Hz \uB85C\uC6B0\uD328\uC2A4 \uC794\uBB3C\uACB0 \uAC10\uC1E0\uC74C\uC744 \uD569\uC131\uD574\uC918."
    },
    // --- Artifact: Room 478 (4-7-8 호흡실) ---
    {
      id: "room478.breath.inhale_swell",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "room_478",
      artifactName: "\u{1F9D8} Room 478 (4-7-8 \uD638\uD761\uC2E4)",
      fsPath: "zen/artifacts/room_478/inhale_swell",
      kind: "cue",
      bus: "ambient",
      nativeBasePitch: 108,
      // Sacred 108Hz
      name: "4s Cosmic Inhale Breath Swell (4\uCD08 \uC6B0\uC8FC\uC801 \uB4E4\uC228 \uC218\uB834\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "108Hz \uC131\uC2A4\uB7EC\uC6B4 \uAE30\uC74C\uACFC 216Hz/324Hz/432Hz \uBC30\uC74C\uC5F4 \uAE30\uBC18\uC73C\uB85C \uD3D0\uC640 \uACF5\uAC04\uC774 \uD568\uAED8 \uAC1C\uBC29\uB418\uB294 \uC628\uD654\uD55C \uD654\uC74C \uC2A4\uC6F0\uACFC \uACF5\uAE30 \uD14D\uC2A4\uCC98",
      targetDuration: 4,
      physicalLayers: [
        "Cosmic Harmonic Stack (108Hz-216Hz-324Hz-432Hz)",
        "Gentle Lowpass Filter Opening (130Hz -> 850Hz)",
        "Celestial Air Flow Inflow Shimmer"
      ],
      agentRecipePrompt: "4\uCD08 \uB4E4\uC228 \uD638\uD761\uC5D0 \uB9DE\uCDB0 108Hz \uBC30\uC74C\uC5F4 \uC2A4\uD0DD\uACFC 130Hz->850Hz\uB85C \uC5F4\uB9AC\uB294 \uC628\uD654\uD55C \uD654\uC74C \uD328\uB4DC \uC2A4\uC6F0\uC744 \uD569\uC131\uD574\uC918."
    },
    {
      id: "room478.breath.hold_drone",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "room_478",
      artifactName: "\u{1F9D8} Room 478 (4-7-8 \uD638\uD761\uC2E4)",
      fsPath: "zen/artifacts/room_478/hold_drone",
      kind: "scene",
      bus: "ambient",
      nativeBasePitch: 216,
      // A3 Meditative Octave
      name: "7s Zero-Gravity Hold Drone (7\uCD08 \uBB34\uC911\uB825 \uC9C0\uC2DD \uC815\uC801 \uB4DC\uB860)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "7\uCD08 \uB3D9\uC548 \uC228\uC744 \uBA48\uCD94\uACE0 \uC644\uC804\uD55C \uBB34\uC911\uB825 \uB0B4\uBA74\uC758 \uD3C9\uC628\uC744 \uC720\uC9C0\uD558\uB294 216Hz \uC2F1\uC789\uBCFC \uB4DC\uB860, 1.2Hz \uB290\uB9B0 \uB9E5\uB180\uC774, 108Hz \uC11C\uBE0C \uC575\uCEE4",
      targetDuration: 7,
      physicalLayers: [
        "Primary Zero-Gravity Drone (216Hz Sine)",
        "Binaural Theta Drift (+1.2Hz Slow Flutter)",
        "108Hz Deep Sub-Anchor & 648Hz Starlight Tone"
      ],
      agentRecipePrompt: "7\uCD08 \uC9C0\uC2DD \uD638\uD761 \uB3D9\uC548 \uBB34\uC911\uB825 \uC815\uC801\uC744 \uC720\uC9C0\uD558\uB294 216Hz \uB4DC\uB860, 1.2Hz \uB9E5\uB180\uC774, 108Hz \uC11C\uBE0C \uC575\uCEE4\uB97C \uD569\uC131\uD574\uC918."
    },
    {
      id: "room478.breath.exhale_release",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "room_478",
      artifactName: "\u{1F9D8} Room 478 (4-7-8 \uD638\uD761\uC2E4)",
      fsPath: "zen/artifacts/room_478/exhale_release",
      kind: "cue",
      bus: "ambient",
      nativeBasePitch: 108,
      // Sacred 108Hz
      name: "8s Vacuum Exhale Release (8\uCD08 \uC9C4\uACF5 \uB0A0\uC228 \uC774\uC644\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "8\uCD08 \uB3D9\uC548 \uBAB8\uC758 \uAE34\uC7A5\uC774 \uC6B0\uC8FC \uC9C4\uACF5\uC73C\uB85C \uD480\uB824\uB098\uAC00\uB294 108Hz/54Hz \uC628\uD654\uD55C \uC11C\uBE0C\uBCA0\uC774\uC2A4\uC640 950Hz->75Hz \uD558\uD5A5 \uD544\uD130 \uC2A4\uC715",
      targetDuration: 8,
      physicalLayers: [
        "Downward Resonant Sweep (950Hz -> 75Hz)",
        "Grounding Sub-Harmonic (108Hz & 54Hz)",
        "Vacuum Exhalation Air Dissolve"
      ],
      agentRecipePrompt: "8\uCD08 \uB0A0\uC228 \uB3D9\uC548 \uAE34\uC7A5\uC744 \uBE44\uC6CC\uB0B4\uB294 950Hz->75Hz \uD558\uD5A5 \uD544\uD130 \uC2A4\uC715\uACFC 108Hz/54Hz \uC628\uD654\uD55C \uC11C\uBE0C \uB9B4\uB9AC\uC988\uB97C \uD569\uC131\uD574\uC918."
    },
    {
      id: "room478.bell.phase_chime",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "room_478",
      artifactName: "\u{1F9D8} Room 478 (4-7-8 \uD638\uD761\uC2E4)",
      fsPath: "zen/artifacts/room_478/phase_chime",
      kind: "cue",
      bus: "ritual",
      nativeBasePitch: 108,
      // Sacred 108Hz Temple Bell
      name: "Deep Cosmic Temple Gong (\uBB35\uC9C1\uD55C 108Hz \uB300\uC885 / \uBC94\uC885 \uD0C0\uC885\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "\uD48D\uACBD \uC18C\uB9AC\uAC00 \uC544\uB2CC, \uD638\uD761\uC2E4 \uC811\uC9C0 \uC644\uB8CC \uBC0F \uACE0\uC694 \uC9C4\uC785\uC744 \uBB35\uC9C1\uD558\uACE0 \uAE4A\uAC8C \uC54C\uB9AC\uB294 108Hz \uCCAD\uB3D9 \uB300\uC885 \uD0C0\uC885\uC74C\uACFC 1.2Hz \uB9E5\uB180\uC774 \uC5EC\uC6B4",
      targetDuration: 4.8,
      physicalLayers: [
        "Heavy Wooden Mallet Impact Thud (140Hz -> 80Hz)",
        "Sacred Bronze Fundamental (108Hz Pure Sine)",
        "1.2Hz Undulating Beating Twin (\uB300\uC885 \uB9E5\uB180\uC774)",
        "Bronze Resonant Harmonics (216Hz, 324Hz, 540Hz)"
      ],
      agentRecipePrompt: "\uD48D\uACBD \uC18C\uB9AC\uAC00 \uC544\uB2CC 108Hz \uAE30\uC74C\uC758 \uBB35\uC9C1\uD55C \uB300\uC885 \uD0C0\uC885\uC74C\uACFC 1.2Hz \uB9E5\uB180\uC774, \uD48D\uBD80\uD55C \uCCAD\uB3D9 \uBC30\uC74C \uC5EC\uC6B4\uC744 \uD569\uC131\uD574\uC918."
    },
    {
      id: "room478.grounding.charge",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "room_478",
      artifactName: "\u{1F9D8} Room 478 (4-7-8 \uD638\uD761\uC2E4)",
      fsPath: "zen/artifacts/room_478/grounding_charge",
      kind: "cue",
      bus: "ritual",
      nativeBasePitch: 108,
      name: "Somatic Grounding Charge (\uAC10\uC555 \uC811\uC9C0 \uCDA9\uC804\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "\uC2A4\uD398\uC774\uC2A4\uBC14 \uB610\uB294 \uD654\uBA74\uC744 1.8\uCD08\uAC04 \uB204\uB974\uACE0 \uC788\uB294 \uB3D9\uC548 \uC2EC\uC2E0\uC744 \uAC00\uB77C\uC549\uD788\uB294 72Hz->108Hz \uAC10\uC555 \uC0C1\uC2B9 \uB9C8\uCC30\uC74C\uACFC \uB300\uAE30 \uC555\uCD95 \uBCF4\uD14D\uC2A4",
      targetDuration: 1.8,
      physicalLayers: [
        "Somatic Core Frequency Rise (72Hz -> 108Hz)",
        "Sub-Harmonic Foundation (36Hz -> 54Hz)",
        "Resonant Harmonic Emergence (144Hz -> 216Hz)",
        "Cosmic Vacuum Vortex Bandpass Charge (180Hz -> 420Hz)"
      ],
      agentRecipePrompt: "1.8\uCD08 \uB3D9\uC548 \uC2A4\uD398\uC774\uC2A4\uBC14\uB97C \uB204\uB97C \uB54C 72Hz\uC5D0\uC11C 108Hz\uB85C \uACE0\uC870\uB418\uBA70 \uC548\uC815\uAC10\uC744 \uC8FC\uB294 \uAC10\uC555 \uC811\uC9C0\uC74C\uACFC \uB300\uAE30 \uC555\uCD95 \uC9C8\uAC10\uC744 \uD569\uC131\uD574\uC918."
    },
    // --- Artifact: Global Sentinel Rift (글로벌 센티널 차원 균열) ---
    {
      id: "ritual.global_sentinel.simulation_rupture",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "sentinel_koi",
      artifactName: "\u{1F41F} Global Sentinel Rift (\uCC28\uC6D0 \uADE0\uC5F4 & \uC13C\uD2F0\uB110)",
      fsPath: "zen/artifacts/sentinel_koi/simulation_rupture",
      kind: "cue",
      bus: "ritual",
      nativeBasePitch: 3800,
      name: "Simulation Rupture (\uC2DC\uBBAC\uB808\uC774\uC158 \uADE0\uC5F4 & \uC561\uC815 \uD30C\uC5F4\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "\uC2A4\uD0C0\uD130 \uC789\uC5B4\uAC00 \uD654\uBA74\uC744 \uAC00\uACA9\uD558\uB294 \uC21C\uAC04 \uC561\uC815\uC774 \uD30C\uC5F4\uB418\uB294 3.8kHz \uC720\uB9AC \uD30C\uC1C4\uC74C, 120Hz->45Hz \uBC31\uB77C\uC774\uD2B8 \uC5D0\uB108\uC9C0 \uD30C\uC5F4 \uC11C\uBE0C, \uB514\uC9C0\uD138 \uC789\uD06C \uC0B0\uB780 \uAE00\uB9AC\uCE58",
      targetDuration: 0.7,
      physicalLayers: [
        "High Glass/LCD Fracture Snap (3800Hz Bandpass + Pitch Drop)",
        "Backlight Energy Pop Sub (120Hz -> 45Hz)",
        "Digital Ink Dispersion Stutter Burst"
      ],
      agentRecipePrompt: "\uC561\uC815\uC774 \uD30C\uC5F4\uB418\uB294 3.8kHz \uC720\uB9AC \uD30C\uC1C4\uC74C\uACFC 120Hz->45Hz \uBC31\uB77C\uC774\uD2B8 \uC11C\uBE0C \uD31D, \uB514\uC9C0\uD138 \uC789\uD06C \uAE00\uB9AC\uCE58 \uD14D\uC2A4\uCC98\uB97C \uD569\uC131\uD574\uC918."
    },
    {
      id: "ritual.global_sentinel.repair_telegraph",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "sentinel_koi",
      artifactName: "\u{1F41F} Global Sentinel Rift (\uCC28\uC6D0 \uADE0\uC5F4 & \uC13C\uD2F0\uB110)",
      fsPath: "zen/artifacts/sentinel_koi/repair_telegraph",
      kind: "scene",
      bus: "ritual",
      nativeBasePitch: 240,
      name: "Repair Telegraph (\uC2DC\uC2A4\uD15C \uC218\uB9AC \uC811\uADFC \uACBD\uACE0\uC74C & \uD150\uC158 \uB4DC\uB860)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "\uC13C\uD2F0\uB12C\uC774 \uADE0\uC5F4\uC744 \uAC15\uC81C\uB85C \uBD09\uD569\uD558\uB7EC \uB2E4\uAC00\uC62C \uB54C \uBC1C\uC0DD\uD558\uB294 240Hz->520Hz \uC0C1\uC2B9 \uD53C\uCE58 \uD150\uC158 \uB4DC\uB860\uACFC 16Hz \uD074\uB7ED \uC2A4\uD130\uD130 \uD384\uC2A4",
      targetDuration: 2.5,
      physicalLayers: [
        "Rising Tension Glitch Drone (240Hz -> 520Hz)",
        "16Hz Digital Clock Jitter Pulse",
        "Sub-Pressure Building Wave (65Hz)"
      ],
      agentRecipePrompt: "\uC13C\uD2F0\uB12C\uC774 \uC811\uADFC\uD560 \uB54C \uC6B8\uB9AC\uB294 240Hz->520Hz \uC0C1\uC2B9 \uD150\uC158 \uB4DC\uB860\uACFC 16Hz \uB514\uC9C0\uD138 \uD074\uB7ED \uC2A4\uD130\uD130 \uD384\uC2A4\uB97C \uD569\uC131\uD574\uC918."
    },
    {
      id: "ritual.global_sentinel.intervention_hit",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "sentinel_koi",
      artifactName: "\u{1F41F} Global Sentinel Rift (\uCC28\uC6D0 \uADE0\uC5F4 & \uC13C\uD2F0\uB110)",
      fsPath: "zen/artifacts/sentinel_koi/intervention_hit",
      kind: "cue",
      bus: "ritual",
      nativeBasePitch: 3400,
      name: "Intervention Hit (\uD0C0\uC774\uBC0D \uAC1C\uC785 \uD0C0\uACA9 & \uAE00\uB9AC\uCE58 \uD06C\uB799)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "\uD0C0\uC774\uBC0D \uB9C1\uC5D0 \uB9DE\uCDB0 \uD074\uB9AD\uD560 \uB54C \uC2DC\uC2A4\uD15C \uC218\uB9AC \uB808\uC77C\uC744 \uC0B0\uC0B0\uC870\uAC01 \uB0B4\uB294 3.4kHz \uAE00\uB9AC\uCE58 \uC2A4\uB0C5\uACFC 85Hz \uC11C\uBE0C \uD0A5 \uBC18\uBC1C",
      targetDuration: 0.45,
      physicalLayers: [
        "Hard Glass Crack Shock (3.4kHz Resonant Noise)",
        "Digital De-quantize Buzz Snap",
        "Sub Kick Rebound (85Hz)"
      ],
      agentRecipePrompt: "\uC218\uB9AC \uB808\uC77C\uC744 \uBD84\uC1C4\uD558\uB294 3.4kHz \uAE00\uB9AC\uCE58 \uC2A4\uB0C5\uACFC 85Hz \uC11C\uBE0C \uD0A5 \uBC18\uBC1C\uC74C\uC744 \uD569\uC131\uD574\uC918."
    },
    {
      id: "ritual.global_sentinel.terminal_breach",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "sentinel_koi",
      artifactName: "\u{1F41F} Global Sentinel Rift (\uCC28\uC6D0 \uADE0\uC5F4 & \uC13C\uD2F0\uB110)",
      fsPath: "zen/artifacts/sentinel_koi/terminal_breach",
      kind: "cue",
      bus: "ritual",
      nativeBasePitch: 55,
      name: "Terminal Breach (\uCD5C\uC885 \uCC28\uC6D0 \uB3CC\uD30C & \uC13C\uD2F0\uB12C \uCD95\uCD9C\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "4\uD68C \uD0C0\uACA9 \uC131\uACF5 \uD6C4 \uC2DC\uBBAC\uB808\uC774\uC158 \uBD09\uD569\uC744 \uC644\uC804\uD788 \uBD84\uC1C4\uD558\uACE0 \uADE0\uC5F4\uC744 \uC601\uAD6C \uAC1C\uBC29\uD560 \uB54C \uBC1C\uC0DD\uD558\uB294 55Hz \uCD08\uC800\uC5ED \uCDA9\uACA9\uD30C, 4.2kHz \uC720\uB9AC \uD30C\uD3B8 \uCE90\uC2A4\uCF00\uC774\uB4DC, \uCC28\uC6D0 \uC5ED\uD761\uC785 \uC65C\uACE1\uC74C",
      targetDuration: 1.8,
      physicalLayers: [
        "Massive Spatial Shockwave (55Hz Deep Sub)",
        "Glass Shatter Cascade (4.2kHz Multi-burst)",
        "Dimensional Suction Void (1200Hz -> 80Hz Sweep)"
      ],
      agentRecipePrompt: "\uADE0\uC5F4\uC744 \uC601\uAD6C \uAC1C\uBC29\uD558\uB294 55Hz \uCD08\uC800\uC5ED \uCDA9\uACA9\uD30C\uC640 4.2kHz \uC720\uB9AC \uD30C\uD3B8 \uCE90\uC2A4\uCF00\uC774\uB4DC, 1200Hz->80Hz \uCC28\uC6D0 \uC5ED\uD761\uC785 \uC0AC\uC6B4\uB4DC\uB97C \uD569\uC131\uD574\uC918."
    },
    {
      id: "ritual.global_sentinel.failure_seal",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "sentinel_koi",
      artifactName: "\u{1F41F} Global Sentinel Rift (\uCC28\uC6D0 \uADE0\uC5F4 & \uC13C\uD2F0\uB110)",
      fsPath: "zen/artifacts/sentinel_koi/failure_seal",
      kind: "cue",
      bus: "ritual",
      nativeBasePitch: 840,
      name: "Failure Resync Seal (\uC2E4\uD328 \uAC15\uC81C \uD45C\uBC31 \uBD09\uD569\uC74C)",
      category: SOUND_TARGET_CATEGORIES.RITUAL,
      acousticConcept: "\uD0C0\uC774\uBC0D \uC2E4\uD328 \uC2DC \uC2DC\uC2A4\uD15C\uC774 \uADE0\uC5F4\uC744 \uAC15\uC81C\uB85C \uB2EB\uACE0 \uD654\uBA74\uC744 \uD558\uC597\uAC8C \uD45C\uBC31\uD574\uBC84\uB9AC\uB294 \uCC28\uAC00\uC6B4 \uB514\uC9C0\uD138 \uBA54\uD0C8\uB9AD \uB77D\uD0B9\uACFC \uD654\uC774\uD2B8\uC544\uC6C3 \uAC10\uC1E0\uC74C",
      targetDuration: 1.2,
      physicalLayers: [
        "Cold Metallic Lock Clang (840Hz & 1680Hz)",
        "Whiteout Digital Bleach Sizzle Noise",
        "Low Error Absorption Thud (90Hz)"
      ],
      agentRecipePrompt: "\uC2E4\uD328 \uC2DC \uD654\uBA74\uC774 \uD45C\uBC31 \uBD09\uD569\uB418\uB294 840Hz \uBA54\uD0C8\uB9AD \uB77D\uD0B9\uC74C\uACFC \uD654\uC774\uD2B8\uC544\uC6C3 \uB178\uC774\uC988 \uAC10\uC1E0 \uC0AC\uC6B4\uB4DC\uB97C \uD569\uC131\uD574\uC918."
    },
    // =========================================================================
    // === ZEN THEME : APP SYSTEM FX ===
    // =========================================================================
    {
      id: "zen.app.switch_toggle",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.APP_FX,
      artifact: null,
      artifactName: "\u2699\uFE0F App System FX (\uC571 \uD6A8\uACFC\uC74C)",
      fsPath: "zen/app_fx/switch_toggle",
      kind: "cue",
      bus: "sfx",
      name: "Wood Block Toggle Switch (\uBAA9\uAC01 \uD1A0\uAE00 \uC2A4\uC704\uCE58\uC74C)",
      category: SOUND_TARGET_CATEGORIES.UI_INTERACTION,
      acousticConcept: "\uC815\uAC08\uD55C \uB9E4\uD654\uB098\uBB34 \uC870\uAC01\uC744 \uBD80\uB4DC\uB7FD\uAC8C \uB9DE\uBB3C\uB9AC\uB294 \uB530\uB73B\uD55C UI \uD1A0\uAE00 \uD074\uB9AD\uC74C",
      targetDuration: 0.12,
      physicalLayers: [
        "Soft Wood Click (820Hz Bandpass)",
        "Natural Felt Damping (0.05s Decay)"
      ],
      agentRecipePrompt: "\uB9E4\uD654\uB098\uBB34 \uC9C8\uAC10\uC758 820Hz \uBC34\uB4DC\uD328\uC2A4 \uD074\uB9AD\uACFC \uD3A0\uD2B8 \uB310\uD551\uC774 \uB4E4\uC5B4\uAC04 \uBD80\uB4DC\uB7EC\uC6B4 \uC2A4\uC704\uCE58 \uD1A0\uAE00\uC74C\uC744 \uD569\uC131\uD574\uC918."
    },
    {
      id: "zen.app.tab_navigation",
      theme: "zen",
      scope: SOUND_TARGET_SCOPES.APP_FX,
      artifact: null,
      artifactName: "\u2699\uFE0F App System FX (\uC571 \uD6A8\uACFC\uC74C)",
      fsPath: "zen/app_fx/tab_navigation",
      kind: "cue",
      bus: "sfx",
      name: "Washi Paper Sheet Page Turn (\uD55C\uC9C0 \uB118\uAE40\uC74C)",
      category: SOUND_TARGET_CATEGORIES.UI_INTERACTION,
      acousticConcept: "\uACE0\uAE09 \uD55C\uC9C0\uB098 \uC11C\uCC45 \uD398\uC774\uC9C0\uB97C \uC870\uC6A9\uD788 \uB118\uAE38 \uB54C \uC2A4\uCE58\uB294 \uBD80\uB4DC\uB7EC\uC6B4 \uC12C\uC720 \uB9C8\uCC30\uC74C",
      targetDuration: 0.18,
      physicalLayers: [
        "Paper Friction Pink Noise Sweep (1200Hz -> 3000Hz)",
        "Gentle Air Envelope"
      ],
      agentRecipePrompt: "\uD55C\uC9C0\uB098 \uC804\uD1B5 \uC885\uC774\uB97C \uB118\uAE38 \uB54C \uBC1C\uC0DD\uD558\uB294 \uC12C\uC720\uC9C8 \uD551\uD06C \uB178\uC774\uC988 \uB9C8\uCC30\uC74C\uC744 \uD569\uC131\uD574\uC918."
    },
    // =========================================================================
    // === ENTROPY THEME ===
    // =========================================================================
    {
      id: "entropy.data_overflow.pulse",
      theme: "entropy",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "terminal_console",
      artifactName: "\u{1F4DF} Industrial Terminal (\uC0B0\uC5C5\uC6A9 \uCF58\uC194)",
      fsPath: "entropy/artifacts/terminal_console/data_pulse",
      kind: "cue",
      bus: "sfx",
      name: "Data Overflow CRT Pulse (\uB370\uC774\uD130 \uC624\uBC84\uD50C\uB85C\uC6B0 \uD384\uC2A4)",
      category: SOUND_TARGET_CATEGORIES.FRICTION_GATE,
      acousticConcept: "\uC0B0\uC5C5 \uCF58\uC194 CRT \uBAA8\uB2C8\uD130\uC640 \uACE0\uC555 \uB370\uC774\uD130 \uBC84\uC2A4\uD2B8\uAC00 \uCDA9\uB3CC\uD558\uB294 \uB0A0\uCE74\uB85C\uC6B4 \uB514\uC9C0\uD138 \uD384\uC2A4",
      targetDuration: 0.22,
      physicalLayers: [
        "Square Wave Chirp (1400Hz -> 180Hz)",
        "Analog Distortion Saturation",
        "Electromagnetic Hum (60Hz)"
      ],
      agentRecipePrompt: "\uC0AC\uAC01\uD30C \uC8FC\uD30C\uC218 \uAE09\uB77D, \uC544\uB0A0\uB85C\uADF8 \uC0C8\uCE04\uB808\uC774\uC158, 60Hz \uD5D8 \uB178\uC774\uC988\uB97C \uC870\uD569\uD55C Entropy \uD130\uBBF8\uB110 \uD384\uC2A4 \uC2E0\uC2A4\uB97C \uAD6C\uD604\uD574\uC918."
    },
    {
      id: "entropy.console.idle_drone",
      theme: "entropy",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "terminal_console",
      artifactName: "\u{1F4DF} Industrial Terminal (\uC0B0\uC5C5\uC6A9 \uCF58\uC194)",
      fsPath: "entropy/artifacts/terminal_console/idle_hum",
      kind: "scene",
      bus: "ambient",
      name: "Transformer Cooling Hum (\uD2B8\uB79C\uC2A4\uD3EC\uBA38 \uD5D8 \uB8E8\uD504)",
      category: SOUND_TARGET_CATEGORIES.AMBIENT,
      acousticConcept: "\uB300\uD615 \uC0B0\uC5C5 \uC11C\uBC84\uC2E4\uC758 \uB0C9\uAC01 \uD32C\uACFC \uC804\uB825 \uD2B8\uB79C\uC2A4\uD3EC\uBA38\uAC00 \uB0B4\uB294 \uAE30\uACC4\uC801 \uB4DC\uB860",
      targetDuration: 4,
      physicalLayers: [
        "Transformer Hum (50Hz / 100Hz / 150Hz Sawtooth)",
        "Cooling Air Exhaust Noise"
      ],
      agentRecipePrompt: "\uD1B1\uB2C8\uD30C \uAE30\uBC18 50Hz \uC804\uB825 \uD5D8\uACFC \uCFE8\uB9C1 \uBC30\uAE30 \uB178\uC774\uC988\uB97C \uAC00\uC9C4 \uC0B0\uC5C5\uC6A9 \uAE30\uACC4 \uC570\uBE44\uC5B8\uC2A4 \uB8E8\uD504\uB97C \uAD6C\uD604\uD574\uC918."
    },
    // =========================================================================
    // === CYBERPUNK THEME ===
    // =========================================================================
    {
      id: "cyberpunk.neon.glitch_click",
      theme: "cyberpunk",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "neon_cyberdeck",
      artifactName: "\u26A1 Cyberdeck Terminal (\uC0AC\uC774\uBC84\uB371)",
      fsPath: "cyberpunk/artifacts/cyberdeck/glitch_click",
      kind: "cue",
      bus: "sfx",
      name: "Neon Bit-Crush Spark (\uB124\uC628 \uAE00\uB9AC\uCE58 \uC2A4\uD30C\uD06C)",
      category: SOUND_TARGET_CATEGORIES.UI_INTERACTION,
      acousticConcept: "\uB124\uC628 \uAC04\uD310\uC758 \uBC29\uC804 \uC2A4\uD30C\uD06C\uC640 \uBE44\uD2B8\uD06C\uB7EC\uC2DC\uB41C \uC0AC\uC774\uBC84\uB124\uD2F1 UI \uC0C1\uD638\uC791\uC6A9\uC74C",
      targetDuration: 0.15,
      physicalLayers: [
        "Electric Discharge Spark Transient",
        "Bit-reduced Highpass Noise (3.5 kHz)",
        "Laser Drop Sine (2400Hz -> 400Hz)"
      ],
      agentRecipePrompt: "\uBC29\uC804 \uC2A4\uD30C\uD06C \uD2B8\uB79C\uC9C0\uC5B8\uD2B8\uC640 2.4kHz->400Hz \uB808\uC774\uC800 \uD53C\uCE58 \uB4DC\uB86D\uC744 \uC870\uD569\uD55C \uC0AC\uC774\uBC84\uD391\uD06C \uAE00\uB9AC\uCE58 \uC2E0\uC2A4\uB97C \uAD6C\uD604\uD574\uC918."
    },
    // =========================================================================
    // === MATRIX THEME ===
    // =========================================================================
    {
      id: "matrix.digital_rain.chime",
      theme: "matrix",
      scope: SOUND_TARGET_SCOPES.ARTIFACT,
      artifact: "digital_rain",
      artifactName: "\u{1F327}\uFE0F Digital Rain (\uB514\uC9C0\uD138 \uB808\uC778)",
      fsPath: "matrix/artifacts/digital_rain/glyph_cascade",
      kind: "cue",
      bus: "sfx",
      name: "Glyph Cascade Crystals (\uAE00\uB9AC\uD504 \uD06C\uB9AC\uC2A4\uD0C8 \uCC28\uC784)",
      category: SOUND_TARGET_CATEGORIES.UI_INTERACTION,
      acousticConcept: "\uB179\uC0C9 \uBB38\uC790\uC5F4\uC774 \uC3DF\uC544\uC838 \uB0B4\uB9B4 \uB54C \uB098\uB294 \uCD08\uC18C\uD615 \uACE0\uC8FC\uD30C \uB514\uC9C0\uD138 \uD06C\uB9AC\uC2A4\uD0C8 \uCC28\uC784",
      targetDuration: 0.35,
      physicalLayers: [
        "Arpeggiated Sine Beads (1760Hz, 2640Hz, 3520Hz)",
        "FM Operator Modulation"
      ],
      agentRecipePrompt: "\uCD08\uACE0\uC8FC\uD30C \uC0AC\uC778 \uBE44\uB4DC \uC544\uB974\uD398\uC9C0\uC624\uC640 FM \uBCC0\uC870\uB97C \uD65C\uC6A9\uD55C \uB9E4\uD2B8\uB9AD\uC2A4 \uAE00\uB9AC\uD504 \uCE90\uC2A4\uCF00\uC774\uB4DC \uC2E0\uC2A4\uB97C \uAD6C\uD604\uD574\uC918."
    },
    ...PRODUCT_REVIEW_TARGETS
  ]);

  // scripts/dev/sound-lab/scanner/soundCatalogScanner.js
  var KNOWN_THEME_PACKS = {
    zen: zenSoundPack
  };
  function resolveLiveSoundStatus(theme, id, kind) {
    const pack = KNOWN_THEME_PACKS[theme];
    if (!pack) {
      return {
        status: SOUND_TARGET_STATUS.PLANNED,
        descriptor: null,
        reason: "theme_sound_pack_unregistered"
      };
    }
    const descriptor = kind === "cue" ? pack.resolveCue?.(id) || pack.cues?.[id] || null : pack.scenes?.[id] || null;
    if (!descriptor) {
      return {
        status: SOUND_TARGET_STATUS.PLANNED,
        descriptor: null,
        reason: "unmapped_in_sound_pack"
      };
    }
    if (descriptor.kind === SOUND_DESCRIPTOR_KINDS.SYNTH) {
      return {
        status: SOUND_TARGET_STATUS.SYNTH,
        descriptor,
        hasPlayFunction: typeof descriptor.play === "function"
      };
    }
    if (descriptor.kind === SOUND_DESCRIPTOR_KINDS.ASSET) {
      return {
        status: SOUND_TARGET_STATUS.ASSET,
        descriptor,
        assetPath: descriptor.assetPath || descriptor.path || ""
      };
    }
    if (descriptor.kind === SOUND_DESCRIPTOR_KINDS.SILENT) {
      return {
        status: SOUND_TARGET_STATUS.SILENT,
        descriptor,
        reason: descriptor.reason || "silent_withheld"
      };
    }
    return {
      status: SOUND_TARGET_STATUS.PLANNED,
      descriptor
    };
  }
  function scanSoundCatalog() {
    const scannedItems = [];
    const themeMetrics = {};
    for (const spec of SOUND_TARGET_SPECS) {
      const live = resolveLiveSoundStatus(spec.theme, spec.id, spec.kind);
      const scanned = {
        ...spec,
        liveStatus: live.status,
        liveDetails: live,
        isImplemented: live.status === SOUND_TARGET_STATUS.SYNTH || live.status === SOUND_TARGET_STATUS.ASSET
      };
      scannedItems.push(scanned);
      if (!themeMetrics[spec.theme]) {
        themeMetrics[spec.theme] = {
          total: 0,
          synthCount: 0,
          assetCount: 0,
          silentCount: 0,
          plannedCount: 0,
          implementedCount: 0
        };
      }
      const tm = themeMetrics[spec.theme];
      tm.total += 1;
      if (live.status === SOUND_TARGET_STATUS.SYNTH) tm.synthCount += 1;
      else if (live.status === SOUND_TARGET_STATUS.ASSET) tm.assetCount += 1;
      else if (live.status === SOUND_TARGET_STATUS.SILENT) tm.silentCount += 1;
      else if (live.status === SOUND_TARGET_STATUS.PLANNED) tm.plannedCount += 1;
      if (scanned.isImplemented) tm.implementedCount += 1;
    }
    let totalTargets = scannedItems.length;
    let totalImplemented = 0;
    let totalSynth = 0;
    let totalAsset = 0;
    let totalSilent = 0;
    let totalPlanned = 0;
    for (const [theme, m] of Object.entries(themeMetrics)) {
      m.completionRate = m.total > 0 ? m.implementedCount / m.total * 100 : 0;
      totalImplemented += m.implementedCount;
      totalSynth += m.synthCount;
      totalAsset += m.assetCount;
      totalSilent += m.silentCount;
      totalPlanned += m.plannedCount;
    }
    const overallCompletionRate = totalTargets > 0 ? totalImplemented / totalTargets * 100 : 0;
    return {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      items: scannedItems,
      themeMetrics,
      summary: {
        totalTargets,
        totalImplemented,
        totalSynth,
        totalAsset,
        totalSilent,
        totalPlanned,
        overallCompletionRate: Number(overallCompletionRate.toFixed(1))
      },
      declaredRuntimeCues: Object.values(SOUND_CUE_IDS),
      declaredRuntimeScenes: Object.values(SOUND_SCENE_IDS)
    };
  }

  // scripts/dev/sound-lab/engine/primitives/ModalResonanceBank.js
  var ModalResonanceBank = class {
    static schedulePartial(ctx, destination, {
      frequency = 440,
      startAt = 0,
      duration = 0.2,
      attack = 2e-3,
      gain = 0.5,
      type = "sine",
      detune = 0
    } = {}) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = type;
      osc.detune.setValueAtTime(detune, startAt);
      osc.frequency.setValueAtTime(frequency, startAt);
      gainNode.gain.setValueAtTime(1e-4, startAt);
      gainNode.gain.exponentialRampToValueAtTime(
        Math.max(1e-4, gain),
        startAt + Math.max(1e-3, attack)
      );
      gainNode.gain.exponentialRampToValueAtTime(1e-4, startAt + duration);
      osc.connect(gainNode);
      gainNode.connect(destination);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.02);
      return { osc, gainNode };
    }
    static scheduleBank(ctx, destination, {
      partials = [],
      startAt = 0,
      gainMultiplier = 1,
      frequencyMultiplier = 1
    } = {}) {
      return partials.map((partial) => this.schedulePartial(ctx, destination, {
        ...partial,
        frequency: partial.frequency * frequencyMultiplier,
        gain: partial.gain * gainMultiplier,
        startAt: startAt + (partial.timeOffset || 0)
      }));
    }
  };

  // scripts/dev/sound-lab/engine/primitives/NoiseGenerator.js
  var sharedWhiteNoiseBuffer = null;
  var sharedPinkNoiseBuffer2 = null;
  var NoiseGenerator = class {
    static getWhiteNoiseBuffer(ctx, durationSeconds = 1) {
      const sampleRate = ctx.sampleRate || 44100;
      const targetSamples = Math.floor(sampleRate * durationSeconds);
      if (sharedWhiteNoiseBuffer && sharedWhiteNoiseBuffer.length >= targetSamples) {
        return sharedWhiteNoiseBuffer;
      }
      const buffer = ctx.createBuffer(1, targetSamples, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < targetSamples; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      sharedWhiteNoiseBuffer = buffer;
      return buffer;
    }
    static getPinkNoiseBuffer(ctx, durationSeconds = 1) {
      const sampleRate = ctx.sampleRate || 44100;
      const targetSamples = Math.floor(sampleRate * durationSeconds);
      if (sharedPinkNoiseBuffer2 && sharedPinkNoiseBuffer2.length >= targetSamples) {
        return sharedPinkNoiseBuffer2;
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
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
      sharedPinkNoiseBuffer2 = buffer;
      return buffer;
    }
    static scheduleBurst(ctx, destination, {
      startAt = 0,
      duration = 0.05,
      attack = 2e-3,
      gain = 0.5,
      noiseType = "white",
      filterType = "bandpass",
      filterFrequency = 1e3,
      filterQ = 4
    } = {}) {
      const noiseBuffer = noiseType === "pink" ? this.getPinkNoiseBuffer(ctx, Math.max(duration + 0.1, 0.5)) : this.getWhiteNoiseBuffer(ctx, Math.max(duration + 0.1, 0.5));
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFrequency, startAt);
      filter.Q.setValueAtTime(filterQ, startAt);
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1e-4, startAt);
      gainNode.gain.exponentialRampToValueAtTime(
        Math.max(1e-4, gain),
        startAt + Math.max(1e-3, attack)
      );
      gainNode.gain.exponentialRampToValueAtTime(1e-4, startAt + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(destination);
      source.start(startAt);
      source.stop(startAt + duration + 0.02);
      return { source, filter, gainNode };
    }
  };

  // scripts/dev/sound-lab/engine/primitives/TransientChirp.js
  var TransientChirp = class {
    static schedule(ctx, destination, {
      startAt = 0,
      startFreq = 1400,
      endFreq = 400,
      duration = 0.02,
      gain = 0.5,
      type = "sine"
    } = {}) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, startAt);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(10, endFreq),
        startAt + duration * 0.6
      );
      gainNode.gain.setValueAtTime(1e-4, startAt);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(1e-4, gain), startAt + 15e-4);
      gainNode.gain.exponentialRampToValueAtTime(1e-4, startAt + duration);
      osc.connect(gainNode);
      gainNode.connect(destination);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.015);
      return { osc, gainNode };
    }
  };

  // scripts/dev/sound-lab/engine/core/ParameterAutomator.js
  var ParameterAutomator = class {
    static applyJitter(value, jitterRatio = 0.03) {
      const range = jitterRatio * 2;
      const factor = 1 - jitterRatio + Math.random() * range;
      return value * factor;
    }
    static scheduleDecayEnvelope(param, {
      startAt,
      peakValue = 1,
      minValue = 1e-4,
      attackDuration = 2e-3,
      decayDuration = 0.2
    } = {}) {
      param.setValueAtTime(minValue, startAt);
      param.exponentialRampToValueAtTime(
        Math.max(minValue, peakValue),
        startAt + Math.max(1e-3, attackDuration)
      );
      param.exponentialRampToValueAtTime(
        minValue,
        startAt + attackDuration + decayDuration
      );
    }
    static scheduleAdsr(param, {
      startAt,
      peakValue = 1,
      sustainValue = 0.5,
      minValue = 1e-4,
      attack = 0.01,
      decay = 0.05,
      sustain = 0.2,
      release = 0.1
    } = {}) {
      param.setValueAtTime(minValue, startAt);
      param.exponentialRampToValueAtTime(Math.max(minValue, peakValue), startAt + attack);
      param.exponentialRampToValueAtTime(Math.max(minValue, sustainValue), startAt + attack + decay);
      param.setValueAtTime(Math.max(minValue, sustainValue), startAt + attack + decay + sustain);
      param.exponentialRampToValueAtTime(minValue, startAt + attack + decay + sustain + release);
    }
  };

  // scripts/dev/sound-lab/engine/synths/zen/ShishiOdoshiClackSynth.js
  var ShishiOdoshiClackSynth = class {
    static play(ctx, destination, {
      intensity = 0.75,
      basePitch = 468,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 4e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.75));
      const jitter = ParameterAutomator.applyJitter(1, 0.018);
      const pitchRatio = (basePitch || 468) / 468;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * safeIntensity, now);
      master.gain.exponentialRampToValueAtTime(1e-4, now + 0.28);
      master.connect(destination);
      NoiseGenerator.scheduleBurst(ctx, master, {
        startAt: now,
        duration: 0.018,
        gain: 0.65 * safeIntensity,
        filterType: "bandpass",
        filterFrequency: 2800 * jitter * pitchRatio,
        filterQ: 3.2
      });
      TransientChirp.schedule(ctx, master, {
        startAt: now,
        startFreq: 580 * 2.4 * jitter * pitchRatio,
        endFreq: 580 * jitter * pitchRatio,
        duration: 0.018,
        gain: 0.5 * safeIntensity
      });
      NoiseGenerator.scheduleBurst(ctx, master, {
        startAt: now + 1e-3,
        duration: 0.065,
        gain: 0.45 * safeIntensity,
        filterType: "bandpass",
        filterFrequency: 760 * jitter * pitchRatio,
        filterQ: 5.5
      });
      ModalResonanceBank.schedulePartial(ctx, master, {
        frequency: 118 * jitter,
        startAt: now,
        duration: 0.075,
        gain: 0.38 * safeIntensity,
        type: "triangle"
      });
      ModalResonanceBank.schedulePartial(ctx, master, {
        frequency: 468 * jitter * pitchRatio,
        startAt: now + 1e-3,
        duration: 0.165,
        gain: 0.52 * safeIntensity,
        type: "sine"
      });
      ModalResonanceBank.schedulePartial(ctx, master, {
        frequency: 875 * jitter * pitchRatio,
        startAt: now + 1e-3,
        duration: 0.125,
        gain: 0.36 * safeIntensity,
        type: "sine"
      });
      ModalResonanceBank.schedulePartial(ctx, master, {
        frequency: 1540 * jitter * pitchRatio,
        startAt: now + 2e-3,
        duration: 0.075,
        gain: 0.24 * safeIntensity,
        type: "sine"
      });
      ModalResonanceBank.schedulePartial(ctx, master, {
        frequency: 2720 * jitter * pitchRatio,
        startAt: now + 2e-3,
        duration: 0.042,
        gain: 0.14 * safeIntensity,
        type: "sine"
      });
      const dropOsc = ctx.createOscillator();
      const dropGain = ctx.createGain();
      const dropStart = now + 0.18;
      const dropDuration = 0.055;
      dropOsc.type = "sine";
      dropOsc.frequency.setValueAtTime(480 * jitter, dropStart);
      dropOsc.frequency.exponentialRampToValueAtTime(1150 * jitter, dropStart + dropDuration * 0.4);
      dropOsc.frequency.exponentialRampToValueAtTime(820 * jitter, dropStart + dropDuration);
      dropGain.gain.setValueAtTime(1e-4, dropStart);
      dropGain.gain.exponentialRampToValueAtTime(0.22 * safeIntensity, dropStart + 3e-3);
      dropGain.gain.exponentialRampToValueAtTime(1e-5, dropStart + dropDuration);
      dropOsc.connect(dropGain);
      dropGain.connect(master);
      dropOsc.start(dropStart);
      dropOsc.stop(dropStart + dropDuration + 0.01);
      return true;
    }
  };

  // scripts/dev/sound-lab/engine/primitives/FluidAcoustics.js
  var FluidAcoustics = class {
    static scheduleDroplet(ctx, destination, {
      startAt = 0,
      startFreq = 400,
      endFreq = 1100,
      duration = 0.06,
      gain = 0.35
    } = {}) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(startFreq, startAt);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startAt + duration * 0.4);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq * 0.8), startAt + duration);
      gainNode.gain.setValueAtTime(1e-4, startAt);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(1e-4, gain), startAt + 3e-3);
      gainNode.gain.exponentialRampToValueAtTime(1e-4, startAt + duration);
      osc.connect(gainNode);
      gainNode.connect(destination);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.015);
      return { osc, gainNode };
    }
    static scheduleStreamFlow(ctx, destination, {
      startAt = 0,
      duration = 1,
      gain = 0.25,
      centerFreq = 650,
      q = 4
    } = {}) {
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, Math.max(duration + 0.2, 1));
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(centerFreq, startAt);
      filter.Q.setValueAtTime(q, startAt);
      const steps = Math.min(20, Math.floor(duration * 8));
      for (let i = 1; i <= steps; i += 1) {
        const t = startAt + i / steps * duration;
        const wobble = centerFreq * (0.88 + Math.random() * 0.24);
        filter.frequency.exponentialRampToValueAtTime(wobble, t);
      }
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1e-4, startAt);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(1e-4, gain), startAt + 0.04);
      gainNode.gain.setValueAtTime(Math.max(1e-4, gain), startAt + Math.max(0.04, duration - 0.06));
      gainNode.gain.exponentialRampToValueAtTime(1e-4, startAt + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(destination);
      source.start(startAt);
      source.stop(startAt + duration + 0.02);
      return { source, filter, gainNode };
    }
  };

  // scripts/dev/sound-lab/engine/synths/zen/ShishiOdoshiWaterLoopSynth.js
  var ShishiOdoshiWaterLoopSynth = class {
    /**
     * Inflow water trickle & rhythmic droplets filling the bamboo tube
     */
    static play(ctx, destination, {
      intensity = 0.7,
      duration = 3.5,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 5e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.7));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * safeIntensity, now);
      master.gain.exponentialRampToValueAtTime(1e-4, now + duration);
      master.connect(destination);
      FluidAcoustics.scheduleStreamFlow(ctx, master, {
        startAt: now,
        duration,
        gain: 0.28 * safeIntensity,
        centerFreq: 680,
        q: 3.8
      });
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
      const cavitySrc = ctx.createBufferSource();
      cavitySrc.buffer = noiseBuffer;
      const cavityFilter = ctx.createBiquadFilter();
      cavityFilter.type = "bandpass";
      cavityFilter.frequency.setValueAtTime(920, now);
      cavityFilter.Q.setValueAtTime(6, now);
      const cavityGain = ctx.createGain();
      cavityGain.gain.setValueAtTime(1e-4, now);
      cavityGain.gain.linearRampToValueAtTime(0.18 * safeIntensity, now + 0.2);
      cavityGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      cavitySrc.connect(cavityFilter);
      cavityFilter.connect(cavityGain);
      cavityGain.connect(master);
      cavitySrc.start(now);
      cavitySrc.stop(now + duration + 0.05);
      const dropTimings = [0.12, 0.48, 0.95, 1.45, 2.1, 2.8];
      dropTimings.forEach((offset, idx) => {
        if (offset < duration) {
          FluidAcoustics.scheduleDroplet(ctx, master, {
            startAt: now + offset,
            startFreq: 340 + idx % 3 * 90,
            endFreq: 980 + idx % 3 * 140,
            duration: 0.055,
            gain: (0.3 + idx % 2 * 0.1) * safeIntensity
          });
        }
      });
      return true;
    }
    /**
     * Overflow torrent and splash when the bamboo tube reaches capacity and tips over
     */
    static playOverflow(ctx, destination, {
      intensity = 0.8,
      duration = 2.2,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 4e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.8));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.32 * safeIntensity, now);
      master.gain.exponentialRampToValueAtTime(1e-4, now + duration);
      master.connect(destination);
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.3);
      const src1 = ctx.createBufferSource();
      src1.buffer = noiseBuffer;
      const filter1 = ctx.createBiquadFilter();
      filter1.type = "bandpass";
      filter1.frequency.setValueAtTime(420, now);
      filter1.frequency.exponentialRampToValueAtTime(680, now + duration * 0.4);
      filter1.frequency.exponentialRampToValueAtTime(260, now + duration);
      filter1.Q.setValueAtTime(2.5, now);
      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(1e-4, now);
      gain1.gain.linearRampToValueAtTime(0.75 * safeIntensity, now + 0.25);
      gain1.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      src1.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(master);
      src1.start(now);
      src1.stop(now + duration + 0.05);
      const src2 = ctx.createBufferSource();
      src2.buffer = noiseBuffer;
      const filter2 = ctx.createBiquadFilter();
      filter2.type = "bandpass";
      filter2.frequency.setValueAtTime(1400, now);
      filter2.frequency.exponentialRampToValueAtTime(950, now + duration * 0.7);
      filter2.Q.setValueAtTime(3.5, now);
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(1e-4, now);
      gain2.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      src2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(master);
      src2.start(now);
      src2.stop(now + duration + 0.05);
      const splashOffsets = [0.18, 0.32, 0.52, 0.78, 1.1];
      splashOffsets.forEach((offset, idx) => {
        if (offset < duration) {
          FluidAcoustics.scheduleDroplet(ctx, master, {
            startAt: now + offset,
            startFreq: 420 + idx * 80,
            endFreq: 1200 + idx * 90,
            duration: 0.045,
            gain: (0.28 + idx % 2 * 0.08) * safeIntensity
          });
        }
      });
      return true;
    }
  };

  // scripts/dev/sound-lab/engine/synths/zen/ZenFurinGlassClinkSynth.js
  var ZenFurinGlassClinkSynth = class {
    static play(ctx, destination, {
      intensity = 0.75,
      basePitch = 3136,
      // G7 - Inverted glass cup fundamental
      protocolScope = "site",
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 2e-3;
      const isGlobal = protocolScope === "global";
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const jitter = 0.998 + Math.random() * 4e-3;
      const fCup = (isGlobal ? 2093 : basePitch || 3136) * jitter;
      const fRod = fCup * 1.578;
      const fRimFlash = fCup * 2.63;
      const master = ctx.createGain();
      master.gain.setValueAtTime((isGlobal ? 0.28 : 0.22) * safeIntensity, now);
      master.connect(destination);
      const oscFlash = ctx.createOscillator();
      const gainFlash = ctx.createGain();
      oscFlash.type = "sine";
      oscFlash.frequency.setValueAtTime(fRimFlash, now);
      gainFlash.gain.setValueAtTime(1e-4, now);
      gainFlash.gain.linearRampToValueAtTime(0.22 * safeIntensity, now + 2e-4);
      gainFlash.gain.exponentialRampToValueAtTime(1e-5, now + 0.06);
      oscFlash.connect(gainFlash);
      gainFlash.connect(master);
      oscFlash.start(now);
      oscFlash.stop(now + 0.08);
      const fRodTwin = fRod + (isGlobal ? 1.5 : 2.4);
      const rodDecay = isGlobal ? 0.8 : 0.48;
      const oscRodA = ctx.createOscillator();
      const gainRodA = ctx.createGain();
      oscRodA.type = "sine";
      oscRodA.frequency.setValueAtTime(fRod, now);
      const peakRodA = 0.58 * safeIntensity;
      gainRodA.gain.setValueAtTime(1e-4, now);
      gainRodA.gain.linearRampToValueAtTime(peakRodA, now + 3e-4);
      gainRodA.gain.exponentialRampToValueAtTime(1e-5, now + rodDecay);
      oscRodA.connect(gainRodA);
      gainRodA.connect(master);
      oscRodA.start(now);
      oscRodA.stop(now + rodDecay + 0.03);
      const oscRodB = ctx.createOscillator();
      const gainRodB = ctx.createGain();
      oscRodB.type = "sine";
      oscRodB.frequency.setValueAtTime(fRodTwin, now);
      const peakRodB = 0.36 * safeIntensity;
      gainRodB.gain.setValueAtTime(1e-4, now);
      gainRodB.gain.linearRampToValueAtTime(peakRodB, now + 3e-4);
      gainRodB.gain.exponentialRampToValueAtTime(1e-5, now + rodDecay * 0.85);
      oscRodB.connect(gainRodB);
      gainRodB.connect(master);
      oscRodB.start(now);
      oscRodB.stop(now + rodDecay + 0.03);
      const cupOnset = now + 0.014;
      const totalCupDecay = isGlobal ? 2 : 1.3;
      const stage1CupTime = cupOnset + (isGlobal ? 0.18 : 0.12);
      const fCupTwin = fCup + (isGlobal ? 1.8 : 3.2);
      const oscCupA = ctx.createOscillator();
      const gainCupA = ctx.createGain();
      oscCupA.type = "sine";
      oscCupA.frequency.setValueAtTime(fCup, cupOnset);
      const peakCupA = 0.65 * safeIntensity;
      const stage1CupA = peakCupA * 0.38;
      gainCupA.gain.setValueAtTime(1e-4, cupOnset);
      gainCupA.gain.linearRampToValueAtTime(peakCupA, cupOnset + 4e-4);
      gainCupA.gain.exponentialRampToValueAtTime(Math.max(1e-4, stage1CupA), stage1CupTime);
      gainCupA.gain.exponentialRampToValueAtTime(1e-5, cupOnset + totalCupDecay);
      oscCupA.connect(gainCupA);
      gainCupA.connect(master);
      oscCupA.start(cupOnset);
      oscCupA.stop(cupOnset + totalCupDecay + 0.03);
      const oscCupB = ctx.createOscillator();
      const gainCupB = ctx.createGain();
      oscCupB.type = "sine";
      oscCupB.frequency.setValueAtTime(fCupTwin, cupOnset);
      const peakCupB = 0.42 * safeIntensity;
      const stage1CupB = peakCupB * 0.35;
      gainCupB.gain.setValueAtTime(1e-4, cupOnset);
      gainCupB.gain.linearRampToValueAtTime(peakCupB, cupOnset + 4e-4);
      gainCupB.gain.exponentialRampToValueAtTime(Math.max(1e-4, stage1CupB), stage1CupTime);
      gainCupB.gain.exponentialRampToValueAtTime(1e-5, cupOnset + totalCupDecay * 0.9);
      oscCupB.connect(gainCupB);
      gainCupB.connect(master);
      oscCupB.start(cupOnset);
      oscCupB.stop(cupOnset + totalCupDecay + 0.03);
      return true;
    }
  };

  // scripts/dev/sound-lab/engine/synths/zen/ZenKoiHydroAcousticsSynth.js
  var ZenKoiHydroAcousticsSynth = class {
    /**
     * 1. 잉어 수면 부상음 (Koi Wake Emerge)
     * 깊은 물속에서 가이드 잉어가 솟아오르며 표면 장력을 밀어올리는 부드러운 수류 스웰과 미세 기포
     */
    static playWakeSurface(ctx, destination, {
      intensity = 0.75,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 1.1;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.35 * safeIntensity, now);
      master.connect(destination);
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.exponentialRampToValueAtTime(680, now + duration * 0.65);
      filter.frequency.exponentialRampToValueAtTime(320, now + duration);
      filter.Q.setValueAtTime(3.5, now);
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1e-4, now);
      gainNode.gain.linearRampToValueAtTime(0.75 * safeIntensity, now + duration * 0.45);
      gainNode.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      source.start(now);
      source.stop(now + duration + 0.05);
      FluidAcoustics.scheduleDroplet(ctx, master, {
        startAt: now + 0.42,
        startFreq: 380,
        endFreq: 920,
        duration: 0.07,
        gain: 0.28 * safeIntensity
      });
      FluidAcoustics.scheduleDroplet(ctx, master, {
        startAt: now + 0.58,
        startFreq: 520,
        endFreq: 1180,
        duration: 0.05,
        gain: 0.18 * safeIntensity
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
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.26 * safeIntensity, now);
      master.connect(destination);
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.3);
      const src1 = ctx.createBufferSource();
      src1.buffer = noiseBuffer;
      const filter1 = ctx.createBiquadFilter();
      filter1.type = "bandpass";
      filter1.frequency.setValueAtTime(340, now);
      filter1.Q.setValueAtTime(2.8, now);
      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(1e-4, now);
      gain1.gain.linearRampToValueAtTime(0.65 * safeIntensity, now + 0.35);
      gain1.gain.setValueAtTime(0.65 * safeIntensity, now + duration - 0.4);
      gain1.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      src1.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(master);
      src1.start(now);
      src1.stop(now + duration + 0.05);
      const src2 = ctx.createBufferSource();
      src2.buffer = noiseBuffer;
      const filter2 = ctx.createBiquadFilter();
      filter2.type = "bandpass";
      filter2.frequency.setValueAtTime(850, now);
      filter2.Q.setValueAtTime(4.2, now);
      const steps = Math.floor(duration * 12);
      for (let i = 0; i <= steps; i += 1) {
        const t = now + i / steps * duration;
        const wave = Math.sin(i / steps * duration * Math.PI * 2 * 0.85);
        const modulatedFreq = 850 + wave * 180;
        filter2.frequency.exponentialRampToValueAtTime(Math.max(200, modulatedFreq), t);
      }
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(1e-4, now);
      gain2.gain.linearRampToValueAtTime(0.35 * safeIntensity, now + 0.35);
      gain2.gain.setValueAtTime(0.35 * safeIntensity, now + duration - 0.4);
      gain2.gain.exponentialRampToValueAtTime(1e-5, now + duration);
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
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 0.9;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.32 * safeIntensity, now);
      master.connect(destination);
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(920, now + duration * 0.45);
      filter.frequency.exponentialRampToValueAtTime(480, now + duration);
      filter.Q.setValueAtTime(4, now);
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1e-4, now);
      gainNode.gain.linearRampToValueAtTime(0.7 * safeIntensity, now + duration * 0.35);
      gainNode.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      source.start(now);
      source.stop(now + duration + 0.05);
      FluidAcoustics.scheduleDroplet(ctx, master, {
        startAt: now + 0.28,
        startFreq: 460,
        endFreq: 1040,
        duration: 0.08,
        gain: 0.3 * safeIntensity
      });
      return true;
    }
    /**
     * 4. 잉어 군집 잠수음 (School Descent Dive)
     * 5마리가 심연으로 잠수하는 하향 900Hz -> 180Hz 수중 필터 스윕과 묵직한 서브 글라이드
     */
    static playDescentDive(ctx, destination, {
      intensity = 0.75,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 1.4;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.34 * safeIntensity, now);
      master.connect(destination);
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + duration * 0.85);
      filter.Q.setValueAtTime(3.2, now);
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1e-4, now);
      gainNode.gain.linearRampToValueAtTime(0.8 * safeIntensity, now + 0.25);
      gainNode.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      source.start(now);
      source.stop(now + duration + 0.05);
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(135, now);
      subOsc.frequency.exponentialRampToValueAtTime(58, now + duration * 0.9);
      subGain.gain.setValueAtTime(1e-4, now);
      subGain.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 0.3);
      subGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
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
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 1.6;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * safeIntensity, now);
      master.connect(destination);
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + duration);
      filter.Q.setValueAtTime(1.5, now);
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(1e-4, now);
      gainNode.gain.linearRampToValueAtTime(0.55 * safeIntensity, now + 0.2);
      gainNode.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      source.start(now);
      source.stop(now + duration + 0.05);
      return true;
    }
  };

  // scripts/dev/sound-lab/engine/synths/zen/ZenRoom478BreathingSynth.js
  var ZenRoom478BreathingSynth = class {
    /**
     * 1. 4s Inhale Breath Swell (4초 들숨 수렴음)
     * 4초 동안 우주 공간에서 맑은 공기가 차오르는 108Hz 성스러운 기음 기반 화음 스웰 + 에어 텍스처
     */
    static playInhaleSwell(ctx, destination, {
      intensity = 0.75,
      basePitch = 108,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 4;
      const f0 = basePitch || 108;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.3 * safeIntensity, now);
      master.connect(destination);
      const chordFrequencies = [f0, f0 * 2, f0 * 3, f0 * 4];
      const chordGain = ctx.createGain();
      chordGain.gain.setValueAtTime(1e-4, now);
      chordGain.gain.exponentialRampToValueAtTime(0.68 * safeIntensity, now + duration * 0.85);
      chordGain.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.35);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(130, now);
      filter.frequency.exponentialRampToValueAtTime(850, now + duration);
      filter.Q.setValueAtTime(1.4, now);
      chordFrequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq + (idx * 0.25 - 0.35), now);
        osc.connect(chordGain);
        osc.start(now);
        osc.stop(now + duration + 0.4);
      });
      chordGain.connect(filter);
      filter.connect(master);
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.5);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const airFilter = ctx.createBiquadFilter();
      airFilter.type = "bandpass";
      airFilter.frequency.setValueAtTime(350, now);
      airFilter.frequency.exponentialRampToValueAtTime(900, now + duration);
      airFilter.Q.setValueAtTime(2.5, now);
      const airGain = ctx.createGain();
      airGain.gain.setValueAtTime(1e-4, now);
      airGain.gain.linearRampToValueAtTime(0.18 * safeIntensity, now + duration * 0.8);
      airGain.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.25);
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
      duration = 7,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const f0 = basePitch || 216;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.26 * safeIntensity, now);
      master.connect(destination);
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(f0, now);
      gain1.gain.setValueAtTime(1e-4, now);
      gain1.gain.linearRampToValueAtTime(0.5 * safeIntensity, now + 0.8);
      gain1.gain.setValueAtTime(0.5 * safeIntensity, now + duration - 0.8);
      gain1.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.4);
      osc1.connect(gain1);
      gain1.connect(master);
      osc1.start(now);
      osc1.stop(now + duration + 0.5);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(f0 + 1.2, now);
      gain2.gain.setValueAtTime(1e-4, now);
      gain2.gain.linearRampToValueAtTime(0.38 * safeIntensity, now + 0.8);
      gain2.gain.setValueAtTime(0.38 * safeIntensity, now + duration - 0.8);
      gain2.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.4);
      osc2.connect(gain2);
      gain2.connect(master);
      osc2.start(now);
      osc2.stop(now + duration + 0.5);
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(f0 * 0.5, now);
      gain3.gain.setValueAtTime(1e-4, now);
      gain3.gain.linearRampToValueAtTime(0.3 * safeIntensity, now + 1);
      gain3.gain.setValueAtTime(0.3 * safeIntensity, now + duration - 0.9);
      gain3.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.4);
      osc3.connect(gain3);
      gain3.connect(master);
      osc3.start(now);
      osc3.stop(now + duration + 0.5);
      const osc4 = ctx.createOscillator();
      const gain4 = ctx.createGain();
      osc4.type = "sine";
      osc4.frequency.setValueAtTime(f0 * 3, now);
      gain4.gain.setValueAtTime(1e-4, now);
      gain4.gain.linearRampToValueAtTime(0.12 * safeIntensity, now + 1.2);
      gain4.gain.setValueAtTime(0.12 * safeIntensity, now + duration - 1);
      gain4.gain.exponentialRampToValueAtTime(1e-5, now + duration + 0.4);
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
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 8;
      const f0 = basePitch || 108;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * safeIntensity, now);
      master.connect(destination);
      const oscMain = ctx.createOscillator();
      const gainMain = ctx.createGain();
      oscMain.type = "sine";
      oscMain.frequency.setValueAtTime(f0, now);
      gainMain.gain.setValueAtTime(1e-4, now);
      gainMain.gain.linearRampToValueAtTime(0.52 * safeIntensity, now + 0.5);
      gainMain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      oscMain.connect(gainMain);
      gainMain.connect(master);
      oscMain.start(now);
      oscMain.stop(now + duration + 0.1);
      const oscSub = ctx.createOscillator();
      const gainSub = ctx.createGain();
      oscSub.type = "sine";
      oscSub.frequency.setValueAtTime(f0 * 0.5, now);
      gainSub.gain.setValueAtTime(1e-4, now);
      gainSub.gain.linearRampToValueAtTime(0.38 * safeIntensity, now + 0.6);
      gainSub.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      oscSub.connect(gainSub);
      gainSub.connect(master);
      oscSub.start(now);
      oscSub.stop(now + duration + 0.1);
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.5);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(950, now);
      filter.frequency.exponentialRampToValueAtTime(75, now + duration * 0.85);
      filter.Q.setValueAtTime(1.2, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(1e-4, now);
      noiseGain.gain.linearRampToValueAtTime(0.3 * safeIntensity, now + 0.3);
      noiseGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
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
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 2e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 4.8;
      const f0 = basePitch || 108;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.3 * safeIntensity, now);
      master.connect(destination);
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = "lowpass";
      masterFilter.frequency.setValueAtTime(1800, now);
      masterFilter.Q.setValueAtTime(1.2, now);
      masterFilter.connect(master);
      const oscMallet = ctx.createOscillator();
      const gainMallet = ctx.createGain();
      oscMallet.type = "sine";
      oscMallet.frequency.setValueAtTime(140, now);
      oscMallet.frequency.exponentialRampToValueAtTime(80, now + 0.05);
      gainMallet.gain.setValueAtTime(1e-4, now);
      gainMallet.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 3e-3);
      gainMallet.gain.exponentialRampToValueAtTime(1e-5, now + 0.08);
      oscMallet.connect(gainMallet);
      gainMallet.connect(masterFilter);
      oscMallet.start(now);
      oscMallet.stop(now + 0.1);
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(f0, now);
      gain1.gain.setValueAtTime(1e-4, now);
      gain1.gain.linearRampToValueAtTime(0.72 * safeIntensity, now + 5e-3);
      gain1.gain.exponentialRampToValueAtTime(0.28 * safeIntensity, now + 0.9);
      gain1.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      osc1.connect(gain1);
      gain1.connect(masterFilter);
      osc1.start(now);
      osc1.stop(now + duration + 0.1);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(f0 + 1.2, now);
      gain2.gain.setValueAtTime(1e-4, now);
      gain2.gain.linearRampToValueAtTime(0.52 * safeIntensity, now + 6e-3);
      gain2.gain.exponentialRampToValueAtTime(1e-5, now + duration * 0.9);
      osc2.connect(gain2);
      gain2.connect(masterFilter);
      osc2.start(now);
      osc2.stop(now + duration + 0.1);
      const harmonics = [
        { mult: 2, gain: 0.35, dur: 3.8 },
        { mult: 3, gain: 0.2, dur: 2.5 },
        { mult: 5, gain: 0.1, dur: 1.6 },
        { mult: 8, gain: 0.04, dur: 0.9 }
      ];
      harmonics.forEach(({ mult, gain, dur }) => {
        const oscH = ctx.createOscillator();
        const gainH = ctx.createGain();
        oscH.type = "sine";
        oscH.frequency.setValueAtTime(f0 * mult, now);
        gainH.gain.setValueAtTime(1e-4, now);
        gainH.gain.linearRampToValueAtTime(gain * safeIntensity, now + 4e-3);
        gainH.gain.exponentialRampToValueAtTime(1e-5, now + dur);
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
      stopRef = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const f0 = basePitch || 108;
      const chargeDuration = Math.max(0.5, Number(duration) || 1.8);
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * safeIntensity, now);
      master.connect(destination);
      const oscCore = ctx.createOscillator();
      const gainCore = ctx.createGain();
      oscCore.type = "sine";
      oscCore.frequency.setValueAtTime(f0 * 0.667, now);
      oscCore.frequency.exponentialRampToValueAtTime(f0, now + chargeDuration);
      gainCore.gain.setValueAtTime(1e-4, now);
      gainCore.gain.exponentialRampToValueAtTime(0.5 * safeIntensity, now + chargeDuration);
      oscCore.connect(gainCore);
      gainCore.connect(master);
      oscCore.start(now);
      oscCore.stop(now + chargeDuration + 0.2);
      const oscSub = ctx.createOscillator();
      const gainSub = ctx.createGain();
      oscSub.type = "sine";
      oscSub.frequency.setValueAtTime(f0 * 0.333, now);
      oscSub.frequency.exponentialRampToValueAtTime(f0 * 0.5, now + chargeDuration);
      gainSub.gain.setValueAtTime(1e-4, now);
      gainSub.gain.exponentialRampToValueAtTime(0.35 * safeIntensity, now + chargeDuration);
      oscSub.connect(gainSub);
      gainSub.connect(master);
      oscSub.start(now);
      oscSub.stop(now + chargeDuration + 0.2);
      const oscOvertone = ctx.createOscillator();
      const gainOvertone = ctx.createGain();
      oscOvertone.type = "sine";
      oscOvertone.frequency.setValueAtTime(f0 * 1.333, now);
      oscOvertone.frequency.exponentialRampToValueAtTime(f0 * 2, now + chargeDuration);
      gainOvertone.gain.setValueAtTime(1e-4, now);
      gainOvertone.gain.setValueAtTime(1e-4, now + chargeDuration * 0.4);
      gainOvertone.gain.exponentialRampToValueAtTime(0.28 * safeIntensity, now + chargeDuration);
      oscOvertone.connect(gainOvertone);
      gainOvertone.connect(master);
      oscOvertone.start(now);
      oscOvertone.stop(now + chargeDuration + 0.2);
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, chargeDuration + 0.3);
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const vortexFilter = ctx.createBiquadFilter();
      vortexFilter.type = "bandpass";
      vortexFilter.frequency.setValueAtTime(180, now);
      vortexFilter.frequency.exponentialRampToValueAtTime(420, now + chargeDuration);
      vortexFilter.Q.setValueAtTime(2.5, now);
      const vortexGain = ctx.createGain();
      vortexGain.gain.setValueAtTime(1e-4, now);
      vortexGain.gain.exponentialRampToValueAtTime(0.22 * safeIntensity, now + chargeDuration);
      noiseSource.connect(vortexFilter);
      vortexFilter.connect(vortexGain);
      vortexGain.connect(master);
      noiseSource.start(now);
      noiseSource.stop(now + chargeDuration + 0.2);
      if (stopRef && typeof stopRef === "object") {
        stopRef.stop = (fadeSec = 0.15) => {
          try {
            const stopTime = ctx.currentTime + 2e-3;
            master.gain.setValueAtTime(master.gain.value, stopTime);
            master.gain.exponentialRampToValueAtTime(1e-5, stopTime + fadeSec);
            const haltTime = stopTime + fadeSec + 0.05;
            oscCore.stop(haltTime);
            oscSub.stop(haltTime);
            oscOvertone.stop(haltTime);
            noiseSource.stop(haltTime);
          } catch {
          }
        };
      }
      return true;
    }
  };

  // scripts/dev/sound-lab/engine/synths/zen/ZenGlobalSentinelRiftSynth.js
  var ZenGlobalSentinelRiftSynth = class {
    /**
     * 1. Simulation Rupture (시뮬레이션 균열 & 액정 파열음)
     * 스타터 잉어 가격 순간: 3.8kHz LCD 파쇄음 + 120Hz->45Hz 백라이트 에너지 서브 + 디지털 잉크 글리치
     */
    static playSimulationRupture(ctx, destination, {
      intensity = 0.85,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.85));
      const duration = 0.7;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.35 * safeIntensity, now);
      master.connect(destination);
      NoiseGenerator.scheduleBurst(ctx, master, {
        startAt: now,
        duration: 0.035,
        gain: 0.75 * safeIntensity,
        filterType: "bandpass",
        filterFrequency: 3800,
        filterQ: 4.2
      });
      TransientChirp.schedule(ctx, master, {
        startAt: now,
        startFreq: 6200,
        endFreq: 1200,
        duration: 0.025,
        gain: 0.6 * safeIntensity
      });
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(120, now);
      subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.22);
      subGain.gain.setValueAtTime(1e-4, now);
      subGain.gain.linearRampToValueAtTime(0.65 * safeIntensity, now + 5e-3);
      subGain.gain.exponentialRampToValueAtTime(1e-5, now + 0.35);
      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(now);
      subOsc.stop(now + 0.38);
      const stutterOffsets = [0.04, 0.09, 0.15];
      stutterOffsets.forEach((offset, idx) => {
        NoiseGenerator.scheduleBurst(ctx, master, {
          startAt: now + offset,
          duration: 0.012,
          gain: (0.4 - idx * 0.08) * safeIntensity,
          filterType: "bandpass",
          filterFrequency: 2200 + idx * 800,
          filterQ: 6
        });
      });
      return true;
    }
    /**
     * 2. Repair Telegraph (시스템 수리 접근 경고음 & 텐션 드론)
     * 센티넬이 다가올 때: 240Hz->520Hz 상승 텐션 글리치 드론 + 16Hz 클럭 스터터 펄스
     */
    static playRepairTelegraph(ctx, destination, {
      intensity = 0.8,
      duration = 2.5,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.8));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.3 * safeIntensity, now);
      master.connect(destination);
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gainNode = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + duration * 0.85);
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(480, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + duration * 0.85);
      filter.Q.setValueAtTime(4.5, now);
      gainNode.gain.setValueAtTime(1e-4, now);
      gainNode.gain.linearRampToValueAtTime(0.55 * safeIntensity, now + 0.3);
      gainNode.gain.setValueAtTime(0.55 * safeIntensity, now + duration - 0.4);
      gainNode.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = "square";
      lfo.frequency.setValueAtTime(16, now);
      lfo.frequency.linearRampToValueAtTime(28, now + duration);
      lfoGain.gain.setValueAtTime(0.25, now);
      lfo.connect(lfoGain.gain);
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(master);
      osc.start(now);
      osc.stop(now + duration + 0.05);
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(65, now);
      subOsc.frequency.exponentialRampToValueAtTime(85, now + duration);
      subGain.gain.setValueAtTime(1e-4, now);
      subGain.gain.linearRampToValueAtTime(0.4 * safeIntensity, now + 0.5);
      subGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(now);
      subOsc.stop(now + duration + 0.05);
      return true;
    }
    /**
     * 3. Intervention Hit (타이밍 개입 타격 & 글리치 크랙)
     * 수리 레일 분쇄: 3.4kHz 글리치 스냅 + 디퀀타이즈 버즈 + 85Hz 서브 킥 반발
     */
    static playInterventionHit(ctx, destination, {
      intensity = 0.85,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 2e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.85));
      const duration = 0.45;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.36 * safeIntensity, now);
      master.connect(destination);
      NoiseGenerator.scheduleBurst(ctx, master, {
        startAt: now,
        duration: 0.028,
        gain: 0.8 * safeIntensity,
        filterType: "bandpass",
        filterFrequency: 3400,
        filterQ: 5
      });
      const buzzOsc = ctx.createOscillator();
      const buzzGain = ctx.createGain();
      buzzOsc.type = "sawtooth";
      buzzOsc.frequency.setValueAtTime(720, now);
      buzzOsc.frequency.exponentialRampToValueAtTime(210, now + 0.04);
      buzzGain.gain.setValueAtTime(1e-4, now);
      buzzGain.gain.linearRampToValueAtTime(0.6 * safeIntensity, now + 2e-3);
      buzzGain.gain.exponentialRampToValueAtTime(1e-5, now + 0.08);
      buzzOsc.connect(buzzGain);
      buzzGain.connect(master);
      buzzOsc.start(now);
      buzzOsc.stop(now + 0.09);
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = "sine";
      kickOsc.frequency.setValueAtTime(85, now);
      kickOsc.frequency.exponentialRampToValueAtTime(42, now + 0.18);
      kickGain.gain.setValueAtTime(1e-4, now);
      kickGain.gain.linearRampToValueAtTime(0.7 * safeIntensity, now + 3e-3);
      kickGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      kickOsc.connect(kickGain);
      kickGain.connect(master);
      kickOsc.start(now);
      kickOsc.stop(now + duration + 0.02);
      return true;
    }
    /**
     * 4. Terminal Breach (최종 차원 돌파 & 센티넬 축출음)
     * 4회 타격 성공: 55Hz 초저역 충격파 + 4.2kHz 유리 파편 캐스케이드 + 1200Hz->80Hz 차원 역흡입
     */
    static playTerminalBreach(ctx, destination, {
      intensity = 0.9,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.4, Number(intensity) || 0.9));
      const duration = 1.8;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.38 * safeIntensity, now);
      master.connect(destination);
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(55, now);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.9);
      subGain.gain.setValueAtTime(1e-4, now);
      subGain.gain.linearRampToValueAtTime(0.85 * safeIntensity, now + 0.02);
      subGain.gain.exponentialRampToValueAtTime(1e-5, now + 1.4);
      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(now);
      subOsc.stop(now + 1.45);
      const shatterTimes = [0, 0.04, 0.09, 0.16, 0.25];
      shatterTimes.forEach((offset, idx) => {
        NoiseGenerator.scheduleBurst(ctx, master, {
          startAt: now + offset,
          duration: 0.035,
          gain: (0.75 - idx * 0.1) * safeIntensity,
          filterType: "bandpass",
          filterFrequency: 4200 + idx % 3 * 600,
          filterQ: 4.8
        });
      });
      const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
      const voidSrc = ctx.createBufferSource();
      voidSrc.buffer = noiseBuffer;
      const voidFilter = ctx.createBiquadFilter();
      voidFilter.type = "bandpass";
      voidFilter.frequency.setValueAtTime(1200, now);
      voidFilter.frequency.exponentialRampToValueAtTime(80, now + duration * 0.75);
      voidFilter.Q.setValueAtTime(6, now);
      const voidGain = ctx.createGain();
      voidGain.gain.setValueAtTime(1e-4, now);
      voidGain.gain.linearRampToValueAtTime(0.65 * safeIntensity, now + 0.15);
      voidGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      voidSrc.connect(voidFilter);
      voidFilter.connect(voidGain);
      voidGain.connect(master);
      voidSrc.start(now);
      voidSrc.stop(now + duration + 0.05);
      return true;
    }
    /**
     * 5. Failure Resync Seal (실패 강제 표백 봉합음)
     * 타이밍 실패: 840Hz 메탈릭 락킹 + 화이트아웃 시즐 감쇠 + 90Hz 에러 흡수
     */
    static playFailureSeal(ctx, destination, {
      intensity = 0.75,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
      const duration = 1.2;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.32 * safeIntensity, now);
      master.connect(destination);
      ModalResonanceBank.schedulePartial(ctx, master, {
        frequency: 840,
        startAt: now,
        duration: 0.35,
        gain: 0.6 * safeIntensity,
        type: "triangle"
      });
      ModalResonanceBank.schedulePartial(ctx, master, {
        frequency: 1680,
        startAt: now,
        duration: 0.22,
        gain: 0.4 * safeIntensity,
        type: "sine"
      });
      const noiseBuffer = NoiseGenerator.getWhiteNoiseBuffer(ctx, duration + 0.2);
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(2400, now);
      filter.frequency.exponentialRampToValueAtTime(6e3, now + duration * 0.6);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(1e-4, now);
      noiseGain.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(1e-5, now + duration);
      noiseSrc.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);
      noiseSrc.start(now);
      noiseSrc.stop(now + duration + 0.05);
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = "sine";
      thudOsc.frequency.setValueAtTime(90, now);
      thudOsc.frequency.exponentialRampToValueAtTime(38, now + 0.25);
      thudGain.gain.setValueAtTime(1e-4, now);
      thudGain.gain.linearRampToValueAtTime(0.5 * safeIntensity, now + 5e-3);
      thudGain.gain.exponentialRampToValueAtTime(1e-5, now + 0.4);
      thudOsc.connect(thudGain);
      thudGain.connect(master);
      thudOsc.start(now);
      thudOsc.stop(now + 0.45);
      return true;
    }
  };

  // scripts/dev/sound-lab/engine/synths/zen/ZenSingingBowlSynth.js
  var ZenSingingBowlSynth = class {
    static play(ctx, destination, {
      intensity = 0.7,
      basePitch = 330,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 0.01;
      const safeIntensity = Math.max(0.3, Math.min(1.2, Number(intensity) || 0.7));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.32 * safeIntensity, now);
      master.gain.exponentialRampToValueAtTime(1e-4, now + 2);
      master.connect(destination);
      ModalResonanceBank.schedulePartial(ctx, master, {
        frequency: basePitch,
        startAt: now,
        duration: 1.9,
        attack: 0.04,
        gain: 0.55 * safeIntensity,
        type: "sine"
      });
      ModalResonanceBank.schedulePartial(ctx, master, {
        frequency: basePitch + 2.5,
        startAt: now,
        duration: 1.8,
        attack: 0.05,
        gain: 0.35 * safeIntensity,
        type: "sine"
      });
      ModalResonanceBank.schedulePartial(ctx, master, {
        frequency: basePitch * 0.5,
        startAt: now,
        duration: 1.7,
        attack: 0.06,
        gain: 0.2 * safeIntensity,
        type: "triangle"
      });
      return true;
    }
  };

  // scripts/dev/sound-lab/engine/synths/entropy/TerminalDataPulseSynth.js
  var TerminalDataPulseSynth = class {
    static play(ctx, destination, {
      intensity = 0.8,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.8));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.35 * safeIntensity, now);
      master.gain.exponentialRampToValueAtTime(1e-4, now + 0.24);
      master.connect(destination);
      TransientChirp.schedule(ctx, master, {
        startAt: now,
        startFreq: 1400,
        endFreq: 160,
        duration: 0.14,
        gain: 0.65 * safeIntensity,
        type: "sawtooth"
      });
      NoiseGenerator.scheduleBurst(ctx, master, {
        startAt: now,
        duration: 0.03,
        gain: 0.5 * safeIntensity,
        filterType: "bandpass",
        filterFrequency: 1800,
        filterQ: 2.5
      });
      const hum = ctx.createOscillator();
      hum.type = "sawtooth";
      hum.frequency.setValueAtTime(60, now);
      const humGain = ctx.createGain();
      humGain.gain.setValueAtTime(1e-4, now);
      humGain.gain.exponentialRampToValueAtTime(0.3 * safeIntensity, now + 0.01);
      hum.connect(humGain);
      humGain.connect(master);
      hum.start(now);
      hum.stop(now + 0.25);
      return true;
    }
  };

  // scripts/dev/sound-lab/engine/synths/entropy/IndustrialConsoleHumSynth.js
  var IndustrialConsoleHumSynth = class {
    static play(ctx, destination, {
      intensity = 0.7,
      duration = 2.5,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 5e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.7));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.25 * safeIntensity, now);
      master.gain.exponentialRampToValueAtTime(1e-4, now + duration);
      master.connect(destination);
      [50, 100, 150].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(1e-4, now);
        g.gain.exponentialRampToValueAtTime((0.3 - idx * 0.08) * safeIntensity, now + 0.08);
        g.gain.setValueAtTime((0.3 - idx * 0.08) * safeIntensity, now + duration - 0.1);
        g.gain.exponentialRampToValueAtTime(1e-4, now + duration);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + duration + 0.02);
      });
      NoiseGenerator.scheduleBurst(ctx, master, {
        startAt: now,
        duration,
        attack: 0.1,
        gain: 0.18 * safeIntensity,
        noiseType: "pink",
        filterType: "lowpass",
        filterFrequency: 450,
        filterQ: 1
      });
      return true;
    }
  };

  // scripts/dev/sound-lab/engine/synths/cyberpunk/NeonGlitchClickSynth.js
  var NeonGlitchClickSynth = class {
    static play(ctx, destination, {
      intensity = 0.8,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 2e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.8));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.35 * safeIntensity, now);
      master.gain.exponentialRampToValueAtTime(1e-4, now + 0.16);
      master.connect(destination);
      NoiseGenerator.scheduleBurst(ctx, master, {
        startAt: now,
        duration: 0.035,
        gain: 0.65 * safeIntensity,
        filterType: "highpass",
        filterFrequency: 3600,
        filterQ: 2
      });
      TransientChirp.schedule(ctx, master, {
        startAt: now,
        startFreq: 2600,
        endFreq: 380,
        duration: 0.1,
        gain: 0.45 * safeIntensity,
        type: "sine"
      });
      return true;
    }
  };

  // scripts/dev/sound-lab/engine/synths/matrix/DigitalRainCascadeSynth.js
  var DigitalRainCascadeSynth = class {
    static play(ctx, destination, {
      intensity = 0.7,
      startAt = null
    } = {}) {
      const now = startAt !== null ? startAt : ctx.currentTime + 3e-3;
      const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.7));
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.3 * safeIntensity, now);
      master.gain.exponentialRampToValueAtTime(1e-4, now + 0.35);
      master.connect(destination);
      [1760, 2640, 3520].forEach((freq, idx) => {
        ModalResonanceBank.schedulePartial(ctx, master, {
          frequency: freq,
          startAt: now + idx * 0.045,
          duration: 0.18,
          attack: 2e-3,
          gain: 0.4 * safeIntensity,
          type: "sine"
        });
      });
      return true;
    }
  };

  // scripts/dev/sound-lab/engine/synths/SynthRegistry.js
  var SynthRegistry = class {
    constructor() {
      this.registry = /* @__PURE__ */ new Map();
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
      this.register("zen.shishi_odoshi.clack", (ctx, dest, opts) => ShishiOdoshiClackSynth.play(ctx, dest, opts));
      this.register("zen.shishi_odoshi.water_loop", (ctx, dest, opts) => ShishiOdoshiWaterLoopSynth.play(ctx, dest, opts));
      this.register("zen.shishi_odoshi.overflow_loop", (ctx, dest, opts) => ShishiOdoshiWaterLoopSynth.playOverflow(ctx, dest, opts));
      this.register("ritual.site_furin.prelude_chime", (ctx, dest, opts) => ZenFurinGlassClinkSynth.play(ctx, dest, { ...opts, protocolScope: "site" }));
      this.register("ritual.global_sentinel.koi_accept", (ctx, dest, opts) => ZenFurinGlassClinkSynth.play(ctx, dest, { ...opts, protocolScope: "global" }));
      this.register("ritual.site_furin.settle_complete", (ctx, dest, opts) => ZenSingingBowlSynth.play(ctx, dest, opts));
      this.register("ritual.site_furin.koi_wake_surface", (ctx, dest, opts) => ZenKoiHydroAcousticsSynth.playWakeSurface(ctx, dest, opts));
      this.register("ritual.site_furin.koi_glide_loop", (ctx, dest, opts) => ZenKoiHydroAcousticsSynth.playGlideLoop(ctx, dest, opts));
      this.register("ritual.site_furin.koi_rendezvous", (ctx, dest, opts) => ZenKoiHydroAcousticsSynth.playRendezvous(ctx, dest, opts));
      this.register("ritual.site_furin.koi_descent_dive", (ctx, dest, opts) => ZenKoiHydroAcousticsSynth.playDescentDive(ctx, dest, opts));
      this.register("ritual.site_furin.water_settle_calm", (ctx, dest, opts) => ZenKoiHydroAcousticsSynth.playWaterSettle(ctx, dest, opts));
      this.register("room478.breath.inhale_swell", (ctx, dest, opts) => ZenRoom478BreathingSynth.playInhaleSwell(ctx, dest, opts));
      this.register("room478.breath.hold_drone", (ctx, dest, opts) => ZenRoom478BreathingSynth.playHoldDrone(ctx, dest, opts));
      this.register("room478.breath.exhale_release", (ctx, dest, opts) => ZenRoom478BreathingSynth.playExhaleRelease(ctx, dest, opts));
      this.register("room478.bell.phase_chime", (ctx, dest, opts) => ZenRoom478BreathingSynth.playPhaseChime(ctx, dest, opts));
      this.register("room478.grounding.charge", (ctx, dest, opts) => ZenRoom478BreathingSynth.playGroundingCharge(ctx, dest, opts));
      this.register("ritual.global_sentinel.simulation_rupture", (ctx, dest, opts) => ZenGlobalSentinelRiftSynth.playSimulationRupture(ctx, dest, opts));
      this.register("ritual.global_sentinel.repair_telegraph", (ctx, dest, opts) => ZenGlobalSentinelRiftSynth.playRepairTelegraph(ctx, dest, opts));
      this.register("ritual.global_sentinel.intervention_hit", (ctx, dest, opts) => ZenGlobalSentinelRiftSynth.playInterventionHit(ctx, dest, opts));
      this.register("ritual.global_sentinel.terminal_breach", (ctx, dest, opts) => ZenGlobalSentinelRiftSynth.playTerminalBreach(ctx, dest, opts));
      this.register("ritual.global_sentinel.failure_seal", (ctx, dest, opts) => ZenGlobalSentinelRiftSynth.playFailureSeal(ctx, dest, opts));
      this.register("ritual.site_furin.soundscape", (ctx, dest, opts = {}) => {
        const now = ctx.currentTime + 5e-3;
        const intensity = opts.intensity || 0.7;
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.25 * intensity, now);
        master.gain.exponentialRampToValueAtTime(1e-4, now + 2.5);
        master.connect(dest);
        [293.66, 369.99, 440, 493.88].forEach((freq, idx) => {
          ModalResonanceBank.schedulePartial(ctx, master, {
            frequency: freq,
            startAt: now + idx * 0.05,
            duration: 2.2,
            attack: 0.15,
            gain: 0.25 * intensity,
            type: "sine"
          });
        });
        return true;
      });
      this.register("ritual.site_furin.underwater_loop", (ctx, dest, opts = {}) => {
        const now = ctx.currentTime + 5e-3;
        const intensity = opts.intensity || 0.7;
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.3 * intensity, now);
        master.gain.exponentialRampToValueAtTime(1e-4, now + 2);
        master.connect(dest);
        const sub = ctx.createOscillator();
        sub.type = "triangle";
        sub.frequency.setValueAtTime(75, now);
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(1e-4, now);
        sg.gain.exponentialRampToValueAtTime(0.4 * intensity, now + 0.1);
        sg.gain.exponentialRampToValueAtTime(1e-4, now + 2);
        sub.connect(sg);
        sg.connect(master);
        sub.start(now);
        sub.stop(now + 2.05);
        return true;
      });
      this.register("entropy.data_overflow.pulse", (ctx, dest, opts) => TerminalDataPulseSynth.play(ctx, dest, opts));
      this.register("entropy.console.idle_drone", (ctx, dest, opts) => IndustrialConsoleHumSynth.play(ctx, dest, opts));
      this.register("cyberpunk.neon.glitch_click", (ctx, dest, opts) => NeonGlitchClickSynth.play(ctx, dest, opts));
      this.register("matrix.digital_rain.chime", (ctx, dest, opts) => DigitalRainCascadeSynth.play(ctx, dest, opts));
    }
  };
  var defaultSynthRegistry = null;
  function getDefaultSynthRegistry() {
    if (!defaultSynthRegistry) {
      defaultSynthRegistry = new SynthRegistry();
    }
    return defaultSynthRegistry;
  }

  // scripts/dev/sound-lab/workspace/soundBriefs.js
  var SOUND_BRIEFS = Object.freeze({
    "ritual.site_furin.submerge_in": ["\uC218\uBA74 \uC544\uB798\uB85C \uC9C4\uC785", "\uD48D\uACBD \uC758\uC2DD\uC758 \uC218\uC911 \uACF5\uAC04\uC73C\uB85C \uB4E4\uC5B4\uAC00\uB294 \uC804\uD658", "\uAE4A\uC774\uC758 \uBCC0\uD654\uC640 \uC7A5\uBA74\uC758 \uACBD\uACC4\uB97C \uBB3C\uC758 \uC9C8\uAC10\uC73C\uB85C \uC54C\uB9B0\uB2E4.", "\uC9C4\uC785\uC774 \uC790\uC5F0\uC2A4\uB7FD\uB098\uC694, \uAC11\uC790\uAE30 \uADC0\uAC00 \uBA39\uBA39\uD574\uC9C0\uB294 \uB290\uB08C\uC778\uAC00\uC694?"],
    "ritual.site_furin.koi_accept": ["\uC789\uC5B4\uC758 \uC218\uB77D \uC2E0\uD638", "\uC0AC\uC774\uD2B8 \uD48D\uACBD\uC5D0\uC11C \uC789\uC5B4 \uC0C1\uD638\uC791\uC6A9\uC774 \uBC1B\uC544\uB4E4\uC5EC\uC9C8 \uB54C", "\uC0AC\uC6A9\uC790\uC758 \uD589\uB3D9\uC5D0 \uC791\uACE0 \uB9D1\uC740 \uD655\uC778\uC744 \uC900\uB2E4.", "\uCCAB \uD48D\uACBD \uC6B8\uB9BC\uACFC \uAD6C\uBD84\uD560 \uD544\uC694\uAC00 \uC788\uC744\uAE4C\uC694?"],
    "ritual.site_furin.surface_out": ["\uC218\uBA74 \uC704\uB85C \uB3CC\uC544\uC624\uAE30", "\uD48D\uACBD \uC758\uC2DD\uC5D0\uC11C \uC77C\uC0C1\uC73C\uB85C \uB3CC\uC544\uAC00\uB294 \uC804\uD658", "\uB2EB\uD78C \uC218\uC911 \uACF5\uAC04\uC774 \uC5F4\uB9AC\uB294 \uB290\uB08C\uC73C\uB85C \uC804\uD658\uC744 \uC815\uB9AC\uD55C\uB2E4.", "\uC2DC\uAC01\uC801 \uBCF5\uADC0\uBCF4\uB2E4 \uC18C\uB9AC\uAC00 \uBA3C\uC800 \uB05D\uB098\uAC70\uB098 \uB4A4\uCC98\uC9C0\uC9C0 \uC54A\uB098\uC694?"],
    "ritual.site_furin.settle_complete": ["\uD48D\uACBD \uC758\uC2DD\uC758 \uB9C8\uCE68\uD45C", "\uD48D\uACBD \uC758\uC2DD\uC758 \uC131\uCC30\uACFC \uC644\uB8CC", "\uB05D\uB0AC\uB2E4\uB294 \uD655\uC2E0\uACFC \uC9E7\uC740 \uC5EC\uC6B4\uC744 \uB0A8\uAE34\uB2E4.", "\uC77C\uBCF8\uC2DD \uD48D\uACBD \uC758\uC2DD\uC5D0 \uB9DE\uB294 \uB9C8\uBB34\uB9AC\uC778\uAC00\uC694? \uAE30\uC874 \uBCF4\uC6B8 \uC2DC\uC548\uB3C4 \uBE44\uAD50\uD574 \uBCF4\uC138\uC694."],
    "ritual.global_sentinel.koi_accept": ["\uAE00\uB85C\uBC8C \uC789\uC5B4\uC758 \uC218\uB77D \uC2E0\uD638", "\uAE00\uB85C\uBC8C \uC13C\uD2F0\uB12C\uC758 \uC789\uC5B4 \uC0C1\uD638\uC791\uC6A9\uC774 \uBC1B\uC544\uB4E4\uC5EC\uC9C8 \uB54C", "\uAE00\uB85C\uBC8C \uC758\uC2DD \uC548\uC5D0\uC11C \uC785\uB825\uC774 \uC804\uB2EC\uB410\uC74C\uC744 \uC54C\uB9B0\uB2E4.", "\uAE00\uB85C\uBC8C \uC7A5\uBA74\uC758 \uB2E4\uB978 \uC2E0\uD638\uB4E4\uACFC \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC774\uC5B4\uC9C0\uB098\uC694?"],
    "ritual.site_furin.soundscape": ["\uD48D\uACBD \uC758\uC2DD\uC758 \uACF5\uAC04", "\uD48D\uACBD \uC758\uC2DD \uC804\uBC18\uC744 \uAC10\uC2F8\uB294 \uBC30\uACBD\uC74C", "\uC0C1\uD638\uC791\uC6A9\uC744 \uAC00\uB9AC\uC9C0 \uC54A\uC73C\uBA70 \uBA38\uBB34\uB97C \uACF5\uAC04\uC744 \uB9CC\uB4E0\uB2E4.", "\uBC30\uACBD\uC74C\uC774 \uD544\uC694\uD55C\uAC00\uC694? \uC804\uACBD \uD6A8\uACFC\uC74C\uC744 \uCDA9\uBD84\uD788 \uBE44\uC6CC \uC8FC\uB098\uC694?"],
    "ritual.site_furin.underwater_loop": ["\uC218\uBA74 \uC544\uB798\uC758 \uACE0\uC694", "\uD48D\uACBD \uC758\uC2DD\uC758 \uC218\uC911 \uCCB4\uB958 \uAD6C\uAC04", "\uAE4A\uC774\uC640 \uACE0\uC694\uD568\uC744 \uC5F0\uC18D\uC801\uC778 \uC9C8\uAC10\uC73C\uB85C \uC720\uC9C0\uD55C\uB2E4.", "\uBC18\uBCF5 \uACBD\uACC4\uB098 \uC800\uC74C\uC758 \uC555\uBC15\uAC10\uC774 \uC2E0\uACBD \uC4F0\uC774\uC9C0 \uC54A\uB098\uC694?"],
    "zen.shishi_odoshi.clack": ["\uB300\uB098\uBB34\uAC00 \uB2FF\uB294 \uC21C\uAC04", "\uC2DC\uC2DC\uC624\uB3C4\uC2DC\uAC00 \uBB3C\uC744 \uBE44\uC6B0\uACE0 \uB3CC\uBC1B\uCE68\uC5D0 \uB2FF\uC744 \uB54C", "\uBA48\uCDA4\uACFC \uC120\uD0DD\uC758 \uACBD\uACC4\uB97C \uC9E7\uACE0 \uBD84\uBA85\uD558\uAC8C \uC804\uB2EC\uD55C\uB2E4.", "\uB2E8\uB2E8\uD55C \uB9C8\uCE68\uD45C\uCC98\uB7FC \uB4E4\uB9AC\uB098\uC694, \uB180\uB77C\uAC8C \uD558\uB294 \uD0C0\uACA9\uCC98\uB7FC \uB4E4\uB9AC\uB098\uC694?"],
    "zen.shishi_odoshi.water_loop": ["\uC120\uD0DD\uC744 \uAE30\uB2E4\uB9AC\uB294 \uBB3C", "\uC2DC\uC2DC\uC624\uB3C4\uC2DC\uC5D0 \uBB3C\uC774 \uCC28\uB294 \uB3D9\uC548", "\uAE30\uB2E4\uB9BC\uC744 \uB290\uB07C\uAC8C \uD558\uBA74\uC11C \uD310\uB2E8\uD560 \uC5EC\uBC31\uC744 \uB0A8\uAE34\uB2E4.", "\uBC18\uBCF5\uD574\uC11C \uB4E4\uC5B4\uB3C4 \uC870\uAE09\uD558\uAC70\uB098 \uD53C\uACE4\uD558\uC9C0 \uC54A\uB098\uC694?"],
    "zen.shishi_odoshi.overflow_loop": ["\uBB3C\uC774 \uB118\uCE58\uB294 \uC21C\uAC04", "\uC2DC\uC2DC\uC624\uB3C4\uC2DC\uC758 \uBB3C\uC774 \uB118\uCE58\uB294 \uAD6C\uAC04", "\uC0C1\uD0DC \uBCC0\uD654\uB97C \uBB3C\uC758 \uBC00\uB3C4\uC640 \uC6C0\uC9C1\uC784\uC73C\uB85C \uC54C\uB9B0\uB2E4.", "\uC77C\uBC18 \uBB3C\uC904\uAE30\uC640 \uAD6C\uBD84\uB418\uBA74\uC11C\uB3C4 \uACFC\uD558\uAC8C \uC7AC\uCD09\uD558\uC9C0 \uC54A\uB098\uC694?"],
    "ritual.site_furin.prelude_chime": ["\uD48D\uACBD\uC758 \uCCAB \uC6B8\uB9BC", "\uC0AC\uC774\uD2B8 \uD48D\uACBD \uC758\uC2DD\uC744 \uC2DC\uC791\uD558\uB294 \uC81C\uC2A4\uCC98", "\uC8FC\uC758\uB97C \uBD80\uB4DC\uB7FD\uAC8C \uB3CC\uB9AC\uACE0 \uB2E4\uB978 \uACF5\uAC04\uC73C\uB85C\uC758 \uC9C4\uC785\uC744 \uC54C\uB9B0\uB2E4.", "\uB9D1\uC740 \uC720\uB9AC \uC6B8\uB9BC\uACFC \uB0A0\uCE74\uB85C\uC6B4 \uC54C\uB9BC\uC74C \uC911 \uC5B4\uB514\uC5D0 \uAC00\uAE5D\uB098\uC694?"],
    "ritual.site_furin.koi_wake_surface": ["\uC789\uC5B4\uAC00 \uC218\uBA74\uC73C\uB85C", "\uC789\uC5B4\uAC00 \uC218\uBA74\uC5D0 \uBAA8\uC2B5\uC744 \uB4DC\uB7EC\uB0B4\uB294 \uC21C\uAC04", "\uC791\uC740 \uC0DD\uBA85\uCCB4\uC758 \uB4F1\uC7A5\uC744 \uBB3C\uC758 \uC6C0\uC9C1\uC784\uC73C\uB85C \uB290\uB07C\uAC8C \uD55C\uB2E4.", "\uB4F1\uC7A5 \uB3D9\uC791\uACFC \uBB3C\uBC29\uC6B8\uC758 \uD06C\uAE30\uAC00 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB9DE\uB098\uC694?"],
    "ritual.site_furin.koi_glide_loop": ["\uC789\uC5B4\uB97C \uB530\uB77C\uAC00\uB294 \uBB3C\uACB0", "\uC789\uC5B4\uAC00 \uC218\uBA74\uC744 \uC720\uC601\uD558\uB294 \uB3D9\uC548", "\uC2DC\uAC01\uC801 \uC6C0\uC9C1\uC784\uC5D0 \uC794\uC794\uD55C \uC5F0\uC18D\uC131\uC744 \uC900\uB2E4.", "\uD654\uBA74\uC5D0 \uC9D1\uC911\uD558\uB294 \uB3D9\uC548 \uBC30\uACBD\uC73C\uB85C \uD3B8\uC548\uD558\uAC8C \uB0A8\uB098\uC694?"],
    "ritual.site_furin.koi_rendezvous": ["\uC789\uC5B4\uC640 \uB9CC\uB098\uB294 \uC21C\uAC04", "\uC789\uC5B4\uAC00 \uC0AC\uC6A9\uC790\uC640 \uB9CC\uB098\uB294 \uC0C1\uD638\uC791\uC6A9", "\uC811\uCD09\uC744 \uB530\uB73B\uD558\uACE0 \uC791\uC740 \uBC18\uC751\uC73C\uB85C \uD655\uC778\uD55C\uB2E4.", "\uBCF4\uC0C1 \uD6A8\uACFC\uC74C\uCC98\uB7FC \uACFC\uC7A5\uB418\uC9C0 \uC54A\uACE0 \uAD50\uAC10\uCC98\uB7FC \uB290\uAEF4\uC9C0\uB098\uC694?"],
    "ritual.site_furin.koi_descent_dive": ["\uC789\uC5B4\uAC00 \uC7A0\uC218\uD560 \uB54C", "\uC789\uC5B4\uAC00 \uC218\uBA74 \uC544\uB798\uB85C \uB0B4\uB824\uAC00\uB294 \uC804\uD658", "\uAE4A\uC774\uC640 \uBC29\uD5A5\uC744 \uC9E7\uC740 \uC218\uC911 \uC9C8\uAC10\uC73C\uB85C \uC804\uB2EC\uD55C\uB2E4.", "\uC18C\uB9AC\uAC00 \uD654\uBA74\uBCF4\uB2E4 \uC624\uB798 \uB0A8\uAC70\uB098 \uC9C0\uB098\uCE58\uAC8C \uBB34\uAC81\uC9C0 \uC54A\uB098\uC694?"],
    "ritual.site_furin.water_settle_calm": ["\uBB3C\uACB0\uC774 \uAC00\uB77C\uC549\uC744 \uB54C", "\uC218\uBA74\uC758 \uC6C0\uC9C1\uC784\uC774 \uC7A6\uC544\uB4DC\uB294 \uB9C8\uBB34\uB9AC", "\uC0C1\uD638\uC791\uC6A9\uC774 \uB05D\uB0AC\uC74C\uC744 \uC870\uC6A9\uD788 \uC815\uB9AC\uD55C\uB2E4.", "\uB2E4\uC74C \uD589\uB3D9\uC744 \uBC29\uD574\uD558\uC9C0 \uC54A\uACE0 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC0AC\uB77C\uC9C0\uB098\uC694?"],
    "room478.breath.inhale_swell": ["\uC6B0\uC8FC\uC801 \uB4E4\uC774\uC26C\uAE30", "4-7-8 \uD638\uD761\uC758 108Hz \uB4E4\uC228 \uAD6C\uAC04", "\uC6B0\uC8FC \uACF5\uAC04\uC5D0\uC11C \uB9D1\uC740 \uACF5\uAE30\uAC00 \uCC28\uC624\uB974\uB294 \uD654\uC74C\uC73C\uB85C \uD638\uD761\uC744 \uB290\uB9AC\uAC8C \uC548\uB0B4\uD55C\uB2E4.", "\uD638\uD761\uC744 \uAC15\uC694\uD558\uC9C0 \uC54A\uACE0 \uD3B8\uD558\uAC8C \uB530\uB77C\uAC08 \uC218 \uC788\uB098\uC694?"],
    "room478.breath.hold_drone": ["\uBB34\uC911\uB825 \uBA38\uBB34\uB974\uAE30", "4-7-8 \uD638\uD761\uC758 216Hz \uBA48\uCDA4 \uAD6C\uAC04", "1.2Hz \uB9E5\uB180\uC774\uC640 \uC11C\uBE0C \uC575\uCEE4\uB85C \uBB34\uC911\uB825\uC758 \uC815\uC801\uACFC \uC548\uC815\uB41C \uC2DC\uAC04\uC744 \uC720\uC9C0\uD55C\uB2E4.", "\uBA48\uCDA4\uC774 \uAE34\uC7A5\uC774\uB098 \uBD88\uC548\uC73C\uB85C \uB4E4\uB9AC\uC9C0 \uC54A\uB098\uC694?"],
    "room478.breath.exhale_release": ["\uC9C4\uACF5 \uB0B4\uC26C\uAE30", "4-7-8 \uD638\uD761\uC758 \uB0A0\uC228 \uAD6C\uAC04", "\uAE34\uC7A5\uC774 \uC6B0\uC8FC \uC9C4\uACF5\uC73C\uB85C \uD480\uB824\uB098\uAC00\uB294 \uBC29\uD5A5\uC744 \uC11C\uBE0C\uBCA0\uC774\uC2A4\uB85C \uC548\uB0B4\uD55C\uB2E4.", "\uCDA9\uBD84\uD788 \uB290\uB9AC\uACE0 \uBD80\uB4DC\uB7FD\uAC8C \uD480\uB9AC\uB098\uC694?"],
    "room478.bell.phase_chime": ["\uC2EC\uC6D0\uD55C \uB300\uC885 \uD0C0\uC885", "\uD638\uD761\uC2E4 \uC811\uC9C0 \uC644\uB8CC \uBC0F \uACE0\uC694 \uC9C4\uC785", "\uD48D\uACBD\uC18C\uB9AC\uAC00 \uC544\uB2CC 108Hz \uCCAD\uB3D9 \uB300\uC885\uC758 \uBB35\uC9C1\uD55C \uC6B8\uB9BC\uACFC \uC5EC\uC6B4\uC73C\uB85C \uC804\uD658\uC744 \uC54C\uB9B0\uB2E4.", "\uAC00\uC2B4 \uAE4A\uC774 \uC6B8\uB9AC\uB294 \uBB35\uC9C1\uD55C \uB300\uC885\uC758 \uC5EC\uC6B4\uC778\uAC00\uC694?"],
    "room478.grounding.charge": ["\uAC10\uC555 \uC811\uC9C0 \uCDA9\uC804", "\uC2A4\uD398\uC774\uC2A4\uBC14\uB97C \uAE38\uAC8C \uB204\uB974\uB294 1.8\uCD08 \uAC10\uC555 \uAD6C\uAC04", "72Hz\uC5D0\uC11C 108Hz\uB85C \uCC28\uBD84\uD558\uAC8C \uC911\uC2EC\uC744 \uBAA8\uC73C\uB294 \uC800\uC8FC\uD30C \uACF5\uBA85\uACFC \uB300\uAE30 \uC555\uCD95\uAC10.", "\uC190\uC744 \uB300\uACE0 \uC788\uB294 \uB3D9\uC548 \uC2EC\uC2E0\uC774 \uCC28\uBD84\uD574\uC9C0\uB098\uC694?"],
    "ritual.global_sentinel.simulation_rupture": ["\uADE0\uC5F4\uC774 \uC5F4\uB9B4 \uB54C", "\uAE00\uB85C\uBC8C \uC13C\uD2F0\uB12C\uC758 \uADE0\uC5F4 \uB4F1\uC7A5", "\uC7A5\uBA74\uC758 \uB2E8\uC808\uACFC \uAC1C\uC785 \uC2DC\uC791\uC744 \uC804\uB2EC\uD55C\uB2E4.", "\uD604\uC7AC \uC7A5\uBA74\uC758 \uAC15\uB3C4\uC5D0 \uB9DE\uB098\uC694? Zen\uC758 \uC774\uC9C8\uC801 \uBAA8\uD2F0\uD504\uB85C \uC720\uC9C0\uD560 \uC774\uC720\uAC00 \uC788\uB098\uC694?"],
    "ritual.global_sentinel.repair_telegraph": ["\uC13C\uD2F0\uB12C\uC774 \uB2E4\uAC00\uC62C \uB54C", "\uC13C\uD2F0\uB12C\uC758 \uC218\uB9AC \uC811\uADFC \uC608\uACE0", "\uB2E4\uAC00\uC624\uB294 \uD0C0\uC774\uBC0D\uC744 \uAE34\uC7A5\uAC10\uC73C\uB85C \uC77D\uAC8C \uD55C\uB2E4.", "\uC608\uACE0\uC640 \uC2E4\uC81C \uD0C0\uACA9\uC774 \uC18C\uB9AC\uB9CC\uC73C\uB85C \uAD6C\uBD84\uB418\uB098\uC694?"],
    "ritual.global_sentinel.intervention_hit": ["\uD0C0\uC774\uBC0D\uC744 \uB9DE\uCDC4\uC744 \uB54C", "\uD0C0\uC774\uBC0D \uAC1C\uC785\uC5D0 \uC131\uACF5\uD55C \uD0C0\uACA9", "\uC785\uB825\uC774 \uBC1B\uC544\uB4E4\uC5EC\uC9C4 \uC21C\uAC04\uC744 \uC989\uC2DC \uD655\uC778\uD55C\uB2E4.", "\uC5EC\uB7EC \uBC88 \uBC18\uBCF5\uD574\uB3C4 \uADC0\uC5D0 \uBD80\uB2F4\uC774 \uC5C6\uB098\uC694?"],
    "ritual.global_sentinel.terminal_breach": ["\uB9C8\uC9C0\uB9C9 \uB3CC\uD30C", "\uB9C8\uC9C0\uB9C9 \uAC1C\uC785\uC5D0 \uC131\uACF5\uD55C \uB9C8\uBB34\uB9AC", "\uC911\uAC04 \uD0C0\uACA9\uBCF4\uB2E4 \uBD84\uBA85\uD55C \uC885\uACB0\uAC10\uC744 \uC900\uB2E4.", "\uC131\uACF5\uC744 \uC54C\uB824 \uC8FC\uB294 \uB370 \uBE44\uD574 \uB108\uBB34 \uD06C\uAC70\uB098 \uAE38\uC9C0 \uC54A\uB098\uC694?"],
    "ritual.global_sentinel.failure_seal": ["\uADE0\uC5F4\uC774 \uB2EB\uD790 \uB54C", "\uAC1C\uC785 \uC2E4\uD328 \uD6C4 \uC7A5\uBA74\uC774 \uBD09\uD569\uB418\uB294 \uC21C\uAC04", "\uC885\uB8CC\uB97C \uBA85\uD655\uD558\uAC8C \uC804\uB2EC\uD55C\uB2E4.", "\uC2E4\uD328\uB97C \uACFC\uB3C4\uD558\uAC8C \uBC8C\uC8FC\uB294 \uB290\uB08C\uC740 \uC5C6\uB098\uC694?"],
    "zen.app.switch_toggle": ["\uC124\uC815\uC744 \uCF1C\uACE0 \uB04C \uB54C", "\uC124\uC815 \uD1A0\uAE00\uC758 \uC0C1\uD0DC \uBCC0\uACBD \uD6C4\uBCF4", "\uC791\uC740 \uCD09\uAC01\uC801 \uD655\uC778\uC744 \uC81C\uC548\uD55C\uB2E4.", "\uC774 \uB3D9\uC791\uC5D0 \uC18C\uB9AC\uAC00 \uAF2D \uD544\uC694\uD55C\uAC00\uC694? \uBB34\uC74C\uC774 \uB354 \uB0AB\uC9C0\uB294 \uC54A\uB098\uC694?"],
    "zen.app.tab_navigation": ["\uD654\uBA74\uC744 \uC62E\uAE38 \uB54C", "\uB300\uC2DC\uBCF4\uB4DC \uD0ED \uC774\uB3D9 \uD6C4\uBCF4", "\uD398\uC774\uC9C0 \uC804\uD658\uC5D0 \uC870\uC6A9\uD55C \uC885\uC774 \uC9C8\uAC10\uC744 \uC81C\uC548\uD55C\uB2E4.", "\uD0ED\uC744 \uC790\uC8FC \uC62E\uACA8\uB3C4 \uAC70\uC2AC\uB9AC\uC9C0 \uC54A\uC744\uAE4C\uC694?"],
    "entropy.data_overflow.pulse": ["\uB370\uC774\uD130\uAC00 \uB118\uCE58\uB294 \uC21C\uAC04", "Entropy \uCF58\uC194\uC758 \uB370\uC774\uD130 \uAC1C\uC785 \uD6C4\uBCF4", "\uC0B0\uC5C5\uC6A9 \uCF58\uC194\uC758 \uBC00\uB3C4\uC640 \uC555\uB825\uC744 \uC804\uB2EC\uD55C\uB2E4.", "\uC9E7\uC740 \uC2E0\uD638\uB85C \uCDA9\uBD84\uD788 \uC758\uBBF8\uB97C \uC804\uB2EC\uD558\uB098\uC694?"],
    "entropy.console.idle_drone": ["\uCF58\uC194\uC758 \uB300\uAE30\uC74C", "Entropy \uCF58\uC194\uC758 \uBC30\uACBD\uC74C \uD6C4\uBCF4", "\uC0B0\uC5C5 \uACF5\uAC04\uC758 \uC874\uC7AC\uAC10\uC744 \uB0AE\uC740 \uB808\uBCA8\uB85C \uC720\uC9C0\uD55C\uB2E4.", "\uC624\uB798 \uBA38\uBB34\uB97C \uB54C\uB3C4 \uD53C\uB85C\uD558\uC9C0 \uC54A\uC744\uAE4C\uC694?"],
    "cyberpunk.neon.glitch_click": ["\uB124\uC628 \uC778\uD130\uB799\uC158", "Cyberpunk UI \uC0C1\uD638\uC791\uC6A9 \uD6C4\uBCF4", "\uD569\uC131\uC801\uC774\uACE0 \uC804\uAE30\uC801\uC778 \uBC18\uC751\uC744 \uC9E7\uAC8C \uC804\uB2EC\uD55C\uB2E4.", "\uBC29\uC804\uC758 \uC9C8\uAC10\uACFC \uD074\uB9AD\uC758 \uBA85\uB8CC\uD568\uC774 \uD568\uAED8 \uB290\uAEF4\uC9C0\uB098\uC694?"],
    "matrix.digital_rain.chime": ["\uAE00\uB9AC\uD504\uAC00 \uB5A8\uC5B4\uC9C8 \uB54C", "Matrix \uB514\uC9C0\uD138 \uB808\uC778 \uBC18\uC751 \uD6C4\uBCF4", "\uC791\uC740 \uB370\uC774\uD130 \uC785\uC790\uC758 \uC6C0\uC9C1\uC784\uC744 \uC18C\uB9AC\uB85C \uC5F0\uACB0\uD55C\uB2E4.", "\uC5EC\uB7EC \uBC88 \uC6B8\uB824\uB3C4 \uACE0\uC74C\uC774 \uACB9\uCCD0 \uD53C\uACE4\uD558\uC9C0 \uC54A\uB098\uC694?"]
  });

  // scripts/dev/sound-lab/workspace/soundCandidates.js
  var existing = [
    ["zen.shishi_odoshi.clack", "zen/ShishiOdoshiClackSynth.js", 468],
    ["zen.shishi_odoshi.water_loop", "zen/ShishiOdoshiWaterLoopSynth.js", null],
    ["zen.shishi_odoshi.overflow_loop", "zen/ShishiOdoshiWaterLoopSynth.js", null],
    ["ritual.site_furin.prelude_chime", "zen/ZenFurinGlassClinkSynth.js", 3136],
    ["ritual.global_sentinel.koi_accept", "zen/ZenFurinGlassClinkSynth.js", 3136],
    ["ritual.site_furin.settle_complete", "zen/ZenSingingBowlSynth.js", 330],
    ["ritual.site_furin.soundscape", "SynthRegistry.js", null],
    ["ritual.site_furin.underwater_loop", "SynthRegistry.js", null],
    ["ritual.site_furin.koi_wake_surface", "zen/ZenKoiHydroAcousticsSynth.js", 520],
    ["ritual.site_furin.koi_glide_loop", "zen/ZenKoiHydroAcousticsSynth.js", 420],
    ["ritual.site_furin.koi_rendezvous", "zen/ZenKoiHydroAcousticsSynth.js", 640],
    ["ritual.site_furin.koi_descent_dive", "zen/ZenKoiHydroAcousticsSynth.js", 280],
    ["ritual.site_furin.water_settle_calm", "zen/ZenKoiHydroAcousticsSynth.js", 360],
    ["room478.breath.inhale_swell", "zen/ZenRoom478BreathingSynth.js", 108],
    ["room478.breath.hold_drone", "zen/ZenRoom478BreathingSynth.js", 216],
    ["room478.breath.exhale_release", "zen/ZenRoom478BreathingSynth.js", 108],
    ["room478.bell.phase_chime", "zen/ZenRoom478BreathingSynth.js", 108],
    ["room478.grounding.charge", "zen/ZenRoom478BreathingSynth.js", 108],
    ["ritual.global_sentinel.simulation_rupture", "zen/ZenGlobalSentinelRiftSynth.js", 3800],
    ["ritual.global_sentinel.repair_telegraph", "zen/ZenGlobalSentinelRiftSynth.js", 240],
    ["ritual.global_sentinel.intervention_hit", "zen/ZenGlobalSentinelRiftSynth.js", 3400],
    ["ritual.global_sentinel.terminal_breach", "zen/ZenGlobalSentinelRiftSynth.js", 55],
    ["ritual.global_sentinel.failure_seal", "zen/ZenGlobalSentinelRiftSynth.js", 840],
    ["entropy.data_overflow.pulse", "entropy/TerminalDataPulseSynth.js", null],
    ["entropy.console.idle_drone", "entropy/IndustrialConsoleHumSynth.js", null],
    ["cyberpunk.neon.glitch_click", "cyberpunk/NeonGlitchClickSynth.js", null],
    ["matrix.digital_rain.chime", "matrix/DigitalRainCascadeSynth.js", null]
  ];
  var SOUND_CANDIDATES = Object.freeze(existing.map(([targetId, source, basePitch]) => ({
    id: `${targetId}:lab-v1`,
    targetId,
    synthId: targetId,
    version: "lab-v1",
    name: "\uAE30\uC874 \uC5F0\uAD6C \uC2DC\uC548",
    rationale: "\uAE30\uC874 \uC5F0\uAD6C\uC18C\uC758 \uD569\uC131 \uC791\uC5C5\uBB3C\uC744 \uBE44\uAD50\uC640 \uD53C\uB4DC\uBC31\uC744 \uC704\uD55C \uCCAB \uAE30\uC900\uC73C\uB85C \uB4F1\uB85D\uD588\uC2B5\uB2C8\uB2E4.",
    changeNote: "\uAE30\uC874 \uC18C\uB9AC \uBCF4\uC874 \xB7 \uC0C8 \uD569\uC131 \uB610\uB294 \uC81C\uD488\uACFC\uC758 \uB3D9\uC77C\uC131 \uAC80\uC99D\uC744 \uC758\uBBF8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
    sourcePath: `scripts/dev/sound-lab/engine/synths/${source}`,
    parameters: basePitch === null ? { intensity: 0.75 } : { intensity: 0.75, basePitch }
  })));

  // scripts/dev/sound-lab/workspace/soundWorkspace.js
  var REVIEW_DECISIONS = Object.freeze({
    discuss: "\uBC29\uD5A5 \uB17C\uC758",
    revise: "\uC218\uC815 \uC694\uCCAD",
    prefer: "\uC774 \uC2DC\uC548 \uC120\uD638",
    hold: "\uBCF4\uB958",
    silence: "\uBB34\uC74C \uC81C\uC548"
  });
  var REVIEW_TAGS = Object.freeze(["\uB108\uBB34 \uB0A0\uCE74\uB85C\uC6C0", "\uB354 \uBD80\uB4DC\uB7FD\uAC8C", "\uB354 \uC9E7\uAC8C", "\uC874\uC7AC\uAC10 \uBD80\uC871", "\uBC18\uBCF5 \uC2DC \uD53C\uB85C\uD568", "\uC7A5\uBA74\uACFC \uC798 \uB9DE\uC74C"]);
  function createSoundWorkspace() {
    const registry = getDefaultSynthRegistry();
    const scan = scanSoundCatalog();
    const ids = /* @__PURE__ */ new Set();
    for (const candidate of SOUND_CANDIDATES) {
      if (ids.has(candidate.id) || !scan.items.some((item) => item.id === candidate.targetId) || !registry.has(candidate.synthId) || !candidate.version || !candidate.sourcePath || !candidate.rationale || !candidate.changeNote) {
        throw new Error(`SOUND_LAB_CANDIDATE_INVALID:${candidate.id}`);
      }
      ids.add(candidate.id);
    }
    return scan.items.map((item) => {
      const brief = SOUND_BRIEFS[item.id];
      if (!brief || brief.length !== 4) throw new Error(`SOUND_LAB_BRIEF_MISSING:${item.id}`);
      const candidates = SOUND_CANDIDATES.filter((candidate) => candidate.targetId === item.id).map((candidate) => ({ ...candidate, role: "research" }));
      if (item.liveStatus === "SYNTH" && item.liveDetails.hasPlayFunction) {
        candidates.unshift({
          id: `${item.id}:product`,
          targetId: item.id,
          role: "product",
          version: "checkout",
          name: "\uC81C\uD488 \uC5F0\uACB0\uBCF8",
          rationale: "\uD604\uC7AC \uCCB4\uD06C\uC544\uC6C3\uC758 \uD14C\uB9C8 \uC0AC\uC6B4\uB4DC \uD329\uC5D0 \uC5F0\uACB0\uB41C \uD569\uC131 \uD568\uC218\uB97C \uC9C1\uC811 \uCCAD\uC74C\uD569\uB2C8\uB2E4.",
          changeNote: "\uAE30\uBCF8 \uCEE8\uD14D\uC2A4\uD2B8\uC758 \uB2E8\uB3C5 \uCCAD\uC74C\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uC571\uC758 \uD0C0\uC774\uBC0D\xB7\uBBF9\uC2A4\xB7\uBC30\uD3EC \uC5EC\uBD80\uB294 \uBCC4\uB3C4 \uD655\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.",
          sourcePath: `src/themes/plugins/${item.theme}/sound/${item.theme}SoundPack.js`,
          parameters: {}
        });
      }
      return {
        id: item.id,
        theme: item.theme,
        scope: item.scope,
        group: item.artifactName,
        name: brief[0],
        moment: brief[1],
        purpose: brief[2],
        question: brief[3],
        concept: item.acousticConcept,
        layers: item.physicalLayers,
        recipe: item.agentRecipePrompt,
        duration: item.targetDuration,
        kind: item.kind,
        bus: item.bus,
        productStatus: item.liveStatus,
        productReason: item.liveDetails.reason === void 0 ? "" : item.liveDetails.reason,
        candidates
      };
    });
  }
  function assertReviewRequest(request, targets, buildRevision) {
    if (!request || request.schemaVersion !== 1 || request.buildRevision !== buildRevision) {
      throw new Error("SOUND_LAB_REVIEW_REVISION_MISMATCH");
    }
    const target = targets.find((item) => item.id === request.targetId);
    if (!target) throw new Error("SOUND_LAB_REVIEW_TARGET_INVALID");
    const candidate = request.candidateId === null ? null : target.candidates.find((item) => item.id === request.candidateId);
    if (candidate === void 0 || candidate === null && target.candidates.length !== 0) {
      throw new Error("SOUND_LAB_REVIEW_CANDIDATE_INVALID");
    }
    if (!Object.hasOwn(REVIEW_DECISIONS, request.decision) || typeof request.note !== "string" || request.note.length > 6e3 || typeof request.context !== "string" || request.context.length > 2e3 || !Array.isArray(request.tags) || request.tags.length > REVIEW_TAGS.length || new Set(request.tags).size !== request.tags.length || request.tags.some((tag) => !REVIEW_TAGS.includes(tag)) || typeof request.auditioned !== "boolean") throw new Error("SOUND_LAB_REVIEW_FIELDS_INVALID");
    if (request.decision === "prefer" && (!candidate || !request.auditioned)) throw new Error("SOUND_LAB_REVIEW_LISTEN_FIRST");
    if (!request.parameters || typeof request.parameters !== "object" || Array.isArray(request.parameters)) {
      throw new Error("SOUND_LAB_REVIEW_PARAMETERS_INVALID");
    }
    const allowed = candidate === null ? {} : candidate.parameters;
    if (Object.keys(request.parameters).length !== Object.keys(allowed).length) throw new Error("SOUND_LAB_REVIEW_PARAMETERS_INVALID");
    for (const [key, value] of Object.entries(request.parameters)) {
      if (!Object.hasOwn(allowed, key) || !Number.isFinite(value) || key === "intensity" && (value < 0.2 || value > 1.3) || key === "basePitch" && (value < allowed.basePitch * 0.5 || value > allowed.basePitch * 1.5) || !["intensity", "basePitch"].includes(key)) throw new Error("SOUND_LAB_REVIEW_PARAMETERS_INVALID");
    }
    return { target, candidate };
  }
  function formatAgentRequest(target, candidate, draft, buildRevision) {
    return `Entropy \uC0AC\uC6B4\uB4DC \uB514\uC790\uC778 \uD611\uC5C5 \uC694\uCCAD

\uAE30\uB2A5: ${target.name}
\uC0AC\uC6A9 \uC21C\uAC04: ${draft.context || target.moment}
\uBAA9\uC801: ${target.purpose}
\uB17C\uC758\uD560 \uC9C8\uBB38: ${target.question}
Sound ID: ${target.id} (${target.theme} / ${target.kind} / ${target.bus})
\uC81C\uD488 \uCF54\uB4DC \uC5F0\uACB0 \uC0C1\uD0DC: ${target.productStatus}
\uB300\uC0C1 \uC2DC\uC548: ${candidate ? `${candidate.name} / ${candidate.id} / ${candidate.version}` : "\uC544\uC9C1 \uC5C6\uC74C \u2014 \uBC29\uD5A5\uBD80\uD130 \uB17C\uC758"}
\uCCAD\uC74C \uC870\uAC74: ${JSON.stringify(draft.parameters)}
\uD604\uC7AC \uC870\uAC74 \uCCAD\uC74C: ${draft.auditioned ? "\uC608" : "\uC544\uB2C8\uC624"}
\uD53C\uB4DC\uBC31: ${REVIEW_DECISIONS[draft.decision]}
\uC778\uC0C1: ${draft.tags.join(", ") || "\uBBF8\uC120\uD0DD"}
\uC758\uACAC: ${draft.note || "\uD568\uAED8 \uBC29\uD5A5\uC744 \uB17C\uC758\uD558\uACE0 \uC2F6\uC2B5\uB2C8\uB2E4."}
\uC5F0\uAD6C\uC18C \uBE4C\uB4DC: ${buildRevision}

\uC791\uC5C5 \uACC4\uC57D:
1. docs/architecture/sound/sound-lab-architecture.md\uC640 scripts/dev/sound-lab/README.md\uB97C \uC77D\uACE0 \uAE30\uB2A5 \uB9E5\uB77D\uBD80\uD130 \uB17C\uC758\uD55C\uB2E4.
2. workspace/reviews/\uC758 \uD574\uB2F9 Sound ID \uD53C\uB4DC\uBC31\uC744 \uC77D\uACE0, \uAE30\uC874 \uC2DC\uC548\uC744 \uBCF4\uC874\uD558\uBA70 \uC0C8 ID\uC758 \uD6C4\uBCF4\uB97C workspace/soundCandidates.js\uC5D0 \uB4F1\uB85D\uD55C\uB2E4. \uD569\uC131 \uC6D0\uBCF8\xB7\uBC84\uC804\xB7\uC758\uB3C4\xB7\uBCC0\uACBD\uC810\uC744 \uD568\uAED8 \uB0A8\uAE34\uB2E4.
3. npm run build:sound-lab \uD6C4 \uC5F0\uAD6C\uC18C\uC5D0\uC11C \uBE44\uAD50\uD560 \uC218 \uC788\uAC8C \uC815\uB9AC\uD55C\uB2E4. \uC81C\uD488 \uC5F0\uACB0\uBCF8\uACFC \uC5F0\uAD6C \uC2DC\uC548\uC758 \uB3D9\uC77C\uC131\uC744 \uCD94\uC815\uD558\uC9C0 \uC54A\uB294\uB2E4.
4. \uC120\uD638\uB294 \uC81C\uD488 \uC801\uC6A9 \uC644\uB8CC\uAC00 \uC544\uB2C8\uB2E4. \uCC44\uD0DD\uD55C \uC791\uC5C5\uBB3C\uC740 \uC815\uC2DD sound domain / theme sound pack \uACBD\uB85C\uB85C \uD1B5\uD569\uD558\uACE0, \uAE30\uB2A5 \uD0C0\uC774\uBC0D\uACFC \uAD00\uB828 \uAC80\uC99D\uC744 \uD655\uC778\uD55C\uB2E4.`;
  }

  // scripts/dev/sound-lab/browser/src/state/SoundLabStore.js
  var SoundLabStore = class {
    constructor(targets = createSoundWorkspace()) {
      if (!targets.length) throw new Error("SOUND_LAB_TARGETS_EMPTY");
      this.targets = targets;
      this.selectedSoundId = targets[0].id;
      this.themeFilter = "zen";
      this.scopeFilter = "all";
      this.searchQuery = "";
      this.reviewFilter = "all";
      this.listeners = /* @__PURE__ */ new Set();
      this.drafts = /* @__PURE__ */ new Map();
      this.selectedCandidates = /* @__PURE__ */ new Map();
      this.reviews = [];
      this.connected = false;
      this.saving = false;
      this.playing = false;
      this.message = "";
      this.buildRevision = globalThis.ENTROPY_SOUND_LAB_BUILD_REVISION;
    }
    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    notify() {
      for (const listener of this.listeners) listener(this);
    }
    getSelectedTarget() {
      const target = this.targets.find((item) => item.id === this.selectedSoundId);
      if (!target) throw new Error("SOUND_LAB_SELECTION_INVALID");
      return target;
    }
    getSelectedCandidate() {
      const target = this.getSelectedTarget();
      if (!target.candidates.length) return null;
      const id = this.selectedCandidates.has(target.id) ? this.selectedCandidates.get(target.id) : target.candidates[0].id;
      const candidate = target.candidates.find((item) => item.id === id);
      if (!candidate) throw new Error("SOUND_LAB_CANDIDATE_SELECTION_INVALID");
      return candidate;
    }
    getDraft() {
      const candidate = this.getSelectedCandidate();
      const key = candidate === null ? this.selectedSoundId : candidate.id;
      if (!this.drafts.has(key)) this.drafts.set(key, {
        context: "",
        decision: "discuss",
        tags: [],
        note: "",
        parameters: candidate === null ? {} : { ...candidate.parameters },
        auditioned: false,
        dirty: false,
        requestId: null
      });
      return this.drafts.get(key);
    }
    setSelectedSoundId(id) {
      if (!this.targets.some((target) => target.id === id)) throw new Error("SOUND_LAB_SELECTION_INVALID");
      this.selectedSoundId = id;
      this.notify();
    }
    setSelectedCandidate(id) {
      if (!this.getSelectedTarget().candidates.some((item) => item.id === id)) throw new Error("SOUND_LAB_CANDIDATE_SELECTION_INVALID");
      this.selectedCandidates.set(this.selectedSoundId, id);
      this.notify();
    }
    setFilter(key, value) {
      this[key] = value;
      this.notify();
    }
    updateDraft(key, value) {
      Object.assign(this.getDraft(), { [key]: value, dirty: true, requestId: null });
      this.notify();
    }
    setParameter(key, value) {
      const draft = this.getDraft();
      this.updateDraft("parameters", { ...draft.parameters, [key]: value });
      draft.auditioned = false;
      this.notify();
    }
    markAuditioned() {
      this.getDraft().auditioned = true;
      this.getDraft().requestId = null;
      this.notify();
    }
    getReviews(targetId = this.selectedSoundId) {
      return this.reviews.filter((record) => record.request.targetId === targetId);
    }
    getFilteredTargets() {
      const query = this.searchQuery.toLowerCase().trim();
      return this.targets.filter((target) => (this.themeFilter === "all" || target.theme === this.themeFilter) && (this.scopeFilter === "all" || target.scope === this.scopeFilter) && (this.reviewFilter !== "unreviewed" || !this.getReviews(target.id).length) && (this.reviewFilter !== "planned" || !target.candidates.length) && (!query || [target.name, target.id, target.group, target.moment].some((text) => text.toLowerCase().includes(query))));
    }
    getStatistics() {
      return {
        total: this.targets.length,
        product: this.targets.filter((target) => ["SYNTH", "ASSET"].includes(target.productStatus)).length,
        candidates: this.targets.reduce((sum, target) => sum + target.candidates.filter((item) => item.role === "research").length, 0),
        reviewed: this.targets.filter((target) => this.getReviews(target.id).length).length
      };
    }
    makeReviewRequest() {
      const draft = this.getDraft();
      if (draft.requestId === null) draft.requestId = crypto.randomUUID();
      return {
        schemaVersion: 1,
        requestId: draft.requestId,
        buildRevision: this.buildRevision,
        targetId: this.selectedSoundId,
        candidateId: this.getSelectedCandidate()?.id ?? null,
        context: draft.context,
        decision: draft.decision,
        tags: [...draft.tags],
        note: draft.note,
        parameters: { ...draft.parameters },
        auditioned: draft.auditioned
      };
    }
  };

  // scripts/dev/sound-lab/browser/src/components/SoundLedgerComponent.js
  var label = (tag, text, className = "") => {
    const element = document.createElement(tag);
    element.textContent = text;
    element.className = className;
    return element;
  };
  var SoundLedgerComponent = class {
    constructor(listElement, store) {
      this.listElement = listElement;
      this.store = store;
      this.signature = "";
    }
    bindEvents() {
      document.getElementById("searchInput").addEventListener("input", (event) => this.store.setFilter("searchQuery", event.target.value));
      for (const [id, key] of [["themeFilter", "themeFilter"], ["reviewFilter", "reviewFilter"]]) {
        document.getElementById(id).addEventListener("change", (event) => this.store.setFilter(key, event.target.value));
      }
      document.querySelectorAll("[data-scope]").forEach((button) => button.addEventListener("click", () => {
        this.store.setFilter("scopeFilter", button.dataset.scope);
      }));
    }
    render() {
      const targets = this.store.getFilteredTargets();
      const signature = JSON.stringify([targets.map((item) => item.id), this.store.selectedSoundId, this.store.themeFilter, this.store.scopeFilter, this.store.reviewFilter, this.store.reviews.map((item) => item.id)]);
      if (signature === this.signature) return;
      this.signature = signature;
      document.getElementById("themeFilter").value = this.store.themeFilter;
      document.getElementById("reviewFilter").value = this.store.reviewFilter;
      document.querySelectorAll("[data-scope]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.scope === this.store.scopeFilter)));
      document.getElementById("resultCount").textContent = `${targets.length}\uAC1C\uC758 \uC0AC\uC6B4\uB4DC \uC21C\uAC04`;
      this.listElement.replaceChildren();
      if (!targets.length) this.listElement.append(label("p", "\uAC80\uC0C9 \uC870\uAC74\uC5D0 \uB9DE\uB294 \uC18C\uB9AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uD544\uD130\uB97C \uBC14\uAFB8\uC5B4 \uBCF4\uC138\uC694.", "empty-state"));
      const groups = /* @__PURE__ */ new Map();
      for (const target of targets) {
        const key = `${target.theme} / ${target.group}`;
        if (!groups.has(key)) {
          const section = document.createElement("section");
          section.append(label("h3", `${target.theme.toUpperCase()} \xB7 ${target.group}`, "group-title"));
          groups.set(key, section);
          this.listElement.append(section);
        }
        const card = document.createElement("button");
        card.type = "button";
        card.className = "sound-card";
        card.setAttribute("aria-pressed", String(target.id === this.store.selectedSoundId));
        card.append(label("span", target.name, "sound-name"));
        const research = target.candidates.filter((item) => item.role === "research").length;
        const metadata = [];
        if (["SYNTH", "ASSET"].includes(target.productStatus)) metadata.push("\uC81C\uD488 \uC5F0\uACB0");
        if (research) metadata.push(`\uC2DC\uC548 ${research}`);
        if (!target.candidates.length) metadata.push("\uBC29\uD5A5 \uB17C\uC758");
        if (this.store.getReviews(target.id).length) metadata.push("\uD53C\uB4DC\uBC31 \uC788\uC74C");
        card.append(label("span", metadata.join(" \xB7 "), "sound-meta"));
        card.addEventListener("click", () => this.store.setSelectedSoundId(target.id));
        groups.get(key).append(card);
      }
    }
  };

  // scripts/dev/sound-lab/browser/src/components/StudioDetailComponent.js
  var StudioDetailComponent = class {
    constructor(store, player) {
      this.store = store;
      this.player = player;
      this.signature = "";
    }
    bindEvents() {
      document.getElementById("btnPlayCurrent").addEventListener("click", async () => {
        const draft = this.store.getDraft();
        const candidate = this.store.getSelectedCandidate();
        const parameters = { ...draft.parameters };
        try {
          const scheduled = await this.player.play(this.store.getSelectedTarget(), candidate, parameters);
          if (scheduled && candidate === this.store.getSelectedCandidate() && JSON.stringify(parameters) === JSON.stringify(draft.parameters)) this.store.markAuditioned();
        } catch (error) {
          this.store.message = error.message;
          this.store.notify();
        }
      });
      document.getElementById("btnStop").addEventListener("click", () => {
        void this.player.stop().catch((error) => {
          this.store.message = error.message;
          this.store.notify();
        });
      });
      this.player.onError = (error) => {
        this.store.message = error.message;
        this.store.notify();
      };
      for (const [id, key] of [["sliderIntensity", "intensity"], ["sliderPitch", "basePitch"]]) {
        document.getElementById(id).addEventListener("input", (event) => this.store.setParameter(key, Number(event.target.value)));
      }
      document.getElementById("btnResetFactors").addEventListener("click", () => {
        const candidate = this.store.getSelectedCandidate();
        if (candidate) {
          this.store.getDraft().auditioned = false;
          this.store.updateDraft("parameters", { ...candidate.parameters });
        }
      });
    }
    render() {
      const target = this.store.getSelectedTarget();
      const candidate = this.store.getSelectedCandidate();
      const draft = this.store.getDraft();
      const set = (id, text) => {
        document.getElementById(id).textContent = text;
      };
      set("detailBreadcrumbs", `${target.theme.toUpperCase()} / ${target.group}`);
      set("detailTitle", target.name);
      set("detailMoment", target.moment);
      set("detailPurpose", target.purpose);
      set("listeningQuestion", target.question);
      set("detailId", target.id);
      set("detailDesc", target.concept);
      set("productStatus", { SYNTH: "\uC81C\uD488 \uCF54\uB4DC\uC5D0 \uD569\uC131 \uC5F0\uACB0", ASSET: "\uC81C\uD488 \uCF54\uB4DC\uC5D0 \uD30C\uC77C \uC5F0\uACB0", SILENT: "\uC81C\uD488\uC5D0\uC11C \uBA85\uC2DC\uC801 \uBB34\uC74C", PLANNED: "\uC81C\uD488 \uBBF8\uC5F0\uACB0" }[target.productStatus]);
      set("candidateNote", candidate ? candidate.changeNote : "\uC544\uC9C1 \uB4F1\uB85D\uB41C \uC2DC\uC548\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC544\uB798\uC5D0 \uC0AC\uC6A9 \uB9E5\uB77D\uC774\uB098 \uC6D0\uD558\uB294 \uB290\uB08C\uC744 \uB0A8\uACA8 \uC5D0\uC774\uC804\uD2B8\uC640 \uBC29\uD5A5\uC744 \uC815\uD558\uC138\uC694.");
      set("candidateSource", candidate ? `${candidate.version} \xB7 ${candidate.sourcePath}` : "\uC0C8 \uC2DC\uC548 \uB300\uAE30");
      set("candidateRationale", candidate ? candidate.rationale : "\uBB34\uC74C\uB3C4 \uD558\uB098\uC758 \uB514\uC790\uC778 \uC120\uD0DD\uC785\uB2C8\uB2E4.");
      set("playbackStatus", this.store.playing ? "\uC7AC\uC0DD \uC911 \xB7 \uB2E4\uB978 \uC2DC\uC548\uC744 \uC120\uD0DD\uD558\uBA74 \uC815\uC9C0\uD569\uB2C8\uB2E4" : `${target.duration}\uCD08 \uBAA9\uD45C \uAE38\uC774 \xB7 \uB2E8\uB3C5 \uCCAD\uC74C`);
      set("analyserNote", candidate?.role === "research" ? "\uC5F0\uAD6C \uC2DC\uC548 \uCCAD\uC74C \uC911 \uD30C\uD615\uACFC \uC2A4\uD399\uD2B8\uB7FC\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4." : "\uC81C\uD488 \uC5F0\uACB0\uBCF8\uC740 \uC81C\uD488 \uD569\uC131 \uD568\uC218\uB97C \uC9C1\uC811 \uC7AC\uC0DD\uD569\uB2C8\uB2E4. \uD30C\uD615 \uBD84\uC11D\uC740 \uC5F0\uAD6C \uC2DC\uC548\uC5D0\uC11C \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      document.getElementById("visualizerCanvas").hidden = candidate?.role !== "research";
      document.getElementById("btnPlayCurrent").disabled = candidate === null;
      document.getElementById("btnStop").disabled = !this.store.playing;
      const signature = `${target.id}/${candidate?.id}`;
      if (signature !== this.signature) {
        this.signature = signature;
        const list = document.getElementById("candidateList");
        list.replaceChildren();
        for (const item of target.candidates) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "candidate-card";
          button.setAttribute("aria-pressed", String(item.id === candidate.id));
          for (const [tag, text] of [["small", item.role === "product" ? "PRODUCT / \uBE44\uAD50 \uAE30\uC900" : `RESEARCH / ${item.version}`], ["strong", item.name]]) {
            const element = document.createElement(tag);
            element.textContent = text;
            button.append(element);
          }
          button.addEventListener("click", () => this.store.setSelectedCandidate(item.id));
          list.append(button);
        }
        const layers = document.getElementById("physicalLayersList");
        layers.replaceChildren();
        for (const layer of target.layers) {
          const li = document.createElement("li");
          li.textContent = layer;
          layers.append(li);
        }
      }
      const research = candidate?.role === "research";
      document.getElementById("factorControls").hidden = !research;
      document.getElementById("pitchControl").hidden = !Object.hasOwn(draft.parameters, "basePitch");
      if (research) {
        document.getElementById("sliderIntensity").value = draft.parameters.intensity;
        set("lblIntensity", `${Math.round(draft.parameters.intensity * 100)}%`);
        if (Object.hasOwn(draft.parameters, "basePitch")) {
          const slider = document.getElementById("sliderPitch");
          slider.min = candidate.parameters.basePitch * 0.5;
          slider.max = candidate.parameters.basePitch * 1.5;
          slider.value = draft.parameters.basePitch;
          set("lblPitch", `${Math.round(draft.parameters.basePitch)} Hz`);
        }
      }
    }
  };

  // scripts/dev/sound-lab/browser/src/components/AgentPromptCardComponent.js
  var AgentPromptCardComponent = class {
    constructor(store) {
      this.store = store;
      this.historySignature = "";
    }
    bindEvents() {
      for (const [value, label2] of Object.entries(REVIEW_DECISIONS)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label2;
        document.getElementById("reviewDecision").append(option);
      }
      for (const tag of REVIEW_TAGS) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = tag;
        button.dataset.tag = tag;
        button.addEventListener("click", () => {
          const tags = this.store.getDraft().tags;
          this.store.updateDraft("tags", tags.includes(tag) ? tags.filter((value) => value !== tag) : [...tags, tag]);
        });
        document.getElementById("feedbackTags").append(button);
      }
      for (const [id, key, event] of [["reviewDecision", "decision", "change"], ["reviewContext", "context", "input"], ["reviewNote", "note", "input"]]) {
        document.getElementById(id).addEventListener(event, (change) => this.store.updateDraft(key, change.target.value));
      }
      document.getElementById("btnSaveReview").addEventListener("click", () => {
        void this.save();
      });
      document.getElementById("btnConnect").addEventListener("click", () => {
        void this.connect();
      });
      document.getElementById("btnCopyPrompt").addEventListener("click", async () => {
        try {
          if (!navigator.clipboard) throw new Error("\uC790\uB3D9 \uBCF5\uC0AC\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC544\uB798 \uC694\uCCAD\uBB38\uC744 \uC120\uD0DD\uD574 \uBCF5\uC0AC\uD558\uC138\uC694.");
          await navigator.clipboard.writeText(document.getElementById("agentPromptText").value);
          this.store.message = "\uC5D0\uC774\uC804\uD2B8 \uC694\uCCAD\uC744 \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4. \uB300\uD654\uC5D0 \uBD99\uC5EC \uB123\uC5B4 \uC8FC\uC138\uC694.";
        } catch (error) {
          this.store.message = `\uBCF5\uC0AC \uC2E4\uD328: ${error.message}`;
        }
        this.store.notify();
      });
    }
    async connect() {
      if (location.protocol === "file:") {
        this.store.message = "\uD30C\uC77C\uB85C \uC5F4\uBA74 \uCCAD\uC74C\uACFC \uC694\uCCAD \uBCF5\uC0AC\uAC00 \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uD53C\uB4DC\uBC31\uC744 \uD30C\uC77C\uC5D0 \uC800\uC7A5\uD558\uB824\uBA74 npm run dev:sound-lab\uC73C\uB85C \uB85C\uCEEC \uC791\uC5C5 \uACF5\uAC04\uC744 \uC5EC\uC138\uC694.";
        this.store.notify();
        return;
      }
      try {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (data.revision !== this.store.buildRevision) throw new Error("\uC0C8 \uBE4C\uB4DC\uAC00 \uC788\uC2B5\uB2C8\uB2E4. \uC791\uC131 \uC911\uC778 \uC694\uCCAD\uC744 \uBCF5\uC0AC\uD55C \uB4A4 \uD398\uC774\uC9C0\uB97C \uC0C8\uB85C\uACE0\uCE68\uD558\uC138\uC694.");
        if (!Array.isArray(data.reviews)) throw new Error("\uD53C\uB4DC\uBC31 \uBAA9\uB85D \uC751\uB2F5\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        this.store.reviews = data.reviews;
        this.store.connected = true;
        this.store.message = "\uD53C\uB4DC\uBC31\uC744 \uC800\uC7A5\uD558\uBA74 \uB85C\uCEEC \uC5F0\uAD6C\uC18C \uD30C\uC77C\uC5D0 \uAE30\uB85D\uB429\uB2C8\uB2E4. \uC5D0\uC774\uC804\uD2B8\uAC00 \uC774 \uAE30\uB85D\uC744 \uC774\uC5B4\uC11C \uC77D\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
      } catch (error) {
        this.store.connected = false;
        this.store.message = `\uC791\uC5C5 \uACF5\uAC04 \uC5F0\uACB0 \uC2E4\uD328: ${error.message}`;
      }
      this.store.notify();
    }
    async save() {
      if (!this.store.connected || this.store.saving) return;
      const draft = this.store.getDraft();
      const request = this.store.makeReviewRequest();
      try {
        assertReviewRequest(request, this.store.targets, this.store.buildRevision);
        this.store.saving = true;
        this.store.notify();
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Sound-Lab": "review" },
          body: JSON.stringify(request)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!data.record || data.record.id !== request.requestId) throw new Error("\uC800\uC7A5 \uD655\uC778 \uC751\uB2F5\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        this.store.reviews = [data.record, ...this.store.reviews.filter((record) => record.id !== data.record.id)];
        if (draft.requestId === request.requestId) draft.dirty = false;
        this.store.message = "\uD53C\uB4DC\uBC31\uC744 \uC5F0\uAD6C\uC18C \uD30C\uC77C\uC5D0 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4. \uC694\uCCAD\uC744 \uBCF5\uC0AC\uD574 \uC5D0\uC774\uC804\uD2B8\uC640 \uC774\uC5B4\uC11C \uB17C\uC758\uD558\uC138\uC694.";
      } catch (error) {
        this.store.message = `\uD53C\uB4DC\uBC31 \uC800\uC7A5 \uC2E4\uD328: ${error.message}. \uC791\uC131 \uB0B4\uC6A9\uC740 \uD654\uBA74\uC5D0 \uB0A8\uC544 \uC788\uC2B5\uB2C8\uB2E4.`;
      } finally {
        this.store.saving = false;
        this.store.notify();
      }
    }
    render() {
      const target = this.store.getSelectedTarget();
      const candidate = this.store.getSelectedCandidate();
      const draft = this.store.getDraft();
      for (const [id, key] of [["reviewDecision", "decision"], ["reviewContext", "context"], ["reviewNote", "note"]]) {
        const element = document.getElementById(id);
        if (element.value !== draft[key]) element.value = draft[key];
      }
      document.getElementById("reviewContext").placeholder = target.moment;
      document.querySelectorAll("[data-tag]").forEach((button) => button.setAttribute("aria-pressed", String(draft.tags.includes(button.dataset.tag))));
      document.getElementById("reviewSubject").textContent = candidate ? `${candidate.name} \xB7 ${candidate.version}\uC5D0 \uB300\uD55C \uD53C\uB4DC\uBC31` : "\uC0C8 \uC18C\uB9AC\uC758 \uBC29\uD5A5\uC5D0 \uB300\uD55C \uD53C\uB4DC\uBC31";
      document.getElementById("draftStatus").textContent = draft.dirty ? "\uC800\uC7A5\uD558\uC9C0 \uC54A\uC740 \uD53C\uB4DC\uBC31" : "\uAE30\uB2A5\uACFC \uC2DC\uC548\uB9C8\uB2E4 \uD53C\uB4DC\uBC31\uC744 \uB530\uB85C \uAE30\uB85D\uD569\uB2C8\uB2E4";
      document.getElementById("auditionStatus").textContent = draft.auditioned ? "\uD604\uC7AC \uC870\uAC74\uC73C\uB85C \uCCAD\uC74C \uC2E4\uD589\uB428" : "\uD604\uC7AC \uC870\uAC74\uC740 \uC544\uC9C1 \uCCAD\uC74C\uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4";
      document.getElementById("btnSaveReview").disabled = !this.store.connected || this.store.saving || draft.decision === "prefer" && !draft.auditioned;
      document.getElementById("btnSaveReview").textContent = this.store.saving ? "\uC800\uC7A5 \uC911\u2026" : "\uD53C\uB4DC\uBC31 \uC800\uC7A5";
      document.getElementById("agentPromptText").value = formatAgentRequest(target, candidate, draft, this.store.buildRevision);
      const records = this.store.getReviews();
      const signature = JSON.stringify([target.id, records.map((record) => record.id)]);
      if (signature !== this.historySignature) {
        this.historySignature = signature;
        const list = document.getElementById("reviewHistory");
        list.replaceChildren();
        if (!records.length) {
          const p = document.createElement("p");
          p.className = "muted";
          p.textContent = "\uC544\uC9C1 \uC800\uC7A5\uB41C \uD53C\uB4DC\uBC31\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.";
          list.append(p);
        }
        for (const record of records) {
          const article = document.createElement("article");
          article.className = "review-record";
          const title = document.createElement("strong");
          title.textContent = `${REVIEW_DECISIONS[record.request.decision]} \xB7 ${record.candidate ? record.candidate.name : "\uBC29\uD5A5 \uB17C\uC758"}`;
          const meta = document.createElement("small");
          meta.textContent = `${new Date(record.savedAt).toLocaleString("ko-KR")} \xB7 ${record.request.buildRevision.slice(0, 10)}${record.request.buildRevision !== this.store.buildRevision ? " \xB7 \uC774\uC804 \uBE4C\uB4DC \uAE30\uB85D" : ""}`;
          const note = document.createElement("p");
          note.textContent = [record.request.tags.join(" \xB7 "), record.request.note].filter(Boolean).join("\n");
          const detail = document.createElement("p");
          detail.className = "muted";
          detail.textContent = `${record.request.context || record.target.moment} \xB7 \uCCAD\uC74C \uC870\uAC74 ${JSON.stringify(record.request.parameters)}`;
          article.append(title, meta, note, detail);
          list.append(article);
        }
      }
    }
  };

  // scripts/dev/sound-lab/engine/analysis/AudioAnalyzer.js
  var AudioAnalyzer = class {
    constructor(analyserNode) {
      this.analyser = analyserNode;
      this.timeDomainData = null;
      this.frequencyData = null;
      if (this.analyser) {
        this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      }
    }
    setAnalyserNode(analyserNode) {
      this.analyser = analyserNode;
      if (this.analyser) {
        this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      }
    }
    getTimeDomainData() {
      if (this.analyser && this.timeDomainData) {
        this.analyser.getByteTimeDomainData(this.timeDomainData);
      }
      return this.timeDomainData;
    }
    getFrequencyData() {
      if (this.analyser && this.frequencyData) {
        this.analyser.getByteFrequencyData(this.frequencyData);
      }
      return this.frequencyData;
    }
    renderToCanvas(canvas, {
      backgroundColor = "#090b0c",
      waveformColor = "#8cb891",
      spectrumColor = "rgba(94, 139, 99, 0.25)"
    } = {}) {
      if (!canvas || !this.analyser) return;
      const ctx = canvas.getContext("2d");
      const timeData = this.getTimeDomainData();
      const freqData = this.getFrequencyData();
      if (!timeData || !freqData) return;
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / freqData.length * 2.5;
      let barX = 0;
      for (let i = 0; i < freqData.length; i += 1) {
        const barHeight = freqData[i] / 255 * (canvas.height * 0.75);
        ctx.fillStyle = spectrumColor;
        ctx.fillRect(barX, canvas.height - barHeight, barWidth - 1, barHeight);
        barX += barWidth;
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = waveformColor;
      ctx.beginPath();
      const sliceWidth = canvas.width * 1 / timeData.length;
      let x = 0;
      for (let i = 0; i < timeData.length; i += 1) {
        const v = timeData[i] / 128;
        const y = v * canvas.height / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }
  };

  // scripts/dev/sound-lab/browser/src/playback/SoundLabPlayer.js
  var SoundLabPlayer = class {
    constructor({ AudioContextCtor = globalThis.AudioContext } = {}) {
      this.AudioContextCtor = AudioContextCtor;
      this.context = null;
      this.epoch = 0;
      this.timer = null;
      this.frame = null;
      this.onState = () => {
      };
      this.onError = (error) => console.error("[sound-lab]", error);
    }
    async stop() {
      this.epoch += 1;
      clearTimeout(this.timer);
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = null;
      const context = this.context;
      this.context = null;
      this.onState(false);
      if (context && context.state !== "closed") await context.close();
    }
    async play(target, candidate, parameters) {
      const closing = this.stop();
      const epoch = this.epoch;
      await closing;
      if (epoch !== this.epoch) return false;
      if (!candidate) throw new Error("\uC544\uC9C1 \uCCAD\uC74C\uD560 \uC2DC\uC548\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uBA3C\uC800 \uC5D0\uC774\uC804\uD2B8\uC640 \uBC29\uD5A5\uC744 \uB17C\uC758\uD558\uC138\uC694.");
      if (typeof this.AudioContextCtor !== "function") throw new Error("\uC774 \uBE0C\uB77C\uC6B0\uC800\uB294 WebAudio \uCCAD\uC74C\uC744 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
      const context = new this.AudioContextCtor();
      this.context = context;
      try {
        if (context.state === "suspended") await context.resume();
        if (epoch !== this.epoch) return false;
        if (context.state !== "running") throw new Error("\uC624\uB514\uC624 \uC7AC\uC0DD\uC774 \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uCCAD\uC74C \uBC84\uD2BC\uC744 \uB2E4\uC2DC \uB20C\uB7EC \uC8FC\uC138\uC694.");
        let result;
        if (candidate.role === "product") {
          const live = resolveLiveSoundStatus(target.theme, target.id, target.kind);
          if (live.status !== "SYNTH" || !live.hasPlayFunction) throw new Error("\uC81C\uD488 \uD569\uC131 \uC5F0\uACB0\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
          result = live.descriptor.play({ audioContext: context });
        } else {
          const analyser = context.createAnalyser();
          analyser.fftSize = 512;
          analyser.connect(context.destination);
          result = getDefaultSynthRegistry().get(candidate.synthId)(context, analyser, parameters);
          const renderer = new AudioAnalyzer(analyser);
          const render = () => {
            if (epoch !== this.epoch) return;
            const canvas = document.getElementById("visualizerCanvas");
            if (document.getElementById("technicalDetails")?.open && canvas) renderer.renderToCanvas(canvas);
            this.frame = requestAnimationFrame(render);
          };
          render();
        }
        if (result !== true) throw new Error("\uD569\uC131 \uD568\uC218\uAC00 \uC7AC\uC0DD \uC2E4\uD328\uB97C \uBCF4\uACE0\uD588\uC2B5\uB2C8\uB2E4. \uC9C4\uB2E8 \uB85C\uADF8\uB97C \uD655\uC778\uD558\uC138\uC694.");
        this.onState(true);
        this.timer = setTimeout(() => {
          void this.stop().catch(this.onError);
        }, (target.duration + 1) * 1e3);
        return true;
      } catch (error) {
        if (epoch === this.epoch) await this.stop();
        throw error;
      }
    }
  };

  // scripts/dev/sound-lab/browser/src/main.js
  function bootstrapSoundLab() {
    const store = new SoundLabStore();
    const player = new SoundLabPlayer();
    const ledger = new SoundLedgerComponent(document.getElementById("soundList"), store);
    const studio = new StudioDetailComponent(store, player);
    const feedback = new AgentPromptCardComponent(store);
    ledger.bindEvents();
    studio.bindEvents();
    feedback.bindEvents();
    let selection = "";
    store.subscribe(() => {
      const next = `${store.selectedSoundId}/${store.getSelectedCandidate()?.id}`;
      if (selection !== next) {
        selection = next;
        player.stop().catch((error) => {
          store.message = error.message;
          store.notify();
        });
      }
      const stats = store.getStatistics();
      for (const [key, value] of Object.entries(stats)) document.getElementById(`stat-${key}`).textContent = value;
      document.getElementById("connectionStatus").textContent = store.connected ? "\uB85C\uCEEC \uC791\uC5C5 \uACF5\uAC04 \uC5F0\uACB0\uB428" : "\uCCAD\uC74C \xB7 \uC694\uCCAD \uBCF5\uC0AC \uBAA8\uB4DC";
      document.getElementById("workspaceMessage").textContent = store.message;
      ledger.render();
      studio.render();
      feedback.render();
    });
    player.onState = (playing) => {
      store.playing = playing;
      store.notify();
    };
    window.addEventListener("pagehide", () => {
      void player.stop().catch((error) => console.error("[sound-lab]", error));
    });
    window.addEventListener("beforeunload", (event) => {
      if ([...store.drafts.values()].some((draft) => draft.dirty)) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void player.stop().catch((error) => {
        store.message = error.message;
        store.notify();
      });
    });
    store.notify();
    void feedback.connect();
    return { store, player };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrapSoundLab);
  else bootstrapSoundLab();
})();
