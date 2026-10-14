import {resolveZenHomeGardenBedDeviceMesh,resolveZenHomeGardenBedMaterialPreset,resolveZenHomeGardenBedCanopyViewport} from '../rendering/zenHomeGardenBedGeometry.js';
import {drawZenHomeGardenBedBackLayer,drawZenHomeGardenBedContactShadow,drawZenHomeGardenBedFrontLayer} from '../rendering/zenHomeGardenBedRenderer.js';
import {drawZenBonsaiOpenAirBackdrop} from '../rendering/zenBonsaiOpenAirBackdrop.js';
import {resolveZenSkyStarField,resolveZenSkyStarLight,resolveZenSkyStarAlpha,requireZenSkyCelestialOwnership} from '../rendering/zenBonsaiNightSky.js';
import {resolveZenSkyMoon} from '../rendering/zenBonsaiSkyMoon.js';
import {resolveZenBonsaiInkTint,tintZenBonsaiPalette} from '../rendering/zenBonsaiInkTint.js';
import {resolveZenBonsaiPresentationStyle} from '../rendering/zenBonsaiPresentationStyle.js';
import {resolveZenPotRenderModel} from '../../ZenPotRenderer.js';
import {resolveSakuraRenderLighting} from '../../sakura/sakuraRenderLighting.js';
import {normalizeSakuraBranchWindState,resolveSakuraLifeWindResponse} from '../../sakura/sakuraBranchMotionModel.js';
import {resolveZenHomeFrameSeamPalette,drawZenHomeFrameSeamBack,drawZenHomeFrameSeamFront} from '../rendering/zenHomeFrameSeamRenderer.js';
import {resolveZenHomeSkyPlane} from '../rendering/zenHomeFrameSeamGeometry.js';
import {resolveZenWorldBotanicalMaterialLighting} from '../../../runtime/environment/zenWorldBotanicalMaterialLighting.js';
import {resolveZenWorldMaterialPaintSignature} from '../../../runtime/environment/zenWorldMaterialPalette.js';

