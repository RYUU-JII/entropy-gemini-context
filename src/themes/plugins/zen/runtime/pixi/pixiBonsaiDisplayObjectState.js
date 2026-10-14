export const PIXI_BONSAI_DISPLAY_EPSILON = 0.0001;
export const PIXI_BONSAI_PRESENTATION_ALPHA_EPSILON = 0.001;
export const PIXI_BONSAI_WHITE_TINT = 0xffffff;

const toNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

const resolveTint = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return PIXI_BONSAI_WHITE_TINT;
    }
    return Math.max(0, Math.min(PIXI_BONSAI_WHITE_TINT, Math.round(numeric)));
};

const resolveAlpha = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 1;
    }
    return Math.max(0, Math.min(1, numeric));
};

const nearlyEqual = (left, right, epsilon = PIXI_BONSAI_DISPLAY_EPSILON) => (
    Math.abs(toNumber(left, 0) - toNumber(right, 0)) <= epsilon
);

const setPointIfChanged = (point, x, y, epsilon = PIXI_BONSAI_DISPLAY_EPSILON) => {
    if (!point || typeof point.set !== 'function') {
        return false;
    }
    if (nearlyEqual(point.x, x, epsilon) && nearlyEqual(point.y, y, epsilon)) {
        return false;
    }
    point.set(x, y);
    return true;
};

export const resetPixiBonsaiSpriteTransform = (sprite = null) => {
    if (!sprite) {
        return false;
    }
    let changed = false;
    changed = setPointIfChanged(sprite.pivot, 0, 0) || changed;
    changed = setPointIfChanged(sprite.position, 0, 0) || changed;
    if (!nearlyEqual(sprite.rotation, 0)) {
        sprite.rotation = 0;
        changed = true;
    }
    changed = setPointIfChanged(sprite.skew, 0, 0) || changed;
    changed = setPointIfChanged(sprite.scale, 1, 1) || changed;
    return changed;
};

export const applyPixiBonsaiSpritePresentation = (sprite = null, {
    tint = PIXI_BONSAI_WHITE_TINT,
    alpha = 1,
} = {}) => {
    if (!sprite) {
        return false;
    }
    let changed = false;
    const nextTint = resolveTint(tint);
    const nextAlpha = resolveAlpha(alpha);
    if (sprite.tint !== nextTint) {
        sprite.tint = nextTint;
        changed = true;
    }
    if (Math.abs(toNumber(sprite.alpha, 1) - nextAlpha) > PIXI_BONSAI_PRESENTATION_ALPHA_EPSILON) {
        sprite.alpha = nextAlpha;
        changed = true;
    }
    return changed;
};

export const applyPixiBonsaiBranchSpriteTransform = (record = null, {
    x = 0,
    y = 0,
    rotation = 0,
    scale = 1,
} = {}) => {
    const primarySprite = record?.sprite || null;
    const sprites = [primarySprite, record?.terminalSprite || null].filter(Boolean);
    const sprite = primarySprite;
    if (!sprite) {
        return false;
    }
    let changed = false;
    const cache = record.transformCache || {};
    const nextX = toNumber(x, 0);
    const nextY = toNumber(y, 0);
    const nextRotation = toNumber(rotation, 0);
    const nextScale = Math.max(0.0001, toNumber(scale, 1));
    const positionChanged = (
        cache.initialized !== true
        || !nearlyEqual(cache.x, nextX)
        || !nearlyEqual(cache.y, nextY)
    );
    const rotationChanged = (
        cache.initialized !== true
        || !nearlyEqual(cache.rotation, nextRotation)
    );
    const scaleChanged = (
        cache.initialized !== true
        || !nearlyEqual(cache.scale, nextScale)
    );
    sprites.forEach((branchSprite) => {
        if (branchSprite.visible !== true) {
            branchSprite.visible = true;
            changed = true;
        }
        if (positionChanged) {
            setPointIfChanged(branchSprite.position, nextX, nextY);
            changed = true;
        }
        if (rotationChanged) {
            branchSprite.rotation = nextRotation;
            changed = true;
        }
        if (scaleChanged) {
            setPointIfChanged(branchSprite.scale, nextScale, nextScale);
            changed = true;
        }
    });
    record.transformCache = {
        initialized: true,
        x: nextX,
        y: nextY,
        rotation: nextRotation,
        scale: nextScale,
    };
    return changed;
};

export const resetPixiBonsaiBranchRigPresentationCache = (rig = null) => {
    if (!rig) {
        return;
    }
    rig.presentationTint = null;
    rig.presentationTerminalTint = null;
    rig.presentationTintApplied = false;
};

export const applyPixiBonsaiBranchRigPresentation = ({
    rig = null,
    rootContainer = null,
    tint = PIXI_BONSAI_WHITE_TINT,
    terminalTint = PIXI_BONSAI_WHITE_TINT,
    alpha = 1,
} = {}) => {
    if (!rig || !Array.isArray(rig.records)) {
        return false;
    }
    let changed = false;
    const nextTint = resolveTint(tint);
    const nextTerminalTint = resolveTint(terminalTint);
    const nextAlpha = resolveAlpha(alpha);
    if (
        rootContainer
        && Math.abs(toNumber(rootContainer.alpha, 1) - nextAlpha) > PIXI_BONSAI_PRESENTATION_ALPHA_EPSILON
    ) {
        rootContainer.alpha = nextAlpha;
        changed = true;
    }
    if (
        rig.presentationTintApplied === true
        && rig.presentationTint === nextTint
        && rig.presentationTerminalTint === nextTerminalTint
    ) {
        return changed;
    }
    rig.records.forEach((record) => {
        changed = applyPixiBonsaiSpritePresentation(record?.sprite, {
            tint: nextTint,
            alpha: 1,
        }) || changed;
        changed = applyPixiBonsaiSpritePresentation(record?.terminalSprite, {
            tint: nextTerminalTint,
            alpha: 1,
        }) || changed;
    });
    rig.presentationTint = nextTint;
    rig.presentationTerminalTint = nextTerminalTint;
    rig.presentationTintApplied = true;
    return changed;
};
