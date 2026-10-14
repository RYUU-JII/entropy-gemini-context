import {resolveZenCherryPlumeLiveRigTransforms} from './motion.js';
import {replayZenCherryPlumeLiveRun,ZEN_CHERRY_PLUME_LIVE_COMMAND_SCHEMA} from './canvas-executor.js';
import {createZenCherryPlumeLiveRasterContext} from './raster-context.js';
import {packZenCherryPlumeLiveRuns,canReuseZenCherryPlumeLiveSlots,compareZenCherryPlumeLiveRuns,ZEN_PLUME_LIVE_ATLAS_EDGE,ZEN_PLUME_LIVE_MAX_ATLASES} from './atlas-update.js';
import {ZEN_PLUME_FLOWER_ATLAS,paintZenCherryPlumeFlowerAtlas,resolveZenCherryPlumeFlowerAtlasRaster} from './flower-material.js';
import {applyZenCherryPlumeSpriteTransform} from './sprite-transform.js';
import {compileZenBonsaiPlumeBloomPresentation,requireZenBonsaiPlumeBloomPresentationPlan,requireZenBonsaiPlumeBloomPresentationProgress,requireZenBonsaiPlumeBloomInvitation,resolveZenBonsaiPlumeBloomPose} from '../ZenBonsaiPlumeBloomPresentation.js';
import {compileZenBonsaiPlumeBloomRegions} from '../ZenBonsaiPlumeBloomRegions.js';
import {ZEN_BOTANICAL_NEUTRAL_MATERIAL_LIGHTING,requireZenWorldBotanicalMaterialLighting,createZenBotanicalMaterialContext} from '../../../../runtime/environment/zenWorldBotanicalMaterialLighting.js';
import {Sprite,Texture,BaseTexture,Rectangle,Matrix,SCALE_MODES,MIPMAP_MODES} from '../../../../runtime/worker/zenPixiWorkerRuntime.js';
const VERSION='7.4.3';

const MAX_ATLASES=ZEN_PLUME_LIVE_MAX_ATLASES,ATLAS_EDGE=ZEN_PLUME_LIVE_ATLAS_EDGE;
const TOTAL_TEXTURE_LIMIT=MAX_ATLASES*ATLAS_EDGE*ATLAS_EDGE*4;
// The flower atlas is mipmapped: its GPU footprint is the whole level chain.
function flowerTextureBytes(raster){let bytes=0;for(let edge=raster.edge;edge>=1;edge=edge>>1)bytes+=edge*edge*4;return bytes;}
const unit=value=>Number.isFinite(value)&&value>=0&&value<=1;
function createAtlasSurface(width,height){
  if(typeof OffscreenCanvas!=='function')throw Error('ZEN_PLUME_PRODUCT_OFFSCREEN_REQUIRED');
  return new OffscreenCanvas(width,height);
}

