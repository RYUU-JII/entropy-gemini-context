import {
    WATER_LILY_STAGE_BUD,
    WATER_LILY_STAGE_OPENING,
    WATER_LILY_STAGE_BLOOM,
    normalizeWaterLilyStage,
    pickWaterLilyStage,
    drawWaterLily,
} from './decorLilyPadWaterLily.js';

const TAU = Math.PI * 2;
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const clampRange = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

const resolveDaylight = (envState) => {
    const lightIntensity = Math.max(0, Math.min(1.9, Number(envState?.lightIntensity) || 1));
    return clamp01((lightIntensity - 0.08) / 1.27);
};

const resolveWaterLilyLift = (stage) => {
    if (stage === WATER_LILY_STAGE_BUD) return 0.28;
    if (stage === WATER_LILY_STAGE_OPENING) return 0.44;
    return 0.58;
};

const resolveSocketScale = (stage) => {
    if (stage === WATER_LILY_STAGE_BUD) return 0.298;
    if (stage === WATER_LILY_STAGE_OPENING) return 0.286;
    return 0.278;
};

const rotateVec = (x, y, angle) => {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    return {
        x: (x * cosA) - (y * sinA),
        y: (x * sinA) + (y * cosA),
    };
};

const accumulateWaterLilyFishInfluence = (fish, distSq = null, _index = 0, scratch = null) => {
    if (!fish || !scratch) return;
    const resolvedDistSq = Number.isFinite(distSq)
        ? distSq
        : (((Number(fish.x) || 0) - scratch.flowerX) ** 2 + ((Number(fish.y) || 0) - scratch.flowerY) ** 2);
    if (resolvedDistSq >= scratch.rangeSq) return;
    const distance = Math.sqrt(Math.max(0, resolvedDistSq));
    const influence = 1 - (distance / scratch.range);
    scratch.disturbance += influence * 0.22;
    const angleToFish = Math.atan2(
        (Number(fish.y) || 0) - scratch.rootY,
        (Number(fish.x) || 0) - scratch.rootX,
    );
    scratch.torque += Math.sin(angleToFish - scratch.stemAngle) * influence;
};

class WaterLilyBloom {
    constructor(x, y, size, options = null) {
        const random = typeof options?.rng === 'function' ? options.rng : Math.random;
        const safeSize = Math.max(8, Number(size) || 18);
        const forcedStage = normalizeWaterLilyStage(options?.flowerStage);
        const stemAngle = Number.isFinite(Number(options?.stemAngle))
            ? Number(options.stemAngle)
            : (random() * TAU);
        const stemLength = clampRange(
            Number(options?.stemLength) || (safeSize * (0.14 + random() * 0.2)),
            safeSize * 0.08,
            safeSize * 0.72,
        );
        const stemCurve = Number.isFinite(Number(options?.stemCurve))
            ? Number(options.stemCurve)
            : ((random() - 0.5) * safeSize * (0.18 + random() * 0.14));

        const resolvedFlowerColor = options?.flowerColor === 'white'
            ? 'white'
            : (options?.flowerColor === 'pink' ? 'pink' : (random() > 0.3 ? 'pink' : 'white'));

        Object.assign(this, {
            x: Number(x) || 0,
            y: Number(y) || 0,
            size: safeSize,
            stemAngle,
            stemLength,
            stemCurve,
            flowerColor: resolvedFlowerColor,
            flowerStage: forcedStage || pickWaterLilyStage(random),
            flowerPhase: random() * TAU,
            flowerStatePhase: random() * TAU,
            rootPhase: random() * TAU,
            currentRootOffsetX: 0,
            currentRootOffsetY: 0,
            flowerScale: 1,
            flowerStateScale: 1,
            currentRotation: 0,
            swayVelocity: 0,
            timeSec: 0,
        });

        this.flowerOffsetX = (Math.cos(this.stemAngle) * this.stemLength) - (Math.sin(this.stemAngle) * this.stemCurve);
        this.flowerOffsetY = (Math.sin(this.stemAngle) * this.stemLength * 0.9) + (Math.cos(this.stemAngle) * this.stemCurve * 0.36) - (this.size * 0.02);
        this.fishInfluenceScratch = {
            flowerX: 0,
            flowerY: 0,
            rootX: 0,
            rootY: 0,
            range: 1,
            rangeSq: 1,
            stemAngle: this.stemAngle,
            disturbance: 0,
            torque: 0,
        };
    }

