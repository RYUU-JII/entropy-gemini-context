// Research proposal owner. The canonical kernel supplies the two-step preview.
export const JOINT_FRAME_CONTRACT = 'zen_g15_joint_fork_frame_v1';
export const JOINT_FRAME_MODES = Object.freeze(['baseline', 'station-off', 'frame', 'curve', 'joint']);
let run = null;
const check = (ok, message) => { if (!ok) throw Error('G15_JOINT_FRAME_' + message); };
const dot = (a, b) => a.x*b.x + a.y*b.y + a.z*b.z;
const cross = (a,b) => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const unit = v => { const n=Math.hypot(v.x,v.y,v.z); check(Number.isFinite(n)&&n>0,'DIRECTION'); return {x:v.x/n,y:v.y/n,z:v.z/n}; };
const angle = (a,b) => Math.acos(Math.max(-1,Math.min(1,dot(unit(a),unit(b)))));
const planar = (a,b) => Math.atan2(a.y*b.x-a.x*b.y,a.x*b.x+a.y*b.y);
const planarRotate = (v,t) => ({x:v.x*Math.cos(t)+v.y*Math.sin(t),y:-v.x*Math.sin(t)+v.y*Math.cos(t),z:v.z});
const close = (a,b) => Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<2e-6;

export function withJointFrame(mode,strength,generate) {
    check(run===null,'REENTRANT'); check(JOINT_FRAME_MODES.includes(mode),'MODE');
    check(Number.isFinite(strength)&&strength>=0&&strength<=1,'STRENGTH');
    run={mode,strength,records:[],pending:new Map()};
    try { const topology=generate(); check(run.pending.size===0,'UNSETTLED_FORK'); return {topology,receipts:run.records,mode,strength,contract:JOINT_FRAME_CONTRACT}; }
    finally { run=null; }
}
export function jointFrameEnabled() { check(run!==null,'RUN_REQUIRED'); return run.mode!=='baseline'; }
export function sharedReleaseFrame() { check(run!==null,'RUN_REQUIRED'); return run.mode==='joint'; }
export function sharedProjectionFrame() { check(run!==null,'RUN_REQUIRED'); return ['frame','curve','joint'].includes(run.mode); }

// One proper 3D rotation for every sibling: all pairwise angles are preserved.
// No arbitrary axis is selected for antipodal frames; invalid input fails loudly.
export function rotateFrame(v,rotation) {
    if(rotation.radians===0) return {...v};
    const a=rotation.axis,c=Math.cos(rotation.radians),s=Math.sin(rotation.radians),k=dot(a,v)*(1-c),w=cross(a,v);
    return {x:v.x*c+w.x*s+a.x*k,y:v.y*c+w.y*s+a.y*k,z:v.z*c+w.z*s+a.z*k};
}
export function planJointFrame({children,forecast,strength,constraints=[]}) {
    check(Number.isFinite(strength)&&strength>=0&&strength<=1,'STRENGTH');
    const claims=children.map(c=>{
        check([c.identityResponsibility,c.flowDirectionWeight,c.share,c.corridorScore].every(v=>Number.isFinite(v)&&v>=0),'CLAIM');
        return Math.sqrt(c.identityResponsibility*c.flowDirectionWeight);
    });
    const sum=claims.reduce((a,b)=>a+b,0); check(sum>0,'EMPTY_CLAIM');
    const responsibilities=claims.map(v=>v/sum);
    const center=unit(children.reduce((v,c,i)=>{const d=unit(c.direction),w=responsibilities[i];return {x:v.x+d.x*w,y:v.y+d.y*w,z:v.z+d.z*w};},{x:0,y:0,z:0}));
    const target=unit(forecast.first.direction),axis=cross(center,target),norm=Math.hypot(axis.x,axis.y,axis.z);
    check(norm>1e-12||dot(center,target)>0,'ANTIPODAL_FRAME');
    const spaceConsent=1/(1+children.reduce((s,c,i)=>s+c.corridorScore*responsibilities[i],0));
    const requestedWeight=strength*spaceConsent;
    const requestedRotation={axis:norm>1e-12?unit(axis):{x:0,y:0,z:0},radians:requestedWeight*Math.atan2(norm,dot(center,target))};
    constraints.forEach(c=>check(Number.isInteger(c.index)&&c.index>=0&&c.index<children.length&&[c.maximumTurn,c.maximumLean].every(v=>Number.isFinite(v)&&v>0&&v<Math.PI),'SUPPORT_CONSTRAINT'));
    const feasible=t=>constraints.every(c=>{const d=rotateFrame(children[c.index].direction,{...requestedRotation,radians:requestedRotation.radians*t});return angle(d,forecast.heading)<=c.maximumTurn+1e-8&&angle(d,{x:0,y:1,z:0})<=c.maximumLean+1e-8;});
    let feasibleFraction=1;
    if(strength>0&&constraints.length) {
        check(feasible(0),'INPUT_OUTSIDE_SUPPORT');
        // Follow the connected admissible interval from the existing proposal.
        // This solves existing support limits for the whole sibling set.
        for(let step=1;step<=24;step++) if(!feasible(step/24)) {
            let lo=(step-1)/24,hi=step/24;
            for(let i=0;i<28;i++){const mid=(lo+hi)/2;if(feasible(mid))lo=mid;else hi=mid;}
            feasibleFraction=lo;break;
        }
    }
    const weight=requestedWeight*feasibleFraction;
    const rotation={...requestedRotation,radians:requestedRotation.radians*feasibleFraction};
    const firstTurn=planar(forecast.heading,forecast.first.direction),secondTurn=planar(forecast.first.direction,forecast.second.direction);
    // Transport only the change in predicted curvature. Existing child programs
    // already inherit parent curvature; adding its full value would duplicate it.
    const curveDelta=planar({x:Math.sin(firstTurn),y:Math.cos(firstTurn),z:0},{x:Math.sin(secondTurn),y:Math.cos(secondTurn),z:0});
    return {center,target,weight,spaceConsent,requestedWeight,feasibleFraction,rotation,curveDelta,children:children.map((c,i)=>({responsibility:responsibilities[i],direction:rotateFrame(c.direction,rotation)}))};
}

