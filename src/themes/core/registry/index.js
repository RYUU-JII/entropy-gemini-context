import { assertThemeSurfaceDescriptorId } from '../runtime/surfaceDescriptorCatalog.js';
import {
    WIDGETS,
    getWidget,
    getWidgetChunkState,
    preloadWidgetChunk,
} from '../loaders/widgets.js';

export const getThemeWidget = (themeId, widgetType) => {
    const resolvedThemeId = assertThemeSurfaceDescriptorId(themeId, 'theme widget registry');
    return getWidget(resolvedThemeId, widgetType);
};

export const preloadThemeWidgetChunk = (themeId, widgetType) => {
    const resolvedThemeId = assertThemeSurfaceDescriptorId(themeId, 'theme widget preload registry');
    return preloadWidgetChunk(resolvedThemeId, widgetType);
};

export const getThemeWidgetChunkState = (themeId, widgetType) => {
    const resolvedThemeId = assertThemeSurfaceDescriptorId(
        themeId,
        'theme widget preload state registry',
    );
    return getWidgetChunkState(resolvedThemeId, widgetType);
};

export { WIDGETS };
