import {projectZenCherry,requireZenCherryCamera} from '../annual/render.js';
import {resolveZenBonsaiPlumeScaffoldRadius,ZEN_PLUME_SCAFFOLD_RADIUS_GAIN} from '../ZenBonsaiPlumeCrownAppearance.js';

const TAU=Math.PI*2;
const clamp=value=>Math.max(0,Math.min(1,value));
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
const add=(a,b)=>a.map((value,index)=>value+b[index]);
const multiply=(a,factor)=>a.map(value=>value*factor);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=value=>multiply(value,1/Math.hypot(...value));
function axisSampler(key){
  // Keep the original for-of/charCodeAt semantics, including astral characters.
  // Only the invariant prefix is shared; salt order and hash arithmetic remain.
  let prefix=2166136261;for(const c of `${key}:`)prefix=Math.imul(prefix^c.charCodeAt(0),16777619);
  const draws=new Map();
  return salt=>{
    if(draws.has(salt))return draws.get(salt);
    let n=prefix;for(const c of `${salt}`)n=Math.imul(n^c.charCodeAt(0),16777619);
    n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
    const value=((n^(n>>>16))>>>0)/4294967296;draws.set(salt,value);return value;
  };
}
// F4's neutral ink values, adapted to the existing continuous Plume surface.
// Geometry adapts the G15.4 research presentation only as display: smoothed
// limb outlines, junction collars and a basal flare; no research roots or dropout.
const BARK=Object.freeze({body:'#4a463e',aged:'#484239',
  lenticel:'#292720',lip:'#aaa08c',fissure:'#211f1b',patina:'#7b7668',young:'#777265'});
// An ending axis continues into the best departing axis within 50 degrees whose
// start is at least half its girth.
const HANDOFF_ALIGNMENT=Math.cos(50*Math.PI/180),HANDOFF_RADIUS_RATIO=.5;
// The trunk widens toward the soil over 2.6 base radii, by at most 45%.
const BASAL_FLARE_GAIN=.45,BASAL_FLARE_HEIGHT=2.6;
// A restrained diffuse key matching the blossom atlas's upper-left light; no
// glossy crest. Like the blossom sprites, it reflects with the tree.
const WOOD_KEY_LIGHT=Object.freeze([-.57,-.82]),WOOD_KEY_VALUE=.045;
function materialColors(){
  const channels=new Map(),colors=new Map();
  const components=hex=>{
    if(!channels.has(hex))channels.set(hex,[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)));
    return channels.get(hex);
  };
  const color=(hex,saturation)=>{
    let variants=colors.get(hex);if(!variants){variants=new Map();colors.set(hex,variants);}
    if(variants.has(saturation))return variants.get(saturation);
    const values=components(hex),luma=dot(values,[.2126,.7152,.0722]);
    const result='#'+values.map(value=>Math.round(luma+(value-luma)*saturation).toString(16).padStart(2,'0')).join('')+hex.slice(7);
    variants.set(saturation,result);return result;
  };
  return{color,shiftedColor(base,amount,saturation){
    const hex='#'+components(base).map(value=>Math.round(Math.max(0,Math.min(255,value+amount*255))).toString(16).padStart(2,'0')).join('');
    return color(hex,saturation);
  },mixedColor(base,tint,amount,saturation){
    const values=components(base),targets=components(tint);
    const hex='#'+values.map((value,index)=>Math.round(value+(targets[index]-value)*amount).toString(16).padStart(2,'0')).join('');
    return color(hex,saturation);
  }};
}
function ramp(value,low,high){const t=clamp((value-low)/(high-low));return t*t*(3-2*t);}

function establishedBark(snapshot,segment){
  if(segment.birthCycle!==snapshot.cycle)return 1;
  if(!snapshot.live?.development)return 0;
  const clock=snapshot.live.clock;
  // Ease the previous year's twig material into established bark before the
  // year counter advances. A selected same-year endpoint retains its old paint.
  return clock.target.year>snapshot.cycle?ramp(clock.observedLocalTime,1.5,1.75):0;
}

function endpointRadii(segment){
  if(!(Number.isFinite(segment.radius)&&segment.radius>0))throw Error('ZEN_PLUME_WOOD_RADIUS');
  if(segment.owner==='f4-scaffold'||segment.owner==='cloud-grown'){
    if(!(segment.startRadius>0&&segment.endRadius>0&&Number.isFinite(segment.startRadius)&&Number.isFinite(segment.endRadius)))throw Error('ZEN_PLUME_WOOD_ENDPOINT_RADIUS');
    // Foundation presentation scales the scalar radius while retaining the
    // completed endpoint ratio. Honor that explicit girth pose here as well.
    const girth=segment.radius/((segment.startRadius+segment.endRadius)*.5);
    return [segment.startRadius*girth,segment.endRadius*girth];
  }
  if(segment.owner==='cherry-family')return[segment.radius,segment.radius];
  throw Error('ZEN_PLUME_WOOD_OWNER:'+segment.owner);
}

