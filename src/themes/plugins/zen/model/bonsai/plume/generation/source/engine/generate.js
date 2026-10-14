// Snapshot of the product generation adapter; renderer/app adapters are excluded.
import { ZenBonsaiKernel, ZenBonsaiProductLifeStateAdapter } from './index.js';
import { resolveZenG15MaturationTreatment, resolveZenG15MaturationPhase } from './ZenBonsaiG15Maturation.js';
import { resolveZenG15DistalCrown } from './ZenBonsaiG15DistalCrown.js';
import { resolveZenG15ApicalPlanning } from './ZenBonsaiG15ApicalPlanning.js';
import { resolveZenG15AxisDevelopment } from './ZenBonsaiG15AxisDevelopment.js';
import { createZenG15CompositionPlan } from './ZenBonsaiG15ComposedCrown.js';
import {resolveZenG15Consolidation} from './ZenBonsaiG15DevelopmentDecisions.js';
import {resolveZenG15ForkAllocationStrength} from './ZenBonsaiG15ForkAllocation.js';

export const G15_MODEL_ID = 'g15_4';
export const G15_CONTRACT_ID = 'g15_4_typed_developmental_scheduler_species_v1';

export const DEFAULT_G15_PHENOTYPE = Object.freeze({
    preset: 'moyogi',
    form: 'central_recursive_meander',
    trait: 'balanced_natural',
    density: 0.9,
    corridorStrength: 0.85,
    woodPresentation: true,
    sakuraFlowering: true,
    nebari: true,
});

export function generateG15Topology({
    seed = 150031,
    lifeState = null,
    phenotype = DEFAULT_G15_PHENOTYPE,
    maxEventBudget = 160,
    preset = 'moyogi',
    constructionTreatment = 'candidate',
    proportionTreatment = 'baseline',
    maturationTreatment = 'baseline',
    distalCrownTreatment = 'baseline',
    apicalPlanningTreatment = 'baseline',
    axisDevelopmentTreatment = 'baseline',
    compositionStrength = 0,
    consolidationTreatment = 'baseline',
    forkAllocationStrength = 0,
    onDevelopmentDecision,
} = {}) {
    if (!['baseline', 'candidate'].includes(constructionTreatment)) {
        throw new Error('ZEN_G15_CONSTRUCTION_TREATMENT_INVALID');
    }
    resolveZenG15MaturationTreatment(maturationTreatment);
    resolveZenG15DistalCrown(distalCrownTreatment);
    resolveZenG15ApicalPlanning(apicalPlanningTreatment);
    resolveZenG15AxisDevelopment(axisDevelopmentTreatment);
    createZenG15CompositionPlan(Number(seed),compositionStrength);
    resolveZenG15Consolidation(consolidationTreatment);
    resolveZenG15ForkAllocationStrength(forkAllocationStrength);
    if(forkAllocationStrength>0&&consolidationTreatment!=='random')throw new Error('ZEN_G15_FORK_ALLOCATION_RANDOM_BASE_REQUIRED');
    if(consolidationTreatment!=='baseline'&&compositionStrength!==0)throw new Error('ZEN_G15_CONSOLIDATION_COMPOSITION_EXCLUSIVE');
    if(onDevelopmentDecision!==undefined&&typeof onDevelopmentDecision!=='function')throw new Error('ZEN_G15_DECISION_OBSERVER_INVALID');
    const maturationPhase = maturationTreatment === 'candidate' ? resolveZenG15MaturationPhase(lifeState?.growth) : null;
    const sceneConfig = ZenBonsaiProductLifeStateAdapter.adaptLifeStateToSceneConfig(
        maturationPhase ? { ...lifeState, growth: maturationPhase.structuralGrowth } : lifeState,
        { maxEventBudget },
    );

    const targetEventCount = sceneConfig.eventResolution.materializedEvents;

    const graph = ZenBonsaiKernel.generate({
        seed: Number(seed) || 150031,
        // Product time is already in absolute event units. Preset scaling is
        // reserved for direct kernel experiments, not a second product clock.
        eventBudget: targetEventCount,
        preset: phenotype?.preset || preset || 'moyogi',
        form: phenotype?.form || 'central_recursive_meander',
        trait: phenotype?.trait || 'balanced_natural',
        density: phenotype?.density ?? 0.9,
        corridorStrength: phenotype?.corridorStrength ?? 0.85,
        constructionTreatment,
        proportionTreatment,
        distalCrownTreatment,
        apicalPlanningTreatment,
        axisDevelopmentTreatment,
        compositionStrength,
        consolidationTreatment,
        forkAllocationStrength,
        onDevelopmentDecision,
    });

    return {
        graph,
        sceneConfig,
        lifeState,
        milestone: sceneConfig.eventResolution.milestone,
        milestoneIndex: sceneConfig.eventResolution.milestoneIndex,
        cacheSlotKey: sceneConfig.eventResolution.cacheSlotKey,
        seed,
        phenotype,
        engine: G15_MODEL_ID,
        axisDevelopmentTreatment,
        apicalPlanningTreatment,
        isG15: true,
        proportionTreatment,
        distalCrownTreatment,
        ...(maturationPhase ? { maturationPhase } : {}),
        constructionTreatment,
    };
}
