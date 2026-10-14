import { THEME_IDS } from '../../core/ids.js';
import { createThemeManifest } from '../../core/runtime/createThemeManifest.js';
import { EntropyTheme } from './theme.js';
import { entropyScheduleVisualPolicy } from './scheduleVisualPolicy.js';
import { entropyThemeSurfaceDescriptor } from './surfaceDescriptor.js';
import { entropyThemeProfileDefinition } from './profile.js';

export const entropyThemeManifest = createThemeManifest({
    id: THEME_IDS.ENTROPY,
    theme: EntropyTheme,
    scheduleVisualPolicy: entropyScheduleVisualPolicy,
    profile: entropyThemeProfileDefinition,
    contracts: {
        copy: {
            tabIcons: entropyThemeSurfaceDescriptor.tabIconVariant,
        },
    },
    widgets: { loaders: entropyThemeSurfaceDescriptor.widgetLoaders },
    bootLoaders: {
        soft: './presentation/SoftBootLoader.jsx',
    },
});

export default entropyThemeManifest;
