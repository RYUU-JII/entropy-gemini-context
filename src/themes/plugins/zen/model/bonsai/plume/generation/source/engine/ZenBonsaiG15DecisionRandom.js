import {zenPlumeKernelRealm} from "../../kernelRealm.js";
// Randomness is addressed by developmental ancestry, not event/ID allocation order.
const hash = text => { let h=2166136261; for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; };
export function zenG15LineageAddress(context, lineageId) {
    const address=context.decisionAddresses.get(lineageId);
    if (!address) throw new Error('ZEN_G15_LINEAGE_ADDRESS_REQUIRED');
    return address;
}
export function zenG15FrontierAddress(context, frontier) {
    if (!context.consolidation.random) return frontier.lineageId;
    const age=frontier.axisAge, cycle=frontier.constructionPortfolio?.growthCycle ?? 0;
    if (!Number.isInteger(age) || age<0 || !Number.isInteger(cycle) || cycle<0) throw new Error('ZEN_G15_AXIS_STATION_REQUIRED');
    return `${zenG15LineageAddress(context,frontier.lineageId)}/station:${age}/flush:${cycle}`;
}
export function zenG15LateralAddress(context, meristem) {
    if (!context.consolidation.random) return meristem.id;
    const lineage=context.lineageIndex.get(meristem.parentLineageId);
    const node=context.nodeIndex.get(meristem.nodeId);
    const index=lineage.segmentIds.findIndex(id=>context.segmentIndex.get(id).toNodeId===node.id);
    const atBase=context.segmentIndex.get(lineage.segmentIds[0])?.fromNodeId===node.id;
    if(index<0&&!atBase)throw new Error('ZEN_G15_LATERAL_STATION_REQUIRED');
    return `${zenG15LineageAddress(context,lineage.id)}/bud:${index+1}:${meristem.side}`;
}
export function createZenG15DecisionRandom(seed,address,purpose) {
    if(!Number.isSafeInteger(seed)||typeof address!=='string'||!address||typeof purpose!=='string'||!purpose)throw new Error('ZEN_G15_RANDOM_ADDRESS_REQUIRED');
    const AxisRng=zenPlumeKernelRealm.ZenBonsaiTypedDevelopmentalSchedulerPrograms.AxisRng;
    const rng=new AxisRng(1);rng.state=hash(`${seed}|g15-decision-v1|${address}|${purpose}`);
    rng.zenScope=Object.freeze({address,purpose});rng.zenDraws=0;
    const next=rng.next.bind(rng);rng.next=()=>{rng.zenDraws++;return next();};
    return rng;
}
export function withZenG15DecisionRandom(context,address,purpose,work) {
    if(!context.consolidation.random)return work();
    const previous=context.rng;context.rng=createZenG15DecisionRandom(context.seed,address,purpose);
    try{return work();}finally{context.rng=previous;}
}
