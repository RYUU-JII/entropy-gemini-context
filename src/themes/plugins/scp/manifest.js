import { THEME_IDS } from '../../core/ids.js';
import { createThemeManifest } from '../../core/runtime/createThemeManifest.js';
import { SCPTheme } from './theme.js';
import { scpScheduleVisualPolicy } from './scheduleVisualPolicy.js';
import { scpThemeSurfaceDescriptor } from './surfaceDescriptor.js';
import { scpThemeProfileDefinition } from './profile.js';

export const scpThemeManifest = createThemeManifest({
    id: THEME_IDS.SCP,
    theme: SCPTheme,
    scheduleVisualPolicy: scpScheduleVisualPolicy,
    profile: scpThemeProfileDefinition,
    contracts: {
        copy: {
            tabIcons: scpThemeSurfaceDescriptor.tabIconVariant,
        },
    },
    widgets: { loaders: scpThemeSurfaceDescriptor.widgetLoaders },
    bootLoaders: {
        soft: './presentation/SoftBootLoader.jsx',
    },
});

export default scpThemeManifest;
