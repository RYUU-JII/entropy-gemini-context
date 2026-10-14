const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const unit=value=>Number.isFinite(value)&&value>=0&&value<=1;
export const ZEN_PLUME_FLOWER_DEVELOPMENT='zen_cherry_plume_flower_development_v1';
const ID_FIELDS=['id','clusterId','budId'];
const POSE_FIELDS=['progress','scale','opening','pedicelReach','foldWidth','budOpacity','petalOpacity','alpha','swelling'];
const compiledSchedules=new WeakSet();

function sample(seed,id,salt){
  let value=2166136261;
  for(const character of `${seed}:${id}:${salt}`)value=Math.imul(value^character.charCodeAt(0),16777619);
  value^=value>>>16;return(value>>>0)/4294967296;
}

function requireFlowerIdentity(flower,ids){
  if(!flower||ID_FIELDS.some(key=>typeof flower[key]!=='string'||!flower[key])||ids.has(flower.id))throw Error('ZEN_PLUME_FLOWER_DEVELOPMENT_ID');
  ids.add(flower.id);
}
function timingFor(flower,seed,clusters,buds){
  let cluster=clusters.get(flower.clusterId);
  if(!cluster){cluster={onset:.03+.32*sample(seed,flower.clusterId,'cluster-onset'),duration:.07*sample(seed,flower.clusterId,'open-duration')};clusters.set(flower.clusterId,cluster);}
  let budLag=buds.get(flower.budId);
  if(budLag===undefined){budLag=.035*sample(seed,flower.budId,'bud-lag');buds.set(flower.budId,budLag);}
  const clusterOnset=cluster.onset,flowerLag=.035*sample(seed,flower.id,'flower-lag');
  const onset=clusterOnset+budLag+flowerLag,completion=Math.min(.98,onset+.48+cluster.duration);
  return{id:flower.id,clusterId:flower.clusterId,budId:flower.budId,clusterOnset,budLag,flowerLag,onset,completion};
}

function requireCompileInput(flowers,options){
  if(!options||Object.keys(options).join('|')!=='seed')throw Error('ZEN_PLUME_FLOWER_DEVELOPMENT_COMPILE_OPTIONS');
  const {seed}=options;
  if(!Array.isArray(flowers)||!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw Error('ZEN_PLUME_FLOWER_DEVELOPMENT_INPUT');
  return seed;
}

// Generated one-use posing keeps the original pre-history identity admission,
// including F4 flowers that the history pose later replaces. Timing is resolved
// once over the retained flowers instead of preparing an unused schedule graph.
export function requireZenGeneratedCherryPlumeFlowerDevelopmentInput(flowers,options){
  requireCompileInput(flowers,options);
  const ids=new Set();
  flowers.forEach(flower=>requireFlowerIdentity(flower,ids));
}

/** Caller-owned immutable timing only. No snapshot or global observation cache. */
export function compileZenCherryPlumeFlowerDevelopment(flowers,options){
  const seed=requireCompileInput(flowers,options);
  const ids=new Set(),clusters=new Map(),buds=new Map();
  const records=flowers.map(flower=>{requireFlowerIdentity(flower,ids);return Object.freeze(timingFor(flower,seed,clusters,buds));});
  const schedule=Object.freeze({schema:'zen_cherry_plume_flower_schedule_v1',seed,records:Object.freeze(records)});
  compiledSchedules.add(schedule);return schedule;
}

/** Local budbreak is the first .25 of the annual display clock, normalized here. */
export function resolveZenCherryPlumeFlowerDevelopment(flowers,options,compiled){
  if(!options||Object.keys(options).sort().join('|')!=='budbreakProgress|seasonalAlpha|seed')throw Error('ZEN_PLUME_FLOWER_DEVELOPMENT_OPTIONS');
  const {seed,budbreakProgress,seasonalAlpha}=options;
  if(!Array.isArray(flowers)||!Number.isInteger(seed)||seed<1||seed>0xffffffff||!unit(budbreakProgress)||!unit(seasonalAlpha))throw Error('ZEN_PLUME_FLOWER_DEVELOPMENT_INPUT');
  if(compiled!==undefined&&(!compiledSchedules.has(compiled)||compiled.seed!==seed||compiled.records.length!==flowers.length))throw Error('ZEN_PLUME_FLOWER_DEVELOPMENT_SCHEDULE');
  const ids=new Set(),clusters=compiled?null:new Map(),buds=compiled?null:new Map();
  const descriptors=flowers.map((flower,index)=>{
    requireFlowerIdentity(flower,ids);
    const timing=compiled?compiled.records[index]:timingFor(flower,seed,clusters,buds);
    if(compiled&&ID_FIELDS.some(key=>timing[key]!==flower[key]))throw Error('ZEN_PLUME_FLOWER_DEVELOPMENT_SCHEDULE_ID');
    const {onset,completion}=timing;
    if(budbreakProgress>=completion)return{...timing,progress:1,swelling:1,opening:1,scale:1,pedicelReach:1,foldWidth:1,budOpacity:0,petalOpacity:1,alpha:seasonalAlpha,stage:'full'};
    const progress=clamp((budbreakProgress-onset)/(completion-onset)),swelling=smooth(progress/.38),opening=smooth((progress-.22)/.78);
    return{...timing,progress,
      swelling,opening,scale:.28*swelling+.72*smooth((progress-.16)/.84),pedicelReach:smooth(progress/.8),
      foldWidth:.25+.75*opening,budOpacity:1-smooth((progress-.28)/.5),petalOpacity:smooth((progress-.22)/.5),
      alpha:seasonalAlpha*smooth(progress/.12),stage:progress===0?'dormant':progress<.22?'swelling':progress<1?'opening':'full'};
  });
  return{contract:ZEN_PLUME_FLOWER_DEVELOPMENT,budbreakProgress,seasonalAlpha,flowers:descriptors,
    semantics:'Display-only seeded cluster/bud onset and bounded within-cluster flower lag; swelling buds, pedicel extension, petal unfolding, then the exact selected flower endpoint. All are full by local annual time .25. Activation is a separate presentation multiplier.'};
}

/** Return a temporary paint pose; rest records and the mature endpoint stay exact. */
export function poseZenCherryPlumeDevelopingFlower(flower,development){
  if(!development||development.id!==flower.id||!POSE_FIELDS.every(key=>unit(development[key])))throw Error('ZEN_PLUME_FLOWER_DEVELOPMENT_POSE');
  if(development.progress===1)return flower;
  const start=flower.pedicel?.start,end=flower.pedicel?.end;
  for(const value of[start,end,flower.position])if(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite))throw Error('ZEN_PLUME_FLOWER_DEVELOPMENT_SUPPORT');
  const position=start.map((value,index)=>value+(flower.position[index]-value)*development.pedicelReach);
  const pedicelEnd=start.map((value,index)=>value+(end[index]-value)*development.pedicelReach);
  return{...flower,position,radius:flower.radius*development.scale,opening:flower.opening*development.opening,
    pedicel:{...flower.pedicel,start:[...start],end:pedicelEnd},pedicelLength:Math.hypot(...pedicelEnd.map((value,index)=>value-start[index]))};
}
