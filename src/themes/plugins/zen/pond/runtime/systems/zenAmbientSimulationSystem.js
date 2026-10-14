import { createKoiNeighborGrid } from '../../model/koi/koiNeighborGrid.js';
import {
    assertZenSurfaceDisturbanceRuntimeRefs,
    resolveZenSurfaceDisturbancePriority,
    stepZenSurfaceDisturbance,
} from '../surface/zenSurfaceDisturbance.js';
import {
    resolveZenSceneAmbientSimulationPlan,
    resolveZenSceneCadenceProfile,
} from '../core/zenCadenceProfile.js';
import {
    isZenPondWorldEntityEnabled,
    isZenPondWorldSimulationEnabled,
    resolveZenPondWorldPolicy,
} from '../core/zenPondWorldProfile.js';
import { compactInPlace } from '../kernel/zenSimUtils.js';

const trimSurfaceDisturbancesToLimit = (surfaceDisturbancesRef, maxDisturbances) => {
    const disturbances = surfaceDisturbancesRef.current;
    const limit = Math.max(0, Math.floor(Number(maxDisturbances) || 0));
    while (disturbances.length > limit) {
        let weakestIndex = 0;
        let weakestPriority = Number.POSITIVE_INFINITY;
        for (let i = 0; i < disturbances.length; i += 1) {
            const priority = resolveZenSurfaceDisturbancePriority(disturbances[i]);
            if (priority < weakestPriority) {
                weakestPriority = priority;
                weakestIndex = i;
            }
        }
        disturbances.splice(weakestIndex, 1);
    }
};

