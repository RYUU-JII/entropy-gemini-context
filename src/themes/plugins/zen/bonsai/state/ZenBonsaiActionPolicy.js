export const ZEN_BONSAI_ACTION_VISIBILITY = Object.freeze({
    HIDDEN: 'hidden',
    CEREMONIAL: 'ceremonial',
});

const normalizeRerollGrant = (grant = null) => {
    if (!grant || typeof grant !== 'object') {
        return null;
    }
    return {
        available: grant.available === true,
        reason: typeof grant.reason === 'string' ? grant.reason : 'unspecified',
        tokenId: typeof grant.tokenId === 'string' ? grant.tokenId : '',
    };
};

export const resolveZenBonsaiActionPolicy = ({
    rerollGrant = null,
    developmentReroll = false,
} = {}) => {
    const grant = normalizeRerollGrant(rerollGrant);
    const rerollAvailable = developmentReroll === true || grant?.available === true;

    return Object.freeze({
        reroll: Object.freeze({
            available: rerollAvailable,
            visibility: rerollAvailable
                ? ZEN_BONSAI_ACTION_VISIBILITY.CEREMONIAL
                : ZEN_BONSAI_ACTION_VISIBILITY.HIDDEN,
            reason: rerollAvailable
                ? (grant?.reason || 'development')
                : 'no_grant',
            tokenId: grant?.tokenId || '',
        }),
    });
};

export default resolveZenBonsaiActionPolicy;
