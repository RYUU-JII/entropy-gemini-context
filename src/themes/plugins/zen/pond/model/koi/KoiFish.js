import { drawKoiFish } from './koiRender.js';
import { koiFishRenderMethods } from './koiFishRenderMethods.js';
import { KoiSimulationFish } from './KoiSimulationFish.js';

class KoiFish extends KoiSimulationFish {
    draw(ctx, frameCount, isSelected, isHovered, eyeFB, eyeSP, envState = null) {
        return drawKoiFish.call(
            this,
            ctx,
            frameCount,
            isSelected,
            isHovered,
            eyeFB,
            eyeSP,
            envState,
        );
    }
}

Object.assign(KoiFish.prototype, koiFishRenderMethods);

export { KoiFish };
