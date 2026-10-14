// One proportional stone-bed profile owns Home's CSS occlusion, graph endpoint,
// planting seam and worker paint. The canopy keeps its separate transparent area.
export function resolveZenHomeSkyPlane(geometry) {
    if (geometry?.support !== 'frame-seam') throw new Error('ZEN_HOME_SKY_PLANE_SUPPORT');
    const { topX, bottomX } = geometry.rearPaperEdge;
    const { viewportWidth: width, viewportHeight: height } = geometry;
    return [
        { x: topX, y: 0 }, { x: width, y: 0 },
        { x: width, y: height }, { x: bottomX, y: height },
    ];
}

export function resolveZenHomeFrameSeamProfile({ surfaceSize, sceneViewport }) {
    const { width, height } = surfaceSize;
    const scene = sceneViewport;
    const bedLeftX = scene.x - scene.width * 0.1;
    const frontTopY = height - scene.height * 0.09;
    const topPlaneDepth = scene.height * 0.038;
    const rearY = frontTopY - topPlaneDepth;
    const rim = scene.width * 0.018;
    const rearLeftX = bedLeftX + scene.width * 0.035;
    const soilRearY = rearY + topPlaneDepth * 0.25;
    const soilFrontY = frontTopY - topPlaneDepth * 0.24;
    const rootY = soilRearY + (soilFrontY - soilRearY) * 0.58;
    const buriedDepth = scene.height * 0.004;
    const left = { x: rearLeftX + rim, y: rootY - buriedDepth };
    const right = { x: width - rim, y: rootY - buriedDepth };
    return {
        left, right, bedLeftX, rearLeftX, frontTopY, rearY, topPlaneDepth, rim,
        soilRearY, soilFrontY,
        // Four percent of the original frame is about 18 CSS px at the usual
        // 450px slot. Keep the same proportional shift in CSS and device space.
        plantingAnchor: { x: scene.x + scene.width * 0.90, y: rootY },
        buriedDepth,
        foreground: [
            { x: rearLeftX, y: rearY }, { x: width, y: rearY },
            { x: width, y: height }, { x: bedLeftX, y: height },
            { x: bedLeftX, y: frontTopY },
        ],
    };
}

export function resolveZenHomeFrameSeamMesh(projection) {
    const profile = resolveZenHomeFrameSeamProfile(projection);
    const { width, height } = projection.surfaceSize;
    const { bedLeftX, rearLeftX, frontTopY, rearY, topPlaneDepth, rim,
        soilRearY, soilFrontY } = profile;
    const leftAt = y => rearLeftX + (bedLeftX - rearLeftX) * (y - rearY) / topPlaneDepth;
    const quad = (top, bottom, inset) => [
        { x: leftAt(top) + inset, y: top }, { x: width - inset, y: top },
        { x: width - inset, y: bottom }, { x: leftAt(bottom) + inset, y: bottom },
    ];
    const outerTop = quad(rearY, frontTopY, 0);
    const opening = quad(rearY + topPlaneDepth * 0.16, frontTopY - topPlaneDepth * 0.28, rim);
    const soil = quad(soilRearY, soilFrontY, rim * 1.25);
    // DOM pressure ends at the exact logical bedLeftX. Scene-edge quantization
    // and canvas antialiasing can expose a subpixel line there; cover it with
    // the existing paint reserve without moving the joint or its input bounds.
    const frontPaintLeftX = bedLeftX - projection.boundaryOvershootDevicePx;
    return Object.freeze({
        coordinateSpace: projection.coordinateSpace,
        support: 'frame-seam',
        viewportWidth: width,
        viewportHeight: height,
        sceneViewport: projection.sceneViewport,
        bedInsetLeft: projection.bedInsetLeftDevicePx,
        plantingAnchor: profile.plantingAnchor,
        topPlaneDepth,
        topPlaneRearY: rearY,
        frontTopY,
        frontRimInnerY: opening[3].y,
        frontBottomY: height,
        frontBottomLeftX: bedLeftX,
        frontBottomRightX: width,
        soilRearY, soilFrontY,
        soilRearLeftX: soil[0].x, soilRearRightX: soil[1].x,
        soilFrontLeftX: soil[3].x, soilFrontRightX: soil[2].x,
        frameSeam: profile,
        rearPaperEdge: projection.rearPaperEdge,
        polygons: {
            outerTop, opening, soil,
            frontRim: [opening[3], opening[2], outerTop[2], outerTop[3]],
            frontFace: [{ x: frontPaintLeftX, y: frontTopY }, outerTop[2],
                { x: width, y: height }, { x: frontPaintLeftX, y: height }],
        },
    });
}
