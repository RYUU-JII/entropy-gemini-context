import {CHERRY_PLUME_LIVE_CYCLE_SPAN,clamp,smooth} from './clock.js';

export const ZEN_PLUME_WOOD_DEVELOPMENT='zen_cherry_plume_wood_development_v1';
// Study identities are immutable observation inputs. This weak cache stores
// derived birth schedules and source-record indexes only, never mutable poses.
// A new study identity receives a new index; discarded studies remain collectible.
const compiledStudies=new WeakMap();
const radialFields=['radius','startRadius','endRadius'];
const yearBase=year=>1+(year-1)*CHERRY_PLUME_LIVE_CYCLE_SPAN;
const required=(map,key,label)=>{
  if(!map.has(key))throw Error(`ZEN_PLUME_WOOD_${label}:${key}`);
  return map.get(key);
};
const distance=(a,b)=>Math.hypot(...a.map((value,index)=>value-b[index]));
function draw(seed,key){
  // Exact onset sampler inherited from the frozen bloom stageShoots owner.
  let value=(seed^2166136261)>>>0;
  for(let index=0;index<key.length;index++)value=Math.imul(value^key.charCodeAt(index),16777619)>>>0;
  value^=value>>>16;value=Math.imul(value,0x7feb352d);value^=value>>>15;value=Math.imul(value,0x846ca68b);
  return((value^(value>>>16))>>>0)/4294967296;
}
function compile(study){
  if(compiledStudies.has(study))return compiledStudies.get(study);
  if(study?.schema!=='zen_cherry_plume_live_study_v1'||!Array.isArray(study.cloud?.snapshots))throw Error('ZEN_PLUME_WOOD_STUDY');
  const rows=new Map(),births=new Map();
  for(const source of study.cloud.snapshots){
    const key=`${source.cycle}:${source.phase}`;
    if(rows.has(key))throw Error('ZEN_PLUME_WOOD_DUPLICATE_OBSERVATION');
    rows.set(key,new Map(source.segments.map(segment=>[segment.id,segment])));
    if(source.phase!=='spring')continue;
    const nodes=new Map(source.nodes.map(node=>[node.id,node])),incoming=new Map(source.segments.map(segment=>[segment.childNodeId,segment]));
    for(const unit of source.annualUnits){
      if(unit.nodeIds.length===0)throw Error('ZEN_PLUME_WOOD_EMPTY_UNIT');
      if(births.has(required(incoming,unit.nodeIds[0],'SEGMENT').id))continue;
      if(!Number.isInteger(unit.cycle)||unit.cycle<0||!['long','short'].includes(unit.kind))throw Error('ZEN_PLUME_WOOD_UNIT');
      let parent=required(nodes,unit.originNodeId,'ORIGIN');const pieces=[];
      for(const nodeId of unit.nodeIds){
        const child=required(nodes,nodeId,'NODE'),segment=required(incoming,nodeId,'SEGMENT'),length=distance(parent.p,child.p);
        if(segment.parentNodeId!==parent.id||segment.unitId!==unit.id||segment.birthCycle!==unit.cycle||!(length>0))throw Error('ZEN_PLUME_WOOD_UNIT_PLAN');
        pieces.push({segment,length});parent=child;
      }
      const length=pieces.reduce((total,piece)=>total+piece.length,0);
      const onset=(unit.kind==='long'?.18:.04)+draw(study.seed,`${unit.id}:onset`)*(unit.kind==='long'?.30:.26);
      const exponent=(unit.kind==='long'?1.22:.80)+draw(study.seed,`${unit.id}:pace`)*.55;
      let preceding=0;
      for(const piece of pieces){
        const startFraction=preceding/length,endFraction=(preceding+piece.length)/length;
        const stageAt=fraction=>onset+(1-onset)*Math.pow(fraction,1/exponent);
        const birthTime=unit.cycle===0?startFraction:yearBase(unit.cycle)+.25+stageAt(startFraction);
        const extensionMatureTime=unit.cycle===0?endFraction:yearBase(unit.cycle)+.25+stageAt(endFraction);
        births.set(piece.segment.id,{birthTime,extensionMatureTime,
          girthMatureTime:unit.cycle===0?1.25:yearBase(unit.cycle)+1.4,unitId:unit.id,birthCycle:unit.cycle});
        preceding+=piece.length;
      }
    }
  }
  // The saved graph supplies the radius stock; presentation only distributes
  // its already-recorded summer deposition over time.
  for(let year=1;year<=3;year++){
    const spring=required(rows,`${year}:spring`,'SPRING'),summer=required(rows,`${year}:summer`,'SUMMER');
    const winter=required(rows,`${year}:winter`,'WINTER');
    for(const [id,a]of spring){
      const b=required(summer,id,'SUMMER_SEGMENT'),c=required(winter,id,'WINTER_SEGMENT');
      for(const key of radialFields)if(Object.hasOwn(a,key)){
        if(!Number.isFinite(a[key])||a[key]<=0||!Number.isFinite(b[key])||b[key]<a[key]-1e-10||c[key]!==b[key])
          throw Error(`ZEN_PLUME_WOOD_RADIUS_HISTORY:${id}:${key}`);
        if(year<3){
          const next=required(required(rows,`${year+1}:spring`,'NEXT_SPRING'),id,'RETAINED_SEGMENT');
          if(next[key]!==c[key])throw Error(`ZEN_PLUME_WOOD_YEAR_RADIUS_JOIN:${id}:${key}`);
        }
      }
    }
  }
  const result={rows,births};compiledStudies.set(study,result);return result;
}

