// Presentation membership only. Registration capacity belongs to progression.
export function normalizeZenKoiInvitationSlots(value) {
    if (!Array.isArray(value)) throw new Error('ZEN_KOI_INVITATION_SLOTS_REQUIRED');
    const identities = new Set();
    return value.map(slot => {
        if (!slot || typeof slot.entityId !== 'string' || !slot.entityId.trim()
            || !['resident', 'bank'].includes(slot.arrivalMode)
            || identities.has(slot.entityId.trim())) {
            throw new Error('ZEN_KOI_INVITATION_SLOT_INVALID');
        }
        identities.add(slot.entityId.trim());
        return Object.freeze({ entityId: slot.entityId.trim(), arrivalMode: slot.arrivalMode });
    });
}

export function normalizeZenKoiInvitationArrivalMode(value) {
    if (!['resident', 'bank'].includes(value)) throw new Error('ZEN_KOI_INVITATION_ARRIVAL_MODE_INVALID');
    return value;
}

export function normalizeZenKoiInvitationEntityIds(value) {
    if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !id.trim())
        || new Set(value.map(id => id.trim())).size !== value.length) throw new Error('ZEN_KOI_INVITATION_MEMBERSHIP_INVALID');
    return value.map(id => id.trim());
}
