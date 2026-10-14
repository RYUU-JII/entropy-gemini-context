import React from 'react';

import {
    HomeIcon,
    LightningIcon,
    ToolCaseIcon,
    CalendarIcon,
    GearIcon,
    SlidersIcon,
    SunIcon,
    ClipboardIcon,
    ProtocolsIcon,
    ClockIcon,
    FlaskIcon,
    MicroscopeIcon,
    EyeIcon,
    GlobeIcon,
    CalendarClockIcon,
} from '../../../ui-kit/Icons.jsx';
import ZenNavigationSigil from './ZenNavigationSigil.jsx';
import { getThemeSurfaceDescriptorStrict } from '../runtime/surfaceDescriptorCatalog.js';

/**
 * Get tab icons for a theme.
 * Returns an object map of React Elements.
 */
const STANDARD_TAB_ICONS = Object.freeze({
    main: <HomeIcon />,
    experiment: <FlaskIcon />,
    sites: <GlobeIcon />,
    schedule: <CalendarClockIcon />,
    filter: <SlidersIcon />,
    tools: <ToolCaseIcon />,
    settings: <GearIcon />,
    theme: <SunIcon />,
});

const CLINICAL_TAB_ICONS = Object.freeze({
    main: <ClipboardIcon />,
    experiment: <FlaskIcon />,
    sites: <MicroscopeIcon />,
    schedule: <ClockIcon />,
    filter: <SlidersIcon />,
    tools: <ToolCaseIcon />,
    settings: <ProtocolsIcon />,
    theme: <EyeIcon />,
});

const ZEN_TAB_ICONS = Object.freeze({
    main: <ZenNavigationSigil tabId="main" />,
    experiment: <ZenNavigationSigil tabId="experiment" />,
    sites: <ZenNavigationSigil tabId="sites" />,
    schedule: <ZenNavigationSigil tabId="schedule" />,
    filter: <ZenNavigationSigil tabId="filter" />,
    tools: <ZenNavigationSigil tabId="tools" />,
    settings: <ZenNavigationSigil tabId="settings" />,
    theme: <ZenNavigationSigil tabId="theme" />,
});

const TAB_ICON_VARIANTS = Object.freeze({
    standard: STANDARD_TAB_ICONS,
    clinical: CLINICAL_TAB_ICONS,
    zen: ZEN_TAB_ICONS,
});

function resolveTabIconVariant(themeId) {
    const descriptor = getThemeSurfaceDescriptorStrict(themeId, 'theme tab icons');
    const variantId = descriptor.tabIconVariant;

    if (
        typeof variantId !== 'string'
        || !Object.prototype.hasOwnProperty.call(TAB_ICON_VARIANTS, variantId)
    ) {
        const error = new Error(`THEME_TAB_ICON_VARIANT_UNSUPPORTED:${descriptor.id}:${String(variantId)}`);
        error.code = 'THEME_TAB_ICON_VARIANT_UNSUPPORTED';
        error.themeId = descriptor.id;
        error.variantId = variantId;
        throw error;
    }

    const variant = TAB_ICON_VARIANTS[variantId];
    const missingTabId = Object.keys(STANDARD_TAB_ICONS).find((tabId) => !React.isValidElement(variant[tabId]));
    if (missingTabId) {
        const error = new Error(
            `THEME_TAB_ICON_VARIANT_INVALID:${descriptor.id}:${variantId}:${missingTabId}`,
        );
        error.code = 'THEME_TAB_ICON_VARIANT_INVALID';
        error.themeId = descriptor.id;
        error.variantId = variantId;
        error.tabId = missingTabId;
        throw error;
    }

    return variant;
}

export function getTabIcons(themeId) {
    const declaredVariant = resolveTabIconVariant(themeId);
    return Object.fromEntries(
        Object.keys(STANDARD_TAB_ICONS).map((tabId) => [tabId, declaredVariant[tabId]]),
    );
}
