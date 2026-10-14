const TAU = Math.PI * 2;

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const clampRange = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

const IRIS_LEAF_COLORS = Object.freeze([
    '#203A31',
    '#2A4938',
    '#335C43',
    '#416A4D',
    '#4F694B',
]);

const IRIS_BLOOM_COLORS = Object.freeze([
    '#8E83D8',
    '#B7A2F3',
    '#E4D7FF',
]);

const resolveDaylight = (envState) => {
    const lightIntensity = Math.max(0, Math.min(1.9, Number(envState?.lightIntensity) || 1));
    return clamp01((lightIntensity - 0.08) / 1.27);
};

const accumulateZenIrisFishInfluence = (fish, distSq = null, _index = 0, scratch = null) => {
    if (!fish || !scratch) return;
    const owner = scratch.owner;
    if (!owner) return;
    const resolvedDistSq = Number.isFinite(distSq)
        ? distSq
        : (((Number(fish.x) || 0) - owner.x) ** 2 + ((Number(fish.y) || 0) - owner.y) ** 2);
    if (resolvedDistSq >= scratch.rangeSq) return;
    const distance = Math.sqrt(Math.max(0, resolvedDistSq));
    scratch.force += (1 - distance / scratch.range) * 0.026;
};

class ZenIrisCluster {
    constructor(x, y, size, options = null) {
        const random = typeof options?.rng === 'function' ? options.rng : Math.random;
        const bladeCount = Math.max(
            10,
            Math.min(14, Math.round(Number(options?.bladeCount) || (10 + random() * 4))),
        );
        const blades = [];
        const angleSeed = random() * TAU;
        for (let i = 0; i < bladeCount; i += 1) {
            const ringT = bladeCount <= 0 ? 0 : i / bladeCount;
            blades.push({
                angleOffset: angleSeed + ringT * TAU + ((random() - 0.5) * 0.24),
                rootAdvance: size * (-0.04 + random() * 0.08),
                rootLateral: (random() - 0.5) * size * 0.16,
                lengthScale: 0.78 + random() * 0.68,
                widthScale: 0.72 + random() * 0.42,
                curve: (random() - 0.5) * 0.2,
                taper: 0.82 + random() * 0.14,
                edgeAsymmetry: (random() - 0.5) * 0.2,
                veinOffset: (random() - 0.5) * 0.14,
                colorIndex: Math.floor(random() * IRIS_LEAF_COLORS.length),
                depth: random(),
            });
        }
        blades.sort((left, right) => left.depth - right.depth);

        Object.assign(this, {
            x,
            y,
            size,
            rotation: 0,
            growthAngle: (
                Number(options?.growthAngle ?? options?.rotation) || -Math.PI * 0.5
            ) + ((random() - 0.5) * 0.08),
            bladeCount,
            blades,
            phase: random() * TAU,
            swayPhase: random() * TAU,
            bloomPhase: random() * TAU,
            hasBloom: typeof options?.hasBloom === 'boolean' ? options.hasBloom : random() < 0.2,
            bloomColor: IRIS_BLOOM_COLORS[Math.floor(random() * IRIS_BLOOM_COLORS.length)],
            bloomAngleOffset: random() * TAU,
            bloomRadius: size * (0.1 + random() * 0.16),
            crownOffset: (random() - 0.5) * size * 0.1,
            currentRotation: 0,
            currentScaleX: 1,
            currentScaleY: 1,
            timeSec: 0,
        });
        this.fishInfluenceScratch = {
            owner: this,
            force: 0,
            range: 1,
            rangeSq: 1,
        };
        this.currentRotation = this.rotation;
    }

    update(dtSec, fishList) {
        const safeDtSec = Math.max(0, Number.isFinite(dtSec) ? dtSec : 1 / 60);
        this.timeSec += safeDtSec;

        const influenceRange = this.size * 3.2 + 24;
        const scratch = this.fishInfluenceScratch;
        scratch.force = 0;
        scratch.range = influenceRange;
        scratch.rangeSq = influenceRange * influenceRange;
        if (fishList && typeof fishList.forEachNearby === 'function') {
            fishList.forEachNearby(this.x, this.y, influenceRange, accumulateZenIrisFishInfluence, scratch);
        } else if (Array.isArray(fishList)) {
            for (let i = 0; i < fishList.length; i += 1) {
                accumulateZenIrisFishInfluence(fishList[i], null, i, scratch);
            }
        }

        this.currentRotation = 0;
        this.currentScaleX = 1 + Math.sin(this.timeSec * 0.31 + this.phase) * 0.004;
        this.currentScaleY = 1 + Math.sin(this.timeSec * 0.27 + this.swayPhase) * 0.004;
    }