    resolveRootWorld() {
        return {
            x: this.x + (Number(this.currentRootOffsetX) || 0),
            y: this.y + (Number(this.currentRootOffsetY) || 0),
        };
    }

    resolveFlowerWorld() {
        const root = this.resolveRootWorld();
        const rotatedOffset = rotateVec(
            this.flowerOffsetX,
            this.flowerOffsetY,
            Number(this.currentRotation) || 0,
        );
        return {
            x: root.x + rotatedOffset.x,
            y: root.y + rotatedOffset.y,
        };
    }

    update(dtSec, fishList = []) {
        const safeDtSec = Math.max(0, Number.isFinite(dtSec) ? dtSec : 1 / 60);
        this.timeSec += safeDtSec;

        const rootWorld = this.resolveRootWorld();
        const flowerWorld = this.resolveFlowerWorld();
        const influenceRange = this.size + 64;
        const scratch = this.fishInfluenceScratch;
        scratch.flowerX = flowerWorld.x;
        scratch.flowerY = flowerWorld.y;
        scratch.rootX = rootWorld.x;
        scratch.rootY = rootWorld.y;
        scratch.range = influenceRange;
        scratch.rangeSq = influenceRange * influenceRange;
        scratch.stemAngle = this.stemAngle;
        scratch.disturbance = 0;
        scratch.torque = 0;
        if (fishList && typeof fishList.forEachNearby === 'function') {
            fishList.forEachNearby(flowerWorld.x, flowerWorld.y, influenceRange, accumulateWaterLilyFishInfluence, scratch);
        } else if (Array.isArray(fishList)) {
            for (let i = 0; i < fishList.length; i += 1) {
                accumulateWaterLilyFishInfluence(fishList[i], null, i, scratch);
            }
        }

        this.currentRootOffsetX = Math.sin((this.timeSec * 0.24) + this.rootPhase) * this.size * 0.006;
        this.currentRootOffsetY = (
            Math.sin((this.timeSec * 0.37) + (this.rootPhase * 1.23)) * this.size * 0.011
            + (scratch.disturbance * this.size * 0.018)
        );

        const stage = normalizeWaterLilyStage(this.flowerStage) || WATER_LILY_STAGE_BLOOM;
        const breathingAmp = stage === WATER_LILY_STAGE_BUD
            ? 0.006
            : (stage === WATER_LILY_STAGE_OPENING ? 0.012 : 0.018);
        this.flowerScale = 1 + Math.sin((this.timeSec * 0.62) + this.flowerPhase) * 0.006;
        this.flowerStateScale = 1 + Math.sin((this.timeSec * 0.43) + this.flowerStatePhase) * breathingAmp;

        // Sway model: wind baseline + fish impulse torque + damped spring.
        const windTarget = (
            Math.sin((this.timeSec * 0.8) + this.rootPhase) * 0.034
            + Math.sin((this.timeSec * 0.47) + (this.rootPhase * 1.41)) * 0.014
        );
        const fishImpulse = clampRange(scratch.torque * 0.08, -0.18, 0.18);
        const targetRotation = windTarget + fishImpulse;
        const spring = 15.0;
        const damping = 7.4;
        this.swayVelocity += (targetRotation - this.currentRotation) * spring * safeDtSec;
        this.swayVelocity -= this.swayVelocity * damping * safeDtSec;
        this.swayVelocity = clampRange(this.swayVelocity, -2.2, 2.2);
        this.currentRotation = clampRange(
            this.currentRotation + (this.swayVelocity * safeDtSec),
            -0.24,
            0.24,
        );
    }

