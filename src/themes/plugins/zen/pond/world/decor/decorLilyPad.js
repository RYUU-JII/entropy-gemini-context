import {
    WATER_LILY_STAGE_BUD,
    WATER_LILY_STAGE_OPENING,
    WATER_LILY_STAGE_BLOOM,
    normalizeWaterLilyStage,
    pickWaterLilyStage,
    drawWaterLily,
    drawWaterLilyClassic,
    drawWaterLilyRefined,
} from './decorLilyPadWaterLily.js';

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const clampRange = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

function pseudoRandom(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
}

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

const resolveDaylight = (envState) => {
    const lightIntensity = Math.max(0, Math.min(1.9, Number(envState?.lightIntensity) || 1));
    return clamp01((lightIntensity - 0.08) / 1.27);
};

const resolveWaterLilyLift = (stage) => {
    if (stage === WATER_LILY_STAGE_BUD) return 0.28;
    if (stage === WATER_LILY_STAGE_OPENING) return 0.44;
    return 0.58;
};

const resolveWaterLilyStemWeight = (stage) => {
    if (stage === WATER_LILY_STAGE_BUD) return 1;
    if (stage === WATER_LILY_STAGE_OPENING) return 0.22;
    return 0;
};

const accumulateLilyPadFishInfluence = (fish, distSq = null, _index = 0, scratch = null) => {
    if (!fish || !scratch) return;
    const owner = scratch.owner;
    if (!owner) return;
    const resolvedDistSq = Number.isFinite(distSq)
        ? distSq
        : (((Number(fish.x) || 0) - owner.x) ** 2 + ((Number(fish.y) || 0) - owner.y) ** 2);
    if (resolvedDistSq >= scratch.rangeSq) return;
    const distance = Math.sqrt(Math.max(0, resolvedDistSq));
    scratch.force += (1 - distance / scratch.range) * 0.15;
};

// ============================================================
// REFINED LILY PAD PROCEDURAL ENGINE
// ============================================================

function getPadEdgeRadius(angle, radius, seed = 1, segments = 13, edgeStrength = 0.105) {
    const normalized = ((angle % TAU) + TAU) % TAU;
    const u = (normalized / TAU) * segments;
    const index = Math.floor(u);
    const fraction = u - index;
    const t = smoothstep(fraction);

    const r1 = pseudoRandom(seed * 91.73 + (index % segments) * 13.17) - 0.5;
    const r2 = pseudoRandom(seed * 91.73 + ((index + 1) % segments) * 13.17) - 0.5;

    const chunky = lerp(r1, r2, t) * radius * edgeStrength;
    const macro = Math.sin(angle * 4.15 + seed * 1.31) * radius * 0.016;
    const fine = Math.sin(angle * 17 + seed * 2.1) * radius * 0.003;

    return radius + chunky + macro + fine;
}

function createLilyPadPath(ctx, radius, notchAngle = 0.48, seed = 1, segments = 13, edgeStrength = 0.105) {
    const start = notchAngle * 0.5;
    const end = TAU - notchAngle * 0.5;

    ctx.beginPath();
    ctx.moveTo(0, 0);

    const steps = 90;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = start + (end - start) * t;
        const r = getPadEdgeRadius(angle, radius, seed, segments, edgeStrength);
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }

    ctx.closePath();
}

