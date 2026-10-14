const TAU = Math.PI * 2;

export const PROJECTED_BLOSSOM_ATLAS_VIEWS = Object.freeze([
    Object.freeze({ id: 'front', yaw: 0 }),
    Object.freeze({ id: 'three-quarter', yaw: Math.PI * 0.25 }),
    Object.freeze({ id: 'profile', yaw: Math.PI * 0.5 }),
    Object.freeze({ id: 'back', yaw: Math.PI }),
]);

export const PROJECTED_BLOSSOM_ATLAS_OPENNESS = Object.freeze([
    Object.freeze({ id: 'half', value: 0.42 }),
    Object.freeze({ id: 'cupped', value: 0.68 }),
    Object.freeze({ id: 'open', value: 0.96 }),
]);

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
    return clamp(value, 0, 1);
}

function parseHexColor(value = '#FFCDD2') {
    const hex = String(value).replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
        throw new Error(`ZEN_SAKURA_PROJECTED_BLOSSOM_COLOR_INVALID:${value}`);
    }
    return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
    };
}

function mixColor(fromHex, toHex, amount, alpha = 1) {
    const from = parseHexColor(fromHex);
    const to = parseHexColor(toHex);
    const mix = clamp01(amount);
    return `rgba(${Math.round(from.r + ((to.r - from.r) * mix))},`
        + `${Math.round(from.g + ((to.g - from.g) * mix))},`
        + `${Math.round(from.b + ((to.b - from.b) * mix))},${clamp01(alpha)})`;
}

function rotatePoint(point, yaw, pitch) {
    const yawCosine = Math.cos(yaw);
    const yawSine = Math.sin(yaw);
    const yawX = (point.x * yawCosine) + (point.z * yawSine);
    const yawZ = (-point.x * yawSine) + (point.z * yawCosine);
    const pitchCosine = Math.cos(pitch);
    const pitchSine = Math.sin(pitch);
    return {
        x: yawX,
        y: (point.y * pitchCosine) - (yawZ * pitchSine),
        z: (point.y * pitchSine) + (yawZ * pitchCosine),
    };
}

function createPetalPoint(radial, tangent, radialDistance, lateralDistance, z) {
    return {
        x: (radial.x * radialDistance) + (tangent.x * lateralDistance),
        y: (radial.y * radialDistance) + (tangent.y * lateralDistance),
        z,
    };
}

function createProjectedPetal({
    index,
    descriptor,
    yaw,
    pitch,
}) {
    const variantTurn = descriptor.variant === 0
        ? 0
        : ((index % 2 === 0 ? 1 : -1) * 0.035 * descriptor.variant);
    const angle = (-Math.PI / 2) + ((index / 5) * TAU) + variantTurn;
    const radial = { x: Math.cos(angle), y: Math.sin(angle) };
    const tangent = { x: -radial.y, y: radial.x };
    const stageScale = descriptor.bloomStage === 'half_open'
        ? 0.82
        : (descriptor.bloomStage === 'bud' ? 0.58 : 1);
    const effectiveOpen = descriptor.bloomStage === 'half_open'
        ? descriptor.openness * 0.68
        : (descriptor.bloomStage === 'bud' ? descriptor.openness * 0.3 : descriptor.openness);
    const petalLength = (7.8 + (descriptor.petalLength * 2.8)) * stageScale;
    const radialLength = petalLength * (0.54 + (effectiveOpen * 0.46));
    const petalWidth = (6.1 + (descriptor.petalWidth * 2.8))
        * (0.66 + (effectiveOpen * 0.34));
    const cupHeight = petalLength * (1 - effectiveOpen) * 0.86;
    const socket = radialLength * 0.06;
    const zAt = (ratio) => (
        (cupHeight * Math.pow(ratio, 1.45))
        + (petalLength * 0.16 * Math.sin(Math.PI * ratio))
    );
    const localPoints = {
        base: createPetalPoint(radial, tangent, socket, 0, zAt(0.06)),
        leftBase: createPetalPoint(radial, tangent, radialLength * 0.18, -petalWidth * 0.22, zAt(0.18)),
        leftMid: createPetalPoint(radial, tangent, radialLength * 0.58, -petalWidth * 0.54, zAt(0.58)),
        leftLobe: createPetalPoint(radial, tangent, radialLength, -petalWidth * 0.18, zAt(1)),
        notch: createPetalPoint(radial, tangent, radialLength * 0.91, 0, zAt(0.94)),
        rightLobe: createPetalPoint(radial, tangent, radialLength, petalWidth * 0.18, zAt(1)),
        rightMid: createPetalPoint(radial, tangent, radialLength * 0.58, petalWidth * 0.54, zAt(0.58)),
        rightBase: createPetalPoint(radial, tangent, radialLength * 0.18, petalWidth * 0.22, zAt(0.18)),
    };
    const projected = Object.fromEntries(
        Object.entries(localPoints).map(([key, point]) => [key, rotatePoint(point, yaw, pitch)]),
    );
    const depth = Object.values(projected)
        .reduce((total, point) => total + point.z, 0) / Object.keys(projected).length;
    return { index, projected, depth };
}

