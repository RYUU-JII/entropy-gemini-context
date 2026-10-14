/**
 * The shared paper surface, as a Pixi filter.
 *
 * The Canvas2D pass composites the paper tooth with `globalCompositeOperation
 * = 'overlay'` and then lays a flat veil of the scene's mid tone over the
 * result. Neither step can be reproduced by stacking sprites: Pixi's advanced
 * blend modes are framebuffer approximations, not the Porter-Duff-plus-separable
 * blend the canvas specifies, and the measured difference is a uniform tone
 * shift across the whole picture — small per pixel, obvious side by side.
 *
 * A filter can express it exactly, because it gets the finished composite as a
 * texture and can apply the real formula:
 *
 *     overlay(b, s) = 2·b·s                    where b < 0.5
 *                     1 − 2·(1 − b)·(1 − s)    otherwise
 *
 * mixed in by the tile's alpha, then the veil mixed in by its own. That is the
 * canvas pass line for line, which is the point: one paper, two backends.
 */

import {
    Filter,
} from '@/themes/plugins/zen/runtime/worker/zenPixiWorkerRuntime.js';
import { resolveZenPixiOwnedShaderSources } from './zenPixiOwnedShaderDialect.js';

const FRAGMENT = `
// highp, not mediump: Pixi's default filter vertex stage declares the shared
// inputSize / outputFrame uniforms at high precision, and a fragment stage that
// declares them lower fails to link - silently, as a blank surface.
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uPaper;
uniform vec4 inputSize;
uniform vec4 outputFrame;
uniform float uTileSize;
uniform float uTileAlpha;
uniform float uVeilAlpha;
uniform vec3 uVeilColor;

void main(void) {
    vec4 source = texture2D(uSampler, vTextureCoord);
    if (source.a <= 0.0) {
        // Nothing was painted here. The canvas pass clips the paper to what was
        // actually drawn for the same reason: the layout leaves a transparent
        // bridge toward the pond, and papering it would draw a rectangle.
        gl_FragColor = source;
        return;
    }
    // Pixi textures are premultiplied; the blend formula is defined on straight
    // colour.
    vec3 base = source.rgb / source.a;

    // Tile in surface pixels so the grain does not slide when the filter's own
    // frame moves.
    vec2 surfacePixel = vTextureCoord * inputSize.xy + outputFrame.xy;
    vec3 tooth = texture2D(uPaper, surfacePixel / uTileSize).rgb;

    vec3 low = 2.0 * base * tooth;
    vec3 high = 1.0 - 2.0 * (1.0 - base) * (1.0 - tooth);
    vec3 overlaid = mix(low, high, step(vec3(0.5), base));

    vec3 grained = mix(base, overlaid, uTileAlpha);
    vec3 veiled = mix(grained, uVeilColor, uVeilAlpha);

    gl_FragColor = vec4(veiled * source.a, source.a);
}
`;

/**
 * @param {object} options.paperTexture Pixi texture of the paper tile, wrapped
 *                                      REPEAT so the shader can tile it.
 * @param {number} options.tileSize     tile edge in surface pixels
 * @param {number} options.tileAlpha    how far the grain is mixed in
 * @param {number} options.veilAlpha    how far the mid-tone veil is mixed in
 * @param {Array}  options.veilColor    [r, g, b] in 0..1
 */
export const createZenBonsaiPaperFilter = ({
    webGLVersion,
    paperTexture,
    tileSize,
    tileAlpha,
    veilAlpha,
    veilColor,
}) => {
    const shaderSources = resolveZenPixiOwnedShaderSources({
        programId: 'bonsai_paper', webGLVersion, vertexSrc: null,
        defaultVertexSrc: Filter.defaultVertexSrc, fragmentSrc: FRAGMENT,
    });
    // Pixi's default filter vertex stage already provides `vTextureCoord`
    // together with the `inputSize` / `outputFrame` uniforms this shader needs,
    // and hand-rolling it only risks disagreeing with the filter manager about
    // the frame — which renders nothing at all rather than rendering wrongly.
    const filter = new Filter(shaderSources.vertex, shaderSources.fragment, {
        uPaper: paperTexture,
        uTileSize: tileSize,
        uTileAlpha: tileAlpha,
        uVeilAlpha: veilAlpha,
        uVeilColor: Float32Array.from(veilColor),
    });
    // The pass only recolours pixels that already exist, so it never needs to
    // reach outside the region it was handed.
    filter.padding = 0;
    return filter;
};

export default createZenBonsaiPaperFilter;
