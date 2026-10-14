// The selected frozen Plume painter's numerical paint functions are retained here.
// Semantic layers now carry explicit support IDs before serializable emission.
import {projectZenCherry,requireZenCherryCamera,ZEN_PLUME_RENDER_PROJECTION} from '../annual/render.js';
import {createZenCherryPlumeLiveRecorder,ZEN_CHERRY_PLUME_LIVE_COMMAND_SCHEMA} from './canvas-executor.js';
import {createZenCherryPlumeWoodSurface} from './wood-surface.js';
import {ZEN_PLUME_FLOWER_ATLAS,ZEN_PLUME_FLOWER_BODY_EXPOSURE,createZenCherryPlumeFlowerInstance} from './flower-material.js';
import {ZEN_PLUME_FLOWER_DEVELOPMENT,poseZenCherryPlumeDevelopingFlower} from './flower-development.js';
import {ZEN_PLUME_CROWN_APPEARANCE,selectZenBonsaiPlumeCrownFlowers} from '../ZenBonsaiPlumeCrownAppearance.js';
import {resolveZenBonsaiPlumeFlowerDepth} from '../ZenBonsaiPlumeFlowerDepth.js';
import {resolveZenBonsaiPlumeCrownExposure} from '../ZenBonsaiPlumeCrownLight.js';
import {ZEN_PLUME_PRE_BLOOM} from '../ZenBonsaiPlumeInitialForm.js';
import {ZEN_PLUME_PRODUCT_BLOOM_TRANSITION} from '../ZenBonsaiPlumeBloomTransition.js';
import {requireZenBonsaiPlumeBranchEstablishment} from '../ZenBonsaiPlumeBranchEstablishment.js';
const TAU=Math.PI*2,LIGHT=[-.36,.8,.48],FRAME_FIELDS=['normal','u','v'];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit=value=>Number.isFinite(value)&&value>=0&&value<=1;
function requireUnit(value,label){if(!unit(value))throw Error(`ZEN_PLUME_LIVE_${label}`);return value;}
function visibilityMap(snapshot,kind){
  if(!snapshot.live)return new Map();
  if(!Array.isArray(snapshot.live.visibility[kind]))throw Error(`ZEN_PLUME_LIVE_VISIBILITY:${kind}`);
  const result=new Map();
  for(const item of snapshot.live.visibility[kind])result.set(item.id,requireUnit(item.alpha,'ALPHA'));
  return result;
}
function organAlpha(map,id){return map.has(id)?map.get(id):1;}
function sample(key, salt) {
  let n = 2166136261;
  for (const c of `${key}:${salt}`) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

function point(p) {
  if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) throw Error('ZEN_CHERRY_BLOOM_RENDER_POINT');
  return p;
}

function detailRamp(size, low, high) {
  const t = Math.max(0,Math.min(1,(size-low)/(high-low)));
  return t*t*(3-2*t);
}

function woodColor(color,saturation){
  if(saturation===1)return color;
  const channels=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)),luma=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  return '#'+channels.map(value=>Math.round(luma+(value-luma)*saturation).toString(16).padStart(2,'0')).join('')+color.slice(7);
}

function drawSegment(ctx,segment,a,b,camera,cycle,saturation=1) {
  const width=segment.radius*camera.scale*2;
  if (!(width>0)) throw Error('ZEN_CHERRY_BLOOM_RENDER_RADIUS');
  const young=segment.birthCycle===cycle;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=width;
  ctx.strokeStyle=woodColor(young?'#7d8162':'#635c4d',saturation);
  ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
  ctx.lineWidth=width*.35;ctx.strokeStyle=woodColor(young?'#b8b99477':'#b7a58a88',saturation);
  ctx.beginPath();ctx.moveTo(a[0]-width*.15*camera.horizontalSign,a[1]);ctx.lineTo(b[0]-width*.12*camera.horizontalSign,b[1]);ctx.stroke();
  if (!young&&width>3) {
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    if (length>.01) {
      const nx=-dy/length*camera.horizontalSign,ny=dx/length*camera.horizontalSign;
      ctx.strokeStyle=woodColor('#d5c4a552',saturation);ctx.lineWidth=Math.max(.55,width*.045);
      for (let i=0;i<3;i++) {
        const t=.2+i*.26+sample(segment.id,i)*.08;
        const x=a[0]+dx*t,y=a[1]+dy*t;
        ctx.beginPath();ctx.moveTo(x-nx*width*.25,y-ny*width*.25);
        ctx.lineTo(x+nx*width*.15,y+ny*width*.15);ctx.stroke();
      }
    }
  }
}

