// Home's native editor and the worker's invitation movement share the visible
// water aperture, rather than the surrounding sky or dashboard rectangle.
export const ZEN_POND_REGISTRATION_PRESENTATION = Object.freeze({
    fish: Object.freeze({ x: 0.5, y: 0.28 }),
    editor: Object.freeze({ x: 0.5, y: 0.42 }),
    editorTopCss: 'min(42%, max(76px, calc(100% - 260px)))',
});

export function resolveZenPondRegistrationPresentation({ width, height }) {
    if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        throw new Error('ZEN_POND_REGISTRATION_VIEWPORT_INVALID');
    }
    const editorY = Math.min(height * 0.42, Math.max(76, height - 260)) / height;
    return Object.freeze({
        fish: Object.freeze({ x: 0.5, y: Math.max(0.10, Math.min(0.28, editorY - 0.14)) }),
        editor: Object.freeze({ x: 0.5, y: editorY }),
        editorTopCss: ZEN_POND_REGISTRATION_PRESENTATION.editorTopCss,
    });
}

export function normalizeZenPondRegistrationEntityId(value) {
    if (value === null) return null;
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error('ZEN_POND_REGISTRATION_ENTITY_ID_INVALID');
    }
    return value.trim();
}

export function resolveZenPondRegistrationFishAnchor(bounds, presentation = ZEN_POND_REGISTRATION_PRESENTATION) {
    if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
        || bounds.width <= 0 || bounds.height <= 0) {
        throw new Error('ZEN_POND_REGISTRATION_BOUNDS_INVALID');
    }
    return {
        x: bounds.x + bounds.width * presentation.fish.x,
        y: bounds.y + bounds.height * presentation.fish.y,
    };
}

// A restrained waiting circuit preserves the fish's existing motor, momentum
// and spine. The native editor stays fixed while the selected shadow settles.
export function resolveZenPondRegistrationFishTarget(bounds, behaviorTick, presentation = ZEN_POND_REGISTRATION_PRESENTATION) {
    if (!Number.isFinite(behaviorTick) || behaviorTick < 0) {
        throw new Error('ZEN_POND_REGISTRATION_CLOCK_INVALID');
    }
    const anchor = resolveZenPondRegistrationFishAnchor(bounds, presentation);
    const radius = Math.min(26, bounds.width * 0.045, bounds.height * 0.035);
    const phase = behaviorTick * 0.006;
    return {
        x: anchor.x + Math.cos(phase) * radius,
        y: anchor.y + Math.sin(phase) * radius * 0.55,
        tangentX: -Math.sin(phase),
        tangentY: Math.cos(phase) * 0.55,
        tangentInfluence: 0.25,
        radiusReference: radius,
    };
}
