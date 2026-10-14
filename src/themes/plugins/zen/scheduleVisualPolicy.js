import { THEME_IDS } from '../../core/ids.js';
import {
    SCHEDULE_RECIPE_VARIANTS,
    SCHEDULE_TEXTURE_BLEND_MODES,
    createScheduleVisualPolicy,
} from '../../core/schedule/policyContract.js';
import { SCHEDULE_TEXTURES } from '../../core/schedule/textureLibrary.js';

export const zenScheduleVisualPolicy = createScheduleVisualPolicy({
    themeId: THEME_IDS.ZEN,
    recipes: {
        shell: SCHEDULE_RECIPE_VARIANTS.shell.EDGE_TO_EDGE,
        heading: SCHEDULE_RECIPE_VARIANTS.heading.IDENTITY_AXIS,
        status: SCHEDULE_RECIPE_VARIANTS.status.STAGE_META,
        rhythmIdentity: SCHEDULE_RECIPE_VARIANTS.rhythmIdentity.BOOKMARKS,
        timeline: SCHEDULE_RECIPE_VARIANTS.timeline.OPEN_CUT,
        workbench: SCHEDULE_RECIPE_VARIANTS.workbench.ATTACHED_PAPER,
        utilities: SCHEDULE_RECIPE_VARIANTS.utilities.WORKBENCH,
        specialSession: SCHEDULE_RECIPE_VARIANTS.specialSession.PAPER_POPOVER,
    },
    typography: {
        // Layer 2 (--font-theme-*) only. Reaching past it to the app-base
        // --font-sans/--font-heading/--font-mono would bypass this theme's
        // own typography tokens.
        body: 'var(--font-theme-ui)',
        label: 'var(--font-theme-ui)',
        title: 'var(--font-theme-heading)',
        time: 'var(--font-theme-mono)',
        titleLetterSpacing: '-0.02em',
    },
    tokens: {
        canvas: 'var(--color-background)',
        pageBackground: 'transparent',
        panelBackground: 'var(--color-surface)',
        stageSurface: 'var(--color-surface)',
        stageHighlight: 'var(--color-surface-elevated)',
        stageDepth: 'var(--color-surface-sunken)',
        stageEdge: 'var(--color-border)',
        stageRidge: 'var(--color-border-strong)',
        timeFieldSurface: 'var(--color-surface-sunken)',
        workbenchSurface: 'var(--color-surface)',
        workbenchSelectedSurface: 'color-mix(in srgb, var(--color-surface) 78%, var(--color-surface-sunken))',
        workbenchSeam: 'var(--color-border)',
        inkPrimary: 'var(--color-on-surface)',
        inkMuted: 'var(--color-on-surface-muted)',
        relaxationWash: '#738D78',
        relaxationInk: 'var(--color-primary)',
        currentMarker: '#747D72',
        focusMarker: '#9D7E47',
        isolationInk: '#35473A',
        danger: '#8C3131',
        onDarkInk: '#FFFFFF',
        shadowInk: 'var(--zen-ambient-cast-shadow)',
        panelControlSurface: 'var(--color-surface-elevated)',
    },
    timeline: {
        textureImage: SCHEDULE_TEXTURES.PAPER,
        // The PAPER tile already carries opacity 0.09 inside its own SVG rect, so
        // this factor multiplies on top of it; below ~0.10 the washi grain lands
        // under one 8-bit level and renders as nothing.
        textureOpacity: 0.12,
        textureSize: '180px 180px',
        textureBlendMode: SCHEDULE_TEXTURE_BLEND_MODES.MULTIPLY,
        idleBlockOpacity: 16,
        selectedBlockOpacity: 32,
    },
});
