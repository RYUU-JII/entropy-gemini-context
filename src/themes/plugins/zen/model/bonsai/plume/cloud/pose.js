import {createZenCherryBloomSnapshot,createZenGeneratedCherryBloomCameraSnapshot} from '../bloom/model.js';

export const CHERRY_CLOUD_POSE_ID='zen_cherry_cloud_pose_v1';

// The inherited spring reveal operates on both the original annual plan and the
// new registered annual shoots. Space/size choices never add anatomical organs.
export function createZenCherryCloudSnapshot(snapshot,{seed,flowerScale=5,spread=2.6,stage=.45}) {
  if(!Number.isFinite(flowerScale)||flowerScale<1||flowerScale>6
    ||!Number.isFinite(spread)||spread<1||spread>3.2)throw Error('ZEN_CHERRY_CLOUD_POSE_INPUT');
  const posed=createZenCherryBloomSnapshot(snapshot,{seed,variant:'living',flowerScale:4,stage});
  poseCloudFlowers(posed,flowerScale,spread);
  posed.bloom.flowerScale=posed.bloom.active?flowerScale:1;
  posed.bloom.requestedFlowerScale=flowerScale;
  posed.cloudPose={modelId:CHERRY_CLOUD_POSE_ID,seed,flowerScale:posed.bloom.flowerScale,
    requestedFlowerScale:flowerScale,spread:posed.bloom.active?spread:1,requestedSpread:spread,stage:posed.bloom.stage,
    semantics:'Radius and support-to-center world-space displacement are independent observation controls. Flower IDs/sites/count and wood are unchanged by pose; bloom referenceCounts include any separately initialized cloud organs.'};
  return posed;
}

// Fixed generated mature-camera seam; no public pose option changes its scope.
export function createZenGeneratedCherryCloudCameraSnapshot(snapshot,{seed}) {
  const posed=createZenGeneratedCherryBloomCameraSnapshot(snapshot,{seed});
  poseCloudFlowers(posed,5,2.6);
  return posed;
}

function poseCloudFlowers(posed,flowerScale,spread) {
  for(const flower of posed.flowers){
    flower.radius=flower.referenceRadius*flowerScale;
    flower.position=flower.pedicel.start.map((value,index)=>value+(flower.position[index]-value)*spread);
    flower.pedicel.end=[...flower.position];
    flower.pedicelLength=Math.hypot(...flower.position.map((value,index)=>value-flower.pedicel.start[index]));
  }
}

export function createZenCherryCloudControl(snapshot,{seed,comparison='expanded',stage=.45}) {
  if(comparison==='reference')return snapshot;
  if(comparison==='bloom')return createZenCherryBloomSnapshot(snapshot,{seed,variant:'living',flowerScale:4,stage});
  if(comparison==='expanded')return createZenCherryCloudSnapshot(snapshot,{seed,flowerScale:5,spread:2.6,stage});
  throw Error('ZEN_CHERRY_CLOUD_COMPARISON');
}
