const unit=value=>Number.isFinite(value)&&value>=0&&value<=1;
const SWAY_PRIMARY_AMPLITUDE = .004;
const SWAY_SECONDARY_AMPLITUDE = .0015;
const MAXIMUM_WIND_RESPONSE = 2;
export const ZEN_PLUME_MAXIMUM_SWAY_ANGLE_RAD = MAXIMUM_WIND_RESPONSE * (SWAY_PRIMARY_AMPLITUDE + SWAY_SECONDARY_AMPLITUDE);
// Pure matrices shared by Canvas diagnostics and the Pixi display. This first
// bridge uses one whole-tree root pose. Family pivots/supports are retained but
// independent bending is explicitly absent; every organ remains welded.
export function resolveZenCherryPlumeLiveRigTransforms(plan,{time=0,wind=0,activation=plan.presentation.activation}={}){
  if(!Number.isFinite(time)||!unit(wind)||!unit(activation))throw Error('ZEN_PLUME_LIVE_MOTION_INPUT');
  const rigs=new Map(plan.rigs.map(rig=>[rig.id,rig]));
  const root=rigs.get('scaffold');if(!root)throw Error('ZEN_PLUME_LIVE_MOTION_ROOT');
  const response=plan.presentation.windResponse;
  if(!Number.isFinite(response)||response<0||response>MAXIMUM_WIND_RESPONSE)throw Error('ZEN_PLUME_LIVE_WIND_RESPONSE');
  const rootAngle=wind*response*(.7+.3*activation)*(Math.sin(time*.77)*SWAY_PRIMARY_AMPLITUDE+Math.sin(time*1.41+.8)*SWAY_SECONDARY_AMPLITUDE);
  const c=Math.cos(rootAngle),s=Math.sin(rootAngle),[rx,ry]=root.pivot;
  const rootMatrix=[c,s,-s,c,rx-c*rx+s*ry,ry-s*rx-c*ry];
  const output=new Map([['static',[1,0,0,1,0,0]],['scaffold',rootMatrix]]);
  for(const rig of plan.rigs){
    if(rig.kind!=='family')continue;
    if(rig.parentId!=='scaffold')throw Error('ZEN_PLUME_LIVE_RIG_PARENT');
    output.set(rig.id,[...rootMatrix]);
  }
  return output;
}

