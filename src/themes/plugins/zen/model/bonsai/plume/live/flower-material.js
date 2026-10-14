import {projectZenCherry,projectZenCherryDirection} from '../annual/render.js';
import {SAKURA_FLOWER_COLORS,SAKURA_PETAL_SHAPES,traceSakuraPetalPath,resolveSakuraPetalPigment,createSakuraPetalBodyGradient} from '../../../sakura/sakuraPetalMaterial.js';

const TAU=Math.PI*2,TILE_SIZE=64,PETAL_RADIUS=25,PETAL_TURN=TAU/5;
const VIEW_COSINES=Object.freeze([1,.65,.1,-.1,-.65,-1]);
const OPENINGS=Object.freeze([.18,.6,1]);
const SHAPES=SAKURA_PETAL_SHAPES.slice(0,2);
// Small pose variations stay fixed per shared shape. The blossom retains its
// five-lobe identity through azimuth bins without five identical coplanar parts.
const PETAL_LENGTHS=Object.freeze([1,.965,1.02,.98,1.005]);
const PETAL_RISES=Object.freeze([.022,.07,-.005,.047,-.015]);
const PETAL_TWISTS=Object.freeze([-.055,.045,-.025,.06,-.015]);
const BASE_TILE_COUNT=72;
// Crown-light tone banks, from a blossom in its puff's shadow to one in sun.
// Shade deepens toward a clean rose, not grey or lilac; sun lifts toward white.
export const ZEN_PLUME_FLOWER_DEPTH_TONES=Object.freeze([
  Object.freeze({index:0,id:'shade',overlayColor:'#AE6680',overlayAlpha:.38}),
  Object.freeze({index:1,id:'body',overlayColor:'#FFFFFF',overlayAlpha:0}),
  Object.freeze({index:2,id:'lit',overlayColor:'#FFF8F5',overlayAlpha:.28}),
]);
// The untinted bank holds the only painted geometry; the others copy it.
const BODY_TONE=ZEN_PLUME_FLOWER_DEPTH_TONES.findIndex(tone=>tone.overlayAlpha===0);
// The exposure that selects the body bank for every blossom: the explicit
// comparison painter has no crown light and keeps the untinted material.
export const ZEN_PLUME_FLOWER_BODY_EXPOSURE=BODY_TONE/(ZEN_PLUME_FLOWER_DEPTH_TONES.length-1);
const radialSpread=opening=>.28+.72*Math.sin(opening*Math.PI/2);
const PIGMENTS=Object.freeze(Array.from({length:4},(_,index)=>resolveSakuraPetalPigment({
  color:SAKURA_FLOWER_COLORS[index%2],warmth:.4+(index%2)*.1,centerDepth:.35,
  lightExposure:index<2?.9:.65,fallAmount:0,translucency:.5,
})));
const tiles=Object.freeze(Array.from({length:BASE_TILE_COUNT*ZEN_PLUME_FLOWER_DEPTH_TONES.length},(_,id)=>{
  const baseTileId=id%BASE_TILE_COUNT,depthTone=Math.floor(id/BASE_TILE_COUNT);
  const shape=baseTileId%2,azimuth=Math.floor(baseTileId/2)%2,tilt=Math.floor(baseTileId/4)%6,opening=Math.floor(baseTileId/24);
  return Object.freeze({id,x:id%16*TILE_SIZE,y:Math.floor(id/16)*TILE_SIZE,width:TILE_SIZE,height:TILE_SIZE,
    baseTileId,depthTone,shape,tilt,face:VIEW_COSINES[tilt]<0?'back':'front',facingCosine:VIEW_COSINES[tilt],
    opening,openingAmount:OPENINGS[opening],azimuth,azimuthRadians:azimuth*PETAL_TURN/2,
    radialSpread:radialSpread(OPENINGS[opening]),
  });
}));

