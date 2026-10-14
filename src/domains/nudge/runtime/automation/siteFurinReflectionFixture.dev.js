// Explicit synthetic QA data. Never imported by production or written to stats.
export function createSiteFurinReflectionFixture(now=Date.now()) {
  const minute=60000, start=now-6*60*minute;
  const segments=[[start,start+8*minute],[start+74*minute,start+86*minute],
    [start+181*minute,start+185*minute],[now-6*minute,now]];
  return {schemaVersion:1,hostname:'example.com · QA',cycleStartAt:start,observedAt:now,
    activeMs:30*minute,targetMs:30*minute,representedMs:30*minute,coverage:'complete',segments};
}
