import {
    drawKoiBodyDirectionalShade,
    drawKoiBodyShape,
    drawKoiEyeSimple,
} from '../../../../../../domains/nudge/koi/render/KoiRenderBody.js';

// Visual trial: let pond koi read as part of the flow rather than a watching face.
// Set false to restore the original eyes after visual review.
const ZEN_KOI_EYELESS_TRIAL = true;

const koiFishRenderBodyCoreMethods = {
    drawBodyShape(ctx, size, isShadow, eyeFB, eyeSP, bodyGeometry = null, envState = null) {
        return drawKoiBodyShape(this, ctx, size, isShadow, eyeFB, eyeSP, bodyGeometry, envState);
    },

    drawBodyDirectionalShade(ctx, size, path, leftPoints, rightPoints, envState = null) {
        return drawKoiBodyDirectionalShade(this, ctx, size, path, leftPoints, rightPoints, envState);
    },

    drawEyeSimple(ctx, size, eyeFB, eyeSP) {
        if (ZEN_KOI_EYELESS_TRIAL) return;
        return drawKoiEyeSimple(this, ctx, size, eyeFB, eyeSP);
    },
};

export { koiFishRenderBodyCoreMethods };
