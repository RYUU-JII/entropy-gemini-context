import {ZEN_PLUME_FLOWER_ATLAS,replayZenCherryPlumeFlower} from './flower-material.js';
import {compileZenBonsaiPlumeBloomPresentation,requireZenBonsaiPlumeBloomPresentationProgress,requireZenBonsaiPlumeBloomInvitation,resolveZenBonsaiPlumeBloomPose} from '../ZenBonsaiPlumeBloomPresentation.js';
import {compileZenBonsaiPlumeBloomRegions} from '../ZenBonsaiPlumeBloomRegions.js';
import {createZenBotanicalMaterialContext} from '../../../../runtime/environment/zenWorldBotanicalMaterialLighting.js';
export const ZEN_CHERRY_PLUME_LIVE_COMMAND_SCHEMA='zen_cherry_plume_live_commands_v2';
const IDENTITY=[1,0,0,1,0,0];
const PROPERTIES=['fillStyle','strokeStyle','globalAlpha','lineWidth','lineCap','lineJoin','miterLimit','globalCompositeOperation'];
const METHODS=new Set(['save','restore','translate','rotate','scale','transform','setTransform','resetTransform','beginPath','closePath','moveTo','lineTo','bezierCurveTo','quadraticCurveTo','arc','ellipse','fill','stroke','fillRect','strokeRect','clearRect']);
const INITIAL={fillStyle:'#000000',strokeStyle:'#000000',globalAlpha:1,lineWidth:1,lineCap:'butt',lineJoin:'miter',miterLimit:10,globalCompositeOperation:'source-over'};
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];

