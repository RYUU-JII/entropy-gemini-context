import { isScheduleVisualPolicy } from '../schedule/policyContract.js';

export const BASE_THEME_PROFILE = Object.freeze({
    previewMode: 'light',
    bootLoaderVariant: 'soft',
    fallbackBackground: null,
    rangeInputStyle: 'default',
    nudgePreset: 'default',
    dashboard: Object.freeze({
        tabTransition: 'quiet',
    }),
    experiment: Object.freeze({
        enableBonsaiVNext: false,
        enableBonsaiRenderDebug: false,
        signalScannerInput: 'targets',
    }),
    friction: Object.freeze({
        gatekeeperStyle: 'entropy',
        gatekeeperCopy: 'default',
        disruptionStyle: 'entropy',
    }),
    selectorMetrics: Object.freeze({
        contrast: 'STD',
        saturation: 'STD',
        spectrum: 'BASE',
    }),
    main: Object.freeze({
        layout: 'default',
        allowExpandScanner: false,
        enableKoiTuner: false,
        signalScannerInput: 'targets',
        parkSignalScannerRuntimeOnUnmount: false,
        homeBottomVariant: 'brief-card',
        embeddedCoreStatusVariant: 'default',
    }),
    sites: Object.freeze({
        globalCapVariant: 'standard',
        targetPanelVariant: 'standard',
        workspaceVariant: 'standard',
        noticeVariant: 'standard',
    }),
    settings: Object.freeze({
        chromeVariant: 'standard',
    }),
    tools: Object.freeze({
        // 'quickbar': named tiles in a band below the scene.
        // 'path': walked one step at a time; stepping stones float inside the scene.
        galleryIndexVariant: 'quickbar',
    }),
    widgets: Object.freeze({
        main: null,
    }),
});

const REQUIRED_COPY_CONTRACT_FIELDS = Object.freeze([
    'tabIcons',
]);

export function createThemeProfile(id, profile = {}) {
    const merged = {
        ...BASE_THEME_PROFILE,
        ...profile,
        dashboard: {
            ...BASE_THEME_PROFILE.dashboard,
            ...(profile.dashboard || {}),
        },
        experiment: {
            ...BASE_THEME_PROFILE.experiment,
            ...(profile.experiment || {}),
        },
        friction: {
            ...BASE_THEME_PROFILE.friction,
            ...(profile.friction || {}),
        },
        selectorMetrics: {
            ...BASE_THEME_PROFILE.selectorMetrics,
            ...(profile.selectorMetrics || {}),
        },
        main: {
            ...BASE_THEME_PROFILE.main,
            ...(profile.main || {}),
        },
        sites: {
            ...BASE_THEME_PROFILE.sites,
            ...(profile.sites || {}),
        },
        settings: {
            ...BASE_THEME_PROFILE.settings,
            ...(profile.settings || {}),
        },
        tools: {
            ...BASE_THEME_PROFILE.tools,
            ...(profile.tools || {}),
        },
        widgets: {
            ...BASE_THEME_PROFILE.widgets,
            ...(profile.widgets || {}),
        },
    };

    if (!merged.widgets.main) {
        merged.widgets.main = id;
    }

    return Object.freeze({
        ...merged,
        dashboard: Object.freeze(merged.dashboard),
        experiment: Object.freeze(merged.experiment),
        friction: Object.freeze(merged.friction),
        selectorMetrics: Object.freeze(merged.selectorMetrics),
        main: Object.freeze(merged.main),
        sites: Object.freeze(merged.sites),
        settings: Object.freeze(merged.settings),
        tools: Object.freeze(merged.tools),
        widgets: Object.freeze(merged.widgets),
    });
}

function buildContracts(id, contracts) {
    if (!contracts || typeof contracts !== 'object' || Array.isArray(contracts)) {
        throw new Error(`[ThemeManifest] Theme '${id}' must declare contracts.`);
    }
    const copy = contracts.copy;
    if (!copy || typeof copy !== 'object' || Array.isArray(copy)) {
        throw new Error(`[ThemeManifest] Theme '${id}' must declare contracts.copy.`);
    }
    for (const field of REQUIRED_COPY_CONTRACT_FIELDS) {
        if (typeof copy[field] !== 'string' || !copy[field].trim()) {
            throw new Error(`[ThemeManifest] Theme '${id}' must declare contracts.copy.${field}.`);
        }
    }
    for (const field of Object.keys(copy)) {
        if (!REQUIRED_COPY_CONTRACT_FIELDS.includes(field)) {
            throw new Error(`[ThemeManifest] Theme '${id}' declares unsupported contracts.copy.${field}.`);
        }
    }

    return Object.freeze({
        ...contracts,
        copy: Object.freeze({ ...copy }),
    });
}

