const toPositiveNumber = (value, fallback = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return Math.max(1, Number(fallback) || 1);
    }
    return numeric;
};

export const resolveZenCoverTransform = ({
    worldWidth,
    worldHeight,
    viewportWidth,
    viewportHeight,
} = {}) => {
    const safeWorldWidth = Math.max(1, Math.round(toPositiveNumber(worldWidth, 1)));
    const safeWorldHeight = Math.max(1, Math.round(toPositiveNumber(worldHeight, 1)));
    const safeViewportWidth = Math.max(1, Math.round(toPositiveNumber(viewportWidth, safeWorldWidth)));
    const safeViewportHeight = Math.max(1, Math.round(toPositiveNumber(viewportHeight, safeWorldHeight)));
    const scale = Math.max(
        0.0001,
        Math.max(
            safeViewportWidth / safeWorldWidth,
            safeViewportHeight / safeWorldHeight,
        ),
    );
    const contentWidth = safeWorldWidth * scale;
    const contentHeight = safeWorldHeight * scale;
    const offsetX = (safeViewportWidth - contentWidth) * 0.5;
    const offsetY = (safeViewportHeight - contentHeight) * 0.5;
    return {
        worldWidth: safeWorldWidth,
        worldHeight: safeWorldHeight,
        viewportWidth: safeViewportWidth,
        viewportHeight: safeViewportHeight,
        scale,
        contentWidth,
        contentHeight,
        offsetX,
        offsetY,
    };
};

export const resolveZenWorldFilterSize = ({
    worldWidth,
    worldHeight,
} = {}) => {
    return {
        width: Math.max(1, Math.round(toPositiveNumber(worldWidth, 1))),
        height: Math.max(1, Math.round(toPositiveNumber(worldHeight, 1))),
    };
};

export const resolveZenVisibleWorldBounds = ({
    worldWidth,
    worldHeight,
    viewportWidth,
    viewportHeight,
} = {}) => {
    const transform = resolveZenCoverTransform({
        worldWidth,
        worldHeight,
        viewportWidth,
        viewportHeight,
    });
    const safeScale = Math.max(0.0001, Number(transform.scale) || 1);
    const visibleWorldWidth = Math.max(
        1,
        Math.min(transform.worldWidth, Math.round(transform.viewportWidth / safeScale)),
    );
    const visibleWorldHeight = Math.max(
        1,
        Math.min(transform.worldHeight, Math.round(transform.viewportHeight / safeScale)),
    );
    const maxVisibleX = Math.max(0, transform.worldWidth - visibleWorldWidth);
    const maxVisibleY = Math.max(0, transform.worldHeight - visibleWorldHeight);
    return {
        x: Math.min(
            maxVisibleX,
            Math.max(0, Math.round((-transform.offsetX) / safeScale)),
        ),
        y: Math.min(
            maxVisibleY,
            Math.max(0, Math.round((-transform.offsetY) / safeScale)),
        ),
        width: visibleWorldWidth,
        height: visibleWorldHeight,
    };
};

export const mapZenViewportPointToWorld = ({
    viewportX,
    viewportY,
    worldWidth,
    worldHeight,
    viewportWidth,
    viewportHeight,
} = {}) => {
    const x = Number(viewportX);
    const y = Number(viewportY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const transform = resolveZenCoverTransform({
        worldWidth,
        worldHeight,
        viewportWidth,
        viewportHeight,
    });
    const worldX = (x - transform.offsetX) / transform.scale;
    const worldY = (y - transform.offsetY) / transform.scale;
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;
    if (worldX < 0 || worldY < 0 || worldX > transform.worldWidth || worldY > transform.worldHeight) {
        return null;
    }
    return {
        x: worldX,
        y: worldY,
    };
};

export const mapZenWorldPointToViewport = ({
    worldX,
    worldY,
    worldWidth,
    worldHeight,
    viewportWidth,
    viewportHeight,
} = {}) => {
    const x = Number(worldX);
    const y = Number(worldY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const transform = resolveZenCoverTransform({
        worldWidth,
        worldHeight,
        viewportWidth,
        viewportHeight,
    });
    if (x < 0 || y < 0 || x > transform.worldWidth || y > transform.worldHeight) {
        return null;
    }
    return {
        x: (x * transform.scale) + transform.offsetX,
        y: (y * transform.scale) + transform.offsetY,
    };
};
