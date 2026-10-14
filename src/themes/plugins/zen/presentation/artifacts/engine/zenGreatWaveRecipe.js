// Constants for Seigaiha Geometry
const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 220;
const FRAME_WIDTH = 332;
const FRAME_HEIGHT = 232;
const WAVE_RX = 36;
const WAVE_RY = 22; // Height radius
const WAVE_STROKE_WIDTH = 1.6;
const WAVE_RINGS = 4;
const FILL_BLEED_X = 1.7;
const FILL_BLEED_Y = 1.2;

// Grid Configuration
const ROWS = 20;
const COLS = 7;
const X_PACK = 0.9;
const BOTTOM_ROW_GAP = WAVE_RY * 0.48;
const TOP_ROW_GAP = WAVE_RY * 0.38;
const WAVE_LAYER_SHIFT_Y = BOTTOM_ROW_GAP + WAVE_RY;

// Tone Configuration (darken only, no depth transparency)
const TOP_DARKEN = 0.33;
const BOTTOM_DARKEN = 0.04;

// Animation Parameters
const BOB_DISTANCE_ACTIVE = 3;
const BOB_DISTANCE_IDLE = 1.1;
const BOB_DURATION_ACTIVE = 3.6;
const BOB_DURATION_IDLE = 6.8;

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const hexToRgb = (value) => {
    if (typeof value !== 'string') return null;
    const hex = value.trim().replace('#', '');
    if (!/^[\da-fA-F]{3}([\da-fA-F]{3})?$/.test(hex)) return null;

    const fullHex = hex.length === 3
        ? hex.split('').map((char) => char + char).join('')
        : hex;

    return {
        r: parseInt(fullHex.slice(0, 2), 16),
        g: parseInt(fullHex.slice(2, 4), 16),
        b: parseInt(fullHex.slice(4, 6), 16),
    };
};

const withAlpha = (value, alpha, fallback = `rgba(148, 163, 184, ${alpha})`) => {
    const rgb = hexToRgb(value);
    if (!rgb) return fallback;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const darkenHexColor = (value, amount) => {
    const rgb = hexToRgb(value);
    if (!rgb) return value;

    const t = 1 - clamp01(amount);
    const r = Math.round(rgb.r * t);
    const g = Math.round(rgb.g * t);
    const b = Math.round(rgb.b * t);
    return `rgb(${r} ${g} ${b})`;
};

export function createZenGreatWaveGrid({ color: renderColor, isActive: renderIsActive }) {
        const grid = [];
        const xSpacing = (WAVE_RX * 2) * X_PACK;
        const baseColor = renderIsActive ? renderColor : '#94a3b8';
        const rowYs = new Array(ROWS);
        const bobDistance = renderIsActive ? BOB_DISTANCE_ACTIVE : BOB_DISTANCE_IDLE;
        const bottomAnchorY = VIEWBOX_HEIGHT + bobDistance + WAVE_STROKE_WIDTH + WAVE_LAYER_SHIFT_Y;

        // Bottom-most wave remains visible even at peak upward bob.
        rowYs[ROWS - 1] = bottomAnchorY;
        for (let r = ROWS - 2; r >= 0; r--) {
            const fromBottom = (ROWS - 2) - r;
            const progress = ROWS <= 2 ? 0 : fromBottom / (ROWS - 2);
            const gap = BOTTOM_ROW_GAP + ((TOP_ROW_GAP - BOTTOM_ROW_GAP) * progress);
            rowYs[r] = rowYs[r + 1] - gap;
        }

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const xOffset = (row % 2) * (xSpacing / 2);
                const x = (col * xSpacing) + xOffset - WAVE_RX - 1;
                const y = rowYs[row];
                const depthFactor = ROWS <= 1 ? 1 : row / (ROWS - 1);
                const topBias = 1 - depthFactor;
                const darkenAmount = BOTTOM_DARKEN + ((TOP_DARKEN - BOTTOM_DARKEN) * topBias);
                const strokeColor = darkenHexColor(baseColor, darkenAmount);

                const delay = (row * 0.2) + (col * 0.1);

                grid.push({
                    id: `${row}-${col}`,
                    x,
                    y,
                    delay,
                    strokeColor,
                    strokeWidth: WAVE_STROKE_WIDTH * (0.9 + depthFactor * 0.35),
                });
            }
        }
        return grid;
}

export { VIEWBOX_WIDTH, VIEWBOX_HEIGHT, FRAME_WIDTH, FRAME_HEIGHT, WAVE_RX, WAVE_RY, WAVE_RINGS, FILL_BLEED_X, FILL_BLEED_Y, BOB_DISTANCE_ACTIVE, BOB_DISTANCE_IDLE, BOB_DURATION_ACTIVE, BOB_DURATION_IDLE, withAlpha };
