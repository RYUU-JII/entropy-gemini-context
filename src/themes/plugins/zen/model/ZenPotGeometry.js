import {
    createZenPotEllipseShape,
    createZenPotRectBounds,
    getZenPotShapeBounds,
    mergeZenPotBounds,
} from './ZenPotShapes.js';

const command = (op, ...args) => Object.freeze({ op, args: Object.freeze(args) });

const createPath = (commands) => Object.freeze({
    commands: Object.freeze(commands),
});

const createEdge = (id, path, { from = null, to = null, control = null } = {}) => Object.freeze({
    id,
    path,
    from,
    to,
    control,
});

const createSurface = ({
    id,
    path,
    topEdgeId = null,
    bounds,
    materialRole = 'body',
}) => Object.freeze({
    id,
    path,
    topEdgeId,
    bounds,
    materialRole,
});

export const beginZenPotGeometryPath = (ctx, path) => {
    if (!ctx || !path || !Array.isArray(path.commands)) {
        return;
    }
    path.commands.forEach((entry) => {
        const args = Array.isArray(entry?.args) ? entry.args : [];
        if (entry?.op === 'beginPath') ctx.beginPath();
        else if (entry?.op === 'moveTo') ctx.moveTo(...args);
        else if (entry?.op === 'lineTo') ctx.lineTo(...args);
        else if (entry?.op === 'quadraticCurveTo') ctx.quadraticCurveTo(...args);
        else if (entry?.op === 'bezierCurveTo') ctx.bezierCurveTo(...args);
        else if (entry?.op === 'ellipse') ctx.ellipse(...args);
        else if (entry?.op === 'closePath') ctx.closePath();
    });
};

export const beginZenPotSurfacePath = (ctx, surface) => {
    beginZenPotGeometryPath(ctx, surface?.path);
};

export const beginZenPotEdgePath = (ctx, edge) => {
    beginZenPotGeometryPath(ctx, edge?.path);
};

const resolveOvalBodyAnchors = (model) => {
    const {
        profile,
        baseWidth: width,
        baseHeight: height,
        metrics: {
            topWidth,
            midWidth,
            bottomWidth,
            rimHeight,
            bodyEdgeY,
            bodyBottomY,
            rimY,
            frontWallTopArcDepth,
        },
    } = model;
    const frontArcDepth = Number.isFinite(Number(frontWallTopArcDepth))
        ? Number(frontWallTopArcDepth)
        : rimHeight * 0.92;
    const shoulderY = -height * profile.shoulderCurveFactor;
    const midY = -height * (0.18 + (profile.shoulderCurveFactor * 0.22));
    const lowerCurveY = bodyBottomY - (height * (0.08 + (profile.bellyCurveFactor * 0.46)));
    const bottomArcY = bodyBottomY + (height * (profile.bellyCurveFactor + 0.02));

    return Object.freeze({
        rimY,
        topLeft: Object.freeze({ x: -topWidth * 0.5, y: rimY }),
        topRight: Object.freeze({ x: topWidth * 0.5, y: rimY }),
        frontControl: Object.freeze({ x: 0, y: rimY + frontArcDepth }),
        backControl: Object.freeze({ x: 0, y: rimY - (rimHeight * 0.76) }),
        rightShoulderA: Object.freeze({ x: topWidth * 0.49, y: shoulderY }),
        rightShoulderB: Object.freeze({ x: midWidth * 0.54, y: midY }),
        rightEdge: Object.freeze({ x: midWidth * 0.5, y: bodyEdgeY }),
        rightLowerA: Object.freeze({ x: midWidth * 0.48, y: lowerCurveY }),
        rightLowerB: Object.freeze({ x: bottomWidth * 0.56, y: bodyBottomY - (height * 0.014) }),
        bottomRight: Object.freeze({ x: bottomWidth * 0.5, y: bodyBottomY }),
        bottomControl: Object.freeze({ x: 0, y: bottomArcY }),
        bottomLeft: Object.freeze({ x: -bottomWidth * 0.5, y: bodyBottomY }),
        leftLowerA: Object.freeze({ x: -bottomWidth * 0.56, y: bodyBottomY - (height * 0.014) }),
        leftLowerB: Object.freeze({ x: -midWidth * 0.48, y: lowerCurveY }),
        leftEdge: Object.freeze({ x: -midWidth * 0.5, y: bodyEdgeY }),
        leftShoulderA: Object.freeze({ x: -midWidth * 0.54, y: midY }),
        leftShoulderB: Object.freeze({ x: -topWidth * 0.49, y: shoulderY }),
    });
};

const createOvalFrontEdgePath = (anchors) => createPath([
    command('beginPath'),
    command('moveTo', anchors.topLeft.x, anchors.topLeft.y),
    command('quadraticCurveTo', anchors.frontControl.x, anchors.frontControl.y, anchors.topRight.x, anchors.topRight.y),
]);

const createOvalBackEdgePath = (anchors) => createPath([
    command('beginPath'),
    command('moveTo', anchors.topLeft.x, anchors.topLeft.y),
    command('quadraticCurveTo', anchors.backControl.x, anchors.backControl.y, anchors.topRight.x, anchors.topRight.y),
]);