function background(ctx,width,height) {
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#f6f4eb';ctx.fillRect(0,0,width,height);
  const wash=ctx.createRadialGradient(width*.5,height*.4,10,width*.5,height*.4,Math.max(width,height)*.7);
  wash.addColorStop(0,'#fffdf7');wash.addColorStop(1,'#e7e9dc');
  ctx.fillStyle=wash;ctx.fillRect(0,0,width,height);
}

function drawTray(ctx,snapshot,camera) {
  const root=snapshot.nodes.find(node=>node.id==='origin');
  const scaffold=snapshot.nodes.filter(node=>node.owner==='f4-scaffold');
  if (!root||!scaffold.length) throw Error('ZEN_CHERRY_BLOOM_RENDER_SCAFFOLD');
  const height=snapshot.live ? snapshot.live.tray.height : Math.max(...scaffold.map(node=>node.p[1]))-Math.min(...scaffold.map(node=>node.p[1]));
  const [x,y]=projectZenCherry(root.p,camera),w=height*.36*camera.scale,h=w*.16;
  ctx.save();ctx.fillStyle='#555d4420';ctx.beginPath();ctx.ellipse(x,y+h*1.43,w*.69,h*.40,0,0,TAU);ctx.fill();
  const glaze=ctx.createLinearGradient(x,y,x,y+h);
  glaze.addColorStop(0,'#718274');glaze.addColorStop(.4,'#52685f');glaze.addColorStop(1,'#364b43');
  ctx.fillStyle=glaze;ctx.strokeStyle='#31483a';ctx.lineWidth=Math.max(.7,w*.005);
  ctx.beginPath();ctx.moveTo(x-w*.52,y+h*.15);ctx.lineTo(x+w*.52,y+h*.15);
  ctx.lineTo(x+w*.43,y+h*1.13);ctx.quadraticCurveTo(x,y+h*1.35,x-w*.43,y+h*1.13);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#294139';for (const side of [-1,1]) ctx.fillRect(x+side*w*.32-w*.035,y+h*1.1,w*.07,h*.22);
  ctx.fillStyle='#a4ad8b';ctx.strokeStyle='#7f9480';
  ctx.beginPath();ctx.ellipse(x,y+h*.13,w*.53,h*.26,0,0,TAU);ctx.fill();ctx.stroke();
  ctx.fillStyle='#5f6647';ctx.beginPath();ctx.ellipse(x,y+h*.1,w*.47,h*.18,0,0,TAU);ctx.fill();ctx.restore();
}

function flowerPoint(flower,x,y,z=0) {
  const r=flower.radius;
  return flower.position.map((p,i)=>p+r*(flower.u[i]*x+flower.v[i]*y+flower.normal[i]*z));
}

function rgb(values) {return `rgb(${values.map(value=>Math.round(Math.max(0,Math.min(255,value)))).join(',')})`;}

function petalLayer(flower,index,camera,pixelRatio) {
  const a=index*TAU/5,c=Math.cos(a),s=Math.sin(a),opening=flower.opening;
  const projected=(x,y)=>{
    const radial=Math.hypot(x,y),cup=flower.cup*radial*radial;
    return projectZenCherry(flowerPoint(flower,(x*c-y*s)*opening,(x*s+y*c)*opening,cup),camera);
  };
  const origin=projected(0,0),tip=projected(0,-1);
  const controls=[[-.48,-.21],[-.5,-.88],[-.1,-1],[0,-.87],[.1,-1],[.5,-.88],[.48,-.21]].map(([x,y])=>projected(x,y));
  const brightness=.88+.12*Math.max(0,dot(flower.normal,LIGHT));
  const blush=sample(flower.clusterId,'blush')*8;
  const size=flower.radius*camera.scale,outline=detailRamp(size/pixelRatio,2.5,6);
  return {kind:'petal',id:`${flower.id}/petal/${index}`,depth:(origin[2]+tip[2]*2)/3,draw(ctx){
    const shade=ctx.createLinearGradient(origin[0],origin[1],tip[0],tip[1]);
    shade.addColorStop(0,rgb([226,151-blush,174].map(v=>v*brightness)));
    shade.addColorStop(.46,rgb([246,201-blush*.7,214].map(v=>v*brightness)));
    shade.addColorStop(1,rgb([255,244-blush*.3,241].map(v=>v*brightness)));
    ctx.save();ctx.fillStyle=shade;ctx.beginPath();ctx.moveTo(origin[0],origin[1]);
    ctx.bezierCurveTo(...controls[0].slice(0,2),...controls[1].slice(0,2),...controls[2].slice(0,2));
    ctx.lineTo(controls[3][0],controls[3][1]);ctx.lineTo(controls[4][0],controls[4][1]);
    ctx.bezierCurveTo(...controls[5].slice(0,2),...controls[6].slice(0,2),origin[0],origin[1]);ctx.fill();
    if (outline>0) {ctx.globalAlpha*=outline;ctx.lineWidth=size*.025;ctx.strokeStyle='#c27f9460';ctx.stroke();}
    ctx.restore();
  }};
}

