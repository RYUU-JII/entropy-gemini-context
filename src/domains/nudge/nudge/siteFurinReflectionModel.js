export function requireSiteFurinReflection(value) {
  if (!value || value.schemaVersion!==1 || typeof value.hostname!=='string'
    || !['complete','partial','unavailable'].includes(value.coverage)
    || !['activeMs','targetMs','representedMs'].every(key=>Number.isFinite(value[key]) && value[key]>=0)
    || !Array.isArray(value.segments) || value.segments.length>768) throw new Error('SITE_FURIN_REFLECTION_INVALID');
  const unmeasuredClock = value.cycleStartAt === null && value.observedAt === null
    && value.coverage === 'unavailable' && value.segments.length === 0;
  if (!unmeasuredClock && (!Number.isFinite(value.cycleStartAt) || value.cycleStartAt < 0
    || !Number.isFinite(value.observedAt) || value.observedAt < value.cycleStartAt)) {
    throw new Error('SITE_FURIN_REFLECTION_CLOCK_INVALID');
  }
  let end=-1, sum=0;
  for (const pair of value.segments) {
    if (!Array.isArray(pair) || pair.length!==2 || !pair.every(Number.isFinite)
      || pair[0]<end || pair[1]<=pair[0] || pair[0]<value.cycleStartAt || pair[1]>value.observedAt) throw new Error('SITE_FURIN_REFLECTION_SEGMENT_INVALID');
    end=pair[1]; sum+=pair[1]-pair[0];
  }
  if (Math.abs(sum-value.representedMs)>1 || sum>value.activeMs+1
    || (value.coverage==='complete' && Math.abs(sum-value.activeMs)>1)
    || (value.coverage==='unavailable' && value.segments.length!==0)) throw new Error('SITE_FURIN_REFLECTION_COVERAGE_INVALID');
  return { ...value, segments:value.segments.map(pair=>[...pair]) };
}

export function buildSiteFurinTimelineGeometry(data, progress) {
  const firstAt=data.segments[0]?.[0];
  const elapsed=firstAt===undefined ? 1 : Math.max(1,data.observedAt-firstAt);
  const finalScale=Math.max(1,data.activeMs,data.targetMs);
  const fold=Math.min(1,progress/0.65), expand=Math.max(0,(progress-0.65)/0.35);
  const scale=1/elapsed*(1-expand)+1/finalScale*expand;
  let consumed=0;
  const rectangles=data.segments.map(([a,b])=>{
    const original=(a-firstAt)/elapsed;
    const joined=(elapsed-data.activeMs)/2/elapsed+consumed/elapsed;
    const initial=original*(1-fold)+joined*fold;
    const final=consumed/finalScale;
    consumed+=b-a;
    return { x:1000*(initial*(1-expand)+final*expand), width:1000*(b-a)*scale };
  });
  const unknownMs=Math.max(0,data.activeMs-data.representedMs);
  return { rectangles, goalX:1000*data.targetMs/finalScale,
    unknown: { x:1000*consumed/finalScale,width:1000*unknownMs/finalScale } };
}
