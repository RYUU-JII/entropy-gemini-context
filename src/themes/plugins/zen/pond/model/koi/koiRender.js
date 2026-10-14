import { createKoiFishRenderAdapter } from '../../../../../../domains/nudge/koi/adapters/KoiFishRenderAdapter.js';
import { renderKoiWithAdapter } from '../../../../../../domains/nudge/koi/render/KoiRenderCore.js';

export function drawKoiFish(ctx, frameCount, isSelected, isHovered, eyeFB, eyeSP, envState = null) {
    return renderKoiWithAdapter(
        ctx,
        createKoiFishRenderAdapter(this),
        {
            frameCount,
            isSelected,
            isHovered,
            eyeFB,
            eyeSP,
            envState,
        }
    );
}