function traceProjectedPetal(ctx, petal) {
    const {
        base,
        leftBase,
        leftMid,
        leftLobe,
        notch,
        rightLobe,
        rightMid,
        rightBase,
    } = petal.projected;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.bezierCurveTo(leftBase.x, leftBase.y, leftMid.x, leftMid.y, leftLobe.x, leftLobe.y);
    ctx.quadraticCurveTo(
        (leftLobe.x + notch.x) * 0.5,
        (leftLobe.y + notch.y) * 0.5,
        notch.x,
        notch.y,
    );
    ctx.quadraticCurveTo(
        (rightLobe.x + notch.x) * 0.5,
        (rightLobe.y + notch.y) * 0.5,
        rightLobe.x,
        rightLobe.y,
    );
    ctx.bezierCurveTo(rightMid.x, rightMid.y, rightBase.x, rightBase.y, base.x, base.y);
    ctx.closePath();
}

function drawProjectedSepals(ctx, descriptor, yaw, pitch, drawInFront) {
    const normal = rotatePoint({ x: 0, y: 0, z: 1 }, yaw, pitch);
    const isBackView = normal.z < 0;
    if (drawInFront !== isBackView) return;
    for (let index = 0; index < 5; index += 1) {
        const angle = (-Math.PI / 2) + ((index / 5) * TAU);
        const radial = { x: Math.cos(angle), y: Math.sin(angle) };
        const tangent = { x: -radial.y, y: radial.x };
        const base = rotatePoint({ x: 0, y: 0, z: -0.45 }, yaw, pitch);
        const left = rotatePoint(
            createPetalPoint(radial, tangent, 1.3, -0.62, -0.7),
            yaw,
            pitch,
        );
        const tip = rotatePoint(
            createPetalPoint(radial, tangent, 4.2 - (descriptor.openness * 0.8), 0, -1.15),
            yaw,
            pitch,
        );
        const right = rotatePoint(
            createPetalPoint(radial, tangent, 1.3, 0.62, -0.7),
            yaw,
            pitch,
        );
        ctx.fillStyle = isBackView ? '#7A6165' : '#6B565A';
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.quadraticCurveTo(left.x, left.y, tip.x, tip.y);
        ctx.quadraticCurveTo(right.x, right.y, base.x, base.y);
        ctx.fill();
    }
}

