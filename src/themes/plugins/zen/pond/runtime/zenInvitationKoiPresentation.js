// The unnamed invitation stays above Home's unboxed, water-local entry.
// Spawn and locomotion share these world-space bounds, including after resize.
export function resolveZenInvitationKoiBounds(bounds) {
    return {
        x: (bounds.x ?? 0) + bounds.width * 0.28,
        y: (bounds.y ?? 0) + bounds.height * 0.10,
        width: bounds.width * 0.44,
        height: bounds.height * 0.36,
        padding: Math.min(bounds.padding ?? 58, bounds.width * 0.08, bounds.height * 0.08),
    };
}

// Bank-arriving successors keep the pond rectangle after arrival.
export function resolveZenInvitationKoiPatrolBounds(bounds, usePondBounds) {
    if (typeof usePondBounds !== 'boolean') throw new Error('ZEN_INVITATION_PATROL_MODE_REQUIRED');
    return usePondBounds ? bounds : resolveZenInvitationKoiBounds(bounds);
}
