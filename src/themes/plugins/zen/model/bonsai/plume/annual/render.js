// Product-owned orthographic projection. Reflection is a camera presentation
// decision: it never changes source anatomy, depth ordering or positive scale.
export const ZEN_PLUME_RENDER_PROJECTION='zen-plume-rooted-orthographic-v2';

export function requireZenCherryCamera(camera){
  if(!camera||!Number.isFinite(camera.x)||!Number.isFinite(camera.y)||!Number.isFinite(camera.yaw)
    ||!Number.isFinite(camera.scale)||camera.scale<=0
    ||(camera.horizontalSign!==1&&camera.horizontalSign!==-1))throw Error('ZEN_CHERRY_RENDER_CAMERA');
  return camera;
}

export function projectZenCherryDirection(p,camera){
  if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('ZEN_CHERRY_RENDER_POINT');
  requireZenCherryCamera(camera);
  const a=camera.yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return[(p[0]*c+p[2]*s)*camera.horizontalSign,-p[1],p[2]*c-p[0]*s];
}

export function projectZenCherry(p,camera){
  const projected=projectZenCherryDirection(p,camera);
  projected[0]=camera.x+projected[0]*camera.scale;
  projected[1]=camera.y+projected[1]*camera.scale;
  return projected;
}