const clamp = (value, min = 0, max = 1, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const resolvePetalField = ({
    frameState = null,
    envState = null,
    tuning = null,
    frameCount = 0,
} = {}) => {
    const channels = frameState?.channels || {};
    const atmosphere = channels?.atmosphere || {};
    const surface = channels?.surface || {};
    const frameEnv = frameState?.frameEnv || {};
    const activeEnv = envState && typeof envState === 'object' ? envState : {};
    const windIntensity = clamp(
        atmosphere.windIntensity ?? frameEnv.windIntensity ?? activeEnv.windIntensity ?? activeEnv.cloudDrift,
        0,
        1.6,
        0.4,
    );
    const windDirection = Number(
        atmosphere.windDirection
        ?? frameEnv.windDirection
        ?? activeEnv.windDirection
        ?? (Number(activeEnv.sunAngle) - Math.PI * 0.42)
    );
    const safeWindDirection = Number.isFinite(windDirection) ? windDirection : 0;
    const gustEnvelope = clamp(
        atmosphere.gustEnvelope ?? frameEnv.gustEnvelope ?? activeEnv.gustEnvelope,
        0,
        1,
        0.35,
    );
    const waveEnergy = clamp(surface.waveEnergy, 0, 1.4, 0.35);
    const roughness = clamp(surface.roughness, 0, 1.4, 0.32);
    const phase = Number(frameCount) * 0.017 + safeWindDirection * 0.37;
    const gustPulse = Math.sin(phase * (0.9 + gustEnvelope * 0.45)) * gustEnvelope;
    const windScale = windIntensity * (0.72 + gustEnvelope * 0.22 + gustPulse * 0.12);
    const windX = Math.cos(safeWindDirection) * windScale;
    const windY = Math.sin(safeWindDirection) * windScale * 0.42;
    const surfaceFlowScale = clamp(
        0.18 + waveEnergy * 0.34 + roughness * 0.16,
        0,
        1.2,
        0.28,
    );

    return {
        windIntensity,
        windDirection: safeWindDirection,
        windX,
        windY,
        gustEnvelope,
        surfaceFlowX: Math.cos(safeWindDirection) * surfaceFlowScale,
        surfaceFlowY: Math.sin(safeWindDirection) * surfaceFlowScale * 0.48,
        waveEnergy,
        roughness,
        phase,
    };
};

const resolveAmbientEntitySimulationPlan = (frameState = null) => {
    const worldPolicy = resolveZenPondWorldPolicy(frameState?.worldPolicy);
    const lilyPads = isZenPondWorldEntityEnabled(worldPolicy, 'lilyPads');
    const waterLilies = isZenPondWorldEntityEnabled(worldPolicy, 'waterLilies');
    const irises = isZenPondWorldEntityEnabled(worldPolicy, 'irises');
    return Object.freeze({
        particles: isZenPondWorldEntityEnabled(worldPolicy, 'particles'),
        petals: isZenPondWorldEntityEnabled(worldPolicy, 'petals'),
        glimmers: isZenPondWorldEntityEnabled(worldPolicy, 'glimmers'),
        surfaceDisturbances: isZenPondWorldSimulationEnabled(worldPolicy, 'waterMotion'),
        lilyPads,
        waterLilies,
        irises,
        plants: lilyPads || waterLilies || irises,
    });
};

export const createZenAmbientSimulationSystem = ({
    width,
    height,
    qualityProfile,
    fishRef,
    surfaceDisturbancesRef,
    surfaceDisturbanceTelemetryRef,
    rendererDebugTogglesRef,
    lilyPadsRef,
    waterLilyRef,
    zenIrisClustersRef,
    particlesRef,
    petalsRef,
    glimmersRef,
    tuningRef,
    frameStateRef,
    envStateRef,
} = {}) => {
    assertZenSurfaceDisturbanceRuntimeRefs({
        rendererDebugTogglesRef,
        surfaceDisturbanceTelemetryRef,
    });
    const sceneCadenceProfile = resolveZenSceneCadenceProfile(qualityProfile);
    const glimmerSimulationCadence = Math.max(
        1,
        Math.round(Number(sceneCadenceProfile?.ambient?.simulation?.glimmersEveryFrames) || 1),
    );
    const glimmerCleanupEverySteps = Math.max(
        1,
        Math.ceil((Number(qualityProfile?.glimmerCleanupEveryFrames) || 1) / glimmerSimulationCadence),
    );
    const petalSurfaceContextScratch = {
        lilyPads: null,
        petalField: null,
    };
    const plantFishGrid = createKoiNeighborGrid({ radius: 128, maxNeighbors: 3 });
    const plantFishQuery = {
        fishList: [],
        forEachNearby(x, y, radius, visit, context = null) {
            plantFishGrid.forEachNearby(this.fishList, x, y, radius, visit, context);
        },
    };
    const ambientSimulationState = {
        particleStepSec: 0,
        petalStepSec: 0,
        glimmerStepSec: 0,
        plantStepSec: 0,
        glimmerUpdateCount: 0,
    };

    const accumulateStepSec = (current, deltaSec, maxAccumulatedStepSec) => Math.min(
        maxAccumulatedStepSec,
        Math.max(0, Number(current) || 0) + Math.max(0, Number(deltaSec) || 0),
    );

    const resolveStepSec = (value, fallbackSec) => {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0.0001) return numeric;
        return Math.max(0, Number(fallbackSec) || 0);
    };

    const step = ({ simStepSec, frameCount, simTimeMs }) => {
        const currentTuning = tuningRef.current;
        const activeFrameState = frameStateRef?.current || null;
        const entityPlan = resolveAmbientEntitySimulationPlan(activeFrameState);
        const activeEnvState = activeFrameState?.envState || envStateRef?.current || {};
        const activePetalField = resolvePetalField({
            frameState: activeFrameState,
            envState: activeEnvState,
            tuning: currentTuning,
            frameCount,
        });
        const ambientSimulationPlan = resolveZenSceneAmbientSimulationPlan({
            frameCount,
            simTimeMs,
            sceneCadenceProfile,
        });
        const maxAccumulatedStepSec = Math.max(
            Math.max(0, Number(simStepSec) || 0),
            Number(ambientSimulationPlan.maxAccumulatedStepSec) || 0.09,
        );
        const fishes = Array.isArray(fishRef.current) ? fishRef.current : [];
        if (entityPlan.plants && ambientSimulationPlan.runPlants) {
            plantFishGrid.build(fishes);
            plantFishQuery.fishList = fishes;
        } else {
            plantFishQuery.fishList = [];
        }
        if (entityPlan.surfaceDisturbances) {
            trimSurfaceDisturbancesToLimit(
                surfaceDisturbancesRef,
                qualityProfile.maxSurfaceDisturbances,
            );
        } else {
            surfaceDisturbancesRef.current.length = 0;
        }
        ambientSimulationState.particleStepSec = accumulateStepSec(
            ambientSimulationState.particleStepSec,
            simStepSec,
            maxAccumulatedStepSec,
        );
        ambientSimulationState.petalStepSec = accumulateStepSec(
            ambientSimulationState.petalStepSec,
            simStepSec,
            maxAccumulatedStepSec,
        );
        ambientSimulationState.glimmerStepSec = accumulateStepSec(
            ambientSimulationState.glimmerStepSec,
            simStepSec,
            maxAccumulatedStepSec,
        );
        ambientSimulationState.plantStepSec = accumulateStepSec(
            ambientSimulationState.plantStepSec,
            simStepSec,
            maxAccumulatedStepSec,
        );

        if (entityPlan.particles && ambientSimulationPlan.runParticles) {
            const particleStepSec = resolveStepSec(ambientSimulationState.particleStepSec, simStepSec);
            ambientSimulationState.particleStepSec = 0;
            for (let i = 0; i < particlesRef.current.length; i += 1) {
                particlesRef.current[i].update(width, height, particleStepSec);
            }
        } else if (!entityPlan.particles) {
            ambientSimulationState.particleStepSec = 0;
        }
        if (entityPlan.plants && ambientSimulationPlan.runPlants) {
            const plantStepSec = resolveStepSec(ambientSimulationState.plantStepSec, simStepSec);
            ambientSimulationState.plantStepSec = 0;
            if (entityPlan.lilyPads) {
                for (let i = 0; i < lilyPadsRef.current.length; i += 1) {
                    lilyPadsRef.current[i].update(plantStepSec, plantFishQuery);
                }
            }
            if (entityPlan.waterLilies && waterLilyRef?.current) {
                for (let i = 0; i < waterLilyRef.current.length; i += 1) {
                    waterLilyRef.current[i]?.update?.(plantStepSec, plantFishQuery);
                }
            }
            if (entityPlan.irises && zenIrisClustersRef?.current) {
                for (let i = 0; i < zenIrisClustersRef.current.length; i += 1) {
                    zenIrisClustersRef.current[i]?.update?.(plantStepSec, plantFishQuery);
                }
            }
        } else if (!entityPlan.plants) {
            ambientSimulationState.plantStepSec = 0;
        }
        if (entityPlan.surfaceDisturbances) {
            compactInPlace(
                surfaceDisturbancesRef.current,
                (disturbance) => stepZenSurfaceDisturbance(disturbance, simStepSec),
            );
        }
        petalSurfaceContextScratch.lilyPads = lilyPadsRef.current;
        petalSurfaceContextScratch.petalField = activePetalField;
        if (!entityPlan.petals) petalsRef.current.length = 0;
        if (entityPlan.petals && ambientSimulationPlan.runPetals) {
            compactInPlace(petalsRef.current, (petal) => petal?.active !== false);
            const petalStepSec = resolveStepSec(ambientSimulationState.petalStepSec, simStepSec);
            ambientSimulationState.petalStepSec = 0;
            for (let i = 0; i < petalsRef.current.length; i += 1) {
                const petal = petalsRef.current[i];
                petal.update(
                    width,
                    height,
                    petalStepSec,
                    currentTuning,
                    petalSurfaceContextScratch,
                );
            }
            compactInPlace(petalsRef.current, (petal) => petal?.active !== false);
        } else if (!entityPlan.petals) {
            ambientSimulationState.petalStepSec = 0;
        }
        if (entityPlan.surfaceDisturbances) {
            trimSurfaceDisturbancesToLimit(
                surfaceDisturbancesRef,
                qualityProfile.maxSurfaceDisturbances,
            );
        }

        const maxGlimmers = Math.max(0, Math.floor(Number(qualityProfile.maxGlimmers) || 0));
        if (glimmersRef.current.length > maxGlimmers) {
            glimmersRef.current.length = maxGlimmers;
        }
        if (entityPlan.glimmers && ambientSimulationPlan.runGlimmers) {
            const glimmerStepSec = resolveStepSec(ambientSimulationState.glimmerStepSec, simStepSec);
            ambientSimulationState.glimmerStepSec = 0;
            ambientSimulationState.glimmerUpdateCount += 1;
            if (
                ambientSimulationState.glimmerUpdateCount % glimmerCleanupEverySteps === 0
                && glimmersRef.current.length
            ) {
                compactInPlace(glimmersRef.current, (glimmer) => glimmer.active || glimmer.spawnDelay > 0);
            }
            for (let i = 0; i < glimmersRef.current.length; i += 1) {
                glimmersRef.current[i].update(width, height, glimmerStepSec);
            }
        } else if (!entityPlan.glimmers) {
            ambientSimulationState.glimmerStepSec = 0;
        }
    };

    return {
        step,
        setWorldSize: (nextWidth, nextHeight) => { width = nextWidth; height = nextHeight; },
    };
};
