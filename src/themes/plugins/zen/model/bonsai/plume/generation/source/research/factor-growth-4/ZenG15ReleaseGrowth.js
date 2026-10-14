import * as previous from '../factor-growth-3/ZenG15LateralInvestment.js';
import {zenG15OrganSample} from '../../engine/ZenBonsaiG15OrganDevelopment.js';
export * from '../factor-growth-3/ZenG15LateralInvestment.js';
let active=null;
import {TREATMENTS} from './contract.js';
const SEMANTICS='release_growth_and_seeded_crown_onset_v1';
const round=v=>Math.round(v*1e8)/1e8;
export function sampleCrownOnset(seed){
    const sample=zenG15OrganSample(seed,'release-growth-4','crown-onset');
    return Object.freeze({sample,internodes:2.9+sample*2.1});
}
export function withFactorGrowth(request,refine,run){
    if(active||typeof refine!=='boolean'||!TREATMENTS.includes(request.treatment))throw Error('G15_RELEASE_SCOPE');
    active={semantics:SEMANTICS,seed:request.seed,amount:refine?request.strength:0,treatment:request.treatment};
    try{return previous.withFactorGrowth(request,true,run);}finally{active=null;}
}
export function factorDescriptor(){
    return {...previous.factorDescriptor(),...(active?.amount>0?{releaseGrowth:{...active}}:{})};
}
// A release eligibility decision at the original episode/transaction owners.
// It never clips a downward branch or rejects a generated specimen.
export const releaseAllowsSag=()=>!(active?.amount>0&&active.treatment!=='base');
export function releaseCrownBase(original){
    if(!active?.amount||active.treatment==='release')return original;
    const onset=sampleCrownOnset(active.seed),target=original.targetInternodes+active.amount*(onset.internodes-original.targetInternodes);
    return Object.freeze({...original,targetInternodes:round(target),targetArcLength:round(original.referenceLength*target)});
}
export function factorGraphSupport(original,graph){
    const d=graph.contract.releaseGrowth;
    if(d!==undefined){
        if(d.semantics!==SEMANTICS||d.seed!==graph.seed||!TREATMENTS.includes(d.treatment)||d.amount!==graph.contract.factorGrowth?.amount)throw Error('G15_RELEASE_DESCRIPTOR');
        if(d.treatment!=='base'){
            if(graph.frontiers.some(f=>f.sag.active||f.episode.gravityResponse>0)
                ||graph.lineages.some(l=>l.birthEpisode.gravityResponse>0)
                ||graph.splits.some(s=>s.children.some(c=>c.sagActive)))throw Error('G15_RELEASE_SAG_ADMISSION');
        }
        if(d.treatment!=='release'){
            const root=graph.frontiers[0].meristemCadence.ontogeny;
            const target=sampleCrownOnset(graph.seed);
            if(d.amount===1&&Math.abs(root.targetInternodes-target.internodes)>1e-7)throw Error('G15_RELEASE_CROWN_ONSET');
        }
    }
    return previous.factorGraphSupport(original,graph);
}
