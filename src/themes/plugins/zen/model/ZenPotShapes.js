export const ZEN_POT_FULL_ARC = Math.PI * 2;

export const createZenPotRectBounds = (minX, minY, maxX, maxY) => ({
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
});

export const mergeZenPotBounds = (...boundsList) => {
    const entries = boundsList.filter(Boolean);
    if (!entries.length) {
        return createZenPotRectBounds(0, 0, 0, 0);
    }
    return createZenPotRectBounds(
        Math.min(...entries.map((entry) => entry.minX)),
        Math.min(...entries.map((entry) => entry.minY)),
        Math.max(...entries.map((entry) => entry.maxX)),
        Math.max(...entries.map((entry) => entry.maxY)),
    );
};

export const createZenPotEllipseShape = ({
    cx = 0,
    cy = 0,
    rx = 0,
    ry = 0,
    rotation = 0,
    start = 0,
    end = ZEN_POT_FULL_ARC,
    anticlockwise = false,
} = {}) => ({
    kind: 'ellipse',
    cx,
    cy,
    rx: Math.max(0, Number(rx) || 0),
    ry: Math.max(0, Number(ry) || 0),
    rotation,
    start,
    end,
    anticlockwise,
});

export const createZenPotRectShape = ({
    x = 0,
    y = 0,
    width = 0,
    height = 0,
} = {}) => ({
    kind: 'rect',
    x,
    y,
    width: Math.max(0, Number(width) || 0),
    height: Math.max(0, Number(height) || 0),
});

export const createZenPotRoundRectShape = ({
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    radius = 0,
} = {}) => ({
    kind: 'roundRect',
    x,
    y,
    width: Math.max(0, Number(width) || 0),
    height: Math.max(0, Number(height) || 0),
    radius: Math.max(0, Number(radius) || 0),
});

export const beginZenPotShapePath = (ctx, shape) => {
    if (!ctx || !shape || typeof shape !== 'object') {
        return;
    }

    if (shape.kind === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(
            shape.cx,
            shape.cy,
            shape.rx,
            shape.ry,
            shape.rotation || 0,
            shape.start ?? 0,
            shape.end ?? ZEN_POT_FULL_ARC,
            Boolean(shape.anticlockwise),
        );
        return;
    }

    if (shape.kind === 'rect') {
        ctx.beginPath();
        ctx.rect(shape.x, shape.y, shape.width, shape.height);
        return;
    }

    if (shape.kind === 'roundRect') {
        const safeRadius = Math.max(0, Math.min(shape.radius, shape.width * 0.5, shape.height * 0.5));
        ctx.beginPath();
        ctx.moveTo(shape.x + safeRadius, shape.y);
        ctx.lineTo(shape.x + shape.width - safeRadius, shape.y);
        ctx.quadraticCurveTo(shape.x + shape.width, shape.y, shape.x + shape.width, shape.y + safeRadius);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height - safeRadius);
        ctx.quadraticCurveTo(
            shape.x + shape.width,
            shape.y + shape.height,
            shape.x + shape.width - safeRadius,
            shape.y + shape.height,
        );
        ctx.lineTo(shape.x + safeRadius, shape.y + shape.height);
        ctx.quadraticCurveTo(shape.x, shape.y + shape.height, shape.x, shape.y + shape.height - safeRadius);
        ctx.lineTo(shape.x, shape.y + safeRadius);
        ctx.quadraticCurveTo(shape.x, shape.y, shape.x + safeRadius, shape.y);
    }
};

export const getZenPotShapeBounds = (shape) => {
    if (!shape || typeof shape !== 'object') {
        return createZenPotRectBounds(0, 0, 0, 0);
    }
    if (shape.kind === 'ellipse') {
        return createZenPotRectBounds(
            shape.cx - shape.rx,
            shape.cy - shape.ry,
            shape.cx + shape.rx,
            shape.cy + shape.ry,
        );
    }
    if (shape.kind === 'rect' || shape.kind === 'roundRect') {
        return createZenPotRectBounds(
            shape.x,
            shape.y,
            shape.x + shape.width,
            shape.y + shape.height,
        );
    }
    return createZenPotRectBounds(0, 0, 0, 0);
};
