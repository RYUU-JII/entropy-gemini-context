/**
 * Rig partitioner for the G15.4 bonsai.
 *
 * The tree is cut into a small number of rigid parts that the renderer can bake
 * once and then move: a static trunk core, a handful of articulated limbs, and
 * the blossom clouds that ride on them.
 *
 * The cut follows the developmental graph's lineage tree and nothing else. That
 * is the whole point of this module. An earlier revision re-derived the
 * hierarchy from projected wood surfaces — matching endpoint ids, then falling
 * back to a 35px proximity search, then to nearest-anything — and bucketed
 * blossoms into a fixed spatial grid. Both are guesses about a structure the
 * graph already states exactly, and both were wrong often enough to be visible:
 * one physical branch would end up split between two rigs that then rotated
 * about the same point in different directions, and a blossom cluster would be
 * assigned to a limb it does not grow on. `graph.lineages` carries
 * `parentLineageId` for every axis, so there is nothing to infer.
 *
 * The invariant every consumer depends on: a rig owns a *connected slice* of the
 * lineage tree. Walk any lineage up its parent chain and the first rig root you
 * meet owns it. Wood, junctions, blossoms, and washes therefore reach their rig
 * by the same walk, and anything growing on the same branch lands on the same
 * rig by construction rather than by distance.
 */
