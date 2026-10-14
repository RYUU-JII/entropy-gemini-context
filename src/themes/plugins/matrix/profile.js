import { THEME_IDS } from '../../core/ids.js';
import { matrixFrictionPresentation } from './frictionPresentation.js';

export const matrixThemeProfileDefinition = Object.freeze({
  fallbackBackground: 'matrix-rain',
  nudgePreset: matrixFrictionPresentation.profile.nudgePreset,
  dashboard: Object.freeze({ tabTransition: 'matrix-trace' }),
  experiment: Object.freeze({
    enableBonsaiVNext: false,
    signalScannerInput: 'targets',
  }),
  friction: matrixFrictionPresentation.profile.friction,
  selectorMetrics: Object.freeze({
    contrast: 'HIGH',
    saturation: 'MONO',
    spectrum: 'CODE',
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
  widgets: Object.freeze({ main: THEME_IDS.MATRIX }),
});
