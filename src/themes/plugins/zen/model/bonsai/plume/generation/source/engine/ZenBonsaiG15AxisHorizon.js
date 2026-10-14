// One local framework horizon replaces stacked upper length/renewal/completion pressures.
// It uses calibre and distance travelled, not a target height, triangle or world-up angle.
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
export function zenG15HorizonMaturity(radius,vigor) {
    if(!(Number.isFinite(radius)&&radius>0&&Number.isFinite(vigor)&&vigor>0))throw new Error('ZEN_G15_HORIZON_CALIBRE_REQUIRED');
    return smooth((.52-radius/(18.5*vigor))/.36);
}
export function resolveZenG15AxisHorizon(context,frontier) {
    if(!context.consolidation?.horizon||frontier.tier!==0)return null;
    const maturity=zenG15HorizonMaturity(frontier.radius,context.vigor);
    const incoming=new Map(context.segments.map(s=>[s.toNodeId,s]));
    const branchCounts=new Map();
    for(const s of context.segments)if(s.tier<=1)branchCounts.set(s.fromNodeId,(branchCounts.get(s.fromNodeId)||0)+1);
    const run=[];let nodeId=frontier.nodeId;
    while(incoming.has(nodeId)){
        const s=incoming.get(nodeId);if(s.tier!==0)break;
        run.unshift(s);nodeId=s.fromNodeId;
        if((branchCounts.get(nodeId)||0)>1)break;
    }
    const arc=run.reduce((sum,s)=>sum+s.length,0);
    let straightness=1;
    if(run.length){const a=context.nodeIndex.get(run[0].fromNodeId).point,b=context.nodeIndex.get(run.at(-1).toNodeId).point;
        straightness=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/Math.max(arc,1e-8);}
    const continuity=clamp(frontier.developmentState?.apicalContinuity ?? .5);
    const reference=run.length?Math.max(12,run[0].length):Math.max(12,frontier.previousInternodeLength||24);
    const extent=frontier.temperament.axisExtentScale;
    if(!(Number.isFinite(extent)&&extent>0))throw new Error('ZEN_G15_HORIZON_TRAIT_REQUIRED');
    const span=reference*(3+continuity*.9+extent*.8);
    const progress=arc/span*(.45+.55*straightness*straightness);
    const pressure=maturity*smooth((progress-.65)/.75);
    return Object.freeze({semantics:'local_framework_horizon_v1',maturity,arc,straightness,span,progress,pressure,
        extensionScale:1-.30*maturity-.16*pressure,
        continuationScale:1-.5*pressure,
        // The funded apical window already owns when a fork can occur. Gating
        // role completion on travel again created extra framework axes and
        // suppressed gently curved/wide specimens in the exploration cohort.
        completionPressure:maturity});
}
