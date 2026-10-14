import {createZenCherryCloudSnapshot,createZenGeneratedCherryCloudCameraSnapshot} from '../cloud/pose.js';
import {CHERRY_PLUME_MODEL_ID, CHERRY_PLUME_PROFILE as P} from './profile.js';
export {CHERRY_PLUME_MODEL_ID} from './profile.js';

const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const mean=points=>mul(points.reduce(add,[0,0,0]),1/points.length);
const finite=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
function norm(v){
  if(!finite(v)||Math.hypot(...v)<1e-10)throw Error('ZEN_CHERRY_PLUME_DIRECTION');
  return mul(v,1/Math.hypot(...v));
}
function draw(seed,key){
  let v=(seed^2166136261)>>>0;
  for(const c of key)v=Math.imul(v^c.charCodeAt(0),16777619)>>>0;
  v^=v>>>16;v=Math.imul(v,0x7feb352d);v^=v>>>15;v=Math.imul(v,0x846ca68b);
  return((v^(v>>>16))>>>0)/4294967296;
}
function entry(map,id,label){
  if(!map.has(id))throw Error(`ZEN_CHERRY_PLUME_MISSING_${label}:${id}`);
  return map.get(id);
}
function index(records,label){
  if(!Array.isArray(records))throw Error(`ZEN_CHERRY_PLUME_COLLECTION:${label}`);
  const result=new Map(records.map(record=>[record.id,record]));
  if(result.size!==records.length)throw Error(`ZEN_CHERRY_PLUME_DUPLICATE:${label}`);
  return result;
}
function frame(normal,preferredU){
  const n=norm(normal),projected=sub(preferredU,mul(n,dot(preferredU,n)));
  // This branch only chooses a nonsingular mathematical basis.
  const u=Math.hypot(...projected)>1e-8?norm(projected):norm(cross(n,Math.abs(n[1])>.9?[1,0,0]:[0,1,0]));
  return{normal:n,u,v:norm(cross(n,u))};
}

/** Pose hypothesis only: no camera input, topology edits or flower recruitment. */
export function createZenCherryPlumeSnapshot(rawCloudSnapshot,{seed,strength=1,flowerScale=5,spread=2.6,stage=.45}){
  if(!Number.isFinite(strength)||strength<0||strength>1)throw Error('ZEN_CHERRY_PLUME_STRENGTH');
  const snapshot=createZenCherryCloudSnapshot(rawCloudSnapshot,{seed,flowerScale,spread,stage});
  return posePlumeSnapshot(snapshot,seed,strength,spread,true);
}

// Species' generated preparation alone supplies a fully validated spring.
// The fixed mature pose feeds cameraEnvelope; no receipt enters that envelope.
export function createZenGeneratedCherryPlumeCameraSnapshot(rawCloudSnapshot,{seed}){
  const snapshot=createZenGeneratedCherryCloudCameraSnapshot(rawCloudSnapshot,{seed});
  return posePlumeSnapshot(snapshot,seed,1,2.6,false);
}

