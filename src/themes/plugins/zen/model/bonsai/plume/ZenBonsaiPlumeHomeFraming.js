// One Home composition policy owns mature scale and pond-facing direction.
// Inputs are immutable history envelopes, never the visible growth/bloom pose.
export const ZEN_PLUME_HOME_FRAMING_POLICY = 'home-pond-canopy-v8';
export const ZEN_PLUME_HOME_MATURE_HEIGHT_RATIO = 0.73;
export const ZEN_PLUME_HOME_MATURE_WIDTH_RATIO = 0.58;

export function resolveZenBonsaiPlumeHomeOrientation(snapshots, bounds, root) {
    let mature = null;
    for (const [snapshotIndex, snapshot] of snapshots.entries()) {
        if (!Array.isArray(snapshot.scaffoldSegments) || !snapshot.scaffoldSegments.length) {
            throw Error('ZEN_PLUME_PRODUCT_CAMERA_SCAFFOLD_SEGMENTS');
        }
        const nodes = new Map(snapshot.nodes.map(node => [node.id, node]));
        let volume = 0, lateralMoment = 0, absoluteMoment = 0;
        for (const segment of snapshot.scaffoldSegments) {
            const start = nodes.get(segment.parentNodeId), end = nodes.get(segment.childNodeId);
            if (!start || !end || start.owner !== 'f4-scaffold' || end.owner !== 'f4-scaffold') {
                throw Error('ZEN_PLUME_PRODUCT_CAMERA_SCAFFOLD_ENDPOINT');
            }
            const length = Math.hypot(...end.p.map((value, axis) => value - start.p[axis]));
            const radius = (start.radius + end.radius) * 0.5;
            const weight = length * radius * radius;
            const lateral = (start.p[0] + end.p[0]) * 0.5 - root.x;
            volume += weight;
            lateralMoment += lateral * weight;
            absoluteMoment += Math.abs(lateral) * weight;
        }
        if (!(volume > 0)) throw Error('ZEN_PLUME_PRODUCT_CAMERA_SCAFFOLD_MASS');
        if (!mature || volume > mature.volume) mature = { snapshotIndex, volume, lateralMoment, absoluteMoment };
    }
    const scaffoldCenterX = root.x + mature.lateralMoment / mature.volume;
    const leftReach = Math.max(0, scaffoldCenterX - bounds.minX);
    const rightReach = Math.max(0, bounds.maxX - scaffoldCenterX);
    const massBias = mature.absoluteMoment > 0 ? mature.lateralMoment / mature.absoluteMoment : 0;
    const reachBias = (rightReach - leftReach) / Math.max(1, rightReach + leftReach);
    // Put the farther crown endpoint left of the mature wood's volume centroid.
    // Radius-squared weighting anchors the comparison to thick wood, without
    // mixing a separate wood-lean score into the span. Symmetric spans keep +1.
    const balance = reachBias;
    return {
        horizontalSign: balance > 0 ? -1 : 1,
        sourceSnapshotIndex: mature.snapshotIndex,
        scaffoldCenterX, massBias, reachBias, balance,
        decisionBasis: 'scaffold-center-span',
    };
}

