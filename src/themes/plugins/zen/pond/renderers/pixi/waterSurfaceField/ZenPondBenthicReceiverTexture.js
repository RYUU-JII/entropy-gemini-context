import {
    SCALE_MODES,
    Texture,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';

import {
    requireZenPondBathymetryField,
    sampleZenPondBottomDepth,
} from '../../../world/fields/zenPondBathymetryField.js';
import {
    ZEN_POND_CAUSTIC_RECEIVER_MODEL_IDS,
} from '../../../contracts/zenPondCausticPresentation.js';

export const ZEN_POND_BENTHIC_RECEIVER_MODEL_ID =
    ZEN_POND_CAUSTIC_RECEIVER_MODEL_IDS
        .BATHYMETRY_DEPTH_NORMAL;

const NORMAL_RELIEF_GAIN = 1.8;

const clamp = (value, min, max) => (
    Math.min(max, Math.max(min, value))
);

const encodeUnit = (value) => (
    Math.round(clamp(value, 0, 1) * 255)
);

const encodeSignedUnit = (value) => (
    encodeUnit(value * 0.5 + 0.5)
);

const resolveSampleCoordinate = (
    index,
    count,
    worldExtent,
) => (
    (index / Math.max(1, count - 1)) * worldExtent
);

const sampleGridDepth = ({
    field,
    column,
    row,
}) => sampleZenPondBottomDepth(
    field,
    resolveSampleCoordinate(
        column,
        field.columns,
        field.worldWidth,
    ),
    resolveSampleCoordinate(
        row,
        field.rows,
        field.worldHeight,
    ),
);

export const buildZenPondBenthicReceiverPixels = ({
    bathymetryField,
} = {}) => {
    const field = requireZenPondBathymetryField(
        bathymetryField,
    );
    const width = field.columns;
    const height = field.rows;
    const pixels = new Uint8Array(width * height * 4);
    const aspect = field.worldWidth / field.worldHeight;
    let minimumDepth = 1;
    let maximumDepth = 0;
    let maximumEncodedSlope = 0;

    for (let row = 0; row < height; row += 1) {
        const rowBefore = Math.max(0, row - 1);
        const rowAfter = Math.min(height - 1, row + 1);
        const vSpan = Math.max(
            1 / Math.max(1, height - 1),
            (rowAfter - rowBefore) / Math.max(1, height - 1),
        );
        for (let column = 0; column < width; column += 1) {
            const columnBefore = Math.max(0, column - 1);
            const columnAfter = Math.min(width - 1, column + 1);
            const uSpan = Math.max(
                1 / Math.max(1, width - 1),
                (columnAfter - columnBefore) / Math.max(1, width - 1),
            );
            const depth = sampleGridDepth({
                field,
                column,
                row,
            });
            const depthLeft = sampleGridDepth({
                field,
                column: columnBefore,
                row,
            });
            const depthRight = sampleGridDepth({
                field,
                column: columnAfter,
                row,
            });
            const depthUp = sampleGridDepth({
                field,
                column,
                row: rowBefore,
            });
            const depthDown = sampleGridDepth({
                field,
                column,
                row: rowAfter,
            });
            const gradientX = (
                (depthRight - depthLeft) / uSpan
            ) / aspect;
            const gradientY = (
                depthDown - depthUp
            ) / vSpan;
            const normalLength = Math.hypot(
                gradientX * NORMAL_RELIEF_GAIN,
                gradientY * NORMAL_RELIEF_GAIN,
                1,
            );
            // Bottom elevation is -depth: its upward normal is (+grad depth, 1).
            const normalX = (
                gradientX * NORMAL_RELIEF_GAIN
            ) / normalLength;
            const normalY = (
                gradientY * NORMAL_RELIEF_GAIN
            ) / normalLength;
            const offset = (row * width + column) * 4;
            pixels[offset] = encodeUnit(depth);
            pixels[offset + 1] = encodeSignedUnit(normalX);
            pixels[offset + 2] = encodeSignedUnit(normalY);
            // The canonical world crop is entirely navigable pond bottom.
            // Dynamic non-receivers remain above the benthic-light layer.
            pixels[offset + 3] = 255;
            minimumDepth = Math.min(minimumDepth, depth);
            maximumDepth = Math.max(maximumDepth, depth);
            maximumEncodedSlope = Math.max(
                maximumEncodedSlope,
                Math.hypot(normalX, normalY),
            );
        }
    }

    return Object.freeze({
        modelId: ZEN_POND_BENTHIC_RECEIVER_MODEL_ID,
        bathymetryKey: field.key,
        bathymetryFingerprint: field.fingerprint,
        width,
        height,
        pixels,
        rawTextureBytes: pixels.byteLength,
        minimumDepth,
        maximumDepth,
        maximumEncodedSlope,
    });
};

export const createZenPondBenthicReceiverTexture = ({
    bathymetryField,
} = {}) => {
    const built = buildZenPondBenthicReceiverPixels({
        bathymetryField,
    });
    const texture = Texture.fromBuffer(
        built.pixels,
        built.width,
        built.height,
        {
            scaleMode: SCALE_MODES.LINEAR,
        },
    );
    return Object.freeze({
        texture,
        metadata: built,
    });
};
