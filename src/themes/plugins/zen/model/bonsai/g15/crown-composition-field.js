/**
 * G15.4 projected crown-composition owner.
 *
 * This owner observes the canonical bonsai view and creates two immutable
 * birth-time contracts:
 *   1. a scaffold-family gesture shared by descendants, and
 *   2. a one-shot interior/depth opportunity for an already funded child.
 *
 * It never creates an axis, reserves construction, or steers an existing
 * internode toward a target. Geometry mutation remains with fork and lateral
 * transactions.
 */
(function installTypedDevelopmentalCrownCompositionField(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    if (!programs) {
        throw new Error('[G15.4_COMPOSITION] programs must load first.');
    }
    const {
        clamp,
        add,
        subtract,
        scale,
        dot,
        normalize,
        mixDirection,
        rounded,
    } = programs;

    const CROWN_COMPOSITION_SEMANTICS =
        'canonical_bonsai_front_crown_composition_v1';
    const SCAFFOLD_FAMILY_GESTURE_SEMANTICS =
        'inherited_scaffold_family_gesture_v1';
    const CROWN_BIRTH_OPPORTUNITY_SEMANTICS =
        'one_shot_projected_crown_birth_opportunity_v1';
    const CANONICAL_VIEW_YAW = 0.24;
    const CANONICAL_DEPTH_LIFT = 0.065;
    const VIEW_HORIZONTAL = Object.freeze({
        x: Math.cos(CANONICAL_VIEW_YAW),
        y: 0,
        z: -Math.sin(CANONICAL_VIEW_YAW),
    });
    const VIEW_DEPTH = Object.freeze({
        x: Math.sin(CANONICAL_VIEW_YAW),
        y: 0,
        z: Math.cos(CANONICAL_VIEW_YAW),
    });
    const VIEW_UP = Object.freeze({ x: 0, y: 1, z: 0 });

    function freezeVector(vector) {
        return Object.freeze(Object.fromEntries(Object.entries(vector).map(
            ([key, value]) => [key, rounded(value)],
        )));
    }

    function stableUnit(source) {
        let hash = 2166136261;
        String(source || 'family').split('').forEach((character) => {
            hash ^= character.charCodeAt(0);
            hash = Math.imul(hash, 16777619) >>> 0;
        });
        return hash / 0xffffffff;
    }

    function projectDirection(direction) {
        const normalized = normalize(direction);
        const screenX = dot(normalized, VIEW_HORIZONTAL);
        const depth = dot(normalized, VIEW_DEPTH);
        const screenY = normalized.y + depth * CANONICAL_DEPTH_LIFT;
        return Object.freeze({
            screenX: rounded(screenX),
            screenY: rounded(screenY),
            depth: rounded(depth),
            projectedMagnitude: rounded(Math.hypot(screenX, screenY)),
        });
    }

    function screenPlaneDirection(screenX, screenY) {
        return normalize(add(
            scale(VIEW_HORIZONTAL, screenX),
            scale(VIEW_UP, screenY),
        ));
    }

    function padAxisFor(direction) {
        const projection = projectDirection(direction);
        const horizontal = -projection.screenY;
        const vertical = projection.screenX;
        if (Math.hypot(horizontal, vertical) < 1e-8) return VIEW_HORIZONTAL;
        return screenPlaneDirection(horizontal, vertical);
    }

    function enforceProjectedPresence(direction, minimumProjection) {
        const normalized = normalize(direction);
        const projection = projectDirection(normalized);
        if (projection.projectedMagnitude >= minimumProjection) {
            return normalized;
        }
        const planar = subtract(
            normalized,
            scale(VIEW_DEPTH, dot(normalized, VIEW_DEPTH)),
        );
        const planarDirection = Math.hypot(planar.x, planar.y, planar.z) > 1e-8
            ? normalize(planar)
            : VIEW_HORIZONTAL;
        const maximumDepth = Math.sqrt(Math.max(
            0,
            1 - minimumProjection * minimumProjection,
        ));
        const boundedDepth = clamp(
            dot(normalized, VIEW_DEPTH),
            -maximumDepth,
            maximumDepth,
        );
        let candidate = normalize(add(
            scale(planarDirection, Math.sqrt(Math.max(0, 1 - boundedDepth ** 2))),
            scale(VIEW_DEPTH, boundedDepth),
        ));
        for (let iteration = 0; iteration < 4; iteration += 1) {
            if (projectDirection(candidate).projectedMagnitude >= minimumProjection) {
                break;
            }
            candidate = mixDirection(candidate, planarDirection, 0.24);
        }
        return candidate;
    }

    function directionWithDepthLayer(direction, desiredDepth, authority) {
        const normalized = normalize(direction);
        const currentDepth = dot(normalized, VIEW_DEPTH);
        const planar = subtract(normalized, scale(VIEW_DEPTH, currentDepth));
        const planarDirection = Math.hypot(planar.x, planar.y, planar.z) > 1e-8
            ? normalize(planar)
            : VIEW_HORIZONTAL;
        const targetDepth = clamp(desiredDepth, -0.38, 0.38);
        const target = normalize(add(
            scale(
                planarDirection,
                Math.sqrt(Math.max(0.01, 1 - targetDepth ** 2)),
            ),
            scale(VIEW_DEPTH, targetDepth),
        ));
        return mixDirection(normalized, target, clamp(authority, 0, 0.5));
    }

    function turnInCanonicalPlane(direction, radians) {
        const normalized = normalize(direction);
        const horizontal = dot(normalized, VIEW_HORIZONTAL);
        const vertical = normalized.y;
        const depth = dot(normalized, VIEW_DEPTH);
        const cosine = Math.cos(radians);
        const sine = Math.sin(radians);
        return normalize(add(
            add(
                scale(VIEW_HORIZONTAL, horizontal * cosine - vertical * sine),
                scale(VIEW_UP, horizontal * sine + vertical * cosine),
            ),
            scale(VIEW_DEPTH, depth),
        ));
    }

    function createScaffoldFamilyGesture(context, spec = {}) {
        const axisOrder = Number(spec.axisOrder ?? spec.tier ?? 0);
        if (axisOrder <= 0) return null;
        const heading = normalize(spec.heading);
        const parent = spec.parentGesture || null;
        const lineageKey = spec.lineageKey
            || spec.lineageId
            || `${spec.parentLineageId || 'root'}:${spec.sequence || 0}:${spec.childIndex || 0}`;
        if (parent) {
            const flowDirection = mixDirection(
                parent.flowDirection,
                heading,
                axisOrder === 1 ? 0.18 : 0.28,
            );
            return Object.freeze({
                ...parent,
                inheritedFromGestureId: parent.gestureId,
                generation: Number(parent.generation || 0) + 1,
                carrierLineageKey: lineageKey,
                flowDirection: freezeVector(flowDirection),
                padAxis: freezeVector(padAxisFor(flowDirection)),
                authority: 'birth_frame_and_cluster_envelope_only',
            });
        }
        const sample = stableUnit(lineageKey);
        const centered = sample * 2 - 1;
        const depthAffinity = clamp(
            Number(context?.phenotype?.depthAffinity || 0.45),
            0,
            1,
        );
        const layer = centered < -0.34
            ? 'near'
            : centered > 0.34
                ? 'far'
                : 'middle';
        const desiredDepth = layer === 'middle'
            ? centered * 0.055
            : Math.sign(centered) * (0.105 + depthAffinity * 0.075);
        const angularBandwidth = clamp(
            0.24
                + Number(spec.temperament?.apertureBias || 1) * 0.075
                + (1 - Number(spec.temperament?.clusterCompactness || 0.6)) * 0.08,
            0.26,
            0.44,
        );
        return Object.freeze({
            semantics: SCAFFOLD_FAMILY_GESTURE_SEMANTICS,
            compositionSemantics: CROWN_COMPOSITION_SEMANTICS,
            gestureId: `family-gesture:${lineageKey}`,
            inheritedFromGestureId: null,
            sourceLineageKey: lineageKey,
            carrierLineageKey: lineageKey,
            generation: 0,
            depthLayer: layer,
            desiredDepth: rounded(desiredDepth),
            minimumProjectedPresence: rounded(0.68 - depthAffinity * 0.06),
            angularBandwidth: rounded(angularBandwidth),
            envelopeAspectRatio: rounded(clamp(
                1.45
                    + (1 - Number(spec.temperament?.clusterCompactness || 0.6))
                        * 0.55,
                1.42,
                1.95,
            )),
            flowDirection: freezeVector(heading),
            padAxis: freezeVector(padAxisFor(heading)),
            viewDepth: VIEW_DEPTH,
            canonicalYaw: CANONICAL_VIEW_YAW,
            depthLift: CANONICAL_DEPTH_LIFT,
            authority: 'birth_frame_and_cluster_envelope_only',
        });
    }

    function resolveCrownBirthOpportunity(spec = {}) {
        const baseDirection = normalize(spec.baseDirection);
        const familyGesture = spec.familyGesture || null;
        const childAxisOrder = Number(spec.childAxisOrder ?? 0);
        let direction = baseDirection;
        const depthAuthority = familyGesture
            ? childAxisOrder === 1 ? 0.34 : 0.18
            : 0;
        if (familyGesture && depthAuthority > 0) {
            direction = directionWithDepthLayer(
                direction,
                familyGesture.desiredDepth,
                depthAuthority,
            );
        }
        const exposure = spec.exposure || null;
        const exposureApplicable = childAxisOrder === 2
            && exposure?.applicable
            && exposure.bridgeDirection;
        const targetProjection = exposureApplicable
            ? projectDirection(exposure.bridgeDirection)
            : null;
        const targetForward = exposureApplicable
            ? dot(direction, exposure.bridgeDirection)
            : 0;
        const forwardInteriorBlend = exposureApplicable && targetForward > -0.12
            ? clamp(
                Number(exposure.pressure || 0)
                    * (0.075 + Number(
                        exposure.architectureProfile?.crownInteriorContinuity || 0,
                    ) * 0.045)
                    * clamp(
                        Number(targetProjection?.projectedMagnitude || 0) / 0.62,
                        0.35,
                        1,
                    ),
                0,
                0.14,
            )
            : 0;
        const directionProjection = projectDirection(direction);
        const projectedCross = exposureApplicable
            ? directionProjection.screenX * targetProjection.screenY
                - directionProjection.screenY * targetProjection.screenX
            : 0;
        const projectedSideTurn = exposureApplicable
            && targetForward <= -0.12
            && Math.abs(projectedCross) > 1e-5
            ? Math.sign(projectedCross) * clamp(
                Number(exposure.pressure || 0) * 0.095,
                0,
                0.095,
            )
            : 0;
        if (forwardInteriorBlend > 0) {
            direction = mixDirection(
                direction,
                exposure.bridgeDirection,
                forwardInteriorBlend,
            );
        } else if (projectedSideTurn !== 0) {
            // A target behind the new shoot must not become a pursuit point.
            // Preserve forward extension and spend only a small screen-plane
            // side turn at birth so the family opens toward the interior.
            direction = turnInCanonicalPlane(direction, projectedSideTurn);
        }
        const interiorBlend = Math.max(
            forwardInteriorBlend,
            Math.abs(projectedSideTurn),
        );
        const minimumProjection = Number(
            familyGesture?.minimumProjectedPresence || 0.66,
        );
        direction = enforceProjectedPresence(direction, minimumProjection);
        return Object.freeze({
            semantics: CROWN_BIRTH_OPPORTUNITY_SEMANTICS,
            compositionSemantics: CROWN_COMPOSITION_SEMANTICS,
            applicable: Boolean(familyGesture || exposureApplicable),
            reason: forwardInteriorBlend > 0
                ? 'funded_child_accepts_one_forward_interior_bias'
                : projectedSideTurn !== 0
                    ? 'funded_child_opens_toward_backward_interior_without_pursuit'
                : familyGesture
                    ? 'family_depth_layer_applied_at_birth'
                    : 'no_crown_composition_opportunity',
            childAxisOrder,
            familyGestureId: familyGesture?.gestureId || null,
            interiorExposureApplicable: Boolean(exposureApplicable),
            interiorMode: forwardInteriorBlend > 0
                ? 'forward_vector_blend'
                : projectedSideTurn !== 0
                    ? 'screen_plane_side_turn'
                    : 'none',
            interiorBlend: rounded(interiorBlend),
            projectedSideTurnRadians: rounded(projectedSideTurn),
            depthAuthority: rounded(depthAuthority),
            targetForward: rounded(targetForward),
            minimumProjectedPresence: rounded(minimumProjection),
            directionBefore: freezeVector(baseDirection),
            directionAfter: freezeVector(direction),
            projectedBefore: projectDirection(baseDirection),
            projectedAfter: projectDirection(direction),
            authority: 'one_shot_birth_direction_only',
        });
    }

    function resolveClusterEnvelope(familyGesture, radius, compactness) {
        const baseRadius = Math.max(1, Number(radius || 1));
        const compact = clamp(Number(compactness || 0.6), 0, 1);
        const aspect = clamp(
            Number(familyGesture?.envelopeAspectRatio || 1.55),
            1.35,
            2,
        );
        const majorRadius = baseRadius * (1.04 + (1 - compact) * 0.16);
        return Object.freeze({
            majorAxis: freezeVector(
                familyGesture?.padAxis || VIEW_HORIZONTAL,
            ),
            flowAxis: freezeVector(
                familyGesture?.flowDirection || VIEW_UP,
            ),
            depthAxis: VIEW_DEPTH,
            majorRadius: rounded(majorRadius),
            minorRadius: rounded(majorRadius / aspect),
            depthRadius: rounded(baseRadius * (0.38 + (1 - compact) * 0.16)),
            aspectRatio: rounded(aspect),
        });
    }

    function clusterEnvelopeDistance(cluster, point) {
        const envelope = cluster?.envelope || null;
        if (!envelope || !cluster?.center || !point) return null;
        const delta = subtract(point, cluster.center);
        const major = dot(delta, envelope.majorAxis)
            / Math.max(1e-8, envelope.majorRadius);
        const minor = dot(delta, envelope.flowAxis)
            / Math.max(1e-8, envelope.minorRadius);
        const depth = dot(delta, envelope.depthAxis)
            / Math.max(1e-8, envelope.depthRadius);
        return Math.sqrt(major ** 2 + minor ** 2 + depth ** 2);
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerCrownComposition = Object.freeze({
        CROWN_COMPOSITION_SEMANTICS,
        SCAFFOLD_FAMILY_GESTURE_SEMANTICS,
        CROWN_BIRTH_OPPORTUNITY_SEMANTICS,
        CANONICAL_VIEW_YAW,
        CANONICAL_DEPTH_LIFT,
        VIEW_HORIZONTAL,
        VIEW_DEPTH,
        projectDirection,
        createScaffoldFamilyGesture,
        resolveCrownBirthOpportunity,
        resolveClusterEnvelope,
        clusterEnvelopeDistance,
    });
}(globalThis));