// A deliberately narrow Canvas recording surface. Unknown methods/properties
// fail rather than silently dropping part of a painter. No native handles enter
// the resulting plan; gradients are serializable recipes with creation matrices.
export function createZenCherryPlumeLiveRecorder(width,height) {
  let state={...INITIAL},matrix=[...IDENTITY],stack=[],current=null,maxStroke=0;
  // The recorder only uses transformed path points for a conservative rectangle.
  // Retain those same extrema instead of allocating and rescanning every point
  // on each fill/stroke. Rect paint does not change the current Canvas path.
  let pathMinX=Infinity,pathMinY=Infinity,pathMaxX=-Infinity,pathMaxY=-Infinity,pathSize=0;
  const commands=[],runs=[],gradients=[];
  const add=(op,args=[])=>commands.push([op,...args]);
  const pathPoint=(x,y)=>{
    const px=matrix[0]*x+matrix[2]*y+matrix[4],py=matrix[1]*x+matrix[3]*y+matrix[5];
    pathMinX=Math.min(pathMinX,px);pathMinY=Math.min(pathMinY,py);
    pathMaxX=Math.max(pathMaxX,px);pathMaxY=Math.max(pathMaxY,py);pathSize++;
  };
  const extendPath=margin=>{
    if(!current)throw Error('ZEN_PLUME_LIVE_COMMAND_WITHOUT_RUN');
    if(!pathSize)return;
    const bounds=current.bounds;
    bounds.minX=Math.min(bounds.minX,pathMinX-margin);bounds.minY=Math.min(bounds.minY,pathMinY-margin);
    bounds.maxX=Math.max(bounds.maxX,pathMaxX+margin);bounds.maxY=Math.max(bounds.maxY,pathMaxY+margin);
  };
  const extendPoint=(x,y,margin)=>{
    const px=matrix[0]*x+matrix[2]*y+matrix[4],py=matrix[1]*x+matrix[3]*y+matrix[5],bounds=current.bounds;
    bounds.minX=Math.min(bounds.minX,px-margin);bounds.minY=Math.min(bounds.minY,py-margin);
    bounds.maxX=Math.max(bounds.maxX,px+margin);bounds.maxY=Math.max(bounds.maxY,py+margin);
  };
  const methods={};
  for(const op of METHODS)methods[op]=(...args)=>{
    if(args.some(value=>typeof value==='number'&&!Number.isFinite(value)))throw Error('ZEN_PLUME_LIVE_NONFINITE_COMMAND');
    add(op,args);
    if(op==='save')stack.push({state:{...state},matrix:[...matrix]});
    else if(op==='restore'){const saved=stack.pop();if(!saved)throw Error('ZEN_PLUME_LIVE_UNBALANCED_RESTORE');state=saved.state;matrix=saved.matrix;}
    else if(op==='translate')matrix=multiply(matrix,[1,0,0,1,...args]);
    else if(op==='rotate'){const c=Math.cos(args[0]),s=Math.sin(args[0]);matrix=multiply(matrix,[c,s,-s,c,0,0]);}
    else if(op==='scale')matrix=multiply(matrix,[args[0],0,0,args[1],0,0]);
    else if(op==='transform')matrix=multiply(matrix,args);
    else if(op==='setTransform')matrix=[...args];
    else if(op==='resetTransform')matrix=[...IDENTITY];
    else if(op==='beginPath'){pathMinX=Infinity;pathMinY=Infinity;pathMaxX=-Infinity;pathMaxY=-Infinity;pathSize=0;maxStroke=0;}
    else if(op==='moveTo'||op==='lineTo')pathPoint(args[0],args[1]);
    else if(op==='bezierCurveTo'||op==='quadraticCurveTo')for(let i=0;i<args.length;i+=2)pathPoint(args[i],args[i+1]);
    else if(op==='arc'){const [x,y,r]=args;for(const dx of[-r,r])for(const dy of[-r,r])pathPoint(x+dx,y+dy);}
    else if(op==='ellipse'){
      const [x,y,rx,ry,angle]=args,c=Math.cos(angle),s=Math.sin(angle);
      for(const dx of[-rx,rx])for(const dy of[-ry,ry])pathPoint(x+dx*c-dy*s,y+dx*s+dy*c);
    }else if(op==='fill'||op==='stroke'){
      if(op==='stroke')maxStroke=Math.max(maxStroke,state.lineWidth*Math.max(Math.hypot(matrix[0],matrix[1]),Math.hypot(matrix[2],matrix[3]))*.5);
      extendPath(maxStroke+2);
    }else if(op==='fillRect'||op==='strokeRect'||op==='clearRect'){
      if(!current)throw Error('ZEN_PLUME_LIVE_COMMAND_WITHOUT_RUN');
      const [x,y,w,h]=args,margin=op==='strokeRect'?state.lineWidth*.5+2:0;
      extendPoint(x,y,margin);extendPoint(x+w,y,margin);extendPoint(x,y+h,margin);extendPoint(x+w,y+h,margin);
    }
  };
  for(const type of['Linear','Radial'])methods[`create${type}Gradient`]=(...args)=>{
    if(!args.every(Number.isFinite))throw Error('ZEN_PLUME_LIVE_GRADIENT_INPUT');
    const definition={id:gradients.length,type:type.toLowerCase(),args,transform:[...matrix],stops:[]};gradients.push(definition);
    return {gradient:definition.id,addColorStop(offset,color){if(!Number.isFinite(offset)||offset<0||offset>1||typeof color!=='string')throw Error('ZEN_PLUME_LIVE_GRADIENT_STOP');definition.stops.push([offset,color]);}};
  };
  const ctx=new Proxy({}, {
    get(_target,key){if(key in methods)return methods[key];if(PROPERTIES.includes(key))return state[key];throw Error(`ZEN_PLUME_LIVE_UNSUPPORTED_CANVAS_GET:${String(key)}`);},
    set(_target,key,value){
      if(!PROPERTIES.includes(key))throw Error(`ZEN_PLUME_LIVE_UNSUPPORTED_CANVAS_SET:${String(key)}`);
      const serial=value&&typeof value==='object'&&Number.isInteger(value.gradient)?{gradient:value.gradient}:value;
      if(typeof serial==='number'&&!Number.isFinite(serial))throw Error('ZEN_PLUME_LIVE_CANVAS_STATE');
      state[key]=serial;add('set',[key,serial]);return true;
    },
  });
  return {ctx,beginRun({id,kind,rigId,sourceId,depth=null}){
    if(current||stack.length)throw Error('ZEN_PLUME_LIVE_RUN_BOUNDARY');
    current={id,kind,rigId,sourceId,depth,start:commands.length,end:null,state:{...state},transform:[...matrix],bounds:{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity}};
  },endRun(){
    if(!current||stack.length)throw Error('ZEN_PLUME_LIVE_RUN_BALANCE');
    current.end=commands.length;
    if(Number.isFinite(current.bounds.minX)){
      const b=current.bounds;current.bounds={x:Math.max(0,Math.floor(b.minX)),y:Math.max(0,Math.floor(b.minY)),right:Math.min(width,Math.ceil(b.maxX)),bottom:Math.min(height,Math.ceil(b.maxY))};
      current.bounds.width=current.bounds.right-current.bounds.x;current.bounds.height=current.bounds.bottom-current.bounds.y;
      if(current.bounds.width>0&&current.bounds.height>0)runs.push(current);
    }
    current=null;
  },finish(){if(current||stack.length)throw Error('ZEN_PLUME_LIVE_UNFINISHED_PLAN');return {commands,runs,gradients};}};
}