function offset(point,normal,radius,fraction){return[point[0]+normal[0]*radius*fraction,point[1]+normal[1]*radius*fraction];}
const perpendicular=direction=>[-direction[1],direction[0]];
const unit2=value=>{const length=Math.hypot(value[0],value[1]);return length>1e-9?[value[0]/length,value[1]/length]:null;};
// Display centerline: a cubic through the projected nodes whose end tangents
// are the shared seam tangents. Adjacent segments of one limb therefore meet
// with one tangent and one radius (a smooth outline) instead of a mitred
// polygon corner. Node positions, stored radii and depth order are unchanged.
function centerline(surface,t){
  if(surface.straight)return[surface.a[0]+(surface.b[0]-surface.a[0])*t,surface.a[1]+(surface.b[1]-surface.a[1])*t];
  const {a,b,c1,c2}=surface,s=1-t,w0=s*s*s,w1=3*s*s*t,w2=3*s*t*t,w3=t*t*t;
  return[w0*a[0]+w1*c1[0]+w2*c2[0]+w3*b[0],w0*a[1]+w1*c1[1]+w2*c2[1]+w3*b[1]];
}
function centerlineDirection(surface,t){
  if(surface.straight)return unit2([surface.t0[0]+(surface.t1[0]-surface.t0[0])*t,surface.t0[1]+(surface.t1[1]-surface.t0[1])*t])??surface.tangent;
  const {a,b,c1,c2}=surface,s=1-t;
  return unit2([3*s*s*(c1[0]-a[0])+6*s*t*(c2[0]-c1[0])+3*t*t*(b[0]-c2[0]),3*s*s*(c1[1]-a[1])+6*s*t*(c2[1]-c1[1])+3*t*t*(b[1]-c2[1])])??surface.tangent;
}
// Screen-space shift of the curved display centerline from the straight chord.
// World-stationed bark marks follow it so they stay on the painted limb.
function centerlineShift(surface,t){
  const point=centerline(surface,t);
  return[point[0]-(surface.a[0]+(surface.b[0]-surface.a[0])*t),point[1]-(surface.a[1]+(surface.b[1]-surface.a[1])*t)];
}
function tubeEdges(surface,overlap=0){
  const minus=[],plus=[];
  const push=(point,direction,radius)=>{const normal=perpendicular(direction);minus.push(offset(point,normal,radius,-1));plus.push(offset(point,normal,radius,1));};
  if(overlap&&surface.startOverlap)push(offset(surface.a,surface.t0,overlap*surface.startOverlap,-1),surface.t0,surface.radiusAt(0));
  for(let step=0;step<=surface.steps;step++){const t=step/surface.steps;push(centerline(surface,t),centerlineDirection(surface,t),surface.radiusAt(t));}
  if(overlap&&surface.endOverlap)push(offset(surface.b,surface.t1,overlap*surface.endOverlap,1),surface.t1,surface.radiusAt(1));
  return{minus,plus};
}
function tube(ctx,surface){
  const {a,b,startCap,endCap}=surface;
  // Adjacent Canvas polygons otherwise expose background along their shared
  // antialiased edge. Only already-shared ends receive a subpixel overlap.
  // Retirement alpha ramps it out continuously: below .98 the exact common
  // edge is used, avoiding a darker double-opacity band on fading juvenile wood.
  const opacity=ramp(ctx.globalAlpha,.98,1);
  const {minus,plus}=tubeEdges(surface,Math.min(.85,surface.projectedLength*.2)*opacity);
  ctx.beginPath();ctx.moveTo(...minus[0]);
  for(let index=1;index<minus.length;index++)ctx.lineTo(...minus[index]);
  for(let index=plus.length-1;index>=0;index--)ctx.lineTo(...plus[index]);
  ctx.closePath();
  // Opaque base and exposed caps share one fill, so partial visibility never
  // compounds alpha at the overlap. Full circular caps have the same limit as
  // an end-on tube; a shallow quadratic lens would visibly snap with yaw.
  const r0=surface.radiusAt(0),r1=surface.radiusAt(1);
  if(startCap>0){ctx.moveTo(a[0]+r0*startCap,a[1]);ctx.arc(a[0],a[1],r0*startCap,0,TAU);ctx.closePath();}
  if(endCap>0){ctx.moveTo(b[0]+r1*endCap,b[1]);ctx.arc(b[0],b[1],r1*endCap,0,TAU);ctx.closePath();}
  ctx.fill();
}
// A fold check for the curved strip: a thick limb on a tight bend would turn
// its inner edge back on itself (a hole under nonzero winding). Such segments
// keep straight strips with the shared seam normals.
function edgesFold(surface){
  const {minus,plus}=tubeEdges(surface);
  for(const edge of[minus,plus])for(let index=1;index<edge.length;index++){
    const direction=centerlineDirection(surface,(index-.5)/surface.steps);
    if((edge[index][0]-edge[index-1][0])*direction[0]+(edge[index][1]-edge[index-1][1])*direction[1]<=0)return true;
  }
  return false;
}
// The collar that closes one side of a lateral branch departure: a cubic
// fillet tangent to both silhouettes, cut back a span along each, after the
// G15.4 research wood presentation. It is painted beneath both tubes, so only
// the notch between their edges remains visible.
const COLLAR_MINIMUM_CROSS=.16,COLLAR_SPAN=1.45,COLLAR_FULLNESS=.55,COLLAR_STEPS=6;
const cross2=(a,b)=>a[0]*b[1]-a[1]*b[0];
function shoulderCorner(parentDirection,parentRadius,childDirection,childRadius,side){
  const denominator=cross2(parentDirection,childDirection);
  if(Math.abs(denominator)<COLLAR_MINIMUM_CROSS)return null;
  const parentNormal=multiply(perpendicular(parentDirection),side),childNormal=multiply(perpendicular(childDirection),side);
  const delta=[childNormal[0]*childRadius-parentNormal[0]*parentRadius,childNormal[1]*childRadius-parentNormal[1]*parentRadius];
  return{parentNormal,alongParent:cross2(delta,childDirection)/denominator,alongChild:cross2(delta,parentDirection)/denominator};
}
function junctionCollar(node,parent,continuation,child,side){
  const childDirection=child.t0,childRadius=child.radiusAt(0);
  let parentSurface=parent,parentDirection=parent.t1,parentRadius=parent.radiusAt(1);
  let solved=shoulderCorner(parentDirection,parentRadius,childDirection,childRadius,side);
  if(!solved)return null;
  // A corner past the joint belongs to the axis carrying on through it.
  if(solved.alongParent>0&&continuation&&!continuation.short){
    parentSurface=continuation;parentDirection=continuation.t0;parentRadius=continuation.radiusAt(0);
    solved=shoulderCorner(parentDirection,parentRadius,childDirection,childRadius,side);
    if(!solved)return null;
  }
  // Behind the branch's own start the two tubes overlap (a spike, not a
  // notch); ahead of a terminating parent there is only sky to blend into.
  if(!(solved.alongChild>0)||(solved.alongParent>0&&parentSurface===parent))return null;
  const parentRun=parentSurface===parent?parent.projectedLength+solved.alongParent:continuation.projectedLength-solved.alongParent;
  const span=Math.min(Math.min(parentRadius,childRadius)*COLLAR_SPAN,parentRun,child.projectedLength-solved.alongChild);
  if(!(span>.3))return null;
  const corner=add(add(node,multiply(solved.parentNormal,parentRadius)),multiply(parentDirection,solved.alongParent));
  const parentAnchor=add(corner,multiply(parentDirection,-span)),childAnchor=add(corner,multiply(childDirection,span));
  const first=add(parentAnchor,multiply(add(corner,multiply(parentAnchor,-1)),COLLAR_FULLNESS));
  const second=add(childAnchor,multiply(add(corner,multiply(childAnchor,-1)),COLLAR_FULLNESS));
  const fillet=Array.from({length:COLLAR_STEPS+1},(_,index)=>{
    const t=index/COLLAR_STEPS,s=1-t;
    return[0,1].map(axis=>s*s*s*parentAnchor[axis]+3*s*s*t*first[axis]+3*s*t*t*second[axis]+t*t*t*childAnchor[axis]);
  });
  // Close through both centerlines so the hidden interior overlaps the wood.
  const childInner=add(node,multiply(childDirection,solved.alongChild+span)),parentInner=add(node,multiply(parentDirection,solved.alongParent-span));
  return{parentSurface,points:[...fillet,childInner,node,parentInner],from:parentAnchor,to:childAnchor};
}

