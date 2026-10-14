import { THEME_IDS } from '../../core/ids.js';
import { createThemeManifest } from '../../core/runtime/createThemeManifest.js';
import { ZenTheme } from './theme.js';
import { zenScheduleVisualPolicy } from './scheduleVisualPolicy.js';
import { zenThemeSurfaceDescriptor } from './surfaceDescriptor.js';
import { zenThemeProfileDefinition } from './profile.js';

export const zenThemeManifest = createThemeManifest({
    id: THEME_IDS.ZEN,
    theme: ZenTheme,
    scheduleVisualPolicy: zenScheduleVisualPolicy,
    profile: zenThemeProfileDefinition,
    contracts: {
        copy: {
            tabIcons: zenThemeSurfaceDescriptor.tabIconVariant,
        },
    },
    widgets: { loaders: zenThemeSurfaceDescriptor.widgetLoaders },
    bootLoaders: {
        soft: './presentation/SoftBootLoader.jsx',
    },
    bootShells: {
        soft: './presentation/ZenSoftBootShell.js',
    },
});

export default zenThemeManifest;
