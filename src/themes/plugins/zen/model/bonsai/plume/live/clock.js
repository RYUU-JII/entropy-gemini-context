export const CHERRY_PLUME_LIVE_CLOCK='zen_cherry_plume_live_clock_v2';
export const CHERRY_PLUME_LIVE_F4_SHARE=.62;
export const CHERRY_PLUME_LIVE_CYCLE_SPAN=1.75;
export const clamp=value=>Math.max(0,Math.min(1,value));
export const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
// Recorded anatomy phases inside one growth curve, independent of calendar time.
const phases=['spring','summer','winter'];
export function resolveZenCherryPlumeLiveClock({growth=1,activation=1,year=3,phase='spring',stage=.45}={}){
  for(const[key,value]of Object.entries({growth,activation,stage}))
    if(!Number.isFinite(value)||value<0||value>1)throw Error(`ZEN_CHERRY_PLUME_LIVE_${key.toUpperCase()}`);
  if(!Number.isInteger(year)||year<1||year>3||!phases.includes(phase))throw Error('ZEN_CHERRY_PLUME_LIVE_SEASON');
  const targetBase=1+(year-1)*CHERRY_PLUME_LIVE_CYCLE_SPAN;
  const targetLocalTime=phase==='spring'?.25+stage:phase==='summer'?1.5:1.75;
  const annualTarget=targetBase+targetLocalTime;
  const f4Progress=clamp(growth/CHERRY_PLUME_LIVE_F4_SHARE);
  const annualProgress=clamp((growth-CHERRY_PLUME_LIVE_F4_SHARE)/(1-CHERRY_PLUME_LIVE_F4_SHARE));
  const annualTime=annualProgress*annualTarget;
  let mode='f4',observedYear=1,observedPhase='spring',observedStage=0,observedLocalTime=0,flowerPresence=0,foundationProgress=0;
  if(growth>=CHERRY_PLUME_LIVE_F4_SHARE){
    if(annualTime<1){mode='foundation';foundationProgress=annualTime;}
    else{
      foundationProgress=1;
      const offset=annualTime-1;
      observedYear=Math.min(3,Math.floor(offset/CHERRY_PLUME_LIVE_CYCLE_SPAN)+1);
      const local=offset-(observedYear-1)*CHERRY_PLUME_LIVE_CYCLE_SPAN;
      observedLocalTime=local;
      if(local<.25){mode='budbreak';flowerPresence=smooth(local/.25);}
      else if(local<=1.25){mode='spring';observedStage=clamp(local-.25);flowerPresence=1;}
      else if(local<1.5){mode='summer-transition';observedStage=1;flowerPresence=1-smooth((local-1.25)/.25);}
      else {mode=local<1.625?'summer':'winter';observedPhase=mode;observedStage=1;}
    }
  }
  // Selected seasonal endpoints remain exact observations, including stage zero.
  if(growth===1){mode=phase;observedYear=year;observedPhase=phase;observedStage=phase==='spring'?stage:1;observedLocalTime=targetLocalTime;flowerPresence=phase==='spring'?1:0;foundationProgress=1;}
  return{contract:CHERRY_PLUME_LIVE_CLOCK,growth,activation,target:{year,phase,stage},f4Progress,annualProgress,annualTarget,annualTime,
    mode,observedYear,observedPhase,observedStage,observedLocalTime,targetLocalTime,flowerPresence,foundationProgress,
    semantics:'Detached presentation clock: full F4 event history, registered annual foundation, then budbreak/spring/summer/winter observations. Abstract durations are not years, cultivation days or the product seven-day release policy.'};
}
