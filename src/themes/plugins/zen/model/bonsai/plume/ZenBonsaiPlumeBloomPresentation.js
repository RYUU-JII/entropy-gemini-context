import {ZEN_PLUME_FLOWER_ATLAS} from './live/flower-material.js';
import {compileZenBonsaiPlumeBloomRegions,requireZenBonsaiPlumeBloomRegionPlan} from './ZenBonsaiPlumeBloomRegions.js';
import {requireZenBonsaiFirstBloomProgress,requireZenBonsaiFirstBloomMask} from './ZenBonsaiPlumeBloomPresentationContract.js';

const compiledPlans=new WeakMap();
const OPENING_STRIDE=24,SPREAD_DURATION=.72;
const REPRESENTATIVE_CLOSED_SCALE=2.4,REPRESENTATIVE_ALPHA_LIFT=.12;
const INVITATION_BREATH_MS=1500,INVITATION_ALPHA_MODULATION=.12;
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>value*value*(3-2*value);

export function requireZenBonsaiPlumeBloomPresentationProgress(progress){
  return requireZenBonsaiFirstBloomProgress(progress);
}

export function requireZenBonsaiPlumeBloomInvitation(invitation){
  if(invitation===null)return null;
  if(!invitation||typeof invitation.active!=='boolean'||!Number.isFinite(invitation.elapsedMs)||invitation.elapsedMs<0)
    throw Error('ZEN_PLUME_BLOOM_INVITATION_INVALID');
  requireZenBonsaiFirstBloomMask(invitation.activatedMask);return invitation;
}

function variation(id){
  let hash=2166136261;
  for(let index=0;index<id.length;index++)hash=Math.imul(hash^id.charCodeAt(index),16777619);
  return(hash>>>0)/4294967295;
}

function requirePlan(plan){
  if(!plan||!Array.isArray(plan.flowerSprites))throw Error('ZEN_PLUME_BLOOM_PRESENTATION_PLAN');
}
function requireFlowerTile(flower){
  if(!Number.isInteger(flower.tileId)||!ZEN_PLUME_FLOWER_ATLAS.tiles[flower.tileId])
    throw Error('ZEN_PLUME_BLOOM_PRESENTATION_FLOWER');
}

// Renderer admission stays synchronous even when no bloom animation is needed.
// The partition and per-flower delays remain owned by the demand-only compiler.
export function requireZenBonsaiPlumeBloomPresentationPlan(plan){
  if(compiledPlans.has(plan))return plan;
  requirePlan(plan);
  requireZenBonsaiPlumeBloomRegionPlan(plan);
  for(const flower of plan.flowerSprites)requireFlowerTile(flower);
  return plan;
}

/** Immutable final flower instances own identity; this cache only owns their presentation delays. */
export function compileZenBonsaiPlumeBloomPresentation(plan){
  if(compiledPlans.has(plan))return compiledPlans.get(plan);
  requirePlan(plan);
  const partition=compileZenBonsaiPlumeBloomRegions(plan);
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const flower of plan.flowerSprites){
    requireFlowerTile(flower);
    left=Math.min(left,flower.matrix[4]);right=Math.max(right,flower.matrix[4]);
    top=Math.min(top,flower.matrix[5]);bottom=Math.max(bottom,flower.matrix[5]);
  }
  const center=(left+right)/2,halfWidth=Math.max(1,(right-left)/2),height=Math.max(1,bottom-top);
  const entries=plan.flowerSprites.map((flower,index)=>{
    const finalTile=ZEN_PLUME_FLOWER_ATLAS.tiles[flower.tileId],base=flower.tileId-finalTile.opening*OPENING_STRIDE;
    const regionIndex=partition.eligible?partition.regionIndices[index]:null;
    return Object.freeze({finalTile,closedTile:ZEN_PLUME_FLOWER_ATLAS.tiles[base],regionIndex,alpha:flower.alpha,
      representative:partition.eligible&&partition.regions[regionIndex].flowerId===flower.id,
      middleTile:ZEN_PLUME_FLOWER_ATLAS.tiles[base+Math.min(1,finalTile.opening)*OPENING_STRIDE],
      delay:.16*(bottom-flower.matrix[5])/height+.06*Math.abs(flower.matrix[4]-center)/halfWidth+.035*variation(flower.id)});
  });
  Object.freeze(entries);compiledPlans.set(plan,entries);return entries;
}

/** Writes into one renderer-owned scratch pose; no frame allocates plans, tiles or anatomy. */
export function resolveZenBonsaiPlumeBloomPose(entry,progress,out,invitation=null){
  out.alphaScale=1;
  if(progress===null||progress===1){
    out.firstTileId=entry.finalTile.id;out.secondTileId=entry.finalTile.id;
    out.firstScale=1;out.secondScale=1;out.blend=0;return out;
  }
  const amount=smooth(clamp((progress-entry.delay)/SPREAD_DURATION));
  if(amount===1)return resolveZenBonsaiPlumeBloomPose(entry,1,out);
  const {closedTile,middleTile,finalTile}=entry;
  const opening=closedTile.openingAmount+(finalTile.openingAmount-closedTile.openingAmount)*amount;
  const first=opening<middleTile.openingAmount?closedTile:middleTile;
  const second=opening<middleTile.openingAmount?middleTile:finalTile;
  const span=second.openingAmount-first.openingAmount;
  out.firstTileId=first.id;out.secondTileId=second.id;
  // Compensate the discrete atlas cups, retaining one continuous projected radius.
  const closedRadius=closedTile.openingAmount/finalTile.openingAmount*finalTile.radialSpread;
  // Only the five real touch buds receive salience. Keep their enlarged closed
  // radius through selection, then grow continuously into the exact final cup.
  const heldRadius=entry.representative?Math.min(finalTile.radialSpread,closedRadius*REPRESENTATIVE_CLOSED_SCALE):closedRadius;
  const radius=entry.representative?heldRadius+(finalTile.radialSpread-heldRadius)*amount:opening/finalTile.openingAmount*finalTile.radialSpread;
  out.firstScale=radius/first.radialSpread;out.secondScale=radius/second.radialSpread;
  out.blend=span?smooth(clamp((opening-first.openingAmount)/span)):0;
  if(entry.representative){
    let alpha=Math.min(1,entry.alpha+REPRESENTATIVE_ALPHA_LIFT);
    if(progress===0&&invitation?.active===true&&!(invitation.activatedMask&(1<<entry.regionIndex))){
      const phase=(invitation.elapsedMs-entry.regionIndex*85)/INVITATION_BREATH_MS;
      if(phase>0&&phase<2)alpha=Math.min(1,alpha*(1+INVITATION_ALPHA_MODULATION*Math.sin(phase*Math.PI)**2));
    }
    // Breathing changes light, not radius, so a touch cannot suddenly shrink a
    // bud at the current invitation phase. The lift settles with its opening.
    out.alphaScale=(entry.alpha+(alpha-entry.alpha)*(1-amount))/entry.alpha;
  }
  return out;
}
