export const ZEN_KOI_ENTITY_KINDS = Object.freeze({
    SITE: 'site',
    INVITATION: 'invitation',
    VISION: 'vision',
});

export const ZEN_KOI_INTERACTION_ACTIONS = Object.freeze({
    REGISTER_PROTECTED_SITE: 'register_protected_site',
});

export const ZEN_INVITATION_KOI_ENTITY_ID = 'zen_invitation_koi';

export const normalizeZenKoiEntityKind = (value, {
    fallback = ZEN_KOI_ENTITY_KINDS.SITE,
} = {}) => (
    Object.values(ZEN_KOI_ENTITY_KINDS).includes(value)
        ? value
        : fallback
);

export const normalizeZenKoiInteractionAction = (value) => (
    Object.values(ZEN_KOI_INTERACTION_ACTIONS).includes(value)
        ? value
        : null
);