    draw(ctx, envState = null, options = null) {
        if (!ctx) return;
        const renderWaterLily = options?.renderWaterLily !== false;
        const renderStem = options?.renderStem !== false;
        const renderGroundShadow = options?.renderGroundShadow !== false;
        const stage = normalizeWaterLilyStage(this.flowerStage) || WATER_LILY_STAGE_BLOOM;
        const daylight = resolveDaylight(envState);
        const root = this.resolveRootWorld();
        const flower = this.resolveFlowerWorld();
        const waterLilySize = this.size;
        const waterLilyRenderScale = (Number(this.flowerScale) || 1) * (Number(this.flowerStateScale) || 1);
        const socketScale = resolveSocketScale(stage);
        const socketY = flower.y + (waterLilySize * waterLilyRenderScale * socketScale);

        if (renderStem) {
            const stemLift = resolveWaterLilyLift(stage);
            const cpX = ((root.x + flower.x) * 0.5) + (Math.cos(this.stemAngle + (Math.PI * 0.5)) * this.stemCurve * 0.28);
            const cpY = ((root.y + socketY) * 0.5) - (waterLilySize * (0.08 + stemLift * 0.05));
            const stemWidth = clampRange(waterLilySize * 0.065, 1.1, 4);

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.strokeStyle = `rgba(7, 19, 14, ${0.18 + (daylight * 0.06)})`;
            ctx.lineWidth = stemWidth * 1.12;
            ctx.beginPath();
            ctx.moveTo(root.x + 1.2, root.y + 1.0);
            ctx.quadraticCurveTo(cpX + 1.2, cpY + 1.0, flower.x + 1.2, socketY + 1.0);
            ctx.stroke();

            const stemGradient = ctx.createLinearGradient(root.x, root.y, flower.x, socketY);
            stemGradient.addColorStop(0, `rgba(63, 110, 61, ${0.75 + daylight * 0.08})`);
            stemGradient.addColorStop(0.5, `rgba(92, 140, 77, ${0.74 + daylight * 0.08})`);
            stemGradient.addColorStop(1, `rgba(74, 118, 61, ${0.9 + daylight * 0.06})`);
            ctx.strokeStyle = stemGradient;
            ctx.lineWidth = stemWidth;
            ctx.beginPath();
            ctx.moveTo(root.x, root.y);
            ctx.quadraticCurveTo(cpX, cpY, flower.x, socketY);
            ctx.stroke();

            ctx.fillStyle = `rgba(42, 82, 43, ${0.44 + daylight * 0.1})`;
            ctx.beginPath();
            ctx.ellipse(root.x, root.y, stemWidth * 0.7, stemWidth * 0.44, 0, 0, TAU);
            ctx.fill();

            ctx.fillStyle = `rgba(52, 94, 48, ${0.5 + daylight * 0.1})`;
            ctx.beginPath();
            ctx.ellipse(flower.x, socketY, stemWidth * 0.52, stemWidth * 0.33, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
        }

        if (!renderWaterLily) return;

        if (renderGroundShadow) {
            const waterLilyShadowReach = this.size * 0.12;
            const waterLilyShadowAlpha = (0.052 + resolveWaterLilyLift(stage) * 0.04) * (0.74 + daylight * 0.4);
            ctx.save();
            ctx.translate(flower.x, flower.y + waterLilyShadowReach);
            ctx.fillStyle = `rgba(2, 11, 9, ${waterLilyShadowAlpha})`;
            ctx.shadowColor = 'rgba(0, 8, 6, 0.14)';
            ctx.shadowBlur = Math.max(2, waterLilySize * 0.16);
            ctx.beginPath();
            ctx.ellipse(0, 0, waterLilySize * 0.42, waterLilySize * 0.22, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(flower.x, flower.y);
        this.drawWaterLily(ctx, waterLilySize, waterLilyRenderScale);
        ctx.restore();
    }

    drawWaterLily(ctx, size, renderScale = 1) {
        drawWaterLily(this, ctx, size, renderScale);
    }
}

export { WaterLilyBloom };