function drawPadCorrugation(ctx, radius, notchAngle, seed, segments, edgeStrength, daylight = 1, neutralLighting = false) {
    const start = notchAngle * 0.5;
    const end = TAU - notchAngle * 0.5;
    const veinCount = 11; // Reduced for distinct character readability

    const lightX = neutralLighting ? 0 : -0.72;
    const lightY = neutralLighting ? 0 : -0.69;

    function traceFold(angle, length, bend, offsetX = 0, offsetY = 0) {
        const startR = radius * 0.055;
        const sx = Math.cos(angle) * startR + offsetX;
        const sy = Math.sin(angle) * startR + offsetY;
        const ex = Math.cos(angle) * length + offsetX;
        const ey = Math.sin(angle) * length + offsetY;

        const c1Angle = angle + bend * 0.3;
        const c2Angle = angle + bend;

        const c1x = Math.cos(c1Angle) * length * 0.31 + offsetX;
        const c1y = Math.sin(c1Angle) * length * 0.31 + offsetY;
        const c2x = Math.cos(c2Angle) * length * 0.7 + offsetX;
        const c2y = Math.sin(c2Angle) * length * 0.7 + offsetY;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
    }

    for (let i = 0; i < veinCount; i++) {
        const ratio = i / (veinCount - 1);
        const angle = start + (end - start) * ratio;
        const randomness = pseudoRandom(seed * 41 + i * 17);

        const length = radius * (0.73 + randomness * 0.18);
        const bend = (pseudoRandom(seed * 83 + i * 23) - 0.5) * 0.18;

        const normalX = -Math.sin(angle);
        const normalY = Math.cos(angle);

        const lightDot = normalX * lightX + normalY * lightY;
        const lightSide = lightDot >= 0 ? 1 : -1;

        const directionalStrength = 0.45 + Math.abs(lightDot) * 0.55;
        const randomStrength = 0.78 + pseudoRandom(seed * 141 + i * 31) * 0.35;
        const strength = directionalStrength * randomStrength;

        // Intermittent vivid highlights ("간헐적으로 진하게, 진짜 자연에서의 연잎처럼")
        const isHeroVein = (i % 3 === 0) || (i === 1 && lightDot > 0.4);
        const glossBurst = isHeroVein ? 1.7 : 0.85;

        // Multiply fold shadow
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.filter = 'blur(3.5px)';
        const shadowOffset = -3.0 * lightSide;
        traceFold(angle, length, bend, normalX * shadowOffset, normalY * shadowOffset);
        ctx.strokeStyle = `rgba(4,22,13,${0.11 * strength})`;
        ctx.lineWidth = Math.max(3.5, 9 + strength * 4);
        ctx.stroke();
        ctx.restore();

        // Screen fold highlight
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = 'blur(2.4px)';
        const highlightOffset = 2.4 * lightSide;
        traceFold(angle, length, bend, normalX * highlightOffset, normalY * highlightOffset);
        ctx.strokeStyle = `rgba(180,235,192,${0.11 * strength * glossBurst * Math.max(0.04, daylight)})`;
        ctx.lineWidth = Math.max(2.5, 6.5 + strength * 2.8);
        ctx.stroke();
        ctx.restore();

        // Screen fold sharp specular ridge
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = 'blur(0.8px)';
        const specularOffset = 1.1 * lightSide;
        traceFold(angle, length * 0.91, bend, normalX * specularOffset, normalY * specularOffset);
        ctx.strokeStyle = `rgba(230,255,228,${0.06 * strength * glossBurst * Math.max(0.04, daylight)})`;
        ctx.lineWidth = Math.max(0.9, 1.5 * glossBurst);
        ctx.stroke();
        ctx.restore();
    }

    // Waxy surface sheen spots (intermittently vivid on lit side)
    for (let i = 0; i < 9; i++) {
        const angle = pseudoRandom(seed * 230 + i * 61) * TAU;
        const distance = radius * (0.22 + pseudoRandom(seed * 270 + i * 71) * 0.52);

        const px = Math.cos(angle) * distance;
        const py = Math.sin(angle) * distance;
        const spotSize = radius * (0.12 + pseudoRandom(seed * 330 + i * 41) * 0.11);

        const isLitQuadrant = (px * lightX + py * lightY) > 0;
        const intermittentGain = isLitQuadrant ? (i % 2 === 0 ? 1.8 : 1.2) : 0.6;

        const highlight = ctx.createRadialGradient(
            px - spotSize * 0.28, py - spotSize * 0.32, 0,
            px, py, spotSize,
        );
        highlight.addColorStop(0, `rgba(215,250,215,${0.052 * intermittentGain * Math.max(0.04, daylight)})`);
        highlight.addColorStop(0.4, `rgba(160,225,180,${0.02 * intermittentGain * Math.max(0.04, daylight)})`);
        highlight.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = highlight;
        ctx.beginPath();
        ctx.ellipse(px, py, spotSize, spotSize * 0.67, angle + 0.5, 0, TAU);
        ctx.fill();

        const shadow = ctx.createRadialGradient(
            px + spotSize * 0.24, py + spotSize * 0.28, 0,
            px, py, spotSize * 1.05,
        );
        shadow.addColorStop(0, 'rgba(5,30,17,0.038)');
        shadow.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.ellipse(px, py, spotSize * 1.02, spotSize * 0.7, angle + 0.5, 0, TAU);
        ctx.fill();
    }
}

