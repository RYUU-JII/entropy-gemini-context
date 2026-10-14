import { resolveZenAppPetalRate, resolveZenPetalViewportScale } from './zenPetalEmission.js';
import { ZEN_APP_PETAL_OPENING } from './zenAppPetalPresentation.js';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const PHASES = ['waiting', 'gathering', 'shower', 'settling'];
const POST_RAIN = Object.freeze({
    qualifyingIntensity: 0.35,
    qualifyingDurationSec: 8,
    clearIntensity: 0.04,
    durations: Object.freeze([0.35, 0.25, 1.2, 1]),
    maxExtraPetals: 8,
    maxPeakGain: 2,
    cooldownSec: 45,
    consumedFrontLimit: 32,
    // The React weather owner samples at least once a minute. Allow two full
    // sample intervals beyond active simulation time before treating a forward
    // timestamp change as skipped observation rather than a weather edge.
    sampleDriftToleranceSec: 120,
});

// Called only at the input boundary. Weather/season/solar decisions already
// belong to the immutable world sample; this is solely a visual release policy.
export const compileZenPetalReleasePolicy = ({ sourceSignal, width, height, wind, atmosphere }) => {
    if (!atmosphere || ![atmosphere.petals, atmosphere.rainIntensity].every(value => (
        Number.isFinite(value) && value >= 0 && value <= 1
    )) || typeof atmosphere.weatherEventId !== 'string'
        || typeof atmosphere.weatherEventPhase !== 'string') {
        throw new Error('ZEN_APP_PETAL_ATMOSPHERE_INVALID');
    }
    if (!wind || ![wind.intensity, wind.direction, wind.gust].every(Number.isFinite)) {
        throw new Error('ZEN_APP_PETAL_WIND_INVALID');
    }
    const sourceRate = resolveZenAppPetalRate({ sourceSignal, width, height, windIntensity: wind.intensity });
    const rain = atmosphere.rainIntensity;
    return Object.freeze({
        ambientRate: sourceRate * (0.72 + atmosphere.petals * 0.28) * (1 - rain * 0.58),
        openingRate: ZEN_APP_PETAL_OPENING.ratePerSecond * resolveZenPetalViewportScale(width, height),
        bloomRatio: sourceSignal === null ? 0 : sourceSignal.bloomRatio,
        eventsEnabled: sourceRate >= 0.18 && sourceSignal.bloomRatio >= 0.2,
        // The same sampled front/gust that drives the garden shapes each next
        // release, without inventing a second weather clock or seasonal model.
        peakGain: (1.1 + clamp(wind.gust + wind.intensity * 0.35, 0, 1) * 0.5) * (1 - rain * 0.4),
        rainIntensity: rain,
        weatherEventId: atmosphere.weatherEventId,
        weatherEventPhase: atmosphere.weatherEventPhase,
    });
};