export const ZEN_PLUME_FLOWER_ATLAS=Object.freeze({
  schema:'zen_cherry_plume_flower_atlas_v5',width:1024,height:1024,tileSize:TILE_SIZE,columns:16,tileCount:216,
  baseTileCount:BASE_TILE_COUNT,depthToneCount:ZEN_PLUME_FLOWER_DEPTH_TONES.length,depthTones:ZEN_PLUME_FLOWER_DEPTH_TONES,
  shapeCount:2,tiltCount:6,openingCount:3,azimuthCount:2,faceCount:2,petalRadius:PETAL_RADIUS,tiles,
  materialPolicy:'Five F4-inspired tapered laminae with shallow clefts, diffuse light bodies and shaded folds; fixed rise/twist, depth-sorted cup, calyx and stamens; 72 poses in three alpha-preserving crown-light tones (shade, untinted body, sun).',
  instancePolicy:'Exact organ center/depth; frame-selected view; crown-light tone bank by stable per-blossom threshold and bounded 0.94-to-1 depth scale; uniform screen rotation/reflection and continuous opening radius.',
});

// Raster density of the shared atlas. Tile layout, instance matrices and tile
// selection stay in the logical 64-unit space above; only texels per unit vary.
// The full raster is the explicit comparison/Canvas surface.
export const ZEN_PLUME_FLOWER_FULL_RASTER=Object.freeze({scale:1,edge:ZEN_PLUME_FLOWER_ATLAS.width});
const RASTER_SCALE_STEPS=16,MIN_RASTER_SCALE=.25;
function rasterFor(scale){
  // A power-of-two surface keeps mipmaps available on WebGL1 as well; the
  // painted sheet occupies its top-left width*scale texels.
  let edge=1;while(edge<ZEN_PLUME_FLOWER_ATLAS.width*scale)edge*=2;
  return Object.freeze({scale,edge});
}
function requireRaster(raster){
  const steps=raster?.scale*RASTER_SCALE_STEPS;
  if(!raster||!Number.isInteger(steps)||raster.scale<MIN_RASTER_SCALE||raster.scale>1||raster.edge!==rasterFor(raster.scale).edge)
    throw Error('ZEN_PLUME_FLOWER_ATLAS_RASTER');
  return raster;
}
// Mature openings, the 0.94-1 depth scale and pose spread display the median
// blossom at about 0.78 of its rest radius (measured over Home seeds; p10 0.61,
// p90 0.96). Matching that typical sprite, not the rest radius, keeps most
// draws near level 0 instead of blending half-resolution mip levels.
const TYPICAL_DISPLAY_RADIUS_RATIO=.8;
/**
 * The product camera fixes its median mature-blossom radius for one viewport
 * and backing resolution. Bake the typical displayed blossom at about 1:1
 * (nearest 1/16 step) so sprites sample their own detail instead of minifying a
 * 50-texel bake several times; mipmaps cover buds, partial openings and depth.
 */
export function resolveZenCherryPlumeFlowerAtlasRaster(camera){
  if(!camera||typeof camera!=='object')throw Error('ZEN_PLUME_FLOWER_ATLAS_RASTER_CAMERA');
  if(!camera.crown)return ZEN_PLUME_FLOWER_FULL_RASTER;
  const radius=camera.crown.medianRestRadius*camera.scale*camera.crown.flowerRadiusScale;
  if(!(radius>0&&Number.isFinite(radius)))throw Error('ZEN_PLUME_FLOWER_ATLAS_RASTER_RADIUS');
  const steps=Math.round(radius*TYPICAL_DISPLAY_RADIUS_RATIO/PETAL_RADIUS*RASTER_SCALE_STEPS);
  const scale=Math.min(1,Math.max(MIN_RASTER_SCALE,steps/RASTER_SCALE_STEPS));
  return scale===1?ZEN_PLUME_FLOWER_FULL_RASTER:rasterFor(scale);
}

