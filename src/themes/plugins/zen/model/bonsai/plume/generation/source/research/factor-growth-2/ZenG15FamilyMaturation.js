import * as previous from '../factor-growth/ZenG15FactorGrowth.js';
export {factorEnabled,factorPhenotype,factorSupport,factorExtension} from '../factor-growth/ZenG15FactorGrowth.js';
let active=null;
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
const SEMANTICS='anatomical_family_maturation_v1';
export function withFactorGrowth(request,refine,run){
    if(active||typeof refine!=='boolean')throw Error('G15_FAMILY_SCOPE');
    if(!['combined','cadence','maturation'].includes(request.mode))throw Error('G15_FAMILY_REQUEST_MODE');
    active={semantics:SEMANTICS,seed:request.seed,amount:refine?request.strength:0,factors:request.factors,mode:request.mode};
    try{return previous.withFactorGrowth(request,true,run);}finally{active=null;}
}
export function factorDescriptor(){
    return{...previous.factorDescriptor(),...(active?.amount>0?{familyMaturation:{semantics:SEMANTICS,seed:active.seed,amount:active.amount,mode:active.mode}}:{})};
}
function carriesSag(parent,axisOrder){
    return Boolean(active?.amount>0&&axisOrder>0&&axisOrder===parent.axisOrder
        &&parent.sag.active&&parent.sag.age<parent.sag.recoveryAfter&&parent.episode.gravityResponse>0);
}
export function carryFamilyEpisode(parent,spec,episode){
    if(!carriesSag(parent,spec.axisOrder))return episode;
    return Object.freeze({...episode,kind:'sag_commit',archetype:'gravity_release',gravityResponse:parent.episode.gravityResponse,
        familySagContinuation:Object.freeze({semantics:'unfinished_parent_sag_continuation_v1',parentFrontierId:parent.id,
            parentEpisodeId:parent.episode.id,age:parent.sag.age,recoveryAfter:parent.sag.recoveryAfter,
            gravityResponse:parent.episode.gravityResponse})});
}
export function carryFamilySag(parent,child,sag){
    if(!carriesSag(parent,child.axisOrder))return sag;
    return Object.freeze({active:true,age:parent.sag.age,recoveryAfter:parent.sag.recoveryAfter});
}

// Follow only committed ancestors in the same original scaffold family. A
// fork/flush can renew axis age but cannot reset this travelled anatomical arc.
export function readFamilyHistory({nodes,segments,lineages},nodeId,familyId){
    let node=nodes.get(nodeId),arc=0,birthRadius=null;
    if(!node||typeof familyId!=='string')throw Error('G15_FAMILY_HISTORY_INPUT');
    const visited=new Set();
    while(node.incomingSegmentId){
        if(visited.has(node.id))throw Error('G15_FAMILY_HISTORY_CYCLE');visited.add(node.id);
        const segment=segments.get(node.incomingSegmentId);
        if(!segment)throw Error('G15_FAMILY_HISTORY_SEGMENT');
        const lineage=lineages.get(segment.lineageId);
        if(!lineage)throw Error('G15_FAMILY_HISTORY_LINEAGE');
        if(lineage.scaffoldFamilyGesture?.gestureId!==familyId)break;
        if(!(segment.length>0&&segment.startRadius>0))throw Error('G15_FAMILY_HISTORY_SCALE');
        arc+=segment.length;birthRadius=segment.startRadius;node=nodes.get(segment.fromNodeId);
        if(!node)throw Error('G15_FAMILY_HISTORY_NODE');
    }
    if(birthRadius===null)throw Error('G15_FAMILY_HISTORY_EMPTY');
    return{familyId,originNodeId:node.id,arc,birthRadius};
}
function pressureFor(r){
    const travel=smooth((r.arc/r.birthRadius-(8+r.continuity*6))/(12+r.continuity*8));
    const taper=smooth((.82-r.radius/r.birthRadius)/.5);
    return r.amount*travel*(.25+.75*taper)*(.65+.35*r.attenuation);
}
export function familyCompletion(context,frontier){
    if(!active||active.amount===0||active.mode==='cadence'||frontier.tier!==1)return null;
    const history=readFamilyHistory({nodes:context.nodeIndex,segments:new Map(context.segments.map(s=>[s.id,s])),lineages:context.lineageIndex},
        frontier.nodeId,frontier.scaffoldFamilyGesture?.gestureId);
    const continuity=frontier.temperament.dominantAxisPersistence;
    if(!(frontier.radius>0&&Number.isFinite(continuity)))throw Error('G15_FAMILY_COMPLETION_INPUT');
    const receipt={semantics:SEMANTICS,...history,nodeId:frontier.nodeId,radius:frontier.radius,
        continuity,attenuation:active.factors.attenuation,amount:active.amount};
    return Object.freeze({...receipt,pressure:pressureFor(receipt)});
}