export const createZenPetalEventDirector = (random) => {
    let policy = null;
    let phase = 'waiting';
    let elapsed = 0;
    let plan = null;
    let cycleCount = 0;
    let previousMode = 'ambient';
    let presentationMode = 'ambient';
    let openingElapsed = 0;
    let openingWeight = 0;
    let observedRainEventId = null;
    let observedRainSec = 0;
    const consumedRainEventIds = new Set();
    let postRainCooldownSec = 0;
    let postRainReleaseCount = 0;
    let activeTimeSec = 0;
    let sampleTimeMs = null;
    let sampleActiveTimeSec = 0;

    const resetRainObservation = () => {
        observedRainEventId = null;
        observedRainSec = 0;
    };
    const discardPostRain = () => {
        if (plan?.kind !== 'post_rain') return;
        plan = null; phase = 'waiting'; elapsed = 0;
    };
    const consumeRainFront = (eventId) => {
        consumedRainEventIds.add(eventId);
        if (consumedRainEventIds.size > POST_RAIN.consumedFrontLimit) {
            consumedRainEventIds.delete(consumedRainEventIds.values().next().value);
        }
    };
    const observeSampleTime = (nextTimeMs) => {
        if (!Number.isFinite(nextTimeMs)) throw new Error('ZEN_APP_PETAL_SAMPLE_TIME_INVALID');
        if (nextTimeMs === sampleTimeMs) return;
        if (sampleTimeMs !== null) {
            const sampledDeltaSec = (nextTimeMs - sampleTimeMs) / 1000;
            const activeDeltaSec = activeTimeSec - sampleActiveTimeSec;
            if (sampledDeltaSec < 0 || sampledDeltaSec > activeDeltaSec + POST_RAIN.sampleDriftToleranceSec) {
                resetRainObservation();
                discardPostRain();
            }
        }
        sampleTimeMs = nextTimeMs;
        sampleActiveTimeSec = activeTimeSec;
    };
    const setPresentation = (mode) => {
        if (mode === presentationMode) return;
        presentationMode = mode;
        if (mode !== 'ambient') {
            resetRainObservation();
            discardPostRain();
        }
    };

    const schedule = () => {
        const durations = [7 + random() * 5, 0.7 + random() * 0.3, 2.1 + random() * 0.8, 1.3 + random() * 0.5];
        const peak = 1 + policy.peakGain;
        const total = durations.reduce((sum, duration) => sum + duration, 0);
        const peakArea = durations[2] + (durations[1] + durations[3]) / 2;
        // Integrating a whole cycle yields exactly its baseline supply. Bursts
        // redistribute petals in time; they do not add another emitter/budget.
        const quiet = (total - peak * peakArea) / (total - peakArea);
        plan = { kind: 'ambient', durations, from: [quiet, quiet, peak, peak], to: [quiet, peak, peak, quiet] };
        phase = 'waiting';
        elapsed = 0;
        cycleCount += 1;
    };

    const schedulePostRain = (eventId) => {
        const durations = POST_RAIN.durations;
        const peakArea = durations[2] + (durations[1] + durations[3]) / 2;
        const extraPeakRate = Math.min(policy.ambientRate * POST_RAIN.maxPeakGain,
            POST_RAIN.maxExtraPetals / peakArea);
        plan = { kind: 'post_rain', eventId, durations,
            from: [0, 0, extraPeakRate, extraPeakRate], to: [0, extraPeakRate, extraPeakRate, 0] };
        phase = 'waiting'; elapsed = 0;
        postRainCooldownSec = POST_RAIN.cooldownSec;
    };

    const observeRain = (dtSec) => {
        if (!policy.eventsEnabled) { resetRainObservation(); return; }
        if (policy.weatherEventId === '' || consumedRainEventIds.has(policy.weatherEventId)) {
            resetRainObservation();
            return;
        }
        if (policy.rainIntensity < POST_RAIN.qualifyingIntensity) {
            // Once qualified, retain the wet observation through the easing
            // tail. A shorter spell must qualify continuously from the start.
            if (observedRainSec < POST_RAIN.qualifyingDurationSec - 1e-10) resetRainObservation();
            return;
        }
        if (observedRainEventId !== policy.weatherEventId) {
            observedRainEventId = policy.weatherEventId;
            observedRainSec = 0;
        }
        observedRainSec = Math.min(POST_RAIN.qualifyingDurationSec, observedRainSec + dtSec);
    };

    const integrateAmbient = (dtSec) => {
        if (!policy.eventsEnabled) return policy.ambientRate * dtSec;
        if (plan === null) schedule();
        let remaining = dtSec;
        let mass = 0;
        while (remaining > 1e-10) {
            const index = PHASES.indexOf(phase);
            const duration = plan.durations[index];
            const take = Math.min(remaining, duration - elapsed);
            const from = plan.from[index], slope = (plan.to[index] - from) / duration;
            const integrated = take * (from + slope * (elapsed + take / 2));
            mass += plan.kind === 'post_rain'
                ? policy.ambientRate * take + integrated : integrated * policy.ambientRate;
            elapsed += take;
            remaining -= take;
            if (elapsed >= duration - 1e-10) {
                if (index === PHASES.length - 1) schedule();
                else {
                    if (plan.kind === 'post_rain' && index === 0) postRainReleaseCount += 1;
                    phase = PHASES[index + 1]; elapsed = 0;
                }
            }
        }
        return mass;
    };

    return {
        setPolicy(next, mode) {
            const onset = policy !== null && policy.rainIntensity < 0.08 && next.rainIntensity >= 0.08
                && next.weatherEventId !== '';
            const observedFront = observedRainEventId;
            const qualified = observedRainSec >= POST_RAIN.qualifyingDurationSec - 1e-10;
            const eventChanged = policy !== null && policy.weatherEventId !== next.weatherEventId;
            // A front may ease below the intensity threshold or stop between
            // rain cells for hours. Only its canonical completion, or a clear
            // handoff to another front, consumes the observed wet spell.
            const clearBoundary = qualified && next.rainIntensity <= POST_RAIN.clearIntensity
                && (next.weatherEventId !== observedFront || next.weatherEventPhase === 'after_rain');
            setPresentation(mode);
            policy = next;
            if (!policy.eventsEnabled) { phase = 'waiting'; elapsed = 0; plan = null; resetRainObservation(); }
            else if (plan?.kind === 'post_rain' && (policy.rainIntensity > POST_RAIN.clearIntensity
                || (policy.weatherEventId === plan.eventId && policy.weatherEventPhase !== 'after_rain'))) discardPostRain();
            if (clearBoundary) {
                // This exact front's edge is consumed even when another event,
                // cover or opening owns the field. It can never become a queue.
                if (qualified) {
                    // A cross-midnight front can leave the next canonical
                    // sample with no event ID, or with the next front's ID.
                    // The wet front we actually observed owns this one edge.
                    consumeRainFront(observedFront);
                    if (mode === 'ambient' && openingWeight === 0 && policy.eventsEnabled
                        && postRainCooldownSec <= 1e-10 && (plan === null || (plan.kind === 'ambient' && phase === 'waiting'))) {
                        schedulePostRain(observedFront);
                    }
                }
                resetRainObservation();
            } else if (eventChanged) resetRainObservation();
            // Consume a visible onset immediately. No deferred event is kept
            // through cover, opening, hidden time, or an ongoing shower.
            if (onset && mode === 'ambient' && openingWeight === 0 && plan?.kind === 'ambient' && phase === 'waiting') {
                phase = 'gathering'; elapsed = 0;
            }
        },
        setPresentation,
        observeSampleTime,
        advance(dtSec, mode) {
            if (policy === null) throw new Error('ZEN_APP_PETAL_RELEASE_POLICY_REQUIRED');
            setPresentation(mode);
            if (mode === 'covered') return { mass: 0, bloomRatio: policy.bloomRatio };
            activeTimeSec += dtSec;
            postRainCooldownSec = Math.max(0, postRainCooldownSec - dtSec);
            if (mode === 'opening' && previousMode !== 'opening') {
                openingElapsed = 0;
                plan = null;
                phase = 'waiting';
                elapsed = 0;
            }
            previousMode = mode;
            if (mode === 'opening' || openingWeight > 0) {
                let remaining = dtSec, mass = 0;
                while (remaining > 1e-10) {
                    const target = mode === 'opening' && openingElapsed < ZEN_APP_PETAL_OPENING.maxSupplyDurationSec - 1e-10 ? 1 : 0;
                    const take = target === 1 ? Math.min(remaining, ZEN_APP_PETAL_OPENING.maxSupplyDurationSec - openingElapsed) : remaining;
                    const tau = target > openingWeight ? ZEN_APP_PETAL_OPENING.riseTimeSec : ZEN_APP_PETAL_OPENING.settleTimeSec;
                    const decay = Math.exp(-take / tau);
                    const weightIntegral = target * take + (openingWeight - target) * tau * (1 - decay);
                    mass += policy.ambientRate * (take - weightIntegral) + policy.openingRate * weightIntegral;
                    openingWeight = target + (openingWeight - target) * decay;
                    if (target === 0 && openingWeight < 0.001) openingWeight = 0;
                    if (mode === 'opening') openingElapsed += take;
                    remaining -= take;
                }
                return { mass, bloomRatio: policy.bloomRatio * (1 - openingWeight) + openingWeight };
            }
            observeRain(dtSec);
            return { mass: integrateAmbient(dtSec), bloomRatio: policy.bloomRatio };
        },
        resetTransient() {
            plan = null; phase = 'waiting'; elapsed = 0;
            openingWeight = 0;
            resetRainObservation();
        },
        getDiagnostics: () => ({
            releasePhase: openingWeight > 0 ? 'opening' : phase,
            releaseCycleCount: cycleCount,
            openingWeight,
            ambientRate: policy === null ? 0 : policy.ambientRate,
            releaseEvent: plan?.kind === 'post_rain' ? 'post_rain' : 'ambient',
            observedRainSec,
            postRainCooldownSec,
            postRainReleaseCount,
            consumedRainFrontCount: consumedRainEventIds.size,
        }),
    };
};
