import { BUILD_INCLUDE_EXPERIMENT_TAB, BUILD_INCLUDE_ZEN_VNEXT } from '../../../platform/build/releaseCapabilities.js';
import { THEME_IDS } from '../../core/ids.js';
import { zenFrictionPresentation } from './frictionPresentation.js';

export const zenThemeProfileDefinition = Object.freeze({
  bootLoaderVariant: 'soft',
  nudgePreset: zenFrictionPresentation.profile.nudgePreset,
  dashboard: Object.freeze({ tabTransition: 'zen-breath' }),
  experiment: Object.freeze({
    enableBonsaiVNext: BUILD_INCLUDE_ZEN_VNEXT,
    enableBonsaiRenderDebug: BUILD_INCLUDE_EXPERIMENT_TAB,
    signalScannerInput: 'domain-candidates',
  }),
  friction: zenFrictionPresentation.profile.friction,
  selectorMetrics: Object.freeze({
    contrast: 'SOFT',
    saturation: 'FRESH',
    spectrum: 'NATURE',
  }),
  main: Object.freeze({
    layout: 'zen',
    allowExpandScanner: true,
    enableKoiTuner: true,
    signalScannerInput: 'domain-candidates',
    parkSignalScannerRuntimeOnUnmount: true,
    homeBottomVariant: 'pressure-rail',
    embeddedCoreStatusVariant: 'ambient-home',
  }),
  sites: Object.freeze({
    globalCapVariant: 'zen-stone-channel',
    targetPanelVariant: 'paper',
    workspaceVariant: 'open',
    noticeVariant: 'paper',
  }),
  settings: Object.freeze({ chromeVariant: 'minimal' }),
  tools: Object.freeze({ galleryIndexVariant: 'path' }),
  widgets: Object.freeze({ main: THEME_IDS.ZEN }),
});
