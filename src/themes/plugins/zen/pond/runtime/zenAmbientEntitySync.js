import {
    WaterParticle,
    GlimmerParticle,
} from '../world/decor/decorEntities.js';
import { isZenPondWorldEntityEnabled, resolveZenPondWorldPolicy } from './core/zenPondWorldProfile.js';
import {
    resolveZenAmbientPopulationTargetsFromFrameState,
} from './zenAmbientPopulationPlan.js';
import {
    buildZenRockLayout,
    buildZenRockLayoutKey,
    ZEN_ROCK_LAYOUT_KEY_PROP,
} from './zenRockLayoutSync.js';

const updateArray = (ref, targetCount, factory) => {
    if (ref.current.length < targetCount) {
        const diff = targetCount - ref.current.length;
        ref.current.push(...Array.from({ length: diff }, factory));
    } else if (ref.current.length > targetCount) {
        ref.current.splice(targetCount);
    }
};

const compactInactivePetals = (ref) => {
    if (!Array.isArray(ref?.current) || ref.current.length === 0) return;
    ref.current = ref.current.filter((petal) => petal?.active !== false);
};

export const syncAmbientEntities = ({
    width,
    height,
    tuning,
    qualityProfile,
    frameState = null,
    envState,
    rockSeedSalt = 0,
    particlesRef,
    petalsRef,
    glimmersRef,
    rocksRef,
    rockLayoutStrategy = null,
    worldPolicy = frameState?.worldPolicy,
}) => {
    if (!width || !height) return;
    const resolvedWorldPolicy = resolveZenPondWorldPolicy(worldPolicy);
    const renderParticles = isZenPondWorldEntityEnabled(resolvedWorldPolicy, 'particles');
    const renderPetals = isZenPondWorldEntityEnabled(resolvedWorldPolicy, 'petals');
    const renderGlimmers = isZenPondWorldEntityEnabled(resolvedWorldPolicy, 'glimmers');
    const renderRocks = isZenPondWorldEntityEnabled(resolvedWorldPolicy, 'rocks');

    const populationTargets = resolveZenAmbientPopulationTargetsFromFrameState({
        frameState,
        renderParticles,
        renderGlimmers,
    });
    const { populationPlan, targets } = populationTargets;
    const particleTargetCount = targets.particles;
    const glimmerCapacityCount = targets.glimmers;
    const syncResult = {
        populationPlan,
        targets: {
            particles: particleTargetCount,
            glimmers: glimmerCapacityCount,
        },
        render: {
            particles: renderParticles,
            petals: renderPetals,
            glimmers: renderGlimmers,
            rocks: renderRocks,
        },
    };

    updateArray(particlesRef, particleTargetCount, () => new WaterParticle(width, height));
    if (renderPetals) compactInactivePetals(petalsRef);
    else petalsRef.current = [];
    updateArray(glimmersRef, glimmerCapacityCount, () => new GlimmerParticle(width, height));
    if (renderGlimmers && glimmerCapacityCount > 0 && !glimmersRef.current.some((g) => g.active)) {
        const first = glimmersRef.current[0];
        if (first) {
            first.spawnDelay = 0;
            first.active = true;
            first.life = 0;
            first.size = 0;
        }
    }

    if (!renderRocks) {
        rocksRef.current = [];
        return syncResult;
    }

    const buildLayoutKey = rockLayoutStrategy?.buildLayoutKey || buildZenRockLayoutKey;
    const buildLayout = rockLayoutStrategy?.buildLayout || buildZenRockLayout;
    if (typeof buildLayoutKey !== 'function' || typeof buildLayout !== 'function') {
        throw new Error('ZEN_POND_ROCK_LAYOUT_STRATEGY_INVALID');
    }
    const layoutKey = buildLayoutKey({
        width,
        height,
        tuning,
        qualityProfile,
        rockSeedSalt,
    });
    const existingLayoutKey = Array.isArray(rocksRef.current)
        ? rocksRef.current[ZEN_ROCK_LAYOUT_KEY_PROP]
        : '';
    const shouldRebuildRocks = (
        !Array.isArray(rocksRef.current)
        || rocksRef.current.length === 0
        || existingLayoutKey !== layoutKey
    );
    if (shouldRebuildRocks) {
        rocksRef.current = buildLayout({
            width,
            height,
            tuning,
            qualityProfile,
            layoutKey,
        });
    }
    return syncResult;
};
