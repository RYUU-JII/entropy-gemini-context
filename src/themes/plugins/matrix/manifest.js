import { THEME_IDS } from '../../core/ids.js';
import { createThemeManifest } from '../../core/runtime/createThemeManifest.js';
import { MatrixTheme } from './theme.js';
import { matrixScheduleVisualPolicy } from './scheduleVisualPolicy.js';
import { matrixThemeSurfaceDescriptor } from './surfaceDescriptor.js';
import { matrixThemeProfileDefinition } from './profile.js';

export const matrixThemeManifest = createThemeManifest({
    id: THEME_IDS.MATRIX,
    theme: MatrixTheme,
    scheduleVisualPolicy: matrixScheduleVisualPolicy,
    profile: matrixThemeProfileDefinition,
    contracts: {
        copy: {
            tabIcons: matrixThemeSurfaceDescriptor.tabIconVariant,
        },
    },
    widgets: { loaders: matrixThemeSurfaceDescriptor.widgetLoaders },
    bootLoaders: {
        soft: './presentation/SoftBootLoader.jsx',
    },
});

export default matrixThemeManifest;
