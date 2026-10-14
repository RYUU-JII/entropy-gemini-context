import { ZEN_RAIN_BUCKET_COUNT, ZEN_RAIN_STREAKS_PER_BUCKET, packZenRainBucketVertices } from './zenRainStreakGeometry.js';
import { createZenRainStreakRuntime, resolveZenBonsaiRainInputs } from './zenRainStreakRuntime.js';

export function createZenRainCanvas() {
    const runtime = createZenRainStreakRuntime();
    const positions = new Float32Array(ZEN_RAIN_STREAKS_PER_BUCKET * 8);
    function draw(ctx, activeTimeSec, pixelRatio) {
        if (!ctx || typeof ctx.fill !== 'function' || !Number.isFinite(pixelRatio) || pixelRatio <= 0) {
            throw Error('ZEN_RAIN_CANVAS_CONTEXT_INVALID');
        }
        runtime.sample(activeTimeSec);
        if (runtime.weather.totalCount === 0 || !runtime.state.visibility.includes(1)) return;
        ctx.save();
        try {
            ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            for (let bucket = 0; bucket < ZEN_RAIN_BUCKET_COUNT; bucket++) {
                const count = packZenRainBucketVertices(runtime.weather.counts, runtime.state, bucket, positions);
                if (count === 0) continue;
                const color = runtime.weather.colors[bucket];
                ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
                ctx.globalAlpha = runtime.weather.opacity[bucket]; ctx.beginPath();
                for (let index = 0; index < count; index++) {
                    const offset = index * 8;
                    ctx.moveTo(positions[offset], positions[offset + 1]);
                    for (let corner = 1; corner < 4; corner++) ctx.lineTo(positions[offset + corner * 2], positions[offset + corner * 2 + 1]);
                    ctx.closePath();
                }
                ctx.fill();
            }
        } finally { ctx.restore(); }
    }
    return { setInputs: runtime.setInputs, draw, receipt: runtime.receipt, dispose: runtime.dispose };
}

// Explicit Canvas render species can also be used by local previews. Their
// renderer lifetime owns the context entry and releases it before its clock resets.
const canvases = new WeakMap();
export function drawZenBonsaiRainCanvas(ctx, { presentation, seed, options, pixelRatio, activeTimeSec }) {
    let rain = canvases.get(ctx);
    if (!rain) { rain = createZenRainCanvas(); canvases.set(ctx, rain); }
    rain.setInputs(resolveZenBonsaiRainInputs({ presentation, seed, options,
        pixelWidth: ctx.canvas.width, pixelHeight: ctx.canvas.height, pixelRatio }));
    rain.draw(ctx, activeTimeSec, pixelRatio);
}

export function releaseZenBonsaiRainCanvas(ctx) {
    const rain = canvases.get(ctx);
    if (!rain) return;
    rain.dispose();
    canvases.delete(ctx);
}
