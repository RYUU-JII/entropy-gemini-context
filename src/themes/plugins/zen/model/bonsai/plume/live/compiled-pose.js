import {createZenCherryPlumeSnapshot} from '../plume/model.js';
import {compileZenCherryPlumeFlowerDevelopment} from './flower-development.js';

const MAX_PREPARED_POSES=9;
// Seed and the nine raw annual observations are immutable within a study identity.
// Retain one exact full pose per observation, never a cache of changing stages.
// Weak ownership lets an abandoned study and all its prepared data be collected.
const preparedStudies=new WeakMap();
const clamp=value=>Math.max(0,Math.min(1,value));
const subtract=(a,b)=>a.map((value,index)=>value-b[index]);
const multiply=(a,value)=>a.map(component=>component*value);
const normalize=value=>multiply(value,1/Math.hypot(...value));

function freezeTree(value,seen=new Set()){
  if(!value||typeof value!=='object'||seen.has(value))return value;
  seen.add(value);for(const child of Object.values(value))freezeTree(child,seen);
  return Object.freeze(value);
}
// Canonical poses contain only plain objects, arrays and scalar data. Compile
// their object graph once; scalar strings stay referenced by the private index.
// Each copy allocates every mutable object anew while preserving aliases and
// key insertion order, without reserializing IDs or inspecting shapes per frame.
function compileCopy(root){
  const seen=new Map(),entries=[];
  let propertyCount=0,referenceCount=0;
  function visit(value){
    if(seen.has(value))return seen.get(value);
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
    if(prototype!==(array?Array.prototype:Object.prototype)||Object.getOwnPropertySymbols(value).length)
      throw Error('ZEN_PLUME_COMPILED_POSE_DATA');
    const index=entries.length,keys=Object.keys(value),values=[],links=[];
    entries.push({array,length:array?value.length:0,keys,values,links});seen.set(value,index);
    for(const key of keys){
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!Object.hasOwn(descriptor,'value')||key==='__proto__')throw Error('ZEN_PLUME_COMPILED_POSE_DATA');
      const child=descriptor.value,type=typeof child;
      if(type==='function'||type==='symbol'||type==='bigint')throw Error('ZEN_PLUME_COMPILED_POSE_DATA');
      const object=child!==null&&type==='object';
      links.push(object?visit(child):-1);values.push(object?null:child);
      propertyCount++;if(object)referenceCount++;
    }
    return index;
  }
  visit(root);
  return{entries,receipt:Object.freeze({schema:'zen_plume_compiled_copy_v1',objectCount:entries.length,propertyCount,referenceCount})};
}
function copyGraph({entries}){
  const copies=entries.map(entry=>entry.array?new Array(entry.length):{});
  for(let index=0;index<entries.length;index++){
    const {keys,values,links}=entries[index],output=copies[index];
    for(let field=0;field<keys.length;field++)output[keys[field]]=links[field]===-1?values[field]:copies[links[field]];
  }
  return copies[0];
}
function compileShoots(snapshot){
  if(snapshot.phase!=='spring')return [];
  const nodes=new Map(snapshot.nodes.map(node=>[node.id,node]));
  const segments=new Map(snapshot.segments.map(segment=>[segment.childNodeId,segment]));
  const units=new Map(snapshot.annualUnits.map(unit=>[unit.id,unit]));
  return snapshot.bloom.shootReceipts.map(receipt=>{
    const unit=units.get(receipt.unitId),support=nodes.get(unit.originNodeId);
    let parent=support;
    const pieces=unit.nodeIds.map(nodeId=>{
      const child=nodes.get(nodeId),segment=segments.get(nodeId),delta=subtract(child.p,parent.p);
      const piece={parentId:parent.id,childId:child.id,segmentId:segment.id,parentPosition:parent.p,childPosition:child.p,
        delta,length:Math.hypot(...delta),direction:normalize(delta),radius:segment.radius};
      parent=child;return piece;
    });
    return{unitId:unit.id,sourceBudId:receipt.sourceBudId,familyId:unit.familyId,kind:unit.kind,
      onset:receipt.onset,exponent:receipt.exponent,plannedLength:receipt.plannedLength,plannedNodeIds:unit.nodeIds,
      supportId:support.id,supportPosition:support.p,pieces};
  });
}
function prepare(study,raw){
  if(study?.schema!=='zen_cherry_plume_live_study_v1'||!Array.isArray(study.cloud?.snapshots)||!study.cloud.snapshots.includes(raw))
    throw Error('ZEN_PLUME_COMPILED_POSE_STUDY');
  let entries=preparedStudies.get(study);
  if(!entries){entries=new Map();preparedStudies.set(study,entries);}
  if(entries.has(raw))return entries.get(raw);
  if(entries.size>=MAX_PREPARED_POSES)throw Error('ZEN_PLUME_COMPILED_POSE_CAPACITY');
  // Frozen bloom first arranges flowers on prior-year support, then poses this
  // year's shoots. Plume subsequently reads only those same prior-year units
  // for flower framing. Their flower arrangement is therefore stage-invariant.
  const snapshot=createZenCherryPlumeSnapshot(raw,{seed:study.seed,strength:1,stage:1});
  const flowerSchedule=compileZenCherryPlumeFlowerDevelopment(snapshot.flowers,{seed:study.seed});
  const shoots=compileShoots(snapshot),copyPlan=compileCopy(snapshot);
  const publicValue=freezeTree({snapshot,flowerSchedule,compilation:copyPlan.receipt});
  const result={publicValue,shoots,copyPlan,f4Template:null};entries.set(raw,result);return result;
}