    draw(ctx, envState = null, options = null) {
        if (!ctx) return;
        const renderContactShadow = options?.renderContactShadow !== false;
        const daylight = resolveDaylight(envState);
        const baseX = Number(this.x) || 0;
        const baseY = Number(this.y) || 0;
        const size = Math.max(8, Number(this.size) || 18);
        const leafLight = 0.78 + daylight * 0.28;
        const growthAngle = Number.isFinite(Number(this.growthAngle))
            ? Number(this.growthAngle)
            : -Math.PI * 0.5;

        ctx.save();
        if (renderContactShadow) {
            const contact = ctx.createRadialGradient(
                baseX,
                baseY,
                size * 0.08,
                baseX,
                baseY,
                size * 0.96,
            );
            contact.addColorStop(0, 'rgba(2, 12, 10, 0.12)');
            contact.addColorStop(0.62, 'rgba(2, 12, 10, 0.045)');
            contact.addColorStop(1, 'rgba(2, 12, 10, 0)');
            ctx.fillStyle = contact;
            ctx.beginPath();
            ctx.ellipse(baseX, baseY, size * 1.28, size * 1.08, 0, 0, TAU);
            ctx.fill();
        }

        for (let i = 0; i < this.blades.length; i += 1) {
            const blade = this.blades[i];
            const depth = clamp01(blade.depth);
            const bladeAngle = growthAngle + (Number(blade.angleOffset) || 0);
            const dirX = Math.cos(bladeAngle);
            const dirY = Math.sin(bladeAngle);
            const normalX = -Math.sin(bladeAngle);
            const normalY = Math.cos(bladeAngle);
            const rootAdvance = Number(blade.rootAdvance) || 0;
            const rootLateral = Number(blade.rootLateral) || 0;
            const bladeBaseX = baseX + normalX * rootLateral + dirX * rootAdvance;
            const bladeBaseY = baseY + normalY * rootLateral + dirY * rootAdvance;
            const bladeLength = size * (1.02 + (Number(blade.lengthScale) || 1) * 0.88);
            const bladeWidth = clampRange(
                size * 0.18 * (Number(blade.widthScale) || 1),
                size * 0.1,
                size * 0.24,
            );
            const curve = Number(blade.curve) || 0;
            const taper = clampRange(Number(blade.taper) || 0.82, 0.58, 0.98);
            const edgeAsymmetry = Number(blade.edgeAsymmetry) || 0;
            const tipX = bladeBaseX + dirX * bladeLength;
            const tipY = bladeBaseY + dirY * bladeLength;
            const midX = (bladeBaseX + tipX) * 0.52 + normalX * curve * size * 0.56;
            const midY = (bladeBaseY + tipY) * 0.52 + normalY * curve * size * 0.56;
            const nearX = bladeBaseX + dirX * bladeLength * 0.2 + normalX * curve * size * 0.12;
            const nearY = bladeBaseY + dirY * bladeLength * 0.2 + normalY * curve * size * 0.12;
            const baseHalfWidth = bladeWidth * (0.36 + depth * 0.05);
            const leftMidHalfWidth = bladeWidth * taper * (1 - edgeAsymmetry * 0.1);
            const rightMidHalfWidth = bladeWidth * taper * (1 + edgeAsymmetry * 0.1);
            const tipInset = bladeWidth * (0.34 + depth * 0.08);
            const tipHalfWidth = bladeWidth * 0.08;
            const tipNoseX = tipX + dirX * bladeWidth * 0.04;
            const tipNoseY = tipY + dirY * bladeWidth * 0.04;
            const tipLeftX = tipX - dirX * tipInset - normalX * tipHalfWidth;
            const tipLeftY = tipY - dirY * tipInset - normalY * tipHalfWidth;
            const tipRightX = tipX - dirX * tipInset + normalX * tipHalfWidth;
            const tipRightY = tipY - dirY * tipInset + normalY * tipHalfWidth;
            const color = IRIS_LEAF_COLORS[blade.colorIndex] || IRIS_LEAF_COLORS[0];
            const shadeAlpha = 0.16 + depth * 0.12;

            ctx.save();
            ctx.globalAlpha = clampRange(0.72 + depth * 0.2, 0.56, 0.92);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(bladeBaseX - normalX * baseHalfWidth, bladeBaseY - normalY * baseHalfWidth);
            ctx.bezierCurveTo(
                nearX - normalX * bladeWidth * 0.64,
                nearY - normalY * bladeWidth * 0.64,
                midX - normalX * leftMidHalfWidth,
                midY - normalY * leftMidHalfWidth,
                tipLeftX,
                tipLeftY,
            );
            ctx.quadraticCurveTo(
                tipNoseX,
                tipNoseY,
                tipRightX,
                tipRightY,
            );
            ctx.bezierCurveTo(
                midX + normalX * rightMidHalfWidth,
                midY + normalY * rightMidHalfWidth,
                nearX + normalX * bladeWidth * 0.58,
                nearY + normalY * bladeWidth * 0.58,
                bladeBaseX + normalX * baseHalfWidth,
                bladeBaseY + normalY * baseHalfWidth,
            );
            ctx.closePath();
            ctx.fill();

            ctx.globalAlpha = clampRange((0.09 + daylight * 0.05) * (0.7 + depth * 0.24), 0.045, 0.15);
            ctx.strokeStyle = 'rgba(190, 214, 164, 0.52)';
            ctx.lineWidth = Math.max(0.35, bladeWidth * 0.09);
            ctx.beginPath();
            ctx.moveTo(
                bladeBaseX
                    + dirX * bladeLength * 0.08
                    + normalX * bladeWidth * (Number(blade.veinOffset) || 0) * 0.08,
                bladeBaseY
                    + dirY * bladeLength * 0.08
                    + normalY * bladeWidth * (Number(blade.veinOffset) || 0) * 0.08,
            );
            ctx.quadraticCurveTo(
                midX,
                midY,
                tipNoseX - dirX * tipInset * 0.16,
                tipNoseY - dirY * tipInset * 0.16,
            );
            ctx.stroke();

            if (i % 3 !== 1) {
                ctx.globalAlpha = clampRange(0.035 + daylight * 0.025, 0.025, 0.065);
                ctx.strokeStyle = 'rgba(7, 24, 17, 0.64)';
                ctx.lineWidth = Math.max(0.28, bladeWidth * 0.07);
                ctx.beginPath();
                ctx.moveTo(
                    bladeBaseX - normalX * bladeWidth * 0.24,
                    bladeBaseY - normalY * bladeWidth * 0.24,
                );
                ctx.quadraticCurveTo(
                    midX - normalX * bladeWidth * 0.3,
                    midY - normalY * bladeWidth * 0.3,
                    tipNoseX - dirX * tipInset * 0.36,
                    tipNoseY - dirY * tipInset * 0.36,
                );
                ctx.stroke();
            }

            ctx.globalAlpha = shadeAlpha * 0.6;
            ctx.strokeStyle = 'rgba(7, 20, 16, 0.42)';
            ctx.lineWidth = Math.max(0.28, bladeWidth * 0.08);
            ctx.beginPath();
            ctx.moveTo(bladeBaseX + normalX * bladeWidth * 0.32, bladeBaseY + normalY * bladeWidth * 0.32);
            ctx.quadraticCurveTo(
                midX + normalX * bladeWidth * 0.44,
                midY + normalY * bladeWidth * 0.44,
                tipNoseX - dirX * tipInset * 0.28,
                tipNoseY - dirY * tipInset * 0.28,
            );
            ctx.stroke();
            ctx.restore();
        }

        if (this.hasBloom) {
            const bloomAngle = (Number(this.bloomAngleOffset) || 0);
            const bloomRadius = Math.max(size * 0.1, Number(this.bloomRadius) || size * 0.24);
            const crownOffset = Number(this.crownOffset) || 0;
            const bloomCenterX = (
                baseX
                + Math.cos(bloomAngle) * bloomRadius
                + Math.cos(bloomAngle + Math.PI * 0.5) * crownOffset
            );
            const bloomCenterY = (
                baseY
                + Math.sin(bloomAngle) * bloomRadius
                + Math.sin(bloomAngle + Math.PI * 0.5) * crownOffset
            );
            const bloomSize = size * 0.13;
            ctx.save();
            ctx.translate(bloomCenterX, bloomCenterY);
            ctx.rotate(bloomAngle + Math.sin(this.bloomPhase) * 0.025);
            ctx.globalAlpha = clampRange(0.58 + daylight * 0.16, 0.46, 0.78);
            ctx.fillStyle = this.bloomColor;
            for (let i = 0; i < 5; i += 1) {
                const angle = (i * TAU / 5) + (i % 2) * 0.08;
                ctx.save();
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.ellipse(bloomSize * 0.42, 0, bloomSize * 0.42, bloomSize * 0.18, 0, 0, TAU);
                ctx.fill();
                ctx.restore();
            }
            ctx.fillStyle = 'rgba(246, 222, 126, 0.82)';
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(0.8, bloomSize * 0.18), 0, TAU);
            ctx.fill();
            ctx.restore();
        }

        ctx.globalAlpha = 0.16 * leafLight;
        ctx.fillStyle = 'rgba(226, 240, 198, 0.42)';
        ctx.beginPath();
        ctx.arc(baseX, baseY, size * 0.14, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.48;
        ctx.fillStyle = 'rgba(24, 54, 39, 0.86)';
        ctx.beginPath();
        ctx.ellipse(baseX, baseY, size * 0.24, size * 0.18, growthAngle * 0.18, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
}

export { ZenIrisCluster };