export function applyJointFrame(context,frontier,children,sequence,referenceFrame,preview,constrain,supportedPlan) {
    if(!jointFrameEnabled()) return referenceFrame;
    const before=children.map(c=>({...c.direction}));
    const inputs=children.map(c=>({identityResponsibility:c.decision.identityResponsibility,flowDirectionWeight:c.flowDirectionWeight,share:c.share,corridorScore:c.corridorScore,direction:c.direction}));
    // Preview uses the existing evolveHeading with observation disabled. No graph,
    // resource, RNG, episode or position is advanced; the local field is frozen.
    const forecast=preview(context,frontier);
    const constraints=[],inputSupport=[];
    if(run.mode!=='station-off') for(const [index,child] of children.entries()) if(child.tier===0) {
        const support=constrain(context,frontier,child.direction,children.filter(c=>c.tier===0).length>1);
        if(support.support) {
            let maximumTurn=support.maximumTurnRadians;
            if(Number.isFinite(supportedPlan.maximumTurnRadians))maximumTurn=Math.min(maximumTurn,supportedPlan.maximumTurnRadians);
            constraints.push({index,maximumTurn,maximumLean:support.support.maximumLeanRadians});
            const admitted=d=>angle(d,forecast.heading)<=maximumTurn+1e-8
                &&angle(d,{x:0,y:1,z:0})<=support.support.maximumLeanRadians+1e-8;
            if(!admitted(inputs[index].direction)) {
                check(admitted(support.direction),'INPUT_SUPPORT_PROJECTION');
                inputSupport[index]={direction:{...inputs[index].direction},
                    correctionRadians:angle(inputs[index].direction,support.direction)};
                inputs[index].direction=support.direction;
                before[index]=support.direction;
            }
        }
    }
    const plan=planJointFrame({children:inputs,forecast,constraints,strength:run.mode==='station-off'?0:run.strength});
    const receipt={semantics:JOINT_FRAME_CONTRACT,mode:run.mode,strength:run.strength,sequence,parentLineageId:frontier.lineageId,parentAxisOrder:frontier.axisOrder,parentAxisAge:frontier.axisAge,
        parentEpisodeId:frontier.episode.id,parentEpisodeTarget:{...frontier.episode.targetHeading},parentHeading:{...frontier.heading},parentTurnVelocity:frontier.turnVelocity,
        forecast,constraints,center:plan.center,target:plan.target,rotation:plan.rotation,weight:plan.weight,requestedWeight:plan.requestedWeight,feasibleFraction:plan.feasibleFraction,curveDelta:plan.curveDelta,
        children:children.map((c,i)=>({axisOrder:c.axisOrder,...inputs[i],direction:undefined,responsibility:plan.children[i].responsibility,spaceConsent:plan.spaceConsent,weight:plan.weight,before:before[i],...(inputSupport[i]?{inputSupport:inputSupport[i]}:{}),proposed:plan.children[i].direction}))};
    for(const [i,child] of children.entries()) { child.direction=plan.children[i].direction; child.jointFrameReceipt=receipt.children[i]; child.jointFrameCurveDelta=run.mode==='curve'?plan.curveDelta*plan.weight:0; }
    check(!run.pending.has(frontier.id),'DUPLICATE_FORK'); run.pending.set(frontier.id,receipt);
    if(run.mode==='station-off') return referenceFrame;
    return Object.freeze({...referenceFrame,heading:Object.freeze(rotateFrame(referenceFrame.heading,plan.rotation))});
}
export function settleJointFrame(frontier,children) {
    if(!jointFrameEnabled()) return;
    const receipt=run.pending.get(frontier.id); check(receipt,'MISSING_FORK');
    receipt.children.forEach((c,i)=>{c.realized={...children[i].direction};c.remainingProjectionTurn=angle(c.proposed,c.realized);c.departureBefore=angle(frontier.heading,c.before);c.departureAfter=angle(frontier.heading,c.realized);});
    run.records.push(receipt);run.pending.delete(frontier.id);return Object.freeze(receipt);
}
export function transportJointEpisode(child,episode) {
    if(!jointFrameEnabled()) return episode;
    const delta=child.jointFrameCurveDelta,r=child.jointFrameReceipt;
    check(r&&Number.isFinite(delta),'EPISODE_STATE');
    r.episode={id:episode.id,targetBefore:{...episode.targetHeading},velocityBefore:episode.curvatureVelocity,delta};
    if(delta===0) return episode;
    return Object.freeze({...episode,targetHeading:Object.freeze(planarRotate(episode.targetHeading,delta)),curvatureVelocity:episode.curvatureVelocity+delta});
}
export function jointFrameDescriptor() { return jointFrameEnabled()?{jointFrame:Object.freeze({semantics:JOINT_FRAME_CONTRACT,mode:run.mode,strength:run.strength})}:{}; }
export function validJointFrameReceipt(descriptor,r,event,frontier,nodes,segments,frontiers) {
    if(!descriptor||descriptor.semantics!==JOINT_FRAME_CONTRACT||!r||r.semantics!==descriptor.semantics||r.mode!==descriptor.mode||r.strength!==descriptor.strength) return false;
    if(!['station-off','frame','curve','joint'].includes(r.mode)||!Number.isFinite(r.strength)||r.strength<0||r.strength>1||r.sequence!==event.sequence||r.parentLineageId!==frontier.lineageId||r.parentAxisOrder!==frontier.axisOrder||r.parentAxisAge!==frontier.axisAge||r.children.length!==event.splitArity) return false;
    if(r.parentEpisodeId!==frontier.episode.id||angle(r.parentEpisodeTarget,frontier.episode.targetHeading)>1e-6||angle(r.parentHeading,frontier.heading)>1e-6||!close(r.parentTurnVelocity,frontier.turnVelocity)||angle(r.forecast.heading,frontier.heading)>1e-6||r.forecast.source!=='canonical_evolveHeading_two_local_steps_v1') return false;
    const plan=planJointFrame({children:r.children.map(c=>({...c,direction:c.before})),forecast:r.forecast,constraints:r.constraints,strength:r.mode==='station-off'?0:r.strength});
    if(!close(r.rotation.radians,plan.rotation.radians)||!close(r.curveDelta,plan.curveDelta)||!close(r.weight,plan.weight)||!close(r.feasibleFraction,plan.feasibleFraction)) return false;
    return r.children.every((c,i)=>{
        const segment=segments.get(event.createdSegmentIds[i]),birth=frontiers.get(event.createdFrontierIds[i]); if(!segment||!birth||!c.episode) return false;
        const a=nodes.get(segment.fromNodeId).point,b=nodes.get(segment.toNodeId).point,actual=unit({x:b.x-a.x,y:b.y-a.y,z:b.z-a.z});
        const delta=r.mode==='curve'?plan.curveDelta*plan.weight:0;
        return (!c.inputSupport||(Number.isFinite(c.inputSupport.correctionRadians)
                &&close(c.inputSupport.correctionRadians,angle(c.inputSupport.direction,c.before))))
            &&c.axisOrder===event.tierDecisions[i].axisOrder&&close(c.share,event.resourceShares[i])&&close(c.identityResponsibility,event.tierDecisions[i].identityResponsibility)&&close(c.flowDirectionWeight,event.flowDirectionPlan.weights[i])
            &&close(c.responsibility,plan.children[i].responsibility)&&close(c.weight,plan.weight)&&close(c.spaceConsent,plan.spaceConsent)
            &&angle(c.proposed,plan.children[i].direction)<1e-6&&angle(c.realized,actual)<1e-5
            &&c.episode.id===birth.episode.id&&close(c.episode.delta,delta)&&angle(birth.episode.targetHeading,planarRotate(c.episode.targetBefore,delta))<1e-6
            &&close(birth.turnVelocity,c.episode.velocityBefore+delta)&&close(birth.episode.curvatureVelocity,c.episode.velocityBefore+delta);
    });
}
