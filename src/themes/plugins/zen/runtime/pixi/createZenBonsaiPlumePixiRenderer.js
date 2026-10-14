import {Renderer,Container,Geometry,Graphics,Mesh,Shader,Sprite,Texture,BaseTexture,SCALE_MODES,MIPMAP_MODES} from '../worker/zenPixiWorkerRuntime.js';
import {createZenCherryPlumeLivePixiRenderer} from '../../model/bonsai/plume/live/pixi-renderer.js';
import {requireZenBonsaiPlumeRenderPlanV1} from '../../model/bonsai/plume/ZenBonsaiPlumeRenderPlan.js';
import {resolveZenBonsaiPlumePresentation,drawZenBonsaiPlumeBack,drawZenBonsaiPlumeFront,resolveZenBonsaiPlumeMotion,resolveZenBonsaiPlumeTwinklingStars,resolveZenBonsaiPlumeMoon,resolveZenBonsaiPlumeSkyClip} from '../../model/bonsai/plume/ZenBonsaiPlumePresentation.js';
import {ZEN_BONSAI_WORKER_RENDER_BACKENDS,resolveZenBonsaiWorkerRendererLabel} from '../worker/zenBonsaiWorkerProtocol.js';
import {ZEN_RENDERER_WORK_JOURNAL_ENABLED} from '../worker/zenRendererWorkJournal.js';
import {createZenRainPixiMesh} from '../rain/createZenRainPixiMesh.js';
import {resolveZenBonsaiRainInputs} from '../rain/zenRainStreakRuntime.js';
import {createZenSkyTwinklePixiLayer} from './createZenSkyTwinklePixiLayer.js';
import {createZenSkyMoonPixiLayer} from './createZenSkyMoonPixiLayer.js';

