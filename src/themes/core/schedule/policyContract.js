import { assertCanonicalThemeId } from '../ids.js';

export const SCHEDULE_VISUAL_POLICY_SCHEMA_VERSION = 1;
const declaredScheduleVisualPolicies = new WeakSet();

export const SCHEDULE_RECIPE_VARIANTS = Object.freeze({
    shell: Object.freeze({
        EDGE_TO_EDGE: 'edge_to_edge',
        FRAMED: 'framed',
    }),
    heading: Object.freeze({
        PAGE_HEADER: 'page_header',
        SIDEBAR_OWNED: 'sidebar_owned',
        IDENTITY_AXIS: 'identity_axis',
    }),
    status: Object.freeze({
        PAGE_HEADER: 'page_header',
        STAGE_META: 'stage_meta',
    }),
    rhythmIdentity: Object.freeze({
        BOOKMARKS: 'bookmarks',
        COUNTED_TABS: 'counted_tabs',
    }),
    timeline: Object.freeze({
        FRAMED_TRACK: 'framed_track',
        OPEN_CUT: 'open_cut',
    }),
    workbench: Object.freeze({
        ATTACHED_PAPER: 'attached_paper',
        STANDARD_PANEL: 'standard_panel',
    }),
    utilities: Object.freeze({
        FLOATING: 'floating',
        WORKBENCH: 'workbench',
    }),
    specialSession: Object.freeze({
        FLOATING_CARD: 'floating_card',
        PAPER_POPOVER: 'paper_popover',
    }),
});

export const SCHEDULE_TEXTURE_BLEND_MODES = Object.freeze({
    MULTIPLY: 'multiply',
    NORMAL: 'normal',
    SCREEN: 'screen',
});

const REQUIRED_RECIPE_FIELDS = Object.freeze({
    shell: Object.values(SCHEDULE_RECIPE_VARIANTS.shell),
    heading: Object.values(SCHEDULE_RECIPE_VARIANTS.heading),
    status: Object.values(SCHEDULE_RECIPE_VARIANTS.status),
    rhythmIdentity: Object.values(SCHEDULE_RECIPE_VARIANTS.rhythmIdentity),
    timeline: Object.values(SCHEDULE_RECIPE_VARIANTS.timeline),
    workbench: Object.values(SCHEDULE_RECIPE_VARIANTS.workbench),
    utilities: Object.values(SCHEDULE_RECIPE_VARIANTS.utilities),
    specialSession: Object.values(SCHEDULE_RECIPE_VARIANTS.specialSession),
});

const REQUIRED_TYPOGRAPHY_FIELDS = Object.freeze([
    'body',
    'label',
    'title',
    'time',
    'titleLetterSpacing',
]);

const REQUIRED_TOKEN_FIELDS = Object.freeze([
    'canvas',
    'pageBackground',
    'panelBackground',
    'stageSurface',
    'stageHighlight',
    'stageDepth',
    'stageEdge',
    'stageRidge',
    'timeFieldSurface',
    'workbenchSurface',
    'workbenchSelectedSurface',
    'workbenchSeam',
    'inkPrimary',
    'inkMuted',
    'relaxationWash',
    'relaxationInk',
    'currentMarker',
    'focusMarker',
    'isolationInk',
    'danger',
    'onDarkInk',
    'shadowInk',
    'panelControlSurface',
]);

const REQUIRED_TIMELINE_FIELDS = Object.freeze([
    'textureImage',
    'textureSize',
    'textureOpacity',
    'textureBlendMode',
    'idleBlockOpacity',
    'selectedBlockOpacity',
]);

const REQUIRED_POLICY_FIELDS = Object.freeze([
    'themeId',
    'recipes',
    'typography',
    'tokens',
    'timeline',
]);

function failInvalidField(themeId, field) {
    throw new Error(`SCHEDULE_VISUAL_POLICY_FIELD_INVALID:${themeId}:${field}`);
}

function requireRecord(value, themeId, field) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        failInvalidField(themeId, field);
    }
    return value;
}

function requireStringFields(record, fields, themeId, prefix) {
    for (const field of fields) {
        if (typeof record[field] !== 'string' || !record[field].trim()) {
            failInvalidField(themeId, `${prefix}.${field}`);
        }
    }
}

function requireExactFields(record, fields, themeId, prefix) {
    const allowedFields = new Set(fields);
    for (const field of Object.keys(record)) {
        if (!allowedFields.has(field)) {
            failInvalidField(themeId, `${prefix}.${field}`);
        }
    }
}

function requireFiniteNumber(record, field, themeId, prefix) {
    if (!Number.isFinite(record[field])) {
        failInvalidField(themeId, `${prefix}.${field}`);
    }
}

function requirePercent(record, field, themeId, prefix) {
    requireFiniteNumber(record, field, themeId, prefix);
    const value = record[field];
    if (value < 0 || value > 100) {
        failInvalidField(themeId, `${prefix}.${field}`);
    }
}

function requireRatio(record, field, themeId, prefix) {
    requireFiniteNumber(record, field, themeId, prefix);
    if (record[field] < 0 || record[field] > 1) {
        failInvalidField(themeId, `${prefix}.${field}`);
    }
}

function requireNullableString(record, field, themeId, prefix) {
    if (record[field] !== null && (typeof record[field] !== 'string' || !record[field].trim())) {
        failInvalidField(themeId, `${prefix}.${field}`);
    }
}

