import { THEME_IDS } from '../../core/ids.js';
import { scpFrictionPresentation } from './frictionPresentation.js';

export const scpThemeProfileDefinition = Object.freeze({
  nudgePreset: scpFrictionPresentation.profile.nudgePreset,
  dashboard: Object.freeze({ tabTransition: 'scp-redact' }),
  experiment: Object.freeze({
    enableBonsaiVNext: false,
    signalScannerInput: 'targets',
  }),
  friction: scpFrictionPresentation.profile.friction,
  selectorMetrics: Object.freeze({
    contrast: 'REDACTED',
    saturation: 'THERMAL',
    spectrum: 'ANOMALY',
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
  widgets: Object.freeze({ main: THEME_IDS.SCP }),
});
