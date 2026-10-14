import {
    assertCanonicalThemeId,
    createThemeIdError,
} from '../ids.js';
import { clinicalThemeSurfaceDescriptor } from '../../plugins/clinical/surfaceDescriptor.js';
import { cyberpunkThemeSurfaceDescriptor } from '../../plugins/cyberpunk/surfaceDescriptor.js';
import { entropyThemeSurfaceDescriptor } from '../../plugins/entropy/surfaceDescriptor.js';
import { matrixThemeSurfaceDescriptor } from '../../plugins/matrix/surfaceDescriptor.js';
import { scpThemeSurfaceDescriptor } from '../../plugins/scp/surfaceDescriptor.js';
import { zenThemeSurfaceDescriptor } from '../../plugins/zen/surfaceDescriptor.js';

const THEME_SURFACE_DESCRIPTOR_LIST = Object.freeze([
    matrixThemeSurfaceDescriptor,
    entropyThemeSurfaceDescriptor,
    cyberpunkThemeSurfaceDescriptor,
    clinicalThemeSurfaceDescriptor,
    scpThemeSurfaceDescriptor,
    zenThemeSurfaceDescriptor,
]);

const THEME_SURFACE_DESCRIPTOR_MAP = Object.freeze(
    THEME_SURFACE_DESCRIPTOR_LIST.reduce((acc, descriptor) => {
        if (acc[descriptor.id]) {
            throw new Error(`THEME_SURFACE_DESCRIPTOR_DUPLICATE:${descriptor.id}`);
        }
        acc[descriptor.id] = descriptor;
        return acc;
    }, {}),
);

for (const descriptor of THEME_SURFACE_DESCRIPTOR_LIST) {
    if (!THEME_SURFACE_DESCRIPTOR_MAP[descriptor.mainWidgetThemeId]) {
        throw new Error(
            `THEME_SURFACE_MAIN_WIDGET_OWNER_MISSING:${descriptor.id}:${descriptor.mainWidgetThemeId}`,
        );
    }
}

export const THEME_SURFACE_DESCRIPTOR_ERROR_CODES = Object.freeze({
    MISSING: 'THEME_SURFACE_DESCRIPTOR_MISSING',
});

export function getThemeSurfaceDescriptorList() {
    return THEME_SURFACE_DESCRIPTOR_LIST;
}

export function getThemeSurfaceDescriptorMap() {
    return THEME_SURFACE_DESCRIPTOR_MAP;
}

export function assertThemeSurfaceDescriptorId(
    themeId,
    context = 'theme surface descriptor runtime',
) {
    const resolvedThemeId = assertCanonicalThemeId(themeId, context);
    if (THEME_SURFACE_DESCRIPTOR_MAP[resolvedThemeId]) {
        return resolvedThemeId;
    }

    throw createThemeIdError(
        THEME_SURFACE_DESCRIPTOR_ERROR_CODES.MISSING,
        `[ThemeSurfaceDescriptor] ${context} references an unregistered theme surface descriptor.`,
        {
            themeId: resolvedThemeId,
            context,
            registeredThemeIds: Object.keys(THEME_SURFACE_DESCRIPTOR_MAP),
        },
    );
}

export function getThemeSurfaceDescriptorStrict(
    themeId,
    context = 'theme surface descriptor runtime',
) {
    return THEME_SURFACE_DESCRIPTOR_MAP[
        assertThemeSurfaceDescriptorId(themeId, context)
    ];
}

export function hasDeclaredThemeWidget(themeId, widgetType) {
    const descriptor = getThemeSurfaceDescriptorStrict(
        themeId,
        'theme widget capability lookup',
    );
    if (typeof widgetType !== 'string' || !widgetType.trim()) return false;
    return Object.prototype.hasOwnProperty.call(
        descriptor.widgetLoaders,
        widgetType.trim(),
    );
}