function posePlumeSnapshot(snapshot,seed,strength,spread,recordReceipts){
  const nodes=index(snapshot.nodes,'NODE'),buds=index(snapshot.buds,'BUD'),units=index(snapshot.annualUnits,'UNIT');
  const incoming=new Map(snapshot.segments.map(segment=>[segment.childNodeId,segment]));
  const groups=new Map(),unitGroups=new Map(),unitReceipts=recordReceipts?[]:null,clusterReceipts=recordReceipts?[]:null;
  for(const flower of snapshot.flowers){
    const bud=entry(buds,flower.budId,'BUD');
    const unit=entry(units,bud.unitId,'UNIT');
    if(!unit.nodeIds.includes(bud.nodeId)||flower.nodeId!==bud.nodeId||flower.clusterId!==`bloom:${bud.id}`)
      throw Error(`ZEN_CHERRY_PLUME_SUPPORT:${flower.id}`);
    if(!groups.has(bud.id))groups.set(bud.id,[]);
    groups.get(bud.id).push(flower);
    if(!unitGroups.has(unit.id))unitGroups.set(unit.id,[]);
    unitGroups.get(unit.id).push(flower);
  }
  const descriptors=new Map();
  for(const[unitId,flowers]of unitGroups){
    const unit=units.get(unitId),origin=entry(nodes,unit.originNodeId,'ORIGIN');
    const end=entry(nodes,unit.nodeIds.at(-1),'UNIT_END');
    const tangent=norm(sub(end.p,origin.p));
    const offsets=flowers.map(f=>sub(f.position,f.pedicel.start));
    const meanOffset=mean(offsets),radialProjection=sub(meanOffset,mul(tangent,dot(meanOffset,tangent)));
    // Fixed world-axis construction at the parallel singularity, never a camera basis.
    const radial=Math.hypot(...radialProjection)>1e-8?norm(radialProjection)
      :norm(cross(tangent,Math.abs(tangent[1])>.9?[1,0,0]:[0,1,0]));
    const tilt=(draw(seed,`${unitId}:plume-tilt`)-.5)*P.tiltRange;
    const flowDirection=norm(add(mul(tangent,Math.cos(tilt)),mul(radial,Math.sin(tilt))));
    const side=norm(cross(flowDirection,radial)),outward=norm(cross(side,flowDirection));
    const descriptor={unitId,axisId:unit.axisId,familyId:unit.familyId,tangent,flowDirection,radial:outward,side,
      lengthFactor:P.lengthMin+draw(seed,`${unitId}:plume-length`)*P.lengthRange,
      widthFactor:P.widthMin+draw(seed,`${unitId}:plume-width`)*P.widthRange,tilt,
      fringeSign:draw(seed,`${unitId}:plume-fringe-side`)>.24?1:-1};
    if(recordReceipts){
      descriptor.cloudCentroid=mean(flowers.map(f=>f.position));descriptor.flowerIds=flowers.map(f=>f.id);
    }
    descriptors.set(unitId,descriptor);
    if(recordReceipts)unitReceipts.push(descriptor);
  }
  for(const[budId,flowers]of groups){
    const bud=buds.get(budId),unit=units.get(bud.unitId),d=descriptors.get(unit.id),support=nodes.get(bud.nodeId);
    const segment=entry(incoming,bud.nodeId,'SUPPORT_SEGMENT');
    if(segment.unitId!==unit.id)throw Error(`ZEN_CHERRY_PLUME_UNIT_SEGMENT:${bud.id}`);
    const localTangent=norm(sub(support.p,entry(nodes,segment.parentNodeId,'PARENT').p));
    const flowDirection=norm(add(mul(d.flowDirection,.78),mul(localTangent,.22)));
    const side=norm(cross(flowDirection,d.radial)),radial=norm(cross(side,flowDirection));
    const nodeStation=(unit.nodeIds.indexOf(bud.nodeId)+1)/unit.nodeIds.length;
    const taper=.72+.28*Math.sin(Math.PI*(.08+nodeStation*.84));
    const extent=flowers.reduce((sum,f)=>sum+f.referenceRadius,0)/flowers.length*spread;
    const ordered=[...flowers].sort((a,b)=>draw(seed,`${a.id}:plume-order`)-draw(seed,`${b.id}:plume-order`)||a.id.localeCompare(b.id));
    const coreCount=ordered.length-1,coreFlowerIds=recordReceipts?[]:null,fringeFlowerIds=recordReceipts?[]:null,targets=[];
    for(const[rank,flower]of ordered.entries()){
      const fringe=rank===coreCount;
      const station=fringe?d.fringeSign*(P.fringeStationMin+draw(seed,`${budId}:plume-fringe-reach`)*P.fringeStationRange)
        :((rank+.5)/coreCount-.5)*P.coreSpan-d.fringeSign*.16;
      const width=fringe?.38:.72+.28*(1-Math.min(1,Math.abs(station)));
      const angle=draw(seed,`${unit.id}:plume-roll`)*Math.PI*2+rank*2.3999632297;
      const shoulder=extent*(1.95+draw(seed,`${unit.id}:plume-reach`)*.75);
      const sideways=Math.cos(angle)*extent*d.widthFactor*width*taper;
      const depth=Math.sin(angle)*extent*.58*width+extent*.18*station*station;
      const position=add(support.p,add(mul(flowDirection,station*extent*d.lengthFactor*taper),
        add(mul(radial,shoulder+depth),mul(side,sideways))));
      const rawRadius=(fringe?P.fringeRadius:P.coreRadius)*(1+(draw(seed,`${flower.id}:plume-radius`)-.5)*P.radiusJitter);
      const outward=norm(add(radial,add(mul(flowDirection,station*.38),mul(side,Math.cos(angle)*.28))));
      const normal=norm(blend(flower.normal,outward,P.orientationMix));
      targets.push({flower,position,normal,rawRadius,station,role:fringe?'fringe':'core'});
      if(recordReceipts)(fringe?fringeFlowerIds:coreFlowerIds).push(flower.id);
    }
    // Preserve the cluster's sum of squared radii at full strength. This is a
    // nominal size budget, not projected area or a claim about visual coverage.
    const oldArea=targets.reduce((sum,t)=>sum+t.flower.radius**2,0);
    const newArea=targets.reduce((sum,t)=>sum+(t.flower.radius*t.rawRadius)**2,0);
    const radiusCorrection=Math.sqrt(oldArea/newArea);
    const cloudCentroid=recordReceipts?mean(flowers.map(f=>f.position)):null;
    for(const target of targets){
      const flower=target.flower,cloudPosition=[...flower.position],cloudRadius=flower.radius;
      const targetRadius=cloudRadius*target.rawRadius*radiusCorrection;
      if(strength>0){
        const posedFrame=frame(blend(flower.normal,target.normal,strength),flower.u);
        flower.position=blend(cloudPosition,target.position,strength);
        flower.radius=cloudRadius+(targetRadius-cloudRadius)*strength;
        Object.assign(flower,posedFrame);
        flower.pedicel.end=[...flower.position];
        flower.pedicelLength=Math.hypot(...sub(flower.position,flower.pedicel.start));
        if(recordReceipts)flower.plume={unitId:unit.id,clusterId:flower.clusterId,role:target.role,cloudPosition,cloudRadius,
          targetPosition:target.position,targetRadius,station:target.station};
      }
    }
    if(recordReceipts)clusterReceipts.push({clusterId:flowers[0].clusterId,supportBudId:budId,supportNodeId:support.id,unitId:unit.id,
      flowerIds:flowers.map(f=>f.id),coreFlowerIds,fringeFlowerIds,flowDirection,radial,extent,taper,
      cloudCentroid,plumeCentroid:mean(flowers.map(f=>f.position)),
      cloudSquaredRadii:oldArea,posedSquaredRadii:flowers.reduce((sum,f)=>sum+f.radius**2,0)});
  }
  if(recordReceipts)for(const receipt of unitReceipts){
    const flowers=unitGroups.get(receipt.unitId);
    receipt.plumeCentroid=mean(flowers.map(f=>f.position));
  }
  if(recordReceipts)snapshot.plume={modelId:CHERRY_PLUME_MODEL_ID,seed,active:snapshot.phase==='spring',strength:snapshot.phase==='spring'?strength:0,
    requestedStrength:strength,counts:{units:unitReceipts.length,clusters:clusterReceipts.length,flowers:snapshot.flowers.length},
    semantics:P.semantics,unitReceipts,clusterReceipts};
  return snapshot;
}
