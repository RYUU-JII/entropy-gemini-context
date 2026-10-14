export const DEFAULT_TOOLS_SCENE_SPEC = Object.freeze({
    version: 1,
    worldUnit: 'normalized_min_dim',
    fitMode: 'contain',
    camera: Object.freeze({
        perspective: 980,
        center: Object.freeze({
            x: 0.5,
            y: 0.7,
        }),
    }),
    groundLayout: Object.freeze({
        topOffsetWorld: -0.16,
        concentricMask: Object.freeze({
            rxPercent: 34,
            ryPercent: 19.5,
        }),
        ring: Object.freeze({
            count: 8,
            baseRxPercent: 5.5,
            baseRxPx: null,
            baseRyPercent: 3.0,
            stepScale: 0.65,
            tiltDeg: 0,
            grooveShadowStrokeWidth: 2.5,
            grooveHighlightStrokeWidth: 1,
            grooveHighlightYOffsetPercent: 0.5,
        }),
        focus: Object.freeze({
            rxPercent: 18,
            ryPercent: 6,
            pulseScaleMax: 1.015,
        }),
        debugMarker: Object.freeze({
            outerRadiusPx: 8,
            innerRadiusPx: 3,
        }),
    }),
    anchors: Object.freeze({
        scene_origin: Object.freeze({ x: 0, y: 0, z: 0 }),
        ground_center: Object.freeze({ x: 0, y: 0, z: 0 }),
        artifact_origin: Object.freeze({ x: 0, y: 0, z: 0 }),
        karesansui_center: Object.freeze({ x: 0, y: 0, z: 0 }),
    }),
    artifacts: Object.freeze({
        default: Object.freeze({
            anchorId: 'artifact_origin',
            offset: Object.freeze({ x: 0, y: 0, z: 0 }),
        }),
        lens: Object.freeze({
            anchorId: 'artifact_origin',
            offset: Object.freeze({ x: 0, y: 0, z: 0 }),
        }),
        veil: Object.freeze({
            anchorId: 'artifact_origin',
            offset: Object.freeze({ x: 0, y: 0, z: 0 }),
        }),
        resonance: Object.freeze({
            anchorId: 'artifact_origin',
            offset: Object.freeze({ x: 0, y: 0, z: 0 }),
        }),
        brake: Object.freeze({
            anchorId: 'artifact_origin',
            offset: Object.freeze({ x: 0, y: 0, z: 0 }),
        }),
        monolith: Object.freeze({
            anchorId: 'artifact_origin',
            offset: Object.freeze({ x: 0, y: 0, z: 0 }),
        }),
        gate: Object.freeze({
            anchorId: 'artifact_origin',
            offset: Object.freeze({ x: 0, y: 0, z: 0 }),
        }),
        lethe: Object.freeze({
            anchorId: 'artifact_origin',
            offset: Object.freeze({ x: 0, y: 0, z: 0 }),
        }),
        sentinelFlare: Object.freeze({
            anchorId: 'artifact_origin',
            offset: Object.freeze({ x: 0, y: 0, z: 0 }),
        }),
    }),
});
