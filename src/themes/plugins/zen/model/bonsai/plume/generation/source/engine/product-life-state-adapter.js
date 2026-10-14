import {zenPlumeKernelRealm} from "../../kernelRealm.js";
/**
 * G15.4 Product LifeState Adapter.
 *
 * Translates product ZenBonsaiLifeState (phase, growth, vitality, stress, bloom,
 * branchSag, dryness, growthEvent, structuralImprint) into G15.4 developmental
 * kernel parameters, continuous sub-event growth interpolation, and presentation
 * modulation.
 */
import { resolveZenG15DevelopmentClock } from './ZenBonsaiG15DevelopmentClock.js';

(function installProductLifeStateAdapter(scope) {
    'use strict';

    const PRODUCT_ADAPTER_CONTRACT = 'g15_4_product_life_state_adapter_v1';

    const VITALITY_TIERS = Object.freeze({
        THRIVING: 'thriving',
        STEADY: 'steady',
        STRAINED: 'strained',
        WITHERED: 'withered',
    });

    const TIER_PRESETS = Object.freeze({
        [VITALITY_TIERS.THRIVING]: Object.freeze({
            tier: VITALITY_TIERS.THRIVING,
            vitality: 0.95,
            stress: 0.04,
            bloom: 0.92,
            dryness: 0.04,
            branchSag: 0.02,
            windResponse: 0.9,
            barkTone: 'radiant',
        }),
        [VITALITY_TIERS.STEADY]: Object.freeze({
            tier: VITALITY_TIERS.STEADY,
            vitality: 0.8,
            stress: 0.12,
            bloom: 0.52,
            dryness: 0.12,
            branchSag: 0.06,
            windResponse: 0.78,
            barkTone: 'balanced',
        }),
        [VITALITY_TIERS.STRAINED]: Object.freeze({
            tier: VITALITY_TIERS.STRAINED,
            vitality: 0.58,
            stress: 0.38,
            bloom: 0.15,
            dryness: 0.42,
            branchSag: 0.3,
            windResponse: 0.6,
            barkTone: 'weathered',
        }),
        [VITALITY_TIERS.WITHERED]: Object.freeze({
            tier: VITALITY_TIERS.WITHERED,
            vitality: 0.34,
            stress: 0.66,
            bloom: 0,
            dryness: 0.7,
            branchSag: 0.55,
            windResponse: 0.42,
            barkTone: 'parched',
        }),
    });

    // Descriptive labels only: event scheduling belongs to the development clock.
    const DEVELOPMENTAL_MILESTONES = Object.freeze([
        // Phase 1: Seedling & Shoot Emergence (0% - 20% overall growth)
        Object.freeze({ milestoneIndex: 0, growthThreshold: 0.00, phase: 'seedling', name: 'Radicle Sprout', bloomStage: 'none', bloomRatio: 0.0 }),
        Object.freeze({ milestoneIndex: 1, growthThreshold: 0.06, phase: 'seedling', name: 'Primary Shoot', bloomStage: 'none', bloomRatio: 0.0 }),
        Object.freeze({ milestoneIndex: 2, growthThreshold: 0.12, phase: 'seedling', name: 'Sapling Bole', bloomStage: 'none', bloomRatio: 0.0 }),
        Object.freeze({ milestoneIndex: 3, growthThreshold: 0.18, phase: 'seedling', name: 'Apical Emergence', bloomStage: 'none', bloomRatio: 0.0 }),

        // Phase 2: Juvenile Scaffold Formation (20% - 55% overall growth)
        Object.freeze({ milestoneIndex: 4, growthThreshold: 0.24, phase: 'juvenile', name: 'First Tier Fork', bloomStage: 'none', bloomRatio: 0.0 }),
        Object.freeze({ milestoneIndex: 5, growthThreshold: 0.32, phase: 'juvenile', name: 'Primary Scaffolds', bloomStage: 'none', bloomRatio: 0.0 }),
        Object.freeze({ milestoneIndex: 6, growthThreshold: 0.40, phase: 'juvenile', name: 'Lateral Arching', bloomStage: 'bud', bloomRatio: 0.18 }),
        Object.freeze({ milestoneIndex: 7, growthThreshold: 0.48, phase: 'juvenile', name: 'Sub-branching', bloomStage: 'bud', bloomRatio: 0.24 }),
        Object.freeze({ milestoneIndex: 8, growthThreshold: 0.56, phase: 'juvenile', name: 'Canopy Foundation', bloomStage: 'bud', bloomRatio: 0.32 }),

        // Phase 3: Crown Ramification (55% - 85% overall growth)
        Object.freeze({ milestoneIndex: 9, growthThreshold: 0.64, phase: 'mature', name: 'Mid-Crown Extension', bloomStage: 'half_open', bloomRatio: 0.52 }),
        Object.freeze({ milestoneIndex: 10, growthThreshold: 0.71, phase: 'mature', name: 'Lateral Ramification', bloomStage: 'half_open', bloomRatio: 0.72 }),
        Object.freeze({ milestoneIndex: 11, growthThreshold: 0.78, phase: 'mature', name: 'Upper Twig Density', bloomStage: 'full', bloomRatio: 0.84 }),
        Object.freeze({ milestoneIndex: 12, growthThreshold: 0.85, phase: 'mature', name: 'Canopy Formation', bloomStage: 'full', bloomRatio: 0.92 }),
        Object.freeze({ milestoneIndex: 13, growthThreshold: 0.90, phase: 'mature', name: 'Full Silhouette', bloomStage: 'full', bloomRatio: 1.0 }),

        // Phase 4: Mature Display & Blooming (85% - 100% overall growth)
        Object.freeze({ milestoneIndex: 14, growthThreshold: 0.93, phase: 'display', name: 'Terminal Spur Polish', bloomStage: 'full', bloomRatio: 1.0 }),
        Object.freeze({ milestoneIndex: 15, growthThreshold: 0.96, phase: 'display', name: 'Floral Crown Harmony', bloomStage: 'full', bloomRatio: 1.0 }),
        Object.freeze({ milestoneIndex: 16, growthThreshold: 0.98, phase: 'display', name: 'Mature Specimen', bloomStage: 'full', bloomRatio: 1.0 }),
        Object.freeze({ milestoneIndex: 17, growthThreshold: 1.00, phase: 'display', name: 'Mature Display', bloomStage: 'full', bloomRatio: 1.0 }),
    ]);

    const clamp = (value, min, max) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return min;
        return Math.min(max, Math.max(min, numeric));
    };

    const clamp01 = (value) => clamp(value, 0, 1);

    const round = (value, digits = 4) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 0;
        return Number(numeric.toFixed(digits));
    };

    function resolveVitalityTier(vitality, stress) {
        const v = clamp01(vitality);
        const s = clamp01(stress);
        const composite = v * 0.7 + (1 - s) * 0.3;
        if (composite >= 0.85) return VITALITY_TIERS.THRIVING;
        if (composite >= 0.65) return VITALITY_TIERS.STEADY;
        if (composite >= 0.42) return VITALITY_TIERS.STRAINED;
        return VITALITY_TIERS.WITHERED;
    }

    function createDefaultProductLifeState(phase = 'mature') {
        const safePhase = ['seedling', 'juvenile', 'mature', 'display'].includes(phase)
            ? phase
            : 'mature';
        const defaultBloom = safePhase === 'seedling'
            ? 0.0
            : (safePhase === 'juvenile' ? 0.4 : 0.92);
        return Object.freeze({
            phase: safePhase,
            growth: safePhase === 'seedling' ? 0.5 : (safePhase === 'juvenile' ? 0.75 : 1.0),
            vitality: 0.95,
            stress: 0.04,
            bloom: defaultBloom,
            dryness: 0.04,
            branchSag: 0.02,
            windResponse: 0.88,
            dataDays: 7,
            analysisConfidence: 1,
            growthEvent: Object.freeze({
                kind: 'none',
                strength: 0,
                milestone: 0,
            }),
            structuralImprint: Object.freeze({
                active: false,
                stressWood: 0,
                recoveryWood: 0,
                volatility: 0,
                canopyReserve: 0.5,
            }),
            vitalityTier: VITALITY_TIERS.THRIVING,
        });
    }

    function normalizeProductLifeState(source = {}) {
        const input = (source && typeof source === 'object') ? source : {};
        const phase = ['seedling', 'juvenile', 'mature', 'display'].includes(input.phase)
            ? input.phase
            : 'mature';
        const growth = clamp01(Number(input.growth ?? 1.0));
        let vitality = 0.95;
        let stress = 0.04;
        if (typeof input.vitality === 'string' && TIER_PRESETS[input.vitality]) {
            vitality = TIER_PRESETS[input.vitality].vitality;
            stress = TIER_PRESETS[input.vitality].stress;
        } else if (typeof input.vitalityTier === 'string' && TIER_PRESETS[input.vitalityTier]) {
            vitality = TIER_PRESETS[input.vitalityTier].vitality;
            stress = TIER_PRESETS[input.vitalityTier].stress;
        } else {
            if (input.vitality !== undefined) vitality = clamp01(Number(input.vitality));
            if (input.stress !== undefined) stress = clamp01(Number(input.stress));
        }
        const defaultBloom = phase === 'seedling'
            ? 0.0
            : (phase === 'juvenile' ? Math.max(0, (growth - 0.3) * 0.9) : 0.92);
        const bloom = input.bloom !== undefined
            ? clamp01(Number(input.bloom))
            : defaultBloom;
        const dryness = clamp01(Number(input.dryness ?? 0.04));
        const branchSag = clamp01(Number(input.branchSag ?? 0.02));
        const windResponse = clamp01(Number(input.windResponse ?? 0.88));
        const dataDays = Math.max(0, Math.floor(Number(input.dataDays ?? 7)));
        const analysisConfidence = clamp01(Number(input.analysisConfidence ?? 1));

        const rawEvent = input.growthEvent || {};
        const growthEvent = Object.freeze({
            kind: typeof rawEvent.kind === 'string' ? rawEvent.kind : 'none',
            strength: clamp01(Number(rawEvent.strength ?? 0)),
            milestone: Number.isFinite(Number(rawEvent.milestone))
                ? Number(rawEvent.milestone)
                : 0,
        });

        const rawImprint = input.structuralImprint || {};
        const structuralImprint = Object.freeze({
            active: rawImprint.active === true,
            stressWood: clamp01(Number(rawImprint.stressWood ?? 0)),
            recoveryWood: clamp01(Number(rawImprint.recoveryWood ?? 0)),
            volatility: clamp01(Number(rawImprint.volatility ?? 0)),
            canopyReserve: clamp01(Number(rawImprint.canopyReserve ?? 0.5)),
        });

        const vitalityTier = resolveVitalityTier(vitality, stress);

        return Object.freeze({
            phase,
            growth,
            vitality: round(vitality),
            stress: round(stress),
            bloom: round(bloom),
            dryness: round(dryness),
            branchSag: round(branchSag),
            windResponse: round(windResponse),
            dataDays,
            analysisConfidence: round(analysisConfidence),
            growthEvent,
            structuralImprint,
            vitalityTier,
        });
    }

    /**
     * Resolves continuous target events and fractional extension from growth.
     * Uses a global monotonic curve across 0.0~1.0 to eliminate phase-boundary step artifacts.
     */
    function resolveContinuousEventTarget(_phase, growth, maxAllowedEvents = 160) {
        const clock = resolveZenG15DevelopmentClock(growth, maxAllowedEvents);

        // Resolve active milestone index and cache slot
        const growthNormalized = clamp01(growth);
        let activeMilestone = DEVELOPMENTAL_MILESTONES[0];
        let activeIndex = 0;
        for (let i = DEVELOPMENTAL_MILESTONES.length - 1; i >= 0; i -= 1) {
            if (growthNormalized >= DEVELOPMENTAL_MILESTONES[i].growthThreshold) {
                activeMilestone = DEVELOPMENTAL_MILESTONES[i];
                activeIndex = i;
                break;
            }
        }
        const nextMilestone = DEVELOPMENTAL_MILESTONES[Math.min(DEVELOPMENTAL_MILESTONES.length - 1, activeIndex + 1)];
        const milestoneSpan = Math.max(0.001, nextMilestone.growthThreshold - activeMilestone.growthThreshold);
        const milestoneProgress = clamp01((growthNormalized - activeMilestone.growthThreshold) / milestoneSpan);

        return Object.freeze({
            ...clock,
            continuousEvent: clock.continuousEvents,
            milestone: activeMilestone,
            milestoneIndex: activeIndex,
            milestoneProgress: round(milestoneProgress, 3),
            cacheSlotKey: `g15_m${activeIndex}`,
        });
    }

    /**
     * Maps normalized LifeState into presentation and scene parameters.
     */
    function adaptLifeStateToSceneConfig(lifeStateInput, baseConfig = {}) {
        const lifeState = normalizeProductLifeState(lifeStateInput);
        const maxBudget = baseConfig.maxEventBudget === undefined ? 160 : baseConfig.maxEventBudget;
        const eventResolution = resolveContinuousEventTarget(
            lifeState.phase,
            lifeState.growth,
            maxBudget,
        );

        // Progressive ontogenetic bloom derivation
        // Dramatic Tension & Burst Pacing:
        // 0% ~ 35%: 0 bloom (pure wood foundation)
        // 35% ~ 60%: Tension build-up (0.10 ~ 0.28 bloom, dense cute buds on mature forks)
        // 60% ~ 80%: The Dramatic Bloom Burst! (0.28 -> 0.85 rapid blossom explosion)
        // 80% ~ 100%: Zen Full Harmony (0.85 -> 1.00 full cloud)
        const growth = lifeState.growth;
        let progressiveBloom = 0;
        let progressiveBloomStage = 'none';

        if (growth >= 0.80) {
            const frac = (growth - 0.80) / 0.20;
            progressiveBloom = 0.85 + frac * 0.15;
            progressiveBloomStage = 'full';
        } else if (growth >= 0.60) {
            const frac = (growth - 0.60) / 0.20;
            // Smoothstep S-curve for explosive floral burst
            const burstS = frac * frac * (3 - 2 * frac);
            progressiveBloom = 0.28 + burstS * 0.57;
            progressiveBloomStage = frac < 0.45 ? 'half_open' : 'full';
        } else if (growth >= 0.35) {
            const frac = (growth - 0.35) / 0.25;
            progressiveBloom = 0.10 + frac * 0.18;
            progressiveBloomStage = 'bud';
        }

        // Composite effective bloom with user/state bloom input
        const hasExplicitBloom = lifeStateInput && lifeStateInput.bloom !== undefined;
        const effectiveBloom = hasExplicitBloom
            ? lifeState.bloom
            : Math.max(progressiveBloom, lifeState.bloom);
        let bloomStage = progressiveBloomStage;
        if (effectiveBloom < 0.05) {
            bloomStage = 'none';
        } else if (effectiveBloom >= 0.75) {
            bloomStage = 'full';
        } else if (effectiveBloom >= 0.40) {
            bloomStage = 'half_open';
        } else if (effectiveBloom >= 0.05) {
            bloomStage = 'bud';
        }

        if (lifeState.vitalityTier === VITALITY_TIERS.WITHERED && bloomStage !== 'none') {
            bloomStage = 'bud';
        } else if (lifeState.vitalityTier === VITALITY_TIERS.STRAINED && bloomStage === 'full') {
            bloomStage = 'half_open';
        }

        // Effective flower coverage & density modulation
        const baseFlowerDensity = Number(baseConfig.floweringLoad ?? 1.2);
        const vitalityBloomFactor = lifeState.vitalityTier === VITALITY_TIERS.WITHERED
            ? 0.05
            : (lifeState.vitalityTier === VITALITY_TIERS.STRAINED ? 0.35 : 1);
        const effectiveFloweringLoad = round(baseFlowerDensity * effectiveBloom * vitalityBloomFactor, 3);

        // Bark dryness and moisture tone
        const barkTone = lifeState.dryness > 0.45
            ? 'parched'
            : (lifeState.vitality > 0.85 ? 'radiant' : 'balanced');

        // Milestone shoot aura
        const isMilestoneActive = lifeState.growthEvent.kind === 'milestone_shoot'
            && lifeState.growthEvent.strength > 0.3;

        return Object.freeze({
            contract: PRODUCT_ADAPTER_CONTRACT,
            lifeState,
            eventResolution,
            generatorParams: Object.freeze({
                maximumEvents: eventResolution.materializedEvents,
                subEventProgress: eventResolution.subEventProgress,
                continuousEvents: eventResolution.continuousEvents,
                milestoneIndex: eventResolution.milestoneIndex,
                cacheSlotKey: eventResolution.cacheSlotKey,
            }),
            presentationParams: Object.freeze({
                showWoodPresentation: true,
                bloomProgress: effectiveBloom,
                bloomStage,
                floweringLoad: effectiveFloweringLoad,
                terminalClusterCoverage: round(clamp01(lifeState.vitality * 0.9 + 0.1), 2),
                branchSag: lifeState.branchSag,
                stressWood: lifeState.structuralImprint.stressWood || lifeState.stress * 0.5,
                dryness: lifeState.dryness,
                barkTone,
                isMilestoneActive,
                milestoneShootStrength: lifeState.growthEvent.strength,
            }),
        });
    }

    const adapterAPI = Object.freeze({
        PRODUCT_ADAPTER_CONTRACT,
        VITALITY_TIERS,
        TIER_PRESETS,
        DEVELOPMENTAL_MILESTONES,
        resolveVitalityTier,
        createDefaultProductLifeState,
        normalizeProductLifeState,
        resolveContinuousEventTarget,
        adaptLifeStateToSceneConfig,
    });

    scope.ZenBonsaiProductLifeStateAdapter = adapterAPI;

})(typeof zenPlumeKernelRealm !== 'undefined' ? zenPlumeKernelRealm : this);
