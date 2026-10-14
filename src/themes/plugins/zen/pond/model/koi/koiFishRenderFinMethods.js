import {
    drawKoiPectoralFins,
    drawKoiTailFin,
} from '../../../../../../domains/nudge/koi/render/KoiRenderFins.js';

const koiFishRenderFinMethods = {
    drawPectoralFins(ctx, x, y, angle, size, r, isMain, bend = 0, idx = 0, isShadow = false) {
        return drawKoiPectoralFins(this, ctx, x, y, angle, size, r, isMain, bend, idx, isShadow);
    },

    drawTailFin(ctx, pos, size, isShadow = false) {
        return drawKoiTailFin(this, ctx, pos, size, isShadow);
    }
};

export { koiFishRenderFinMethods };
