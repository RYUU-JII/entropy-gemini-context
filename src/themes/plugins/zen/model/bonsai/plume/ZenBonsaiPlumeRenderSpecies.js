import {requireZenBonsaiPlumeRenderPlanV1} from './ZenBonsaiPlumeRenderPlan.js';
import {replayZenCherryPlumeLive} from './live/canvas-executor.js';
import {ZEN_PLUME_FLOWER_ATLAS,paintZenCherryPlumeFlowerAtlas} from './live/flower-material.js';
import {resolveZenCherryPlumeLiveRigTransforms} from './live/motion.js';
import {resolveZenBonsaiPlumePresentation,drawZenBonsaiPlumeBack,drawZenBonsaiPlumeFront,resolveZenBonsaiPlumeMotion} from './ZenBonsaiPlumePresentation.js';
import {createZenBotanicalMaterialContext} from '../../../runtime/environment/zenWorldBotanicalMaterialLighting.js';
import {drawZenBonsaiRainCanvas} from '../../../runtime/rain/zenRainCanvas.js';

// A Canvas surface owns one bounded material; abandoning the context
// releases it. This explicit comparison renderer is not Home's recovery path.
const materials=new WeakMap();
function createSurface(ctx,width,height){
  if(typeof OffscreenCanvas==='function')return new OffscreenCanvas(width,height);
  if(ctx.canvas?.ownerDocument){const canvas=ctx.canvas.ownerDocument.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}
  throw Error('ZEN_PLUME_PRODUCT_CANVAS_MATERIAL_FACTORY');
}
function materialFor(ctx,lighting){
  let material=materials.get(ctx);
  if(material?.signature===lighting.signature)return material.canvas;
  if(!material){material={canvas:createSurface(ctx,ZEN_PLUME_FLOWER_ATLAS.width,ZEN_PLUME_FLOWER_ATLAS.height),signature:null};materials.set(ctx,material);}
  const {canvas}=material;
  const painter=canvas.getContext('2d');if(!painter)throw Error('ZEN_PLUME_PRODUCT_CANVAS_MATERIAL_CONTEXT');
  paintZenCherryPlumeFlowerAtlas(createZenBotanicalMaterialContext(painter,lighting.mapFlowerColor));material.signature=lighting.signature;return canvas;
}
export const ZenBonsaiPlumeRenderSpecies=Object.freeze({
  id:'plume',isAnimated:true,getPotDimensions:()=>({width:180,height:55,depth:45}),
  // The signed command plan (or Home garden-bed composition) owns the pot.
  renderPot(){},
  render({ctx,topology,options={},frameCount=0,wind=null,bloomPresentationProgress=null,bloomInvitation=null}={}){
    if(!ctx)throw Error('ZEN_PLUME_PRODUCT_CANVAS_CONTEXT');
    const plan=requireZenBonsaiPlumeRenderPlanV1(options.renderPlan,{topology});
    const presentation=resolveZenBonsaiPlumePresentation(plan,options),display=plan.scene.displayPlan,{viewport}=presentation;
    const transforms=resolveZenCherryPlumeLiveRigTransforms(display,{...resolveZenBonsaiPlumeMotion(frameCount,wind,options.lifeState),activation:display.presentation.activation});
    ctx.save();
    try{
      // Canvas repaints the sky every frame, so it paints the twinkle inline.
      ctx.setTransform(1,0,0,1,0,0);drawZenBonsaiPlumeBack(ctx,presentation,options,{celestial:{mode:'animated',timeSec:frameCount/60}});
      drawZenBonsaiRainCanvas(ctx,{presentation,seed:plan.source.sourceSeed,options,pixelRatio:plan.options.pixelRatio,activeTimeSec:frameCount/60});
      ctx.save();
      try{
        ctx.beginPath();ctx.rect(viewport.x,viewport.y,viewport.width,viewport.height);ctx.clip();
        replayZenCherryPlumeLive(ctx,display,{flowerAtlas:display.flowerSprites.length?materialFor(ctx,presentation.materialLighting):null,rigTransforms:transforms,offsetX:viewport.x,offsetY:viewport.y,woodColorMap:presentation.materialLighting.mapWoodColor,bloomPresentationProgress,bloomInvitation});
      }finally{ctx.restore();}
      drawZenBonsaiPlumeFront(ctx,presentation,options);
    }finally{ctx.restore();}
  },
});
export default ZenBonsaiPlumeRenderSpecies;
