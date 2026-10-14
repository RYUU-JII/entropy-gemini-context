import {PROGRAM_SEMANTICS,FACTOR_IDS,validateFactors,projectPhenotype,supportFor} from './program.js';
let active=null;
export function withFactorGrowth(request,refine,run){
    if(active||typeof refine!=='boolean')throw Error('G15_FACTOR_SCOPE');
    validateFactors(request.factors);
    active={semantics:PROGRAM_SEMANTICS,seed:request.seed,programSeed:request.programSeed,
        amount:refine?request.strength:0,factors:Object.freeze(Object.fromEntries(FACTOR_IDS.map(id=>[id,request.factors[id]])))};
    try{return run();}finally{active=null;}
}
export const factorEnabled=()=>active!==null&&active.amount>0;

// Calibre governs the next proposed internode before continuity blending and
// resource funding. The same law applies to every tier, including birth proxies.
// This restores the useful maturation principle without a selected crown form.
export function factorExtension(context,frontier,requested){
    if(!factorEnabled())return null;
    const radius=frontier.radius,vigor=context.vigor;
    if(![radius,vigor,requested].every(v=>Number.isFinite(v)&&v>0))throw Error('G15_FACTOR_EXTENSION_INPUT');
    const attenuation=active.factors.attenuation;
    const capacity=radius*(16-12*attenuation)+vigor*(6-3*attenuation);
    const excess=Math.max(0,requested-capacity);
    const result=requested-active.amount*excess*excess/(excess+capacity*.2);
    return Object.freeze({semantics:'calibre_dependent_extension_demand_v1',radius,vigor,attenuation,
        amount:active.amount,capacity,requested,result});
}
export function factorPhenotype(original){
    return active&&active.amount>0?projectPhenotype(original,active.factors,active.amount):original;
}
export function factorDescriptor(){
    return active&&active.amount>0?{factorGrowth:Object.freeze({...active})}:{};
}
export function factorSupport(original){
    return active&&active.amount>0?supportFor(original,active.factors,active.amount):original;
}
export function factorGraphSupport(original,graph){
    const p=graph.contract.factorGrowth;
    if(p===undefined)return original;
    if(p.semantics!==PROGRAM_SEMANTICS||p.seed!==graph.seed||!Number.isInteger(p.programSeed)||p.programSeed<1||p.programSeed>0xffffffff
        ||!Number.isFinite(p.amount)||p.amount<=0||p.amount>1)throw Error('G15_FACTOR_GRAPH_CONTRACT');
    validateFactors(p.factors);
    for(const receipt of graph.developmentReceipts){
        if(!receipt.constructionAccount)continue;
        const r=receipt.constructionAccount.factorExtension;
        if(!r)throw Error('G15_FACTOR_EXTENSION_RECEIPT');
        const capacity=r.radius*(16-12*r.attenuation)+r.vigor*(6-3*r.attenuation);
        const excess=Math.max(0,r.requested-capacity),result=r.requested-r.amount*excess*excess/(excess+capacity*.2);
        if(r.semantics!=='calibre_dependent_extension_demand_v1'||r.amount!==p.amount||r.attenuation!==p.factors.attenuation
            ||![r.radius,r.vigor,r.capacity,r.requested,r.result].every(v=>Number.isFinite(v)&&v>0)
            ||Math.abs(r.capacity-capacity)>1e-8||Math.abs(r.result-result)>1e-8)throw Error('G15_FACTOR_EXTENSION_RECEIPT');
    }
    return supportFor(original,p.factors,p.amount);
}
