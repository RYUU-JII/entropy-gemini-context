import {ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT} from './ZenBonsaiPlumeBloomPresentationContract.js';

const compiledPlans=new WeakMap(),MAX_ITERATIONS=8;
const compareId=(a,b)=>a<b?-1:a>b?1:0;
const distance=(a,b)=>(a.nx-b.nx)**2+(a.ny-b.ny)**2;
const tied=(a,b)=>Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(a),Math.abs(b));
function validMatrix(matrix){
  if(!Array.isArray(matrix)||matrix.length!==6)return false;
  for(let index=0;index<6;index++)if(!Number.isFinite(matrix[index]))return false;
  return true;
}

function nearest(point,centers){
  let selected=0,best=distance(point,centers[0]);
  for(let index=1;index<centers.length;index++){
    const next=distance(point,centers[index]);
    if(next<best&&!tied(next,best)||tied(next,best)&&compareId(centers[index].id,centers[selected].id)<0){selected=index;best=next;}
  }
  return selected;
}
function partition(points,centers){
  const groups=centers.map(()=>[]);
  for(const point of points){
    const own=centers.indexOf(point);
    groups[own===-1?nearest(point,centers):own].push(point);
  }
  return groups;
}
function medoid(group){
  const center={nx:0,ny:0};
  for(const point of group){center.nx+=point.nx;center.ny+=point.ny;}
  center.nx/=group.length;center.ny/=group.length;
  let selected=group[0],best=distance(selected,center);
  for(const point of group){const next=distance(point,center);if(next<best&&!tied(next,best)||tied(next,best)&&compareId(point.id,selected.id)<0){selected=point;best=next;}}
  return selected;
}
function unavailable(plan,reason){
  const result=Object.freeze({eligible:false,reason,regions:Object.freeze([]),regionIndices:Object.freeze([])});
  compiledPlans.set(plan,result);return result;
}

function requirePlan(plan){
  if(!plan||!Array.isArray(plan.flowerSprites))throw Error('ZEN_PLUME_BLOOM_REGIONS_PLAN');
}
function requireFlower(flower,ids){
  if(!flower||typeof flower.id!=='string'||!flower.id||ids.has(flower.id)||typeof flower.rigId!=='string'||!flower.rigId
    ||!validMatrix(flower.matrix)
    ||!Number.isFinite(flower.alpha)||flower.alpha<0||flower.alpha>1)throw Error('ZEN_PLUME_BLOOM_REGIONS_FLOWER');
  ids.add(flower.id);
}

// setPlan retains the compiler's input admission without constructing an unused
// spatial partition. A compiled identity keeps its existing validation contract.
export function requireZenBonsaiPlumeBloomRegionPlan(plan){
  if(compiledPlans.has(plan))return plan;
  requirePlan(plan);
  const ids=new Set();
  for(const flower of plan.flowerSprites)requireFlower(flower,ids);
  return plan;
}

/** One immutable, device-space partition shared by interaction and both painters. */
export function compileZenBonsaiPlumeBloomRegions(plan){
  if(compiledPlans.has(plan))return compiledPlans.get(plan);
  requirePlan(plan);
  const ids=new Set(),all=[];
  for(const [index,flower]of plan.flowerSprites.entries()){
    requireFlower(flower,ids);
    all.push({id:flower.id,rigId:flower.rigId,index,x:flower.matrix[4],y:flower.matrix[5],alpha:flower.alpha});
  }
  const points=all.filter(point=>point.alpha>0).sort((a,b)=>compareId(a.id,b.id));
  if(points.length<ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT)return unavailable(plan,'insufficient_flower_supply');
  if(new Set(points.map(point=>`${point.x}:${point.y}`)).size<ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT)
    return unavailable(plan,'insufficient_distinct_flower_positions');
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const point of points){left=Math.min(left,point.x);right=Math.max(right,point.x);top=Math.min(top,point.y);bottom=Math.max(bottom,point.y);}
  const extent=Math.max(right-left,bottom-top);
  for(const point of all){point.nx=(point.x-left)/extent;point.ny=(point.y-top)/extent;}
  // ID-first initialization and farthest-point seeds are independent of DTO order.
  let centers=[points[0]];
  while(centers.length<ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT){
    let selected=null,best=-1;
    for(const point of points){
      if(centers.includes(point))continue;
      const next=Math.min(...centers.map(center=>distance(point,center)));
      if(next>best&&!tied(next,best)||tied(next,best)&&selected!==null&&compareId(point.id,selected.id)<0){selected=point;best=next;}
    }
    centers.push(selected);
  }
  let groups;
  for(let iteration=0;iteration<MAX_ITERATIONS;iteration++){
    groups=partition(points,centers);
    const next=groups.map(medoid);
    if(next.every((point,index)=>point===centers[index]))break;
    centers=next;
  }
  groups=partition(points,centers);
  // Region IDs follow the actual medoids left-to-right, then top-to-bottom/ID.
  const clusters=groups.map(group=>({group,anchor:medoid(group)})).sort((a,b)=>a.anchor.x-b.anchor.x||a.anchor.y-b.anchor.y||compareId(a.anchor.id,b.anchor.id));
  const regionIndices=new Array(all.length),regions=[];
  for(const [regionId,{group,anchor}]of clusters.entries()){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const point of group){regionIndices[point.index]=regionId;minX=Math.min(minX,point.x);minY=Math.min(minY,point.y);maxX=Math.max(maxX,point.x);maxY=Math.max(maxY,point.y);}
    regions.push(Object.freeze({regionId,flowerId:anchor.id,rigId:anchor.rigId,x:anchor.x,y:anchor.y,bounds:Object.freeze({minX,minY,maxX,maxY})}));
  }
  // Invisible organs never host interaction; their later presentation still has an explicit region.
  const anchors=clusters.map(cluster=>cluster.anchor);
  for(const point of all)if(point.alpha===0)regionIndices[point.index]=nearest(point,anchors);
  const result=Object.freeze({eligible:true,reason:null,regions:Object.freeze(regions),regionIndices:Object.freeze(regionIndices)});
  compiledPlans.set(plan,result);return result;
}
