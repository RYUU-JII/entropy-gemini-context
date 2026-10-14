import * as previous from '../factor-growth-2/ZenG15FamilyMaturation.js';
export {factorEnabled,factorPhenotype,factorSupport,factorExtension,familyCompletion,familyCadence,familyLateralBirth,carryFamilyEpisode,carryFamilySag} from '../factor-growth-2/ZenG15FamilyMaturation.js';
let active=null;
const SEMANTICS='inherited_lateral_opportunity_and_funding_v1';
const clamp=v=>Math.max(0,Math.min(1,v));
export function withFactorGrowth(request,refine,run){
    if(active||typeof refine!=='boolean'||!['combined','opportunity','funding'].includes(request.mode))throw Error('G15_LATERAL_SCOPE');
    active={semantics:SEMANTICS,amount:refine?request.strength:0,mode:request.mode,factors:request.factors};
    try{return previous.withFactorGrowth({...request,mode:'combined'},true,run);}finally{active=null;}
}
export function factorDescriptor(){
    return {...previous.factorDescriptor(),...(active?.amount>0?{lateralInvestment:{semantics:SEMANTICS,amount:active.amount,mode:active.mode}}:{})};
}
// This is inherited developmental pressure, never a resource credit. Only a
// committed parent's own unfulfilled opportunity contributes; sibling branches
// remain free to differentiate through their original temperament and sample.
export function lateralOpportunity(context,spec,expected){
    if(!active?.amount||active.mode==='funding'||spec.tier!==1||spec.lateralParentId===undefined)return null;
    const parent=context.frontierIndex.get(spec.lateralParentId);
    if(!parent)throw Error('G15_LATERAL_PARENT');
    if(parent.tier!==1)return null;
    const portfolio=parent.constructionPortfolio;
    const prior=portfolio.lateralOpportunity;
    const inherited=prior===undefined?0:prior.debt;
    const unmet=Math.min(1,prior===undefined?portfolio.lateralOpportunityPotential:prior.expected)-portfolio.lateralReleasesCommitted;
    const debt=clamp(inherited*.6+unmet);
    const result=expected+active.amount*debt*(.2+.35*active.factors.cadence);
    return Object.freeze({semantics:SEMANTICS,parentId:parent.id,inherited,unmet,debt,expected,result,
        amount:active.amount,cadence:active.factors.cadence});
}
// A sampled lateral can draw enough of this axis's existing grant to be viable.
// The existing 30% ceiling and original .055 minimum remain authoritative.
export function lateralFraction(tier,grant,count,original){
    if(!active?.amount||active.mode==='opportunity'||tier!==1||count===0)return original;
    if(!(Number.isFinite(grant)&&grant>=0&&Number.isFinite(original)))throw Error('G15_LATERAL_FUNDING_INPUT');
    if(grant===0)return original;
    const required=Math.min(.3,(.05500002*count)/grant);
    return original+active.amount*Math.max(0,required-original);
}
export function factorGraphSupport(original,graph){
    const d=graph.contract.lateralInvestment;
    if(d!==undefined){
        if(d.semantics!==SEMANTICS||!['combined','opportunity','funding'].includes(d.mode)||d.amount!==graph.contract.factorGrowth?.amount)throw Error('G15_LATERAL_DESCRIPTOR');
        const parents=new Map(graph.frontiers.map(f=>[f.id,f]));
        for(const f of graph.frontiers){
            const r=f.constructionPortfolio?.lateralOpportunity;if(r===undefined)continue;
            const p=parents.get(r.parentId);
            if(!p||p.tier!==1||r.semantics!==SEMANTICS||r.amount!==d.amount||r.cadence!==graph.contract.factorGrowth.factors.cadence)throw Error('G15_LATERAL_RECEIPT');
            const pp=p.constructionPortfolio,inherited=pp.lateralOpportunity===undefined?0:pp.lateralOpportunity.debt;
            const unmet=Math.min(1,pp.lateralOpportunity===undefined?pp.lateralOpportunityPotential:pp.lateralOpportunity.expected)-pp.lateralReleasesCommitted;
            if(Math.abs(r.inherited-inherited)>1e-7||Math.abs(r.unmet-unmet)>1e-7||Math.abs(r.debt-clamp(inherited*.6+unmet))>1e-7
                ||Math.abs(r.result-(r.expected+r.amount*r.debt*(.2+.35*r.cadence)))>1e-7)throw Error('G15_LATERAL_HISTORY');
        }
    }
    return previous.factorGraphSupport(original,graph);
}