const rendererName=resolveZenBonsaiWorkerRendererLabel(ZEN_BONSAI_WORKER_RENDER_BACKENDS.PIXI_PLUME);
const rainPixi=Object.freeze({Container,Geometry,Mesh,Shader});
function surface(width,height){if(typeof OffscreenCanvas!=='function')throw Error('ZEN_PLUME_PRODUCT_OFFSCREEN_REQUIRED');return new OffscreenCanvas(width,height);}
export function createZenBonsaiPlumePixiRenderer({canvas}={}){
  if(!canvas)throw Error('ZEN_PLUME_PRODUCT_CANVAS_REQUIRED');
  const renderer=new Renderer({view:canvas,width:canvas.width,height:canvas.height,resolution:1,antialias:false,backgroundAlpha:0,clearBeforeRender:true,autoDensity:false,zenPondSpriteBatchDialect:true,zenPondTilingSpriteDialect:true});
  const root=new Container(),back=new Container(),tree=new Container(),front=new Container(),mask=new Graphics();
  root.addChild(back,tree,front,mask);tree.mask=mask;
  let rain,stars,moon;
  let compositor;
  // Root order: baked back, twinkling stars, moon, rain, tree, front.
  const skyPixi={Container,Sprite,Texture,BaseTexture,Graphics,SCALE_MODES,MIPMAP_MODES};
  try{stars=createZenSkyTwinklePixiLayer({pixi:skyPixi,parent:root,insertIndex:1,createSurface:surface});moon=createZenSkyMoonPixiLayer({pixi:skyPixi,parent:root,insertIndex:2,createSurface:surface});rain=createZenRainPixiMesh({pixi:rainPixi,renderer,parent:root,insertIndex:3});compositor=createZenCherryPlumeLivePixiRenderer({canvas,renderer,container:tree});}catch(error){rain?.dispose();moon?.dispose();stars?.dispose();root.destroy({children:true});renderer.destroy(false);throw error;}
  let dimensions={pixelWidth:canvas.width,pixelHeight:canvas.height,pixelRatio:1},displaySignature=null,materialSignature=null,compositionSignature=null,moonEnvironment=null,disposed=false;
  let decorationTextures=[];
  const releaseComposition=()=>{stars.sync([]);moon.sync(null);moonEnvironment=null;back.removeChildren().forEach(sprite=>sprite.destroy({texture:false,baseTexture:false}));front.removeChildren().forEach(sprite=>sprite.destroy({texture:false,baseTexture:false}));for(const texture of decorationTextures)texture.destroy(true);decorationTextures=[];compositionSignature=null;};
  function bakeComposition(presentation,options,reportDiagnostics){
    const paintTiming=reportDiagnostics?{}:null;
    releaseComposition();
    try{for(const [container,paint]of [[back,drawZenBonsaiPlumeBack],[front,drawZenBonsaiPlumeFront]]){
      const out=surface(dimensions.pixelWidth,dimensions.pixelHeight),ctx=out.getContext('2d');
      if(!ctx)throw Error('ZEN_PLUME_PRODUCT_COMPOSITION_CONTEXT');
      const paintStarted=reportDiagnostics?performance.now():null;
      // The baked sky leaves its twinkling stars and moon to the per-frame layers.
      paint(ctx,presentation,options,{celestial:{mode:'omit'}});
      if(reportDiagnostics)paintTiming[container===back?'compositionBackPaintMs':'compositionFrontPaintMs']=performance.now()-paintStarted;
      const texture=new Texture(new BaseTexture(out,{resolution:1,scaleMode:SCALE_MODES.LINEAR,mipmap:MIPMAP_MODES.OFF}));decorationTextures.push(texture);container.addChild(new Sprite(texture));
    }
    stars.sync(resolveZenBonsaiPlumeTwinklingStars(presentation,options));
    moon.setClip(resolveZenBonsaiPlumeSkyClip(presentation));
    }catch(error){releaseComposition();throw error;}
    const {viewport}=presentation;tree.position.set(viewport.x,viewport.y);mask.clear();mask.beginFill(0xffffff);mask.drawRect(viewport.x,viewport.y,viewport.width,viewport.height);mask.endFill();compositionSignature=presentation.signature;
    return paintTiming;
  }
  function resize(next){
    if(disposed)throw Error('ZEN_PLUME_PRODUCT_RENDERER_DISPOSED');
    if(!next||![next.pixelWidth,next.pixelHeight].every(value=>Number.isInteger(value)&&value>0)||!Number.isFinite(next.pixelRatio)||next.pixelRatio<=0)throw Error('ZEN_PLUME_PRODUCT_RENDERER_SIZE');
    const changed=next.pixelWidth!==dimensions.pixelWidth||next.pixelHeight!==dimensions.pixelHeight;
    dimensions={pixelWidth:next.pixelWidth,pixelHeight:next.pixelHeight,pixelRatio:next.pixelRatio};
    if(changed){renderer.resize(dimensions.pixelWidth,dimensions.pixelHeight);releaseComposition();displaySignature=null;materialSignature=null;}
  }
  function render({scene,frameCount=0,windState=null,includeReportDiagnostics=false,bloomPresentationProgress=null,bloomInvitation=null}={}){
    if(disposed)throw Error('ZEN_PLUME_PRODUCT_RENDERER_DISPOSED');
    if(!scene?.topology)throw Error('ZEN_PLUME_PRODUCT_SCENE_REQUIRED');
    if(!scene.renderOptions||typeof scene.renderOptions!=='object'||Array.isArray(scene.renderOptions))throw Error('ZEN_PLUME_PRODUCT_RENDER_OPTIONS_REQUIRED');
    const reportDiagnostics=ZEN_RENDERER_WORK_JOURNAL_ENABLED&&includeReportDiagnostics===true;
    const started=performance.now(),plan=requireZenBonsaiPlumeRenderPlanV1(scene.renderPlan,{topology:scene.topology}),options=scene.renderOptions;
    const validatedAt=reportDiagnostics?performance.now():null;
    const presentation=resolveZenBonsaiPlumePresentation(plan,options);
    rain.container.scale.set(dimensions.pixelRatio);
    rain.setInputs(resolveZenBonsaiRainInputs({presentation,seed:plan.source.sourceSeed,options,...dimensions}));
    const presentationAt=reportDiagnostics?performance.now():null;
    const compositionChanged=compositionSignature!==presentation.signature;
    const compositionPaintTiming=compositionChanged?bakeComposition(presentation,options,reportDiagnostics):null;
    // The moon moves with each environment sample, between rebakes.
    if(moonEnvironment!==options.environmentState){moon.sync(resolveZenBonsaiPlumeMoon(presentation,options));moonEnvironment=options.environmentState;}
    const compositionAt=reportDiagnostics?performance.now():null;
    const changed=displaySignature!==plan.signature;
    const treeSetPlanApplied=changed||materialSignature!==presentation.materialLighting.signature;
    if(treeSetPlanApplied){compositor.resize({width:plan.surface.pixelWidth,height:plan.surface.pixelHeight,pixelRatio:plan.options.pixelRatio});compositor.setPlan(plan.scene.displayPlan,{materialLighting:presentation.materialLighting});displaySignature=plan.signature;materialSignature=presentation.materialLighting.signature;}
    const baked=performance.now();
    const treeMetrics=compositor.render({...resolveZenBonsaiPlumeMotion(frameCount,windState,options.lifeState),activation:plan.scene.displayPlan.presentation.activation,bloomPresentationProgress,bloomInvitation});
    rain.update(frameCount/60);stars.update(frameCount/60);
    const motionAt=reportDiagnostics?performance.now():null;
    renderer.render(root);const ended=performance.now();
    const compositionTextureBytes=decorationTextures.length*dimensions.pixelWidth*dimensions.pixelHeight*4;
    return{renderer:rendererName,rendered:true,staticLayersRebaked:compositionChanged,branchRig:{rebuilt:changed,ready:true,records:treeMetrics.spriteCount},treeMetrics,
      compositionTextureBytes,totalTextureBytes:treeMetrics.textureBytes+compositionTextureBytes,
      timing:{bakeMs:baked-started,drawMs:ended-baked,totalMs:ended-started,
        ...(reportDiagnostics?{planValidationMs:validatedAt-started,presentationResolveMs:presentationAt-validatedAt,
          compositionBakeMs:compositionChanged?compositionAt-presentationAt:0,treeSetPlanMs:treeSetPlanApplied?baked-compositionAt:0,
          compositionBackPaintMs:compositionChanged?compositionPaintTiming.compositionBackPaintMs:0,
          compositionFrontPaintMs:compositionChanged?compositionPaintTiming.compositionFrontPaintMs:0,
          treeMotionMs:motionAt-baked,pixiDrawMs:ended-motionAt}:{})},
      ...(reportDiagnostics?{rainStreaks:rain.receipt(),skyTwinkle:stars.receipt(),skyMoon:moon.receipt(),reportDiagnostics:{rendererTreeSetPlanApplied:Number(treeSetPlanApplied),
        rendererTreeFullBakeCount:treeMetrics.fullBakeCount,rendererTreePartialBakeCount:treeMetrics.partialBakeCount,
        rendererTreeReuseCount:treeMetrics.reuseCount,rendererTreeFlowerAtlasBakeCount:treeMetrics.flowerAtlasBakeCount,
        rendererTreePaintedRuns:treeSetPlanApplied?treeMetrics.lastUpdate.paintedRuns:0,
        rendererTreeReusedRuns:treeSetPlanApplied?treeMetrics.lastUpdate.reusedRuns:0,
        rendererTreeUpdatedAtlases:treeSetPlanApplied?treeMetrics.lastUpdate.updatedAtlases:0}}:{})};
  }
  function dispose(){if(disposed)return;disposed=true;try{rain.dispose();releaseComposition();stars.dispose();moon.dispose();compositor.dispose();root.destroy({children:true});}finally{renderer.destroy(false);}}
  return{renderer:rendererName,resize,render,dispose};
}