// Display-only tube strips share logical boundary vertices along an axis, with
// an explicit subpixel opaque-paint overlap that closes raster coverage cracks.
// The graph's centerline, stored radii, source IDs and segment depth order remain
// untouched. No whole-axis path is drawn over intervening petals.
export function createZenCherryPlumeWoodSurface(snapshot,nodes,camera,{pixelRatio=1,projectNode=node=>projectZenCherry(node.p,camera)}={}){
  requireZenCherryCamera(camera);
  const surfaces=new Map(),incoming=new Map(),outgoing=new Map();
  // All derived lookup state belongs to this plan only; no cache survives a
  // new observation, activation value, camera, resize, study or renderer.
  const samplers=new Map(),{color,mixedColor,shiftedColor}=materialColors();
  const receipt={style:'continuous',supportedSegmentCount:snapshot.segments.length,sharedSeamCount:0,radiusBlendSeamCount:0,
    maxRelativeRadiusBlend:0,projectedShortSegmentCount:0,lenticelCount:0,accentLenticelCount:0,clippedLenticelCount:0,weatheredLenticelCount:0,patinaCount:0,axisCount:0,developingSeamCount:0,
    handoffSeamCount:0,curvedSegmentCount:0,foldGuardSegmentCount:0,lateralJunctionCount:0,collarCount:0,flareSegmentCount:0,
    material:'f4-ink-grain-cherry-v2',palette:{...BARK},
    lightingPolicy:'opaque-ink-pooling-with-restrained-upper-left-key; segment-mean-logarithmic-girth-value; nine-limb-stable-bristle-bands; no-specular-ribbon',
    lenticelPolicy:'dark-crease-with-quiet-raised-lip; three-staggered-lanes-of-short-pores; fixed-world-stations; CSS-minimum-height-with-thin-wood-fade; front-half-plane-clipped',
    radiiPolicy:'supplied-endpoint-ratio-times-posed-scalar-girth; scalar-only-cherry-family; mean-display-radius-at-shared-axis-seam; trunk-basal-flare-45-percent-over-2.6-base-radii',
    texturePolicy:'axis-seeded-longitudinal-value-bands-in-single-opaque-fill; jittered-world-axis-distance-lenticels; restrained-patina-on-thick-established-axes',
    seamRevealPolicy:'smooth-world-child-length-over-parent-radius; projected-end-on-and-reversal-weight; parent-cap-retained-until-join-developed; aligned-axis-handoff-within-50-degrees-and-half-girth',
    outlinePolicy:'cubic-display-centerline-with-shared-seam-tangents; straight-strip-where-inner-edge-would-fold; bark-marks-follow-display-centerline',
    junctionPolicy:'lateral-axis-base-painted-behind-parent-until-clear; cubic-fillet-collar-under-both-tubes',
    antialiasPolicy:'shared-ends-overlap-max-0.85-backing-pixels-times-join-participation; smooth-opacity-0.98-to-1; single-opaque-gradient-base',
    depthPolicy:'individual-segment-interleaving; lateral-branch-base-just-behind-its-parent'};
  receipt.crownRadiusPolicy=camera.crown?`f4-only; smooth-13-to-45-percent-of-mature-stock; maximum-${Math.round((ZEN_PLUME_SCAFFOLD_RADIUS_GAIN-1)*100)}-percent-gain; annual-flowering-wood-unchanged`:'source-radii';
  for(const segment of snapshot.segments){
    if(surfaces.has(segment.id)||incoming.has(segment.childNodeId))throw Error('ZEN_PLUME_WOOD_TOPOLOGY');
    const parent=nodes.get(segment.parentNodeId),child=nodes.get(segment.childNodeId);
    if(!parent||!child)throw Error('ZEN_PLUME_WOOD_SUPPORT');
    const delta=child.p.map((value,index)=>value-parent.p[index]),length=Math.hypot(...delta);
    if(!(length>0&&Number.isFinite(length)))throw Error('ZEN_PLUME_WOOD_WORLD_LENGTH');
    const a=projectNode(parent),b=projectNode(child),dx=b[0]-a[0],dy=b[1]-a[1],projectedLength=Math.hypot(dx,dy);
    const short=projectedLength<.05*pixelRatio;
    // An axis pointing directly at the camera has no projected tangent. It is
    // represented by its circular end-on section rather than an unstable strip.
    const tangent=short?[0,-1]:[dx/projectedLength,dy/projectedLength],normal=[-tangent[1],tangent[0]];
    const sourceRadii=endpointRadii(segment);
    const radii=camera.crown&&segment.owner==='f4-scaffold'
      ?sourceRadii.map(radius=>resolveZenBonsaiPlumeScaffoldRadius(radius,camera.crown.scaffoldRadius)):sourceRadii;
    const surface={segment,a,b,parent,delta,length,projectedLength,short,tangent,t0:tangent,t1:tangent,n0:normal,n1:normal,
      r0:radii[0]*camera.scale,r1:radii[1]*camera.scale,startCap:1,endCap:1,startOverlap:0,endOverlap:0,previous:null,next:null,handoff:false,axisDistance:null,frame:null,material:null,marks:[],patina:[],
      flare:null,c1:a,c2:b,steps:1,straight:true,depth:(a[2]+b[2])/2,displayDepth:null,behind:null,collars:[],base:null,girth:undefined};
    surface.radiusAt=t=>(surface.r0+(surface.r1-surface.r0)*t)*(surface.flare?surface.flare(t):1);
    if(short)receipt.projectedShortSegmentCount++;
    surfaces.set(segment.id,surface);incoming.set(segment.childNodeId,surface);
    if(!outgoing.has(segment.parentNodeId))outgoing.set(segment.parentNodeId,[]);
    outgoing.get(segment.parentNodeId).push(surface);
  }
  const axes=new Set();
  for(const surface of surfaces.values()){
    const {segment}=surface;axes.add(segment.axisId);
    const departing=outgoing.get(segment.childNodeId)??[];
    const following=departing.filter(item=>item.segment.axisId===segment.axisId);
    // A true fork is a junction, not a fabricated single-axis continuation.
    if(following.length>1)continue;
    let next=following[0]??null;
    if(!next&&!surface.short){
      // An axis that ends exactly where a nearly aligned, comparably thick
      // axis begins reads as one limb. Joining them removes the pipe-joint
      // ring of two overlapping end caps and a tone step; the continuing axis
      // also inherits the limb's material and bark stations. Graph identity,
      // radii and growth are untouched.
      let best=null,bestScore=0;
      for(const item of departing){
        if(item.short||item.previous)continue;
        const alignment=dot(item.tangent,surface.tangent),ratio=item.r0/surface.r1;
        if(alignment<HANDOFF_ALIGNMENT||ratio<HANDOFF_RADIUS_RATIO)continue;
        const score=alignment*Math.min(1,ratio);
        if(score>bestScore){best=item;bestScore=score;}
      }
      if(best){next=best;next.handoff=true;receipt.handoffSeamCount++;}
    }
    if(!next)continue;
    surface.next=next;next.previous=surface;
    if(surface.short||next.short)continue;
    const total=add(surface.tangent,next.tangent),magnitude=Math.hypot(...total);
    // Near reversal has no finite shared tangent; the two rounded tube ends meet.
    if(magnitude<.35)continue;
    // Newborn segments have almost zero length/girth. Their appearance must
    // not instantly halve/rotate the established parent's endpoint. Join in
    // proportion to their actual extent; this applies to F4 and annual shoots.
    const development=ramp(next.length/(surface.r1/camera.scale),0,1.5);
    const projected=ramp(Math.min(surface.projectedLength,next.projectedLength)/pixelRatio,.05,1);
    const participation=development*projected*ramp(magnitude,.35,1);
    if(participation<1)receipt.developingSeamCount++;
    const sharedTangent=unit2(add(surface.tangent,multiply(next.tangent,participation)))??surface.tangent;
    const sharedRadius=surface.r1+((surface.r1+next.r0)*.5-surface.r1)*participation;
    const blend=Math.abs(surface.r1-next.r0)/Math.max(surface.r1,next.r0);
    receipt.sharedSeamCount++;if(blend>1e-9)receipt.radiusBlendSeamCount++;
    receipt.maxRelativeRadiusBlend=Math.max(receipt.maxRelativeRadiusBlend,blend);
    surface.r1=sharedRadius;next.r0=sharedRadius;surface.t1=sharedTangent;next.t0=sharedTangent;
    surface.n1=perpendicular(sharedTangent);next.n0=surface.n1;
    surface.endCap=1-participation;next.startCap=0;
    surface.endOverlap=participation;next.startOverlap=participation;
  }
  receipt.axisCount=axes.size;
  const visiting=new Set();
  function axisDistance(surface){
    if(surface.axisDistance!==null)return surface.axisDistance;
    if(visiting.has(surface))throw Error('ZEN_PLUME_WOOD_CYCLE');
    visiting.add(surface);
    surface.axisDistance=surface.previous?axisDistance(surface.previous)+surface.previous.length:0;
    visiting.delete(surface);return surface.axisDistance;
  }
  function axisFrame(surface){
    if(surface.frame)return surface.frame;
    const tangent=multiply(surface.delta,1/surface.length);
    let u;
    if(surface.previous){
      const previous=axisFrame(surface.previous);
      const projected=add(previous.u,multiply(tangent,-dot(previous.u,tangent)));
      // A ninety-degree turn can align the old normal with the new tangent.
      // The other transported axis is then the nonsingular mathematical basis.
      u=Math.hypot(...projected)>1e-8?normalize(projected):normalize(add(previous.v,multiply(tangent,-dot(previous.v,tangent))));
    }else{
      const reference=Math.abs(tangent[1])<.92?[0,1,0]:[1,0,0];
      u=normalize(cross(tangent,reference));
    }
    surface.frame={u,v:cross(tangent,u)};return surface.frame;
  }
  function axisMaterial(surface){
    if(surface.material)return surface.material;
    // Shared by a limb (an axis and the axes it hands off to): maturity and
    // bristle bands must not restart at every internode. Radius is an explicit
    // display proxy for established bark, not tree years.
    if(surface.previous){surface.material=axisMaterial(surface.previous);return surface.material;}
    const radius=endpointRadii(surface.segment)[0];
    surface.material={mature:ramp(radius,3,11),bands:null};
    return surface.material;
  }
  // Ink value follows the limb's girth, eased along it over a few radii: a limb
  // lightens as it tapers instead of carrying its root value into thin handed-
  // off wood, and a fork's girth step fades in rather than drawing a ring.
  function easedGirth(surface){
    if(surface.girth!==undefined)return surface.girth;
    const [start,end]=endpointRadii(surface.segment),local=(start+end)*.5;
    if(!surface.previous)return surface.girth=local;
    const previous=easedGirth(surface.previous);
    return surface.girth=previous+(local-previous)*(1-Math.exp(-surface.length/(2.5*Math.max(local,previous))));
  }
  function girthBase(surface){
    if(surface.base)return surface.base;
    const girthValue=.185-.265*clamp(Math.log1p(easedGirth(surface))/Math.log(15));
    surface.base=shiftedColor(mixedColor(BARK.body,BARK.aged,axisMaterial(surface).mature*.2,1),girthValue,1);
    return surface.base;
  }
  function bristleBands(surface){
    if(surface.material.bands)return surface.material.bands;
    // Allocate only for axes that are actually wide enough to paint a gradient.
    if(!samplers.has(surface.segment.axisId))samplers.set(surface.segment.axisId,axisSampler(surface.segment.axisId));
    const sample=samplers.get(surface.segment.axisId);
    // Boundaries and pigment stay identical along an axis. Encoding bristles
    // in its opaque gradient avoids extra strokes, alpha accumulation and the
    // repeating internode caps of the old REFERENCE painter. Soft shoulders
    // keep the lanes from becoming drawn longitudinal lines or a woven grid.
    surface.material.bands=Array.from({length:9},(_,index)=>({
      position:(index+.5)/9+(sample(`bristle-position:${index}`)-.5)*.024,
      grain:(sample(`bristle-value:${index}`)-.5)*.035,
    }));
    return surface.material.bands;
  }
  // Display geometry passes over the joined graph. They never write stored
  // radii, node positions, bark stations or depth back to the model.
  for(const surface of surfaces.values())axisDistance(surface);
  // The trunk widens smoothly toward the soil. The gain is continuous in axis
  // distance, so its shared seams keep one radius and one tangent.
  // Product cameras plant the root in the garden bed or pot, so its end-on cap
  // is always buried; widened, that cap would only read as a bulb at the soil.
  const trunk=(outgoing.get('origin')??[]).reduce((best,item)=>!best||item.r0>best.r0?item:best,null);
  if(camera.crown&&trunk&&!trunk.short){
    // The trunk rises from the soil vertically, so its buried end is cut level
    // with the bed instead of showing a slanted flared section above it.
    trunk.startCap=0;trunk.t0=[0,-1];trunk.n0=perpendicular(trunk.t0);
    const start=trunk.axisDistance,height=BASAL_FLARE_HEIGHT*trunk.r0/camera.scale;
    const gain=distance=>{const rise=1-clamp((distance-start)/height);return 1+BASAL_FLARE_GAIN*rise*rise;};
    for(let surface=trunk;surface&&surface.axisDistance-start<height;surface=surface.next){
      const from=surface.axisDistance,length=surface.length;
      surface.flare=t=>gain(from+length*t);receipt.flareSegmentCount++;
    }
  }
  for(const surface of surfaces.values()){
    if(surface.short)continue;
    const bend=Math.acos(clamp(dot(surface.t0,surface.tangent)))+Math.acos(clamp(dot(surface.t1,surface.tangent)));
    const steps=Math.max(surface.flare?6:1,bend>.01?Math.min(10,Math.ceil(bend/.09)+1):1);
    surface.steps=Math.max(1,Math.min(steps,Math.ceil(surface.projectedLength/pixelRatio)));
    if(bend<=.01)continue;
    const handle=surface.projectedLength/3;
    surface.c1=add(surface.a.slice(0,2),multiply(surface.t0,handle));surface.c2=add(surface.b.slice(0,2),multiply(surface.t1,-handle));surface.straight=false;
    if(edgesFold(surface)){surface.straight=true;surface.c1=surface.a;surface.c2=surface.b;receipt.foldGuardSegmentCount++;}
    else receipt.curvedSegmentCount++;
  }
  // A branch leaving a limb is painted just behind it until it clears the
  // limb's silhouette, so its start cap and base overlap never sit on top of
  // the limb as a lighter knob. A fillet collar beneath both closes the notches.
  for(const surface of surfaces.values()){
    if(surface.previous||surface.short)continue;
    const parent=incoming.get(surface.segment.parentNodeId);
    if(!parent||parent.short)continue;
    const continuation=parent.next&&parent.next!==surface&&!parent.next.short?parent.next:null;
    receipt.lateralJunctionCount++;
    for(const side of[-1,1]){
      const collar=junctionCollar(surface.a.slice(0,2),parent,continuation,surface,side);
      if(collar){surface.collars.push(collar);receipt.collarCount++;}
    }
    const clearance=Math.max(parent.radiusAt(1),continuation?continuation.radiusAt(0):0)+surface.radiusAt(0);
    let along=0;
    for(let item=surface;item&&along<clearance;item=item.next){item.behind={parent,continuation};along+=item.projectedLength;}
  }
  function displayDepth(surface){
    if(surface.displayDepth!==null)return surface.displayDepth;
    let depth=surface.depth;
    if(surface.behind){
      const {parent,continuation}=surface.behind;
      depth=Math.min(depth,displayDepth(parent)-1e-6,continuation?displayDepth(continuation)-1e-6:Infinity);
    }
    surface.displayDepth=depth;return depth;
  }
  const yaw=camera.yaw*Math.PI/180,view=[-Math.sin(yaw),0,Math.cos(yaw)];
  for(const surface of surfaces.values()){
    axisDistance(surface);axisMaterial(surface);
    const {segment,length}=surface,widthCss=(surface.r0+surface.r1)/pixelRatio;
    const bark=establishedBark(snapshot,segment);
    const detail=ramp(widthCss,3.4,7.5)*bark;
    if(!detail||surface.short)continue;
    const {u,v}=axisFrame(surface);
    if(!samplers.has(segment.axisId))samplers.set(segment.axisId,axisSampler(segment.axisId));
    const sample=samplers.get(segment.axisId);
    // Three loosely staggered lanes of short pores: wide evenly spaced pores
    // read as rings or bamboo nodes on a small trunk, not as cherry bark.
    const pitch=8+sample('bark-pitch')*5,phase=sample('bark-phase')*pitch;
    const start=surface.axisDistance,end=start+length;
    // Search one cell beyond both ends so jitter cannot drop a station at seams.
    for(let station=Math.floor((start-phase)/pitch)-1;station<=Math.ceil((end-phase)/pitch);station++){
      for(let lane=0;lane<3;lane++){
        const key=`${station}:${lane}`,distance=phase+(station+lane*.37+(sample(`lenticel-jitter:${key}`)-.5)*.8)*pitch;
        if(distance<0||distance<start||distance>=end)continue;
        const t=(distance-start)/length,angle=sample(`lenticel-angle:${key}`)*TAU;
        const radial=add(multiply(u,Math.cos(angle)),multiply(v,Math.sin(angle))),facing=Math.max(0,dot(radial,view));
        if(facing<=0)continue;
        const center=surface.parent.p.map((value,index)=>value+surface.delta[index]*t),radius=surface.radiusAt(t)/camera.scale,shift=centerlineShift(surface,t);
        const accent=sample(`lenticel-accent:${key}`)<.38;
        const halfAngle=(accent?.36:.17)+sample(`lenticel-width:${key}`)*(accent?.3:.26);
        const projectAngle=value=>add(projectZenCherry(add(center,multiply(add(multiply(u,Math.cos(value)),multiply(v,Math.sin(value))),radius*.87)),camera).slice(0,2),shift);
        // Broad stylized pores can straddle the cylindrical limb. Trim the
        // hidden angular part instead of projecting it back onto the front.
        const front=Math.atan2(dot(v,view),dot(u,view));
        const relative=Math.atan2(Math.sin(angle-front),Math.cos(angle-front));
        const left=Math.max(-Math.PI*.5,relative-halfAngle),right=Math.min(Math.PI*.5,relative+halfAngle);
        if(left>relative-halfAngle||right<relative+halfAngle)receipt.clippedLenticelCount++;
        const weathering=surface.material.mature*sample(`lenticel-weather:${key}`);
        surface.marks.push({start:projectAngle(front+left),middle:projectAngle(front+(left+right)*.5),end:projectAngle(front+right),direction:centerlineDirection(surface,t),
          alpha:detail*Math.sqrt(facing)*((accent?.81:.57)+sample(`lenticel-tone:${key}`)*.14),
          // Display exaggeration: a subpixel botanical pore vanishes in the app.
          // Keep a CSS-sized height on established wood and fade thin twigs out.
          height:Math.max((accent?1.35:.8)*pixelRatio,(surface.r0+surface.r1)*((accent?.065:.04)+sample(`lenticel-height:${key}`)*.025)),weathering});
        receipt.lenticelCount++;if(accent)receipt.accentLenticelCount++;if(weathering>.4)receipt.weatheredLenticelCount++;
      }
    }
    const patinaDetail=ramp(widthCss,5,11)*surface.material.mature*bark;
    if(!patinaDetail)continue;
    const grainPitch=4.5,grainPhase=sample('patina-phase')*grainPitch;
    for(let station=Math.floor((start-grainPhase)/grainPitch)-1;station<=Math.ceil((end-grainPhase)/grainPitch);station++){
      const distance=grainPhase+(station+(sample(`patina-jitter:${station}`)-.5)*.6)*grainPitch;
      if(distance<0||distance<start||distance>=end)continue;
      const t=(distance-start)/length,angle=sample(`patina-angle:${station}`)*TAU;
      const radial=add(multiply(u,Math.cos(angle)),multiply(v,Math.sin(angle))),facing=Math.max(0,dot(radial,view));
      if(!facing)continue;
      const radius=surface.radiusAt(t)/camera.scale,shift=centerlineShift(surface,t);
      const extent=Math.min(grainPitch*.32,radius*(.18+sample(`patina-length:${station}`)*.3));
      const room=Math.min(distance-start,end-distance),reveal=ramp(room/extent,1,1.8);
      if(!reveal)continue;
      const halfAngle=.10+sample(`patina-width:${station}`)*.18;
      const projectPatch=(along,across)=>{
        const center=surface.parent.p.map((value,index)=>value+surface.delta[index]*(t+along*extent/length));
        const theta=angle+across*halfAngle;
        return add(projectZenCherry(add(center,multiply(add(multiply(u,Math.cos(theta)),multiply(v,Math.sin(theta))),radius*.83)),camera).slice(0,2),shift);
      };
      surface.patina.push({points:[[-.9,-.2],[-.45,-1],[.4,-.7],[1,.3],[.1,1],[-.6,.65]].map(([along,across])=>projectPatch(along,across)),
        alpha:patinaDetail*reveal*Math.sqrt(facing)*(.13+sample(`patina-tone:${station}`)*.09),light:sample(`patina-light:${station}`)>.5});
      receipt.patinaCount++;
    }
  }
  const paintBase=surface=>{
    const bark=establishedBark(snapshot,surface.segment);
    return bark===0?BARK.young:bark===1?girthBase(surface):mixedColor(BARK.young,girthBase(surface),bark,1);
  };
  const paintDetail=surface=>{
    const widthCss=(surface.r0+surface.r1)/pixelRatio;
    return ramp(widthCss,1.3,4.5)*ramp(surface.projectedLength/pixelRatio,.05,Math.max(.4,widthCss*.35));
  };
  const edgePigment=(surface,saturation)=>shiftedColor(paintBase(surface),-.065*paintDetail(surface),saturation);
  return{receipt,depth(segment){
    // Paint order for command-plan layers. Only a lateral branch base moves,
    // and only to just behind the limb it leaves.
    const surface=surfaces.get(segment.id);if(!surface)throw Error('ZEN_PLUME_WOOD_SEGMENT');
    return displayDepth(surface);
  },draw(ctx,segment,cycle,saturation){
    const surface=surfaces.get(segment.id);if(!surface)throw Error('ZEN_PLUME_WOOD_SEGMENT');
    // The frozen painter deliberately leaves round caps/joins for subsequent
    // flower strokes. Preserve that state contract; isolate every other style.
    ctx.lineCap='round';ctx.lineJoin='round';ctx.save();
    const bark=establishedBark(snapshot,segment);
    const base=paintBase(surface);
    if(surface.short){
      ctx.fillStyle=color(base,saturation);
      const center=surface.r0>=surface.r1?surface.a:surface.b;
      ctx.beginPath();ctx.arc(center[0],center[1],Math.max(surface.r0,surface.r1),0,TAU);ctx.fill();
    }else{
      for(const collar of surface.collars){
        // Edge pigment of the limb fading into the branch's own edge pigment.
        const fill=ctx.createLinearGradient(...collar.from,...collar.to);
        fill.addColorStop(0,edgePigment(collar.parentSurface,saturation));fill.addColorStop(1,edgePigment(surface,saturation));
        ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(...collar.points[0]);
        for(let index=1;index<collar.points.length;index++)ctx.lineTo(...collar.points[index]);
        ctx.closePath();ctx.fill();
      }
      ctx.fillStyle=color(base,saturation);
      const widthCss=(surface.r0+surface.r1)/pixelRatio;
      const detail=paintDetail(surface);
      if(detail){
        // F4-like bristle values run along the existing tube with no new
        // raster layer. The shared opaque fill preserves its original coverage.
        // Tube normals retain screen winding so circles and strips form one
        // fill. Material handedness follows the tree's world reflection.
        const normal=multiply(perpendicular(centerlineDirection(surface,.5)),camera.horizontalSign);
        const midpoint=centerline(surface,.5),radius=surface.radiusAt(.5);
        const shade=ctx.createLinearGradient(...offset(midpoint,normal,radius,-1),...offset(midpoint,normal,radius,1));
        const grainStrength=ramp(widthCss,4,10)*bark;
        // The side facing the blossoms' upper-left light is slightly lifted and
        // the far side slightly pooled; band structure and edges are unchanged.
        const key=WOOD_KEY_VALUE*detail*dot(normal,[WOOD_KEY_LIGHT[0]*camera.horizontalSign,WOOD_KEY_LIGHT[1]]);
        shade.addColorStop(0,shiftedColor(base,-.065*detail-key,saturation));
        for(const band of bristleBands(surface)){
          const centreness=Math.pow(1-Math.abs(band.position*2-1),.75);
          const value=(-.065+.11*centreness+band.grain*grainStrength)*detail+key*(band.position*2-1);
          const pigment=shiftedColor(base,value,saturation);
          shade.addColorStop(band.position-.024,pigment);
          shade.addColorStop(band.position+.024,pigment);
        }
        shade.addColorStop(1,shiftedColor(base,-.065*detail+key,saturation));
        ctx.fillStyle=shade;
      }
      tube(ctx,surface);
      if(detail){
        for(const patch of surface.patina){
          ctx.save();ctx.globalAlpha*=patch.alpha*detail*.65;ctx.fillStyle=color(patch.light?BARK.patina:BARK.fissure,saturation);
          ctx.beginPath();ctx.moveTo(...patch.points[0]);for(const p of patch.points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fill();ctx.restore();
        }
        for(const mark of surface.marks){
          ctx.save();ctx.globalAlpha*=mark.alpha*detail*.58;
          // Keep the cherry's tapered crosswise pores, but let the dark crease
          // carry them. A quiet raised edge avoids bright scratches on every limb.
          const top=offset(mark.middle,mark.direction,mark.height,-1),bottom=offset(mark.middle,mark.direction,mark.height,.75);
          ctx.fillStyle=color(BARK.lenticel,saturation);ctx.beginPath();ctx.moveTo(...mark.start);
          ctx.quadraticCurveTo(...top,...mark.end);ctx.quadraticCurveTo(...bottom,...mark.start);ctx.closePath();ctx.fill();
          ctx.strokeStyle=color(BARK.fissure,saturation);ctx.lineWidth=Math.max(.32*pixelRatio,mark.height*.30);
          ctx.beginPath();ctx.moveTo(...mark.start);ctx.quadraticCurveTo(...bottom,...mark.end);ctx.stroke();
          const lip=ramp(mark.weathering,.3,.65);
          if(lip){
            // A short broken lip suggests older flaking bark; it never wraps a
            // full ring or adds a longitudinal crack through a young twig.
            const lipEnd=mark.middle.map((value,index)=>value+(mark.end[index]-value)*.6);
            ctx.globalAlpha*=lip*.20;ctx.strokeStyle=color(BARK.lip,saturation);
            ctx.beginPath();ctx.moveTo(...mark.start);ctx.quadraticCurveTo(...top,...lipEnd);ctx.stroke();
          }
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }};
}
