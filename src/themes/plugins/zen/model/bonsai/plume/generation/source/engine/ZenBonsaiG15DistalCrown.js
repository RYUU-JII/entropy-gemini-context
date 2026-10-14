import { zenG15OrganSample } from './ZenBonsaiG15OrganDevelopment.js';

const clamp = value => Math.max(0, Math.min(1, value));
const length = (a, b) => Math.hypot(b.x-a.x, b.y-a.y, b.z-a.z);
const unit = v => { const n = Math.hypot(v.x,v.y,v.z); if (!(n > 0)) throw new Error('ZEN_G15_CROWN_DIRECTION_REQUIRED'); return {x:v.x/n,y:v.y/n,z:v.z/n}; };
export function resolveZenG15DistalCrown(value = 'baseline') {
    if (!['baseline', 'extension', 'shoots', 'candidate'].includes(value)) throw new Error('ZEN_G15_DISTAL_CROWN_TREATMENT_INVALID');
    return { extension: value === 'extension' || value === 'candidate', shoots: value === 'shoots' || value === 'candidate' };
}

/** Local extension demand remembers the unbranched path across flush renewals.
 * It is evaluated before construction is funded. No final-tip detection,
 * graph rescaling, additional resource, or global left/right target is used. */
export function resolveZenG15DistalExtension(context, frontier) {
    if (!resolveZenG15DistalCrown(context.distalCrownTreatment).extension || frontier.tier !== 0) return null;
    const incoming = new Map(context.segments.map(s => [s.toNodeId, s]));
    const outgoing = new Map();
    for (const s of context.segments) outgoing.set(s.fromNodeId, (outgoing.get(s.fromNodeId) || 0) + 1);
    const run = [];
    let nodeId = frontier.nodeId;
    while (incoming.has(nodeId)) {
        const s = incoming.get(nodeId);
        run.unshift(s);
        nodeId = s.fromNodeId;
        if (outgoing.get(nodeId) > 1) break;
    }
    if (!run.length) return null;
    const nodes = new Map(context.nodes.map(n => [n.id, n.point]));
    const arc = run.reduce((sum,s) => sum + s.length, 0);
    const from = nodes.get(run[0].fromNodeId), to = nodes.get(run.at(-1).toNodeId);
    const straightness = length(from,to) / Math.max(arc, 1e-8);
    const vertical = Math.abs(to.y-from.y) / Math.max(length(from,to),1e-8);
    const distal = clamp((7-frontier.radius)/5);
    const runUnits = arc / Math.max(12, run[0].length);
    const pressure = distal * (.3 + .7*vertical**2) * straightness**8 * Math.max(0,runUnits-1.25)**2;
    return Object.freeze({ semantics:'local_distal_extension_demand_v1', arc, runUnits, straightness,
        vertical, distal, lengthScale:Math.max(.38, 1/(1+.24*pressure)), authority:'requested_length_only' });
}

/** A continuing short shoot carries two staggered laterals. All tips share a
 * finite floral capacity; lengthening/ramifying conserves its wood volume. */
export function developZenG15CloudShoot(entries, seed, sourceId) {
    if (!Array.isArray(entries) || entries.some(e =>
        ![e.from?.x,e.from?.y,e.from?.z,e.to?.x,e.to?.y,e.to?.z,e.startRadius,e.endRadius].every(Number.isFinite)
        || e.startRadius<=0 || e.endRadius<=0 || length(e.from,e.to)<=0)) throw new Error('ZEN_G15_CROWN_SHOOT_GEOMETRY_REQUIRED');
    const [a,b] = entries;
    if (!a || !b || a.toNodeId !== b.fromNodeId) throw new Error('ZEN_G15_CROWN_SHOOT_CHAIN_REQUIRED');
    const tangent = unit({x:b.to.x-b.from.x,y:b.to.y-b.from.y,z:b.to.z-b.from.z});
    const side = unit({x:tangent.y,y:-tangent.x,z:.12});
    const reach = (length(a.from,a.to)+length(b.from,b.to))*1.08;
    const skew = .85 + zenG15OrganSample(seed,sourceId,'cloud-skew')*.3;
    const rootId=a.fromNodeId, points=new Map([[rootId,a.from]]), result=[];
    const add = (name,parent,span,turn,depth,weight,endWeight) => {
        const from=points.get(parent);
        if (!from) throw new Error('ZEN_G15_CROWN_SHOOT_PARENT_REQUIRED');
        const direction=unit({x:tangent.x+side.x*turn,y:tangent.y+side.y*turn+.07,z:tangent.z+side.z*turn});
        const to={x:from.x+direction.x*span,y:from.y+direction.y*span,z:from.z+direction.z*span};
        const id=`canopy-twig:${sourceId}:cloud:${name}`, node=`${id}:tip`;
        points.set(node,to);
        result.push({...a,id,lineageId:`${sourceId}:cloud:${name[0]}`,presentationLineageId:`${sourceId}:cloud:${name[0]}`,
            fromNodeId:parent,toNodeId:node,from,to,startRadius:a.startRadius*weight,endRadius:a.startRadius*endWeight,
            branchRole:'staggered_cloud_shoot',organBirthOffset:depth*6,cloudShoot:true});
        return node;
    };
    const n1=add('m1',rootId,reach*.40,0,0,1,.78);
    const n2=add('m2',n1,reach*.34,.10,1,.62,.46);
    add('m3',n2,reach*.27,.20,2,.37,.18);
    const lateral=add('a1',n1,reach*.30*skew,-.85,1,Math.sqrt(.78**2-.62**2),.32);
    add('a2',lateral,reach*.28*skew,-.65,2,.32,.16);
    add('b1',n2,reach*.40/skew,.92,2,Math.sqrt(.46**2-.37**2),.14);
    const volume = items => items.reduce((sum,e)=>sum+length(e.from,e.to)*(e.startRadius**2+e.startRadius*e.endRadius+e.endRadius**2),0);
    const radiusScale=Math.sqrt(volume(entries)/volume(result));
    return result.map(e=>({...e,startRadius:e.startRadius*radiusScale,endRadius:e.endRadius*radiusScale}));
}
