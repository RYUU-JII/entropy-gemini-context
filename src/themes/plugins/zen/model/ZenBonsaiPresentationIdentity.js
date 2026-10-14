import {
    createInitialZenBonsaiProfileActiveIdentityInput,
    normalizeZenBonsaiProfileActiveIdentity,
} from './ZenBonsaiProfileAggregateModel.js';
import {
    isZenBonsaiFirstVisionPresentation,
} from './ZenBonsaiPresentationPolicy.js';

export const ZEN_BONSAI_FIRST_VISION_PRESENTATION_IDENTITY = (
    normalizeZenBonsaiProfileActiveIdentity({
        ...createInitialZenBonsaiProfileActiveIdentityInput({ treeSeed: 0 }),
        identityRevision: 1,
    })
);

export function resolveZenBonsaiPresentationIdentity(input = null) {
    if (isZenBonsaiFirstVisionPresentation(input)) {
        return ZEN_BONSAI_FIRST_VISION_PRESENTATION_IDENTITY;
    }
    return null;
}

export default resolveZenBonsaiPresentationIdentity;
