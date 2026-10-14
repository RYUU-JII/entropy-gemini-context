import {createZenCherryPlumeCompiledPose,prepareZenCherryPlumeF4Template} from './compiled-pose.js';
import {createZenCherryPlumeSnapshot} from '../plume/model.js';
import {resolveZenCherryPlumeLiveClock,smooth,clamp} from './clock.js';
import {poseZenCherryPlumeF4History} from './f4-history.js';
import {applyZenCherryPlumeWoodDevelopment} from './wood-development.js';
import {requireZenGeneratedCherryPlumeFlowerDevelopmentInput,resolveZenCherryPlumeFlowerDevelopment} from './flower-development.js';

export const CHERRY_PLUME_LIVE_MODEL_ID='zen_cherry_plume_live_v1';
const optionsKeys=new Set(['growth','activation','year','phase','stage']);
function foundation(snapshot,progress){
  const sourceNodes=new Map(snapshot.nodes.map(n=>[n.id,n]));
  const points=new Map(snapshot.nodes.filter(n=>n.owner==='f4-scaffold').map(n=>[n.id,[...n.p]]));
  const kept=new Set(snapshot.segments.filter(s=>s.owner==='f4-scaffold').map(s=>s.id));
  const nodeProgress=new Map(),segmentByChild=new Map(snapshot.segments.map(s=>[s.childNodeId,s]));
  const units=snapshot.annualUnits.filter(u=>u.cycle===0);
  for(const unit of units){
    const lengths=[],plan=[];let parent=sourceNodes.get(unit.originNodeId);
    if(!parent||!points.has(parent.id))throw Error('ZEN_CHERRY_PLUME_LIVE_FOUNDATION_ORIGIN');
    for(const nodeId of unit.nodeIds){
      const child=sourceNodes.get(nodeId),segment=segmentByChild.get(nodeId);
      if(!child||!segment||segment.parentNodeId!==parent.id)throw Error('ZEN_CHERRY_PLUME_LIVE_FOUNDATION_PLAN');
      const length=Math.hypot(...child.p.map((v,i)=>v-parent.p[i]));
      lengths.push(length);plan.push({parent,child,segment,length});parent=child;
    }
    let remaining=lengths.reduce((a,b)=>a+b,0)*progress;
    for(const item of plan){
      if(remaining<=0)break;
      const fraction=progress===1?1:Math.min(1,remaining/item.length);
      points.set(item.child.id,item.parent.p.map((v,i)=>v+(item.child.p[i]-v)*fraction));
      nodeProgress.set(item.child.id,fraction);kept.add(item.segment.id);remaining-=item.length;
    }
  }
  const segments=snapshot.segments.filter(s=>kept.has(s.id)).map(s=>{
    if(s.owner==='f4-scaffold')return s;
    return{...s,radius:s.radius*Math.pow(nodeProgress.get(s.childNodeId),.35)};
  });
  const posed={...snapshot,nodes:snapshot.nodes.filter(n=>points.has(n.id)).map(n=>({...n,p:points.get(n.id)})),segments,
    buds:snapshot.buds.filter(b=>points.has(b.nodeId)),flowers:[],livingTips:[]};
  return{snapshot:posed,buds:posed.buds.map(b=>({id:b.id,alpha:nodeProgress.has(b.nodeId)?smooth(nodeProgress.get(b.nodeId)):1}))};
}

function prepareCompiledPose(study,raw,clock){
  return clock.mode==='f4'?prepareZenCherryPlumeF4Template(study,raw)
    :createZenCherryPlumeCompiledPose(study,raw,clock.growth===1?clock.target.stage:clock.observedStage);
}
function prepareGeneratedPose(study,raw,clock){
  const stage=clock.mode==='f4'?0:clock.growth===1?clock.target.stage:clock.observedStage;
  const snapshot=createZenCherryPlumeSnapshot(raw,{seed:study.seed,strength:1,stage});
  requireZenGeneratedCherryPlumeFlowerDevelopmentInput(snapshot.flowers,{seed:study.seed});
  return{snapshot};
}

