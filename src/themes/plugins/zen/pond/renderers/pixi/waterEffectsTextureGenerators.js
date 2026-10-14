import { createCanvas2d } from './waterEffects/textureBake/canvas2d.js';

const TAU = Math.PI * 2;
export const resolveVisibleWrappedOffsets = (coordinate, extent, size) => {
    const offsets = [];
    if ((coordinate + extent) >= size) offsets.push(-size);
    offsets.push(0);
    if ((coordinate - extent) <= 0) offsets.push(size);
    return offsets;
};

const forEachVisibleWrappedPosition = ({
    x,
    y,
    extent,
    size,
    draw,
}) => {
    const xOffsets = resolveVisibleWrappedOffsets(x, extent, size);
    const yOffsets = resolveVisibleWrappedOffsets(y, extent, size);
    for (let xIndex = 0; xIndex < xOffsets.length; xIndex += 1) {
        for (let yIndex = 0; yIndex < yOffsets.length; yIndex += 1) {
            draw(xOffsets[xIndex], yOffsets[yIndex]);
        }
    }
};

const drawWrappedEllipseGradient = ({
    ctx,
    size,
    x,
    y,
    radius,
    stretchX,
    stretchY,
    rotation,
    stops,
}) => {
    const extent = radius * Math.max(stretchX, stretchY);
    forEachVisibleWrappedPosition({
        x,
        y,
        extent,
        size,
        draw: (ox, oy) => {
            ctx.save();
            ctx.translate(x + ox, y + oy);
            ctx.rotate(rotation);
            ctx.scale(stretchX, stretchY);
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            for (let i = 0; i < stops.length; i += 1) {
                const stop = stops[i];
                gradient.addColorStop(stop[0], stop[1]);
            }
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, TAU);
            ctx.fill();
            ctx.restore();
        },
    });
};

