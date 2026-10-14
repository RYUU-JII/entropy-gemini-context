import { clamp as clampValue } from '../model/koi/koiMotion.js';
import { zenKoiTraitUnit } from '../model/koi/zenKoiPersonality.js';
import { acquireZenKoiBehaviorMemory } from './zenKoiBehaviorMemory.js';

export const ZEN_KOI_INTERACTION_STIMULUS_MAX = 4;
export const ZEN_KOI_INTERACTION_STIMULUS_TTL_FRAMES = 108;

const KIND_DIRECT_CLICK = 'direct_click';
const KIND_POND_CLICK = 'pond_click';
const RESPONSE_ATTEND = 'attend';
const RESPONSE_STARTLE = 'startle';
const RESPONSE_NOTICE = 'notice';

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const toOptionalUid = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const uid = Math.floor(numeric);
    return uid > 0 ? uid : null;
};

const resolveFishUid = (fish = null) => toOptionalUid(fish?.uid);

const resolveFishPoint = (fish = null) => {
    const history = Array.isArray(fish?.history) ? fish.history : null;
    const head = history && history.length > 0 ? history[0] : fish;
    const x = Number(head?.x);
    const y = Number(head?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
};

export const pushZenKoiInteractionStimulus = (stimuliRef, payload = {}) => {
    const stimuli = Array.isArray(stimuliRef?.current) ? stimuliRef.current : null;
    if (!stimuli) return null;

    const x = Number(payload?.x);
    const y = Number(payload?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    const clickedFishUid = toOptionalUid(payload?.clickedFishUid);
    const token = Math.max(0, Math.floor(toFiniteNumber(payload?.token, 0)));
    const kind = clickedFishUid !== null ? KIND_DIRECT_CLICK : KIND_POND_CLICK;
    const stimulus = {
        kind,
        token,
        x,
        y,
        clickedFishUid,
        clickedDomain: typeof payload?.clickedDomain === 'string' && payload.clickedDomain.trim()
            ? payload.clickedDomain.trim()
            : null,
        ageFrames: 0,
        admitted: false,
        strength: clampValue(toFiniteNumber(payload?.strength, kind === KIND_DIRECT_CLICK ? 1 : 0.72), 0.2, 1.2),
    };

    if (token > 0) {
        for (let i = stimuli.length - 1; i >= 0; i -= 1) {
            if (Number(stimuli[i]?.token) === token) {
                stimuli.splice(i, 1);
            }
        }
    }

    stimuli.push(stimulus);
    while (stimuli.length > ZEN_KOI_INTERACTION_STIMULUS_MAX) {
        stimuli.shift();
    }
    return stimulus;
};

export const pruneZenKoiInteractionStimuli = (stimuliRef, simStepRateScale = 1) => {
    const stimuli = Array.isArray(stimuliRef?.current)
        ? stimuliRef.current
        : (Array.isArray(stimuliRef) ? stimuliRef : null);
    if (!stimuli || stimuli.length === 0) return false;

    const frameStep = clampValue(toFiniteNumber(simStepRateScale, 1), 0.25, 3);
    for (let i = stimuli.length - 1; i >= 0; i -= 1) {
        const stimulus = stimuli[i];
        const x = Number(stimulus?.x);
        const y = Number(stimulus?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            stimuli.splice(i, 1);
            continue;
        }
        stimulus.ageFrames = Math.max(0, toFiniteNumber(stimulus.ageFrames, 0) + frameStep);
        if (stimulus.ageFrames >= ZEN_KOI_INTERACTION_STIMULUS_TTL_FRAMES) {
            stimuli.splice(i, 1);
        }
    }

    while (stimuli.length > ZEN_KOI_INTERACTION_STIMULUS_MAX) {
        stimuli.shift();
    }
    return stimuli.length > 0;
};

// Admission is pond-wide and event-driven. A stationary cursor never emits a
// second stimulus; each fish keeps one reaction, and at most two react at once.
export function admitZenKoiInteractionStimuli(fishes, stimuli, tick) {
    for (const stimulus of stimuli) {
        if (stimulus.admitted) continue;
        stimulus.admitted = true;
        let active = 0;
        for (const fish of fishes) {
            const memory = acquireZenKoiBehaviorMemory(fish);
            if (memory.response && tick >= memory.response.endsAt) {
                memory.response = null;
                memory.responseCooldownUntil = tick + 150;
                fish.zenKoiBehaviorMicroGoal = null;
            }
            if (memory.response) active += 1;
        }
        const directFish = fishes.find(fish => fish.uid === stimulus.clickedFishUid);
        if (directFish && !directFish.formationProfile && directFish.presenceState !== 'retiring'
            && !acquireZenKoiBehaviorMemory(directFish).response && active >= 2) {
            let released = null;
            for (const fish of fishes) {
                const reaction = fish.zenKoiBehaviorMemory.response;
                if (!reaction) continue;
                const previous = released && released.zenKoiBehaviorMemory.response;
                if (!previous || (previous.direct && !reaction.direct)
                    || (previous.direct === reaction.direct && reaction.startedAt < previous.startedAt)) released = fish;
            }
            if (released) {
                released.zenKoiBehaviorMemory.response = null;
                released.zenKoiBehaviorMemory.responseCooldownUntil = tick + 90;
                released.zenKoiBehaviorMicroGoal = null;
                active -= 1;
            }
        }
        for (let slot = active; slot < 2; slot += 1) {
            let best = null, bestScore = 0;
            for (const fish of fishes) {
                if (fish.formationProfile || fish.presenceState === 'retiring') continue;
                const memory = acquireZenKoiBehaviorMemory(fish);
                const direct = resolveFishUid(fish) === stimulus.clickedFishUid;
                if (memory.response || (!direct && tick < memory.responseCooldownUntil)) continue;
                const point = resolveFishPoint(fish);
                if (!point) continue;
                const distance = Math.hypot(point.x - stimulus.x, point.y - stimulus.y);
                const reach = 220 + fish.behaviorTemperament.curiosity * 160;
                if (!direct && distance > reach) continue;
                const score = direct ? 3 : (1 - distance / reach)
                    * (0.5 + fish.behaviorTemperament.curiosity * 0.5)
                    * (1 - memory.fatigue * 0.35) * (1 - fish.sleepBlend * 0.65)
                    * (1 - memory.alertness * 0.3);
                if (score > bestScore) { best = fish; bestScore = score; }
            }
            if (!best || bestScore < 0.1) break;
            const memory = acquireZenKoiBehaviorMemory(best);
            const point = resolveFishPoint(best);
            const distance = Math.hypot(point.x - stimulus.x, point.y - stimulus.y);
            const direct = resolveFishUid(best) === stimulus.clickedFishUid;
            const startled = !direct && distance < 46 + (1 - best.behaviorTemperament.boldness) * 24 + memory.alertness * 20;
            const variation = zenKoiTraitUnit(best.entityId, `reaction-${stimulus.token}`);
            const delay = (direct ? 5 : 10 + slot * 13) + variation * 16 + distance * 0.025;
            memory.alertness = clampValue(memory.alertness + (startled ? 0.38 : 0.04), 0, 1);
            memory.response = {
                token: stimulus.token, x: stimulus.x, y: stimulus.y,
                responseKind: direct ? RESPONSE_ATTEND : (startled ? RESPONSE_STARTLE : RESPONSE_NOTICE),
                strength: stimulus.strength, direct, clickedFishUid: stimulus.clickedFishUid,
                startedAt: tick + delay, phaseStartedAt: tick + delay,
                phase: 'orient', endsAt: tick + delay + 420,
                side: variation < 0.5 ? -1 : 1,
            };
            memory.partnerUid = null;
            memory.partnerKind = null;
            best.zenKoiBehaviorMicroGoal = null;
        }
        // Repeated taps change vigilance, not the committed motion's clock.
        for (const fish of fishes) {
            const memory = acquireZenKoiBehaviorMemory(fish);
            if (memory.response && Math.hypot(fish.x - stimulus.x, fish.y - stimulus.y) < 100) {
                memory.alertness = Math.min(1, memory.alertness + 0.08);
            }
        }
    }
}

export function resolveZenKoiInteractionStimulusForFish({ fish, frameCount }) {
    const memory = acquireZenKoiBehaviorMemory(fish);
    const response = memory.response;
    if (!response || frameCount < response.startedAt) return null;
    const age = frameCount - response.phaseStartedAt;
    const distance = Math.hypot(fish.x - response.x, fish.y - response.y);
    const startle = response.responseKind === RESPONSE_STARTLE;
    const finished = frameCount >= response.endsAt || (response.phase === 'leave' && age >= 85);
    if (finished) {
        memory.response = null;
        memory.responseCooldownUntil = frameCount + 150;
        fish.zenKoiBehaviorMicroGoal = null;
        return null;
    }
    const arrived = distance < 46 + fish.baseSize * 0.4;
    if ((response.phase === 'orient' && age >= 22)
        || (response.phase === 'approach' && (age >= (startle ? 55 : 190) || (!startle && arrived)))
        || (response.phase === 'linger' && age >= 85)) {
        response.phase = response.phase === 'orient' ? 'approach'
            : response.phase === 'approach' ? (startle ? 'leave' : 'linger') : 'leave';
        response.phaseStartedAt = frameCount;
    }
    return response;
}

export const ZEN_KOI_INTERACTION_RESPONSE_KINDS = Object.freeze({
    ATTEND: RESPONSE_ATTEND,
    STARTLE: RESPONSE_STARTLE,
    NOTICE: RESPONSE_NOTICE,
});