function centerLayer(flower,camera,pixelRatio) {
  const size=flower.radius*camera.scale,visibility=detailRamp(size/pixelRatio,2,5);
  if (!visibility) return null;
  const center=projectZenCherry(flowerPoint(flower,0,0,.035),camera);
  return {kind:'center',id:`${flower.id}/center`,depth:center[2],draw(ctx){
    ctx.save();ctx.globalAlpha*=visibility;
    ctx.strokeStyle='#bb94716b';ctx.lineWidth=size*.025;
    for (let i=0;i<8;i++) {
      const a=i*TAU/8;
      const end=projectZenCherry(flowerPoint(flower,Math.cos(a)*.25,Math.sin(a)*.25,.10),camera);
      ctx.beginPath();ctx.moveTo(center[0],center[1]);ctx.lineTo(end[0],end[1]);ctx.stroke();
      ctx.fillStyle='#c9ae72';ctx.beginPath();ctx.arc(end[0],end[1],size*.028,0,TAU);ctx.fill();
    }
    ctx.fillStyle='#c8879b';ctx.beginPath();ctx.arc(center[0],center[1],size*.055,0,TAU);ctx.fill();ctx.restore();
  }};
}

function livingTipLayer(tip,camera,pixelRatio) {
  point(tip.p);point(tip.direction);
  if (!(tip.radius>0)) throw Error('ZEN_CHERRY_BLOOM_TIP_RADIUS');
  const a=projectZenCherry(tip.p,camera);
  const b=projectZenCherry(tip.p.map((p,i)=>p+tip.direction[i]*tip.radius*3.4),camera);
  const size=tip.radius*camera.scale,visibility=detailRamp(size/pixelRatio,.10,.55);
  return {kind:'tip',id:tip.id,depth:(a[2]+b[2])/2,draw(ctx){
    if (!visibility) return;
    const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
    ctx.save();ctx.globalAlpha*=visibility;ctx.translate(a[0],a[1]);ctx.rotate(angle);
    ctx.fillStyle=tip.progress<.25?'#956d60':'#8f9c68';ctx.beginPath();
    ctx.moveTo(0,0);ctx.quadraticCurveTo(size*1.3,-size*.95,size*3.4,0);
    ctx.quadraticCurveTo(size*1.3,size*.95,0,0);ctx.fill();ctx.restore();
  }};
}

// All dimensions use the context's coordinate system. For a backing-pixel camera
// pass its backing/CSS ratio so detail thresholds remain CSS-sized. If the caller
// scales the context and uses a logical-pixel camera, pixelRatio remains 1.

