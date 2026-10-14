// A branch's physical scale owns its lateral rhythm. This experiment changes
// placement and divides the existing lateral grant; it adds no resource stock.
export function resolveZenG15AxisDevelopment(value = 'baseline') {
    if (!['baseline','spacing','frame','candidate'].includes(value)) throw new Error('ZEN_G15_AXIS_DEVELOPMENT_TREATMENT_INVALID');
    return { spacing:value==='spacing'||value==='candidate', frame:value==='frame'||value==='candidate' };
}

export function bindZenG15AxisDevelopment(context, portfolio, {tier,radius,referenceLength,startAxisAge=0}) {
    if (!resolveZenG15AxisDevelopment(context.axisDevelopmentTreatment).spacing || tier===0) return portfolio;
    if (![radius,referenceLength].every(v=>Number.isFinite(v)&&v>0) || !Number.isInteger(startAxisAge) || startAxisAge<0) throw new Error('ZEN_G15_AXIS_DEVELOPMENT_GEOMETRY_REQUIRED');
    const pitch=Math.max(14,radius*7.8)*(0.9+portfolio.lateralStationPhase*.2);
    const expectedReach=referenceLength*portfolio.plannedInternodeCount;
    const firstDistance=pitch;
    const interval=pitch*1.25;
    const spatialCapacity=Math.max(0,Math.floor((expectedReach-firstDistance)/interval)+1);
    const nodeCapacity=Math.max(0,Math.floor((portfolio.plannedInternodeCount-1)/2));
    const fundedCapacity=Math.floor((portfolio.lateralConstructionBudget+1e-8)/.055);
    const capacity=Math.min(spatialCapacity,nodeCapacity,fundedCapacity);
    return Object.freeze({...portfolio,
        lateralReleaseCapacity:capacity,
        lastLateralDistance:0,
        lateralTimingMode:'physical_axis_distance',
        lateralReleaseStations:Object.freeze([]),lateralReleaseProgresses:Object.freeze([]),
        axisDevelopment:Object.freeze({semantics:'physical_axis_development_v1',
            radius,referenceLength,startAxisAge,pitch,firstDistance,interval,expectedReach,
            lateralBudget:portfolio.lateralConstructionBudget,capacity,
            authority:'placement_and_existing_budget_partition'}),
    });
}

export function validZenG15AxisDevelopment(portfolio) {
    const p=portfolio?.axisDevelopment;
    return Boolean(p && p.semantics==='physical_axis_development_v1'
        && [p.radius,p.referenceLength,p.pitch,p.firstDistance,p.interval,p.expectedReach].every(v=>Number.isFinite(v)&&v>0)
        && Number.isInteger(p.startAxisAge)&&p.startAxisAge>=0
        && Number.isInteger(p.capacity)&&p.capacity>=0&&p.capacity===portfolio.lateralReleaseCapacity
        && Number.isFinite(p.lateralBudget)&&p.lateralBudget>=0
        && Number.isFinite(portfolio.lastLateralDistance)&&portfolio.lastLateralDistance>=0
        && (portfolio.lateralReleasesCommitted>0 ? portfolio.lastLateralDistance>=p.firstDistance : portfolio.lastLateralDistance===0)
        && p.capacity*.055<=p.lateralBudget+1e-7
        && portfolio.lateralConstructionBudget<=p.lateralBudget+1e-7);
}

export function zenG15AxisLateralOpportunity(portfolio, segments) {
    const plan=portfolio.axisDevelopment;
    if (!plan) throw new Error('ZEN_G15_AXIS_DEVELOPMENT_PLAN_REQUIRED');
    const current=segments.slice(plan.startAxisAge);
    const distance=current.reduce((sum,s)=>sum+s.length,0);
    const target=portfolio.lateralReleasesCommitted > 0
        ? portfolio.lastLateralDistance+plan.interval : plan.firstDistance;
    return Object.freeze({semantics:plan.semantics,distance,target,ready:distance+1e-8>=target});
}

export function zenG15AxisForkGap(portfolio, referenceLength, sampledGap) {
    const plan=portfolio.axisDevelopment;
    if (!plan) return sampledGap;
    if (!(Number.isFinite(referenceLength)&&referenceLength>0)) throw new Error('ZEN_G15_AXIS_FORK_LENGTH_REQUIRED');
    // A lateral's occupied site also governs the next apical separation.
    // Existing construction still pays every intervening internode.
    return Math.max(sampledGap, Math.min(3, Math.ceil(plan.pitch*.9/referenceLength)));
}
