import {createZenBonsaiPlumeCamera} from './ZenBonsaiPlumeCamera.js';
import {createZenCherryPlumeLiveCommandPlan} from './live/command-plan.js';
import {resolveZenBonsaiPlumeSourceSeed} from './ZenBonsaiPlumeIdentity.js';
import {
  normalizeZenBonsaiActivationPresentation,
  resolveZenBonsaiActivationPresentationSignal,
} from '../presentation/ZenBonsaiActivationPresentation.js';
import {requireZenCherryCamera,ZEN_PLUME_RENDER_PROJECTION} from './annual/render.js';

export const ZEN_BONSAI_PLUME_RENDER_PLAN_CONTRACT='zen-bonsai-plume-render-plan-v1';
const validated=new WeakMap();
const topologySignatures=new WeakMap();
let previousPlan=null;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const freeze=(value,seen=new WeakSet())=>{if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);for(const child of Object.values(value))freeze(child,seen);Object.freeze(value);}return value;};
const hash=value=>{let result=2166136261;for(let index=0;index<value.length;index++)result=Math.imul(result^value.charCodeAt(index),16777619);return(result>>>0).toString(36);};
const smooth = value => value * value * (3 - 2 * value);

// Activity is presentation-only. Null is the existing explicit unscored surface
// contract, so it applies no activity suppression; it is not missing-state recovery.
export function applyZenBonsaiPlumeActivation(snapshot, activationPresentation) {
  const activation = normalizeZenBonsaiActivationPresentation(activationPresentation);
  if (activation === null) return snapshot;
  const signal = resolveZenBonsaiActivationPresentationSignal(activation);
  const amount = smooth(signal), previous = snapshot.live.presentation;
  return {
    ...snapshot,
    live: {
      ...snapshot.live,
      presentation: {
        ...previous,
        activation: signal,
        flowerAlpha: previous.flowerAlpha * (0.12 + 0.88 * amount),
        flowerOpening: previous.flowerOpening * (0.3 + 0.7 * amount),
        woodSaturation: previous.woodSaturation * (0.5 + 0.5 * signal),
        windResponse: 0.3 + 0.7 * signal,
      },
    },
  };
}

