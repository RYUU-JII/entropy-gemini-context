import { THEME_IDS } from '../../core/ids.js';
import { clinicalFrictionPresentation } from './frictionPresentation.js';

export const clinicalThemeProfileDefinition = Object.freeze({
  nudgePreset: clinicalFrictionPresentation.profile.nudgePreset,
  dashboard: Object.freeze({ tabTransition: 'clinical-fade' }),
  experiment: Object.freeze({
    enableBonsaiVNext: false,
    signalScannerInput: 'targets',
  }),
  friction: clinicalFrictionPresentation.profile.friction,
  selectorMetrics: Object.freeze({
    contrast: 'STERILE',
    saturation: 'CLINICAL',
    spectrum: 'BIO',
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
  widgets: Object.freeze({ main: THEME_IDS.CLINICAL }),
});