function drawPadRimLift(ctx, radius, notchAngle, seed, segments, edgeStrength, daylight = 1) {
    const rimLight = ctx.createLinearGradient(-radius, -radius, radius, radius);
    rimLight.addColorStop(0, `rgba(240,255,235,${0.18 * Math.max(0.04, daylight)})`);
    rimLight.addColorStop(0.25, `rgba(210,245,210,${0.08 * Math.max(0.04, daylight)})`);
    rimLight.addColorStop(0.55, 'rgba(255,255,255,0)');
    rimLight.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'blur(1.2px)';
    createLilyPadPath(ctx, radius, notchAngle, seed, segments, edgeStrength);
    ctx.strokeStyle = rimLight;
    ctx.lineWidth = Math.max(3, radius * 0.065);
    ctx.stroke();
    ctx.restore();

    const rimInnerShadow = ctx.createLinearGradient(-radius, -radius, radius, radius);
    rimInnerShadow.addColorStop(0, 'rgba(0,0,0,0)');
    rimInnerShadow.addColorStop(0.45, 'rgba(0,0,0,0.02)');
    rimInnerShadow.addColorStop(1, 'rgba(0,0,0,0.16)');

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = 'blur(1.6px)';
    createLilyPadPath(ctx, radius, notchAngle, seed, segments, edgeStrength);
    ctx.strokeStyle = rimInnerShadow;
    ctx.lineWidth = Math.max(3.5, radius * 0.075);
    ctx.stroke();
    ctx.restore();

    const outerShadow = ctx.createLinearGradient(-radius, -radius, radius, radius);
    outerShadow.addColorStop(0, 'rgba(0,0,0,0)');
    outerShadow.addColorStop(0.55, 'rgba(0,0,0,0.04)');
    outerShadow.addColorStop(1, 'rgba(0,0,0,0.25)');

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    createLilyPadPath(ctx, radius, notchAngle, seed, segments, edgeStrength);
    ctx.strokeStyle = outerShadow;
    ctx.lineWidth = Math.max(1.0, radius * 0.016);
    ctx.stroke();
    ctx.restore();

    const outerHighlight = ctx.createLinearGradient(-radius, -radius, radius, radius);
    outerHighlight.addColorStop(0, `rgba(245,255,240,${0.24 * Math.max(0.04, daylight)})`);
    outerHighlight.addColorStop(0.35, `rgba(215,245,215,${0.08 * Math.max(0.04, daylight)})`);
    outerHighlight.addColorStop(0.62, 'rgba(255,255,255,0)');
    outerHighlight.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    createLilyPadPath(ctx, radius, notchAngle, seed, segments, edgeStrength);
    ctx.strokeStyle = outerHighlight;
    ctx.lineWidth = Math.max(0.9, radius * 0.014);
    ctx.stroke();
    ctx.restore();
}

function drawDroplet(ctx, x, y, r, squash = 0.8) {
    if (r <= 0.5) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, squash);

    const shadow = ctx.createRadialGradient(
        r * 0.18, r * 0.25, 0,
        0, 0, r * 1.4,
    );
    shadow.addColorStop(0, 'rgba(0,15,12,0.22)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(r * 0.22, r * 0.3, r * 1.35, 0, TAU);
    ctx.fill();

    const drop = ctx.createRadialGradient(
        -r * 0.3, -r * 0.4, r * 0.05,
        0, 0, r,
    );
    drop.addColorStop(0, 'rgba(250,255,255,0.85)');
    drop.addColorStop(0.18, 'rgba(195,235,225,0.24)');
    drop.addColorStop(0.62, 'rgba(80,135,115,0.12)');
    drop.addColorStop(0.88, 'rgba(10,45,35,0.2)');
    drop.addColorStop(1, 'rgba(230,255,250,0.35)');

    ctx.fillStyle = drop;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(225,255,245,0.4)';
    ctx.lineWidth = Math.max(0.5, r * 0.1);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.arc(
        -r * 0.32,
        -r * 0.38,
        Math.max(0.8, r * 0.14),
        0, TAU,
    );
    ctx.fill();

    ctx.restore();
}

// ============================================================
// LILY PAD CLASS
// ============================================================

class LilyPad {
    constructor(x, y, size, flowerChance = 0.65, options = null) {
        const random = typeof options?.rng === 'function' ? options.rng : Math.random;
        const forcedFlower = typeof options?.hasFlower === 'boolean' ? options.hasFlower : null;
        const forcedStage = normalizeWaterLilyStage(options?.flowerStage);
        const resolvedSeed = typeof options?.seed === 'number' ? options.seed : (random() * 100 + 1);

        Object.assign(this, {
            x,
            y,
            size,
            seed: resolvedSeed,
            rotation: random() * Math.PI * 2,
            hasFlower: forcedFlower === null ? (random() < flowerChance) : forcedFlower,
            phase: random() * Math.PI * 2,
            notchAngle: random() * 0.3 + 0.35,
            colorCore: ['#2E7D32', '#388E3C', '#1B5E20'][Math.floor(random() * 3)],
            flowerColor: random() > 0.3 ? 'pink' : 'white',
            flowerStage: forcedStage || pickWaterLilyStage(random),
            flowerPhase: random() * Math.PI * 2,
            flowerStatePhase: random() * Math.PI * 2,
            flowerOffsetAngle: random() * TAU,
            flowerOffsetRadius: 0,
            flowerOffsetSwayPhase: random() * TAU,
            currentRotation: 0,
            flowerScale: 1,
            flowerStateScale: 1,
            edgeRippleSeed: resolvedSeed,
            edgeSegments: 13,
            edgeStrength: 0.105,
            scaleX: 1.025,
            scaleY: 0.985,
            dropletCount: 0,
            veinsCount: 11,
            timeSec: 0,
        });

        this.fishInfluenceScratch = {
            owner: this,
            force: 0,
            range: 1,
            rangeSq: 1,
        };

        if (this.hasFlower) {
            this.flowerOffsetRadius = this.size * (1.12 + random() * 0.42);
        }
        this.currentRotation = this.rotation;
    }