// Public/retained-study projections preserve compiled-copy data admission and
// the existing prepared-pose API. Native product Worker requests select the
// one-use pose below; no caller input chooses a projection strategy.
export function createZenCherryPlumeLiveSnapshot(study,options={}){
  return projectLiveSnapshot(study,options,prepareCompiledPose);
}
export function createZenGeneratedCherryPlumeLiveSnapshot(study,options){
  const snapshot=projectLiveSnapshot(study,options,prepareGeneratedPose);
  // F4 posing supplies empty source-audit collections. The compact product
  // snapshot excludes those audit fields in every growth mode, including F4.
  delete snapshot.axes;delete snapshot.events;
  return snapshot;
}

function projectLiveSnapshot(study,options,preparePose){
  if(!options||Array.isArray(options)||Object.keys(options).some(key=>!optionsKeys.has(key)))throw Error('ZEN_CHERRY_PLUME_LIVE_OPTIONS');
  if(study?.schema!=='zen_cherry_plume_live_study_v1'||study.sourceHash!=='3a872e67e2e1676048fb56cd9208b83ed9933636973267766d8954e9e56e7bdb')
    throw Error('ZEN_CHERRY_PLUME_LIVE_STUDY');
  const clock=resolveZenCherryPlumeLiveClock(options),seed=study.seed;
  const raw=study.cloud.snapshots.find(s=>s.cycle===clock.observedYear&&s.phase===clock.observedPhase);
  if(!raw)throw Error('ZEN_CHERRY_PLUME_LIVE_SNAPSHOT');
  const prepared=preparePose(study,raw,clock);
  let snapshot=prepared.snapshot;
  let f4=null,visibility={segments:[],flowers:[],buds:[]};
  if(clock.mode==='f4'){
    const projected=poseZenCherryPlumeF4History(study.f4History,snapshot,clock.f4Progress);
    snapshot=projected.snapshot;visibility.segments=projected.visibility;
    f4={eventTime:projected.eventTime,activeEventSequence:projected.activeEventSequence,
      sourceEventsVisible:projected.sourceEventsVisible,retirements:projected.retirements};
  }else if(clock.mode==='foundation'){
    const projected=foundation(snapshot,clock.foundationProgress);snapshot=projected.snapshot;visibility.buds=projected.buds;
  }
  const woodDevelopment=applyZenCherryPlumeWoodDevelopment(study,snapshot,clock);
  snapshot=woodDevelopment.snapshot;
  const flowerDevelopment=resolveZenCherryPlumeFlowerDevelopment(snapshot.flowers,{
    seed,budbreakProgress:clamp(clock.observedLocalTime/.25),
    seasonalAlpha:clock.mode==='budbreak'?1:clock.flowerPresence,
  },snapshot.flowers.length?prepared.flowerSchedule:undefined);
  visibility.flowers=flowerDevelopment.flowers.map(({id,alpha})=>({id,alpha}));
  const activation=clock.activation;
  snapshot.live={modelId:CHERRY_PLUME_LIVE_MODEL_ID,seed,sourceHash:study.sourceHash,clock,f4,visibility,
    development:{contract:'zen_cherry_plume_live_development_v1',wood:woodDevelopment.receipt,flower:flowerDevelopment},
    tray:{height:study.reference.scaffold.bounds.height,origin:[...study.reference.scaffold.nodes.find(n=>n.id==='origin').p]},
    presentation:{activation,flowerAlpha:.12+.88*smooth(activation),flowerOpening:.3+.7*smooth(activation),
      woodSaturation:.5+.5*activation,windResponse:.3+.7*activation},
    restCounts:{nodes:snapshot.nodes.length,segments:snapshot.segments.length,flowers:snapshot.flowers.length,buds:snapshot.buds.length},
    semantics:'Growth projects original event/annual histories with separate extension, girth and staggered bloom presentation. Mature selected observations remain exact; developmental metadata describes display timing, not new organs or a carbon model. Activation changes paint/motion response only and never rest geometry or development timing.'};
  return snapshot;
}
