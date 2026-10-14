export const THEME_IDS = Object.freeze({
    MATRIX: 'matrix',
    ENTROPY: 'entropy',
    CYBERPUNK: 'cyberpunk',
    CLINICAL: 'clinical',
    SCP: 'scp',
    ZEN: 'zen',
});

export const DEFAULT_THEME_ID = THEME_IDS.ZEN;

const CANONICAL_IDS = new Set(Object.values(THEME_IDS));

export const THEME_ID_ERROR_CODES = Object.freeze({
    INVALID: 'THEME_ID_INVALID',
});

export function createThemeIdError(code, message, details = {}) {
    const error = new Error(message);
    error.code = code;
    error.details = details && typeof details === 'object' ? { ...details } : {};
    return error;
}

export function normalizeThemeId(themeId, fallback = DEFAULT_THEME_ID) {
    if (typeof themeId !== 'string') return fallback;
    const raw = themeId.trim().toLowerCase();
    if (!raw) return fallback;
    if (CANONICAL_IDS.has(raw)) return raw;
    return fallback;
}

export function canonicalizeThemeIdInput(themeId, fallback = DEFAULT_THEME_ID) {
    return normalizeThemeId(themeId, fallback);
}

export function assertCanonicalThemeId(themeId, context = 'theme runtime') {
    if (
        typeof themeId === 'string'
        && themeId.trim() === themeId
        && themeId.toLowerCase() === themeId
        && CANONICAL_IDS.has(themeId)
    ) {
        return themeId;
    }

    throw createThemeIdError(
        THEME_ID_ERROR_CODES.INVALID,
        `[ThemeId] ${context} requires a canonical theme id.`,
        {
            themeId,
            context,
            canonicalIds: getCanonicalThemeIds(),
        },
    );
}

export function isCanonicalThemeId(themeId) {
    return CANONICAL_IDS.has(themeId);
}

export function getCanonicalThemeIds() {
    return [...CANONICAL_IDS];
}