export function resolveZenBonsaiPlumePresentation(plan,options={}){
  const geometry=options.homeGardenBedProjection?resolveZenHomeGardenBedDeviceMesh({projection:options.homeGardenBedProjection}):null;
  const style=resolveZenBonsaiPresentationStyle(options.presentationStyle);
  const tint=resolveZenBonsaiInkTint({environmentState:options.environmentState,presentationStyle:style.id});
  const materialLighting=resolveZenWorldBotanicalMaterialLighting(options.environmentState);
  const materialStyle=geometry?(options.gardenBedMaterialStyle||resolveZenPotRenderModel({width:180,height:55,type:options.potStyleOverride}).materialStyle):null;
  const palette=geometry?(geometry.support==='frame-seam'?resolveZenHomeFrameSeamPalette(options.environmentState,tint.mapSurfaceColor):tintZenBonsaiPalette(resolveZenHomeGardenBedMaterialPreset(materialStyle).palette,tint.mapSurfaceColor)):null;
  const viewport=geometry?resolveZenHomeGardenBedCanopyViewport(geometry):{x:0,y:0,width:plan.surface.pixelWidth,height:plan.surface.pixelHeight};
  const rearPlane=geometry?.support==='frame-seam'?resolveZenHomeSkyPlane(geometry):null;
  const rearLeft=rearPlane?Math.min(...rearPlane.map(point=>point.x)):0;
  const backdropViewport=rearPlane?{x:rearLeft,y:0,width:geometry.viewportWidth-rearLeft,height:geometry.viewportHeight}:geometry?geometry.sceneViewport:viewport;
  if(viewport.width!==plan.surface.pixelWidth||viewport.height!==plan.surface.pixelHeight)throw Error('ZEN_PLUME_PRODUCT_VIEWPORT_MISMATCH');
  const plantingAnchor=geometry?{x:geometry.plantingAnchor.x-backdropViewport.x,y:geometry.plantingAnchor.y-backdropViewport.y}:{x:plan.scene.camera.x,y:plan.scene.camera.y};
  const seed=`plume:${plan.source.seed}:${plan.source.sourceSeed}`;
  const root=geometry?{x:plan.scene.camera.x+viewport.x,y:plan.scene.camera.y+viewport.y}:null;
  const pixelRatio=plan.options.pixelRatio;
  return{geometry,viewport,backdropViewport,rearPlane,materialStyle,palette,plantingAnchor,seed,root,materialLighting,pixelRatio,
    signature:JSON.stringify({geometry,materialStyle,palette,plantingAnchor,seed,root,backdrop:options.renderBackdrop!==false,mode:options.renderMode,skipPot:options.skipPot,environment:resolveZenWorldMaterialPaintSignature(options.environmentState)})};
}
// The baked back layer either owns the twinkling stars and the moon
// (`rest`/`animated`) or leaves them to the renderer's per-frame layers (`omit`).
export function drawZenBonsaiPlumeBack(ctx,presentation,options,{celestial}={}){
  requireZenSkyCelestialOwnership(celestial);
  const {geometry,backdropViewport,rearPlane,plantingAnchor,seed,palette,materialStyle,root,pixelRatio}=presentation;
  if(geometry?.support==='frame-seam'){
    if(options.renderBackdrop!==false&&options.renderMode!=='trunk_sandbox'){
      // The sky uses Home's fixed boundary, independent of the moving tree.
      // The existing back layer leaves pondward canopy space transparent.
      ctx.save();
      try{
        ctx.beginPath();ctx.moveTo(rearPlane[0].x,rearPlane[0].y);
        for(const point of rearPlane.slice(1))ctx.lineTo(point.x,point.y);
        ctx.closePath();ctx.clip();
        drawZenBonsaiOpenAirBackdrop(ctx,{environmentState:options.environmentState,
          sceneViewport:backdropViewport,seed,pixelRatio,celestial});
      }finally{ctx.restore();}
    }
    if(options.skipPot!==true)drawZenHomeFrameSeamBack(ctx,geometry,palette,root);
    return;
  }
  if(options.renderBackdrop!==false&&options.renderMode!=='trunk_sandbox')drawZenBonsaiOpenAirBackdrop(ctx,{environmentState:options.environmentState,lifeState:options.lifeState,sceneViewport:geometry?backdropViewport:null,plantingAnchor,seed,pixelRatio,celestial});
  if(geometry&&options.skipPot!==true){drawZenHomeGardenBedBackLayer(ctx,{geometry,palette,materialStyle});drawZenHomeGardenBedContactShadow(ctx,{geometry,lighting:resolveSakuraRenderLighting(options.environmentState)});}
}
function insidePolygon(points,x,y){
  let inside=false;
  for(let index=0,previous=points.length-1;index<points.length;previous=index++){
    const a=points[index],b=points[previous];
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
/**
 * The twinkling stars a per-frame layer draws over a back layer baked with
 * `omit`: device positions, rest alpha and twinkle phase, already clipped to
 * the same sky boundary. Empty without a backdrop, by day or under cloud.
 */
const resolveSky=({geometry,backdropViewport,viewport})=>geometry?backdropViewport:{x:0,y:0,width:viewport.width,height:viewport.height};
const hasSky=options=>options.renderBackdrop!==false&&options.renderMode!=='trunk_sandbox';
/** The polygon the sky is painted inside, for layers drawn over it. */
export function resolveZenBonsaiPlumeSkyClip(presentation){
  if(presentation.rearPlane)return presentation.rearPlane;
  const {x,y,width,height}=resolveSky(presentation);
  return Object.freeze([{x,y},{x:x+width,y},{x:x+width,y:y+height},{x,y:y+height}]);
}
/**
 * The moon a per-frame layer draws over a back layer baked with `omit`, in
 * device pixels; null without a backdrop or while the moon is not visible.
 */
export function resolveZenBonsaiPlumeMoon(presentation,options){
  if(!hasSky(options))return null;
  const sky=resolveSky(presentation),moon=resolveZenSkyMoon(options.environmentState,sky,presentation.pixelRatio);
  return moon?Object.freeze({moon,x:sky.x+moon.x,y:sky.y+moon.y}):null;
}
export function resolveZenBonsaiPlumeTwinklingStars(presentation,options){
  const {rearPlane,pixelRatio}=presentation;
  if(!hasSky(options))return Object.freeze([]);
  const sky=resolveSky(presentation);
  const light=resolveZenSkyStarLight(options.environmentState),stars=[];
  for(const star of resolveZenSkyStarField(sky,pixelRatio)){
    if(!star.twinkles)continue;
    const alpha=resolveZenSkyStarAlpha(star,light),x=sky.x+star.x,y=sky.y+star.y;
    if(alpha<.01||(rearPlane&&!insidePolygon(rearPlane,x,y)))continue;
    stars.push(Object.freeze({star,x,y,alpha}));
  }
  return Object.freeze(stars);
}
export function drawZenBonsaiPlumeFront(ctx,{geometry,palette,materialStyle},options){
  if(geometry?.support==='frame-seam'){
    if(options.skipPot!==true)drawZenHomeFrameSeamFront(ctx,geometry,palette);
    return;
  }
  if(geometry&&options.skipPot!==true)drawZenHomeGardenBedFrontLayer(ctx,{geometry,palette,materialStyle});
}
export function resolveZenBonsaiPlumeMotion(frameCount,wind,lifeState){
  const normalized=normalizeSakuraBranchWindState(wind);
  return{time:Math.max(0,Number(frameCount)||0)/60,wind:Math.max(0,Math.min(1,normalized.intensity*resolveSakuraLifeWindResponse(lifeState)))};
}
