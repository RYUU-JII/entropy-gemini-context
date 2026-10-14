import {resolveZenBonsaiPlumeCameraEnvelope} from './ZenBonsaiPlumeCameraEnvelope.js';
import {ZEN_PLUME_CROWN_APPEARANCE,ZEN_PLUME_FLOWER_RADIUS_GAIN} from './ZenBonsaiPlumeCrownAppearance.js';
import {fitZenBonsaiPlumeHomeCamera,resolveZenBonsaiPlumeHomeOrientation} from './ZenBonsaiPlumeHomeFraming.js';
import {createZenBonsaiPlumeFlowerDepthRange} from './ZenBonsaiPlumeFlowerDepth.js';

export function createZenBonsaiPlumeCamera(snapshots,width,height,{includePot=true,cameraAnchor=null}={}){
  if(!Array.isArray(snapshots)||!snapshots.length||!Number.isInteger(width)||width<1||!Number.isInteger(height)||height<1)throw Error('ZEN_PLUME_PRODUCT_CAMERA_INPUT');
  const {bounds,scaffoldRadius,matureFlowers}=resolveZenBonsaiPlumeCameraEnvelope(snapshots,{includePot});
  const {minX,maxX,structuralX}=bounds;
  let camera;
  if(cameraAnchor?.framingViewport){
    if(!cameraAnchor.world||![cameraAnchor.world.x,cameraAnchor.world.y,cameraAnchor.world.z].every(Number.isFinite))throw Error('ZEN_PLUME_PRODUCT_CAMERA_ANCHOR');
    const orientation=resolveZenBonsaiPlumeHomeOrientation(snapshots,bounds,cameraAnchor.world);
    const orientedBounds=orientation.horizontalSign===1?bounds:{...bounds,minX:-maxX,maxX:-minX,structuralX:-structuralX};
    camera=fitZenBonsaiPlumeHomeCamera(orientedBounds,width,height,{includePot,cameraAnchor,orientation});
  }else camera=fitCamera(bounds,width,height,{includePot,cameraAnchor});
  if(!(scaffoldRadius>0)||!matureFlowers.length)throw Error('ZEN_PLUME_PRODUCT_CAMERA_CROWN');
  const matureFlowerRadii=matureFlowers.map(f=>f.radius).sort((a,b)=>a-b);
  const medianRestRadius=matureFlowerRadii[Math.floor(matureFlowerRadii.length/2)];
  const targetPixelRadius=Math.min(width,height)*ZEN_PLUME_FLOWER_RADIUS_GAIN.viewportRatio;
  const flowerRadiusScale=Math.max(ZEN_PLUME_FLOWER_RADIUS_GAIN.min,Math.min(ZEN_PLUME_FLOWER_RADIUS_GAIN.max,targetPixelRadius/(medianRestRadius*camera.scale)));
  // Fixed across growth/activity; scales with backing resolution, preserving CSS
  // size at every DPR. Relative size, depth, bud swelling and opening stay local.
  const flowerDepth=createZenBonsaiPlumeFlowerDepthRange(matureFlowers,camera);
  return{...camera,crown:{contract:ZEN_PLUME_CROWN_APPEARANCE,scaffoldRadius,flowerRadiusScale,medianRestRadius,targetPixelRadius,flowerDepth}};
}

function fitCamera({minX,maxX,minY,maxY,structuralX,structuralCount},width,height,{includePot,cameraAnchor}){
  const padding=Math.min(width,height)*.085;
  let scale=Math.min((width-padding*2)/(maxX-minX),(height-padding*2)/(maxY-minY)),x=width/2-(minX+maxX)/2*scale,y=height/2+(minY+maxY)/2*scale;
  if(cameraAnchor){
    const {world,viewport}=cameraAnchor;
    if(!world||!viewport||![world.x,world.y,world.z,viewport.x,viewport.y].every(Number.isFinite))throw Error('ZEN_PLUME_PRODUCT_CAMERA_ANCHOR');
    const above=Math.max(1,maxY-world.y),below=Math.max(0,world.y-minY);
    const limits=[(viewport.y-padding)/above,(width-padding*2)/(maxX-minX)];
    if(includePot&&below>0)limits.push((height-viewport.y-padding)/below);
    scale=Math.min(scale,...limits);
    if(!(scale>0))throw Error('ZEN_PLUME_PRODUCT_CAMERA_FIT');
    let rootScreenX=viewport.x;
    x=rootScreenX-world.x*scale;y=viewport.y+world.y*scale;
    const composition=cameraAnchor.horizontalComposition;
    if(composition){
      if(!structuralCount)throw Error('ZEN_PLUME_PRODUCT_CAMERA_STRUCTURE');
      const center=structuralX/structuralCount;
      const shift=composition.targetViewportX-(x+center*scale),maximum=composition.maximumRootShiftPx;
      if(!Number.isFinite(shift)||!Number.isFinite(maximum)||maximum<0)throw Error('ZEN_PLUME_PRODUCT_CAMERA_COMPOSITION');
      rootScreenX+=Math.max(-maximum,Math.min(maximum,shift));
    }
    // The rooted camera can be off-center; constrain each side around the
    // chosen root separately so a leaning crown remains inside the viewport.
    const left=world.x-minX,right=maxX-world.x;
    if(left>0)scale=Math.min(scale,(rootScreenX-padding)/left);
    if(right>0)scale=Math.min(scale,(width-padding-rootScreenX)/right);
    if(!(scale>0))throw Error('ZEN_PLUME_PRODUCT_CAMERA_FIT');
    x=rootScreenX-world.x*scale;y=viewport.y+world.y*scale;
  }
  return{width,height,yaw:0,horizontalSign:1,scale,x,y,bounds:{minX,maxX,minY,maxY},familyId:'all'};
}
