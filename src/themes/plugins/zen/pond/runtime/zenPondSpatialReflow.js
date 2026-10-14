// A resize moves a composition, never rerolls its authored objects. Group-local
// distances preserve pad/flower relationships and the grounded rock silhouette.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const groupBounds = (members) => {
    const extent = (item) => Math.max(12, Number(item.size) || 12) * 1.35;
    return {
        left: Math.min(...members.map((item) => item.x - extent(item))),
        right: Math.max(...members.map((item) => item.x + extent(item))),
        top: Math.min(...members.map((item) => item.y - extent(item))),
        bottom: Math.max(...members.map((item) => item.y + extent(item))),
    };
};

const connectPads = (pads) => {
    const remaining = new Set(pads);
    const groups = [];
    for (const pad of pads) {
        if (!remaining.delete(pad)) continue;
        const group = [pad];
        for (let i = 0; i < group.length; i += 1) {
            for (const other of remaining) {
                if (Math.hypot(group[i].x - other.x, group[i].y - other.y)
                    <= (group[i].size + other.size) * 1.6) {
                    remaining.delete(other);
                    group.push(other);
                }
            }
        }
        groups.push(group);
    }
    return groups;
};

export const captureZenPondComposition = ({ width, height, pads, flowers, rocks, irises }) => {
    const groups = connectPads(pads);
    for (const flower of flowers) {
        const nearest = pads.reduce((best, pad) => (
            !best || Math.hypot(pad.x - flower.x, pad.y - flower.y)
                < Math.hypot(best.x - flower.x, best.y - flower.y) ? pad : best
        ), null);
        if (nearest) groups.find((group) => group.includes(nearest)).push(flower);
        else groups.push([flower]);
    }
    const floatingGroups = new Set(groups);
    // The authored rock hierarchy is a primary trio and a secondary pair.
    if (rocks.length) groups.push(rocks.slice(0, 3));
    if (rocks.length > 3) groups.push(rocks.slice(3));
    for (const iris of irises) groups.push([iris]);
    return groups.map((members) => {
        const bounds = groupBounds(members);
        const x = (bounds.left + bounds.right) / 2;
        const y = (bounds.top + bounds.bottom) / 2;
        const halfWidth = (bounds.right - bounds.left) / 2;
        const halfHeight = (bounds.bottom - bounds.top) / 2;
        const floating = floatingGroups.has(members);
        return {
            u: x / width, v: y / height,
            halfWidth, halfHeight,
            // Preserve an already-authored crop when expanding back to the
            // original extent; a generic minimum must not push it inward.
            clearanceX: floating
                ? Math.min(Math.max(12, halfWidth * 0.45), x, width - x) : halfWidth + 12,
            clearanceY: floating
                ? Math.min(Math.max(12, halfHeight * 0.45), y, height - y) : halfHeight + 12,
            members: members.map((entity) => ({ entity, dx: entity.x - x, dy: entity.y - y })),
        };
    });
};

export const reflowZenPondComposition = (groups, { width, height }) => {
    for (const group of groups) {
        // Floating colonies may continue beyond the cut. Preserve their local
        // flower/pad offsets; grounded rocks and irises retain full clearance.
        const marginX = Math.min(width / 2, group.clearanceX);
        const marginY = Math.min(height / 2, group.clearanceY);
        const x = clamp(group.u * width, marginX, width - marginX);
        const y = clamp(group.v * height, marginY, height - marginY);
        for (const { entity, dx, dy } of group.members) {
            entity.x = x + dx;
            entity.y = y + dy;
        }
    }
};

export const reflowZenPondMovingState = (refs, previous, next) => {
    const sx = next.width / previous.width;
    const sy = next.height / previous.height;
    const move = (point) => {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
        point.x *= sx;
        point.y *= sy;
    };
    for (const fish of refs.fishRef.current) {
        const x = fish.x;
        const y = fish.y;
        move(fish);
        move(fish.roamAnchor);
        const memory = fish.zenKoiBehaviorMemory;
        if (memory) {
            move(memory.response);
            memory.intentCache = null;
        }
        const goal = fish.zenKoiBehaviorMicroGoal;
        if (goal) {
            if (Number.isFinite(goal.targetX)) goal.targetX *= sx;
            if (Number.isFinite(goal.targetY)) goal.targetY *= sy;
            move(goal.target);
        }
        // Translate the entire body, preserving its shape, velocity and heading.
        for (const point of fish.history) { point.x += fish.x - x; point.y += fish.y - y; }
        if (fish.eventBodyFrame && fish.eventBodyFrame.centerline !== fish.history) {
            for (const point of fish.eventBodyFrame.centerline) {
                point.x += fish.x - x;
                point.y += fish.y - y;
            }
        }
        fish.width = next.width;
        fish.height = next.height;
    }
    for (const name of ['particlesRef', 'petalsRef', 'glimmersRef', 'surfaceDisturbancesRef',
        'surfaceDisturbanceEventsRef', 'interactionStimuliRef']) {
        for (const item of refs[name].current) {
            move(item);
            if (Number.isFinite(item.impactX)) item.impactX *= sx;
            if (Number.isFinite(item.impactY)) item.impactY *= sy;
            if (Number.isFinite(item.fallStartY)) item.fallStartY *= sy;
        }
    }
    move(refs.mousePos.current);
};
