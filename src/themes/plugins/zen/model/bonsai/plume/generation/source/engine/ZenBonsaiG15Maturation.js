import { zenG15OrganRamp, zenG15OrganSample } from './ZenBonsaiG15OrganDevelopment.js';

export const ZEN_G15_MATURATION = 'zen_g15_first_form_maturation_v1';
export function resolveZenG15MaturationTreatment(value = 'baseline') {
    if (!['baseline', 'candidate'].includes(value)) throw new Error('ZEN_G15_MATURATION_TREATMENT_INVALID');
    return value;
}

/** Preserve early growth; finish the fixed skeleton before its organs settle.
 * This is first-form presentation time, not more scheduler work or calendar age.
 */
export function resolveZenG15MaturationPhase(growth) {
    if (!Number.isFinite(growth) || growth < 0 || growth > 1) throw new Error('ZEN_G15_MATURATION_GROWTH_REQUIRED');
    const start = .78, end = .94;
    let structuralGrowth = growth;
    if (growth > start && growth < end) {
        const t = (growth - start) / (end - start), slope = (end - start) / (1 - start);
        structuralGrowth = start + (1 - start) * ((slope - 2) * t ** 3 + (3 - 2 * slope) * t ** 2 + slope * t);
    } else if (growth >= end) structuralGrowth = 1;
    return Object.freeze({ contract: ZEN_G15_MATURATION, growth, structuralGrowth,
        structuralComplete: growth >= end, settling: zenG15OrganRamp(growth, end, 1 - end) });
}

export function resolveZenG15MaturationClock(phase, structuralClock) {
    if (!phase || phase.contract !== ZEN_G15_MATURATION) throw new Error('ZEN_G15_MATURATION_PHASE_REQUIRED');
    if (!structuralClock) throw new Error('ZEN_G15_MATURATION_CLOCK_REQUIRED');
    const expected = resolveZenG15MaturationPhase(phase.growth);
    if (Object.keys(expected).some(key => phase[key] !== expected[key])
        || structuralClock.progress !== phase.structuralGrowth || !Number.isFinite(structuralClock.eventTime)
        || !Number.isFinite(structuralClock.maximumEvent)) throw new Error('ZEN_G15_MATURATION_CLOCK_MISMATCH');
    // Latest possible ordinary twig/flower chain needs at most 76 organ units
    // after its structural source. A small fixed tail completes that chain.
    return Object.freeze({ ...phase, structuralEventTime: structuralClock.eventTime,
        maximumEvent: structuralClock.maximumEvent,
        organEventTime: structuralClock.eventTime + 80 * phase.settling });
}

/** A resolved framework apex owns a floral bud, regardless of the lateral
 * organ quota. It cannot evict any existing flower. Only the fixed final graph
 * may authorize these buds; no transient growing tip is decorated and removed.
 */
export function buildZenG15ApicalMaturationSites(entries, seed, clock) {
    if (clock === undefined) return [];
    if (!clock || clock.contract !== ZEN_G15_MATURATION || typeof clock.structuralComplete !== 'boolean'
        || !Number.isFinite(clock.maximumEvent)) throw new Error('ZEN_G15_MATURATION_CLOCK_REQUIRED');
    if (!clock.structuralComplete) return [];
    const structural = entries.filter(e => !e.isCanopyTwig && e.carrierAvailable);
    const outgoing = new Set(structural.map(e => e.fromNodeId));
    return structural.filter(e => e.tier === 0 && !outgoing.has(e.toNodeId)).map(entry => {
        const supportSpan = Math.hypot(entry.restTo.x-entry.restFrom.x, entry.restTo.y-entry.restFrom.y, entry.restTo.z-entry.restFrom.z);
        const dx = entry.end.x-entry.start.x, dy = entry.end.y-entry.start.y, length = Math.hypot(dx,dy);
        if (!Number.isFinite(supportSpan) || supportSpan <= 0 || length <= 0) throw new Error('ZEN_G15_APICAL_SUPPORT_REQUIRED');
        const id = `${entry.toNodeId}:apical-bud`, birthEvent = clock.maximumEvent + 2;
        const tangent = { x:dx/length, y:dy/length };
        const ownedBud = Object.freeze({ id, sourceSegmentId:entry.id, sourceNodeId:entry.toNodeId,
            supportSpan, birthEvent, kind:'floral_bud', flowerCapacity:3+Math.floor(zenG15OrganSample(seed,id,'capacity')*3) });
        return { id:`flower-site:${id}`, key:id, kind:'terminal_tip', entry, ownedBud, birthEvent,
            point:entry.end, restPoint:entry.restTo, restScreenPoint:entry.restEnd, tangent, flowTangent:tangent,
            lineageId:entry.lineageId, isCanopyTwig:false, canopyCarrierId:null, organKind:'floral_bud',
            clusterRole:'tip', clusterId:null, clusterAffinity:0, clusterPadTangent:null,
            radius:entry.endRadiusWorld, scaffoldFamilyTerminalLoadScale:entry.scaffoldFamilyTerminalLoadScale,
            apicalMaturation:true };
    });
}