function validate(plan){
  if(plan?.schema!==ZEN_CHERRY_PLUME_LIVE_COMMAND_SCHEMA||!Number.isInteger(plan.width)||!Number.isInteger(plan.height)||!Array.isArray(plan.commands)||!Array.isArray(plan.gradients)||!Array.isArray(plan.runs)||!Array.isArray(plan.flowerSprites)||!Array.isArray(plan.displayOrder)||!['shared','procedural'].includes(plan.flowerStyle))throw Error('ZEN_PLUME_LIVE_COMMAND_PLAN');
}

// baseMatrix lets an atlas replay a cropped run at an integer offset while
// retaining the exact global gradient coordinates and Canvas state transitions.
function execute(ctx,plan,{start=0,end=plan.commands.length,state=null,transform=IDENTITY,baseMatrix=IDENTITY}={}){
  const gradientCache=new Map();
  const resolve=value=>{
    if(!value||typeof value!=='object')return value;
    if(!Number.isInteger(value.gradient)||!plan.gradients[value.gradient])throw Error('ZEN_PLUME_LIVE_GRADIENT_REFERENCE');
    if(!gradientCache.has(value.gradient)){
      const definition=plan.gradients[value.gradient];ctx.save();ctx.setTransform(...multiply(baseMatrix,definition.transform));
      const gradient=definition.type==='linear'?ctx.createLinearGradient(...definition.args):definition.type==='radial'?ctx.createRadialGradient(...definition.args):null;
      if(!gradient)throw Error('ZEN_PLUME_LIVE_GRADIENT_KIND');
      for(const stop of definition.stops)gradient.addColorStop(...stop);ctx.restore();gradientCache.set(value.gradient,gradient);
    }
    return gradientCache.get(value.gradient);
  };
  ctx.save();ctx.setTransform(...multiply(baseMatrix,transform));
  if(state)for(const key of PROPERTIES)ctx[key]=resolve(state[key]);
  for(let index=start;index<end;index++){
    const command=plan.commands[index],op=command[0];
    if(op==='set'){if(!PROPERTIES.includes(command[1]))throw Error('ZEN_PLUME_LIVE_PROPERTY');ctx[command[1]]=resolve(command[2]);}
    else if(op==='setTransform')ctx.setTransform(...multiply(baseMatrix,command.slice(1)));
    else if(op==='resetTransform')ctx.setTransform(...baseMatrix);
    else {
      if(!METHODS.has(op))throw Error(`ZEN_PLUME_LIVE_OPCODE:${op}`);
      // Keep the exact argument count while avoiding a temporary tail array for
      // every common Canvas command. Extra arguments retain Canvas semantics.
      switch(command.length){
        case 1:ctx[op]();break;
        case 2:ctx[op](command[1]);break;
        case 3:ctx[op](command[1],command[2]);break;
        case 4:ctx[op](command[1],command[2],command[3]);break;
        case 5:ctx[op](command[1],command[2],command[3],command[4]);break;
        case 6:ctx[op](command[1],command[2],command[3],command[4],command[5]);break;
        case 7:ctx[op](command[1],command[2],command[3],command[4],command[5],command[6]);break;
        case 8:ctx[op](command[1],command[2],command[3],command[4],command[5],command[6],command[7]);break;
        case 9:ctx[op](command[1],command[2],command[3],command[4],command[5],command[6],command[7],command[8]);break;
        default:ctx[op](...command.slice(1));
      }
    }
  }
  ctx.restore();
}