function validateRecipes(recipes, themeId) {
    const resolved = requireRecord(recipes, themeId, 'recipes');
    requireExactFields(resolved, Object.keys(REQUIRED_RECIPE_FIELDS), themeId, 'recipes');
    for (const [field, allowedValues] of Object.entries(REQUIRED_RECIPE_FIELDS)) {
        if (!allowedValues.includes(resolved[field])) {
            failInvalidField(themeId, `recipes.${field}`);
        }
    }
    return Object.freeze({ ...resolved });
}

export function resolveScheduleRecipeVariant(recipeName, variant, cases) {
    const declaredVariants = REQUIRED_RECIPE_FIELDS[recipeName];
    if (!declaredVariants) {
        throw new Error(`SCHEDULE_RECIPE_AXIS_UNSUPPORTED:${String(recipeName)}`);
    }
    if (!cases || typeof cases !== 'object' || Array.isArray(cases)) {
        throw new Error(`SCHEDULE_RECIPE_CASES_INVALID:${recipeName}`);
    }
    for (const caseVariant of Object.keys(cases)) {
        if (!declaredVariants.includes(caseVariant)) {
            throw new Error(`SCHEDULE_RECIPE_CASE_UNDECLARED:${recipeName}:${caseVariant}`);
        }
    }
    for (const declaredVariant of declaredVariants) {
        if (typeof cases[declaredVariant] !== 'function') {
            throw new Error(`SCHEDULE_RECIPE_VARIANT_UNHANDLED:${recipeName}:${declaredVariant}`);
        }
    }
    if (!declaredVariants.includes(variant)) {
        throw new Error(`SCHEDULE_RECIPE_VARIANT_UNSUPPORTED:${recipeName}:${String(variant)}`);
    }
    return cases[variant]();
}

function validateTimeline(timeline, themeId) {
    const resolved = requireRecord(timeline, themeId, 'timeline');
    requireExactFields(resolved, REQUIRED_TIMELINE_FIELDS, themeId, 'timeline');
    requireNullableString(resolved, 'textureImage', themeId, 'timeline');
    requireNullableString(resolved, 'textureSize', themeId, 'timeline');
    requireRatio(resolved, 'textureOpacity', themeId, 'timeline');
    if (!Object.values(SCHEDULE_TEXTURE_BLEND_MODES).includes(resolved.textureBlendMode)) {
        failInvalidField(themeId, 'timeline.textureBlendMode');
    }
    requirePercent(resolved, 'idleBlockOpacity', themeId, 'timeline');
    requirePercent(resolved, 'selectedBlockOpacity', themeId, 'timeline');
    if (
        resolved.textureImage === null
        && (
            resolved.textureSize !== null
            || resolved.textureOpacity !== 0
            || resolved.textureBlendMode !== SCHEDULE_TEXTURE_BLEND_MODES.NORMAL
        )
    ) {
        failInvalidField(themeId, 'timeline.textureImage');
    }
    if (resolved.selectedBlockOpacity < resolved.idleBlockOpacity) {
        failInvalidField(themeId, 'timeline.selectedBlockOpacity');
    }
    return Object.freeze({
        textureImage: resolved.textureImage,
        textureSize: resolved.textureSize,
        textureOpacity: resolved.textureOpacity,
        textureBlendMode: resolved.textureBlendMode,
        idleBlockOpacity: resolved.idleBlockOpacity,
        selectedBlockOpacity: resolved.selectedBlockOpacity,
    });
}

export function createScheduleVisualPolicy(declaration = {}) {
    const canonicalThemeId = assertCanonicalThemeId(
        declaration?.themeId,
        'schedule visual policy declaration',
    );
    const resolvedDeclaration = requireRecord(declaration, canonicalThemeId, 'policy');
    requireExactFields(
        resolvedDeclaration,
        REQUIRED_POLICY_FIELDS,
        canonicalThemeId,
        'policy',
    );
    const {
        recipes,
        typography,
        tokens,
        timeline,
    } = resolvedDeclaration;

    const resolvedTypography = requireRecord(typography, canonicalThemeId, 'typography');
    requireExactFields(
        resolvedTypography,
        REQUIRED_TYPOGRAPHY_FIELDS,
        canonicalThemeId,
        'typography',
    );
    requireStringFields(
        resolvedTypography,
        REQUIRED_TYPOGRAPHY_FIELDS,
        canonicalThemeId,
        'typography',
    );

    const resolvedTokens = requireRecord(tokens, canonicalThemeId, 'tokens');
    requireExactFields(resolvedTokens, REQUIRED_TOKEN_FIELDS, canonicalThemeId, 'tokens');
    requireStringFields(resolvedTokens, REQUIRED_TOKEN_FIELDS, canonicalThemeId, 'tokens');

    const policy = Object.freeze({
        schemaVersion: SCHEDULE_VISUAL_POLICY_SCHEMA_VERSION,
        themeId: canonicalThemeId,
        recipes: validateRecipes(recipes, canonicalThemeId),
        typography: Object.freeze({ ...resolvedTypography }),
        tokens: Object.freeze({ ...resolvedTokens }),
        timeline: validateTimeline(timeline, canonicalThemeId),
    });
    declaredScheduleVisualPolicies.add(policy);
    return policy;
}

export function isScheduleVisualPolicy(value) {
    return !!value
        && typeof value === 'object'
        && declaredScheduleVisualPolicies.has(value);
}
