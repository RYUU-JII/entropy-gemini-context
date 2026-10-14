// Presentation-only identity. The sentinel has no site, breed or stored activity.
export const ZEN_SHADOW_SENTINEL_ROLE = 'shadow_sentinel';

export function normalizeZenKoiPresentationRole(value) {
    if (value === undefined || value === null) return null;
    if (value !== ZEN_SHADOW_SENTINEL_ROLE) throw new Error('ZEN_KOI_PRESENTATION_ROLE_INVALID');
    return value;
}
