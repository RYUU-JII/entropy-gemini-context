/**
 * Detachable natural-wood presentation for the G15.4 research graph.
 *
 * This owner consumes already-projected, already-grown segment geometry. It
 * may smooth paint geometry and add bark/junction envelopes, but it must never
 * write to the developmental graph or feed values back into growth. Projection
 * changes only the final vector coordinates and widths: bark topology is
 * selected in one resolution-independent logical space.
 */
(function installWoodPresentation(scope) {
    'use strict';

    const ontogenyOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerOntogeny;
    if (!ontogenyOwner) {
        throw new Error(
            '[G15_WOOD] Ontogenetic growth owner must load before wood presentation.',
        );
    }
    const {
        SECONDARY_WOOD_GROWTH_SEMANTICS,
        resolveSecondaryWoodGrowth,
    } = ontogenyOwner;

    const CONTRACT_ID = 'g15_4_detachable_mystic_sakura_wood_presentation_v10';
    const WOOD_VECTOR_TOPOLOGY_SEMANTICS =
        'world_space_mystic_sakura_vector_topology_v1';
    const REFERENCE_PROJECTION_SCALE = 0.64;

    /**
     * Neutral ink value scale, warm-neutral so the scene's own light reads on
     * it. These are values, not colours: the wood carries structure and depth,
     * and the runtime tint pass paints them in whatever light the world is in.
     * Nothing here may encode a time of day.
     */
    const SAKURA_BARK = Object.freeze({
        productBase: '#4A463E',
        productShadow: '#1E1C19',
        productHighlight: '#6E695E',
    });

    /**
     * Ink value as a continuous function of girth.
     *
     * This used to be four buckets, which put the trunk a whole step below
     * everything else with nothing in between: one near-black slab against a
     * field of greys. Girth is continuous, so the value is too, and it is
     * logarithmic because the trunk is several times thicker than anything it
     * carries — on a linear ramp every branch would collapse into one tone.
     */
    // The heavy end is a dark mid ink, not black. A thick trunk in ink is not
    // a filled silhouette — its weight comes from pooled edges and the odd
    // dark passage, and painting it near-black turns it into a log.
    const GIRTH_VALUE_HEAVY = -0.08;
    const GIRTH_VALUE_HAIR = 0.185;
    const GIRTH_REFERENCE_RADIUS = 14;

    function girthShade(worldRadius) {
        const normalized = Math.log(1 + Math.max(0, worldRadius))
            / Math.log(1 + GIRTH_REFERENCE_RADIUS);
        return GIRTH_VALUE_HAIR
            + ((GIRTH_VALUE_HEAVY - GIRTH_VALUE_HAIR) * clamp(normalized, 0, 1));
    }

    // How far a surface may travel along the ink scale for being far away.
    // Depth spans roughly 120 world units on a mature specimen, so this is
    // normalized against the scene's own spread rather than a fixed constant.
    const DEPTH_VALUE_LIFT = 0.13;
    /**
     * How loaded the brush is, by vitality.
     *
     * Dry brush is what withering looks like in ink, so a healthy tree cannot
     * be painted with the same brush as a failing one — at full health the
     * default read was already slightly wilted. This is the one place the
     * technique itself carries the tree's state.
     */
    const VITALITY_BRUSH_WETNESS = Object.freeze({
        thriving: 0.66,
        steady: 0.84,
        strained: 1.06,
        withered: 1.22,
    });
    // The edge of a brush stroke is where pigment pools. That darker rim, not
    // a drawn contour, is what separates one stroke from the next.
    const WET_EDGE_SHADE = -0.055;
    const clamp = (value, minimum, maximum) => Math.max(
        minimum,
        Math.min(maximum, value),
    );

    function finite(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function rounded(value, precision = 4) {
        const power = 10 ** precision;
        const result = Math.round(finite(value) * power) / power;
        return Object.is(result, -0) ? 0 : result;
    }

    function hashString(value) {
        let hash = 2166136261;
        const source = String(value);
        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function randomUnit(key, channel = 0) {
        let value = hashString(`${key}:${channel}`) || 1;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        return (value >>> 0) / 4294967296;
    }

    function colorChannels(hex) {
        const source = String(hex).replace('#', '');
        return [
            Number.parseInt(source.slice(0, 2), 16),
            Number.parseInt(source.slice(2, 4), 16),
            Number.parseInt(source.slice(4, 6), 16),
        ];
    }

    function shadeColor(hex, amount) {
        const channels = colorChannels(hex).map((channel) => clamp(
            Math.round(channel + amount * 255),
            0,
            255,
        ));
        return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    }

    function pointDistance(left, right) {
        return Math.hypot(right.x - left.x, right.y - left.y);
    }

    function frameAtArc(points, requestedArc, arcKey = 'arc') {
        const targetArc = clamp(
            requestedArc,
            points[0]?.[arcKey] ?? 0,
            points.at(-1)?.[arcKey] ?? 0,
        );
        let upperIndex = 1;
        while (
            upperIndex < points.length - 1
            && points[upperIndex][arcKey] < targetArc
        ) {
            upperIndex += 1;
        }
        const lower = points[Math.max(0, upperIndex - 1)];
        const upper = points[upperIndex];
        const arcSpan = Math.max(
            1e-7,
            upper[arcKey] - lower[arcKey],
        );
        const point = interpolatePoint(
            lower,
            upper,
            clamp((targetArc - lower[arcKey]) / arcSpan, 0, 1),
        );
        const dx = upper.x - lower.x;
        const dy = upper.y - lower.y;
        const magnitude = Math.max(1e-7, Math.hypot(dx, dy));
        return {
            point,
            tangent: { x: dx / magnitude, y: dy / magnitude },
        };
    }

    function interpolatePoint(left, right, ratio) {
        return {
            x: left.x + (right.x - left.x) * ratio,
            y: left.y + (right.y - left.y) * ratio,
            depth: left.depth + (right.depth - left.depth) * ratio,
            radius: left.radius + (right.radius - left.radius) * ratio,
            worldRadius: left.worldRadius
                + (right.worldRadius - left.worldRadius) * ratio,
            arc: left.arc + (right.arc - left.arc) * ratio,
            worldArc: left.worldArc + (right.worldArc - left.worldArc) * ratio,
        };
    }

    function smoothCenterline(points) {
        if (points.length < 3) return points.map((point) => ({ ...point }));
        const result = [{ ...points[0] }];
        for (let index = 0; index < points.length - 1; index += 1) {
            const left = points[index];
            const right = points[index + 1];
            result.push(interpolatePoint(left, right, 0.24));
            result.push(interpolatePoint(left, right, 0.76));
        }
        result.push({ ...points.at(-1) });
        return result;
    }

    function tangentAt(points, index) {
        const before = points[Math.max(0, index - 1)];
        const after = points[Math.min(points.length - 1, index + 1)];
        const dx = after.x - before.x;
        const dy = after.y - before.y;
        const magnitude = Math.max(1e-7, Math.hypot(dx, dy));
        return { x: dx / magnitude, y: dy / magnitude };
    }

    function offsetPoint(point, tangent, distance) {
        return {
            x: rounded(point.x - tangent.y * distance),
            y: rounded(point.y + tangent.x * distance),
        };
    }

    function ribbonPolygon(points, expansion = 0, minimumRadius = 0.38) {
        const left = [];
        const right = [];
        points.forEach((point, index) => {
            const tangent = tangentAt(points, index);
            const radius = Math.max(minimumRadius, point.radius + expansion);
            left.push(offsetPoint(point, tangent, radius));
            right.push(offsetPoint(point, tangent, -radius));
        });
        return [...left, ...right.reverse()];
    }

    function ribbonSideBand(points, outerRatio, innerRatio) {
        const outer = [];
        const inner = [];
        points.forEach((point, index) => {
            const tangent = tangentAt(points, index);
            outer.push(offsetPoint(point, tangent, point.radius * outerRatio));
            inner.push(offsetPoint(point, tangent, point.radius * innerRatio));
        });
        return [...outer, ...inner.reverse()];
    }

    // How the shoulder at a fork is closed. Spans are in projected pixels at the
    // reference projection scale; `projectionRatio` carries them to any other.
    const FILLET_ARC_STEPS = 4;
    // How far past the halfway point each lobe carries, as a share of the arc.
    // The two lobes ride different rigs and turn by different amounts, so an
    // abutting seam would part; an overlapping one cannot, and since both lobes
    // are opaque wood the overlap is invisible.
    const FILLET_SEAM_OVERLAP = 0.2;
    // Below this the two axes are close enough to parallel that their edges
    // meet nowhere useful — and a branch that leaves along its parent has no
    // notch to close in the first place.
    const FILLET_MINIMUM_CROSS = 0.16;
    // How far back along each axis the collar blends, in radii of the finer of
    // the two. A collar reads as swelling, not as a splint.
    const FILLET_SPAN = 1.45;
    const FILLET_MAXIMUM_SPAN = 5.2;
    // How far toward the corner the collar swells, as a share of the distance
    // from each anchor. 2/3 reproduces a plain quadratic and fills a third of
    // the corner; wood is fuller than that.
    const FILLET_FULLNESS = 0.55;
    // A first-order bough this thick is read as a division of the trunk, not
    // as a small branch attached to it. Its first brush frames must therefore
    // inherit the trunk's ink load; otherwise the bough begins as a lighter
    // rectangular sleeve even when the geometric shoulder is fully closed.
    const STRUCTURAL_TRUNK_BRANCH_MINIMUM_RADIUS_RATIO = 0.42;
    const STRUCTURAL_TRUNK_BRANCH_HEAD_BLEND_FRACTION = 0.08;

    function normalizedDirection(direction) {
        const magnitude = Math.max(1e-7, Math.hypot(direction.x, direction.y));
        return { x: direction.x / magnitude, y: direction.y / magnitude };
    }

    function cross2(left, right) {
        return (left.x * right.y) - (left.y * right.x);
    }

    /**
     * Where two ribbon edges on one side of a fork actually meet.
     *
     * Both edges are offset centrelines, so this is a plain line/line solve in
     * the projected plane. `alongParent` and `alongChild` come back as signed
     * distances from the node along each axis, which is what tells the caller
     * whether the corner sits on the wood arriving at this node or on the wood
     * continuing past it — a question that cannot be answered by inspecting the
     * branch angle, because a branch leaning forward crosses the parent's flank
     * *above* the joint it left.
     */
    function shoulderCorner(node, parentDirection, parentRadius, childDirection, childRadius, side) {
        const denominator = cross2(parentDirection, childDirection);
        if (Math.abs(denominator) < FILLET_MINIMUM_CROSS) return null;
        const parentNormal = { x: -parentDirection.y * side, y: parentDirection.x * side };
        const childNormal = { x: -childDirection.y * side, y: childDirection.x * side };
        const delta = {
            x: (childNormal.x * childRadius) - (parentNormal.x * parentRadius),
            y: (childNormal.y * childRadius) - (parentNormal.y * parentRadius),
        };
        return {
            parentNormal,
            alongParent: cross2(delta, childDirection) / denominator,
            alongChild: cross2(delta, parentDirection) / denominator,
        };
    }

    /**
     * A cubic through the collar's corner, tangent to both ribbon edges.
     *
     * Cubic rather than quadratic so fullness and tangency are separable. A
     * quadratic through the corner is fixed at filling a third of it; wood is
     * fuller than that, and pulling a quadratic outward to compensate means
     * moving its control point off the edges, which puts a kink back exactly
     * where the collar is supposed to disappear into the surface. Sliding two
     * cubic controls *along* those edges fills the corner without ever leaving
     * them, so the join stays smooth however full the collar is set.
     */
    function collarPoint(from, corner, to, t) {
        const firstControl = {
            x: from.x + ((corner.x - from.x) * FILLET_FULLNESS),
            y: from.y + ((corner.y - from.y) * FILLET_FULLNESS),
        };
        const secondControl = {
            x: to.x + ((corner.x - to.x) * FILLET_FULLNESS),
            y: to.y + ((corner.y - to.y) * FILLET_FULLNESS),
        };
        const inverse = 1 - t;
        const a = inverse * inverse * inverse;
        const b = 3 * inverse * inverse * t;
        const c = 3 * inverse * t * t;
        const d = t * t * t;
        return {
            x: (a * from.x) + (b * firstControl.x) + (c * secondControl.x) + (d * to.x),
            y: (a * from.y) + (b * firstControl.y) + (c * secondControl.y) + (d * to.y),
        };
    }

    function roundedVertex(point) {
        return { x: rounded(point.x), y: rounded(point.y) };
    }

    /**
     * The collar that closes one side of one branch departure.
     *
     * Two ink ribbons crossing at an angle leave a notch on each side of the
     * branch, where one silhouette's edge runs into the other's. Wood closes
     * those with a collar — a fillet tangent to both surfaces — and that is what
     * this builds: the corner where the two edges meet, cut back by a span along
     * each axis, with a quadratic through the corner rounding the two anchors
     * together. Because the curve leaves each anchor along its own edge, the
     * collar meets both ribbons smoothly instead of crossing them.
     *
     * What it replaces was a plate rather than a collar: one quadrilateral from
     * behind the parent to out along the child, at full ribbon width plus an
     * outline expansion on top of that. Its four corners stood clear of both
     * ribbons *at rest* on better than nine junctions in ten, by as much as six
     * pixels, and being flat, solid, and a shade darker than the brushed wood
     * around it, every one of them read as a rectangular chip stuck on the fork.
     * Motion had nothing to do with it, which is why it never moved.
     *
     * The collar comes back in two lobes, split at the joint. A single piece
     * spans two rigs and can only ride one of them, so whichever it rides, it
     * shears against the other whenever the branch swings. Split at the node —
     * which is the child rig's own pivot, and therefore the one point the two
     * rigs share exactly — each lobe stays welded to the wood it belongs to.
     * They overlap across the seam so the split itself cannot open either.
     */
    function junctionCollar({
        node,
        incoming,
        continuation,
        outgoing,
        side,
        projectionRatio,
    }) {
        const childDirection = normalizedDirection(directionOf(outgoing));
        const childRadius = Math.max(0.38 * projectionRatio, outgoing.start.radius);
        const incomingDirection = normalizedDirection(directionOf(incoming));
        const incomingRadius = Math.max(0.5 * projectionRatio, incoming.end.radius);

        let parentEntry = incoming;
        let parentDirection = incomingDirection;
        let parentRadius = incomingRadius;
        let solved = shoulderCorner(
            node, parentDirection, parentRadius, childDirection, childRadius, side,
        );
        if (!solved) return null;
        // The corner landed past the joint, so the surface it belongs to is the
        // axis carrying on through — a different segment, at its own angle.
        if (solved.alongParent > 0 && continuation) {
            parentEntry = continuation;
            parentDirection = normalizedDirection(directionOf(continuation));
            parentRadius = Math.max(0.5 * projectionRatio, continuation.start.radius);
            solved = shoulderCorner(
                node, parentDirection, parentRadius, childDirection, childRadius, side,
            );
            if (!solved) return null;
        }
        // Behind the branch's own start the two ribbons already overlap: that
        // side of the fork is a spike, not a notch, and needs no filling.
        if (!(solved.alongChild > 0)) return null;
        // Ahead of the joint with nothing continuing there is no surface to
        // blend into, only sky.
        if (solved.alongParent > 0 && !continuation) return null;

        const corner = {
            x: node.point.x + (solved.parentNormal.x * parentRadius)
                + (parentDirection.x * solved.alongParent),
            y: node.point.y + (solved.parentNormal.y * parentRadius)
                + (parentDirection.y * solved.alongParent),
        };
        const parentRun = Math.hypot(
            parentEntry.end.x - parentEntry.start.x,
            parentEntry.end.y - parentEntry.start.y,
        );
        const childRun = Math.hypot(
            outgoing.end.x - outgoing.start.x,
            outgoing.end.y - outgoing.start.y,
        );
        // Anchored on wood that is actually drawn, at both ends.
        const span = Math.min(
            Math.min(parentRadius, childRadius) * FILLET_SPAN,
            FILLET_MAXIMUM_SPAN * projectionRatio,
            solved.alongParent + parentRun,
            childRun - solved.alongChild,
        );
        if (!(span > 0.3 * projectionRatio)) return null;

        const parentAnchor = {
            x: corner.x - (parentDirection.x * span),
            y: corner.y - (parentDirection.y * span),
        };
        const childAnchor = {
            x: corner.x + (childDirection.x * span),
            y: corner.y + (childDirection.y * span),
        };

        const parentLobe = [roundedVertex(parentAnchor)];
        const parentLimit = 0.5 + FILLET_SEAM_OVERLAP;
        for (let step = 1; step <= FILLET_ARC_STEPS; step += 1) {
            const t = (step / FILLET_ARC_STEPS) * parentLimit;
            parentLobe.push(roundedVertex(collarPoint(parentAnchor, corner, childAnchor, t)));
        }
        parentLobe.push(roundedVertex(corner));

        const childLobe = [roundedVertex(corner)];
        const childStart = 0.5 - FILLET_SEAM_OVERLAP;
        for (let step = 0; step < FILLET_ARC_STEPS; step += 1) {
            const t = childStart + ((step / FILLET_ARC_STEPS) * (1 - childStart));
            childLobe.push(roundedVertex(collarPoint(parentAnchor, corner, childAnchor, t)));
        }
        childLobe.push(roundedVertex(childAnchor));

        return { parentEntry, parentLobe, childLobe };
    }

    /**
     * Close the convex shoulder where one visible trunk axis changes lineage.
     *
     * The generic fork collar solves the intersection of two offset infinite
     * lines. At an axis handoff the missing region is instead between the two
     * finite ribbon heads themselves, and the useful intersection can sit past
     * the joint where no parent ribbon exists. A short cubic between their
     * outer edges is the direct construction: its controls lie on the parent
     * and child edges, so it leaves and arrives tangent to both. The polygon is
     * split through the shared pivot for the same cross-rig reason as the
     * ordinary collar.
     */
    function axisHandoffCollar({ node, incoming, outgoing, projectionRatio }) {
        const parentDirection = normalizedDirection(directionOf(incoming));
        const childDirection = normalizedDirection(directionOf(outgoing));
        const turn = cross2(parentDirection, childDirection);
        if (Math.abs(turn) < FILLET_MINIMUM_CROSS) return null;

        const side = turn > 0 ? -1 : 1;
        const parentNormal = {
            x: -parentDirection.y * side,
            y: parentDirection.x * side,
        };
        const childNormal = {
            x: -childDirection.y * side,
            y: childDirection.x * side,
        };
        const parentRadius = Math.max(0.5 * projectionRatio, incoming.end.radius);
        const childRadius = Math.max(0.38 * projectionRatio, outgoing.start.radius);
        const parentRun = Math.hypot(
            incoming.end.x - incoming.start.x,
            incoming.end.y - incoming.start.y,
        );
        const childRun = Math.hypot(
            outgoing.end.x - outgoing.start.x,
            outgoing.end.y - outgoing.start.y,
        );
        const span = Math.min(
            Math.min(parentRadius, childRadius) * 1.2,
            4.8 * projectionRatio,
            parentRun * 0.36,
            childRun * 0.36,
        );
        if (!(span > 0.3 * projectionRatio)) return null;

        const parentEdge = {
            x: node.point.x + (parentNormal.x * parentRadius),
            y: node.point.y + (parentNormal.y * parentRadius),
        };
        const childEdge = {
            x: node.point.x + (childNormal.x * childRadius),
            y: node.point.y + (childNormal.y * childRadius),
        };
        const from = {
            x: parentEdge.x - (parentDirection.x * span),
            y: parentEdge.y - (parentDirection.y * span),
        };
        const to = {
            x: childEdge.x + (childDirection.x * span),
            y: childEdge.y + (childDirection.y * span),
        };
        const edgePoint = (t) => {
            const inverse = 1 - t;
            const a = inverse * inverse * inverse;
            const b = 3 * inverse * inverse * t;
            const c = 3 * inverse * t * t;
            const d = t * t * t;
            return roundedVertex({
                x: (a * from.x) + (b * parentEdge.x) + (c * childEdge.x) + (d * to.x),
                y: (a * from.y) + (b * parentEdge.y) + (c * childEdge.y) + (d * to.y),
            });
        };
        const parentLobe = [];
        for (let step = 0; step <= FILLET_ARC_STEPS; step += 1) {
            parentLobe.push(edgePoint((step / FILLET_ARC_STEPS) * 0.65));
        }
        parentLobe.push(roundedVertex(node.point));

        const childLobe = [roundedVertex(node.point)];
        for (let step = 0; step <= FILLET_ARC_STEPS; step += 1) {
            childLobe.push(edgePoint(0.35 + ((step / FILLET_ARC_STEPS) * 0.65)));
        }
        return { parentLobe, childLobe };
    }

    function normalizeEntry(entry, index, projectionScale) {
        const segment = entry?.segment || {};
        const start = entry?.start;
        const end = entry?.end;
        if (!start || !end) {
            throw new TypeError(`[G15_WOOD] Entry ${index} requires projected start/end points.`);
        }
        const projectionRatio = projectionScale / REFERENCE_PROJECTION_SCALE;
        const startWorldRadius = Math.max(0.01, finite(
            entry.startRadiusWorld ?? segment.startRadius,
            0.5 / REFERENCE_PROJECTION_SCALE,
        ));
        const endWorldRadius = Math.max(0.01, finite(
            entry.endRadiusWorld ?? segment.endRadius,
            0.38 / REFERENCE_PROJECTION_SCALE,
        ));
        const startRadius = Math.max(
            0.5 * projectionRatio,
            finite(entry.startRadiusPx, startWorldRadius * projectionScale),
        );
        const endRadius = Math.max(
            0.38 * projectionRatio,
            finite(entry.endRadiusPx, endWorldRadius * projectionScale),
        );
        return {
            id: String(segment.id ?? entry.id ?? `wood-segment-${index}`),
            sequence: finite(segment.sequence ?? segment.birthEvent, index),
            lineageId: String(segment.lineageId ?? entry.lineageId ?? 'unreported'),
            presentationLineageId: String(
                entry.presentationLineageId
                    ?? segment.presentationLineageId
                    ?? segment.lineageId
                    ?? `wood-lineage-${index}`,
            ),
            fromNodeId: String(entry.fromNodeId ?? segment.fromNodeId ?? `${index}:from`),
            toNodeId: String(entry.toNodeId ?? segment.toNodeId ?? `${index}:to`),
            tier: clamp(Math.round(finite(segment.tier ?? segment.axisOrder, 2)), 0, 2),
            axisOrder: Math.max(0, Math.round(finite(
                segment.axisOrder ?? segment.tier,
                2,
            ))),
            birthEvent: Math.max(0, finite(
                segment.birthEvent ?? segment.sequence,
                0,
            )),
            birthMode: String(segment.birthMode || entry.birthMode || ''),
            resourceShare: clamp(finite(
                segment.resourceShare ?? entry.resourceShare,
                0,
            ), 0, 1),
            isCanopyTwig: Boolean(entry.isCanopyTwig),
            developmentProgress: entry.developmentProgress === undefined ? 1 : entry.developmentProgress,
            rootOrigin: Boolean(
                (segment.birthMode || entry.birthMode) === 'root_emergence'
                && Number(segment.axisOrder ?? segment.tier ?? 0) === 0
                && Number(segment.birthEvent ?? segment.sequence ?? 0) <= 1,
            ),
            projectionScale,
            start: {
                x: finite(start.x),
                y: finite(start.y),
                depth: finite(start.depth),
                radius: startRadius,
                worldRadius: startWorldRadius,
            },
            end: {
                x: finite(end.x),
                y: finite(end.y),
                depth: finite(end.depth),
                radius: endRadius,
                worldRadius: endWorldRadius,
            },
        };
    }

    function chainEntries(entries) {
        const byLineage = new Map();
        entries.forEach((entry) => {
            if (!byLineage.has(entry.presentationLineageId)) {
                byLineage.set(entry.presentationLineageId, []);
            }
            byLineage.get(entry.presentationLineageId).push(entry);
        });
        const chains = [];
        byLineage.forEach((lineageEntries, lineageId) => {
            const outgoing = new Map();
            const incomingCount = new Map();
            lineageEntries.forEach((entry) => {
                if (!outgoing.has(entry.fromNodeId)) outgoing.set(entry.fromNodeId, []);
                outgoing.get(entry.fromNodeId).push(entry);
                incomingCount.set(entry.toNodeId, (incomingCount.get(entry.toNodeId) || 0) + 1);
            });
            outgoing.forEach((items) => items.sort((left, right) => (
                left.sequence - right.sequence || left.id.localeCompare(right.id)
            )));
            const starts = lineageEntries.filter(
                (entry) => !incomingCount.has(entry.fromNodeId),
            ).sort((left, right) => left.sequence - right.sequence);
            const visited = new Set();
            function follow(first) {
                const chain = [];
                let current = first;
                while (current && !visited.has(current.id)) {
                    visited.add(current.id);
                    chain.push(current);
                    current = (outgoing.get(current.toNodeId) || []).find(
                        (candidate) => !visited.has(candidate.id),
                    );
                }
                if (chain.length) chains.push({ lineageId, entries: chain });
            }
            starts.forEach(follow);
            lineageEntries
                .sort((left, right) => left.sequence - right.sequence)
                .forEach((entry) => {
                    if (!visited.has(entry.id)) follow(entry);
                });
        });
        return chains;
    }

    function supportedLoadByEntry(entries, juvenileAxisRetirements = []) {
        const outgoing = new Map();
        entries.forEach((entry) => {
            if (!outgoing.has(entry.fromNodeId)) outgoing.set(entry.fromNodeId, []);
            outgoing.get(entry.fromNodeId).push(entry);
        });
        const memo = new Map();
        function descendantCount(nodeId, visiting = new Set()) {
            if (memo.has(nodeId)) return memo.get(nodeId);
            if (visiting.has(nodeId)) return 0;
            const nextVisiting = new Set(visiting);
            nextVisiting.add(nodeId);
            const total = (outgoing.get(nodeId) || []).reduce(
                (sum, entry) => sum + entry.developmentProgress
                    + descendantCount(entry.toNodeId, nextVisiting),
                0,
            );
            memo.set(nodeId, total);
            return total;
        }
        const counts = new Map(entries.map((entry) => [
            entry.id,
            descendantCount(entry.toNodeId),
        ]));
        const maximum = Math.max(1, ...counts.values());
        const load = new Map([...counts.entries()].map(([id, count]) => [
            id,
            clamp(Math.log1p(count) / Math.log1p(maximum), 0, 1),
        ]));
        juvenileAxisRetirements.forEach((retirement) => {
            const contribution = clamp(
                finite(retirement.cambialContribution, 0),
                0,
                0.22,
            );
            entries.filter((entry) => (
                entry.lineageId === retirement.parentLineageId
                && entry.birthEvent <= finite(retirement.emittedAtEvent, 0)
            )).forEach((entry) => {
                load.set(entry.id, clamp(
                    finite(load.get(entry.id), 0) + contribution * 2,
                    0,
                    1.25,
                ));
            });
        });
        return load;
    }

    function centerlineFor(chain, eventLimit, supportedLoad) {
        let arc = 0;
        let worldArc = 0;
        const first = chain.entries[0];
        const projectionScale = Math.max(1e-7, first.projectionScale);
        const chainWorldArcLength = Math.max(1e-7, chain.entries.reduce(
            (total, entry) => total
                + pointDistance(entry.start, entry.end) / projectionScale,
            0,
        ));
        function maturedPoint(
            point,
            entry,
            birthEvent,
            arcPosition,
            worldArcPosition,
            rootOrigin,
        ) {
            if (entry.isCanopyTwig) {
                return {
                    ...point,
                    arc: arcPosition,
                    worldArc: worldArcPosition,
                };
            }
            const secondaryGrowth = resolveSecondaryWoodGrowth({
                axisOrder: entry.axisOrder,
                eventLimit,
                birthEvent,
                supportedLoad: supportedLoad.get(entry.id) || 0,
                rootOrigin,
                rootFamily: first.rootOrigin,
                rootArcFraction: worldArcPosition / chainWorldArcLength,
            });
            return {
                ...point,
                radius: point.radius * secondaryGrowth.radiusScale,
                worldRadius: point.worldRadius * secondaryGrowth.radiusScale,
                arc: arcPosition,
                worldArc: worldArcPosition,
                secondaryGrowth,
            };
        }
        const points = [maturedPoint(
            first.start,
            first,
            first.rootOrigin ? 0 : first.birthEvent,
            arc,
            worldArc,
            first.rootOrigin,
        )];
        chain.entries.forEach((entry) => {
            const projectedLength = pointDistance(entry.start, entry.end);
            arc += projectedLength;
            worldArc += projectedLength / projectionScale;
            points.push(maturedPoint(
                entry.end,
                entry,
                entry.birthEvent,
                arc,
                worldArc,
                false,
            ));
        });
        return smoothCenterline(points);
    }

    /**
     * Ink density for one surface.
     *
     * Girth sets the base value — heavy wood takes a loaded brush, twigs take a
     * dry one — and depth lifts it toward the far tone. With no drawn contour,
     * this value difference is the only thing separating an overlapping front
     * branch from the branch behind it, so the depth term has to carry real
     * range instead of the hairline shade it used to apply.
     */
    function surfacePalette(points, tier, depth, depthNormalizer) {
        const radii = points.map((point) => point.worldRadius);
        const baseRadius = Math.max(...radii);
        const tipRadius = points.at(-1).worldRadius;
        const baseShade = girthShade(baseRadius);
        const farness = typeof depthNormalizer === 'function'
            ? clamp(depthNormalizer(depth), 0, 1)
            : 0.5;
        const depthShade = (farness - 0.35) * DEPTH_VALUE_LIFT;
        const fill = shadeColor(SAKURA_BARK.productBase, baseShade + depthShade);
        return {
            fill,
            // How much lighter the same stroke is where it has thinned out.
            // Carrying the girth ramp *along* the stroke is what keeps a
            // tapering trunk from meeting its own branches at a cliff.
            tipShift: rounded(girthShade(tipRadius) - baseShade, 4),
            // Wet edge: same ink, pooled. Never a contour colour of its own.
            outline: shadeColor(fill, WET_EDGE_SHADE),
            collar: shadeColor(fill, 0.02),
        };
    }

    function buildLongitudinalGrain(surfaceKey, points, projectionScale) {
        const projectionRatio = projectionScale / REFERENCE_PROJECTION_SCALE;
        const maxRadius = Math.max(...points.map((p) => p.worldRadius * REFERENCE_PROJECTION_SCALE));
        if (maxRadius < 2.0 || points.length < 3) return [];

        const grainLines = [];
        const offsets = [-0.58, -0.22, 0.24, 0.62];

        offsets.forEach((uOffset, streamIdx) => {
            const streamPoints = [];
            const isHighlight = uOffset < 0;
            const strokeColor = isHighlight
                ? 'rgba(236, 232, 222, 0.075)'
                : 'rgba(18, 17, 15, 0.15)';
            const lineWidth = rounded(clamp(0.28 * projectionRatio, 0.2, 0.7));

            points.forEach((point, idx) => {
                const tangent = tangentAt(points, idx);
                // Subtle noise deviation along the wood fiber
                const noiseJitter = (randomUnit(surfaceKey, idx * 7 + streamIdx * 13) - 0.5) * 0.12;
                const effectiveOffset = clamp(uOffset + noiseJitter, -0.85, 0.85);
                const fiberPoint = offsetPoint(point, tangent, point.radius * effectiveOffset);
                streamPoints.push(fiberPoint);
            });

            if (streamPoints.length >= 2) {
                grainLines.push({
                    id: `${surfaceKey}:grain:${streamIdx}`,
                    kind: 'sakura_cambium_grain',
                    points: streamPoints,
                    stroke: strokeColor,
                    lineWidth,
                });
            }
        });

        return grainLines;
    }

    function buildTexture(surfaceKey, points, projectionScale) {
        const projectionRatio = projectionScale / REFERENCE_PROJECTION_SCALE;
        const maximumReferenceRadius = Math.max(
            ...points.map((point) => (
                point.worldRadius * REFERENCE_PROJECTION_SCALE
            )),
        );
        const totalWorldArc = points.at(-1).worldArc;
        const totalReferenceArc = totalWorldArc * REFERENCE_PROJECTION_SCALE;
        const strokes = [];

        // Longitudinal grain is gone: the ink ribbon's bristle bands run the
        // length of the stroke and already do that job. Drawing fibres on top
        // of them crossed the lenticel dashes and read as a woven grid.
        //
        // Lenticels stay, because a cherry's banded bark is a real signature —
        // but only on wood heavy enough for them to land as marks rather than
        // as noise, and quiet enough not to compete with the bristles.
        if (maximumReferenceRadius >= 6 && totalReferenceArc >= 24) {
            const spacing = (
                26 + randomUnit(surfaceKey, 17) * 13
            ) / REFERENCE_PROJECTION_SCALE;
            const firstArc = spacing * (
                0.48 + randomUnit(surfaceKey, 18) * 0.44
            );
            let strokeIndex = 0;
            for (
                let distance = firstArc;
                distance < totalWorldArc - 6 / REFERENCE_PROJECTION_SCALE;
                distance += spacing
            ) {
                const frame = frameAtArc(points, distance, 'worldArc');
                const { point, tangent } = frame;
                if (
                    point.worldRadius * REFERENCE_PROJECTION_SCALE < 2.1
                ) continue;
                const canonicalArc = rounded(
                    distance * REFERENCE_PROJECTION_SCALE,
                );
                const halfWidth = point.radius * (
                    0.18 + randomUnit(surfaceKey, canonicalArc * 3) * 0.22
                );
                const darkStart = offsetPoint(point, tangent, -halfWidth);
                const darkEnd = offsetPoint(point, tangent, halfWidth);

                // Deep lenticel shadow / crevice
                strokes.push({
                    id: `${surfaceKey}:lenticel:${strokeIndex}:shadow`,
                    kind: 'sakura_lenticel_shadow',
                    canonicalArc,
                    points: [darkStart, darkEnd],
                    stroke: 'rgba(18, 17, 15, 0.13)',
                    lineWidth: rounded(clamp(
                        point.radius * 0.06,
                        0.32 * projectionRatio,
                        0.78 * projectionRatio,
                    )),
                });

                // Raised lenticel lip highlight
                if (point.worldRadius * REFERENCE_PROJECTION_SCALE >= 3.8) {
                    const lift = clamp(
                        point.radius * 0.038,
                        0.22 * projectionRatio,
                        0.55 * projectionRatio,
                    );
                    strokes.push({
                        id: `${surfaceKey}:lenticel:${strokeIndex}:lip`,
                        kind: 'sakura_lenticel_lip',
                        canonicalArc,
                        points: [
                            {
                                x: rounded(darkStart.x + tangent.x * lift),
                                y: rounded(darkStart.y + tangent.y * lift),
                            },
                            {
                                x: rounded(darkEnd.x + tangent.x * lift),
                                y: rounded(darkEnd.y + tangent.y * lift),
                            },
                        ],
                        stroke: 'rgba(214, 209, 198, 0.09)',
                        lineWidth: rounded(clamp(
                            point.radius * 0.038,
                            0.26 * projectionRatio,
                            0.55 * projectionRatio,
                        )),
                    });
                }
                strokeIndex += 1;
            }
        }
        return strokes;
    }

    function terminallyTaperedPoints(points, chain, terminal) {
        if (!terminal || points.length < 2) return points;
        const finalEntry = chain.entries.at(-1);
        const terminalSpan = Math.max(
            1e-7,
            pointDistance(finalEntry.start, finalEntry.end) * 0.9,
        );
        const finalArc = points.at(-1).arc;
        const taperStart = Math.max(0, finalArc - terminalSpan);
        return points.map((point) => {
            const progress = clamp(
                (point.arc - taperStart) / terminalSpan,
                0,
                1,
            );
            if (progress <= 0) return point;
            const eased = progress * progress * (3 - 2 * progress);
            const scale = 1 - eased * 0.48;
            return {
                ...point,
                radius: point.radius * scale,
                worldRadius: point.worldRadius * scale,
            };
        });
    }

    /**
     * Grow the root-order trunk into its own nebari shoulder.
     *
     * This flare used to be a separate opaque collar painted over the finished
     * trunk. Even with the same nominal colour it could not share the ribbon's
     * pooled edge or longitudinal value flow, so its top edge read as a patch.
     * Changing the first frames of the actual wood stroke keeps the material,
     * tangent and motion owner continuous. The cubic falloff has zero slope at
     * both ends, avoiding a new width step where the flare returns to the bole.
     */
    function basalFlaredPoints(points, chain, maturity, projectionScale) {
        const first = chain.entries[0];
        if (!first?.rootOrigin || points.length < 2) {
            return {
                points,
                receipt: Object.freeze({ applied: false }),
            };
        }
        const projectionRatio = projectionScale / REFERENCE_PROJECTION_SCALE;
        const baseRadiusBefore = Math.max(0.5 * projectionRatio, points[0].radius);
        const flareSpan = clamp(
            baseRadiusBefore * 1.85,
            7 * projectionRatio,
            28 * projectionRatio,
        );
        const baseExpansion = 0.18 + (0.18 * clamp(maturity, 0, 1));
        const flared = points.map((point) => {
            const progress = clamp(point.arc / Math.max(1e-7, flareSpan), 0, 1);
            const smooth = progress * progress * (3 - (2 * progress));
            const scale = 1 + (baseExpansion * (1 - smooth));
            return {
                ...point,
                radius: point.radius * scale,
                worldRadius: point.worldRadius * scale,
            };
        });
        return {
            points: flared,
            receipt: Object.freeze({
                applied: true,
                semantics: 'root_order_wood_ribbon_c1_basal_flare',
                baseRadiusBefore: rounded(baseRadiusBefore),
                baseRadiusAfter: rounded(flared[0].radius),
                flareSpan: rounded(flareSpan),
                expansion: rounded(baseExpansion, 4),
            }),
        };
    }

    /**
     * Maps this scene's own depth spread onto 0 (nearest) to 1 (furthest).
     *
     * The spread depends on the specimen and the camera yaw, so a fixed
     * constant would flatten one tree and blow out the next. Trimmed at the
     * 5th/95th percentile so a single outlying twig cannot compress everything
     * else into one tone.
     */
    function resolveDepthNormalizer(entries) {
        const depths = [];
        entries.forEach((entry) => {
            depths.push(finite(entry.start?.depth), finite(entry.end?.depth));
        });
        if (depths.length < 2) return () => 0.5;
        depths.sort((left, right) => left - right);
        const low = depths[Math.floor(depths.length * 0.05)];
        const high = depths[Math.floor(depths.length * 0.95)];
        const span = high - low;
        if (!(span > 1e-6)) return () => 0.5;
        return (depth) => (finite(depth) - low) / span;
    }

    function buildSurface(
        chain,
        seed,
        eventLimit,
        supportedLoad,
        terminal,
        projectionScale,
        depthNormalizer,
        brushWetness,
        maturity,
    ) {
        const basalFlare = basalFlaredPoints(
            centerlineFor(chain, eventLimit, supportedLoad),
            chain,
            maturity,
            projectionScale,
        );
        const points = terminallyTaperedPoints(
            basalFlare.points,
            chain,
            terminal,
        );
        const secondaryGrowthReceipts = points
            .map((point) => point.secondaryGrowth)
            .filter(Boolean);
        const first = chain.entries[0];
        const averageDepth = points.reduce((total, point) => total + point.depth, 0)
            / points.length;
        const palette = surfacePalette(points, first.tier, averageDepth, depthNormalizer);
        const surfaceKey = `${seed}:${chain.lineageId}`;
        const maximumReferenceRadius = Math.max(
            ...points.map((point) => (
                point.worldRadius * REFERENCE_PROJECTION_SCALE
            )),
        );
        const projectionRatio = projectionScale / REFERENCE_PROJECTION_SCALE;
        const minimumProjectedRadius = 0.38 * projectionRatio;
        const outlineExpansion = clamp(
            maximumReferenceRadius * 0.055,
            0.55,
            1.05,
        ) * projectionRatio;
        const textureStrokes = buildTexture(
            surfaceKey,
            points,
            projectionScale,
        );

        // No cylindrical shading bands. A specular rim and a four-step cel
        // ramp describe a moulded plastic tube; a brush stroke has one value,
        // a pooled edge, and dry-brush breakup. Volume is carried by the wet
        // edge and the texture strokes below instead.
        const rimHighlightBand = null;
        const lightBand = null;
        const shadowBand = null;
        const ambientOcclusionBand = null;

        // How dry the brush is by the time it reaches this surface's tip. Heavy
        // wood is a loaded stroke that stays solid; a twig is the last of the
        // ink on the bristles, and a terminating axis has nothing following it
        // to reload from.
        const brushDryness = clamp(
            (
                0.24
                + ((1 - clamp(maximumReferenceRadius / 9, 0, 1)) * 0.52)
                + (terminal ? 0.14 : 0)
            ) * brushWetness,
            0.12,
            0.86,
        );

        return {
            id: `wood-surface:${chain.lineageId}`,
            brushDryness: rounded(brushDryness, 3),
            lineageId: chain.lineageId,
            sourceLineageId: first.lineageId,
            tier: first.tier,
            averageDepth: rounded(averageDepth),
            outlinePolygon: ribbonPolygon(
                points,
                outlineExpansion,
                minimumProjectedRadius,
            ),
            bodyPolygon: ribbonPolygon(
                points,
                0,
                minimumProjectedRadius,
            ),
            outlineFill: palette.outline,
            bodyFill: palette.fill,
            tipShift: palette.tipShift,
            collarFill: palette.collar,
            rimHighlightBand,
            lightBand,
            shadowBand,
            ambientOcclusionBand,
            textureStrokes,
            minimumProjectedRadius: rounded(minimumProjectedRadius),
            startNodeId: first.fromNodeId,
            endNodeId: chain.entries.at(-1).toNodeId,
            startRadius: points[0].radius,
            endRadius: points.at(-1).radius,
            centerline: points.map((point) => ({
                x: rounded(point.x),
                y: rounded(point.y),
                radius: rounded(point.radius),
                arc: rounded(point.arc),
            })),
            basalFlare: basalFlare.receipt,
            secondaryGrowth: Object.freeze({
                semantics: SECONDARY_WOOD_GROWTH_SEMANTICS,
                minimumRadiusScale: rounded(Math.min(
                    ...secondaryGrowthReceipts.map((receipt) => (
                        receipt.radiusScale
                    )),
                )),
                maximumRadiusScale: rounded(Math.max(
                    ...secondaryGrowthReceipts.map((receipt) => (
                        receipt.radiusScale
                    )),
                )),
            }),
        };
    }

    function directionOf(entry) {
        return {
            x: entry.end.x - entry.start.x,
            y: entry.end.y - entry.start.y,
        };
    }

    function buildJunctions(entries, surfaceMap, projectionRatio) {
        const nodes = new Map();
        function nodeRecord(id, point) {
            if (!nodes.has(id)) {
                nodes.set(id, { id, point, incoming: [], outgoing: [] });
            }
            return nodes.get(id);
        }
        entries.forEach((entry) => {
            nodeRecord(entry.fromNodeId, entry.start).outgoing.push(entry);
            nodeRecord(entry.toNodeId, entry.end).incoming.push(entry);
        });
        const junctions = [];
        nodes.forEach((node) => {
            if (node.outgoing.length < 2 || node.incoming.length < 1) return;
            const incoming = [...node.incoming].sort(
                (left, right) => right.end.radius - left.end.radius,
            )[0];
            const lineageContinuation = node.outgoing.find(
                (entry) => entry.presentationLineageId === incoming.presentationLineageId,
            );
            const orderZeroSuccessors = incoming.axisOrder === 0
                ? node.outgoing.filter((entry) => entry.axisOrder === 0).sort(
                    (left, right) => right.start.radius - left.start.radius
                        || right.resourceShare - left.resourceShare
                        || left.sequence - right.sequence
                        || left.id.localeCompare(right.id),
                )
                : [];
            const semanticContinuation = orderZeroSuccessors[0] || null;
            const continuation = lineageContinuation || semanticContinuation;
            const branches = continuation
                ? node.outgoing.filter((entry) => entry !== continuation)
                : node.outgoing;
            const structuralBranches = incoming.axisOrder === 0
                ? branches.filter((entry) => (
                    entry.axisOrder === 1
                    && entry.start.radius / Math.max(1e-7, incoming.end.radius)
                        >= STRUCTURAL_TRUNK_BRANCH_MINIMUM_RADIUS_RATIO
                ))
                : [];
            const structuralBranchEntryIds = new Set(
                structuralBranches.map((entry) => entry.id),
            );
            let kind = continuation ? 'lateral' : 'fork';
            if (incoming.axisOrder === 0 && orderZeroSuccessors.length > 1) {
                kind = 'trunk_bifurcation';
            } else if (
                incoming.axisOrder === 0
                && semanticContinuation
                && semanticContinuation.presentationLineageId
                    !== incoming.presentationLineageId
            ) {
                kind = 'trunk_handoff';
            }
            // Pooled, not lit: two strokes crossing leave more ink, never less,
            // and a collar sits in the shade of the fork it closes. Each lobe
            // takes the shade of the wood it rides rather than both taking the
            // parent's, so a thin branch's collar reads as that branch's own
            // swelling instead of as a smear of trunk laid across it.
            const parentBodyFill = surfaceMap.get(incoming.presentationLineageId)?.bodyFill
                || SAKURA_BARK.productBase;
            const collarFillOf = (entry, inheritParentValue = false) => (
                inheritParentValue
                    ? parentBodyFill
                    : shadeColor(
                        kind === 'trunk_bifurcation' && entry.axisOrder === 0
                            ? parentBodyFill
                            : surfaceMap.get(entry.presentationLineageId)?.bodyFill
                                || SAKURA_BARK.productBase,
                        -0.045,
                    )
            );
            const patches = [];
            if (
                continuation
                && (
                    kind === 'trunk_handoff'
                    || kind === 'trunk_bifurcation'
                )
            ) {
                // A biological lineage handoff is two ribbons even though it
                // is one visible trunk axis. Fill the outside of that bend as
                // its own split fillet before closing any lateral shoulders;
                // otherwise the two square ribbon heads meet only at the node
                // and leave a small triangular bite on the convex side.
                const collar = axisHandoffCollar({
                    node,
                    incoming,
                    outgoing: continuation,
                    projectionRatio,
                });
                if (collar) {
                    // A multi-axis trunk division must read as one continuous
                    // mass. Extra pooled shade is useful at a lone bend, but
                    // beside a structural bough it becomes a visible dark
                    // sleeve around the whole Y-junction.
                    const handoffFill = structuralBranches.length > 0
                        ? parentBodyFill
                        : shadeColor(parentBodyFill, -0.045);
                    patches.push({
                        role: 'trunk_axis_handoff',
                        lineageId: incoming.lineageId
                            ?? incoming.presentationLineageId ?? null,
                        sourceLineageId: incoming.sourceLineageId ?? null,
                        outlinePolygon: collar.parentLobe,
                        outlineFill: handoffFill,
                    });
                    patches.push({
                        role: 'trunk_axis_handoff',
                        lineageId: continuation.lineageId
                            ?? continuation.presentationLineageId ?? null,
                        sourceLineageId: continuation.sourceLineageId ?? null,
                        outlinePolygon: collar.childLobe,
                        outlineFill: handoffFill,
                    });
                }
            }
            branches.forEach((branch) => {
                const structuralTrunkBranch = structuralBranchEntryIds.has(branch.id);
                [1, -1].forEach((side) => {
                    const collar = junctionCollar({
                        node,
                        incoming,
                        continuation,
                        outgoing: branch,
                        side,
                        projectionRatio,
                    });
                    if (!collar) return;
                    patches.push({
                        role: structuralTrunkBranch
                            ? 'structural_trunk_branch_shoulder'
                            : null,
                        lineageId: collar.parentEntry.lineageId
                            ?? collar.parentEntry.presentationLineageId ?? null,
                        sourceLineageId: collar.parentEntry.sourceLineageId ?? null,
                        outlinePolygon: collar.parentLobe,
                        outlineFill: collarFillOf(
                            collar.parentEntry,
                            structuralTrunkBranch,
                        ),
                    });
                    patches.push({
                        role: structuralTrunkBranch
                            ? 'structural_trunk_branch_shoulder'
                            : null,
                        lineageId: branch.lineageId ?? branch.presentationLineageId ?? null,
                        sourceLineageId: branch.sourceLineageId ?? null,
                        outlinePolygon: collar.childLobe,
                        outlineFill: collarFillOf(branch, structuralTrunkBranch),
                    });
                });
            });
            if (patches.length === 0) return;
            junctions.push({
                id: `wood-junction:${node.id}`,
                nodeId: node.id,
                kind,
                incomingLineageId: incoming.presentationLineageId,
                continuationLineageId: continuation?.presentationLineageId ?? null,
                trunkSuccessorLineageIds: orderZeroSuccessors.map(
                    (entry) => entry.presentationLineageId,
                ),
                structuralTrunkBranchLineageIds: structuralBranches.map(
                    (entry) => entry.presentationLineageId,
                ),
                structuralTrunkBranches: structuralBranches.map((entry) => {
                    const direction = normalizedDirection(directionOf(entry));
                    const run = pointDistance(entry.start, entry.end);
                    return {
                        lineageId: entry.presentationLineageId,
                        direction,
                        inset: rounded(Math.min(
                            entry.start.radius * 0.85,
                            incoming.end.radius * 0.52,
                            5.4 * projectionRatio,
                            run * 0.18,
                        )),
                    };
                }),
                averageDepth: rounded(node.point.depth),
                patches,
            });
        });
        return junctions;
    }

    function maturedJunctionEntries(entries, eventLimit, supportedLoad) {
        return entries.map((entry) => {
            if (entry.isCanopyTwig) return entry;
            const secondaryGrowth = resolveSecondaryWoodGrowth({
                axisOrder: entry.axisOrder,
                eventLimit,
                birthEvent: entry.birthEvent,
                supportedLoad: supportedLoad.get(entry.id) || 0,
                rootOrigin: entry.rootOrigin,
                // Junctions occur away from the soil line. The basal flare is
                // owned by the root surface itself, while the shoulder uses
                // the same age/load thickening as its adjoining segments.
                rootFamily: false,
            });
            return {
                ...entry,
                start: {
                    ...entry.start,
                    radius: entry.start.radius * secondaryGrowth.radiusScale,
                },
                end: {
                    ...entry.end,
                    radius: entry.end.radius * secondaryGrowth.radiusScale,
                },
            };
        });
    }

    function buildWoodPresentation(options = {}) {
        const projectionScale = Math.max(
            1e-7,
            finite(options.projectionScale, 1),
        );
        const projectionRatio = projectionScale / REFERENCE_PROJECTION_SCALE;
        const entries = (options.entries || []).map((entry, index) => (
            normalizeEntry(entry, index, projectionScale)
        ));
        const chains = chainEntries(entries);
        const seed = options.seed ?? 'unseeded';
        const eventLimit = Math.max(0, finite(options.eventTime, finite(options.eventLimit, 0)));
        const maximumEvent = Math.max(1, finite(options.maximumEvent, 60));
        const maturity = options.maturity === undefined
            ? clamp(eventLimit / maximumEvent, 0, 1) : options.maturity;
        const supportedLoad = supportedLoadByEntry(
            entries,
            options.juvenileAxisRetirements || [],
        );
        const nodesWithOutgoing = new Set(entries.map((entry) => entry.fromNodeId));
        const depthNormalizer = resolveDepthNormalizer(entries);
        const brushWetness = VITALITY_BRUSH_WETNESS[options.vitality]
            ?? VITALITY_BRUSH_WETNESS.steady;
        const surfaces = chains.map((chain) => buildSurface(
            chain,
            seed,
            eventLimit,
            supportedLoad,
            !nodesWithOutgoing.has(chain.entries.at(-1).toNodeId),
            projectionScale,
            depthNormalizer,
            brushWetness,
            maturity,
        ));
        surfaces.forEach((surface) => {
            surface.terminalCap = nodesWithOutgoing.has(surface.endNodeId)
                ? null
                : {
                    ...surface.centerline.at(-1),
                    fill: surface.bodyFill,
                };
        });
        surfaces.sort((left, right) => (
            right.averageDepth - left.averageDepth
            || left.id.localeCompare(right.id)
        ));
        const surfaceMap = new Map(surfaces.map((surface) => [surface.lineageId, surface]));
        const junctionEntries = maturedJunctionEntries(
            entries,
            eventLimit,
            supportedLoad,
        );
        const junctions = buildJunctions(
            junctionEntries,
            surfaceMap,
            projectionRatio,
        ).sort((left, right) => (
            right.averageDepth - left.averageDepth
            || left.id.localeCompare(right.id)
        ));
        junctions.forEach((junction) => {
            const parentSurface = surfaceMap.get(junction.incomingLineageId);
            if (!parentSurface) return;
            junction.trunkSuccessorLineageIds.forEach((lineageId) => {
                const successorSurface = surfaceMap.get(lineageId);
                if (!successorSurface || successorSurface === parentSurface) return;
                successorSurface.headFill = parentSurface.bodyFill;
                successorSurface.headBlendFraction = 0.32;
            });
            junction.structuralTrunkBranches.forEach((branch) => {
                const branchSurface = surfaceMap.get(branch.lineageId);
                if (!branchSurface || branchSurface === parentSurface) return;
                const first = branchSurface.centerline[0];
                if (first && branch.inset > 0) {
                    // Bury the brush head inside the parent bole. The parent
                    // ribbon is painted over this short lead, so the branch's
                    // unavoidable flat cap cannot remain exposed as a seam at
                    // the Y-junction. The visible stroke still begins at the
                    // immutable graph node and no scheduler geometry changes.
                    branchSurface.centerline = [{
                        ...first,
                        x: rounded(first.x - (branch.direction.x * branch.inset)),
                        y: rounded(first.y - (branch.direction.y * branch.inset)),
                        radius: rounded(first.radius * 0.86),
                        worldRadius: rounded(first.worldRadius * 0.86),
                        arc: rounded(first.arc - branch.inset),
                        worldArc: rounded(
                            first.worldArc - (branch.inset / projectionScale),
                        ),
                    }, ...branchSurface.centerline];
                    branchSurface.structuralTrunkBranchHeadInset = branch.inset;
                }
                branchSurface.headFill = parentSurface.bodyFill;
                branchSurface.headBlendFraction =
                    STRUCTURAL_TRUNK_BRANCH_HEAD_BLEND_FRACTION;
            });
        });
        const vectorTopology = surfaces.map((surface) => ({
            id: surface.id,
            lightBand: Boolean(surface.lightBand),
            shadowBand: Boolean(surface.shadowBand),
            texture: surface.textureStrokes.map((stroke) => ({
                id: stroke.id,
                kind: stroke.kind,
                canonicalArc: stroke.canonicalArc,
            })),
        }));
        const vectorTopologySignature = `woodvec-${hashString(
            JSON.stringify(vectorTopology),
        ).toString(16).padStart(8, '0')}`;
        return Object.freeze({
            contractId: CONTRACT_ID,
            semantics: 'projected_mystic_sakura_ribbons_lenticels_semantic_junctions_and_basal_flare_v6',
            secondaryGrowthSemantics: SECONDARY_WOOD_GROWTH_SEMANTICS,
            vectorTopologySemantics: WOOD_VECTOR_TOPOLOGY_SEMANTICS,
            vectorTopologySignature,
            referenceProjectionScale: REFERENCE_PROJECTION_SCALE,
            projectionScale: rounded(projectionScale, 8),
            eventLimit: rounded(eventLimit),
            speciesPresentation: 'mystic_sakura',
            paletteSource: 'product_sakura_bark_family_expanded_for_dark_lab_stage',
            seed,
            sourceSegmentCount: entries.length,
            surfaceCount: surfaces.length,
            junctionCount: junctions.length,
            lateralJunctionCount: junctions.filter((junction) => junction.kind === 'lateral').length,
            forkJunctionCount: junctions.filter((junction) => (
                junction.kind === 'fork' || junction.kind === 'trunk_bifurcation'
            )).length,
            trunkHandoffJunctionCount: junctions.filter(
                (junction) => junction.kind === 'trunk_handoff',
            ).length,
            trunkBifurcationJunctionCount: junctions.filter(
                (junction) => junction.kind === 'trunk_bifurcation',
            ).length,
            structuralTrunkBranchJunctionCount: junctions.filter(
                (junction) => junction.structuralTrunkBranchLineageIds.length > 0,
            ).length,
            structuralTrunkBranchSurfaceCount: new Set(junctions.flatMap(
                (junction) => junction.structuralTrunkBranchLineageIds,
            )).size,
            structuralTrunkBranchHeadInsetCount: surfaces.filter(
                (surface) => surface.structuralTrunkBranchHeadInset > 0,
            ).length,
            basalFlareSurfaceCount: surfaces.filter(
                (surface) => surface.basalFlare?.applied,
            ).length,
            trunkAxisHandoffPatchCount: junctions.reduce(
                (total, junction) => total + junction.patches.filter(
                    (patch) => patch.role === 'trunk_axis_handoff',
                ).length,
                0,
            ),
            textureStrokeCount: surfaces.reduce(
                (total, surface) => total + surface.textureStrokes.length,
                0,
            ),
            surfaces: Object.freeze(surfaces),
            junctions: Object.freeze(junctions),
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerWoodPresentation = Object.freeze({
        contractId: CONTRACT_ID,
        vectorTopologySemantics: WOOD_VECTOR_TOPOLOGY_SEMANTICS,
        buildWoodPresentation,
    });
}(globalThis));