export function replayZenCherryPlumeLive(ctx,plan,{flowerAtlas=null,rigTransforms=null,offsetX=0,offsetY=0,woodColorMap=null,bloomPresentationProgress=null,bloomInvitation=null}={}){
  validate(plan);
  requireZenBonsaiPlumeBloomPresentationProgress(bloomPresentationProgress);requireZenBonsaiPlumeBloomInvitation(bloomInvitation);
  if(bloomPresentationProgress!==null&&!compileZenBonsaiPlumeBloomRegions(plan).eligible)throw Error('ZEN_PLUME_BLOOM_REGIONS_INELIGIBLE');
  const bloomPresentation=bloomPresentationProgress!==null?compileZenBonsaiPlumeBloomPresentation(plan):null,bloomPose=bloomPresentation?{}:null;
  if(!Number.isFinite(offsetX)||!Number.isFinite(offsetY))throw Error('ZEN_PLUME_PRODUCT_REPLAY_OFFSET');
  if(woodColorMap!==null&&typeof woodColorMap!=='function')throw Error('ZEN_PLUME_PRODUCT_REPLAY_MATERIAL');
  const materialContext=woodColorMap?createZenBotanicalMaterialContext(ctx,woodColorMap):ctx;
  const baseFor=rigId=>{const rig=rigTransforms?rigTransforms.get(rigId):IDENTITY;if(!rig)throw Error('ZEN_PLUME_PRODUCT_REPLAY_RIG');return multiply([1,0,0,1,offsetX,offsetY],rig);};
  if(plan.flowerSprites.length||rigTransforms||offsetX||offsetY||woodColorMap){
    if(plan.flowerSprites.length&&(plan.flowerStyle!=='shared'||plan.flowerMaterial?.schema!==ZEN_PLUME_FLOWER_ATLAS.schema||flowerAtlas?.width!==ZEN_PLUME_FLOWER_ATLAS.width||flowerAtlas?.height!==ZEN_PLUME_FLOWER_ATLAS.height))throw Error('ZEN_PLUME_LIVE_FLOWER_ATLAS_REQUIRED');
    ctx.save();ctx.setTransform(...IDENTITY);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    try{for(const item of plan.displayOrder){
      if(item.kind==='run'){
        const run=plan.runs[item.index];if(!run)throw Error('ZEN_PLUME_LIVE_DISPLAY_RUN');
        execute(run.rigId==='static'?ctx:materialContext,plan,{start:run.start,end:run.end,state:run.state,transform:run.transform,baseMatrix:baseFor(run.rigId)});
      }else if(item.kind==='flower'){
        const flower=plan.flowerSprites[item.index];if(!flower)throw Error('ZEN_PLUME_LIVE_DISPLAY_FLOWER');
        const entry=bloomPresentation?bloomPresentation[item.index]:null,progress=entry?bloomPresentationProgress[entry.regionIndex]:null;
        ctx.save();try{ctx.setTransform(...baseFor(flower.rigId));replayZenCherryPlumeFlower(ctx,flowerAtlas,flower,entry&&progress<1?resolveZenBonsaiPlumeBloomPose(entry,progress,bloomPose,bloomInvitation):null);}finally{ctx.restore();}
      }else throw Error('ZEN_PLUME_LIVE_DISPLAY_KIND');
    }}finally{ctx.restore();}
  }else execute(ctx,plan);
  return {runs:plan.runs.length,commands:plan.commands.length,flowerSprites:plan.flowerSprites.length};
}

export function replayZenCherryPlumeLiveRun(ctx,plan,run,{offsetX=0,offsetY=0}={}){
  validate(plan);if(!Number.isInteger(run.start)||!Number.isInteger(run.end)||run.start<0||run.end>plan.commands.length)throw Error('ZEN_PLUME_LIVE_RUN_RANGE');
  execute(ctx,plan,{start:run.start,end:run.end,state:run.state,transform:run.transform,baseMatrix:[1,0,0,1,offsetX,offsetY]});
}