// Before step budgets/stations are allocated, let inherited persistence and
// tempo decide how much unsupported primary extension precedes the next fork.
export function familyCadence(context,spec,requestedCount,lateralReleaseCapacity){
    if(!active||active.amount===0||active.mode==='maturation'||spec.tier!==1||spec.familyCadenceBirth===undefined)return null;
    const {radius,referenceLength,kind}=spec.familyCadenceBirth;
    const continuity=spec.temperament.dominantAxisPersistence,cadence=active.factors.cadence;
    if(!['structural_fork','live_lateral'].includes(kind)||![radius,referenceLength,requestedCount,context.vigor].every(v=>Number.isFinite(v)&&v>0)
        ||!Number.isFinite(continuity)||!Number.isInteger(lateralReleaseCapacity)||lateralReleaseCapacity<0)throw Error('G15_FAMILY_CADENCE_INPUT');
    const span=radius*(10+10*continuity)+context.vigor*(20+35*(1-cadence));
    const count=requestedCount-active.amount*Math.max(0,requestedCount-span/referenceLength);
    return Object.freeze({semantics:SEMANTICS,kind,radius,referenceLength,vigor:context.vigor,continuity,cadence,
        amount:active.amount,span,requestedCount,count,sampledLateralCapacity:lateralReleaseCapacity});
}
export function familyLateralBirth(context,tier,resolveJunction,spec){
    if(!active||active.amount===0||active.mode==='maturation'||tier!==1)return undefined;
    const junction=resolveJunction(context,spec);
    return Object.freeze({kind:'live_lateral',radius:junction.lateralRadius,referenceLength:spec.referenceLength});
}
export function factorGraphSupport(original,graph){
    const d=graph.contract.familyMaturation;
    if(d!==undefined){
        if(d.semantics!==SEMANTICS||d.seed!==graph.seed||!['combined','cadence','maturation'].includes(d.mode)||!Number.isFinite(d.amount)||d.amount<=0||d.amount>1
            ||d.amount!==graph.contract.factorGrowth?.amount)throw Error('G15_FAMILY_GRAPH_CONTRACT');
        const lookup={nodes:new Map(graph.nodes.map(n=>[n.id,n])),segments:new Map(graph.segments.map(s=>[s.id,s])),lineages:new Map(graph.lineages.map(l=>[l.id,l]))};
        const frontiers=new Map(graph.frontiers.map(f=>[f.id,f]));
        for(const lineage of graph.lineages){
            const episode=lineage.birthEpisode,r=episode?.familySagContinuation;if(r===undefined)continue;
            const parent=frontiers.get(r.parentFrontierId);
            if(r.semantics!=='unfinished_parent_sag_continuation_v1'||!parent||lineage.axisOrder!==parent.axisOrder||lineage.axisOrder<=0
                ||r.parentEpisodeId!==parent.episode.id||r.age!==parent.sag.age||r.recoveryAfter!==parent.sag.recoveryAfter
                ||r.gravityResponse!==parent.episode.gravityResponse||r.age>=r.recoveryAfter||episode.gravityResponse!==r.gravityResponse)
                throw Error('G15_FAMILY_SAG_RECEIPT');
        }
        for(const split of graph.splits){
            if(split.parentTier!==1||d.mode==='cadence')continue;
            for(const decision of split.forkIdentityIntent.identityDecisions){
                const r=decision.tierArchitecture.familyCompletion;
                if(!r||r.semantics!==SEMANTICS||r.amount!==d.amount||r.attenuation!==graph.contract.factorGrowth.factors.attenuation
                    ||![r.arc,r.birthRadius,r.radius,r.continuity,r.pressure].every(Number.isFinite)||r.radius<=0)throw Error('G15_FAMILY_COMPLETION_RECEIPT');
                const h=readFamilyHistory(lookup,r.nodeId,r.familyId);
                if(h.originNodeId!==r.originNodeId||Math.abs(h.arc-r.arc)>1e-6||Math.abs(h.birthRadius-r.birthRadius)>1e-6
                    ||Math.abs(r.pressure-pressureFor(r))>1e-8)throw Error('G15_FAMILY_COMPLETION_HISTORY');
                const residual=decision.retentionPotential*(1-r.pressure)-decision.identityThreshold;
                if(r.pressure>=.5&&Math.abs(residual)>2e-8&&decision.orderRetained!==(residual>=0))throw Error('G15_FAMILY_COMPLETION_ROLE');
            }
        }
        for(const receipt of graph.developmentReceipts)for(const portfolio of [receipt.constructionPortfolio,receipt.constructionAccount?.constructionPortfolioBefore,receipt.constructionAccount?.portfolioAfterConstruction]){
            const r=portfolio?.familyCadence;if(r===undefined)continue;
            if(r.semantics!==SEMANTICS||r.amount!==d.amount||r.cadence!==graph.contract.factorGrowth.factors.cadence
                ||!Number.isInteger(r.sampledLateralCapacity)||r.sampledLateralCapacity<0
                ||![r.radius,r.referenceLength,r.vigor,r.span,r.requestedCount,r.count].every(v=>Number.isFinite(v)&&v>0)
                ||Math.abs(r.span-(r.radius*(10+10*r.continuity)+r.vigor*(20+35*(1-r.cadence))))>1e-8
                ||Math.abs(r.count-(r.requestedCount-r.amount*Math.max(0,r.requestedCount-r.span/r.referenceLength)))>1e-8)throw Error('G15_FAMILY_CADENCE_RECEIPT');
        }
    }
    return previous.factorGraphSupport(original,graph);
}
