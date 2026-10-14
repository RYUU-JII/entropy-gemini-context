import { THEME_IDS } from '../../core/ids.js';
import { createThemeManifest } from '../../core/runtime/createThemeManifest.js';
import { ClinicalTheme } from './theme.js';
import { clinicalScheduleVisualPolicy } from './scheduleVisualPolicy.js';
import { clinicalThemeSurfaceDescriptor } from './surfaceDescriptor.js';
import { clinicalThemeProfileDefinition } from './profile.js';

export const clinicalThemeManifest = createThemeManifest({
    id: THEME_IDS.CLINICAL,
    theme: ClinicalTheme,
    scheduleVisualPolicy: clinicalScheduleVisualPolicy,
    profile: clinicalThemeProfileDefinition,
    contracts: {
        copy: {
            tabIcons: clinicalThemeSurfaceDescriptor.tabIconVariant,
        },
    },
    widgets: { loaders: clinicalThemeSurfaceDescriptor.widgetLoaders },
    bootLoaders: {
        soft: './presentation/SoftBootLoader.jsx',
    },
});

export default clinicalThemeManifest;