    update(dtSec, fishList) {
        const safeDtSec = Math.max(0, Number.isFinite(dtSec) ? dtSec : 1 / 60);
        this.timeSec += safeDtSec;
        const influenceRange = this.size + 40;
        const scratch = this.fishInfluenceScratch;
        scratch.force = 0;
        scratch.range = influenceRange;
        scratch.rangeSq = influenceRange * influenceRange;
        if (fishList && typeof fishList.forEachNearby === 'function') {
            fishList.forEachNearby(this.x, this.y, influenceRange, accumulateLilyPadFishInfluence, scratch);
        } else if (Array.isArray(fishList)) {
            for (let i = 0; i < fishList.length; i += 1) {
                accumulateLilyPadFishInfluence(fishList[i], null, i, scratch);
            }
        }

        const wind = Math.sin(this.timeSec * 0.9 + this.phase) * 0.04;
        this.currentRotation = this.rotation + wind + scratch.force;

        const stage = normalizeWaterLilyStage(this.flowerStage) || WATER_LILY_STAGE_BLOOM;
        const breathingAmp = stage === WATER_LILY_STAGE_BUD
            ? 0.006
            : (stage === WATER_LILY_STAGE_OPENING ? 0.012 : 0.02);
        this.flowerScale = 1 + Math.sin(this.timeSec * 0.6 + this.flowerPhase) * 0.005;
        this.flowerStateScale = 1 + Math.sin(this.timeSec * 0.42 + this.flowerStatePhase) * breathingAmp;
    }