// Utility to generate a seamless caustic noise texture
export function generateCausticTexture(size = 512) {
    const { canvas, ctx } = createCanvas2d(size, size, { alpha: false });
    if (!canvas || !ctx) return null;
    const sizeScale = size / 512;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    const macroCount = Math.max(80, Math.round(170 * sizeScale * sizeScale));
    for (let i = 0; i < macroCount; i += 1) {
        drawWrappedEllipseGradient({
            ctx,
            size,
            x: Math.random() * size,
            y: Math.random() * size,
            radius: (22 + Math.random() * 26) * sizeScale,
            stretchX: 0.68 + Math.random() * 1.05,
            stretchY: 0.62 + Math.random() * 0.94,
            rotation: Math.random() * TAU,
            stops: [
                [0, 'rgba(0, 0, 0, 0.98)'],
                [0.48, 'rgba(0, 0, 0, 0.62)'],
                [1, 'rgba(0, 0, 0, 0)'],
            ],
        });
    }

    const microCount = Math.max(180, Math.round(320 * sizeScale * sizeScale));
    for (let i = 0; i < microCount; i += 1) {
        drawWrappedEllipseGradient({
            ctx,
            size,
            x: Math.random() * size,
            y: Math.random() * size,
            radius: (8 + Math.random() * 14) * sizeScale,
            stretchX: 0.72 + Math.random() * 0.75,
            stretchY: 0.72 + Math.random() * 0.75,
            rotation: Math.random() * TAU,
            stops: [
                [0, 'rgba(0, 0, 0, 0.92)'],
                [0.42, 'rgba(0, 0, 0, 0.5)'],
                [1, 'rgba(0, 0, 0, 0)'],
            ],
        });
    }

    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    ctx.globalCompositeOperation = 'multiply';
    const densityClouds = Math.max(14, Math.round(24 * sizeScale * sizeScale));
    for (let i = 0; i < densityClouds; i += 1) {
        drawWrappedEllipseGradient({
            ctx,
            size,
            x: Math.random() * size,
            y: Math.random() * size,
            radius: (80 + Math.random() * 140) * sizeScale,
            stretchX: 0.72 + Math.random() * 0.8,
            stretchY: 0.68 + Math.random() * 0.86,
            rotation: Math.random() * TAU,
            stops: [
                [0, 'rgba(0, 0, 0, 0.14)'],
                [1, 'rgba(0, 0, 0, 0)'],
            ],
        });
    }

    ctx.globalCompositeOperation = 'screen';
    const ridgeHighlights = Math.max(40, Math.round(70 * sizeScale * sizeScale));
    for (let i = 0; i < ridgeHighlights; i += 1) {
        drawWrappedEllipseGradient({
            ctx,
            size,
            x: Math.random() * size,
            y: Math.random() * size,
            radius: (10 + Math.random() * 24) * sizeScale,
            stretchX: 1.2 + Math.random() * 1.8,
            stretchY: 0.4 + Math.random() * 0.3,
            rotation: Math.random() * TAU,
            stops: [
                [0, 'rgba(255, 255, 255, 0.15)'],
                [0.55, 'rgba(255, 255, 255, 0.05)'],
                [1, 'rgba(255, 255, 255, 0)'],
            ],
        });
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.fillRect(0, 0, size, size);

    return canvas;
}

// Utility to generate a subtle riverbed/pebble texture
export function generatePebbleTexture(size = 512, options = {}) {
    const { canvas, ctx } = createCanvas2d(size, size, { alpha: false });
    if (!canvas || !ctx) return null;

    const style = typeof options?.style === 'string'
        ? options.style.trim().toLowerCase()
        : 'primary';
    const isDetailStyle = style === 'detail' || style === 'micro';
    const sizeScale = size / 512;
    ctx.fillStyle = isDetailStyle ? '#261F19' : '#2A221B';
    ctx.fillRect(0, 0, size, size);

    const reliefCount = Math.round((isDetailStyle ? 24 : 32) * sizeScale * sizeScale);
    for (let i = 0; i < reliefCount; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = (isDetailStyle ? (38 + Math.random() * 70) : (54 + Math.random() * 110)) * sizeScale;
        const brighten = Math.random() < 0.48;
        drawWrappedEllipseGradient({
            ctx,
            size,
            x,
            y,
            radius: r,
            stretchX: 0.7 + Math.random() * 0.95,
            stretchY: 0.6 + Math.random() * 0.98,
            rotation: Math.random() * TAU,
            stops: brighten
                ? [
                    [0, isDetailStyle ? 'rgba(255, 248, 236, 0.04)' : 'rgba(255, 248, 236, 0.058)'],
                    [1, 'rgba(255, 248, 236, 0)'],
                ]
                : [
                    [0, isDetailStyle ? 'rgba(6, 5, 4, 0.05)' : 'rgba(6, 5, 4, 0.068)'],
                    [1, 'rgba(6, 5, 4, 0)'],
                ],
        });
    }

    // Wrapped low-frequency tint clouds for a seamless non-flat base.
    const cloudCount = Math.round((isDetailStyle ? 18 : 26) * sizeScale * sizeScale);
    for (let i = 0; i < cloudCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = (isDetailStyle ? (20 + Math.random() * 30) : (26 + Math.random() * 48)) * sizeScale;
        const tint = Math.random() < 0.5
            ? (isDetailStyle ? 'rgba(255, 250, 242, 0.015)' : 'rgba(255, 250, 242, 0.02)')
            : (isDetailStyle ? 'rgba(8, 6, 5, 0.02)' : 'rgba(8, 6, 5, 0.024)');
        forEachVisibleWrappedPosition({
            x,
            y,
            extent: r,
            size,
            draw: (ox, oy) => {
                const cx = x + ox;
                const cy = y + oy;
                const g = ctx.createRadialGradient(cx, cy, r * 0.14, cx, cy, r);
                g.addColorStop(0, tint);
                g.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
            },
        });
    }

    const macroTones = isDetailStyle
        ? ['#322A22', '#3E352D', '#463D33', '#2E2620']
        : ['#3A3129', '#4A4037', '#5B5147', '#342C25'];
    const microTones = isDetailStyle
        ? ['#3B3229', '#463C33', '#554B3F', '#342C25']
        : ['#41372E', '#51473D', '#62584D', '#383029'];

    const drawPebble = (x, y, r, scaleX, scaleY, rotation, color, pebbleStyle) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, r * scaleX, r * scaleY, rotation, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(0, 0, 0, ${pebbleStyle.shadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(
            x + (r * 0.14),
            y + (r * 0.16),
            r * scaleX * 0.64,
            r * scaleY * 0.56,
            rotation,
            0,
            Math.PI * 2,
        );
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 255, ${pebbleStyle.highlightAlpha})`;
        ctx.beginPath();
        ctx.ellipse(
            x - (r * 0.22),
            y - (r * 0.2),
            r * scaleX * 0.36,
            r * scaleY * 0.32,
            rotation,
            0,
            Math.PI * 2,
        );
        ctx.fill();

        if (r > (7.5 * sizeScale)) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${pebbleStyle.rimAlpha})`;
            ctx.lineWidth = Math.max(0.35, r * 0.045);
            ctx.beginPath();
            ctx.ellipse(x, y, r * scaleX * 0.96, r * scaleY * 0.96, rotation, 0, Math.PI * 2);
            ctx.stroke();
        }
    };

    const layers = [
        {
            count: Math.round((isDetailStyle ? 110 : 160) * sizeScale * sizeScale),
            radiusMin: (isDetailStyle ? 6.2 : 8.5) * sizeScale,
            radiusMax: (isDetailStyle ? 16.4 : 22) * sizeScale,
            tones: macroTones,
            style: isDetailStyle
                ? { shadowAlpha: 0.1, highlightAlpha: 0.05, rimAlpha: 0.06 }
                : { shadowAlpha: 0.11, highlightAlpha: 0.055, rimAlpha: 0.08 },
        },
        {
            count: Math.round((isDetailStyle ? 760 : 520) * sizeScale * sizeScale),
            radiusMin: (isDetailStyle ? 1.4 : 2.2) * sizeScale,
            radiusMax: (isDetailStyle ? 6.4 : 8.2) * sizeScale,
            tones: microTones,
            style: isDetailStyle
                ? { shadowAlpha: 0.08, highlightAlpha: 0.04, rimAlpha: 0.03 }
                : { shadowAlpha: 0.085, highlightAlpha: 0.045, rimAlpha: 0.04 },
        },
    ];

    // Draw the center plus only seam copies whose bounds can reach this tile.
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
        const layer = layers[layerIndex];
        for (let i = 0; i < layer.count; i += 1) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const radiusRange = layer.radiusMax - layer.radiusMin;
            const r = layer.radiusMin + (Math.random() * radiusRange);
            const scaleX = 0.76 + Math.random() * 0.52;
            const scaleY = 0.74 + Math.random() * 0.54;
            const rotation = Math.random() * Math.PI;
            const color = layer.tones[Math.floor(Math.random() * layer.tones.length)];
            const wrapExtent = r * Math.max(scaleX, scaleY)
                + Math.max(0.35, r * 0.045);
            forEachVisibleWrappedPosition({
                x,
                y,
                extent: wrapExtent,
                size,
                draw: (ox, oy) => {
                    drawPebble(
                        x + ox,
                        y + oy,
                        r,
                        scaleX,
                        scaleY,
                        rotation,
                        color,
                        layer.style,
                    );
                },
            });
        }
    }

    // Fine sediment dots reduce "flat texture" look while staying seamless.
    const sedimentCount = Math.round((isDetailStyle ? 1800 : 1400) * sizeScale * sizeScale);
    for (let i = 0; i < sedimentCount; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 0.3 + Math.random() * 0.8;
        const alpha = 0.014 + Math.random() * 0.016;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        forEachVisibleWrappedPosition({
            x,
            y,
            extent: r,
            size,
            draw: (ox, oy) => {
                ctx.beginPath();
                ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
                ctx.fill();
            },
        });
    }

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = isDetailStyle ? 'rgba(0, 0, 0, 0.055)' : 'rgba(0, 0, 0, 0.072)';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'screen';
    const reliefHighlightCount = Math.round((isDetailStyle ? 12 : 16) * sizeScale * sizeScale);
    for (let i = 0; i < reliefHighlightCount; i += 1) {
        drawWrappedEllipseGradient({
            ctx,
            size,
            x: Math.random() * size,
            y: Math.random() * size,
            radius: (isDetailStyle ? (40 + Math.random() * 60) : (56 + Math.random() * 92)) * sizeScale,
            stretchX: 0.62 + Math.random() * 0.72,
            stretchY: 0.64 + Math.random() * 0.74,
            rotation: Math.random() * TAU,
            stops: [
                [0, isDetailStyle ? 'rgba(255, 252, 244, 0.024)' : 'rgba(255, 252, 244, 0.032)'],
                [1, 'rgba(255, 252, 244, 0)'],
            ],
        });
    }
    ctx.globalCompositeOperation = 'source-over';

    return canvas;
}