const createOvalFrontWallPath = (anchors) => createPath([
    command('beginPath'),
    command('moveTo', anchors.topLeft.x, anchors.topLeft.y),
    command('quadraticCurveTo', anchors.frontControl.x, anchors.frontControl.y, anchors.topRight.x, anchors.topRight.y),
    command(
        'bezierCurveTo',
        anchors.rightShoulderA.x,
        anchors.rightShoulderA.y,
        anchors.rightShoulderB.x,
        anchors.rightShoulderB.y,
        anchors.rightEdge.x,
        anchors.rightEdge.y,
    ),
    command(
        'bezierCurveTo',
        anchors.rightLowerA.x,
        anchors.rightLowerA.y,
        anchors.rightLowerB.x,
        anchors.rightLowerB.y,
        anchors.bottomRight.x,
        anchors.bottomRight.y,
    ),
    command('quadraticCurveTo', anchors.bottomControl.x, anchors.bottomControl.y, anchors.bottomLeft.x, anchors.bottomLeft.y),
    command(
        'bezierCurveTo',
        anchors.leftLowerA.x,
        anchors.leftLowerA.y,
        anchors.leftLowerB.x,
        anchors.leftLowerB.y,
        anchors.leftEdge.x,
        anchors.leftEdge.y,
    ),
    command(
        'bezierCurveTo',
        anchors.leftShoulderA.x,
        anchors.leftShoulderA.y,
        anchors.leftShoulderB.x,
        anchors.leftShoulderB.y,
        anchors.topLeft.x,
        anchors.topLeft.y,
    ),
    command('closePath'),
]);

export const resolveZenPotGeometry = (model) => {
    if (!model || !model.profile || !String(model.family || '').includes('oval')) {
        return null;
    }

    const {
        baseWidth: width,
        baseHeight: height,
        metrics: {
            topWidth,
            bottomWidth,
            rimHeight,
            bodyBottomY,
            rimY,
        },
        shapes: {
            shadowShape,
            soilSurfaceShape,
        },
    } = model;
    const anchors = resolveOvalBodyAnchors(model);
    const rimFrontPath = createOvalFrontEdgePath(anchors);
    const rimBackPath = createOvalBackEdgePath(anchors);
    const frontWallPath = createOvalFrontWallPath(anchors);
    const bodyBounds = createZenPotRectBounds(
        -topWidth * 0.54,
        rimY,
        topWidth * 0.54,
        bodyBottomY + (height * 0.08),
    );
    const rimOuterShape = createZenPotEllipseShape({
        cx: 0,
        cy: rimY,
        rx: topWidth * 0.5,
        ry: rimHeight,
    });
    const rimInnerShape = createZenPotEllipseShape({
        cx: 0,
        cy: rimY,
        rx: topWidth * 0.44,
        ry: rimHeight * 0.74,
    });
    const lowerFrontEdge = createZenPotEllipseShape({
        cx: 0,
        cy: bodyBottomY - (height * 0.004),
        rx: bottomWidth * 0.46,
        ry: Math.max(1.1, rimHeight * 0.46),
        start: 0.12,
        end: Math.PI - 0.12,
    });
    const edges = Object.freeze({
        rimFront: createEdge('rim_front_edge', rimFrontPath, {
            from: anchors.topLeft,
            to: anchors.topRight,
            control: anchors.frontControl,
        }),
        rimBack: createEdge('rim_back_edge', rimBackPath, {
            from: anchors.topLeft,
            to: anchors.topRight,
            control: anchors.backControl,
        }),
        lowerFront: Object.freeze({ id: 'lower_front_edge', shape: lowerFrontEdge }),
    });

    const surfaces = Object.freeze({
        shadow: Object.freeze({
            id: 'ground_shadow',
            shape: shadowShape,
            bounds: getZenPotShapeBounds(shadowShape),
            materialRole: 'shadow',
        }),
        body: createSurface({
            id: 'body_surface',
            path: frontWallPath,
            topEdgeId: edges.rimFront.id,
            bounds: bodyBounds,
            materialRole: 'ceramic_body',
        }),
        frontWall: createSurface({
            id: 'front_wall_surface',
            path: frontWallPath,
            topEdgeId: edges.rimFront.id,
            bounds: bodyBounds,
            materialRole: 'ceramic_front',
        }),
        rimOuter: Object.freeze({
            id: 'rim_outer_surface',
            shape: rimOuterShape,
            bounds: getZenPotShapeBounds(rimOuterShape),
            materialRole: 'rim',
        }),
        rimInner: Object.freeze({
            id: 'rim_inner_surface',
            shape: rimInnerShape,
            bounds: getZenPotShapeBounds(rimInnerShape),
            materialRole: 'rim_inner',
        }),
        soil: Object.freeze({
            id: 'soil_surface',
            shape: soilSurfaceShape,
            bounds: getZenPotShapeBounds(soilSurfaceShape),
            materialRole: 'soil',
        }),
    });

    return Object.freeze({
        family: model.family,
        anchors,
        edges,
        surfaces,
        bounds: mergeZenPotBounds(
            surfaces.shadow.bounds,
            surfaces.body.bounds,
            surfaces.rimOuter.bounds,
            surfaces.soil.bounds,
        ),
    });
};