function freezeWidgetCapability(widgets = {}) {
    if (Object.prototype.hasOwnProperty.call(widgets || {}, 'fallbacks')) {
        throw new Error('[ThemeManifest] widgets.fallbacks is forbidden. Declare explicit plugin-owned loaders instead.');
    }
    const loaders = Object.freeze({
        ...(widgets.loaders || {}),
    });
    return Object.freeze({
        loaders,
    });
}

function freezeBootLoaderCapability(bootLoaders = {}) {
    if (Object.prototype.hasOwnProperty.call(bootLoaders || {}, 'fallbacks')) {
        throw new Error('[ThemeManifest] bootLoaders.fallbacks is forbidden. Declare explicit plugin-owned boot loaders instead.');
    }
    return Object.freeze({
        ...(bootLoaders || {}),
    });
}

function freezeBootShellCapability(bootShells = {}) {
    if (Object.prototype.hasOwnProperty.call(bootShells || {}, 'fallbacks')) {
        throw new Error('[ThemeManifest] bootShells.fallbacks is forbidden. Declare explicit plugin-owned boot shells instead.');
    }
    return Object.freeze({
        ...(bootShells || {}),
    });
}

function requireScheduleVisualPolicy(id, scheduleVisualPolicy) {
    if (!scheduleVisualPolicy || typeof scheduleVisualPolicy !== 'object') {
        throw new Error(`[ThemeManifest] Theme '${id}' must declare scheduleVisualPolicy.`);
    }
    if (!isScheduleVisualPolicy(scheduleVisualPolicy)) {
        throw new Error(
            `[ThemeManifest] Theme '${id}' scheduleVisualPolicy must be created by createScheduleVisualPolicy.`,
        );
    }
    if (scheduleVisualPolicy.themeId !== id) {
        throw new Error(
            `[ThemeManifest] Schedule visual policy id mismatch: manifest='${id}', policy='${scheduleVisualPolicy.themeId}'.`,
        );
    }
    return scheduleVisualPolicy;
}

export function createThemeManifest({
    id,
    theme,
    profile,
    contracts,
    scheduleVisualPolicy,
    widgets = {},
    bootLoaders = {},
    bootShells = {},
} = {}) {
    if (!id) throw new Error('[ThemeManifest] Missing id');
    if (!theme) throw new Error(`[ThemeManifest] Missing theme object for '${id}'`);
    if (theme.id !== id) {
        throw new Error(`[ThemeManifest] Theme id mismatch: manifest='${id}', theme='${theme.id}'`);
    }

    const builtProfile = createThemeProfile(id, profile);
    const frozenBootLoaders = freezeBootLoaderCapability(bootLoaders);
    const frozenBootShells = freezeBootShellCapability(bootShells);
    const activeBootLoaderVariant = typeof builtProfile?.bootLoaderVariant === 'string' && builtProfile.bootLoaderVariant.trim()
        ? builtProfile.bootLoaderVariant.trim()
        : BASE_THEME_PROFILE.bootLoaderVariant;
    if (typeof frozenBootLoaders[activeBootLoaderVariant] !== 'string' || !frozenBootLoaders[activeBootLoaderVariant].trim()) {
        throw new Error(`[ThemeManifest] Theme '${id}' must declare boot loader variant '${activeBootLoaderVariant}'.`);
    }

    return Object.freeze({
        id,
        theme,
        profile: builtProfile,
        contracts: buildContracts(id, contracts),
        scheduleVisualPolicy: requireScheduleVisualPolicy(id, scheduleVisualPolicy),
        widgets: freezeWidgetCapability(widgets),
        bootLoaders: frozenBootLoaders,
        bootShells: frozenBootShells,
    });
}