function orderedRuns(runs) {
  const tree=runs.filter(run=>run.kind!=='background'&&run.kind!=='tray');
  const backgroundRuns=runs.filter(run=>run.kind==='background'),trayRuns=runs.filter(run=>run.kind==='tray');
  const make=count=>{
    const merged=backgroundRuns.map(run=>({...run,layerCount:1}));
    const chunk=Math.max(1,Math.ceil(tree.length/count));
    for(let index=0;index<tree.length;index+=chunk){
      const end=Math.min(tree.length,index+chunk),first=tree[index],last=tree[end-1],bounds={...first.bounds};
      for(let itemIndex=index;itemIndex<end;itemIndex++){const item=tree[itemIndex];bounds.x=Math.min(bounds.x,item.bounds.x);bounds.y=Math.min(bounds.y,item.bounds.y);bounds.right=Math.max(bounds.right,item.bounds.right);bounds.bottom=Math.max(bounds.bottom,item.bounds.bottom);}
      bounds.width=bounds.right-bounds.x;bounds.height=bounds.bottom-bounds.y;
      merged.push({...first,id:'depth-slice:'+index,kind:'depth-slice',rigId:'scaffold',sourceId:null,end:last.end,lastDepth:last.depth,bounds,layerCount:end-index});
    }
    merged.push(...trayRuns.map(run=>({...run,layerCount:1})));return merged;
  };
  // Conservative packing headroom: at most half the atlas pixel budget is
  // occupied by crop rectangles. Only consecutive commands are combined.
  let count=32,result=make(count);
  while(count>4&&result.reduce((sum,run)=>sum+(run.bounds.width+4)*(run.bounds.height+4),0)>8*1024*1024){count/=2;result=make(count);}
  return result;
}

