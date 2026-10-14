// A transient Main registration ACK, never a settings or activity record.
export function normalizeZenKoiInvitationAssignment(value) {
    if (value === undefined || value === null) return null;
    if (typeof value.domain !== 'string' || !value.domain.trim()
        || typeof value.receiptId !== 'string' || !value.receiptId.trim()
        || typeof value.invitationEntityId !== 'string' || !value.invitationEntityId.trim()) {
        throw new Error('ZEN_KOI_INVITATION_ASSIGNMENT_INVALID');
    }
    return Object.freeze({ domain: value.domain.trim().toLowerCase(), receiptId: value.receiptId.trim(),
        invitationEntityId: value.invitationEntityId.trim() });
}
