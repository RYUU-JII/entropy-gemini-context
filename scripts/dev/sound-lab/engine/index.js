/**
 * Entropy Sound Engine - Main Modular Facade
 * Decoupled standalone engine entrypoint.
 */

export { AudioGraphContext, getDefaultAudioGraphContext } from './core/AudioGraphContext.js';
export { AudioBusMixer } from './core/AudioBusMixer.js';
export { ParameterAutomator } from './core/ParameterAutomator.js';

export { NoiseGenerator } from './primitives/NoiseGenerator.js';
export { ModalResonanceBank } from './primitives/ModalResonanceBank.js';
export { TransientChirp } from './primitives/TransientChirp.js';
export { FluidAcoustics } from './primitives/FluidAcoustics.js';

export { AudioAnalyzer } from './analysis/AudioAnalyzer.js';
export { SynthRegistry, getDefaultSynthRegistry } from './synths/SynthRegistry.js';

// Zen Synths
export { ShishiOdoshiClackSynth } from './synths/zen/ShishiOdoshiClackSynth.js';
export { ShishiOdoshiWaterLoopSynth } from './synths/zen/ShishiOdoshiWaterLoopSynth.js';
export { ZenFurinGlassClinkSynth } from './synths/zen/ZenFurinGlassClinkSynth.js';
export { ZenKoiHydroAcousticsSynth } from './synths/zen/ZenKoiHydroAcousticsSynth.js';
export { ZenRoom478BreathingSynth } from './synths/zen/ZenRoom478BreathingSynth.js';
export { ZenGlobalSentinelRiftSynth } from './synths/zen/ZenGlobalSentinelRiftSynth.js';
export { ZenSingingBowlSynth } from './synths/zen/ZenSingingBowlSynth.js';

// Theme Synths
export { TerminalDataPulseSynth } from './synths/entropy/TerminalDataPulseSynth.js';
export { IndustrialConsoleHumSynth } from './synths/entropy/IndustrialConsoleHumSynth.js';
export { NeonGlitchClickSynth } from './synths/cyberpunk/NeonGlitchClickSynth.js';
export { DigitalRainCascadeSynth } from './synths/matrix/DigitalRainCascadeSynth.js';
