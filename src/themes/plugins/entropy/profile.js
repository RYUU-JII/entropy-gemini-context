import { THEME_IDS } from '../../core/ids.js';
import { entropyFrictionPresentation } from './frictionPresentation.js';

export const entropyThemeProfileDefinition = Object.freeze({
  rangeInputStyle: 'fader',
  fallbackBackground: 'starfield',
  nudgePreset: entropyFrictionPresentation.profile.nudgePreset,
  dashboard: Object.freeze({ tabTransition: 'entropy-stage' }),
  experiment: Object.freeze({
    enableBonsaiVNext: false,
    signalScannerInput: 'targets',
  }),
  friction: entropyFrictionPresentation.profile.friction,
  selectorMetrics: Object.freeze({
    contrast: 'MAX',
    saturation: 'HIGH',
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
  widgets: Object.freeze({ main: THEME_IDS.ENTROPY }),
});
