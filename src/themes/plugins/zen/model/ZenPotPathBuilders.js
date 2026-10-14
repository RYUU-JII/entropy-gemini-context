export const beginRoundedRectPath = (ctx, x, y, width, height, radius) => {
    const safeRadius = Math.max(0, Math.min(radius, width * 0.5, height * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
};

export const beginClassicPotBodyPath = (ctx, width, height, bodyEdgeY, bodyBottomY) => {
    const topWidth = width;
    const bottomWidth = width * 0.85;
    ctx.beginPath();
    ctx.moveTo(-topWidth / 2, -height);
    ctx.lineTo(topWidth / 2, -height);
    ctx.quadraticCurveTo(topWidth * 0.54, -height * 0.46, bottomWidth / 2, bodyEdgeY);
    ctx.bezierCurveTo(
        bottomWidth * 0.28,
        bodyBottomY * 1.14,
        -bottomWidth * 0.28,
        bodyBottomY * 1.14,
        -bottomWidth / 2,
        bodyEdgeY,
    );
    ctx.quadraticCurveTo(-topWidth * 0.54, -height * 0.46, -topWidth / 2, -height);
    ctx.closePath();
};

export const beginOvalPotBodyPath = (ctx, width, height, profile) => {
    const topWidth = width * profile.topWidthFactor;
    const midWidth = width * (profile.midWidthFactor || ((profile.topWidthFactor + profile.bottomWidthFactor) * 0.5));
    const bottomWidth = width * profile.bottomWidthFactor;
    const bodyEdgeY = height * profile.bodyEdgeYFactor;
    const bodyBottomY = height * profile.bodyBottomYFactor;
    const shoulderY = -height * profile.shoulderCurveFactor;
    const midY = -height * (0.18 + (profile.shoulderCurveFactor * 0.22));
    const lowerCurveY = bodyBottomY - (height * (0.08 + (profile.bellyCurveFactor * 0.46)));
    const bottomArcY = bodyBottomY + (height * (profile.bellyCurveFactor + 0.02));
    ctx.beginPath();
    ctx.moveTo(-topWidth * 0.5, -height);
    ctx.lineTo(topWidth * 0.5, -height);
    ctx.bezierCurveTo(
        topWidth * 0.49,
        shoulderY,
        midWidth * 0.54,
        midY,
        midWidth * 0.5,
        bodyEdgeY,
    );
    ctx.bezierCurveTo(
        midWidth * 0.48,
        lowerCurveY,
        bottomWidth * 0.56,
        bodyBottomY - (height * 0.014),
        bottomWidth * 0.5,
        bodyBottomY,
    );
    ctx.quadraticCurveTo(0, bottomArcY, -bottomWidth * 0.5, bodyBottomY);
    ctx.bezierCurveTo(
        -bottomWidth * 0.56,
        bodyBottomY - (height * 0.014),
        -midWidth * 0.48,
        lowerCurveY,
        -midWidth * 0.5,
        bodyEdgeY,
    );
    ctx.bezierCurveTo(
        -midWidth * 0.54,
        midY,
        -topWidth * 0.49,
        shoulderY,
        -topWidth * 0.5,
        -height,
    );
    ctx.closePath();
};

export const beginOvalPotFrontWallPath = (ctx, width, height, profile) => {
    const topWidth = width * profile.topWidthFactor;
    const midWidth = width * (profile.midWidthFactor || ((profile.topWidthFactor + profile.bottomWidthFactor) * 0.5));
    const bottomWidth = width * profile.bottomWidthFactor;
    const rimHeight = height * profile.rimHeightFactor;
    const bodyEdgeY = height * profile.bodyEdgeYFactor;
    const bodyBottomY = height * profile.bodyBottomYFactor;
    const rimY = -height;
    const shoulderY = -height * profile.shoulderCurveFactor;
    const midY = -height * (0.18 + (profile.shoulderCurveFactor * 0.22));
    const lowerCurveY = bodyBottomY - (height * (0.08 + (profile.bellyCurveFactor * 0.46)));
    const bottomArcY = bodyBottomY + (height * (profile.bellyCurveFactor + 0.02));
    const frontArcDepth = rimHeight * 0.92;

    ctx.beginPath();
    ctx.moveTo(-topWidth * 0.5, rimY);
    ctx.quadraticCurveTo(0, rimY + frontArcDepth, topWidth * 0.5, rimY);
    ctx.bezierCurveTo(
        topWidth * 0.49,
        shoulderY,
        midWidth * 0.54,
        midY,
        midWidth * 0.5,
        bodyEdgeY,
    );
    ctx.bezierCurveTo(
        midWidth * 0.48,
        lowerCurveY,
        bottomWidth * 0.56,
        bodyBottomY - (height * 0.014),
        bottomWidth * 0.5,
        bodyBottomY,
    );
    ctx.quadraticCurveTo(0, bottomArcY, -bottomWidth * 0.5, bodyBottomY);
    ctx.bezierCurveTo(
        -bottomWidth * 0.56,
        bodyBottomY - (height * 0.014),
        -midWidth * 0.48,
        lowerCurveY,
        -midWidth * 0.5,
        bodyEdgeY,
    );
    ctx.bezierCurveTo(
        -midWidth * 0.54,
        midY,
        -topWidth * 0.49,
        shoulderY,
        -topWidth * 0.5,
        rimY,
    );
    ctx.closePath();
};
