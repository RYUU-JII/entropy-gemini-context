export const ZEN_TOOLS_SCENE_SPEC_OVERRIDE = Object.freeze({
    camera: Object.freeze({
        perspective: 840,
    }),
    groundLayout: Object.freeze({
        // The horizon sits a little above the lower half of the scene: a viewer
        // standing at the garden's edge rather than crouched at it, so the
        // rings read as circles laid on the sand (ground eye height ~0.2)
        // instead of slits.
        topOffsetWorld: -0.2,
        concentricMask: Object.freeze({
            rxPercent: 38,
            ryPercent: 21.5,
        }),
        ring: Object.freeze({
            count: 9,
            // The garden has a fixed scale, like the artifacts standing in it:
            // the inner ring and every rake period are CSS px, and a larger
            // viewport reveals more sand. 40px with 9 rings at half-radius
            // steps puts the outer ring at ~440px across, about twice an
            // artifact's width, at every viewport size.
            baseRxPx: 40,
            baseRyPercent: 2.4,
            stepScale: 0.5,
            tiltDeg: 0,
            grooveShadowStrokeWidth: 1.6,
            grooveHighlightStrokeWidth: 0.7,
            grooveHighlightYOffsetPercent: 0.42,
        }),
        focus: Object.freeze({
            rxPercent: 20,
            ryPercent: 7,
            pulseScaleMax: 1.012,
        }),
    }),
    anchors: Object.freeze({
        ground_center: Object.freeze({ y: 0.053 }),
        karesansui_center: Object.freeze({ y: 0.053 }),
        // Every Zen artifact stands on the karesansui centre. How far each
        // scene's own body sits above that point is declared by the scene, in
        // its own pixels (`ground` in zenArtifactGalleryGeometry.js), so the
        // contact holds at every viewport size; world-unit offsets would scale
        // with the viewport while the fixed-size scene does not.
        artifact_origin: Object.freeze({ y: 0.053 }),
    }),
});

// No per-artifact placement: scenes declare their own ground contact.
export const ZEN_TOOLS_ARTIFACT_SCENE_SPEC_OVERRIDES = Object.freeze({});
