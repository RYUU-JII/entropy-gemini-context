import { THEME_IDS } from '../../core/ids.js';
import { cyberpunkFrictionPresentation } from './frictionPresentation.js';

export const cyberpunkThemeProfileDefinition = Object.freeze({
  rangeInputStyle: 'fader',
  fallbackBackground: 'starfield',
  nudgePreset: cyberpunkFrictionPresentation.profile.nudgePreset,
  dashboard: Object.freeze({ tabTransition: 'cyberpunk-surge' }),
  experiment: Object.freeze({
    enableBonsaiVNext: false,
    signalScannerInput: 'targets',
  }),
  friction: cyberpunkFrictionPresentation.profile.friction,
  selectorMetrics: Object.freeze({
    contrast: 'MAX',
    saturation: 'NEON',
    spectrum: 'UV',
  }),
  sites: Object.freeze({
    targetPanelVariant: 'standard',
    workspaceVariant: 'standard',
    noticeVariant: 'standard',
  }),
  settings: Object.freeze({ chromeVariant: 'standard' }),
  main: Object.freeze({
    signalScannerInput: 'targets',
    parkSignalScannerRuntimeOnUnmount: false,
    homeBottomVariant: 'brief-card',
    embeddedCoreStatusVariant: 'default',
  }),
  widgets: Object.freeze({ main: THEME_IDS.CYBERPUNK }),
});
