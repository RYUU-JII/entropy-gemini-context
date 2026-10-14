import {steerBranchSpace} from "../research/branch-space/ZenG15BranchSpace.js";
import {zenG15OrganSample} from './ZenBonsaiG15OrganDevelopment.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const yaw=.24,cos=Math.cos(yaw),sin=Math.sin(yaw);
const unit=v=>{const n=Math.hypot(v.x,v.y,v.z);if(!(n>0))throw new Error('ZEN_G15_COMPOSITION_DIRECTION_REQUIRED');return {x:v.x/n,y:v.y/n,z:v.z/n};};
const project=p=>({x:p.x*cos-p.z*sin,y:p.y,z:p.x*sin+p.z*cos});
const world=p=>({x:p.x*cos+p.z*sin,y:p.y,z:-p.x*sin+p.z*cos});
const blend=(a,b,t)=>unit({x:a.x*(1-t)+b.x*t,y:a.y*(1-t)+b.y*t,z:a.z*(1-t)+b.z*t});
const sample=(seed,key)=>zenG15OrganSample(seed,'composed-crown-v1',key);
const validPoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));

export function createZenG15CompositionPlan(seed,strength=0) {
    if(!Number.isFinite(strength)||strength<0||strength>1)throw new Error('ZEN_G15_COMPOSITION_STRENGTH_INVALID');
    if(strength===0)return null;
    if(!Number.isFinite(seed))throw new Error('ZEN_G15_COMPOSITION_SEED_REQUIRED');
    const height=600+sample(seed,'height')*110;
    return Object.freeze({semantics:'seeded_composed_crown_v1',seed,strength,height,
        halfWidth:height*(.38+sample(seed,'width')*.12),base:.28,
        taper:.85+sample(seed,'taper')*.35,
        lean:height*(sample(seed,'lean')-.5)*.25,
        amplitude:height*(.075+sample(seed,'amplitude')*.055),
        cycles:.72+sample(seed,'cycles')*.30,phase:sample(seed,'phase')*Math.PI*2,
        authority:'future_growth_proposals_only',frameYaw:yaw});
}

export function zenG15CompositionEnvelope(plan,y) {
    const t=clamp(y/plan.height,0,1.2),k=Math.PI*2*plan.cycles;
    const ease=clamp(t/.28);const smooth=ease*ease*(3-2*ease);
    return {center:plan.lean*t+plan.amplitude*(Math.sin(k*t+plan.phase)-Math.sin(plan.phase))*smooth,
        halfWidth:plan.halfWidth*Math.max(.13,Math.max(0,1-clamp((t-plan.base)/(1-plan.base)))**plan.taper)};
}

export function createZenG15CompositionRegion(plan,key,origin,heading) {
    if(!plan)return null;
    if(!validPoint(origin)||!validPoint(heading))throw new Error('ZEN_G15_COMPOSITION_BIRTH_GEOMETRY_REQUIRED');
    const p=project(origin),h=project(heading),envelope=zenG15CompositionEnvelope(plan,p.y);
    const side=Math.sign(h.x)||Math.sign(p.x-envelope.center)||(sample(plan.seed,key)<.5?-1:1);
    const boundary=envelope.center+side*envelope.halfWidth;
    const reach=Math.max(38,(boundary-p.x)*side);
    const tilt=.14+sample(plan.seed,`${key}:tilt`)*.20;
    // Central ascending families may form the crown apex after their scheduler
    // order changes. A horizontal-pad rule must not flatten that continuation.
    const ascent=clamp((h.y/Math.hypot(h.x,h.y,h.z)-.38)/.47);
    const central=Math.exp(-(((p.x-envelope.center)/(envelope.halfWidth*.78))**2));
    const apical=ascent*central*clamp((p.y/plan.height-.28)/.30);
    return Object.freeze({semantics:'inherited_composed_region_v1',id:`composition:${key}`,origin:Object.freeze({...origin}),side,
        centerY:p.y+reach*tilt,verticalRadius:plan.height*(.055+sample(plan.seed,`${key}:depth`)*.04),
        reach,tilt,apical,authority:'birth_region_and_forward_heading_only'});
}

export function guideZenG15Composition(plan,point,direction,tier,region=null) {
 return steerBranchSpace(originalComposition,plan,point,direction,tier,region);
}
function originalComposition(plan,point,direction,tier,region=null) {
    if(!plan)return direction;
    if(!validPoint(point)||!validPoint(direction))throw new Error('ZEN_G15_COMPOSITION_GEOMETRY_REQUIRED');
    const p=project(point),d=project(unit(direction));
    let target,weight;
    if(tier===0){
        const delta=plan.height*.035;
        const slope=(zenG15CompositionEnvelope(plan,p.y+delta).center-zenG15CompositionEnvelope(plan,p.y-delta).center)/(2*delta);
        // A slowly changing tangent, not pursuit of a fixed point or finished tip.
        target=unit(world({x:clamp(slope,-.85,.85),y:1,z:d.z*.55}));
        weight=plan.strength*.66*clamp(p.y/(plan.height*.22));
    }else{
        if(!region)throw new Error('ZEN_G15_COMPOSITION_REGION_REQUIRED');
        const layerOffset=clamp((p.y-region.centerY)/region.verticalRadius,-1,1);
        // The outgoing side never reverses to chase an overshot target.
        const apical=region.apical*clamp((plan.height-p.y)/(plan.height*.18));
        target=unit(world({x:region.side*(1-apical*.80),
            y:clamp(region.tilt-layerOffset*.42,-.14,.55)*(1-apical)+apical*1.25,z:d.z*.65}));
        weight=plan.strength*(tier===1?.62:.40);
    }
    const base=unit(direction),mixed=blend(base,target,weight);
    const angle=Math.acos(clamp(base.x*mixed.x+base.y*mixed.y+base.z*mixed.z,-1,1));
    return angle>.24?blend(base,mixed,.24/angle):mixed;
}

export function zenG15CompositionLengthScale(plan,point,tier) {
    if(!plan)return 1;
    if(!validPoint(point))throw new Error('ZEN_G15_COMPOSITION_GEOMETRY_REQUIRED');
    const p=project(point),envelope=zenG15CompositionEnvelope(plan,p.y);
    const upper=clamp((p.y/plan.height-.40)/.60);
    const edge=clamp((Math.abs(p.x-envelope.center)/envelope.halfWidth-.75)/.7);
    return tier===0?1-plan.strength*.13*upper
        :1-plan.strength*(.16*upper+.25*edge);
}

// Reconstruct the uncommitted reference shoot forward from its real socket.
// Arc lengths and wood cost stay unchanged; funding and organ ages follow later.
export function guideZenG15CompositionShoot(entries,plan,region) {
    if(!plan||!region)return entries;
    const positions=new Map(),result=[];
    for(const e of entries){
        const from=positions.get(e.fromNodeId)||e.from;
        const delta={x:e.to.x-e.from.x,y:e.to.y-e.from.y,z:e.to.z-e.from.z};
        const length=Math.hypot(delta.x,delta.y,delta.z);
        const direction=originalComposition(plan,from,delta,2,region);
        const to={x:from.x+direction.x*length,y:from.y+direction.y*length,z:from.z+direction.z*length};
        positions.set(e.toNodeId,to);result.push({...e,from,to});
    }
    return result;
}
