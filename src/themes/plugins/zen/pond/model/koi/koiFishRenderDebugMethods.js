import {
    drawKoiDebugVectors,
    drawKoiStatusOverlay,
} from '../../../../../../domains/nudge/koi/render/KoiRenderDebug.js';

const drawArrow = (ctx, ox, oy, dx, dy, color) => {
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) return;
    const nx = dx / len;
    const ny = dy / len;
    const hx = ox + dx;
    const hy = oy + dy;
    const headSize = Math.max(4, Math.min(10, len * 0.16));
    const px = -ny;
    const py = nx;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - nx * headSize + px * headSize * 0.6, hy - ny * headSize + py * headSize * 0.6);
    ctx.lineTo(hx - nx * headSize - px * headSize * 0.6, hy - ny * headSize - py * headSize * 0.6);
    ctx.closePath();
    ctx.fill();
};

const koiFishRenderDebugMethods = {
    drawStatusOverlay(ctx) {
        return drawKoiStatusOverlay(this, ctx);
    },

    drawDebugVectors(ctx, size = 12) {
        return drawKoiDebugVectors(this, ctx, size);
    },
};

export { koiFishRenderDebugMethods };