/** Read-only, cache-owned stage-1 observation for explicit preparation/camera work. */
export function prepareZenCherryPlumeCompiledPose(study,raw){return prepare(study,raw).publicValue;}

/** One read-only stage-0 template; F4 projection itself copies retained metadata. */
export function prepareZenCherryPlumeF4Template(study,raw){
  if(raw?.cycle!==1||raw.phase!=='spring')throw Error('ZEN_PLUME_COMPILED_F4_TEMPLATE');
  const prepared=prepare(study,raw);
  if(!prepared.f4Template)prepared.f4Template=freezeTree(createZenCherryPlumeCompiledPose(study,raw,0));
  return prepared.f4Template;
}

function poseShoots(snapshot,shoots,stage){
  const nodes=new Map(snapshot.nodes.map(node=>[node.id,node]));
  const exposed=new Set(snapshot.nodes.filter(node=>node.birthCycle!==snapshot.cycle).map(node=>node.id));
  const visibleSegments=new Set(snapshot.segments.filter(segment=>segment.birthCycle!==snapshot.cycle).map(segment=>segment.id));
  const exposedBudNodes=new Set(exposed),posedNodes=new Map(),tips=[],receipts=[];
  for(const shoot of shoots){
    const {unitId,sourceBudId,familyId,kind,onset,exponent,plannedLength,pieces}=shoot;
    const progress=stage===1?1:Math.pow(clamp((stage-onset)/(1-onset)),exponent);
    let remaining=progress*plannedLength,tipPosition=[...shoot.supportPosition],tipNodeId=shoot.supportId;
    let tipDirection=[...pieces[0].direction],partialNodeId=null;
    const visibleNodeIds=[],visibleSegmentIds=[];
    for(const item of pieces){
      if(remaining<=0)break;
      const fraction=progress===1?1:Math.min(1,remaining/item.length);
      exposed.add(item.childId);visibleSegments.add(item.segmentId);visibleNodeIds.push(item.childId);visibleSegmentIds.push(item.segmentId);
      tipNodeId=item.childId;tipDirection=[...item.direction];
      if(fraction===1){exposedBudNodes.add(item.childId);tipPosition=[...item.childPosition];}
      else{
        tipPosition=item.parentPosition.map((value,index)=>value+item.delta[index]*fraction);
        posedNodes.set(item.childId,{...nodes.get(item.childId),p:tipPosition,
          bloomEmergence:{fraction,plannedPosition:[...item.childPosition],unitId}});
        partialNodeId=item.childId;
      }
      remaining-=item.length;
    }
    receipts.push({unitId,sourceBudId,familyId,kind,stage,onset,exponent,progress,plannedLength,visibleLength:plannedLength*progress,
      plannedNodeIds:[...shoot.plannedNodeIds],visibleNodeIds,visibleSegmentIds,partialNodeId});
    tips.push({id:`living:${unitId}`,p:tipPosition,direction:tipDirection,nodeId:tipNodeId,sourceBudId,unitId,familyId,kind,
      progress,radius:pieces[pieces.length-1].radius,state:progress===0?'closed':progress===1?'extended':'extending'});
  }
  snapshot.nodes=snapshot.nodes.filter(node=>exposed.has(node.id)).map(node=>posedNodes.has(node.id)?posedNodes.get(node.id):node);
  snapshot.segments=snapshot.segments.filter(segment=>visibleSegments.has(segment.id));
  snapshot.buds=snapshot.buds.filter(bud=>exposedBudNodes.has(bud.nodeId));
  snapshot.livingTips=tips;
  snapshot.bloom.shootReceipts=receipts;
  snapshot.bloom.visibleCounts={nodes:snapshot.nodes.length,segments:snapshot.segments.length,buds:snapshot.buds.length,flowers:snapshot.flowers.length};
}

/** Independent mutable output, byte-equivalent to the original stage projection. */
export function createZenCherryPlumeCompiledPose(study,raw,stage){
  if(!Number.isFinite(stage)||stage<0||stage>1)throw Error('Cherry bloom: stage must be in [0, 1].');
  const prepared=prepare(study,raw),snapshot=copyGraph(prepared.copyPlan);
  snapshot.bloom.requestedStage=stage;
  if(snapshot.phase==='spring'){
    if(stage!==1)poseShoots(snapshot,prepared.shoots,stage);
    snapshot.bloom.stage=stage;snapshot.cloudPose.stage=stage;
  }
  return{snapshot,flowerSchedule:prepared.publicValue.flowerSchedule};
}