(function installPixiBakingPartitioner(scope) {
    'use strict';

    const CONTRACT_ID = 'g15_4_pixi_baking_partitioner_v1';

    // How many articulated parts the crown may spend. Each one is a sprite and a
    // matrix per frame, so the ceiling is a budget; but it is also a look. Past
    // roughly this many the crown stops reading as a few boughs answering the
    // wind together and starts reading as confetti, because every extra rig is
    // one more independent phase in the same silhouette.
    const MAX_ARTICULATED_RIGS = 20;
    // A descendant is only worth its own hinge if it carries enough wood to be
    // seen bending. Below this it moves with its parent, which is both cheaper
    // and truer: a twig does not hinge, it rides.
    const SUB_LIMB_MIN_VISUAL_MASS = 90;
    // Blossom clouds are cut inside one rig, never across two.
    const CLUSTER_GRID_SIZE = 130;

    // --- Where the trunk ends -----------------------------------------
    // At the ground, and nowhere else.
    //
    // The trunk core is the one axis whose base is buried. That is a boundary
    // condition, not a material property: a clamped end cannot rotate, which is
    // why this rig barely moves and why everything else is measured against it.
    //
    // Structural wood *above* the foot used to be swept into this same rig — any
    // axis thick enough, taken as a connected run — and that produced a seam
    // you could see. Everything inside the block was equally frozen and the
    // first limb outside it jumped to eleven times the amplitude in a single
    // joint, so a flower growing on trunk wood sat perfectly still while its
    // neighbour a few pixels away swung ten degrees. Real wood has no such step.
    // Letting each structural axis be its own link instead lets girth grade the
    // motion the way it actually grades: nearly nothing at the buried foot, a
    // degree or two where the trunk narrows, several by the time it is a limb.

    // --- How readily a piece of wood gives ----------------------------
    // A limb is a cantilever, and the beam it is made of resists bending by the
    // fourth power of its radius. Nothing else in the tree has that exponent:
    // between the trunk and a twig, girth alone is a factor of a million, while
    // length and load together are a few thousand. So girth sets the scale and
    // the rest modulates inside it — which is also how the eye reads a tree,
    // thickness first.
    //
    // Girth enters as how many e-folds thinner than the stoutest wood in this
    // specimen a member is, normalized against the full span of that tree. It
    // is per-specimen on purpose: a seedling and an old trunk should both read
    // correctly, and only a relative measure does that.
    const TRUNK_STIR_FLOOR = 0.02;
    // Leverage — how far the member reaches for its thickness, and how much
    // crown it is holding out there. This is the "mass and distance" part: it
    // cannot make a trunk floppy, but it decides which of two equally thick
    // branches gives more.
    const SLENDERNESS_RIGID = 6;
    const SLENDERNESS_WHIPPY = 62;
    const LEVERAGE_FLOOR = 0.55;
    const SLENDERNESS_SHARE = 0.6;
    const CARRIED_LOAD_SATURATION = 2600;

    // One stiffness range for every rig, trunk included. The old model gave
    // primaries [0.55, 0.92] and sub-limbs [0.28, 0.65] — disjoint bands keyed
    // on tier, so a thick sub-limb could never be stiffer than a thin primary
    // no matter how the wood actually looked. That inversion is most of why the
    // crown read as unrelated pieces rather than as one tree.
    const STIFFEST = 0.99;
    const LIMPEST = 0.35;
    // A thin twig rings fast, a bough slowly. Physically the cantilever
    // fundamental goes as r/reach^2, but that spans three orders of magnitude
    // once twigs are included; this keeps the ordering and bounds the band.
    //
    // The band has to be *wide*, not just slow. A narrow one is what made the
    // crown pulse as a single object: squeezed into 0.18-0.48 Hz and then scaled
    // and clamped again downstream, every rig below mid compliance came out at
    // exactly the same frequency, so the whole specimen breathed in unison on an
    // eight-second cycle. Spreading heavy boughs and light twigs five-fold apart
    // is what lets them drift out of step, which is the difference between a
    // crown that rustles and a crown that throbs.
    const SLOWEST_HZ = 0.30;
    const FASTEST_HZ = 1.20;

    const clamp01 = (value) => Math.min(1, Math.max(0, finite(value, 0)));

    const complianceFromSlenderness = (slenderness) => {
        const bounded = Math.min(
            SLENDERNESS_WHIPPY,
            Math.max(SLENDERNESS_RIGID, finite(slenderness, SLENDERNESS_RIGID)),
        );
        return clamp01(
            (Math.log(bounded) - Math.log(SLENDERNESS_RIGID))
            / (Math.log(SLENDERNESS_WHIPPY) - Math.log(SLENDERNESS_RIGID)),
        );
    };

    const complianceFromCarriedLoad = (carriedVolume, baseRadius) => {
        // Carried wood against the section that has to hold it. Cubed rather
        // than to the fourth: this is the moment the joint carries, not the
        // stiffness resisting it.
        const capacity = Math.max(0.05, baseRadius ** 3);
        return clamp01(
            Math.log1p(Math.max(0, carriedVolume) / capacity)
            / Math.log1p(CARRIED_LOAD_SATURATION),
        );
    };

    /**
     * Per-lineage mechanics, read off the developmental graph in model space.
     *
     * `reach` is how far the wood carries on past this joint, following the
     * longest route to a tip — that is the lever the wind works against, and it
     * is why a short thick stub and a long thin whip are told apart correctly
     * even when their own segment lengths match.
     */
    function buildLineageMechanics({ lineageById, childrenOf, segmentById }) {
        const own = new Map();
        lineageById.forEach((lineage, lineageId) => {
            const segments = (Array.isArray(lineage.segmentIds) ? lineage.segmentIds : [])
                .map((segmentId) => segmentById.get(String(segmentId)))
                .filter(Boolean);
            let length = 0;
            let baseRadius = 0;
            let volume = 0;
            segments.forEach((segment) => {
                const segmentLength = Math.max(0, finite(segment.length, 0));
                const startRadius = Math.max(0, finite(segment.startRadius, 0));
                const endRadius = Math.max(0, finite(segment.endRadius, 0));
                const meanRadius = (startRadius + endRadius) * 0.5;
                length += segmentLength;
                baseRadius = Math.max(baseRadius, startRadius);
                volume += Math.PI * meanRadius * meanRadius * segmentLength;
            });
            own.set(lineageId, {
                length,
                baseRadius: Math.max(0.05, baseRadius),
                volume,
            });
        });

        const reachOf = new Map();
        const carriedOf = new Map();
        const resolveDownstream = (lineageId, guard) => {
            if (reachOf.has(lineageId)) {
                return { reach: reachOf.get(lineageId), carried: carriedOf.get(lineageId) };
            }
            if (guard.has(lineageId)) return { reach: 0, carried: 0 };
            guard.add(lineageId);
            const self = own.get(lineageId) || { length: 0, volume: 0 };
            let deepest = 0;
            let carried = self.volume;
            (childrenOf.get(lineageId) || []).forEach((childId) => {
                const child = resolveDownstream(childId, guard);
                deepest = Math.max(deepest, child.reach);
                carried += child.carried;
            });
            const reach = self.length + deepest;
            reachOf.set(lineageId, reach);
            carriedOf.set(lineageId, carried);
            return { reach, carried };
        };
        lineageById.forEach((_lineage, lineageId) => resolveDownstream(lineageId, new Set()));

        // Wood distance from the foot to this axis's joint. The wind arrives at
        // the base first and reaches a tip later; this is what that delay is
        // measured along.
        const pathOf = new Map();
        const resolvePath = (lineageId, guard) => {
            if (pathOf.has(lineageId)) return pathOf.get(lineageId);
            if (guard.has(lineageId)) return 0;
            guard.add(lineageId);
            const parentId = lineageById.get(lineageId)?.parentLineageId;
            const parentKey = parentId == null ? null : String(parentId);
            const path = (parentKey && lineageById.has(parentKey))
                ? resolvePath(parentKey, guard) + (own.get(parentKey)?.length || 0)
                : 0;
            pathOf.set(lineageId, path);
            return path;
        };
        lineageById.forEach((_lineage, lineageId) => resolvePath(lineageId, new Set()));

        let maximumRadius = 0.05;
        let minimumRadius = Infinity;
        let maximumPath = 1;
        own.forEach((entry, lineageId) => {
            maximumRadius = Math.max(maximumRadius, entry.baseRadius);
            minimumRadius = Math.min(minimumRadius, entry.baseRadius);
            maximumPath = Math.max(maximumPath, pathOf.get(lineageId) || 0);
        });
        // The specimen's own girth span, in e-folds. A tree with no taper at all
        // would divide by zero here, so the span has a floor; below it every
        // member is equally thick and girth stops discriminating, which is the
        // correct answer rather than a degenerate one.
        const girthSpan = Math.max(0.35, Math.log(maximumRadius / Math.max(0.05, minimumRadius)));

        const mechanics = new Map();
        own.forEach((entry, lineageId) => {
            const reach = Math.max(entry.length, reachOf.get(lineageId) || 0);
            mechanics.set(lineageId, Object.freeze({
                ownLength: entry.length,
                baseRadius: entry.baseRadius,
                ownVolume: entry.volume,
                carriedVolume: carriedOf.get(lineageId) || entry.volume,
                reach,
                slenderness: reach / entry.baseRadius,
                girthShare: entry.baseRadius / maximumRadius,
                radiusDecades: Math.min(1, Math.max(0,
                    Math.log(maximumRadius / entry.baseRadius) / girthSpan,
                )),
                pathFromBase: pathOf.get(lineageId) || 0,
                pathFraction: clamp01((pathOf.get(lineageId) || 0) / maximumPath),
            }));
        });
        return mechanics;
    }

    /**
     * Stiffness, natural frequency, and compliance for one rig, from the wood
     * itself rather than from what the axis was labelled at birth.
     *
     * Girth and leverage multiply rather than add. A weighted sum cannot express
     * this: the trunk has the longest reach and carries the entire crown, so any
     * additive blend hands it a large share of the compliance no matter how much
     * weight girth is given, and the stem ends up waving. Multiplying lets the
     * radius term gate the others, which is what the r^4 in the beam equation
     * actually does.
     */
    function resolveRigMechanics(entry) {
        const slenderness = complianceFromSlenderness(entry?.slenderness);
        const load = complianceFromCarriedLoad(entry?.carriedVolume, entry?.baseRadius);
        // Never exactly zero. The trunk answers the wind by a fraction of a
        // degree, and because every limb hangs off it that fraction is carried
        // through the whole tree — the cheapest thing in the whole model that
        // makes the specimen read as alive rather than as a photograph with
        // moving parts pasted on.
        const girth = Math.max(TRUNK_STIR_FLOOR, clamp01(entry?.radiusDecades ?? 1));
        const leverage = LEVERAGE_FLOOR + ((1 - LEVERAGE_FLOOR) * clamp01(
            (slenderness * SLENDERNESS_SHARE) + (load * (1 - SLENDERNESS_SHARE)),
        ));
        const compliance = clamp01(girth * leverage);
        return {
            compliance,
            stiffness: rounded(STIFFEST - ((STIFFEST - LIMPEST) * compliance), 3),
            naturalFrequencyHz: rounded(SLOWEST_HZ + ((FASTEST_HZ - SLOWEST_HZ) * compliance), 3),
        };
    }

    function finite(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function rounded(value, precision = 2) {
        const power = 10 ** precision;
        const result = Math.round(finite(value) * power) / power;
        return Object.is(result, -0) ? 0 : result;
    }

    function pointDistance(a, b) {
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    function computeBounds(points = []) {
        if (!points || points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
        }
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        points.forEach((p) => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        return {
            minX: rounded(minX),
            minY: rounded(minY),
            maxX: rounded(maxX),
            maxY: rounded(maxY),
            width: rounded(Math.max(0, maxX - minX)),
            height: rounded(Math.max(0, maxY - minY)),
            centerX: rounded((minX + maxX) * 0.5),
            centerY: rounded((minY + maxY) * 0.5),
        };
    }

    /**
     * The lineage tree, read straight off the graph.
     *
     * `parentLineageId` is authored by the growth kernel at fork time, so this
     * is a restatement rather than a reconstruction.
     */
    function readLineageTree(graph) {
        const lineages = Array.isArray(graph?.lineages) ? graph.lineages : null;
        if (!lineages || lineages.length === 0) {
            throw new Error('ZEN_BONSAI_G15_PIXI_PARTITION_GRAPH_LINEAGES_MISSING');
        }
        const byId = new Map();
        lineages.forEach((lineage) => {
            if (lineage?.id) byId.set(String(lineage.id), lineage);
        });
        const childrenOf = new Map();
        byId.forEach((lineage, id) => {
            const parentId = lineage.parentLineageId == null
                ? null
                : String(lineage.parentLineageId);
            const key = parentId && byId.has(parentId) ? parentId : null;
            if (!childrenOf.has(key)) childrenOf.set(key, []);
            childrenOf.get(key).push(id);
        });
        return { byId, childrenOf };
    }

    /**
     * The node a lineage hangs from: the start of the one segment in the lineage
     * whose predecessor is outside it. That node sits on the parent's wood, so
     * it is the only correct place to hinge this part.
     */
    function resolveLineageRootNodeId(lineage, segmentById) {
        const segmentIds = Array.isArray(lineage?.segmentIds) ? lineage.segmentIds : [];
        const interiorNodeIds = new Set();
        segmentIds.forEach((segmentId) => {
            const segment = segmentById.get(String(segmentId));
            if (segment?.toNodeId !== undefined) interiorNodeIds.add(String(segment.toNodeId));
        });
        for (let index = 0; index < segmentIds.length; index += 1) {
            const segment = segmentById.get(String(segmentIds[index]));
            if (!segment) continue;
            const fromNodeId = String(segment.fromNodeId);
            if (!interiorNodeIds.has(fromNodeId)) return fromNodeId;
        }
        const first = segmentById.get(String(segmentIds[0]));
        return first ? String(first.fromNodeId) : null;
    }

    function surfaceArcMass(surface) {
        const centerline = Array.isArray(surface?.centerline) ? surface.centerline : [];
        if (centerline.length < 2) return 0;
        let mass = 0;
        for (let index = 1; index < centerline.length; index += 1) {
            const previous = centerline[index - 1];
            const current = centerline[index];
            const span = pointDistance(previous, current);
            const radius = Math.max(0.3, (finite(previous.radius, 1) + finite(current.radius, 1)) * 0.5);
            mass += span * radius;
        }
        return mass;
    }

    function collectRigGeometry(lineageIds, surfacesByLineage) {
        const points = [];
        const surfaceIds = [];
        const nodeIds = new Set();
        let radiusSum = 0;
        let radiusCount = 0;
        let mass = 0;
        lineageIds.forEach((lineageId) => {
            (surfacesByLineage.get(lineageId) || []).forEach((surface) => {
                surfaceIds.push(surface.id);
                surface.outlinePolygon?.forEach((point) => points.push(point));
                surface.centerline?.forEach((point) => points.push(point));
                if (surface.startNodeId !== undefined) nodeIds.add(String(surface.startNodeId));
                if (surface.endNodeId !== undefined) nodeIds.add(String(surface.endNodeId));
                radiusSum += finite(surface.startRadius, 1);
                radiusCount += 1;
                mass += surfaceArcMass(surface);
            });
        });
        return {
            points,
            surfaceIds,
            nodeIds,
            mass,
            averageRadius: radiusCount > 0 ? radiusSum / radiusCount : 1,
        };
    }

    /**
     * Where a rig hinges, in projected scene space.
     *
     * The rig's root lineage starts at a node that lies on its parent's wood;
     * the wood surface that starts at that node opens its centerline there. Any
     * other point — a bounding-box corner, a centroid, the first surface that
     * happened to be listed — puts the hinge off the branch and the part swings
     * away from the tree instead of with it.
     */
    function resolveRigPivot({ rootLineageId, rootNodeId, surfacesByLineage }) {
        const surfaces = surfacesByLineage.get(rootLineageId) || [];
        if (rootNodeId) {
            const seated = surfaces.find((surface) => (
                String(surface.startNodeId) === rootNodeId && surface.centerline?.length > 0
            ));
            if (seated) return seated.centerline[0];
        }
        const anySurface = surfaces.find((surface) => surface.centerline?.length > 0);
        return anySurface ? anySurface.centerline[0] : null;
    }

    function buildPixiBakingPlan({
        graph,
        woodPresentation,
        floweringPresentation,
        nebariPresentation = null,
        visibleSegments = [],
        canopyTwigEntries = null,
    } = {}) {
        const surfaces = woodPresentation?.surfaces || [];
        const junctions = woodPresentation?.junctions || [];
        const { byId: lineageById, childrenOf } = readLineageTree(graph);
        const segmentById = new Map(
            (graph?.segments || []).map((segment) => [String(segment.id), segment]),
        );

        const surfacesByLineage = new Map();
        surfaces.forEach((surface) => {
            const lineageId = String(surface.lineageId);
            if (!surfacesByLineage.has(lineageId)) surfacesByLineage.set(lineageId, []);
            surfacesByLineage.get(lineageId).push(surface);
        });

        const rootNodeIdByLineage = new Map();
        lineageById.forEach((lineage, lineageId) => {
            rootNodeIdByLineage.set(lineageId, resolveLineageRootNodeId(lineage, segmentById));
        });

        const mechanicsOf = buildLineageMechanics({ lineageById, childrenOf, segmentById });

        const childIdsOf = (lineageId) => (childrenOf.get(lineageId) || []);
        const hasWood = (lineageId) => (surfacesByLineage.get(lineageId) || []).length > 0;

        const subtreeOf = (lineageId) => {
            const collected = [];
            const stack = [lineageId];
            while (stack.length > 0) {
                const current = stack.pop();
                collected.push(current);
                childIdsOf(current).forEach((childId) => stack.push(childId));
            }
            return collected;
        };

        // --- Tier 1: the trunk core -------------------------------------
        // The standing mass the limbs hinge against, grown outward from the
        // foot for as long as the wood stays thick. Girth, not birth order:
        // a slender axis high in the crown is a branch however it was born,
        // and a thick one low down is trunk however it was labelled.
        const trunkLineageIdSet = new Set();
        const rootLineageIds = [];
        lineageById.forEach((lineage, lineageId) => {
            const parentId = lineage.parentLineageId;
            if (parentId == null || !lineageById.has(String(parentId))) {
                rootLineageIds.push(lineageId);
            }
        });
        rootLineageIds.forEach((lineageId) => trunkLineageIdSet.add(lineageId));
        const isTrunkLineage = (lineageId) => trunkLineageIdSet.has(lineageId);
        const trunkLineageIds = Array.from(trunkLineageIdSet);
        const trunkGeometry = collectRigGeometry(trunkLineageIds, surfacesByLineage);
        const trunkPoints = [...trunkGeometry.points];
        if (nebariPresentation?.rootSpecs) {
            nebariPresentation.rootSpecs.forEach((spec) => {
                spec.points?.forEach((point) => trunkPoints.push(point));
            });
        }
        const trunkBounds = computeBounds(trunkPoints);
        const trunkRootLineageId = trunkLineageIds.find(
            (lineageId) => lineageById.get(lineageId)?.parentLineageId == null,
        ) || trunkLineageIds[0];
        const trunkPivot = resolveRigPivot({
            rootLineageId: trunkRootLineageId,
            rootNodeId: rootNodeIdByLineage.get(trunkRootLineageId),
            surfacesByLineage,
        }) || { x: trunkBounds.centerX, y: trunkBounds.maxY };

        // The trunk answers the wind too, by a fraction of a degree. A hard
        // zero is its own tell: the base is the one part every other part
        // inherits from, so a hair of coherent motion there carries the whole
        // tree, while an exactly rigid stem reads as a photograph with things
        // moving in front of it. Its girth is what keeps that fraction small —
        // the thickest wood in the specimen by a wide margin — rather than a
        // rule that says trunks do not move.
        const trunkMechanics = resolveRigMechanics(
            mechanicsOf.get(trunkRootLineageId) || null,
        );
        const trunkCore = Object.freeze({
            id: 'rig_trunk_core',
            tier: 0,
            depth: 0,
            role: 'static_anchor',
            parentLimbId: null,
            rootLineageId: trunkRootLineageId,
            bounds: trunkBounds,
            pivot: { x: rounded(trunkPivot.x), y: rounded(trunkPivot.y) },
            baseAngleRad: 0,
            stiffness: trunkMechanics.stiffness,
            naturalFrequencyHz: trunkMechanics.naturalFrequencyHz,
            pathFraction: 0,
            slenderness: rounded(mechanicsOf.get(trunkRootLineageId)?.slenderness ?? 0, 2),
            girthShare: 1,
            radiusDecades: rounded(mechanicsOf.get(trunkRootLineageId)?.radiusDecades ?? 0, 4),
            surfaceIds: trunkGeometry.surfaceIds,
            surfaceCount: trunkGeometry.surfaceIds.length,
            lineageIds: Object.freeze([...trunkLineageIds]),
            nebariRootCount: nebariPresentation?.rootCount || 0,
            // The pot, the soil and the nebari roots stay put; they are ground,
            // not wood. Only the stem above them takes this rig's motion.
            isStatic: true,
        });

        // --- Tier 2: articulated limbs ----------------------------------
        // A primary limb is the first non-trunk lineage on a path out of the
        // trunk. Descend past a lineage that carries no wood rather than
        // stopping there: an axis with no surface has nothing to hinge, but its
        // children may.
        const primaryRootIds = [];
        const collectPrimaryRoots = (lineageId) => {
            if (isTrunkLineage(lineageId)) {
                childIdsOf(lineageId).forEach(collectPrimaryRoots);
                return;
            }
            if (hasWood(lineageId)) {
                primaryRootIds.push(lineageId);
                return;
            }
            childIdsOf(lineageId).forEach(collectPrimaryRoots);
        };
        rootLineageIds.forEach((lineageId) => {
            if (!isTrunkLineage(lineageId)) collectPrimaryRoots(lineageId);
        });
        trunkLineageIds.forEach((lineageId) => childIdsOf(lineageId).forEach((childId) => {
            if (!isTrunkLineage(childId)) collectPrimaryRoots(childId);
        }));
        const uniquePrimaryRootIds = Array.from(new Set(primaryRootIds));

        // Sub-limbs are promoted by mass, not by position in a list. A hinge
        // spent on the heaviest bough in the crown buys visible secondary
        // motion; the same hinge spent on a twig buys a twitch nobody sees.
        const subCandidates = [];
        uniquePrimaryRootIds.forEach((primaryRootId) => {
            const walk = (lineageId, depth) => {
                childIdsOf(lineageId).forEach((childId) => {
                    if (isTrunkLineage(childId)) return;
                    if (hasWood(childId)) {
                        const mass = collectRigGeometry(subtreeOf(childId), surfacesByLineage).mass;
                        if (mass >= SUB_LIMB_MIN_VISUAL_MASS) {
                            subCandidates.push({
                                lineageId: childId,
                                primaryRootId,
                                depth: depth + 1,
                                mass,
                            });
                        }
                    }
                    walk(childId, depth + 1);
                });
            };
            walk(primaryRootId, 0);
        });
        subCandidates.sort((left, right) => right.mass - left.mass);
        const subBudget = Math.max(0, MAX_ARTICULATED_RIGS - uniquePrimaryRootIds.length);
        const promotedSubIds = new Set(
            subCandidates.slice(0, subBudget).map((candidate) => candidate.lineageId),
        );

        const rigRootIds = new Set([...uniquePrimaryRootIds, ...promotedSubIds]);

        // --- Ownership --------------------------------------------------
        // Every lineage resolves to exactly one rig by walking its parent chain
        // to the first rig root. This is the invariant that keeps a branch and
        // everything growing on it in one piece.
        const rigIdByRootLineage = new Map();
        const orderedRootIds = [];
        uniquePrimaryRootIds.forEach((lineageId, index) => {
            rigIdByRootLineage.set(lineageId, `rig_limb_${index}`);
            orderedRootIds.push(lineageId);
        });
        let subIndex = 0;
        subCandidates.forEach((candidate) => {
            if (!promotedSubIds.has(candidate.lineageId)) return;
            rigIdByRootLineage.set(candidate.lineageId, `rig_limb_sub_${subIndex}`);
            orderedRootIds.push(candidate.lineageId);
            subIndex += 1;
        });

        const rigOwnerOfLineage = new Map();
        const resolveOwner = (lineageId) => {
            if (rigOwnerOfLineage.has(lineageId)) return rigOwnerOfLineage.get(lineageId);
            const chain = [];
            let current = lineageId;
            let owner = null;
            while (current) {
                if (rigOwnerOfLineage.has(current)) {
                    owner = rigOwnerOfLineage.get(current);
                    break;
                }
                if (rigIdByRootLineage.has(current)) {
                    owner = rigIdByRootLineage.get(current);
                    break;
                }
                if (isTrunkLineage(current)) {
                    owner = trunkCore.id;
                    break;
                }
                chain.push(current);
                const parentId = lineageById.get(current)?.parentLineageId;
                current = parentId == null ? null : String(parentId);
                if (current && !lineageById.has(current)) current = null;
            }
            const resolved = owner || trunkCore.id;
            chain.forEach((entry) => rigOwnerOfLineage.set(entry, resolved));
            rigOwnerOfLineage.set(lineageId, resolved);
            return resolved;
        };
        lineageById.forEach((_lineage, lineageId) => resolveOwner(lineageId));

        const lineagesByRig = new Map();
        rigOwnerOfLineage.forEach((rigId, lineageId) => {
            if (!lineagesByRig.has(rigId)) lineagesByRig.set(rigId, []);
            lineagesByRig.get(rigId).push(lineageId);
        });

        // The rig's parent is the rig that owns its root lineage's parent —
        // again a lookup, not a distance test. Two rigs can now share a pivot
        // only when one really does hang off the other there.
        const parentRigOf = (rootLineageId) => {
            const parentId = lineageById.get(rootLineageId)?.parentLineageId;
            if (parentId == null || !lineageById.has(String(parentId))) return trunkCore.id;
            return resolveOwner(String(parentId));
        };

        const rigDepthOf = (rootLineageId) => {
            let depth = 0;
            let parentRigId = parentRigOf(rootLineageId);
            const guard = new Set();
            while (parentRigId && parentRigId !== trunkCore.id && !guard.has(parentRigId)) {
                guard.add(parentRigId);
                depth += 1;
                const parentRootId = orderedRootIds.find(
                    (candidate) => rigIdByRootLineage.get(candidate) === parentRigId,
                );
                if (!parentRootId) break;
                parentRigId = parentRigOf(parentRootId);
            }
            return depth;
        };

        const limbs = [];
        orderedRootIds.forEach((rootLineageId) => {
            const rigId = rigIdByRootLineage.get(rootLineageId);
            const ownedLineageIds = lineagesByRig.get(rigId) || [rootLineageId];
            const geometry = collectRigGeometry(ownedLineageIds, surfacesByLineage);
            const bounds = computeBounds(geometry.points);
            const rootNodeId = rootNodeIdByLineage.get(rootLineageId);
            const pivot = resolveRigPivot({ rootLineageId, rootNodeId, surfacesByLineage });
            if (!pivot) return;

            const rootSurfaces = surfacesByLineage.get(rootLineageId) || [];
            const rootCenterline = rootSurfaces.find(
                (surface) => surface.centerline?.length > 0,
            )?.centerline || [];
            const tip = rootCenterline.at(-1) || { x: bounds.centerX, y: bounds.minY };
            const depth = rigDepthOf(rootLineageId);
            const isPrimary = depth === 0;
            // Stiffness comes off the wood, not off the rig's place in this
            // tree. Two limbs at the same depth are not alike, and a sub-limb
            // of a heavy bough is often thicker than somebody else's primary.
            const entry = mechanicsOf.get(rootLineageId) || null;
            const mechanics = resolveRigMechanics(entry);

            limbs.push(Object.freeze({
                id: rigId,
                limbKey: isPrimary ? `Scaffold ${limbs.length + 1}` : `Sub-Branch ${limbs.length + 1}`,
                tier: isPrimary ? 1 : 2,
                depth,
                role: isPrimary ? 'articulated_major_limb' : 'articulated_sub_limb',
                parentLimbId: parentRigOf(rootLineageId),
                rootLineageId,
                pivot: { x: rounded(pivot.x), y: rounded(pivot.y) },
                bounds,
                length: rounded(pointDistance(pivot, tip)),
                baseAngleRad: rounded(Math.atan2(tip.y - pivot.y, tip.x - pivot.x)),
                stiffness: mechanics.stiffness,
                naturalFrequencyHz: mechanics.naturalFrequencyHz,
                // How far along the wood the wind has had to travel to get
                // here, as a fraction of the longest run in this tree. Motion
                // turns it into a delay so the crown answers after the base.
                pathFraction: rounded(entry?.pathFraction ?? 0, 4),
                slenderness: rounded(entry?.slenderness ?? 0, 2),
                girthShare: rounded(entry?.girthShare ?? 0, 4),
                radiusDecades: rounded(entry?.radiusDecades ?? 1, 4),
                carriedVolume: rounded(entry?.carriedVolume ?? 0, 1),
                visualMass: rounded(geometry.mass, 1),
                surfaceIds: geometry.surfaceIds,
                lineageIds: Object.freeze([...ownedLineageIds]),
                nodeIds: Array.from(geometry.nodeIds),
                surfaceCount: geometry.surfaceIds.length,
            }));
        });

        const liveRigIds = new Set(limbs.map((limb) => limb.id));
        // A rig whose pivot could not be seated was dropped above; anything it
        // owned falls to its nearest surviving ancestor rather than to a
        // silently different one.
        const rigForLineageId = (lineageId) => {
            let owner = lineageRigMap[String(lineageId)]
                || rigOwnerOfLineage.get(String(lineageId));
            let guard = 0;
            while (owner && owner !== trunkCore.id && !liveRigIds.has(owner) && guard < 32) {
                const rootId = orderedRootIds.find(
                    (candidate) => rigIdByRootLineage.get(candidate) === owner,
                );
                owner = rootId ? parentRigOf(rootId) : trunkCore.id;
                guard += 1;
            }
            return owner || trunkCore.id;
        };

        const lineageRigMap = {};
        lineageById.forEach((_lineage, lineageId) => {
            lineageRigMap[lineageId] = rigForLineageId(lineageId);
        });
        // Canopy twigs are grafted presentation wood: their lineage ids are
        // minted by the twig volume, not by the growth kernel, so they resolve
        // through the real axis they were anchored to. A twig rides the branch
        // it grows on, which is also the only reading under which its blossoms
        // stay on that branch.
        (Array.isArray(canopyTwigEntries) ? canopyTwigEntries : []).forEach((entry) => {
            const twigLineageId = entry?.lineageId == null ? null : String(entry.lineageId);
            const anchorLineageId = entry?.sourceLineageId == null
                ? null
                : String(entry.sourceLineageId);
            if (!twigLineageId || lineageRigMap[twigLineageId] !== undefined) return;
            if (!anchorLineageId || !lineageById.has(anchorLineageId)) return;
            lineageRigMap[twigLineageId] = rigForLineageId(anchorLineageId);
        });

        // --- Junctions --------------------------------------------------
        // A junction patch is the swelling that closes the shoulder where a
        // branch leaves its parent, so it straddles two rigs and can only ride
        // one of them. It rides the branch.
        //
        // Riding the parent — which is what "the wood that arrives here" gives
        // you — looks wrong for the same reason it sounds right: the child
        // hinges about this very node, so the patch stays put while the branch
        // swings out from under it, and the shoulder reads as a blob pinned at
        // the fork with a gap opening beside it. Riding the child instead turns
        // the patch about the node it is centred on, so it stays welded to the
        // moving branch; the mismatch moves to the parent side, where it is
        // covered by wood several times thicker.
        const lineageOfNode = new Map();
        (graph?.nodes || []).forEach((node) => {
            const incoming = node?.incomingSegmentId
                ? segmentById.get(String(node.incomingSegmentId))
                : null;
            if (incoming?.lineageId !== undefined) {
                lineageOfNode.set(String(node.id), String(incoming.lineageId));
            }
        });
        const departuresFromNode = new Map();
        (graph?.segments || []).forEach((segment) => {
            const fromNodeId = String(segment.fromNodeId);
            if (!departuresFromNode.has(fromNodeId)) departuresFromNode.set(fromNodeId, []);
            departuresFromNode.get(fromNodeId).push(segment);
        });
        (Array.isArray(canopyTwigEntries) ? canopyTwigEntries : []).forEach((entry) => {
            const twigLineageId = entry?.lineageId == null ? null : String(entry.lineageId);
            if (entry?.toNodeId != null && twigLineageId) {
                lineageOfNode.set(String(entry.toNodeId), twigLineageId);
            }
            if (entry?.fromNodeId != null && twigLineageId) {
                const fromNodeId = String(entry.fromNodeId);
                if (!departuresFromNode.has(fromNodeId)) departuresFromNode.set(fromNodeId, []);
                departuresFromNode.get(fromNodeId).push(entry);
            }
        });
        const junctionRigMap = {};
        junctions.forEach((junction) => {
            const nodeKey = String(junction.nodeId);
            const arrivingLineageId = lineageOfNode.get(nodeKey);
            const arrivingRigId = arrivingLineageId
                ? rigForLineageId(arrivingLineageId)
                : trunkCore.id;
            // The stoutest branch leaving this node that is not already on the
            // arriving rig. Stoutest because that is the one whose shoulder is
            // widest, so it is the mismatch a viewer would see first.
            let claimantRigId = null;
            let claimantRadius = -1;
            (departuresFromNode.get(nodeKey) || []).forEach((segment) => {
                if (segment.lineageId === undefined || segment.lineageId === null) return;
                const rigId = rigForLineageId(String(segment.lineageId));
                if (rigId === arrivingRigId) return;
                const radius = Math.max(0, finite(segment.startRadius, 0));
                if (radius > claimantRadius) {
                    claimantRadius = radius;
                    claimantRigId = rigId;
                }
            });
            junctionRigMap[junction.id] = claimantRigId || arrivingRigId;
        });

        // --- Tier 3: blossom clouds -------------------------------------
        // Cut inside a rig, never across two. The grid still decides how a
        // rig's blossoms are grouped for baking, but it can no longer decide
        // *which branch they belong to* — that came from the lineage before the
        // grid was consulted, which is why a cluster and its flowers can no
        // longer come apart.
        const flowerCommands = [
            ...(floweringPresentation?.backCommands || []),
            ...(floweringPresentation?.frontCommands || []),
        ].filter((command) => command.type === 'projectedSakuraBlossom');

        const canopyPoints = [];
        if (flowerCommands.length > 0) {
            flowerCommands.forEach((command, index) => {
                canopyPoints.push({
                    id: `flower_${index}`,
                    x: command.x,
                    y: command.y,
                    scale: command.drawSize || 12,
                    isFlower: true,
                    rigId: command.sourceLineageId != null
                        ? rigForLineageId(command.sourceLineageId)
                        : trunkCore.id,
                });
            });
        } else {
            visibleSegments.forEach((segment, index) => {
                if (!(segment.tier >= 1 || segment.isCanopyTwig)) return;
                canopyPoints.push({
                    id: `twig_${index}`,
                    x: segment.end.x,
                    y: segment.end.y,
                    scale: (segment.end.radius || 2) * 4,
                    isFlower: false,
                    rigId: segment.lineageId != null
                        ? rigForLineageId(segment.lineageId)
                        : trunkCore.id,
                });
            });
        }

        const spatialBuckets = new Map();
        canopyPoints.forEach((point) => {
            const cellX = Math.floor(point.x / CLUSTER_GRID_SIZE);
            const cellY = Math.floor(point.y / CLUSTER_GRID_SIZE);
            const cellKey = `${point.rigId}|${cellX}_${cellY}`;
            if (!spatialBuckets.has(cellKey)) spatialBuckets.set(cellKey, []);
            spatialBuckets.get(cellKey).push(point);
        });

        const canopyClusters = [];
        let clusterIndex = 0;
        spatialBuckets.forEach((members) => {
            if (members.length === 0) return;
            const clusterBounds = computeBounds(members);
            const centroid = { x: clusterBounds.centerX, y: clusterBounds.centerY };
            const maxDistFromCentroid = Math.max(
                16,
                ...members.map((member) => pointDistance(centroid, member)),
            );
            canopyClusters.push(Object.freeze({
                id: `canopy_cluster_${clusterIndex}`,
                tier: 3,
                role: 'foliage_blossom_cloud',
                parentLimbId: members[0].rigId,
                centroid,
                radius: rounded(maxDistFromCentroid + 12),
                bounds: clusterBounds,
                flowerCount: members.filter((member) => member.isFlower).length,
                elementCount: members.length,
                elementIds: members.map((member) => member.id),
                flutterPeriodMultiplier: rounded(1.2 + ((clusterIndex % 4) * 0.25)),
            }));
            clusterIndex += 1;
        });

        const unbakedObjectCount = surfaces.length + junctions.length + canopyPoints.length;
        const bakedSpriteCount = 1 + limbs.length;
        const reductionPercentage = unbakedObjectCount > 0
            ? rounded(((unbakedObjectCount - bakedSpriteCount) / unbakedObjectCount) * 100, 1)
            : 0;

        return Object.freeze({
            contract: CONTRACT_ID,
            trunkCore,
            limbs: Object.freeze(limbs),
            lineageRigMap: Object.freeze(lineageRigMap),
            junctionRigMap: Object.freeze(junctionRigMap),
            canopyClusters: Object.freeze(canopyClusters),
            stats: Object.freeze({
                unbakedObjectCount,
                bakedSpriteCount,
                trunkCount: 1,
                limbCount: limbs.length,
                clusterCount: canopyClusters.length,
                lineageCount: lineageById.size,
                reductionPercentage,
                estimatedDrawCalls: Math.min(bakedSpriteCount, 4),
            }),
        });
    }

    const partitionerAPI = Object.freeze({
        CONTRACT_ID,
        buildPixiBakingPlan,
    });

    scope.ZenBonsaiPixiBakingPartitioner = partitionerAPI;
}(globalThis));
