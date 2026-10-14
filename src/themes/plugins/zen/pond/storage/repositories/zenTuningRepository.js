import {
    readZenPondTuning,
    writeZenPondTuning,
} from '../zenPondStorage.js';
import {
    readZenWorkspaceStorageItem,
    writeZenWorkspaceStorageItem,
} from '@/themes/plugins/zen/state/ZenProductionUiState.js';
import {
    DEFAULT_KOI_COLOR_STRATEGY,
    normalizeKoiColorStrategy,
    KOI_COLOR_STRATEGIES,
} from '../../model/koi/koiFaviconColorProfile.js';

const ZEN_SITE_KOI_COLOR_STRATEGY_STORAGE_KEY = 'zen_site_koi_color_strategy_v1';

const STRATEGY_OPTIONS = Object.freeze([
    KOI_COLOR_STRATEGIES.OFF,
    KOI_COLOR_STRATEGIES.DIRECT,
    KOI_COLOR_STRATEGIES.HYBRID,
    KOI_COLOR_STRATEGIES.BREED,
]);

const normalizeStrategy = (candidate) => {
    const normalized = normalizeKoiColorStrategy(candidate || DEFAULT_KOI_COLOR_STRATEGY);
    return STRATEGY_OPTIONS.includes(normalized)
        ? normalized
        : DEFAULT_KOI_COLOR_STRATEGY;
};

const readSiteKoiColorStrategy = () => {
    const current = readZenWorkspaceStorageItem(ZEN_SITE_KOI_COLOR_STRATEGY_STORAGE_KEY, null);
    if (typeof current === 'string' && current.trim()) {
        return normalizeStrategy(current);
    }
    return DEFAULT_KOI_COLOR_STRATEGY;
};

const writeSiteKoiColorStrategy = (strategy) => {
    const normalized = normalizeStrategy(strategy);
    writeZenWorkspaceStorageItem(ZEN_SITE_KOI_COLOR_STRATEGY_STORAGE_KEY, normalized);
    return normalized;
};

const readTuningSnapshot = () => readZenPondTuning();
const writeTuningSnapshot = (snapshot) => writeZenPondTuning(snapshot);

export {
    ZEN_SITE_KOI_COLOR_STRATEGY_STORAGE_KEY,
    STRATEGY_OPTIONS,
    normalizeStrategy,
    readTuningSnapshot,
    writeTuningSnapshot,
    readSiteKoiColorStrategy,
    writeSiteKoiColorStrategy,
};
