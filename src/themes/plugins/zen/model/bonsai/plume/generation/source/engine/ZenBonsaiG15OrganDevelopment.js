/** Deterministic organ reservations. Current bloom, camera and array rank own no identity. */
export const ZEN_G15_ORGAN_CONTRACT = 'zen_g15_causal_organs_v1';

export function zenG15OrganSample(seed, id, channel) {
    let hash = 2166136261;
    for (const character of `${seed}:${id}:${channel}`) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return (hash >>> 0) / 4294967296;
}

export function zenG15OrganRamp(value, start, duration) {
    const t = Math.min(1, Math.max(0, (value - start) / duration));
    return t * t * (3 - 2 * t);
}

export function resolveZenG15OrganAge(eventTime, birthEvent) {
    if (!Number.isFinite(eventTime) || !Number.isFinite(birthEvent)) {
        throw new Error('ZEN_G15_ORGAN_CLOCK_REQUIRED');
    }
    return Object.freeze({
        birthEvent,
        extension: zenG15OrganRamp(eventTime, birthEvent, 10),
        girth: zenG15OrganRamp(eventTime, birthEvent, 18),
        floralMaturity: zenG15OrganRamp(eventTime, birthEvent + 5, 18),
    });
}

/** Reserve in birth order using rest-world positions, including dormant organs.
 * Newer growth cannot displace an older visible organ or recycle its slot.
 */
export function reserveZenG15Organs(candidates, { limit, spacing, lineageLimit, onDecision }) {
    const selected = [];
    const counts = new Map();
    for (const candidate of [...candidates].sort((a, b) => (
        a.birthEvent - b.birthEvent || a.id.localeCompare(b.id)
    ))) {
        if (selected.length >= limit) {
            if (!onDecision) break;
            onDecision(candidate, 'capacity');
            continue;
        }
        if ((counts.get(candidate.lineageId) || 0) >= lineageLimit) {
            onDecision?.(candidate, 'lineage');
            continue;
        }
        const point = candidate.restPoint;
        if (![point?.x, point?.y, point?.z, candidate.birthEvent].every(Number.isFinite)) {
            throw new Error('ZEN_G15_ORGAN_RESERVATION_INVALID');
        }
        if (selected.some(owned => Math.hypot(
            point.x - owned.restPoint.x, point.y - owned.restPoint.y, point.z - owned.restPoint.z,
        ) < spacing)) {
            onDecision?.(candidate, 'spacing');
            continue;
        }
        selected.push(candidate);
        onDecision?.(candidate, 'selected');
        counts.set(candidate.lineageId, (counts.get(candidate.lineageId) || 0) + 1);
    }
    return selected;
}