// Width/height/camera are backing-pixel coordinates; pixelRatio controls only
// perceptual detail thresholds. Rigs use the same coordinate system.
export function createZenCherryPlumeLiveCommandPlan(snapshot,{width,height,camera,view='flowers',pixelRatio=1,woodStyle='continuous',flowerStyle='shared',includeBackground=true,includePot=true}={}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!camera||camera.width!==width||camera.height!==height||!(pixelRatio>0)||!Number.isFinite(pixelRatio)||!['flowers','wood','buds','scaffold'].includes(view)||!['reference','continuous'].includes(woodStyle)||!['shared','procedural'].includes(flowerStyle)||typeof includeBackground!=='boolean'||typeof includePot!=='boolean')throw Error('ZEN_PLUME_LIVE_PLAN_INPUT');
  requireZenCherryCamera(camera);
  const nodes=new Map(snapshot.nodes.map(node=>[node.id,node]));
  const projectedNodes=new Map();
  const projectNode=node=>{
    if(!projectedNodes.has(node.id))projectedNodes.set(node.id,projectZenCherry(node.p,camera));
    return projectedNodes.get(node.id);
  };
  const root=nodes.get('origin');if(!root)throw Error('ZEN_PLUME_LIVE_PLAN_ROOT');
  const rootP=projectNode(root);
  const rigs=[{id:'static',parentId:null,pivot:[0,0],kind:'static'},{id:'scaffold',parentId:null,pivot:rootP.slice(0,2),kind:'scaffold'}];
  for(const attachment of snapshot.attachments){
    const node=nodes.get(attachment.nodeId);if(!node)continue;
    const pivot=projectNode(node).slice(0,2);
    rigs.push({id:attachment.familyId,parentId:'scaffold',pivot,kind:'family',supportNodeId:node.id});
  }
  const rigIds=new Set(rigs.map(rig=>rig.id));
  const rigFor=organ=>{
    const id=organ.familyId===null||organ.familyId===undefined?'scaffold':organ.familyId;
    if(!rigIds.has(id))throw Error('ZEN_PLUME_LIVE_UNKNOWN_SUPPORT_RIG:'+id);return id;
  };
  const presentation=snapshot.live?snapshot.live.presentation:{activation:1,flowerAlpha:1,flowerOpening:1,woodSaturation:1,windResponse:1};
  requireUnit(presentation.activation,'ACTIVATION');requireUnit(presentation.flowerAlpha,'FLOWER_ALPHA');requireUnit(presentation.flowerOpening,'FLOWER_OPENING');requireUnit(presentation.woodSaturation,'WOOD_SATURATION');
  const segmentAlpha=visibilityMap(snapshot,'segments'),flowerAlpha=visibilityMap(snapshot,'flowers');
  const flowerDevelopment=snapshot.live?.development?.flower;
  if(flowerDevelopment!==undefined&&(flowerDevelopment.contract!==ZEN_PLUME_FLOWER_DEVELOPMENT||!Array.isArray(flowerDevelopment.flowers)))throw Error('ZEN_PLUME_LIVE_FLOWER_DEVELOPMENT');
  // A direct frozen observation has no display-development receipt. This is
  // the explicit endpoint comparison arm, not recovery for an invalid receipt.
  const developingFlowers=flowerDevelopment===undefined?null:new Map(flowerDevelopment.flowers.map(item=>[item.id,item]));
  if(developingFlowers&&developingFlowers.size!==flowerDevelopment.flowers.length)throw Error('ZEN_PLUME_LIVE_FLOWER_DEVELOPMENT_IDS');
  const productLife=snapshot.live?.productLife;
  if(productLife)requireZenBonsaiPlumeBranchEstablishment(snapshot,productLife.branchEstablishment);
  if(productLife&&(productLife.bloomTransition?.contract!==ZEN_PLUME_PRODUCT_BLOOM_TRANSITION||!developingFlowers))throw Error('ZEN_PLUME_PRODUCT_BLOOM_TRANSITION');
  if(productLife){requireUnit(productLife.bloomTransition.progress,'PRODUCT_BLOOM_PROGRESS');requireUnit(productLife.bloomTransition.coverage,'PRODUCT_BLOOM_COVERAGE');}
  // No crown policy means the explicitly selected frozen research painter.
  if(camera.crown&&camera.crown.contract!==ZEN_PLUME_CROWN_APPEARANCE)throw Error('ZEN_PLUME_CROWN_CAMERA');
  const retainedFlowers=camera.crown?selectZenBonsaiPlumeCrownFlowers(snapshot.flowers):null;
  const flowerDepthOf=flower=>camera.crown?resolveZenBonsaiPlumeFlowerDepth(flower.position,camera,camera.crown.flowerDepth):1;
  // Every retained blossom shades the others at its rest point, visible yet or not.
  const crownExposure=retainedFlowers&&flowerStyle==='shared'&&view==='flowers'
    ?resolveZenBonsaiPlumeCrownExposure(snapshot.flowers.filter(flower=>retainedFlowers.has(flower.id)),camera,{radiusScale:camera.crown.flowerRadiusScale,depthOf:flowerDepthOf}):null;
  const woodSurface=woodStyle==='continuous'?createZenCherryPlumeWoodSurface(snapshot,nodes,camera,{pixelRatio,projectNode}):null;
  const layers=[],flowerSprites=[];
  for(const segment of snapshot.segments){
    if(view==='scaffold'&&segment.owner!=='f4-scaffold')continue;
    if(!nodes.has(segment.parentNodeId)||!nodes.has(segment.childNodeId))throw Error('ZEN_PLUME_LIVE_SEGMENT_SUPPORT');
    const rigId=rigFor(segment),alpha=organAlpha(segmentAlpha,segment.id),a=projectNode(nodes.get(segment.parentNodeId)),b=projectNode(nodes.get(segment.childNodeId));
    layers.push({kind:'wood',id:segment.id,sourceId:segment.id,rigId,alpha,depth:woodSurface?woodSurface.depth(segment):(a[2]+b[2])/2,draw:ctx=>woodSurface?woodSurface.draw(ctx,segment,snapshot.cycle,presentation.woodSaturation):drawSegment(ctx,segment,a,b,camera,snapshot.cycle,presentation.woodSaturation)});
  }
  if(view==='flowers'&&snapshot.live?.productLife){
    const cue=snapshot.live.productLife.preBloom;
    if(cue?.contract!==ZEN_PLUME_PRE_BLOOM||!Array.isArray(cue.buds))throw Error('ZEN_PLUME_PRODUCT_PRE_BLOOM');
    requireUnit(cue.alpha,'PRE_BLOOM_ALPHA');requireUnit(cue.readiness,'PRE_BLOOM_READINESS');
    const segments=new Map(snapshot.segments.map(segment=>[segment.id,segment]));
    for(const bud of cue.buds){
      const segment=segments.get(bud.segmentId),node=nodes.get(bud.nodeId);
      if(!segment||!node||segment.childNodeId!==node.id)throw Error('ZEN_PLUME_PRODUCT_PRE_BLOOM_SUPPORT');
      requireUnit(bud.alpha,'PRE_BLOOM_BUD_ALPHA');
      const center=projectNode(node),support=projectNode(nodes.get(segment.parentNodeId));
      const angle=Math.atan2(center[1]-support[1],center[0]-support[0])+Math.PI/2;
      const radius=pixelRatio*(segment.birthCycle>0?1.2+cue.readiness*organAlpha(segmentAlpha,segment.id):2.8+1.2*cue.readiness),alpha=cue.alpha*bud.alpha;
      layers.push({kind:'pre-bloom-bud',id:bud.id,sourceId:segment.id,rigId:rigFor(segment),alpha,depth:center[2],draw(ctx){
        ctx.save();ctx.translate(center[0],center[1]);ctx.rotate(angle);
        // A quiet green calyx and a folded pink body read as a closed blossom.
        ctx.fillStyle='#78816a';ctx.beginPath();ctx.ellipse(0,radius*.6,radius*.55,radius*.42,0,0,TAU);ctx.fill();
        ctx.fillStyle='#b96e85';ctx.beginPath();ctx.ellipse(0,-radius*.12,radius*.67,radius,0,0,TAU);ctx.fill();
        ctx.fillStyle='#e2a9b8';ctx.beginPath();ctx.ellipse(-radius*.2,-radius*.3,radius*.24,radius*.67,-.15,0,TAU);ctx.fill();
        ctx.restore();
      }});
    }
  }
  if(view==='flowers')for(const sourceFlower of snapshot.flowers){
    if(!nodes.has(sourceFlower.nodeId))throw Error('ZEN_PLUME_LIVE_FLOWER_SUPPORT');
    const development=developingFlowers?.get(sourceFlower.id);
    if(developingFlowers&&!development)throw Error('ZEN_PLUME_LIVE_FLOWER_DEVELOPMENT_MISSING');
    if(retainedFlowers&&!retainedFlowers.has(sourceFlower.id))continue;
    const rigId=rigFor(sourceFlower),organVisibility=organAlpha(flowerAlpha,sourceFlower.id);
    const petalBaseAlpha=organVisibility*presentation.flowerAlpha;
    // Closed product buds promise future flowers independently of bloom/activity;
    // only unfolded petals use canonical bloom and contribute to petal supply.
    const budAlpha=organVisibility*(productLife?1:presentation.flowerAlpha)*(development?development.budOpacity:0);
    const petalAlpha=petalBaseAlpha*(development?development.petalOpacity:1);
    if(petalAlpha===0&&budAlpha===0)continue;
    const alpha=Math.max(petalBaseAlpha,budAlpha);
    const developing=development?poseZenCherryPlumeDevelopingFlower(sourceFlower,development):sourceFlower;
    const radiusScale=camera.crown?camera.crown.flowerRadiusScale:1;
    const posed=radiusScale===1?developing:{...developing,radius:developing.radius*radiusScale};
    const effectiveOpening=posed.opening*presentation.flowerOpening;
    const flower=flowerStyle==='shared'?posed:{...posed,opening:effectiveOpening};
    for(const field of FRAME_FIELDS)point(flower[field]);
    if(!(flower.radius>0)||!unit(effectiveOpening)||!(flower.cup>=0)||!flower.pedicel)throw Error('ZEN_PLUME_LIVE_FLOWER_POSE');
    const start=point(flower.pedicel.start),end=point(flower.pedicel.end),size=flower.radius*camera.scale;
    if(development&&budAlpha>0&&development.swelling>0){
      const center=projectZenCherry(flower.position,camera),support=projectZenCherry(start,camera),radius=sourceFlower.radius*radiusScale*camera.scale*.29*development.swelling;
      const angle=Math.atan2(center[1]-support[1],center[0]-support[0])+Math.PI/2;
      layers.push({kind:'flower-bud',id:flower.id+'/developing-bud',sourceId:flower.id,rigId,alpha:budAlpha,depth:center[2],draw(ctx){
        ctx.save();ctx.fillStyle='#b87c91';ctx.beginPath();ctx.ellipse(center[0],center[1],radius*.65,radius,angle,0,TAU);ctx.fill();
        ctx.fillStyle='#e5b8c2';ctx.beginPath();ctx.ellipse(center[0]-radius*.12*camera.horizontalSign,center[1]-radius*.1,radius*.3,radius*.68,angle,0,TAU);ctx.fill();ctx.restore();
      }});
    }
    if(flowerStyle==='shared'){
      // The explicitly selected comparison painter has no crown policy. Product
      // depth reads the stable rest point, not bud emergence or current alpha.
      const normalizedDepth=flowerDepthOf(sourceFlower),exposure=crownExposure?crownExposure.get(sourceFlower.id):ZEN_PLUME_FLOWER_BODY_EXPOSURE;
      if(petalAlpha>0){
        const instance=createZenCherryPlumeFlowerInstance(posed,camera,{alpha:petalAlpha,opening:effectiveOpening,normalizedDepth,exposure});
        flowerSprites.push({...instance,rigId});
      }
      const visibility=detailRamp(size/pixelRatio,1,3)*.68;
      if(visibility>0){
        const a=projectZenCherry(start,camera),b=projectZenCherry(end,camera);
        layers.push({kind:'pedicel',id:flower.id+'/pedicel',sourceId:flower.id,rigId,alpha:alpha*visibility,depth:(a[2]+b[2])/2,draw(ctx){
          ctx.save();ctx.strokeStyle='#8a9171';ctx.lineWidth=camera.scale*.16;
          ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.restore();
        }});
      }
      continue;
    }
    for(let i=0;i<3;i++){
      const a=projectZenCherry(start.map((p,j)=>p+(end[j]-p)*i/3),camera),b=projectZenCherry(start.map((p,j)=>p+(end[j]-p)*(i+1)/3),camera);
      layers.push({kind:'pedicel',id:flower.id+'/pedicel/'+i,sourceId:flower.id,rigId,alpha,depth:(a[2]+b[2])/2,draw(ctx){
        ctx.save();ctx.globalAlpha*=detailRamp(size/pixelRatio,1,3)*.68;ctx.strokeStyle='#8a9171';ctx.lineWidth=camera.scale*.16;
        ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.restore();
      }});
    }
    const petalFlower=development&&development.foldWidth<1?{...flower,u:flower.u.map(value=>value*development.foldWidth)}:flower;
    for(let i=0;i<5;i++)layers.push({...petalLayer(petalFlower,i,camera,pixelRatio),sourceId:flower.id,rigId,alpha:petalAlpha});
    const center=centerLayer(petalFlower,camera,pixelRatio);if(center)layers.push({...center,sourceId:flower.id,rigId,alpha:petalAlpha});
  }
  if(view==='flowers'){
    const incoming=productLife?new Map(snapshot.segments.map(segment=>[segment.childNodeId,segment.id])):null;
    for(const tip of snapshot.livingTips){
      let alpha=1;
      if(productLife&&productLife.branchEstablishment.fadingSegmentCount>0){
        if(!incoming.has(tip.nodeId))throw Error('ZEN_PLUME_PRODUCT_LIVING_TIP_SUPPORT');
        alpha=tip.progress===0?0:organAlpha(segmentAlpha,incoming.get(tip.nodeId));
      }
      if(alpha>0)layers.push({...livingTipLayer(tip,camera,pixelRatio),sourceId:tip.id,rigId:rigFor(tip),alpha});
    }
  }
  layers.sort((a,b)=>a.depth-b.depth||a.id.localeCompare(b.id));
  const recorder=createZenCherryPlumeLiveRecorder(width,height),ctx=recorder.ctx;
  const record=(meta,draw)=>{recorder.beginRun(meta);draw(ctx);recorder.endRun();};
  if(includeBackground)record({id:'background',kind:'background',rigId:'static',sourceId:'background'},ctx=>background(ctx,width,height));
  for(const layer of layers){
    record(layer,ctx=>{if(layer.alpha!==1){ctx.save();ctx.globalAlpha*=layer.alpha;}layer.draw(ctx);if(layer.alpha!==1)ctx.restore();});
  }
  if(view==='buds'){
    const budAlpha=visibilityMap(snapshot,'buds');
    for(const bud of snapshot.buds){
      const node=nodes.get(bud.nodeId);if(!node)throw Error('ZEN_PLUME_LIVE_BUD_SUPPORT');
      if(!['alive','spent','removed'].includes(bud.viability))throw Error('ZEN_PLUME_LIVE_BUD_VIABILITY');
      const p=projectNode(node),radius=Math.max(2.6,camera.scale*(bud.identity==='floral'?1.05:.8));
      record({id:bud.id,kind:'bud',sourceId:bud.id,rigId:rigFor(bud),depth:null},ctx=>{
        ctx.save();ctx.globalAlpha*=organAlpha(budAlpha,bud.id);
        const alive=bud.viability==='alive',pinched=bud.viability==='removed';
        ctx.fillStyle=!alive?'#c4b8a5':bud.identity==='floral'?'#cc8796':'#66876b';ctx.strokeStyle='#fffdf6';ctx.lineWidth=1;
        ctx.beginPath();ctx.ellipse(p[0],p[1],radius*.72,radius,sample(bud.id,'bud-angle')*Math.PI*camera.horizontalSign,0,TAU);ctx.fill();ctx.stroke();
        if(pinched){ctx.strokeStyle='#b26d49';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(p[0]-4,p[1]-4);ctx.lineTo(p[0]+4,p[1]+4);ctx.moveTo(p[0]+4,p[1]-4);ctx.lineTo(p[0]-4,p[1]+4);ctx.stroke();}
        ctx.restore();
      });
    }
  }
  if(includePot)record({id:'tray',kind:'tray',rigId:'static',sourceId:'tray'},ctx=>{
    // Diagnostic views pass through annual's save/restore before canopy draws
    // the tray. Flower view keeps bloom's round wood stroke state instead.
    if(view!=='flowers'){ctx.lineCap='butt';ctx.lineJoin='miter';}
    drawTray(ctx,snapshot,camera);
  });
  const captured=recorder.finish(),runs=orderedRuns(captured.runs);
  flowerSprites.sort((a,b)=>a.depth-b.depth||a.id.localeCompare(b.id));
  // Whole blossoms share tiles. Their centers retain depth order; wood is
  // composited in the existing bounded depth slices, not individual petal order.
  const displayOrder=[];let flowerIndex=0;
  for(let index=0;index<runs.length;index++){
    const run=runs[index];
    if(run.kind==='tray')while(flowerIndex<flowerSprites.length)displayOrder.push({kind:'flower',index:flowerIndex++});
    if(run.kind==='depth-slice')while(flowerIndex<flowerSprites.length&&flowerSprites[flowerIndex].depth<run.depth)displayOrder.push({kind:'flower',index:flowerIndex++});
    displayOrder.push({kind:'run',index});
    if(run.kind==='depth-slice')while(flowerIndex<flowerSprites.length&&flowerSprites[flowerIndex].depth<=run.lastDepth)displayOrder.push({kind:'flower',index:flowerIndex++});
  }
  while(flowerIndex<flowerSprites.length)displayOrder.push({kind:'flower',index:flowerIndex++});
  return {schema:ZEN_CHERRY_PLUME_LIVE_COMMAND_SCHEMA,projection:ZEN_PLUME_RENDER_PROJECTION,width,height,pixelRatio,camera:structuredClone(camera),view,woodStyle,flowerStyle,
    flowerSprites,flowerMaterial:flowerStyle==='shared'?ZEN_PLUME_FLOWER_ATLAS:null,displayOrder,
    crownAppearance:camera.crown?{...camera.crown,sourceFlowerCount:snapshot.flowers.length,retainedFlowerCount:retainedFlowers.size}:null,
    commands:captured.commands,gradients:captured.gradients,runs,rigs,presentation:{...presentation},
    supports:[...captured.runs.map(({id,kind,rigId,sourceId,depth,start,end})=>({id,kind,rigId,sourceId,depth,start,end})),...flowerSprites.map(({id,rigId,sourceId,depth})=>({id,kind:'flower',rigId,sourceId,depth,start:null,end:null}))],
    metadata:{snapshotId:snapshot.id,layerCount:layers.length+flowerSprites.length,drawRuns:runs.length,orderPolicy:flowerStyle==='shared'?'whole-flower-centers-interleaved-with-contiguous-wood-slices':'exact-depth-stream-contiguous-slices',motionPolicy:'whole-tree-scaffold-pivot',independentFamilyMotion:false,sourcePainter:woodStyle==='continuous'?'cherry-plume-live-continuous-wood-v1':'frozen-cherry-bloom-living-v1',flowerPainter:flowerStyle==='shared'?ZEN_PLUME_FLOWER_ATLAS.schema:'frozen-cherry-bloom-living-v1',woodSurface:woodSurface?woodSurface.receipt:{style:'reference',supportedSegmentCount:snapshot.segments.length,radiiPolicy:'frozen-scalar-radius-round-strokes',texturePolicy:'frozen-three-marks-per-mature-segment'},scope:'product-plume-presentation'}};
}