function drawProjectedCore(ctx, descriptor, yaw, pitch, color) {
    const normal = rotatePoint({ x: 0, y: 0, z: 1 }, yaw, pitch);
    const frontVisibility = clamp01((normal.z + 0.16) / 1.16);
    if (frontVisibility <= 0.04) return;
    const coreRadius = 0.9 + (descriptor.coreSize * 0.82);
    const ellipseCompression = 0.2 + (Math.abs(normal.z) * 0.8);
    const ellipseRotation = Math.atan2(normal.y, normal.x) + (Math.PI / 2);
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 1.5);
    core.addColorStop(0, `rgba(240,226,190,${0.82 * frontVisibility})`);
    core.addColorStop(0.5, `rgba(206,175,146,${0.62 * frontVisibility})`);
    core.addColorStop(1, 'rgba(178,140,140,0)');
    ctx.save();
    ctx.rotate(ellipseRotation);
    ctx.scale(1, ellipseCompression);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius * 1.45, 0, TAU);
    ctx.fill();
    ctx.restore();

    const stamenCount = 8 + Math.round(descriptor.stamenBurst * 5);
    const filamentColor = mixColor('#8A6B6E', '#C4AE92', 0.46, 0.7 * frontVisibility);
    const antherColor = mixColor('#8F6E71', '#CDBB9C', 0.42, 0.82 * frontVisibility);
    ctx.strokeStyle = filamentColor;
    ctx.fillStyle = antherColor;
    ctx.lineWidth = 0.24;
    ctx.lineCap = 'round';
    for (let index = 0; index < stamenCount; index += 1) {
        const angle = (index / stamenCount) * TAU + 0.18;
        const length = coreRadius * (1.5 + ((index % 3) * 0.12));
        const start = rotatePoint({
            x: Math.cos(angle) * coreRadius * 0.3,
            y: Math.sin(angle) * coreRadius * 0.3,
            z: 0.35,
        }, yaw, pitch);
        const end = rotatePoint({
            x: Math.cos(angle) * length,
            y: Math.sin(angle) * length,
            z: 0.65 + (descriptor.openness * 0.4),
        }, yaw, pitch);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(end.x, end.y, 0.25, 0.14, angle, 0, TAU);
        ctx.fill();
    }

    ctx.fillStyle = mixColor('#E6DCC4', color, 0.18, 0.62 * frontVisibility);
    ctx.beginPath();
    ctx.ellipse(0, 0, coreRadius * 0.72, coreRadius * 0.72 * ellipseCompression, ellipseRotation, 0, TAU);
    ctx.fill();
}

export function normalizeProjectedBlossomDescriptor(value = {}) {
    const bloomStage = ['bud', 'half_open', 'full'].includes(value.bloomStage)
        ? value.bloomStage
        : 'full';
    return Object.freeze({
        bloomStage,
        openness: clamp01(Number(value.openness ?? 0.75)),
        petalLength: clamp01(Number(value.petalLength ?? 0.68)),
        petalWidth: clamp01(Number(value.petalWidth ?? 0.54)),
        coreSize: clamp01(Number(value.coreSize ?? 0.24)),
        warmth: clamp01(Number(value.warmth ?? 0.5)),
        stamenBurst: clamp01(Number(value.stamenBurst ?? 0.56)),
        facingYaw: clamp(Number(value.facingYaw ?? 0), -Math.PI, Math.PI),
        facingPitch: clamp(Number(value.facingPitch ?? 0), -Math.PI / 2, Math.PI / 2),
        variant: clamp(Math.round(Number(value.variant ?? 0)), 0, 2),
    });
}

function resolveOpennessClass(descriptor) {
    if (descriptor.bloomStage === 'half_open' || descriptor.openness < 0.55) {
        return PROJECTED_BLOSSOM_ATLAS_OPENNESS[0];
    }
    if (descriptor.openness < 0.82) {
        return PROJECTED_BLOSSOM_ATLAS_OPENNESS[1];
    }
    return PROJECTED_BLOSSOM_ATLAS_OPENNESS[2];
}