function validateDisplay(plan){
  if(!['shared','procedural'].includes(plan.flowerStyle)||!Array.isArray(plan.flowerSprites)||!Array.isArray(plan.displayOrder)||plan.displayOrder.length!==plan.runs.length+plan.flowerSprites.length)throw Error('ZEN_PLUME_LIVE_DISPLAY_PLAN');
  if(plan.flowerStyle==='procedural'&&plan.flowerSprites.length)throw Error('ZEN_PLUME_LIVE_PROCEDURAL_FLOWER_SPRITES');
  if(plan.flowerStyle==='shared'){
    const material=plan.flowerMaterial;
    const descriptorKeys=['schema','width','height','tileSize','tileCount','baseTileCount','depthToneCount','shapeCount','tiltCount','openingCount','azimuthCount','faceCount'];
    const tileKeys=['id','x','y','width','height','baseTileId','depthTone','shape','tilt','face','facingCosine','opening','openingAmount','azimuth','azimuthRadians','radialSpread'];
    if(!material||descriptorKeys.some(key=>material[key]!==ZEN_PLUME_FLOWER_ATLAS[key])||!Array.isArray(material.tiles)||material.tiles.length!==ZEN_PLUME_FLOWER_ATLAS.tileCount||material.tiles.some((tile,index)=>tileKeys.some(key=>tile[key]!==ZEN_PLUME_FLOWER_ATLAS.tiles[index][key])))throw Error('ZEN_PLUME_LIVE_FLOWER_MATERIAL');
    if(!Array.isArray(material.depthTones)||material.depthTones.length!==ZEN_PLUME_FLOWER_ATLAS.depthToneCount
      ||material.depthTones.some((tone,index)=>!tone||['index','id','overlayColor','overlayAlpha'].some(key=>tone[key]!==ZEN_PLUME_FLOWER_ATLAS.depthTones[index][key])))throw Error('ZEN_PLUME_LIVE_FLOWER_DEPTH_MATERIAL');
  }else if(plan.flowerMaterial!==null)throw Error('ZEN_PLUME_LIVE_PROCEDURAL_FLOWER_MATERIAL');
  const ids=new Set(),rigs=new Set(plan.rigs.map(rig=>rig.id)),tiles=new Set(ZEN_PLUME_FLOWER_ATLAS.tiles.map(tile=>tile.id));
  for(const flower of plan.flowerSprites){
    if(typeof flower.id!=='string'||!flower.id||ids.has(flower.id)||!rigs.has(flower.rigId)||!tiles.has(flower.tileId)||!Array.isArray(flower.matrix)||flower.matrix.length!==6||!flower.matrix.every(Number.isFinite)||!unit(flower.alpha))throw Error('ZEN_PLUME_LIVE_FLOWER_INSTANCE');
    ids.add(flower.id);
  }
  const seenRuns=new Uint8Array(plan.runs.length),seenFlowers=new Uint8Array(plan.flowerSprites.length);
  for(const entry of plan.displayOrder){
    if(!entry||!['run','flower'].includes(entry.kind)||!Number.isInteger(entry.index))throw Error('ZEN_PLUME_LIVE_DISPLAY_ORDER');
    const seen=entry.kind==='run'?seenRuns:seenFlowers;
    if(entry.index<0||entry.index>=seen.length||seen[entry.index])throw Error('ZEN_PLUME_LIVE_DISPLAY_ORDER');
    seen[entry.index]=1;
  }
  return ids;
}

export function inspectZenCherryPlumeLiveTextureBudget(plan){
  if(plan?.schema!==ZEN_CHERRY_PLUME_LIVE_COMMAND_SCHEMA)throw Error('ZEN_PLUME_LIVE_COMMAND_PLAN');
  validateDisplay(plan);
  const packed=packZenCherryPlumeLiveRuns(plan.runs);
  const flowerAtlasCount=plan.flowerSprites.length?1:0,flowerAtlasBytes=flowerAtlasCount*flowerTextureBytes(resolveZenCherryPlumeFlowerAtlasRaster(plan.camera)),woodTextureBytes=packed.atlases.length*ATLAS_EDGE*ATLAS_EDGE*4,textureBytes=woodTextureBytes+flowerAtlasBytes;
  if(textureBytes>TOTAL_TEXTURE_LIMIT)throw Error('ZEN_PLUME_LIVE_COMBINED_TEXTURE_BUDGET:64MiB');
  return {atlasCount:packed.atlases.length+flowerAtlasCount,woodTextureCount:packed.atlases.length,woodTextureBytes,flowerAtlasCount,flowerAtlasBytes,flowerAtlasTileCount:flowerAtlasCount?ZEN_PLUME_FLOWER_ATLAS.tileCount:0,flowerSpriteCount:plan.flowerSprites.length,drawRuns:plan.runs.length,texturePixels:textureBytes/4,
    textureBytes,occupiedPixels:plan.runs.reduce((sum,run)=>sum+run.bounds.width*run.bounds.height,0),limitBytes:TOTAL_TEXTURE_LIMIT};
}

