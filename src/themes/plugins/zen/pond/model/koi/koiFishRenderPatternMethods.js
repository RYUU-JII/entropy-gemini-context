import {
    drawKoiDoitsuZipper,
    drawKoiDorsalFin,
    drawKoiDorsalSpines,
    drawKoiGinrinSparkle,
    drawKoiPattern,
    drawKoiScars,
} from '../../../../../../domains/nudge/koi/render/KoiRenderDecorations.js';

const koiFishRenderPatternMethods = {
    drawPattern(ctx, size) {
        return drawKoiPattern(this, ctx, size);
    },

    drawDoitsuZipper(ctx, size) {
        return drawKoiDoitsuZipper(this, ctx, size);
    },

    drawGinrinSparkle(ctx, size) {
        return drawKoiGinrinSparkle(this, ctx, size);
    },

    drawDorsalSpines(ctx, size) {
        return drawKoiDorsalSpines(this, ctx, size);
    },

    drawScars(ctx, size) {
        return drawKoiScars(this, ctx, size);
    },

    drawDorsalFin(ctx, size) {
        return drawKoiDorsalFin(this, ctx, size);
    },
};

export { koiFishRenderPatternMethods };