export function fitZenBonsaiPlumeHomeCamera(bounds, width, height, { includePot, cameraAnchor, orientation }) {
    const { framingViewport: frame, world, plantingSeam: seam } = cameraAnchor;
    if (includePot || !world || !frame || !seam?.left || !seam?.right
        || ![world.x, world.y, world.z, frame.x, frame.y, frame.width, frame.height,
            seam.left.x, seam.left.y, seam.right.x, seam.right.y, seam.buriedDepth,
            seam.preferredRootX].every(Number.isFinite)
        || frame.x < 0 || frame.y !== 0 || frame.width <= 0 || frame.height !== height
        || frame.x + frame.width > width || seam.left.x < 0 || seam.right.x <= seam.left.x
        || seam.buriedDepth < 0 || seam.preferredRootX < seam.left.x
        || seam.preferredRootX > seam.right.x) {
        throw Error('ZEN_PLUME_PRODUCT_HOME_FRAMING');
    }
    const horizontalSign = orientation.horizontalSign;
    const rootWorldX = world.x * horizontalSign;
    const paddingUnit = Math.min(width, height);
    // The history bounds already contain full blossom/girth reserves and nine
    // world units of paint allowance. Keep air above/pondward, but do not add a
    // second wide margin against the right frame where the crown should cross.
    const padding = { left: paddingUnit * 0.035, right: paddingUnit * 0.0025, top: paddingUnit * 0.035 };
    const left = rootWorldX - bounds.minX, right = bounds.maxX - rootWorldX;
    const above = bounds.maxY - world.y;
    if (!(above > 0)) throw Error('ZEN_PLUME_PRODUCT_HOME_CAMERA_HEIGHT');
    const targetScale = height * ZEN_PLUME_HOME_MATURE_HEIGHT_RATIO / above;
    const slope = (seam.right.y - seam.left.y) / (seam.right.x - seam.left.x);
    const intercept = seam.left.y - slope * seam.left.x + seam.buriedDepth;
    const rootYAt = x => slope * x + intercept;
    // Slide left only when the mature crown needs room. Unlike a fixed planting
    // point, the seam can preserve mature height for broad right-side crowns.
    let rootMin = Math.max(seam.left.x, padding.left);
    let rootMax = Math.min(seam.preferredRootX, width - padding.right);
    if (slope < 0) rootMin = Math.max(rootMin, (height - intercept) / slope);
    if (slope > 0) rootMax = Math.min(rootMax, (height - intercept) / slope);
    if (rootMin > rootMax || (slope === 0 && intercept > height)) throw Error('ZEN_PLUME_PRODUCT_HOME_ROOT_FIT');
    const widthLimits = [(width - padding.left - padding.right) / (bounds.maxX - bounds.minX)];
    if (left > 0) widthLimits.push((rootMax - padding.left) / left);
    if (right > 0) widthLimits.push((width - padding.right - rootMin) / right);
    // Broad crowns retain pondward air in the expanded transparent allocation.
    // Narrow trees keep the height target; one immutable history fit owns every
    // growth stage and retains the complete paint reserve across both modes.
    const compositionWidthScale = width * ZEN_PLUME_HOME_MATURE_WIDTH_RATIO / (bounds.maxX - bounds.minX);
    const widthScale = Math.min(...widthLimits, compositionWidthScale);
    // The seam is affine, so its intersection with the crown's left/right fit
    // is analytic. No iterative zoom, current-growth bounds or renderer clamp.
    const heightScale = slope <= 0
        ? Math.min((rootYAt(rootMin) - padding.top) / above,
            (slope * padding.left + intercept - padding.top) / (above - slope * left))
        : Math.min((rootYAt(rootMax) - padding.top) / above,
            (slope * (width - padding.right) + intercept - padding.top) / (above + slope * right));
    const scale = Math.min(targetScale, widthScale, heightScale);
    if (!(scale > 0)) throw Error('ZEN_PLUME_PRODUCT_HOME_CAMERA_FIT');
    let feasibleMin = Math.max(rootMin, padding.left + left * scale);
    let feasibleMax = Math.min(rootMax, width - padding.right - right * scale);
    if (slope < 0) feasibleMax = Math.min(feasibleMax, (padding.top + above * scale - intercept) / slope);
    if (slope > 0) feasibleMin = Math.max(feasibleMin, (padding.top + above * scale - intercept) / slope);
    if (feasibleMin > feasibleMax + 1e-7) throw Error('ZEN_PLUME_PRODUCT_HOME_ROOT_FIT');
    const rootX = Math.max(feasibleMin, Math.min(feasibleMax, seam.preferredRootX));
    const rootY = rootYAt(rootX);
    return {
        width, height, yaw: 0, horizontalSign, scale,
        x: rootX - rootWorldX * scale, y: rootY + world.y * scale,
        bounds: { minX: bounds.minX, maxX: bounds.maxX, minY: bounds.minY, maxY: bounds.maxY },
        familyId: 'all',
        framing: {
            policy: ZEN_PLUME_HOME_FRAMING_POLICY,
            targetHeightRatio: ZEN_PLUME_HOME_MATURE_HEIGHT_RATIO,
            maximumWidthRatio: ZEN_PLUME_HOME_MATURE_WIDTH_RATIO,
            // This includes immutable flower/radius reserves, not an alpha-mask
            // measurement of the currently visible silhouette.
            envelopeHeightRatio: above * scale / height,
            envelopeWidthRatio: (bounds.maxX - bounds.minX) * scale / width,
            padding,
            widthLimited: widthScale < targetScale - 1e-9,
            compositionWidthLimited: compositionWidthScale < Math.min(targetScale, ...widthLimits, heightScale) - 1e-9,
            heightLimited: heightScale < targetScale - 1e-9,
            root: { x: rootX, y: rootY, preferredX: seam.preferredRootX,
                shiftX: rootX - seam.preferredRootX, buriedDepth: seam.buriedDepth },
            crownMargins: { left: rootX - left * scale, right: width - rootX - right * scale,
                top: rootY - above * scale },
            orientation,
        },
    };
}
