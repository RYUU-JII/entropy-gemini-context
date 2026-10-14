import { ZEN_PLUME_PRODUCT_BLOOM_TRANSITION } from './ZenBonsaiPlumeBloomTransition.js';
import { ZEN_PLUME_BRANCH_ESTABLISHMENT } from './ZenBonsaiPlumeBranchEstablishment.js';

export const ZEN_PLUME_INITIAL_FORM = 'zen_plume_initial_form_v1';
export const ZEN_PLUME_PRE_BLOOM = 'zen_plume_pre_bloom_v1';
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

// The canonical 0.5 minimum is a recognizable form, not half the mature height.
// Keep the immutable mature camera envelope, planting point and pot unchanged.
export function projectZenBonsaiPlumeInitialForm(snapshot, growth) {
    if (!Number.isFinite(growth) || growth < 0.5 || growth > 1) throw Error('ZEN_PLUME_INITIAL_FORM_GROWTH');
    const root = snapshot.nodes.find(node => node.id === 'origin');
    if (!root) throw Error('ZEN_PLUME_INITIAL_FORM_ROOT');
    const scale = 0.6 + 0.4 * smooth((growth - 0.5) / 0.5);
    if (scale === 1) return { snapshot, form: { contract: ZEN_PLUME_INITIAL_FORM, scale } };
    const position = p => root.p.map((value, axis) => value + (p[axis] - value) * scale);
    const radial = record => {
        const result = { ...record };
        for (const field of ['radius', 'startRadius', 'endRadius']) {
            if (Object.hasOwn(record, field)) result[field] = record[field] * scale;
        }
        return result;
    };
    return {
        form: { contract: ZEN_PLUME_INITIAL_FORM, scale },
        snapshot: {
            ...snapshot,
            nodes: snapshot.nodes.map(node => ({ ...node, p: position(node.p) })),
            segments: snapshot.segments.map(radial),
            livingTips: snapshot.livingTips.map(tip => ({ ...radial(tip), p: position(tip.p) })),
            flowers: snapshot.flowers.map(flower => ({
                ...radial(flower), position: position(flower.position),
                referencePosition: position(flower.referencePosition), referenceRadius: flower.referenceRadius * scale,
                pedicelLength: flower.pedicelLength * scale,
                pedicel: { start: position(flower.pedicel.start), end: position(flower.pedicel.end) },
                plume: { ...flower.plume, cloudPosition: position(flower.plume.cloudPosition),
                    targetPosition: position(flower.plume.targetPosition), cloudRadius: flower.plume.cloudRadius * scale,
                    targetRadius: flower.plume.targetRadius * scale },
            })),
        },
    };
}

// These closed buds are a product anticipation cue on actual growing tips.
// They are not annual-model flowers, do not change bloom, and cannot shed petals.
export function resolveZenBonsaiPlumePreBloom(snapshot, growth, transition, branchEstablishment) {
    if (transition?.contract !== ZEN_PLUME_PRODUCT_BLOOM_TRANSITION ||
        !Number.isFinite(transition.coverage) || transition.coverage < 0 || transition.coverage > 1) {
        throw Error('ZEN_PLUME_PRODUCT_PRE_BLOOM_TRANSITION');
    }
    const readiness = smooth((growth - 0.5) / 0.47);
    const alpha = 1 - transition.coverage;
    if (branchEstablishment?.contract !== ZEN_PLUME_BRANCH_ESTABLISHMENT) throw Error('ZEN_PLUME_PRE_BLOOM_BRANCH_ESTABLISHMENT');
    const visibility = new Map(snapshot.live.visibility.segments.map(item => [item.id, item.alpha]));
    const visible = segment => visibility.has(segment.id) ? visibility.get(segment.id) : 1;
    const outgoing = new Set(snapshot.segments.map(segment => segment.parentNodeId));
    const candidates = new Map();
    const add = (segment, budAlpha) => {
        if (budAlpha <= 0) return;
        const previous = candidates.get(segment.childNodeId);
        if (previous && previous.alpha >= budAlpha) return;
        candidates.set(segment.childNodeId, { id: `pre-bloom:${segment.childNodeId}`, nodeId: segment.childNodeId,
            segmentId: segment.id, alpha: budAlpha });
    };
    if (alpha > 0) {
        for (const segment of snapshot.segments) if (!outgoing.has(segment.childNodeId)) add(segment, visible(segment));
        if (branchEstablishment.fadingSegmentCount > 0) {
            const incoming = new Map(snapshot.segments.map(segment => [segment.childNodeId, segment]));
            for (const unit of snapshot.annualUnits) {
                if (unit.cycle === 0) continue;
                const support = incoming.get(unit.originNodeId), first = incoming.get(unit.nodeIds[0]);
                // An unexposed unit has no new tip; a lateral axis has no former
                // terminal bud to carry. Only a recorded same-axis continuation
                // moves anticipation from its previous endpoint to its new tip.
                if (!first || !support || support.axisId !== first.axisId) continue;
                let last = first;
                for (const nodeId of unit.nodeIds) {
                    const segment = incoming.get(nodeId);
                    if (!segment) break;
                    if (segment.unitId !== unit.id) throw Error('ZEN_PLUME_PRE_BLOOM_UNIT_SUPPORT');
                    last = segment;
                }
                add(support, Math.max(0, visible(support) - visible(last)));
            }
        }
    }
    const buds = [...candidates.values()];
    return { contract: ZEN_PLUME_PRE_BLOOM, readiness, alpha, buds };
}
