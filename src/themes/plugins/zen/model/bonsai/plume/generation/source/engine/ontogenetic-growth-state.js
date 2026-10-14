import {zenPlumeKernelRealm} from "../../kernelRealm.js";
import {releaseCrownBase} from "../research/factor-growth-4/ZenG15ReleaseGrowth.js";
/**
 * G15.4 specimen ontogeny owner.
 *
 * The recursive graph remains the authority for where and when wood is born.
 * This owner supplies two continuous histories that the former event-only
 * presentation did not express:
 *
 * 1. one root-family crown-base competence, accumulated along real order-zero
 *    axis arc before any crown-forming divergence may commit; and
 * 2. a detachable secondary-growth clock that lets old supporting wood thicken
 *    after extension without changing graph resources, collision geometry, or
 *    scaffold authorization.
 *
 * Neither history reads a completed silhouette or screen-space height.
 */
(function installTypedOntogeneticGrowthState(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    if (!programs) {
        throw new Error(
            '[G15.4_ONTOGENY] developmental-programs.js must load first.',
        );
    }

    const { clamp, rounded } = programs;

    const ONTOGENY_SEMANTICS =
        'continuous_seedling_to_bonsai_ontogeny_v2';
    const CROWN_BASE_COMPETENCE_SEMANTICS =
        'root_family_axis_arc_crown_base_competence_v1';
    const SECONDARY_WOOD_GROWTH_SEMANTICS =
        'age_supported_load_and_training_memory_secondary_wood_growth_v2';
    const JUVENILE_SHOOT_OPPORTUNITY_SEMANTICS =
        'root_family_temporary_juvenile_shoot_opportunity_v1';
    const JUVENILE_AXIS_RETIREMENT_SEMANTICS =
        'event_sourced_juvenile_sacrifice_axis_retirement_v1';
    const SPECIMEN_GROWTH_PHASES = Object.freeze({
        SAPLING: 'sapling_emergence',
        JUVENILE_BOLE: 'juvenile_bole_establishment',
        CROWN_ESTABLISHMENT: 'crown_establishment',
        RAMIFICATION: 'ramification',
        MATURE: 'mature_bonsai',
    });

    // Scaled to 0.8x the original per-form budget. The absolute arc-length
    // target below reads consistently, but the vertical height it turns into
    // is noisy — the same target has produced a bare trunk anywhere from
    // roughly a quarter to over two-thirds of the finished tree's height
    // across seeds. The original centers put the *typical* case close to
    // half; measured against ~90 seeds per form, this 0.8x scale puts the
    // median close to the intended one-third instead, without moving the
    // per-form and per-preset shifts below, so a literati trunk (`bunjin`,
    // +0.78 unscaled) still reads distinctly longer than a twin-trunk one
    // (`sokan`, -0.54). A rare seed can still land well above the target —
    // that budget is arc length, not the finished silhouette, so nothing
    // here can look ahead and cap it — the debug panel's reroll is the
    // practical way past one of those.
    const FORM_CROWN_BASE_PROGRAMS = Object.freeze({
        central_recursive_meander: Object.freeze({
            center: 4.44,
            minimum: 3.84,
            maximum: 5.04,
        }),
        low_spread: Object.freeze({
            center: 2.32,
            minimum: 1.88,
            maximum: 2.76,
        }),
        asymmetric_counterweight: Object.freeze({
            center: 3.8,
            minimum: 3.24,
            maximum: 4.4,
        }),
        weeping_release: Object.freeze({
            center: 3.56,
            minimum: 3.0,
            maximum: 4.16,
        }),
        terminal_multisplit: Object.freeze({
            center: 2.8,
            minimum: 2.44,
            maximum: 3.24,
        }),
    });

    const PRESET_CROWN_BASE_SHIFT = Object.freeze({
        natural: 0,
        moyogi: 0.22,
        bunjin: 0.78,
        shakan: -0.14,
        sokan: -0.54,
        fukinagashi: -0.3,
        kengai: -0.56,
    });

    const TRAIT_CROWN_BASE_SHIFT = Object.freeze({
        balanced_natural: 0,
        deep_meander: 0.24,
        codominant_forks: -0.24,
        weeping_temperament: -0.1,
        fine_ramification: 0.15,
    });

    function deterministicPhase(spec = {}, salt = 0) {
        const temperament = spec.temperament || {};
        return (
            Math.sin(
                Number(temperament.developmentalPhase || 0) * 3.17
                    + Number(temperament.resourceBias || 0.5) * 2.31
                    + Number(temperament.clusterSlot || 0) * 1.73
                    + Number(spec.sequence || 0) * 0.619
                    + salt,
            ) + 1
        ) * 0.5;
    }

    function validOntogeny(value) {
        return value?.semantics === ONTOGENY_SEMANTICS;
    }

    function resolveCrownBaseTarget(spec = {}) {
        const program = FORM_CROWN_BASE_PROGRAMS[spec.formKind]
            || FORM_CROWN_BASE_PROGRAMS.central_recursive_meander;
        const referenceLength = Math.max(
            8,
            Number(spec.referenceLength || spec.birthLength || 42),
        );
        const phaseShift = (deterministicPhase(spec, 5.83) - 0.5) * 0.9;
        const targetInternodes = clamp(
            program.center
                + Number(PRESET_CROWN_BASE_SHIFT[spec.presetId] || 0)
                + Number(TRAIT_CROWN_BASE_SHIFT[spec.traitId] || 0)
                + phaseShift,
            program.minimum,
            program.maximum
                + (spec.presetId === 'bunjin' ? 0.62 : 0),
        );
        return Object.freeze({
            targetArcLength: rounded(referenceLength * targetInternodes),
            targetInternodes: rounded(targetInternodes),
            referenceLength: rounded(referenceLength),
            phaseSample: rounded(deterministicPhase(spec, 5.83)),
            formKind: String(
                spec.formKind || 'central_recursive_meander',
            ),
            presetId: String(spec.presetId || 'natural'),
            traitId: String(spec.traitId || 'balanced_natural'),
        });
    }

    function createRootOntogeny(spec = {}) {
        const target = releaseCrownBase(resolveCrownBaseTarget(spec));
        const juvenileShootPhase = deterministicPhase(spec, 8.71);
        const juvenileShootPresencePhase = deterministicPhase(spec, 11.37);
        return Object.freeze({
            semantics: ONTOGENY_SEMANTICS,
            phase: SPECIMEN_GROWTH_PHASES.SAPLING,
            applicable: true,
            rootAxisFamilyId: String(
                spec.axisFamilyId || spec.lineageId || 'root-axis-family',
            ),
            targetArcLength: target.targetArcLength,
            targetInternodes: target.targetInternodes,
            referenceLength: target.referenceLength,
            phaseSample: target.phaseSample,
            formKind: target.formKind,
            presetId: target.presetId,
            traitId: target.traitId,
            realizedArcLength: 0,
            progress: 0,
            crownBaseReady: false,
            crownBaseEstablished: false,
            crownBaseEstablishedAtSequence: null,
            crownFormationKind: null,
            juvenileShootTriggerProgress: rounded(
                0.3 + juvenileShootPhase * 0.22,
            ),
            maximumJuvenileShoots: Number(
                juvenileShootPresencePhase >= 0.25,
            ),
            juvenileShootPresencePhase: rounded(
                juvenileShootPresencePhase,
            ),
            juvenileShootCount: 0,
            lastJuvenileShootSequence: null,
            lastJuvenileShootLineageId: null,
        });
    }

    function createInactiveOntogeny(spec = {}) {
        return Object.freeze({
            semantics: ONTOGENY_SEMANTICS,
            phase: SPECIMEN_GROWTH_PHASES.CROWN_ESTABLISHMENT,
            applicable: false,
            rootAxisFamilyId: String(
                spec.axisFamilyId || spec.lineageId || 'local-axis-family',
            ),
            targetArcLength: 0,
            targetInternodes: 0,
            referenceLength: rounded(Math.max(
                0,
                Number(spec.referenceLength || spec.birthLength || 0),
            )),
            phaseSample: null,
            formKind: null,
            presetId: null,
            traitId: null,
            realizedArcLength: 0,
            progress: 1,
            crownBaseReady: true,
            crownBaseEstablished: true,
            crownBaseEstablishedAtSequence: null,
            crownFormationKind: 'not_applicable',
            juvenileShootTriggerProgress: null,
            maximumJuvenileShoots: 0,
            juvenileShootPresencePhase: null,
            juvenileShootCount: 0,
            lastJuvenileShootSequence: null,
            lastJuvenileShootLineageId: null,
        });
    }

    function advanceRootOntogeny(ontogeny, distance) {
        if (!validOntogeny(ontogeny) || !ontogeny.applicable) {
            return ontogeny || createInactiveOntogeny();
        }
        if (ontogeny.crownBaseEstablished) return ontogeny;
        const realizedArcLength = Math.max(
            0,
            Number(ontogeny.realizedArcLength || 0)
                + Math.max(0, Number(distance || 0)),
        );
        const targetArcLength = Math.max(
            1,
            Number(ontogeny.targetArcLength || 1),
        );
        const progress = clamp(realizedArcLength / targetArcLength, 0, 1);
        return Object.freeze({
            ...ontogeny,
            phase: progress >= 1
                ? SPECIMEN_GROWTH_PHASES.CROWN_ESTABLISHMENT
                : SPECIMEN_GROWTH_PHASES.JUVENILE_BOLE,
            realizedArcLength: rounded(realizedArcLength),
            progress: rounded(progress),
            crownBaseReady: realizedArcLength >= targetArcLength,
        });
    }

    function commitCrownFormation(ontogeny, spec = {}) {
        if (!validOntogeny(ontogeny) || !ontogeny.applicable) {
            return ontogeny || createInactiveOntogeny(spec);
        }
        if (ontogeny.crownBaseEstablished) return ontogeny;
        return Object.freeze({
            ...ontogeny,
            phase: SPECIMEN_GROWTH_PHASES.CROWN_ESTABLISHMENT,
            progress: 1,
            crownBaseReady: true,
            crownBaseEstablished: true,
            crownBaseEstablishedAtSequence: Number(spec.sequence || 0),
            crownFormationKind: String(
                spec.kind || 'root_family_crown_formation',
            ),
        });
    }

    function resolveJuvenileShootOpportunity(frontier = {}, portfolio = null) {
        const axisOrder = Number(frontier.axisOrder ?? frontier.tier ?? 1);
        const ontogeny = frontier.meristemCadence?.ontogeny || null;
        const constructionPortfolio = portfolio
            || frontier.constructionPortfolio
            || {};
        const applicable = axisOrder === 0
            && validOntogeny(ontogeny)
            && ontogeny.applicable
            && !ontogeny.crownBaseEstablished;
        const progress = applicable
            ? clamp(Number(ontogeny.progress || 0), 0, 1)
            : 1;
        const triggerProgress = applicable
            ? clamp(Number(ontogeny.juvenileShootTriggerProgress || 0.4), 0, 1)
            : null;
        const shootCount = Math.max(
            0,
            Number(ontogeny?.juvenileShootCount || 0),
        );
        const maximumShootCount = Math.max(
            0,
            Number(ontogeny?.maximumJuvenileShoots || 0),
        );
        const opportunityPotential = clamp(
            Number(constructionPortfolio.lateralOpportunityPotential || 0),
            0,
            2.45,
        );
        const constructionBudget = Math.max(
            0,
            Number(constructionPortfolio.lateralConstructionBudget || 0),
        );
        const hasConstruction = constructionBudget >= 0.055;
        const hasOpportunity = opportunityPotential > 0.08;
        const eligible = applicable
            && progress + 1e-8 >= triggerProgress
            && progress < 0.82
            && shootCount < maximumShootCount
            && hasConstruction
            && hasOpportunity;
        return Object.freeze({
            semantics: JUVENILE_SHOOT_OPPORTUNITY_SEMANTICS,
            eligible,
            decision: eligible ? 'granted' : 'dormant',
            reason: !applicable
                ? 'juvenile_root_bole_not_applicable'
                : (shootCount >= maximumShootCount
                    ? 'juvenile_shoot_quota_realized'
                    : (progress >= 0.82
                        ? 'juvenile_shoot_window_closed'
                        : (progress + 1e-8 < triggerProgress
                        ? 'juvenile_shoot_trigger_not_reached'
                        : (!hasConstruction
                            ? 'insufficient_juvenile_shoot_construction'
                            : (!hasOpportunity
                                ? 'insufficient_juvenile_shoot_opportunity'
                                : 'juvenile_shoot_opportunity_granted'))))),
            applicable,
            progress: rounded(progress),
            triggerProgress: triggerProgress === null
                ? null
                : rounded(triggerProgress),
            shootCount,
            maximumShootCount,
            opportunityPotential: rounded(opportunityPotential),
            constructionBudget: rounded(constructionBudget),
            crownBaseEstablished: Boolean(ontogeny?.crownBaseEstablished),
        });
    }

    function commitJuvenileShoot(ontogeny, spec = {}) {
        if (
            !validOntogeny(ontogeny)
            || !ontogeny.applicable
            || ontogeny.crownBaseEstablished
        ) return ontogeny || createInactiveOntogeny(spec);
        return Object.freeze({
            ...ontogeny,
            juvenileShootCount: Math.min(
                Number(ontogeny.maximumJuvenileShoots || 0),
                Number(ontogeny.juvenileShootCount || 0) + 1,
            ),
            lastJuvenileShootSequence: Number(spec.sequence || 0),
            lastJuvenileShootLineageId: String(
                spec.lineageId || 'pending-juvenile-axis',
            ),
        });
    }

    function resolveCrownBaseCompetence(frontier = {}) {
        const axisOrder = Number(frontier.axisOrder ?? frontier.tier ?? 1);
        const ontogeny = frontier.meristemCadence?.ontogeny || null;
        if (axisOrder !== 0 || !validOntogeny(ontogeny) || !ontogeny.applicable) {
            return Object.freeze({
                semantics: CROWN_BASE_COMPETENCE_SEMANTICS,
                eligible: true,
                decision: 'not_required',
                reason: axisOrder !== 0
                    ? 'non_order_zero_axis'
                    : 'local_axis_family_without_root_bole',
                applicable: false,
                progress: 1,
                realizedArcLength: null,
                targetArcLength: null,
                targetInternodes: null,
                crownBaseEstablished: true,
                crownBaseEstablishedAtSequence: null,
            });
        }
        const realizedArcLength = Math.max(
            0,
            Number(ontogeny.realizedArcLength || 0),
        );
        const targetArcLength = Math.max(
            1,
            Number(ontogeny.targetArcLength || 1),
        );
        const ready = ontogeny.crownBaseEstablished
            || realizedArcLength >= targetArcLength;
        return Object.freeze({
            semantics: CROWN_BASE_COMPETENCE_SEMANTICS,
            eligible: ready,
            decision: ready ? 'granted' : 'deferred',
            reason: ontogeny.crownBaseEstablished
                ? 'crown_base_already_established'
                : (ready
                    ? 'juvenile_bole_arc_target_reached'
                    : 'juvenile_bole_arc_target_not_reached'),
            applicable: true,
            progress: rounded(clamp(realizedArcLength / targetArcLength, 0, 1)),
            realizedArcLength: rounded(realizedArcLength),
            targetArcLength: rounded(targetArcLength),
            targetInternodes: rounded(Number(ontogeny.targetInternodes || 0)),
            distanceToCompetence: rounded(Math.max(
                0,
                targetArcLength - realizedArcLength,
            )),
            crownBaseEstablished: Boolean(ontogeny.crownBaseEstablished),
            crownBaseEstablishedAtSequence:
                ontogeny.crownBaseEstablishedAtSequence,
        });
    }

    function smoothstep(value) {
        const progress = clamp(Number(value || 0), 0, 1);
        return progress * progress * (3 - 2 * progress);
    }

    function resolveSecondaryWoodGrowth(spec = {}) {
        const axisOrder = Math.max(0, Math.round(Number(spec.axisOrder || 0)));
        const eventAge = Math.max(
            0,
            Number(spec.eventLimit || 0) - Number(spec.birthEvent || 0),
        );
        const maturationSpan = axisOrder === 0
            ? 30
            : (axisOrder === 1 ? 22 : 15);
        const ageProgress = smoothstep(eventAge / maturationSpan);
        const supportedLoad = clamp(Number(spec.supportedLoad || 0), 0, 1.25);
        const initialScale = spec.rootOrigin
            ? 0.55
            : (axisOrder === 0 ? 0.2 : (axisOrder === 1 ? 0.14 : 0.09));
        const matureScale = axisOrder === 0
            ? 1.16 + supportedLoad * 0.06
            : (axisOrder === 1
                ? 1.08 + supportedLoad * 0.06
                : 1.02 + supportedLoad * 0.04);
        const baseScale = initialScale + (matureScale - initialScale) * ageProgress;
        const rootArcFraction = clamp(Number(spec.rootArcFraction || 1), 0, 1);
        const basalFlare = axisOrder === 0 && spec.rootFamily
            ? 1 + Math.max(0, 1 - rootArcFraction / 0.18) * 0.1
            : 1;
        return Object.freeze({
            semantics: SECONDARY_WOOD_GROWTH_SEMANTICS,
            axisOrder,
            eventAge: rounded(eventAge),
            maturationSpan,
            ageProgress: rounded(ageProgress),
            supportedLoad: rounded(supportedLoad),
            initialScale: rounded(initialScale),
            matureScale: rounded(matureScale),
            basalFlare: rounded(basalFlare),
            radiusScale: rounded(baseScale * basalFlare),
        });
    }

    function resolveSpecimenGrowthSnapshot(graph = {}, eventLimit = 0, developmentClock) {
        const events = Array.isArray(graph.events) ? graph.events : [];
        const maximumEvent = Math.max(
            0,
            ...events.map((event) => Number(event.sequence || 0)),
        );
        const visibleLimit = clamp(Number(eventLimit || 0), 0, maximumEvent);
        const progress = developmentClock === undefined
            ? (maximumEvent > 0 ? visibleLimit / maximumEvent : 1)
            : developmentClock.progress;
        const retirementByLineage = new Map(
            (graph.juvenileAxisRetirements || []).map((retirement) => [
                retirement.lineageId,
                retirement,
            ]),
        );
        const visibleSegments = (graph.segments || []).filter((segment) => {
            const retirement = retirementByLineage.get(segment.lineageId);
            return Number(segment.sequence || segment.birthEvent || 0)
                    <= visibleLimit
                && (!retirement
                    || Number(retirement.retiredAtEvent) > visibleLimit);
        });
        const visibleOrderOne = visibleSegments.some(
            (segment) => (
                segment.developmentalRole !== 'juvenile_sacrifice_axis'
                && Number(segment.axisOrder ?? segment.tier ?? 0) >= 1
            ),
        );
        const visibleOrderTwo = visibleSegments.some(
            (segment) => Number(segment.axisOrder ?? segment.tier ?? 0) >= 2,
        );
        const nodeBirthById = new Map((graph.nodes || []).map((node) => [
            node.id,
            Number(node.birthEvent || 0),
        ]));
        const rootFrontier = (graph.frontiers || [])
            .filter((frontier) => (
                Number(frontier.axisOrder ?? frontier.tier ?? 1) === 0
                && frontier.meristemCadence?.ontogeny?.applicable
                && Number(nodeBirthById.get(frontier.nodeId) ?? Infinity)
                    <= visibleLimit
            ))
            .sort((left, right) => (
                Number(
                    right.meristemCadence.ontogeny.crownBaseEstablished,
                ) - Number(
                    left.meristemCadence.ontogeny.crownBaseEstablished,
                )
                || Number(
                    right.meristemCadence.ontogeny.realizedArcLength || 0,
                ) - Number(
                    left.meristemCadence.ontogeny.realizedArcLength || 0,
                )
            ))[0];
        const competence = resolveCrownBaseCompetence(rootFrontier || {});
        let phase = SPECIMEN_GROWTH_PHASES.SAPLING;
        if (visibleLimit > 0) phase = SPECIMEN_GROWTH_PHASES.JUVENILE_BOLE;
        if (visibleOrderOne || competence.crownBaseEstablished) {
            phase = SPECIMEN_GROWTH_PHASES.CROWN_ESTABLISHMENT;
        }
        if (visibleOrderTwo) phase = SPECIMEN_GROWTH_PHASES.RAMIFICATION;
        if (progress === 1 && visibleLimit >= maximumEvent && graph.completionStatus?.settled) {
            phase = SPECIMEN_GROWTH_PHASES.MATURE;
        }
        return Object.freeze({
            semantics: ONTOGENY_SEMANTICS,
            phase,
            eventLimit: rounded(visibleLimit),
            maximumEvent,
            progress: rounded(progress),
            visibleSegmentCount: visibleSegments.length,
            crownBaseCompetence: competence,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerOntogeny = Object.freeze({
        ONTOGENY_SEMANTICS,
        CROWN_BASE_COMPETENCE_SEMANTICS,
        SECONDARY_WOOD_GROWTH_SEMANTICS,
        JUVENILE_SHOOT_OPPORTUNITY_SEMANTICS,
        JUVENILE_AXIS_RETIREMENT_SEMANTICS,
        SPECIMEN_GROWTH_PHASES,
        createRootOntogeny,
        createInactiveOntogeny,
        advanceRootOntogeny,
        commitCrownFormation,
        resolveJuvenileShootOpportunity,
        commitJuvenileShoot,
        resolveCrownBaseCompetence,
        resolveSecondaryWoodGrowth,
        resolveSpecimenGrowthSnapshot,
    });
}(zenPlumeKernelRealm));
