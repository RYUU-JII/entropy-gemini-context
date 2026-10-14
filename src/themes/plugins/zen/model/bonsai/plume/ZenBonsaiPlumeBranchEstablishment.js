export const ZEN_PLUME_BRANCH_ESTABLISHMENT = 'zen_plume_branch_establishment_v1';
const ESTABLISHMENT_SPAN = 0.85;
const unit = value => Number.isFinite(value) && value >= 0 && value <= 1;
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export function requireZenBonsaiPlumeBranchEstablishment(snapshot, receipt) {
    if (receipt?.contract !== ZEN_PLUME_BRANCH_ESTABLISHMENT ||
        !Number.isInteger(receipt.annualSegmentCount) || receipt.annualSegmentCount < 0 ||
        !Number.isInteger(receipt.fadingSegmentCount) || receipt.fadingSegmentCount < 0 ||
        receipt.fadingSegmentCount > receipt.annualSegmentCount ||
        !Number.isFinite(receipt.annualVisibilityWeight) || receipt.annualVisibilityWeight < 0 ||
        receipt.annualVisibilityWeight > receipt.annualSegmentCount || !unit(receipt.span) || receipt.span === 0) {
        throw Error('ZEN_PLUME_PRODUCT_BRANCH_ESTABLISHMENT');
    }
    const annual = snapshot.segments.filter(segment => segment.owner !== 'f4-scaffold');
    if (annual.length !== receipt.annualSegmentCount) throw Error('ZEN_PLUME_PRODUCT_BRANCH_ESTABLISHMENT_COUNT');
    if (receipt.fadingSegmentCount > 0) {
        const visibility = new Map(snapshot.live.visibility.segments.map(item => [item.id, item.alpha]));
        if (annual.some(segment => !visibility.has(segment.id) || !unit(visibility.get(segment.id)))) {
            throw Error('ZEN_PLUME_PRODUCT_BRANCH_VISIBILITY_MISSING');
        }
    }
    return receipt;
}

// Births come from the private wood-development owner, not a second shoot plan.
// This product projection eases visibility only; every point, radius and organ
// retains the original extension/girth history and exact mature observation.
export function projectZenBonsaiPlumeBranchEstablishment(snapshot, birthRecords) {
    const clock = snapshot?.live?.clock;
    if (!clock || !unit(clock.growth) || clock.growth < 0.5 ||
        !Number.isFinite(clock.annualTime) || !(clock.annualTarget > 0) ||
        !Array.isArray(snapshot.segments) || !Array.isArray(birthRecords) ||
        !Array.isArray(snapshot.live.visibility.segments)) throw Error('ZEN_PLUME_BRANCH_ESTABLISHMENT_INPUT');
    const annual = snapshot.segments.filter(segment => segment.owner !== 'f4-scaffold');
    const births = new Map();
    for (const record of birthRecords) {
        if (births.has(record.id) || !Number.isFinite(record.birthTime)) throw Error('ZEN_PLUME_BRANCH_BIRTH_RECORD');
        births.set(record.id, record.birthTime);
    }
    if (births.size !== annual.length) throw Error('ZEN_PLUME_BRANCH_BIRTH_COUNT');
    const ids = new Set(snapshot.segments.map(segment => segment.id));
    const visibility = new Map();
    for (const record of snapshot.live.visibility.segments) {
        if (!ids.has(record.id) || visibility.has(record.id) || !unit(record.alpha)) throw Error('ZEN_PLUME_BRANCH_SOURCE_VISIBILITY');
        visibility.set(record.id, record.alpha);
    }
    let fadingSegmentCount = 0, annualVisibilityWeight = 0;
    for (const segment of annual) {
        if (!births.has(segment.id) || !Number.isInteger(segment.birthCycle) || segment.birthCycle < 0) throw Error('ZEN_PLUME_BRANCH_BIRTH_ID');
        const birth = births.get(segment.id), end = Math.min(birth + ESTABLISHMENT_SPAN, clock.annualTarget);
        if (!(end > birth)) throw Error('ZEN_PLUME_BRANCH_ESTABLISHMENT_WINDOW');
        // The initial foundation is already the recognizable form. Only its
        // later annual shoots fade in; full growth is an exact endpoint.
        const alpha = segment.birthCycle === 0 || clock.growth === 1 ? 1 : smooth((clock.annualTime - birth) / (end - birth));
        visibility.set(segment.id, alpha);
        annualVisibilityWeight += alpha;
        if (alpha < 1) fadingSegmentCount++;
    }
    return {
        receipt: {
            contract: ZEN_PLUME_BRANCH_ESTABLISHMENT, span: ESTABLISHMENT_SPAN,
            annualSegmentCount: annual.length, fadingSegmentCount, annualVisibilityWeight,
            policy: 'Recorded birth-time easing; foundation and full endpoint retain their original picture.',
        },
        snapshot: fadingSegmentCount === 0 ? snapshot : {
            ...snapshot,
            live: { ...snapshot.live, visibility: { ...snapshot.live.visibility,
                segments: [...visibility].map(([id, alpha]) => ({ id, alpha })) } },
        },
    };
}