function unit(value,label){
  if(!Number.isFinite(value)||value<0||value>1)throw Error(`ZEN_PLUME_FLOWER_${label}`);
  return value;
}
function point(value,label){
  if(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite))throw Error(`ZEN_PLUME_FLOWER_${label}`);
  return value;
}
function normalized(value,label){
  point(value,label);const length=Math.hypot(...value);
  if(length<1e-8)throw Error(`ZEN_PLUME_FLOWER_${label}`);
  return value.map(number=>number/length);
}
function hashOf(id){
  let value=2166136261;
  for(const character of id)value=Math.imul(value^character.charCodeAt(0),16777619);
  value^=value>>>16;return value>>>0;
}
function shapeFor(id){return hashOf(id)%SHAPES.length;}
// A stable per-blossom threshold spreads a continuous exposure over adjacent
// tone banks: neighbors differ by at most one bank and the crown keeps its
// gradient instead of contour bands. It is independent of the shape bits.
function toneThreshold(id){return(Math.imul(hashOf(id),2654435761)>>>8)/16777216;}
function nearest(values,value){
  let selected=0;
  for(let index=1;index<values.length;index++)if(Math.abs(values[index]-value)<Math.abs(values[selected]-value))selected=index;
  return selected;
}
function matteColor(color,shade){
  const parts=/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(color);
  if(!parts)throw Error('ZEN_PLUME_FLOWER_PIGMENT');
  const shadow=[185,135,150];
  return `rgba(${shadow.map((target,index)=>Math.round(Number(parts[index+1])*(1-shade)+target*shade)).join(',')},${parts[4]})`;
}
function mattePigment(pigment,shade){
  return{...pigment,petalRootColor:matteColor(pigment.petalRootColor,shade),
    petalBodyLightColor:matteColor(pigment.petalBodyLightColor,shade),petalBodyMidColor:matteColor(pigment.petalBodyMidColor,shade),
    petalBodyFoldColor:matteColor(pigment.petalBodyFoldColor,shade),petalBodyTipColor:matteColor(pigment.petalBodyTipColor,shade)};
}

// Sample the shared notched lamina before bending it in 3D. Projecting its
// Bezier control points after a nonlinear cup bend would distort the contour.
function sampleLamina(shape){
  const points=[];let current;
  const ctx={moveTo(x,y){current=[x,y];points.push(current);},closePath(){},bezierCurveTo(ax,ay,bx,by,x,y){
    const start=current;
    for(let step=1;step<=8;step++){
      const t=step/8,s=1-t;
      points.push([s*s*s*start[0]+3*s*s*t*ax+3*s*t*t*bx+t*t*t*x,s*s*s*start[1]+3*s*s*t*ay+3*s*t*t*by+t*t*t*y]);
    }
    current=[x,y];
  }};
  traceSakuraPetalPath(ctx,shape,(x,y)=>[x,y]);return Object.freeze(points.map(Object.freeze));
}
const LAMINAE=Object.freeze(SHAPES.map(sampleLamina));