export function createZenCherryPlumeLivePixiRenderer({canvas,pixelRatio=1,renderer,container}={}){
  if(!canvas||typeof canvas.getContext!=='function'||!(pixelRatio>0)||!Number.isFinite(pixelRatio)||!renderer||!container)throw Error('ZEN_PLUME_LIVE_PIXI_INPUT');
  if(!renderer.gl)throw Error('ZEN_PLUME_LIVE_WEBGL_REQUIRED');
  const maxTexture=renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE);
  if(maxTexture<Math.max(ATLAS_EDGE,ZEN_PLUME_FLOWER_ATLAS.width,ZEN_PLUME_FLOWER_ATLAS.height))throw Error('ZEN_PLUME_LIVE_GPU_TEXTURE_LIMIT');
  let planWidth=canvas.width,planHeight=canvas.height;
  const stage=container,displayMatrix=new Matrix();let currentPlan=null,surfacePending=false,packing=null,sprites=[],bases=[],textures=[],atlasCanvases=[],contexts=[],disposed=false,renderCount=0,bakeMs=0,rebakeCount=0,lastMotion={time:0,wind:0,activation:1};
  let flowerCanvas=null,flowerBase=null,flowerRaster=null,flowerMaterialSignature=null,flowerTextures=new Map(),flowers=new Map(),flowerAtlasBakeCount=0,flowerAtlasUploadCount=0,flowerAtlasAllocationCount=0,flowerSpriteAllocationCount=0;
  let bloomCompanionCount=0,bloomCompanionAllocationCount=0,bloomPresentationProgress=null,bloomPresentationReady=false;
  const bloomPose={};
  let setPlanCount=0,fullBakeCount=0,partialBakeCount=0,reuseCount=0,paintedRuns=0,reusedRuns=0,textureAllocationCount=0,textureUpdateCount=0,spriteAllocationCount=0,compareMs=0;
  let woodFrameTextureAllocationCount=0,transformUpdateCount=0,transformReuseCount=0,lastTransformUpdate={updatedSprites:0,reusedSprites:0};
  let lastUpdate={kind:'none',paintedRuns:0,reusedRuns:0,updatedAtlases:0,allocatedAtlases:0};
  let currentMaterialLighting=ZEN_BOTANICAL_NEUTRAL_MATERIAL_LIGHTING,materialContexts=new WeakMap();
  function requireAlive(){if(disposed)throw Error('ZEN_PLUME_LIVE_RENDERER_DISPOSED');}
  function releaseSprites(){stage.removeChildren();for(const item of sprites)item.sprite.destroy({texture:false,baseTexture:false});for(const texture of textures)texture.destroy(false);sprites=[];textures=[];}
  function trimWoodSprites(count){while(sprites.length>count){const item=sprites.pop();if(item.sprite.parent)item.sprite.parent.removeChild(item.sprite);item.sprite.destroy({texture:false,baseTexture:false});textures.pop().destroy(false);}}
  function releaseCompanion(item){if(!item.companion)return;if(item.companion.sprite.parent)item.companion.sprite.parent.removeChild(item.companion.sprite);item.companion.sprite.destroy({texture:false,baseTexture:false});item.companion=null;bloomCompanionCount--;}
  function releaseFlowers(){for(const item of flowers.values()){releaseCompanion(item);if(item.sprite.parent)item.sprite.parent.removeChild(item.sprite);item.sprite.destroy({texture:false,baseTexture:false});}flowers.clear();}
  function release(){releaseSprites();releaseFlowers();for(const base of bases)base.destroy();bases=[];atlasCanvases=[];contexts=[];packing=null;currentPlan=null;surfacePending=false;bloomPresentationReady=false;}
  function releaseFlowerMaterial(){for(const texture of flowerTextures.values())texture.destroy(false);flowerTextures.clear();if(flowerBase)flowerBase.destroy();flowerBase=null;flowerCanvas=null;flowerRaster=null;flowerMaterialSignature=null;}
  function metrics(){const flowerAtlasCount=flowerBase?1:0,flowerAtlasBytes=flowerAtlasCount?flowerTextureBytes(flowerRaster):0,woodTextureBytes=bases.length*ATLAS_EDGE*ATLAS_EDGE*4;return {backend:'pixi-webgl',pixiVersion:VERSION,textureCount:bases.length+flowerAtlasCount,woodTextureCount:bases.length,woodTextureBytes,woodTextureAllocationCount:textureAllocationCount,woodTextureUpdateCount:textureUpdateCount,woodSpriteAllocationCount:spriteAllocationCount,woodFrameTextureCount:textures.length,woodFrameTextureAllocationCount,transformUpdateCount,transformReuseCount,lastTransformUpdate:{...lastTransformUpdate},flowerAtlasCount,flowerAtlasBytes,flowerAtlasRasterScale:flowerRaster?.scale??null,flowerAtlasTileCount:flowerTextures.size,flowerAtlasBakeCount,flowerAtlasUploadCount,flowerAtlasAllocationCount,flowerSpriteCount:flowers.size,flowerSpriteAllocationCount,bloomCompanionCount,bloomCompanionAllocationCount,bloomPresentationProgress,spriteCount:sprites.length+flowers.size+bloomCompanionCount,drawRuns:sprites.length,texturePixels:(woodTextureBytes+flowerAtlasBytes)/4,textureBytes:woodTextureBytes+flowerAtlasBytes,textureLimitBytes:TOTAL_TEXTURE_LIMIT,bakeMs,compareMs,disposed,renderCount,rebakeCount,setPlanCount,fullBakeCount,partialBakeCount,reuseCount,paintedRuns,reusedRuns,textureAllocationCount:textureAllocationCount+flowerAtlasAllocationCount,textureUpdateCount:textureUpdateCount+flowerAtlasUploadCount,spriteAllocationCount:spriteAllocationCount+flowerSpriteAllocationCount+bloomCompanionAllocationCount,lastUpdate:{...lastUpdate},pixelRatio,width:planWidth,height:planHeight,maxTextureSize:maxTexture,motion:{...lastMotion}};}
  function ensureFlowerMaterial(raster){
    const rasterChanged=flowerRaster!==null&&flowerRaster.scale!==raster.scale;
    if(flowerBase&&!rasterChanged&&flowerMaterialSignature===currentMaterialLighting.signature)return;
    if(!flowerBase){
      flowerCanvas=createAtlasSurface(raster.edge,raster.edge);
      // Logical tile frames stay in the shared 1024-unit layout; resolution maps
      // them onto the camera-matched raster. Mipmaps cover smaller poses.
      flowerBase=BaseTexture.from(flowerCanvas,{scaleMode:SCALE_MODES.LINEAR,mipmap:MIPMAP_MODES.ON,resolution:raster.scale});flowerAtlasAllocationCount++;
      for(const tile of ZEN_PLUME_FLOWER_ATLAS.tiles)flowerTextures.set(tile.id,new Texture(flowerBase,new Rectangle(tile.x,tile.y,tile.width,tile.height)));
    }else if(rasterChanged){
      // A new viewport camera changes texel density only: frames, textures and
      // sprites keep their identities on the same base texture.
      flowerCanvas.width=raster.edge;flowerCanvas.height=raster.edge;flowerBase.setRealSize(raster.edge,raster.edge,raster.scale);
    }
    flowerRaster=raster;
    paintZenCherryPlumeFlowerAtlas(createZenBotanicalMaterialContext(createZenCherryPlumeLiveRasterContext(flowerCanvas),currentMaterialLighting.mapFlowerColor),raster);flowerAtlasBakeCount++;flowerMaterialSignature=currentMaterialLighting.signature;
    // Pixi regenerates mip levels only with a style upload. Without this, a
    // moonlit rebake would keep daytime pigment in every minified level.
    flowerBase.dirtyStyleId++;flowerBase.update();flowerAtlasUploadCount++;
  }
  function syncFlowers(plan,kept){
    if(plan.flowerSprites.length)ensureFlowerMaterial(resolveZenCherryPlumeFlowerAtlasRaster(plan.camera));
    for(const [id,item]of flowers)if(!kept.has(id)){releaseCompanion(item);if(item.sprite.parent)item.sprite.parent.removeChild(item.sprite);item.sprite.destroy({texture:false,baseTexture:false});flowers.delete(id);}
    requireZenBonsaiPlumeBloomPresentationPlan(plan);
    bloomPresentationReady=false;
    for(const instance of plan.flowerSprites){
      let item=flowers.get(instance.id);
      if(!item){const sprite=new Sprite(flowerTextures.get(instance.tileId));sprite.anchor.set(.5,.5);item={sprite,instance};flowers.set(instance.id,item);flowerSpriteAllocationCount++;}
      item.instance=instance;item.bloomPresentation=null;item.sprite.texture=flowerTextures.get(instance.tileId);item.sprite.alpha=instance.alpha;
    }
    syncDisplayOrder(plan);
  }
  function prepareBloomPresentation(){
    if(!compileZenBonsaiPlumeBloomRegions(currentPlan).eligible)throw Error('ZEN_PLUME_BLOOM_REGIONS_INELIGIBLE');
    const presentation=compileZenBonsaiPlumeBloomPresentation(currentPlan);
    for(const [index,instance]of currentPlan.flowerSprites.entries())flowers.get(instance.id).bloomPresentation=presentation[index];
    bloomPresentationReady=true;
  }
  function syncDisplayOrder(plan){
    const display=[];
    for(const entry of plan.displayOrder){
      if(entry.kind==='run')display.push(sprites[entry.index].sprite);
      else{const item=flowers.get(plan.flowerSprites[entry.index].id);display.push(item.sprite);if(item.companion)display.push(item.companion.sprite);}
    }
    if(display.length!==stage.children.length||display.some((sprite,index)=>sprite!==stage.children[index])){stage.removeChildren();for(const sprite of display)stage.addChild(sprite);}
  }
  function paintRun(plan,index,packed,{clear=false}={}){
    const run=plan.runs[index],slot=packed.placements.get(index),source=contexts[slot.atlasIndex];
    if(!materialContexts.has(source))materialContexts.set(source,createZenBotanicalMaterialContext(source,currentMaterialLighting.mapWoodColor));
    const ctx=run.rigId==='static'?source:materialContexts.get(source);
    if(clear)ctx.clearRect(slot.x-2,slot.y-2,slot.capacityWidth+4,slot.capacityHeight+4);
    ctx.save();
    try{ctx.beginPath();ctx.rect(slot.x,slot.y,run.bounds.width,run.bounds.height);ctx.clip();replayZenCherryPlumeLiveRun(ctx,plan,run,{offsetX:slot.x-run.bounds.x,offsetY:slot.y-run.bounds.y});}
    finally{ctx.restore();}
  }
  // Detached studies explicitly use authored neutral pigment. Product Home
  // supplies its required world projection; no environment is inferred here.
  function setPlan(plan,{materialLighting=ZEN_BOTANICAL_NEUTRAL_MATERIAL_LIGHTING}={}){
    requireAlive();if(plan?.schema!==ZEN_CHERRY_PLUME_LIVE_COMMAND_SCHEMA||plan.width!==planWidth||plan.height!==planHeight)throw Error('ZEN_PLUME_LIVE_PIXI_PLAN_SIZE');
    const flowerIds=validateDisplay(plan);
    requireZenWorldBotanicalMaterialLighting(materialLighting);
    const materialChanged=currentMaterialLighting.signature!==materialLighting.signature;
    if(materialChanged){currentMaterialLighting=materialLighting;materialContexts=new WeakMap();}
    const started=performance.now(),compatible=canReuseZenCherryPlumeLiveSlots(currentPlan,plan,packing);
    const comparisonStarted=performance.now(),same=compatible&&!materialChanged?compareZenCherryPlumeLiveRuns(currentPlan,plan):null;
    compareMs=performance.now()-comparisonStarted;
    const packed=compatible?packing:packZenCherryPlumeLiveRuns(plan.runs);
    if(packed.atlases.length*ATLAS_EDGE*ATLAS_EDGE*4+((flowerBase||plan.flowerSprites.length)?flowerTextureBytes(resolveZenCherryPlumeFlowerAtlasRaster(plan.camera)):0)>TOTAL_TEXTURE_LIMIT)throw Error('ZEN_PLUME_LIVE_COMBINED_TEXTURE_BUDGET:64MiB');
    let painted=0,reused=0,allocated=0;const dirtyAtlases=new Set();
    try{
      if(!compatible){
        trimWoodSprites(plan.runs.length);
        // Repacking changes crop layout, not atlas identity. Keep exactly the
        // needed atlas resources; detach/rebind crops before retiring old bases.
        while(bases.length<packed.atlases.length){
          const out=createAtlasSurface(ATLAS_EDGE,ATLAS_EDGE);
          const ctx=createZenCherryPlumeLiveRasterContext(out),base=BaseTexture.from(out,{scaleMode:SCALE_MODES.LINEAR,resolution:1});
          atlasCanvases.push(out);contexts.push(ctx);bases.push(base);allocated++;
        }
        for(let index=0;index<packed.atlases.length;index++)contexts[index].clearRect(0,0,ATLAS_EDGE,ATLAS_EDGE);
      }
      for(let index=0;index<plan.runs.length;index++){
        const run=plan.runs[index],slot=packed.placements.get(index);
        if(compatible&&!materialChanged&&same[index])reused++;
        else{paintRun(plan,index,packed,{clear:compatible});painted++;dirtyAtlases.add(slot.atlasIndex);}
        let item=sprites[index],texture=textures[index];
        const base=bases[slot.atlasIndex];
        if(!texture||texture.baseTexture!==base){
          const previous=texture;texture=new Texture(base,new Rectangle(slot.x,slot.y,run.bounds.width,run.bounds.height));textures[index]=texture;woodFrameTextureAllocationCount++;
          if(item)item.sprite.texture=texture;
          if(previous)previous.destroy(false);
        }else if(texture.frame.x!==slot.x||texture.frame.y!==slot.y||texture.frame.width!==run.bounds.width||texture.frame.height!==run.bounds.height){
          texture.frame=new Rectangle(slot.x,slot.y,run.bounds.width,run.bounds.height);
        }
        if(item){item.run=run;item.basePosition[0]=run.bounds.x;item.basePosition[1]=run.bounds.y;}
        else{const sprite=new Sprite(texture);sprite.position.set(run.bounds.x,run.bounds.y);item={sprite,run,basePosition:[run.bounds.x,run.bounds.y]};sprites.push(item);spriteAllocationCount++;}
      }
      while(bases.length>packed.atlases.length){bases.pop().destroy();atlasCanvases.pop();contexts.pop();}
      // Pixi uploads dirty base textures at the next render. Upload requests
      // are per atlas, even when only one of its run crops was repainted.
      for(const index of dirtyAtlases)bases[index].update();
      syncFlowers(plan,flowerIds);
    }catch(error){release();releaseFlowerMaterial();throw error;}
    packing=packed;currentPlan=plan;surfacePending=false;setPlanCount++;paintedRuns+=painted;reusedRuns+=reused;textureAllocationCount+=allocated;textureUpdateCount+=dirtyAtlases.size;
    const kind=!compatible?'full':painted?'partial':'reuse';if(kind==='full')fullBakeCount++;else if(kind==='partial')partialBakeCount++;else reuseCount++;
    if(painted)rebakeCount++;lastUpdate={kind,paintedRuns:painted,reusedRuns:reused,updatedAtlases:dirtyAtlases.size,allocatedAtlases:allocated};
    bakeMs=performance.now()-started;return metrics();
  }
  function render({time=0,wind=0,activation=currentPlan?.presentation.activation,bloomPresentationProgress:progress=null,bloomInvitation=null}={}){
    requireAlive();if(!currentPlan||surfacePending)throw Error('ZEN_PLUME_LIVE_NO_PLAN');
    requireZenBonsaiPlumeBloomPresentationProgress(progress);requireZenBonsaiPlumeBloomInvitation(bloomInvitation);
    if(progress!==null&&!bloomPresentationReady)prepareBloomPresentation();
    bloomPresentationProgress=progress;
    let displayChanged=false;
    const transforms=resolveZenCherryPlumeLiveRigTransforms(currentPlan,{time,wind,activation});
    let updatedSprites=0,reusedSprites=0;
    for(const item of sprites){const m=transforms.get(item.run.rigId);if(!m)throw Error('ZEN_PLUME_LIVE_SPRITE_RIG');const[x,y]=item.basePosition;
      displayMatrix.set(m[0],m[1],m[2],m[3],m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]);
      if(applyZenCherryPlumeSpriteTransform(item,displayMatrix))updatedSprites++;else reusedSprites++;}
    for(const item of flowers.values()){
      const regionProgress=progress===null?null:progress[item.bloomPresentation.regionIndex],presenting=regionProgress!==null&&regionProgress<1;
      if(!presenting&&item.companion){releaseCompanion(item);displayChanged=true;}
      const a=transforms.get(item.instance.rigId),b=item.instance.matrix;if(!a)throw Error('ZEN_PLUME_LIVE_FLOWER_RIG');
      displayMatrix.set(a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]);
      if(presenting){
        resolveZenBonsaiPlumeBloomPose(item.bloomPresentation,regionProgress,bloomPose,bloomInvitation);
        item.sprite.texture=flowerTextures.get(bloomPose.firstTileId);item.sprite.alpha=item.instance.alpha*bloomPose.alphaScale*(1-bloomPose.blend);
        // A held closed bud needs one sprite. Keep a companion once admitted,
        // including pose boundaries, until the whole presentation completes.
        if(bloomPose.blend>0&&!item.companion){const sprite=new Sprite(flowerTextures.get(bloomPose.secondTileId));sprite.anchor.set(.5,.5);item.companion={sprite};bloomCompanionCount++;bloomCompanionAllocationCount++;displayChanged=true;}
        const ma=displayMatrix.a,mb=displayMatrix.b,mc=displayMatrix.c,md=displayMatrix.d;
        const companion=item.companion;
        if(companion){
          companion.sprite.texture=flowerTextures.get(bloomPose.secondTileId);companion.sprite.alpha=item.instance.alpha*bloomPose.alphaScale*bloomPose.blend;companion.sprite.visible=bloomPose.blend>0;
          displayMatrix.a=ma*bloomPose.secondScale;displayMatrix.b=mb*bloomPose.secondScale;displayMatrix.c=mc*bloomPose.secondScale;displayMatrix.d=md*bloomPose.secondScale;
          if(applyZenCherryPlumeSpriteTransform(companion,displayMatrix))updatedSprites++;else reusedSprites++;
        }
        displayMatrix.a=ma*bloomPose.firstScale;displayMatrix.b=mb*bloomPose.firstScale;displayMatrix.c=mc*bloomPose.firstScale;displayMatrix.d=md*bloomPose.firstScale;
      }else{item.sprite.texture=flowerTextures.get(item.instance.tileId);item.sprite.alpha=item.instance.alpha;}
      if(applyZenCherryPlumeSpriteTransform(item,displayMatrix))updatedSprites++;else reusedSprites++;
    }
    if(displayChanged)syncDisplayOrder(currentPlan);
    lastTransformUpdate={updatedSprites,reusedSprites};transformUpdateCount+=updatedSprites;transformReuseCount+=reusedSprites;lastMotion={time,wind,activation,scaffoldTransform:transforms.get('scaffold')};renderCount+=1;return metrics();
  }
  return {setPlan,render,metrics,extractPixels(){requireAlive();if(!currentPlan||surfacePending)throw Error('ZEN_PLUME_LIVE_NO_PLAN');return renderer.extract.pixels(stage);},
    resize({width,height,pixelRatio:nextPixelRatio=pixelRatio}){requireAlive();if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!(nextPixelRatio>0)||!Number.isFinite(nextPixelRatio))throw Error('ZEN_PLUME_LIVE_RESIZE');pixelRatio=nextPixelRatio;if(width===planWidth&&height===planHeight)return metrics();
      // A different viewport needs a new plan, not new GPU identities. setPlan
      // repacks/repaints the changed geometry and rebinds its existing resources.
      // Retained crops must never render before that new plan is admitted.
      surfacePending=true;planWidth=width;planHeight=height;return metrics();},
    dispose(){if(disposed)return metrics();release();releaseFlowerMaterial();if(stage.parent)stage.parent.removeChild(stage);stage.destroy({children:true});disposed=true;return metrics();}};
}