export function resolveZenBonsaiPlumeTopologySignature(topology){
  if(topologySignatures.has(topology))return topologySignatures.get(topology);
  if(!object(topology)||topology.engine!=='plume'||topology.isPlume!==true||topology.contract!=='zen_bonsai_plume_topology_v1'||!object(topology.snapshot)||!Array.isArray(topology.cameraSnapshots)||!topology.cameraSnapshots.length)throw Error('ZEN_BONSAI_PLUME_TOPOLOGY_REQUIRED');
  if(topology.sourceSeed!==resolveZenBonsaiPlumeSourceSeed(topology.seed))throw Error('ZEN_BONSAI_PLUME_TOPOLOGY_SEED_MISMATCH');
  return'plume:'+hash(JSON.stringify({contract:topology.contract,seed:topology.seed,sourceSeed:topology.sourceSeed,snapshot:topology.snapshot,cameraSnapshots:topology.cameraSnapshots,lifeState:topology.lifeState}));
}
function surfaceFrom(surface){
  if(!object(surface)||!object(surface.treeViewport))throw Error('ZEN_BONSAI_PLUME_RENDER_PLAN_SURFACE');
  const {pixelWidth,pixelHeight,treeViewport}=surface;
  if(![pixelWidth,pixelHeight,treeViewport.width,treeViewport.height].every(value=>Number.isSafeInteger(value)&&value>0)||![treeViewport.x,treeViewport.y].every(value=>Number.isSafeInteger(value)&&value>=0)||treeViewport.x+treeViewport.width>pixelWidth||treeViewport.y+treeViewport.height>pixelHeight)throw Error('ZEN_BONSAI_PLUME_RENDER_PLAN_SURFACE');
  return{pixelWidth,pixelHeight,treeViewport:{x:treeViewport.x,y:treeViewport.y,width:treeViewport.width,height:treeViewport.height},clipTreePaint:surface.clipTreePaint===true};
}
export function createZenBonsaiPlumeRenderPlanV1({topology,sourceTopologySignature=null,surface,includePot=true,includeBackground=false,cameraAnchor=null,groundPlane=null,activationPresentation=null,pixelRatio=1}={}){
  const topologySignature=resolveZenBonsaiPlumeTopologySignature(topology);
  if(sourceTopologySignature!==null&&sourceTopologySignature!==topologySignature)throw Error('ZEN_BONSAI_PLUME_RENDER_PLAN_TOPOLOGY_SIGNATURE_MISMATCH');
  if(typeof includePot!=='boolean'||typeof includeBackground!=='boolean'||!Number.isFinite(pixelRatio)||pixelRatio<=0)throw Error('ZEN_BONSAI_PLUME_RENDER_PLAN_OPTIONS');
  const resolvedSurface=surfaceFrom(surface),options=structuredClone({includePot,includeBackground,cameraAnchor,groundPlane,activationPresentation,pixelRatio});
  const snapshot=applyZenBonsaiPlumeActivation(topology.snapshot,activationPresentation);
  const camera=createZenBonsaiPlumeCamera(topology.cameraSnapshots,resolvedSurface.pixelWidth,resolvedSurface.pixelHeight,options);
  requireZenCherryCamera(camera);
  const displayPlan=createZenCherryPlumeLiveCommandPlan(snapshot,{width:resolvedSurface.pixelWidth,height:resolvedSurface.pixelHeight,camera,pixelRatio,includePot,includeBackground});
  const sceneSignature='plume-scene:'+hash(JSON.stringify(displayPlan));
  const signature='plume-plan:'+hash(JSON.stringify({topologySignature,surface:resolvedSurface,options,sceneSignature}));
  const plan=freeze({contract:ZEN_BONSAI_PLUME_RENDER_PLAN_CONTRACT,version:1,coordinateSpace:'canvas-device',source:{topologySignature,sceneSignature,seed:topology.seed,sourceSeed:topology.sourceSeed},surface:resolvedSurface,options,
    scene:{width:displayPlan.width,height:displayPlan.height,projection:ZEN_PLUME_RENDER_PROJECTION,camera,signature:sceneSignature,displayPlan},
    bounds:{contract:'zen-bonsai-plume-render-bounds-v1',source:'plume-scene-command-viewport',minX:0,minY:0,maxX:resolvedSurface.pixelWidth,maxY:resolvedSurface.pixelHeight,width:resolvedSurface.pixelWidth,height:resolvedSurface.pixelHeight},
    bakeSignature:'plume-bake:'+sceneSignature,signature});
  return acceptRenderPlan(plan,topology);
}
function acceptRenderPlan(plan,topology){
  // The identity fast path is valid only after the entire accepted topology is
  // immutable. Structured-cloned worker payloads regain this contract here.
  if(!topologySignatures.has(topology))freeze(topology);
  topologySignatures.set(topology,plan.source.topologySignature);
  validated.set(plan,topology);previousPlan=new WeakRef(plan);
  return plan;
}
export function requireZenBonsaiPlumeRenderPlanV1(plan,{topology}={}){
  if(object(plan)&&validated.get(plan)===topology&&topology)return plan;
  if(!object(plan)||plan.contract!==ZEN_BONSAI_PLUME_RENDER_PLAN_CONTRACT||plan.version!==1||plan.coordinateSpace!=='canvas-device'||!object(plan.source)||typeof plan.source.topologySignature!=='string'||!object(plan.options))throw Error('ZEN_BONSAI_PLUME_RENDER_PLAN_INVALID');
  if(!topology)throw Error('ZEN_BONSAI_PLUME_RENDER_PLAN_TOPOLOGY_REQUIRED');
  const previous=previousPlan?.deref();
  if(previous&&plan.signature===previous.signature&&matchesCanonicalValue(plan,previous)&&matchesCanonicalValue(topology,validated.get(previous)))return acceptRenderPlan(freeze(plan),topology);
  const rebuilt=createZenBonsaiPlumeRenderPlanV1({topology,sourceTopologySignature:plan.source.topologySignature,surface:plan.surface,...plan.options});
  if(JSON.stringify(plan)!==JSON.stringify(rebuilt))throw Error('ZEN_BONSAI_PLUME_RENDER_PLAN_SIGNATURE_MISMATCH');
  return rebuilt;
}

// The canonical DTO is an immutable tree of ordinary records and arrays.
// Match all keys and values; the signature only selects a possible candidate.
function matchesCanonicalValue(a,b){
  if(a===b)return true;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
  if(Array.isArray(a)!==Array.isArray(b)||Object.getPrototypeOf(a)!==Object.getPrototypeOf(b))return false;
  if(Array.isArray(a)&&a.length!==b.length)return false;
  const ak=Object.keys(a),bk=Object.keys(b);
  if(ak.length!==bk.length)return false;
  for(let i=0;i<bk.length;i++){const k=bk[i];if(ak[i]!==k||!matchesCanonicalValue(a[k],b[k]))return false;}
  return true;
}