// Product presentation may read birth timing, but cannot mutate this private
// study index or reconstruct the frozen shoot onset/length plan elsewhere.
export function resolveZenCherryPlumeWoodBirths(study,snapshot){
  if(!Array.isArray(snapshot?.segments))throw Error('ZEN_PLUME_WOOD_BIRTH_INPUT');
  const {births}=compile(study);
  return snapshot.segments.filter(segment=>segment.owner!=='f4-scaffold').map(segment=>{
    const birth=required(births,segment.id,'BIRTH');
    return{id:segment.id,birthTime:birth.birthTime};
  });
}

/**
 * Presentation over immutable planned wood. Length/organ ownership stay with
 * F4 and frozen spring shoots; local extension and deposition have distinct clocks.
 * A selected partial-spring endpoint explicitly caps deposition completion so
 * every growth-1 year/phase/stage remains the exact accepted Plume observation.
 */
export function applyZenCherryPlumeWoodDevelopment(study,snapshot,clock){
  if(!snapshot||!Array.isArray(snapshot.segments)||!clock
    ||![clock.growth,clock.annualTime,clock.annualTarget,clock.observedLocalTime].every(Number.isFinite)
    ||clock.growth<0||clock.growth>1||clock.annualTarget<=0)throw Error('ZEN_PLUME_WOOD_INPUT');
  const data=compile(study),year=clock.observedYear;
  const spring=required(data.rows,`${year}:spring`,'SPRING'),summer=required(data.rows,`${year}:summer`,'SUMMER');
  const deposition=smooth((clock.observedLocalTime-1.25)/.25);
  const scaffoldMassScale=.55+.45*smooth(clock.growth);
  let changedSegmentCount=0,developingSegmentCount=0,annualInterpolatedSegmentCount=0,maxRelativeRadiusDelta=0;
  const segments=snapshot.segments.map(segment=>{
    let next;
    if(segment.owner==='f4-scaffold'){
      if(scaffoldMassScale===1)return segment;
      next={...segment};for(const key of radialFields)if(Object.hasOwn(segment,key))next[key]=segment[key]*scaffoldMassScale;
      developingSegmentCount++;
    }else{
      const source=required(spring,segment.id,'SPRING_SEGMENT'),summerSource=required(summer,segment.id,'SUMMER_SEGMENT');
      const birth=required(data.births,segment.id,'BIRTH');
      const matureTime=Math.min(birth.girthMatureTime,clock.annualTarget);
      if(!(matureTime>birth.birthTime))throw Error(`ZEN_PLUME_WOOD_MATURATION:${segment.id}`);
      const girthProgress=clamp((clock.annualTime-birth.birthTime)/(matureTime-birth.birthTime));
      // A visible just-born fragment needs a strictly positive Canvas radius.
      // Machine epsilon only resolves the equal-time floating-point boundary;
      // the presentation curve itself has zero width at birth, not a shoot floor.
      const scale=Math.pow(Math.max(Number.EPSILON,smooth(girthProgress)),.55);
      if(girthProgress<1)developingSegmentCount++;
      next={...segment};let interpolated=false;
      for(const key of radialFields)if(Object.hasOwn(source,key)){
        const stock=deposition===1?summerSource[key]:deposition===0?source[key]:source[key]+(summerSource[key]-source[key])*deposition;
        next[key]=scale===1?stock:stock*scale;
        if(deposition>0&&deposition<1&&summerSource[key]!==source[key])interpolated=true;
      }
      if(interpolated)annualInterpolatedSegmentCount++;
    }
    if(!(next.radius>0)||!radialFields.filter(key=>Object.hasOwn(next,key)).every(key=>Number.isFinite(next[key])&&next[key]>0))
      throw Error(`ZEN_PLUME_WOOD_PROJECTED_RADIUS:${segment.id}`);
    let changed=false;
    for(const key of radialFields)if(Object.hasOwn(segment,key)&&next[key]!==segment[key]){
      changed=true;maxRelativeRadiusDelta=Math.max(maxRelativeRadiusDelta,Math.abs(next[key]-segment[key])/segment[key]);
    }
    if(changed)changedSegmentCount++;
    return changed?next:segment;
  });
  return{snapshot:changedSegmentCount?{...snapshot,segments}:snapshot,receipt:{schema:ZEN_PLUME_WOOD_DEVELOPMENT,
    scaffoldMassScale,changedSegmentCount,developingSegmentCount,annualInterpolatedSegmentCount,maxRelativeRadiusDelta,
    annualTime:clock.annualTime,selectedEndpointTime:clock.annualTarget,summerDeposition:deposition,shootWidthFloor:0,
    extensionPolicy:'Original shoot onset and length plans; F4 event length uses smoothstep, local girth up to 2.4 events.',
    girthPolicy:'Reserved scaffold mass across whole growth; independent annual shoot establishment and smooth recorded summer deposition.',
    endpointPolicy:'Maturation is capped at the explicitly selected observation time; no growth-1 geometry replacement.',
    scope:'Detached presentation of recorded graph/radius stocks; no new anatomy or calibrated cambial/resource simulation.'}};
}
