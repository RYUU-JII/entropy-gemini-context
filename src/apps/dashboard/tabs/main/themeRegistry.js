import { assertCanonicalThemeId } from '@/themes/core/ids.js';
import { getThemeSurfaceDescriptorStrict } from '@/themes/core/surfaceDescriptor.js';

export const resolveMainWidgetThemeId = (themeId) => {
    const descriptor = getThemeSurfaceDescriptorStrict(
        themeId,
        'dashboard main widget descriptor',
    );
    return assertCanonicalThemeId(
        descriptor.mainWidgetThemeId,
        'dashboard main widget theme',
    );
};