/** Pure atlas bake geometry, in tile-local pixels; larger depth paints later. */
export function createZenCherryPlumeFlowerTileGeometry(tile){
  if(!tile||tiles[tile.id]!==tile)throw Error('ZEN_PLUME_FLOWER_TILE');
  const shape=SHAPES[tile.shape],cos=tile.facingCosine,sin=Math.sqrt(1-cos*cos);
  const ca=Math.cos(tile.azimuthRadians),sa=Math.sin(tile.azimuthRadians),opening=tile.openingAmount;
  // Camera basis in the blossom's own (u,v,normal) frame. Normal relief adds
  // screen height even at a profile view: this is not a flattened top image.
  const projected=([x,y,z])=>[(-sa*x+ca*y)*PETAL_RADIUS,(cos*(ca*x+sa*y)-sin*z)*PETAL_RADIUS,sin*(ca*x+sa*y)+cos*z];
  const layers=[];
  const add=(kind,index,world,extra={})=>{
    const points=world.map(projected),depth=points.reduce((total,p)=>total+p[2],0)/points.length;
    layers.push({kind,index,points,depth,...extra});
  };
  const zAt=r=>.72*(1-opening)*Math.pow(r,1.45)+.13*Math.sin(Math.PI*r)+shape.cup*r*r;
  for(let index=0;index<5;index++){
    const variation=(index+tile.shape*2)%5,length=PETAL_LENGTHS[variation],rise=PETAL_RISES[variation],twist=PETAL_TWISTS[variation];
    const angle=index*PETAL_TURN,c=Math.cos(angle),s=Math.sin(angle);
    const petalPoint=([x,y])=>{
      const r=Math.max(0,-y),lateral=x*tile.radialSpread*(.7+.3*opening),radial=y*tile.radialSpread*length;
      const relief=rise*Math.pow(r,1.6)*(.4+.6*opening)+twist*x/shape.width*r;
      return[lateral*c-radial*s,lateral*s+radial*c,zAt(r)+relief+.025*(x/shape.width)**2];
    };
    // One sampled lamina normal controls a restrained diffuse tone baked into
    // the tile. No extra per-frame light, filter, sprite or shiny edge exists.
    const a=petalPoint([.02,-.55]),b=petalPoint([-.02,-.55]);
    const d=petalPoint([0,-.53]),e=petalPoint([0,-.57]);
    const across=a.map((value,axis)=>value-b[axis]),along=d.map((value,axis)=>value-e[axis]);
    const normal=normalized([across[1]*along[2]-across[2]*along[1],across[2]*along[0]-across[0]*along[2],across[0]*along[1]-across[1]*along[0]],'LAMINA_NORMAL');
    const face=cos<0?-1:1,nx=(-sa*normal[0]+ca*normal[1])*face;
    const ny=(cos*(ca*normal[0]+sa*normal[1])-sin*normal[2])*face;
    const nz=(sin*(ca*normal[0]+sa*normal[1])+cos*normal[2])*face;
    const light=Math.max(0,nx*-.40+ny*-.58+nz*.71),shade=.008+.08*(1-light);
    add('petal',index,LAMINAE[tile.shape].map(petalPoint),{
      base:projected(petalPoint([0,0])),tip:projected(petalPoint([0,-1])),shade,
    });
    // Short pointed sepals sit behind the petal socket, exposed from below.
    const radial=[Math.cos(angle),Math.sin(angle)],tangent=[-radial[1],radial[0]];
    const sepal=(r,t,z)=>[radial[0]*r+tangent[0]*t,radial[1]*r+tangent[1]*t,z];
    add('sepal',index,[sepal(.03,0,-.12),sepal(.13,-.075,-.13),sepal(.34,0,-.08),sepal(.13,.075,-.13)]);
  }
  // A small five-sided receptacle has real depth beneath the open cup. Its
  // silhouette remains visible in profile and masks petal roots from behind.
  for(let index=0;index<5;index++){
    const a=index*PETAL_TURN,b=(index+1)*PETAL_TURN;
    add('calyx',index,[
      [.065*Math.cos(a),.065*Math.sin(a),-.25],[.19*Math.cos(a),.19*Math.sin(a),-.045],
      [.19*Math.cos(b),.19*Math.sin(b),-.045],[.065*Math.cos(b),.065*Math.sin(b),-.25],
    ]);
  }
  // Petal mean depth is suitable for their outer lobes, but not their shared
  // socket at z=0. A visible cup mouth exposes its core above those sockets.
  // At grazing views the near petal wall keeps occluding the center instead.
  const frontMouthVisible=cos>.35+(1-opening)*.3;
  if(frontMouthVisible){
    // The open cup's floor, just above the calyx. Tapered petal claws expose
    // this warm hypanthium between them rather than the dark outer calyx.
    add('throat',0,Array.from({length:10},(_,index)=>{const a=index*TAU/10;return[.2*tile.radialSpread*Math.cos(a),.2*tile.radialSpread*Math.sin(a),-.01];}));
  }
  if(cos>0){
    const core=Array.from({length:12},(_,index)=>{const a=index*TAU/12;return[.08*Math.cos(a),.08*Math.sin(a),.045];});
    add('core',0,core);
    // Long pale filaments reach about a third of the petal: at screen size the
    // center reads as a soft stamen halo, not a printed star.
    for(let index=0;index<16;index++){
      const a=(index+.5*(index%2))*TAU/16,r=(.27+(index%3)*.045)*tile.radialSpread;
      add('stamen',index,[[0,0,.05],[Math.cos(a)*r,Math.sin(a)*r,.13+.12*(1-opening)]]);
    }
  }
  layers.sort((a,b)=>a.depth-b.depth||a.index-b.index);
  return{tileId:tile.id,layers,frontMouthVisible};
}

