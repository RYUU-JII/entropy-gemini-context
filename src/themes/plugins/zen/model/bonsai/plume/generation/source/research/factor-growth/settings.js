const ACCEPTED_G15_RESEARCH_PROFILE=Object.freeze({constructionTreatment:'candidate',proportionTreatment:'balanced',maturationTreatment:'candidate',distalCrownTreatment:'candidate',apicalPlanningTreatment:'candidate',axisDevelopmentTreatment:'candidate'});
export function generationOptions(seed,growth=1,bloom=.92){
    return {...ACCEPTED_G15_RESEARCH_PROFILE,seed,maxEventBudget:160,compositionStrength:0,
        phenotype:{preset:'moyogi',form:'central_recursive_meander',trait:'balanced_natural',density:.9,
            corridorStrength:.85,woodPresentation:true,sakuraFlowering:true,nebari:true},
        lifeState:{phase:'mature',growth,bloom,vitality:.95,stress:.04,branchSag:0}};
}
export const sceneOptions=cameraBounds=>({cameraBounds,woodTreatment:'baseline',crownTreatment:'baseline',brushTreatment:'candidate',
    organTreatment:'candidate',proportionTreatment:'balanced',crownAllocationTreatment:'candidate',crownCommunityTreatment:'baseline'});