    resolveFlowerAnchorLocal() {
        if (!this.hasFlower) return { x: 0, y: 0 };
        const stage = normalizeWaterLilyStage(this.flowerStage) || WATER_LILY_STAGE_BLOOM;
        const angleSway = Math.sin((this.timeSec * 0.26) + this.flowerOffsetSwayPhase) * 0.1;
        const radiusSway = Math.sin((this.timeSec * 0.41) + this.flowerOffsetSwayPhase * 1.7) * (this.size * 0.018);
        const angle = this.flowerOffsetAngle + angleSway;
        const rawRadius = this.flowerOffsetRadius + radiusSway;
        const minRadius = this.resolveFlowerAnchorMinRadius(angle, stage);
        const maxRadius = minRadius + this.size * (
            stage === WATER_LILY_STAGE_BUD
                ? 0.24
                : 0.4
        );
        const radius = clampRange(rawRadius, minRadius, maxRadius);
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius * 0.9,
        };
    }

    resolveFlowerAnchorMinRadius(angle, stage = null) {
        const safeAngle = ((Number(angle) || 0) % TAU + TAU) % TAU;
        const resolvedStage = normalizeWaterLilyStage(stage || this.flowerStage) || WATER_LILY_STAGE_BLOOM;
        const padRadius = this.resolvePadRadius(safeAngle, 1.02);
        const flowerFootprintRadius = (() => {
            if (resolvedStage === WATER_LILY_STAGE_BUD) return this.size * 0.34;
            if (resolvedStage === WATER_LILY_STAGE_OPENING) return this.size * 0.66;
            return this.size * 0.8;
        })();
        const waterGap = this.size * 0.06;
        return padRadius + flowerFootprintRadius + waterGap;
    }

    resolveWaterLilyStemGeometry(stage, flowerAnchor, waterLilyBaseSize, waterLilyRenderScale = 1) {
        const stemWeight = resolveWaterLilyStemWeight(stage);
        if (stemWeight <= 0) return null;

        const anchorX = Number(flowerAnchor?.x) || 0;
        const anchorY = Number(flowerAnchor?.y) || 0;
        const anchorDist = Math.hypot(anchorX, anchorY);
        if (anchorDist <= this.size * 0.08) return null;

        const dirX = anchorX / anchorDist;
        const dirY = anchorY / anchorDist;
        const tangentX = -dirY;
        const tangentY = dirX;

        const stemBacktrack = clampRange(
            this.size * (0.2 + ((1 - stemWeight) * 0.04)),
            this.size * 0.12,
            anchorDist * 0.88,
        );
        const rootDist = Math.max(this.size * 0.07, anchorDist - stemBacktrack);
        const rootX = dirX * rootDist;
        const rootY = dirY * rootDist;

        const socketScale = 0.298;
        const socketX = anchorX;
        const socketY = anchorY + (waterLilyBaseSize * waterLilyRenderScale * socketScale);
        const segmentLength = Math.hypot(socketX - rootX, socketY - rootY);
        if (segmentLength <= this.size * 0.05) return null;

        const bendBase = clampRange(segmentLength * 0.18, this.size * 0.04, this.size * 0.11);
        const bendSign = Math.sin(this.flowerOffsetAngle + this.phase) >= 0 ? 1 : -1;
        const bendSway = Math.sin((this.timeSec * 0.52) + (this.flowerOffsetSwayPhase * 1.31)) * bendBase * 0.34;
        const lateral = (bendBase * bendSign) + bendSway;

        const cpX = ((rootX + socketX) * 0.5) + (tangentX * lateral);
        const cpY = ((rootY + socketY) * 0.5) + (tangentY * lateral * 0.8) - (segmentLength * 0.08);
        const thickness = clampRange(this.size * (0.042 + (stemWeight * 0.008)), 1.05, 3.8);

        return {
            rootX,
            rootY,
            cpX,
            cpY,
            socketX,
            socketY,
            tangentX,
            tangentY,
            thickness,
        };
    }

    drawWaterLilyStem(ctx, stemGeometry, daylight, sunX, sunY) {
        if (!stemGeometry) return;

        const {
            rootX,
            rootY,
            cpX,
            cpY,
            socketX,
            socketY,
            tangentX,
            tangentY,
            thickness,
        } = stemGeometry;

        const shadowDx = sunX * 1.4;
        const shadowDy = sunY * 1.1;
        const highlightShift = thickness * 0.14;
        const stemGradient = ctx.createLinearGradient(rootX, rootY, socketX, socketY);
        stemGradient.addColorStop(0, `rgba(66, 112, 63, ${0.78 + (daylight * 0.08)})`);
        stemGradient.addColorStop(0.58, `rgba(92, 142, 76, ${0.74 + (daylight * 0.08)})`);
        stemGradient.addColorStop(1, `rgba(74, 118, 61, ${0.88 + (daylight * 0.06)})`);

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.strokeStyle = `rgba(6, 17, 11, ${0.18 + (daylight * 0.06)})`;
        ctx.lineWidth = thickness * 1.08;
        ctx.beginPath();
        ctx.moveTo(rootX + shadowDx, rootY + shadowDy);
        ctx.quadraticCurveTo(cpX + shadowDx, cpY + shadowDy, socketX + shadowDx, socketY + shadowDy);
        ctx.stroke();

        ctx.strokeStyle = stemGradient;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.moveTo(rootX, rootY);
        ctx.quadraticCurveTo(cpX, cpY, socketX, socketY);
        ctx.stroke();

        ctx.strokeStyle = `rgba(210, 238, 196, ${0.2 + (daylight * 0.09)})`;
        ctx.lineWidth = Math.max(0.45, thickness * 0.32);
        ctx.beginPath();
        ctx.moveTo(rootX - (tangentX * highlightShift), rootY - (tangentY * highlightShift));
        ctx.quadraticCurveTo(
            cpX - (tangentX * highlightShift),
            cpY - (tangentY * highlightShift),
            socketX - (tangentX * highlightShift * 0.6),
            socketY - (tangentY * highlightShift * 0.6),
        );
        ctx.stroke();

        ctx.fillStyle = `rgba(40, 79, 42, ${0.42 + (daylight * 0.1)})`;
        ctx.beginPath();
        ctx.ellipse(rootX, rootY, thickness * 0.72, thickness * 0.48, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = `rgba(52, 92, 48, ${0.5 + (daylight * 0.1)})`;
        ctx.beginPath();
        ctx.ellipse(socketX, socketY, thickness * 0.54, thickness * 0.35, 0, 0, TAU);
        ctx.fill();

        ctx.restore();
    }

    resolvePadRadius(angle, radiusScale = 1) {
        const seed = this.seed || this.edgeRippleSeed || 1;
        const segments = this.edgeSegments || 13;
        const edgeStrength = this.edgeStrength || 0.105;
        const rawRadius = getPadEdgeRadius(angle, this.size * radiusScale, seed, segments, edgeStrength);
        return clampRange(rawRadius, this.size * 0.75, this.size * 1.35);
    }

    containsWorldPoint(worldX, worldY, margin = 0) {
        const x = Number(worldX);
        const y = Number(worldY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        const safeMargin = Math.max(0, Number(margin) || 0);

        const dx = x - (Number(this.x) || 0);
        const dy = y - (Number(this.y) || 0);
        const maxRadius = this.size * 1.3 + safeMargin;
        if ((dx * dx + dy * dy) > (maxRadius * maxRadius)) return false;

        const rotation = Number(this.currentRotation ?? this.rotation) || 0;
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);
        const localX = (dx * cosR + dy * sinR) / (this.scaleX || 1.025);
        const localY = (-dx * sinR + dy * cosR) / (this.scaleY || 0.985);
        const angleRaw = Math.atan2(localY, localX);
        const angle = angleRaw < 0 ? angleRaw + TAU : angleRaw;

        const start = this.notchAngle * 0.5;
        const end = TAU - this.notchAngle * 0.5;
        if (angle < start || angle > end) return false;

        const radius = this.resolvePadRadius(angle, 1) + safeMargin;
        return (localX * localX + localY * localY) <= (radius * radius);
    }

    buildPadPath(ctx, radiusScale = 1) {
        const radius = this.size * radiusScale;
        const notchAngle = this.notchAngle;
        const seed = this.seed || this.edgeRippleSeed || 1;
        const segments = this.edgeSegments || 13;
        const edgeStrength = this.edgeStrength || 0.105;
        createLilyPadPath(ctx, radius, notchAngle, seed, segments, edgeStrength);
    }

    draw(ctx, envState = null, options = null) {
        if (options?.style === 'classic') {
            this.drawClassicPad(ctx, envState, options);
            return;
        }
        this.drawRefinedPad(ctx, envState, options);
    }

    drawRefinedPad(ctx, envState = null, options = null) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.currentRotation);
        ctx.scale(this.scaleX || 1.025, this.scaleY || 0.985);

        const renderGroundShadow = options?.renderGroundShadow !== false;
        const stage = normalizeWaterLilyStage(this.flowerStage) || WATER_LILY_STAGE_BLOOM;
        const daylight = resolveDaylight(envState);
        const flowerAnchor = this.resolveFlowerAnchorLocal();
        const sunAngleOffset = Number.isFinite(Number(envState?.sunAngle)) ? Number(envState.sunAngle) : Math.PI * 0.75;
        const sunX = Math.cos(sunAngleOffset);
        const sunY = Math.sin(sunAngleOffset);
        const baseShadowReach = Number.isFinite(Number(envState?.shadowLength))
            ? Number(envState.shadowLength) * 0.18
            : this.size * 0.34;

        const radius = this.size;
        const notchAngle = this.notchAngle;
        const seed = this.seed || this.edgeRippleSeed || 1;
        const segments = this.edgeSegments || 13;
        const edgeStrength = this.edgeStrength || 0.105;

        if (renderGroundShadow) {
            // Pad contact grounding shadow
            ctx.save();
            ctx.translate(sunX * baseShadowReach * 0.44, sunY * baseShadowReach * 0.44);
            ctx.scale(0.96, 0.9);
            ctx.fillStyle = `rgba(2, 12, 10, ${0.06 + daylight * 0.035})`;
            ctx.shadowColor = 'rgba(0, 7, 5, 0.22)';
            ctx.shadowBlur = Math.max(3, this.size * 0.22);
            createLilyPadPath(ctx, radius * 1.02, notchAngle, seed, segments, edgeStrength);
            ctx.fill();
            ctx.restore();

            // WaterLily shadow if present
            if (this.hasFlower) {
                const waterLilyBaseSize = this.size * 0.96;
                const waterLilyLift = resolveWaterLilyLift(stage) * (this.flowerStateScale || 1);
                const waterLilyShadowReach = baseShadowReach * (0.56 + waterLilyLift * 0.52);
                const waterLilyShadowAlpha = (0.048 + waterLilyLift * 0.045) * (0.74 + daylight * 0.4);
                const waterLilyShadowRx = waterLilyBaseSize * (0.46 + waterLilyLift * 0.18);
                const waterLilyShadowRy = waterLilyBaseSize * (0.22 + waterLilyLift * 0.12);
                ctx.save();
                ctx.translate(
                    flowerAnchor.x + (sunX * waterLilyShadowReach),
                    flowerAnchor.y + (sunY * waterLilyShadowReach) + this.size * 0.015,
                );
                ctx.fillStyle = `rgba(2, 11, 9, ${waterLilyShadowAlpha})`;
                ctx.shadowColor = 'rgba(0, 8, 6, 0.14)';
                ctx.shadowBlur = Math.max(2, waterLilyBaseSize * (0.16 + waterLilyLift * 0.12));
                ctx.beginPath();
                ctx.ellipse(0, 0, waterLilyShadowRx, waterLilyShadowRy, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        const neutralLighting = envState?.zenMaterialBake === true;
        // Base gradient body fill
        createLilyPadPath(ctx, radius, notchAngle, seed, segments, edgeStrength);
        const base = ctx.createRadialGradient(
            neutralLighting ? 0 : -radius * 0.35, neutralLighting ? 0 : -radius * 0.38, radius * 0.03,
            radius * 0.08, radius * 0.1, radius * 1.18,
        );
        base.addColorStop(0, '#5a9572');
        base.addColorStop(0.32, '#477e60');
        base.addColorStop(0.68, '#35644c');
        base.addColorStop(1, '#244633');

        ctx.fillStyle = base;
        ctx.fill();

        // Inner surface details under clip
        ctx.save();
        createLilyPadPath(ctx, radius, notchAngle, seed, segments, edgeStrength);
        ctx.clip();

        if (!neutralLighting) {
        // Directional ambient wash
        const directional = ctx.createLinearGradient(-radius, -radius, radius, radius);
        directional.addColorStop(0, 'rgba(225,250,220,0.15)');
        directional.addColorStop(0.28, 'rgba(155,220,170,0.07)');
        directional.addColorStop(0.62, 'rgba(90,175,125,0.015)');
        directional.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = directional;
        ctx.fillRect(-radius * 1.4, -radius * 1.4, radius * 2.8, radius * 2.8);
        ctx.restore();

        // Shadow gradient
        const shadowGrad = ctx.createRadialGradient(
            radius * 0.58, radius * 0.62, radius * 0.08,
            radius * 0.25, radius * 0.28, radius * 1.25,
        );
        shadowGrad.addColorStop(0, 'rgba(4,22,14,0.11)');
        shadowGrad.addColorStop(0.5, 'rgba(4,20,13,0.055)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(-radius * 1.4, -radius * 1.4, radius * 2.8, radius * 2.8);
        ctx.restore();

        }

        // Corrugation & intermittent waxy highlights
        drawPadCorrugation(ctx, radius, notchAngle, seed, segments, edgeStrength, daylight, neutralLighting);
        if (!neutralLighting) drawPadRimLift(ctx, radius, notchAngle, seed, segments, edgeStrength, daylight);

        // Secondary radiating veins & branches (11 veins for clear rhythm)
        const start = notchAngle * 0.5;
        const end = TAU - notchAngle * 0.5;
        const veinCount = 11;

        for (let i = 0; i < veinCount; i++) {
            const angle = start + (end - start) * (i / (veinCount - 1));
            const edgeR = getPadEdgeRadius(angle, radius, seed, segments, edgeStrength);

            const length = edgeR * (0.82 + pseudoRandom(seed * 17 + i) * 0.09);
            const bend = (pseudoRandom(seed * 23 + i) - 0.5) * 0.12;

            const ex = Math.cos(angle) * length;
            const ey = Math.sin(angle) * length;
            const cx = Math.cos(angle + bend) * length * 0.52;
            const cy = Math.sin(angle + bend) * length * 0.52;

            ctx.strokeStyle = 'rgba(220,245,215,0.11)';
            ctx.lineWidth = Math.max(0.7, radius * 0.015);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(cx, cy, ex, ey);
            ctx.stroke();

            if (i > 1 && i < veinCount - 2) {
                const bx = cx * 0.68;
                const by = cy * 0.68;
                const branchAngle = angle + (i % 2 === 0 ? 0.24 : -0.24);

                ctx.strokeStyle = 'rgba(220,245,215,0.055)';
                ctx.lineWidth = Math.max(0.5, radius * 0.01);
                ctx.beginPath();
                ctx.moveTo(bx, by);
                ctx.lineTo(
                    bx + Math.cos(branchAngle) * radius * 0.21,
                    by + Math.sin(branchAngle) * radius * 0.21,
                );
                ctx.stroke();
            }
        }

        // Center dark basin
        const center = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.27);
        center.addColorStop(0, 'rgba(3,28,16,0.18)');
        center.addColorStop(0.35, 'rgba(8,48,28,0.08)');
        center.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = center;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.27, 0, TAU);
        ctx.fill();

        ctx.restore(); // end clip

        // Outline rim
        createLilyPadPath(ctx, radius, notchAngle, seed, segments, edgeStrength);
        ctx.strokeStyle = 'rgba(185,230,180,0.31)';
        ctx.lineWidth = Math.max(0.8, radius * 0.02);
        ctx.stroke();

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        createLilyPadPath(ctx, radius, notchAngle, seed, segments, edgeStrength);
        ctx.strokeStyle = 'rgba(4,27,16,0.38)';
        ctx.lineWidth = Math.max(0.6, radius * 0.014);
        ctx.stroke();
        ctx.restore();

        // Notch split lines
        ctx.strokeStyle = 'rgba(7,32,19,0.43)';
        ctx.lineWidth = Math.max(0.7, radius * 0.016);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
            Math.cos(notchAngle * 0.5) * radius * 0.96,
            Math.sin(notchAngle * 0.5) * radius * 0.96,
        );
        ctx.moveTo(0, 0);
        ctx.lineTo(
            Math.cos(TAU - notchAngle * 0.5) * radius * 0.96,
            Math.sin(TAU - notchAngle * 0.5) * radius * 0.96,
        );
        ctx.stroke();

        // Flower if present
        if (this.hasFlower) {
            const waterLilyBaseSize = this.size * 0.96;
            const waterLilyRenderScale = this.flowerScale * (this.flowerStateScale || 1);
            const stemGeometry = this.resolveWaterLilyStemGeometry(stage, flowerAnchor, waterLilyBaseSize, waterLilyRenderScale);
            if (stemGeometry) {
                this.drawWaterLilyStem(ctx, stemGeometry, daylight, sunX, sunY);
            }
            ctx.save();
            ctx.translate(flowerAnchor.x, flowerAnchor.y);
            this.drawWaterLily(ctx, waterLilyBaseSize, waterLilyRenderScale);
            ctx.restore();
        }

        ctx.restore();
    }

    drawClassicPad(ctx, envState = null, options = null) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.currentRotation);
        const renderGroundShadow = options?.renderGroundShadow !== false;

        const stage = normalizeWaterLilyStage(this.flowerStage) || WATER_LILY_STAGE_BLOOM;
        const daylight = resolveDaylight(envState);
        const flowerAnchor = this.resolveFlowerAnchorLocal();
        const sunAngleOffset = Number.isFinite(Number(envState?.sunAngle)) ? Number(envState.sunAngle) : Math.PI * 0.75;
        const sunX = Math.cos(sunAngleOffset);
        const sunY = Math.sin(sunAngleOffset);
        const baseShadowReach = Number.isFinite(Number(envState?.shadowLength))
            ? Number(envState.shadowLength) * 0.18
            : this.size * 0.34;

        if (renderGroundShadow) {
            const padLift = 0.1;
            const padShadowReach = baseShadowReach * (0.44 + padLift * 0.28);
            const padShadowAlpha = (0.055 + padLift * 0.02) * (0.8 + daylight * 0.45);
            ctx.save();
            ctx.translate(sunX * padShadowReach, sunY * padShadowReach);
            ctx.scale(0.92, 0.86);
            ctx.fillStyle = `rgba(2, 12, 10, ${padShadowAlpha})`;
            ctx.shadowColor = 'rgba(0, 7, 5, 0.16)';
            ctx.shadowBlur = Math.max(2, this.size * 0.2);
            this.buildPadPath(ctx, 1.02);
            ctx.fill();
            ctx.restore();
        }

        if (!this.bodyGradient) {
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
            g.addColorStop(0, '#66C96B');
            g.addColorStop(0.56, this.colorCore);
            g.addColorStop(1, '#1F6126');
            this.bodyGradient = g;
        }

        ctx.fillStyle = this.bodyGradient;
        this.buildPadPath(ctx, 1);
        ctx.fill();

        ctx.save();
        this.buildPadPath(ctx, 1);
        ctx.clip();

        const edgeShadow = ctx.createRadialGradient(0, 0, this.size * 0.34, 0, 0, this.size * 1.12);
        edgeShadow.addColorStop(0, 'rgba(10, 28, 12, 0)');
        edgeShadow.addColorStop(0.68, 'rgba(10, 28, 12, 0.025)');
        edgeShadow.addColorStop(1, 'rgba(10, 28, 12, 0.11)');
        ctx.fillStyle = edgeShadow;
        ctx.fillRect(-this.size * 1.6, -this.size * 1.6, this.size * 3.2, this.size * 3.2);
        ctx.restore();

        if (this.hasFlower) {
            const waterLilyBaseSize = this.size * 0.96;
            const waterLilyRenderScale = this.flowerScale * (this.flowerStateScale || 1);
            const stemGeometry = this.resolveWaterLilyStemGeometry(stage, flowerAnchor, waterLilyBaseSize, waterLilyRenderScale);
            if (stemGeometry) {
                this.drawWaterLilyStem(ctx, stemGeometry, daylight, sunX, sunY);
            }
            ctx.save();
            ctx.translate(flowerAnchor.x, flowerAnchor.y);
            this.drawWaterLily(ctx, waterLilyBaseSize, waterLilyRenderScale);
            ctx.restore();
        }

        ctx.restore();
    }

    drawWaterLily(ctx, size, renderScale = 1) {
        drawWaterLily(this, ctx, size, renderScale);
    }
}

export {
    LilyPad,
    getPadEdgeRadius,
    createLilyPadPath,
    drawPadCorrugation,
    drawPadRimLift,
    drawDroplet,
};