function tracePolygon(ctx,points){
  ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
  for(let index=1;index<points.length;index++)ctx.lineTo(points[index][0],points[index][1]);
  ctx.closePath();
}
function paintTile(ctx,tile,scale){
  const back=tile.face==='back',pigment=PIGMENTS[tile.shape+(back?2:0)];
  const geometry=createZenCherryPlumeFlowerTileGeometry(tile);
  const isCore=layer=>layer.kind==='stamen'||layer.kind==='core';
  const layers=geometry.frontMouthVisible
    ?[...geometry.layers.filter(layer=>!isCore(layer)),...geometry.layers.filter(isCore)]
    :geometry.layers;
  ctx.save();ctx.translate(tile.x+TILE_SIZE/2,tile.y+TILE_SIZE/2);ctx.lineJoin='round';ctx.lineCap='round';
  for(const layer of layers){
    if(layer.kind==='stamen'){
      const [start,end]=layer.points;ctx.strokeStyle='#e8c5cd';ctx.lineWidth=.55;
      ctx.beginPath();ctx.moveTo(start[0],start[1]);ctx.lineTo(end[0],end[1]);ctx.stroke();
      ctx.fillStyle='#d6ad5f';ctx.beginPath();ctx.arc(end[0],end[1],.72,0,TAU);ctx.fill();continue;
    }
    tracePolygon(ctx,layer.points);
    if(layer.kind==='petal'){
      // Opaque laminae occlude rear contours, like the layered navigation
      // sigil. Pigment transparency is applied over this same petal only.
      ctx.fillStyle=back?'#e5c7d2':'#f6e7ed';ctx.fill();
      ctx.fillStyle=createSakuraPetalBodyGradient(ctx,mattePigment(pigment,layer.shade),...layer.base.slice(0,2),...layer.tip.slice(0,2));ctx.fill();
      // The lobe boundary keeps the same ~0.4-texel width at every raster
      // density; a fixed .38-unit line would vanish from a small camera bake.
      ctx.strokeStyle=pigment.petalBoundaryColor;ctx.lineWidth=.4/scale;ctx.stroke();
    }else{
      ctx.fillStyle=layer.kind==='core'?'#c47088':layer.kind==='throat'?'#e8b4c1':layer.kind==='sepal'?'#a6818a':layer.index%2?'#a07c84':'#b08a93';
      ctx.fill();
    }
  }
  ctx.restore();
}

function depthBankRectangles(depthTone){
  const bodyOffset=BASE_TILE_COUNT*BODY_TONE,rectangles=[];
  for(let index=0;index<BASE_TILE_COUNT;){
    const source=tiles[bodyOffset+index],target=tiles[depthTone*BASE_TILE_COUNT+index];
    let count=1;
    while(index+count<BASE_TILE_COUNT){
      const nextSource=tiles[bodyOffset+index+count],nextTarget=tiles[depthTone*BASE_TILE_COUNT+index+count];
      if(nextSource.y!==source.y||nextTarget.y!==target.y
        ||nextSource.x!==source.x+count*TILE_SIZE||nextTarget.x!==target.x+count*TILE_SIZE)break;
      count++;
    }
    const width=count*TILE_SIZE;
    const previous=rectangles.find(rect=>rect.sourceX===source.x&&rect.targetX===target.x&&rect.width===width
      &&rect.sourceY+rect.height===source.y&&rect.targetY+rect.height===target.y);
    if(previous)previous.height+=TILE_SIZE;
    else rectangles.push({sourceX:source.x,sourceY:source.y,targetX:target.x,targetY:target.y,width,height:TILE_SIZE});
    index+=count;
  }
  return Object.freeze(rectangles.map(Object.freeze));
}
const DEPTH_BANKS=Object.freeze(ZEN_PLUME_FLOWER_DEPTH_TONES.filter(tone=>tone.index!==BODY_TONE)
  .map(tone=>Object.freeze({tone,rectangles:depthBankRectangles(tone.index)})));

