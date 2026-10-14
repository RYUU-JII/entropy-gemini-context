import { clamp } from '../model/koi/koiMotion.js';

// Worker-local, bounded living state. It is neither a persisted energy profile
// nor a second locomotion solver. All times use 60 Hz simulation ticks.
export function acquireZenKoiBehaviorMemory(fish) {
    if (!fish.zenKoiBehaviorMemory) {
        fish.zenKoiBehaviorMemory = {
            lastTick: null, alertness: 0, fatigue: 0, exploration: 0.25, socialNeed: 0.3,
            response: null, responseCooldownUntil: 0,
            partnerUid: null, partnerUntil: 0, partnerKind: null, partnerSide: 1, socialCooldownUntil: 0,
            intentWindow: null,
            intentCache: null,
        };
    }
    return fish.zenKoiBehaviorMemory;
}

export function advanceZenKoiBehaviorNeeds(fish, tick, neighbors) {
    const memory = acquireZenKoiBehaviorMemory(fish);
    if (memory.lastTick === null) memory.lastTick = tick;
    const elapsed = tick - memory.lastTick;
    if (elapsed < 6) return memory;
    memory.lastTick = tick;
    const seconds = elapsed / 60;
    const resting = fish.actionState === 'glide' || fish.sleepBlend > 0.45;
    const work = fish.eventBodyFrame?.maneuver;
    const turnWork = work && work.active ? Math.min(1, Math.abs(work.amplitude) / 2) : 0;
    const effort = Math.max(turnWork, fish.actionState === 'burst' ? 0.85 : 0);
    memory.alertness *= Math.exp(-seconds / 5);
    memory.fatigue = clamp(memory.fatigue + seconds * (effort * 0.08 - (resting ? 0.075 : 0.009)), 0, 0.85);
    const goal = fish.zenKoiBehaviorMicroGoal;
    const exploring = goal && (goal.kind === 'explore' || goal.kind === 'scout' || goal.kind === 'graze');
    memory.exploration = clamp(memory.exploration + seconds * (exploring && goal.phase === 'linger' ? -0.16 : 0.018), 0, 1);
    const together = neighbors.some((neighbor) => neighbor.uid === memory.partnerUid);
    memory.socialNeed = clamp(memory.socialNeed + seconds * (together ? -0.09 : 0.014), 0, 1);
    return memory;
}

export function resolveZenKoiSocialNeighbor(fish, neighbors, tick) {
    const memory = acquireZenKoiBehaviorMemory(fish);
    if (memory.partnerUid !== null) {
        const partner = neighbors.find((neighbor) => neighbor.uid === memory.partnerUid);
        if (partner && partner.uid > fish.uid && tick < memory.partnerUntil
            && Math.cos(partner.angle - fish.bodyHeading) > -0.15) return partner;
        memory.partnerUid = null;
        memory.partnerKind = null;
        memory.socialCooldownUntil = tick + 90;
        if (fish.zenKoiBehaviorMicroGoal?.kind === 'parallel' || fish.zenKoiBehaviorMicroGoal?.kind === 'trail') {
            fish.zenKoiBehaviorMicroGoal = null;
        }
    }
    if (tick < memory.socialCooldownUntil) return null;
    let nearest = null;
    for (const candidate of neighbors) {
        // A fixed identity order makes following acyclic without searching the
        // whole school. The larger UID keeps its own course in this pair.
        // Passing/head-on animals are avoided, not recruited for a U-turn.
        if (candidate.uid <= fish.uid || Math.cos(candidate.angle - fish.bodyHeading) < 0.65) continue;
        const forward = (candidate.x - fish.x) * Math.cos(candidate.angle)
            + (candidate.y - fish.y) * Math.sin(candidate.angle);
        if (forward < -28) continue;
        if (!nearest || candidate.distance < nearest.distance) nearest = candidate;
    }
    return nearest;
}

export function commitZenKoiSocialPartner(fish, neighbor, kind, tick) {
    if (!Number.isInteger(neighbor.uid) || neighbor.uid <= 0) throw new Error('ZEN_KOI_SOCIAL_NEIGHBOR_UID_REQUIRED');
    if (neighbor.uid <= fish.uid) throw new Error('ZEN_KOI_SOCIAL_PARTNER_ORDER_REQUIRED');
    const memory = acquireZenKoiBehaviorMemory(fish);
    if (memory.partnerUid === neighbor.uid) return;
    memory.partnerUid = neighbor.uid;
    memory.partnerKind = kind;
    const lateral = -(fish.x - neighbor.x) * Math.sin(neighbor.angle)
        + (fish.y - neighbor.y) * Math.cos(neighbor.angle);
    memory.partnerSide = Math.abs(lateral) > 12 ? Math.sign(lateral) : (fish.uid % 2 === 0 ? 1 : -1);
    memory.partnerUntil = tick + 210 + fish.behaviorTemperament.curiosity * 150;
}
