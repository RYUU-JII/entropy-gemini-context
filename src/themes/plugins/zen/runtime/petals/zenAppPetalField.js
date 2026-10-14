import { MAX_ZEN_APP_PETALS } from './zenAppPetalBudget.js';
import { ZEN_PETAL_COLORS, ZEN_PETAL_SHAPE_COUNT } from './zenPetalMaterial.js';
import { requireZenAppPetalPresentation } from './zenAppPetalPresentation.js';
import { resolveZenPetalDepthProjection, resolveZenPetalDepthLayer, resolveZenPetalBaseSize, ZEN_PETAL_DEPTH_LAYERS } from './zenPetalDepth.js';
import { createZenPetalFlight, advanceZenPetalFlight, projectZenPetalTumble } from './zenPetalFlight.js';
import { compileZenPetalReleasePolicy, createZenPetalEventDirector } from './zenPetalEventDirector.js';

export { resolveZenAppPetalRate } from './zenPetalEmission.js';

const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export const createZenAppPetalRandom = (seed) => {
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

export const createZenAppPetalField = ({ generation, seed }) => {
    if (typeof generation !== 'string' || !generation || !Number.isInteger(seed)) {
        throw new Error('ZEN_APP_PETAL_FIELD_IDENTITY_REQUIRED');
    }
    const random = createZenAppPetalRandom(seed);
    const director = createZenPetalEventDirector(createZenAppPetalRandom(seed ^ 0x51ED270B));
    const particles = [];
    let sequence = 0;
    let emissionCredit = 0;
    let nextEmission = 0.7 + random() * 0.6;
    let activeTime = 0;
    let suppressedCount = 0;
    let inputs = null;
    let policyValues = null;
    let policyRevision = 0;

    const retirePendingLandings = () => {
        // A dispatched handoff may already be applied. Never resume/replay it
        // into the replacement scene after its cover or a late ACK.
        for (let index = particles.length - 1; index >= 0; index -= 1) {
            if (particles[index].pendingLanding) particles.splice(index, 1);
        }
    };

    const spawn = (width, height, bloomRatio) => {
        const sizeVariation = random();
        const depth = random();
        const depthLayer = resolveZenPetalDepthLayer(depth);
        const baseSize = resolveZenPetalBaseSize(depth, sizeVariation);
        const projection = resolveZenPetalDepthProjection(depth, height);
        const size = baseSize * projection.scale;
        const pale = random() < (1 - bloomRatio) * 0.2;
        const color = pale ? ZEN_PETAL_COLORS[0] : ZEN_PETAL_COLORS[Math.floor(random() * ZEN_PETAL_COLORS.length)];
        particles.push({
            id: `${generation}:${++sequence}`,
            x: random() * width,
            y: -size * 3 - random() * 32,
            size,
            baseSize,
            depth,
            depthLayer,
            blurIndex: projection.blurIndex,
            color,
            shapeType: Math.floor(random() * ZEN_PETAL_SHAPE_COUNT),
            rotation: random() * TAU,
            baseOpacity: 0.82 + random() * 0.14,
            opacity: 0,
            age: 0,
            ...createZenPetalFlight(random),
            velocityX: 0,
            velocityY: 0,
            tumbleX: 1,
            tumbleY: 1,
            // A virtual landing height is independent of pond position. Crossing a
            // pond's top edge is not itself a water collision.
            landingY: height * (0.12 + random() * 0.86),
            landingChecked: false,
            pendingLanding: false,
        });
    };

    const setInputs = ({ width, height, sourceSignal, wind, atmosphere, presentation, sampleTimeMs }) => {
        requireZenAppPetalPresentation(presentation);
        if (!wind || ![wind.intensity, wind.direction, wind.gust].every(Number.isFinite)) {
            throw new Error('ZEN_APP_PETAL_WIND_INVALID');
        }
        // Clock continuity is observation metadata, never a supply-cache key.
        director.observeSampleTime(sampleTimeMs);
        const values = [width, height, sourceSignal === null,
            sourceSignal === null ? 0 : sourceSignal.petalCapacity,
            sourceSignal === null ? 0 : sourceSignal.bloomRatio,
            sourceSignal === null ? 0 : sourceSignal.petalFallLimit,
            sourceSignal === null ? 0 : sourceSignal.previewPetalRate,
            wind.intensity, wind.gust, atmosphere?.petals, atmosphere?.rainIntensity,
            atmosphere?.weatherEventId, atmosphere?.weatherEventPhase];
        if (policyValues === null || values.some((value, index) => value !== policyValues[index])) {
            director.setPolicy(compileZenPetalReleasePolicy({ width, height, sourceSignal, wind, atmosphere }), presentation.mode);
            policyValues = values;
            policyRevision += 1;
        }
        // Presentation changes invalidate weather observations without rebuilding
        // the density policy or creating a fresh field/scene emission owner.
        director.setPresentation(presentation.mode);
        // Copy the mutable boundary values; simulation never reprojects supply.
        inputs = { width, height, wind: { ...wind }, rainIntensity: atmosphere.rainIntensity, presentation: { ...presentation } };
        if (!presentation.landingEnabled) retirePendingLandings();
    };

    const step = ({ dtSec }) => {
        if (!Number.isFinite(dtSec) || dtSec < 0 || dtSec > 0.1) {
            throw new Error('ZEN_APP_PETAL_ACTIVE_STEP_INVALID');
        }
        if (inputs === null) throw new Error('ZEN_APP_PETAL_INPUTS_REQUIRED');
        const { width, height, wind, rainIntensity, presentation } = inputs;
        if (!presentation.landingEnabled) retirePendingLandings();
        // Keep the existing airborne identities and active clock behind the
        // opaque cover. Scene readiness never creates emission debt.
        if (presentation.mode === 'covered') return [];
        activeTime += dtSec;
        const { mass, bloomRatio } = director.advance(dtSec, presentation.mode);
        emissionCredit += mass;
        while (emissionCredit >= nextEmission) {
            emissionCredit -= nextEmission;
            nextEmission = 0.7 + random() * 0.6;
            if (particles.length < MAX_ZEN_APP_PETALS) spawn(width, height, bloomRatio);
            else suppressedCount += 1; // Cosmetic budget admission; no later backlog.
        }
        const candidates = [];
        for (let index = particles.length - 1; index >= 0; index -= 1) {
            const petal = particles[index];
            if (petal.pendingLanding) continue;
            const projection = resolveZenPetalDepthProjection(petal.depth, petal.landingY - petal.y);
            const surfaceLayer = petal.depthLayer === ZEN_PETAL_DEPTH_LAYERS.SURFACE;
            petal.age += dtSec;
            advanceZenPetalFlight(petal, { wind, activeTime, motionScale: projection.motionScale, dtSec, rainIntensity });
            const previousX = petal.x, previousY = petal.y;
            petal.x += petal.velocityX * dtSec;
            petal.y += petal.velocityY * dtSec;
            const crossing = surfaceLayer && !petal.landingChecked && petal.y >= petal.landingY;
            if (crossing && presentation.landingEnabled) {
                // Intersect the swept path with the sampled plane. A long frame
                // must not place the petal past its landing point or pond edge.
                const fraction = clamp((petal.landingY - previousY) / (petal.y - previousY), 0, 1);
                petal.x = previousX + (petal.x - previousX) * fraction;
                petal.y = petal.landingY;
            }
            const visualProjection = resolveZenPetalDepthProjection(petal.depth, petal.landingY - petal.y);
            petal.size = petal.baseSize * visualProjection.scale;
            petal.blurIndex = visualProjection.blurIndex;
            const landingBlend = surfaceLayer ? clamp(Math.abs(petal.landingY - petal.y) / 70, 0, 1) : 1;
            projectZenPetalTumble(petal, landingBlend);
            petal.opacity = petal.baseOpacity * clamp(petal.age / 0.45, 0, 1);
            if (crossing) {
                petal.landingChecked = true;
                petal.pendingLanding = presentation.landingEnabled;
                petal.tumbleX = 1;
                petal.tumbleY = 1;
                if (presentation.landingEnabled) candidates.push({
                    id: petal.id, depthLayer: petal.depthLayer, x: petal.x, y: petal.y, size: petal.size,
                    rotation: petal.rotation, color: petal.color, shapeType: petal.shapeType,
                    opacity: petal.opacity, velocityX: petal.velocityX, velocityY: petal.velocityY,
                });
            }
            // Close, rotated petals retain their full blurred footprint while
            // exiting; the old fixed margin could clip their lower fringe.
            const exitMargin = Math.max(40, petal.size * 2);
            if (petal.y > height + exitMargin || petal.x < -80 || petal.x > width + 80 || petal.age > 60) {
                particles.splice(index, 1);
            }
        }
        return candidates;
    };

    return {
        setInputs,
        step,
        particles,
        retirePendingLandings,
        isIdle: () => particles.length === 0 && director.getDiagnostics().openingWeight === 0,
        settleLandings(candidates, acceptedIds) {
            const accepted = new Set(acceptedIds);
            const candidateIds = new Set(candidates.map(({ id }) => id));
            for (let index = particles.length - 1; index >= 0; index -= 1) {
                const petal = particles[index];
                if (accepted.has(petal.id)) particles.splice(index, 1);
                else if (candidateIds.has(petal.id)) petal.pendingLanding = false;
            }
        },
        clear() {
            particles.length = 0;
            emissionCredit = 0;
            director.resetTransient();
        },
        getDiagnostics: () => ({ activeCount: particles.length, emittedCount: sequence, suppressedCount, activeTime,
            policyRevision, ...director.getDiagnostics() }),
    };
};
