import {ZEN_CHERRY_PLUME_LIVE_COMMAND_SCHEMA} from './canvas-executor.js';

export const ZEN_PLUME_LIVE_ATLAS_EDGE=2048;
export const ZEN_PLUME_LIVE_MAX_ATLASES=4;
const STATES=['fillStyle','strokeStyle','globalAlpha','lineWidth','lineCap','lineJoin','miterLimit','globalCompositeOperation'];
const sameArray=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);

// Small, explicit growth headroom amortizes layout changes. This is reserved
// atlas space, never a larger rendered crop. The four-atlas ceiling still holds.
export function packZenCherryPlumeLiveRuns(runs,edge=ZEN_PLUME_LIVE_ATLAS_EDGE){
  const placements=new Map(),atlases=[];
  const dimension=value=>Math.min(edge-4,Math.ceil((value+16)/16)*16);
  const sorted=runs.map((run,index)=>({run,index})).sort((a,b)=>b.run.bounds.height-a.run.bounds.height||a.index-b.index);
  for(const {run,index}of sorted){
    if(run.bounds.width+4>edge||run.bounds.height+4>edge)throw Error('ZEN_PLUME_LIVE_RUN_EXCEEDS_ATLAS');
    const capacityWidth=dimension(run.bounds.width),capacityHeight=dimension(run.bounds.height),w=capacityWidth+4,h=capacityHeight+4;
    let slot=null;
    for(let atlasIndex=0;atlasIndex<atlases.length&&!slot;atlasIndex++){
      const atlas=atlases[atlasIndex];
      for(const shelf of atlas.shelves)if(h<=shelf.height&&shelf.x+w<=edge){slot={atlasIndex,x:shelf.x+2,y:shelf.y+2,capacityWidth,capacityHeight};shelf.x+=w;break;}
      if(!slot&&atlas.nextY+h<=edge){slot={atlasIndex,x:2,y:atlas.nextY+2,capacityWidth,capacityHeight};atlas.shelves.push({x:w,y:atlas.nextY,height:h});atlas.nextY+=h;}
    }
    if(!slot){if(atlases.length===ZEN_PLUME_LIVE_MAX_ATLASES)throw Error('ZEN_PLUME_LIVE_TEXTURE_BUDGET:64MiB');slot={atlasIndex:atlases.length,x:2,y:2,capacityWidth,capacityHeight};atlases.push({shelves:[{x:w,y:0,height:h}],nextY:h});}
    placements.set(index,slot);
  }
  return {placements,atlases};
}

export function canReuseZenCherryPlumeLiveSlots(previous,next,packed){
  if(!previous||previous.width!==next.width||previous.height!==next.height||previous.runs.length!==next.runs.length)return false;
  return next.runs.every((run,index)=>{
    const old=previous.runs[index],slot=packed.placements.get(index);
    // The index owns draw order. A depth-slice ID may change when its number of
    // constituent organs changes; it is not a GPU-resource identity.
    return old.kind===run.kind&&old.rigId===run.rigId&&run.bounds.width<=slot.capacityWidth&&run.bounds.height<=slot.capacityHeight;
  });
}

// Exact values, not probabilistic hashes or huge serialized command strings.
// Gradient IDs are plan-local: compare recipes (including creation transforms)
// once per referenced pair. This cache lives for one update only.
export function compareZenCherryPlumeLiveRuns(previous,next){
  if(previous?.schema!==ZEN_CHERRY_PLUME_LIVE_COMMAND_SCHEMA||next?.schema!==ZEN_CHERRY_PLUME_LIVE_COMMAND_SCHEMA)throw Error('ZEN_PLUME_LIVE_COMMAND_PLAN');
  const gradientPairs=new Map();
  function sameValue(a,b){
    if(a===b&&(a===null||typeof a!=='object'))return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
    if(!Number.isInteger(a.gradient)||!Number.isInteger(b.gradient))throw Error('ZEN_PLUME_LIVE_GRADIENT_REFERENCE');
    let pairs=gradientPairs.get(a.gradient);if(!pairs){pairs=new Map();gradientPairs.set(a.gradient,pairs);}
    if(pairs.has(b.gradient))return pairs.get(b.gradient);
    const left=previous.gradients[a.gradient],right=next.gradients[b.gradient];
    if(!left||!right)throw Error('ZEN_PLUME_LIVE_GRADIENT_REFERENCE');
    const same=left.type===right.type&&sameArray(left.args,right.args)&&sameArray(left.transform,right.transform)&&left.stops.length===right.stops.length&&left.stops.every((stop,index)=>sameArray(stop,right.stops[index]));
    pairs.set(b.gradient,same);return same;
  }
  return next.runs.map((run,index)=>{
    const old=previous.runs[index];
    if(!old||old.bounds.x!==run.bounds.x||old.bounds.y!==run.bounds.y||old.bounds.width!==run.bounds.width||old.bounds.height!==run.bounds.height||old.end-old.start!==run.end-run.start||!sameArray(old.transform,run.transform))return false;
    if(!STATES.every(key=>sameValue(old.state[key],run.state[key])))return false;
    for(let offset=0;offset<run.end-run.start;offset++){
      const a=previous.commands[old.start+offset],b=next.commands[run.start+offset];
      if(a.length!==b.length)return false;
      for(let value=0;value<a.length;value++)if(!sameValue(a[value],b[value]))return false;
    }
    return true;
  });
}