function resolveViewClass(descriptor) {
    const normal = rotatePoint(
        { x: 0, y: 0, z: 1 },
        descriptor.facingYaw,
        descriptor.facingPitch,
    );
    if (normal.z >= 0.82) return PROJECTED_BLOSSOM_ATLAS_VIEWS[0];
    if (normal.z >= 0.28) return PROJECTED_BLOSSOM_ATLAS_VIEWS[1];
    if (normal.z > -0.28) return PROJECTED_BLOSSOM_ATLAS_VIEWS[2];
    return PROJECTED_BLOSSOM_ATLAS_VIEWS[3];
}

export function resolveProjectedBlossomAtlasDescriptor(value = {}) {
    const descriptor = normalizeProjectedBlossomDescriptor(value);
    const opennessClass = resolveOpennessClass(descriptor);
    const viewClass = resolveViewClass(descriptor);
    return Object.freeze({
        atlasId: `${opennessClass.id}:${viewClass.id}`,
        opennessId: opennessClass.id,
        openness: opennessClass.value,
        viewId: viewClass.id,
        facingYaw: viewClass.yaw,
        facingPitch: 0,
        mirrorX: Math.sin(descriptor.facingYaw) < 0,
    });
}

export function quantizeProjectedBlossomDescriptor(value = {}) {
    const descriptor = normalizeProjectedBlossomDescriptor(value);
    const atlasDescriptor = resolveProjectedBlossomAtlasDescriptor(descriptor);
    return Object.freeze({
        ...descriptor,
        bloomStage: atlasDescriptor.opennessId === 'half' ? 'half_open' : 'full',
        openness: atlasDescriptor.openness,
        facingYaw: atlasDescriptor.facingYaw,
        facingPitch: atlasDescriptor.facingPitch,
        variant: 0,
        petalLength: 0.68,
        petalWidth: 0.54,
        coreSize: 0.24,
        warmth: 0.5,
        stamenBurst: 0.56,
    });
}

export function createProjectedBlossomCacheKey(value = {}) {
    return resolveProjectedBlossomAtlasDescriptor(value).atlasId;
}

export function paintProjectedSakuraBlossom(ctx, input = {}) {
    const descriptor = quantizeProjectedBlossomDescriptor(input.blossom);
    const color = input.color || '#FFCDD2';
    const normal = rotatePoint(
        { x: 0, y: 0, z: 1 },
        descriptor.facingYaw,
        descriptor.facingPitch,
    );
    const frontFacing = normal.z >= 0;
    const petals = Array.from({ length: 5 }, (_, index) => createProjectedPetal({
        index,
        descriptor,
        yaw: descriptor.facingYaw,
        pitch: descriptor.facingPitch,
    })).sort((left, right) => left.depth - right.depth);

    drawProjectedSepals(
        ctx,
        descriptor,
        descriptor.facingYaw,
        descriptor.facingPitch,
        false,
    );
    petals.forEach((petal) => {
        const tip = petal.projected.notch;
        const base = petal.projected.base;
        const petalGradient = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
        const backTint = frontFacing ? 0 : 0.16;
        petalGradient.addColorStop(0, mixColor('#FFF9FB', color, 0.13 + backTint, 0.98));
        petalGradient.addColorStop(0.56, mixColor('#FFE4EC', color, 0.2 + backTint, 0.97));
        petalGradient.addColorStop(0.86, mixColor('#D3A8B4', color, 0.32 + backTint, 0.92));
        petalGradient.addColorStop(1, mixColor('#B48796', color, 0.42 + backTint, 0.68));
        ctx.fillStyle = petalGradient;
        traceProjectedPetal(ctx, petal);
        ctx.fill();
        ctx.strokeStyle = input.removeDotSpecks
            ? 'rgba(170,132,144,0.16)'
            : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.16;
        ctx.stroke();
    });
    drawProjectedCore(
        ctx,
        descriptor,
        descriptor.facingYaw,
        descriptor.facingPitch,
        color,
    );
    drawProjectedSepals(
        ctx,
        descriptor,
        descriptor.facingYaw,
        descriptor.facingPitch,
        true,
    );
}
