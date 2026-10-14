import { THEME_IDS } from '../../core/ids.js';
import { createThemeManifest } from '../../core/runtime/createThemeManifest.js';
import { CyberpunkTheme } from './theme.js';
import { cyberpunkScheduleVisualPolicy } from './scheduleVisualPolicy.js';
import { cyberpunkThemeSurfaceDescriptor } from './surfaceDescriptor.js';
import { cyberpunkThemeProfileDefinition } from './profile.js';

export const cyberpunkThemeManifest = createThemeManifest({
    id: THEME_IDS.CYBERPUNK,
    theme: CyberpunkTheme,
    scheduleVisualPolicy: cyberpunkScheduleVisualPolicy,
    profile: cyberpunkThemeProfileDefinition,
    contracts: {
        copy: {
            tabIcons: cyberpunkThemeSurfaceDescriptor.tabIconVariant,
        },
    },
    widgets: { loaders: cyberpunkThemeSurfaceDescriptor.widgetLoaders },
    bootLoaders: {
        soft: './presentation/SoftBootLoader.jsx',
    },
});

export default cyberpunkThemeManifest;
