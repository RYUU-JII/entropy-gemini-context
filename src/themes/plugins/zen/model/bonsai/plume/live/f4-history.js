import {clamp,smooth} from './clock.js';

export function createZenCherryPlumeF4History(reference,graph){
  const scaffold=reference.scaffold;
  const roots=graph.nodes.filter(n=>n.parentNodeId===null);
  if(roots.length!==1)throw Error('ZEN_CHERRY_PLUME_LIVE_F4_ROOT');
  const retirement=new Map(graph.juvenileAxisRetirements.map(r=>[r.lineageId,r.retiredAtEvent]));
  const visible=graph.segments.filter(s=>!retirement.has(s.lineageId)||retirement.get(s.lineageId)>graph.events.length-1);
  const sourceNodes=new Map(graph.nodes.map(n=>[n.id,n]));
  // Preserve the prior first-match lookup while indexing the fixed scaffold
  // once instead of scanning every node for both ends of every segment.
  const scaffoldNodes=new Map();
  for(const node of scaffold.nodes)if(!scaffoldNodes.has(node.id))scaffoldNodes.set(node.id,node);
  if(visible.length!==scaffold.segments.length)throw Error('ZEN_CHERRY_PLUME_LIVE_F4_ENDPOINT_COUNT');
  const fixed=new Map(scaffold.segments.map(s=>[s.sourceSegmentId,s]));
  for(const s of visible){
    const old=fixed.get(s.id),a=sourceNodes.get(s.fromNodeId),b=sourceNodes.get(s.toNodeId);
    if(!old||old.startRadius!==s.startRadius||old.endRadius!==s.endRadius)throw Error('ZEN_CHERRY_PLUME_LIVE_F4_ENDPOINT_RADIUS');
    for(const[n,id]of[[a,old.parentNodeId],[b,old.childNodeId]]){
      const node=scaffoldNodes.get(id);
      if(!node||JSON.stringify(node.p)!==JSON.stringify([n.point.x,n.point.y,n.point.z]))throw Error('ZEN_CHERRY_PLUME_LIVE_F4_ENDPOINT_POINT');
    }
  }
  return{schema:'zen_cherry_plume_f4_history_v1',seed:graph.seed,source:structuredClone(scaffold.source),rootNodeId:roots[0].id,
    nodes:graph.nodes.map(n=>({id:n.id,point:structuredClone(n.point),parentNodeId:n.parentNodeId,incomingSegmentId:n.incomingSegmentId,birthEvent:n.birthEvent})),
    segments:graph.segments.map(s=>({id:s.id,fromNodeId:s.fromNodeId,toNodeId:s.toNodeId,lineageId:s.lineageId,birthEvent:s.birthEvent,startRadius:s.startRadius,endRadius:s.endRadius})),
    events:graph.events.map(e=>({id:e.id,sequence:e.sequence,kind:e.kind,createdNodeIds:[...e.createdNodeIds],createdSegmentIds:[...e.createdSegmentIds]})),
    retirements:structuredClone(graph.juvenileAxisRetirements),
    semantics:'Exact compact projection of the pinned complete F4 graph. Includes juvenile axes removed from the mature scaffold; source nodes, birth events, radii and retirement receipts are preserved. Event transition extension/girth and pre-retirement fading are explicit presentation hypotheses.'};
}

const point=node=>[node.point.x,node.point.y,node.point.z];
const id=(history,value)=>value===history.rootNodeId?'origin':`f4:${value}`;
const REPLACED_POSE_FIELDS=['nodes','segments','annualUnits','axes','buds','flowers','attachments','livingTips','events'];
export function poseZenCherryPlumeF4History(history,template,progress,{envelope=false}={}){
  if(history?.schema!=='zen_cherry_plume_f4_history_v1'||!Number.isFinite(progress)||progress<0||progress>1)throw Error('ZEN_CHERRY_PLUME_LIVE_F4_HISTORY');
  const eventTime=progress*(history.events.length-1),nodes=new Map(history.nodes.map(n=>[n.id,n]));
  const retirement=new Map(history.retirements.map(r=>[r.lineageId,r.retiredAtEvent]));
  const posedPoints=new Map([[history.rootNodeId,point(nodes.get(history.rootNodeId))]]),segments=[],visibility=[];
  for(const segment of history.segments){
    const extension=envelope?1:smooth(eventTime-segment.birthEvent+1);
    const alpha=envelope||!retirement.has(segment.lineageId)?1:1-smooth(eventTime-(retirement.get(segment.lineageId)-1));
    if(extension===0||alpha===0)continue;
    const sourceStart=point(nodes.get(segment.fromNodeId)),sourceEnd=point(nodes.get(segment.toNodeId));
    if(!posedPoints.has(segment.fromNodeId))throw Error(`ZEN_CHERRY_PLUME_LIVE_F4_DETACHED:${segment.id}`);
    const start=posedPoints.get(segment.fromNodeId),end=start.map((v,i)=>v+(sourceEnd[i]-sourceStart[i])*extension);
    posedPoints.set(segment.toNodeId,end);
    // Length establishes over one event; local wood mass follows over a longer
    // window. The final event caps that window so the recorded F4 endpoint stays
    // exact. Wood-development reserves additional girth for the later seasons.
    const girthSpan=Math.min(2.4,history.events.length-segment.birthEvent);
    if(!(girthSpan>=1))throw Error(`ZEN_CHERRY_PLUME_LIVE_F4_BIRTH:${segment.id}`);
    const localGirth=envelope?1:smooth((eventTime-segment.birthEvent+1)/girthSpan);
    const girth=envelope?1:(.22+.78*Math.pow(progress,.55))*Math.pow(localGirth,.55);
    const startRadius=segment.startRadius*girth,endRadius=segment.endRadius*girth;
    const record={id:`f4:${segment.id}`,parentNodeId:id(history,segment.fromNodeId),childNodeId:id(history,segment.toNodeId),
      axisId:`f4:${segment.lineageId}`,radius:(startRadius+endRadius)/2,startRadius,endRadius,birthCycle:null,unitId:null,
      kind:'scaffold',sourceSegmentId:segment.id,sourceBirthEvent:segment.birthEvent,owner:'f4-scaffold'};
    segments.push(record);visibility.push({id:record.id,alpha});
  }
  const posedNodes=history.nodes.filter(n=>posedPoints.has(n.id)).map(n=>({id:id(history,n.id),p:posedPoints.get(n.id),birthCycle:null,
    sourceNodeId:n.id,sourceBirthEvent:n.birthEvent,owner:'f4-scaffold'}));
  // These organ arrays are replaced below. Clone only retained metadata;
  // masking existing keys preserves output ordering for full/sparse templates.
  const shell={...template};
  for(const key of REPLACED_POSE_FIELDS)if(Object.hasOwn(shell,key))shell[key]=null;
  const snapshot={...structuredClone(shell),id:`live:f4:${history.seed}`,nodes:posedNodes,segments,
    annualUnits:[],axes:[],buds:[],flowers:[],attachments:[],livingTips:[],events:[]};
  return{snapshot,visibility,eventTime,activeEventSequence:eventTime===Math.floor(eventTime)?null:Math.ceil(eventTime),
    retirements:history.retirements.map(r=>({lineageId:r.lineageId,retiredAtEvent:r.retiredAtEvent,
      alpha:envelope?1:1-smooth(eventTime-(r.retiredAtEvent-1))})),
    sourceEventsVisible:Math.min(history.events.length,Math.floor(eventTime)+1)};
}
