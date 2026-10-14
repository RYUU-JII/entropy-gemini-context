/**
 * G15.4 node-meristem competition owner.
 *
 * A structural fork and a lateral meristem cannot independently commit the
 * same node. An ordinary advance may, however, create its apical continuation
 * and one lateral axis in the same atomic transaction. No delayed scheduler
 * revisits the node after the parent has moved on.
 */
(function installTypedDevelopmentalNodeMeristemField(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    if (!programs) {
        throw new Error('[G15.4_MERISTEM] developmental-programs.js must load first.');
    }
    const { NODE_MERISTEM_SEMANTICS: MERISTEM_SEMANTICS } = programs;

    function ensureSite(context, nodeId) {
        let site = context.nodeMeristemSiteIndex.get(nodeId);
        if (!site) {
            site = {
                nodeId,
                semantics: MERISTEM_SEMANTICS,
                lateralMeristemIds: [],
                registeredAtEvents: [],
                structuralForkEvent: null,
                structuralFrontierId: null,
                emittedLateralMeristemId: null,
                emittedAtEvent: null,
                suppressedLateralMeristemIds: [],
                state: 'open',
            };
            context.nodeMeristemSites.push(site);
            context.nodeMeristemSiteIndex.set(nodeId, site);
        }
        return site;
    }

    function registerLateralMeristemPotential(context, meristem, sequence) {
        const site = ensureSite(context, meristem.nodeId);
        if (!site.lateralMeristemIds.includes(meristem.id)) {
            site.lateralMeristemIds.push(meristem.id);
            site.registeredAtEvents.push(sequence);
        }
        return site;
    }

    function activeFrontiersAtNode(context, nodeId) {
        return [...context.activeFrontierIds]
            .map((frontierId) => context.frontierIndex.get(frontierId))
            .filter((frontier) => frontier?.nodeId === nodeId);
    }

    function resolveLateralEmissionCompetition(context, meristem) {
        const site = ensureSite(context, meristem.nodeId);
        const occupyingFrontiers = activeFrontiersAtNode(context, meristem.nodeId);
        const available = site.structuralForkEvent === null
            && site.emittedLateralMeristemId === null
            && occupyingFrontiers.length === 0;
        return Object.freeze({
            semantics: MERISTEM_SEMANTICS,
            available,
            state: site.structuralForkEvent !== null
                ? 'consumed_by_structural_fork'
                : (site.emittedLateralMeristemId !== null
                    ? 'consumed_by_lateral_emission'
                    : (occupyingFrontiers.length
                        ? 'waiting_for_apical_release'
                        : 'available')),
            nodeId: meristem.nodeId,
            occupyingFrontierIds: Object.freeze(occupyingFrontiers.map(
                (frontier) => frontier.id,
            )),
        });
    }

    function settleNodeForStructuralFork(context, nodeId, frontierId, sequence) {
        const site = ensureSite(context, nodeId);
        if (site.emittedLateralMeristemId !== null) {
            throw new Error(
                `[G15.4_MERISTEM] Structural fork cannot reuse emitted site ${nodeId}.`,
            );
        }
        const suppressedLateralMeristemIds = site.lateralMeristemIds.filter((meristemId) => {
            const meristem = context.lateralMeristemIndex.get(meristemId);
            return meristem?.status === 'registered';
        });
        suppressedLateralMeristemIds.forEach((meristemId) => {
            const meristem = context.lateralMeristemIndex.get(meristemId);
            meristem.status = 'suppressed';
            meristem.suppressedAtEvent = sequence;
            meristem.suppressionReason = 'node_consumed_by_structural_fork';
            context.activeLateralMeristemIds.delete(meristemId);
        });
        site.structuralForkEvent = sequence;
        site.structuralFrontierId = frontierId;
        site.suppressedLateralMeristemIds.push(...suppressedLateralMeristemIds);
        site.state = 'structural_fork_committed';
        return Object.freeze({
            semantics: MERISTEM_SEMANTICS,
            nodeId,
            state: site.state,
            structuralForkEvent: sequence,
            structuralFrontierId: frontierId,
            suppressedLateralMeristemIds: Object.freeze([
                ...suppressedLateralMeristemIds,
            ]),
        });
    }

    function commitLateralMeristemEmission(context, meristem, sequence, options = {}) {
        const competition = resolveLateralEmissionCompetition(context, meristem);
        const coincidentContinuation = Boolean(options.coincidentContinuation);
        const availableWithContinuation = coincidentContinuation
            && competition.state === 'waiting_for_apical_release'
            && competition.occupyingFrontierIds.length === 1;
        if (!competition.available && !availableWithContinuation) {
            throw new Error(
                `[G15.4_MERISTEM] Meristem ${meristem.id} cannot emit: ${competition.state}.`,
            );
        }
        const site = ensureSite(context, meristem.nodeId);
        site.emittedLateralMeristemId = meristem.id;
        site.emittedAtEvent = sequence;
        site.state = 'lateral_emission_committed';
        return Object.freeze({
            semantics: MERISTEM_SEMANTICS,
            nodeId: meristem.nodeId,
            state: site.state,
            emittedLateralMeristemId: meristem.id,
            emittedAtEvent: sequence,
            coincidentContinuation,
        });
    }

    function finalizeNodeMeristemSites(context) {
        return Object.freeze(context.nodeMeristemSites.map((site) => Object.freeze({
            ...site,
            lateralMeristemIds: Object.freeze([...site.lateralMeristemIds]),
            registeredAtEvents: Object.freeze([...site.registeredAtEvents]),
            suppressedLateralMeristemIds: Object.freeze([
                ...site.suppressedLateralMeristemIds,
            ]),
        })));
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerNodeMeristemField = Object.freeze({
        MERISTEM_SEMANTICS,
        registerLateralMeristemPotential,
        resolveLateralEmissionCompetition,
        settleNodeForStructuralFork,
        commitLateralMeristemEmission,
        finalizeNodeMeristemSites,
    });
}(globalThis));