/** Paint one bounded atlas per renderer, independent of tree size and count. */
export function paintZenCherryPlumeFlowerAtlas(ctx,raster=ZEN_PLUME_FLOWER_FULL_RASTER){
  const {scale,edge}=requireRaster(raster);
  if(!ctx||ctx.canvas.width!==edge||ctx.canvas.height!==edge)
    throw Error('ZEN_PLUME_FLOWER_ATLAS_SURFACE');
  ctx.save();ctx.setTransform(scale,0,0,scale,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.clearRect(0,0,edge/scale,edge/scale);
  // Bake geometry only once, into the untinted body bank. The shade and sun
  // banks copy these exact pixels, preserving silhouette/occlusion and alpha
  // rather than repainting 216 flowers or tinting separately in each renderer.
  const bodyOffset=BASE_TILE_COUNT*BODY_TONE;
  for(const tile of tiles.slice(bodyOffset,bodyOffset+BASE_TILE_COUNT))paintTile(ctx,tile,scale);
  // Each rectangle contains exactly adjacent whole tiles with one translation.
  // Both destinations are disjoint from the unchanged body bank. Coalescing
  // those same pixels avoids 144 separate self-canvas copies and tint switches.
  // Source rectangles are surface texels; every tile edge lands on a whole
  // texel at each raster step, so these remain exact copies.
  for(const {tone,rectangles}of DEPTH_BANKS){
    for(const rect of rectangles)ctx.drawImage(ctx.canvas,rect.sourceX*scale,rect.sourceY*scale,rect.width*scale,rect.height*scale,
      rect.targetX,rect.targetY,rect.width,rect.height);
    ctx.save();ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=tone.overlayAlpha;
    ctx.fillStyle=tone.overlayColor;
    for(const rect of rectangles)ctx.fillRect(rect.targetX,rect.targetY,rect.width,rect.height);
    ctx.restore();
  }
  ctx.restore();return ZEN_PLUME_FLOWER_ATLAS;
}

/** Select an actual projected volume, then rotate it in the screen plane. */
export function createZenCherryPlumeFlowerInstance(flower,camera,{alpha,opening,normalizedDepth,exposure}){
  if(!flower||typeof flower.id!=='string'||!flower.id.length)throw Error('ZEN_PLUME_FLOWER_ID');
  point(flower.position,'POSITION');
  const normal=normalized(flower.normal,'NORMAL'),u=normalized(flower.u,'U'),v=normalized(flower.v,'V');
  if(!Number.isFinite(flower.radius)||flower.radius<=0)throw Error('ZEN_PLUME_FLOWER_RADIUS');
  unit(alpha,'ALPHA');unit(opening,'OPENING');unit(normalizedDepth,'DEPTH');unit(exposure,'EXPOSURE');
  const rotate=value=>projectZenCherryDirection(value,camera);
  const n=rotate(normal),p=rotate(u),q=rotate(v),cos=Math.max(-1,Math.min(1,n[2]));
  const azimuthAngle=Math.atan2(q[2],p[2]),ca=Math.cos(azimuthAngle),sa=Math.sin(azimuthAngle);
  const tilt=nearest(VIEW_COSINES,cos),openingIndex=nearest(OPENINGS,opening);
  const azimuth=((Math.round(azimuthAngle/(PETAL_TURN/2))%2)+2)%2;
  // Tone banks follow crown light; the bounded size cue stays on view depth.
  const depthTone=Math.min(ZEN_PLUME_FLOWER_DEPTH_TONES.length-1,Math.floor(exposure*(ZEN_PLUME_FLOWER_DEPTH_TONES.length-1)+toneThreshold(flower.id)));
  const tileId=depthTone*BASE_TILE_COUNT+openingIndex*24+tilt*4+azimuth*2+shapeFor(flower.id),tile=tiles[tileId];
  const sin=Math.sqrt(Math.max(0,1-cos*cos));
  // These axes are the actual flower camera's screen right/down basis, so the
  // sprite matrix is orthogonal (possibly reflected), never foreshortened twice.
  const right=[-sa*p[0]+ca*q[0],-sa*p[1]+ca*q[1]];
  const down=[cos*(ca*p[0]+sa*q[0])-sin*n[0],cos*(ca*p[1]+sa*q[1])-sin*n[1]];
  const rightLength=Math.hypot(...right),downLength=Math.hypot(...down);
  if(rightLength<1e-8||downLength<1e-8)throw Error('ZEN_PLUME_FLOWER_FRAME');
  // Keep the same continuous projected radius during growth; the selected
  // pose contributes its cup height and overlap, not a second size multiplier.
  const depthScale=.94+.06*normalizedDepth;
  const scale=flower.radius*camera.scale*opening*depthScale/(PETAL_RADIUS*tile.radialSpread),center=projectZenCherry(flower.position,camera);
  const matrix=[right[0]/rightLength*scale,right[1]/rightLength*scale,down[0]/downLength*scale,down[1]/downLength*scale,center[0],center[1]];
  if(!matrix.every(Number.isFinite)||!Number.isFinite(center[2]))throw Error('ZEN_PLUME_FLOWER_PROJECTION');
  return{id:flower.id,sourceId:flower.id,depth:center[2],tileId,matrix,alpha};
}

/** Caller supplies any existing scene/rig transform; this helper composes it. */
export function replayZenCherryPlumeFlower(ctx,atlasCanvas,instance,presentation=null){
  if(!instance||!Number.isInteger(instance.tileId)||instance.tileId<0||instance.tileId>=tiles.length
    ||!Array.isArray(instance.matrix)||instance.matrix.length!==6||!instance.matrix.every(Number.isFinite))
    throw Error('ZEN_PLUME_FLOWER_INSTANCE');
  unit(instance.alpha,'ALPHA');
  if(!atlasCanvas||atlasCanvas.width!==ZEN_PLUME_FLOWER_ATLAS.width||atlasCanvas.height!==ZEN_PLUME_FLOWER_ATLAS.height)
    throw Error('ZEN_PLUME_FLOWER_ATLAS_SURFACE');
  if(instance.alpha===0)return;
  if(presentation){
    const {firstTileId,secondTileId,firstScale,secondScale,blend,alphaScale}=presentation;
    if(!tiles[firstTileId]||!tiles[secondTileId]||!Number.isFinite(firstScale)||firstScale<=0
      ||!Number.isFinite(secondScale)||secondScale<=0||!Number.isFinite(alphaScale)||alphaScale<=0
      ||instance.alpha*alphaScale>1+1e-12)throw Error('ZEN_PLUME_FLOWER_PRESENTATION');
    unit(blend,'PRESENTATION_BLEND');
    if(blend<1)replayFlowerPose(ctx,atlasCanvas,instance,tiles[firstTileId],firstScale,alphaScale*(1-blend));
    if(blend>0)replayFlowerPose(ctx,atlasCanvas,instance,tiles[secondTileId],secondScale,alphaScale*blend);
  }else replayFlowerPose(ctx,atlasCanvas,instance,tiles[instance.tileId],1,1);
}

function replayFlowerPose(ctx,atlasCanvas,instance,tile,scale,alpha){
  const matrix=instance.matrix;
  ctx.save();
  if(scale===1)ctx.transform(...matrix);
  else ctx.transform(matrix[0]*scale,matrix[1]*scale,matrix[2]*scale,matrix[3]*scale,matrix[4],matrix[5]);
  ctx.globalAlpha*=instance.alpha*alpha;
  ctx.drawImage(atlasCanvas,tile.x,tile.y,TILE_SIZE,TILE_SIZE,-TILE_SIZE/2,-TILE_SIZE/2,TILE_SIZE,TILE_SIZE);ctx.restore();
}
