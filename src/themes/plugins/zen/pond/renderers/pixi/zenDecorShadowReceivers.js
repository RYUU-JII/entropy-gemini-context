import { projectZenPondShadow } from '../../runtime/zenPondShadowProjection.js';
import { resolveZenPondShadowGeometry } from '../../contracts/zenPondShadowGeometry.js';

// Surface flowers may shade the top of a nearby floating pad. Candidate
// receivers use their own height before overlap is tested; water stays Z=0.
export const selectZenFlowerShadowReceiver = ({ lilyPadPool, flowerGeometry, light, x, y, size }) => {
    let selected = null;
    for (const [pad, entry] of lilyPadPool) {
        const receiverGeometry = resolveZenPondShadowGeometry({ kind: 'lily', size: pad.size });
        const height = flowerGeometry.bodyTopZ - receiverGeometry.bodyTopZ;
        if (height <= 0) continue;
        const projection = projectZenPondShadow({ light, heightAboveReceiver: height, maxReach: size * 1.2 });
        const shadowX = x + projection.offsetX;
        const shadowY = y + projection.offsetY;
        const sprite = entry.sprite;
        const testX = pad.x + (shadowX - pad.x) / sprite.scale.x;
        const testY = pad.y + (shadowY - pad.y) / sprite.scale.y;
        if (!pad.containsWorldPoint(testX, testY)) continue;
        const distance = Math.hypot(shadowX - pad.x, shadowY - pad.y);
        if (!selected || distance < selected.distance) selected = { sprite, distance, x: shadowX, y: shadowY, projection, receiverGeometry };
    }
    return selected;
};
