import {
    ZEN_POND_LANDED_PETAL_LIMIT,
    ZEN_POND_PETAL_LANDING_BATCH_LIMIT,
    ZEN_POND_PETAL_LANDING_HISTORY_LIMIT,
    ZEN_POND_MAX_LANDED_PETAL_SIZE,
    requireZenPetalLandingDescriptor,
} from '../../../contracts/zenPondPetalLanding.js';
import { resolveZenCoverTransform, mapZenViewportPointToWorld } from '../../../runtime/zenCoverMath.js';
import { createZenLandedFlowerPetal } from '../../../world/decor/decorFlowerPetal.js';
import { ZEN_SURFACE_DISTURBANCE_SOURCES } from '../../../runtime/surface/zenSurfaceDisturbance.js';
import { isZenPondWorldEntityEnabled } from '../../../runtime/core/zenPondWorldProfile.js';

// An event command: callers must never send it through the latest-input slot.
// Session/sequence admission belongs to the existing worker session gate.
export const applyZenPondPetalLandings = (runtimeState, payload) => {
    const { landings, viewportWidth, viewportHeight } = payload;
    if (!Array.isArray(landings) || landings.length === 0
        || landings.length > ZEN_POND_PETAL_LANDING_BATCH_LIMIT) {
        throw new Error('ZEN_POND_PETAL_LANDING_BATCH_INVALID');
    }
    landings.forEach(requireZenPetalLandingDescriptor);
    if (new Set(landings.map(({ id }) => id)).size !== landings.length) {
        throw new Error('ZEN_POND_PETAL_LANDING_BATCH_DUPLICATE');
    }
    if (!Number.isFinite(viewportWidth) || viewportWidth <= 0
        || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
        throw new Error('ZEN_POND_PETAL_LANDING_VIEWPORT_INVALID');
    }
    const rejectBatch = (reason) => ({
        acceptedIds: [],
        rejectedIds: landings.map((landing) => landing.id),
        reason,
    });
    if (!runtimeState.started || !runtimeState.active) return rejectBatch('receiver_inactive');
    if (viewportWidth !== runtimeState.viewportWidth || viewportHeight !== runtimeState.viewportHeight) {
        return rejectBatch('viewport_changed');
    }
    const worldPolicy = runtimeState.refs.frameStateRef.current.worldPolicy;
    if (!isZenPondWorldEntityEnabled(worldPolicy, 'petals')) return rejectBatch('petals_disabled');
    const petals = runtimeState.refs.petalsRef.current;
    const lilyPads = runtimeState.refs.lilyPadsRef.current;
    const disturbances = runtimeState.refs.surfaceDisturbanceEventsRef.current;
    const history = runtimeState.petalLandingHistory;
    if (!Array.isArray(petals) || !Array.isArray(lilyPads)
        || !Array.isArray(disturbances) || !(history instanceof Map)) {
        throw new Error('ZEN_POND_PETAL_LANDING_OWNER_MISSING');
    }
    const transform = resolveZenCoverTransform({
        worldWidth: runtimeState.width,
        worldHeight: runtimeState.height,
        viewportWidth,
        viewportHeight,
    });
    const projected = landings.map((landing) => {
        if (landing.x < 0 || landing.y < 0 || landing.x > viewportWidth || landing.y > viewportHeight) {
            throw new Error('ZEN_POND_PETAL_LANDING_OUTSIDE_VIEWPORT');
        }
        const point = mapZenViewportPointToWorld({
            viewportX: landing.x,
            viewportY: landing.y,
            worldWidth: runtimeState.width,
            worldHeight: runtimeState.height,
            viewportWidth,
            viewportHeight,
        });
        if (!point) throw new Error('ZEN_POND_PETAL_LANDING_WORLD_POINT_INVALID');
        // Input appearance was validated above. World-size admission happens
        // below: a valid CSS candidate can be too large for a zoomed-out pond.
        return {
            ...landing,
            x: point.x,
            y: point.y,
            size: landing.size / transform.scale,
            velocityX: landing.velocityX / transform.scale,
            velocityY: landing.velocityY / transform.scale,
        };
    });
    const acceptedIds = [];
    const rejectedIds = [];
    let sizeMismatch = false;
    let activeCount = petals.reduce((count, petal) => count + Number(petal.active), 0);
    for (const landing of projected) {
        if (landing.size > ZEN_POND_MAX_LANDED_PETAL_SIZE) sizeMismatch = true;
        if (history.has(landing.id)) {
            (history.get(landing.id) ? acceptedIds : rejectedIds).push(landing.id);
            continue;
        }
        const accepted = landing.size <= ZEN_POND_MAX_LANDED_PETAL_SIZE && activeCount < ZEN_POND_LANDED_PETAL_LIMIT;
        history.set(landing.id, accepted);
        if (history.size > ZEN_POND_PETAL_LANDING_HISTORY_LIMIT) {
            history.delete(history.keys().next().value);
        }
        if (!accepted) {
            rejectedIds.push(landing.id);
            continue;
        }
        const petal = createZenLandedFlowerPetal({ landing, lilyPads });
        petals.push(petal);
        activeCount += 1;
        acceptedIds.push(landing.id);
        if (petal.state === 'floating') {
            disturbances.push({
                x: petal.x,
                y: petal.y,
                impulse: 0.32,
                source: ZEN_SURFACE_DISTURBANCE_SOURCES.PETAL,
            });
        }
    }
    return { acceptedIds, rejectedIds, reason: rejectedIds.length ? (sizeMismatch ? 'surface_scale_mismatch' : 'surface_capacity') : 'applied' };
};
