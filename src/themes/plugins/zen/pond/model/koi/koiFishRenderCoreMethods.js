import { koiFishRenderDebugMethods } from './koiFishRenderDebugMethods.js';
import { koiFishRenderBodyCoreMethods } from './koiFishRenderBodyCoreMethods.js';
import { koiFishRenderPatternMethods } from './koiFishRenderPatternMethods.js';
import { drawKoiLabel } from '../../../../../../domains/nudge/koi/render/KoiRenderDecorations.js';

const koiFishRenderLabelMethods = {
    drawLabel(ctx, size) {
        return drawKoiLabel(this, ctx, size);
    },
};

const koiFishRenderCoreMethods = {
    ...koiFishRenderDebugMethods,
    ...koiFishRenderBodyCoreMethods,
    ...koiFishRenderPatternMethods,
    ...koiFishRenderLabelMethods,
};

export { koiFishRenderCoreMethods };
