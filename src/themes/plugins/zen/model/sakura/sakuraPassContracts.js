const isObject = (value) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
);

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const isFunction = (value) => typeof value === 'function';

const isDevAssertionEnabled = (() => {
    if (typeof import.meta !== 'undefined' && import.meta?.env) {
        return !Boolean(import.meta.env.PROD);
    }
    if (typeof process !== 'undefined' && process?.env) {
        return process.env.NODE_ENV !== 'production';
    }
    return true;
})();

const assertDev = (scope, condition, message) => {
    if (!isDevAssertionEnabled || condition) {
        return;
    }
    throw new Error(`[ZenSakuraPassContract:${scope}] ${message}`);
};

const assertCollections = (scope, collections) => {
    assertDev(scope, isObject(collections), '`collections` must be an object');
    assertDev(scope, Array.isArray(collections?.trunkSpanRegistry), '`collections.trunkSpanRegistry` must be an array');
    assertDev(scope, Array.isArray(collections?.scaffoldRecords), '`collections.scaffoldRecords` must be an array');
};

const assertBranchState = (scope, state) => {
    assertDev(scope, isObject(state), '`state` must be an object');
    assertDev(scope, isFiniteNumber(state?.currentDepth), '`state.currentDepth` must be finite');
    assertDev(scope, isFiniteNumber(state?.currentX), '`state.currentX` must be finite');
    assertDev(scope, isFiniteNumber(state?.currentY), '`state.currentY` must be finite');
    assertDev(scope, isFiniteNumber(state?.length), '`state.length` must be finite');
    assertDev(scope, isFiniteNumber(state?.width), '`state.width` must be finite');
    assertDev(scope, isFiniteNumber(state?.parentAngle), '`state.parentAngle` must be finite');
};

const assertBranchNode = (scope, node) => {
    assertDev(scope, isObject(node), 'return node must be an object');
    assertDev(scope, node?.type === 'branch', 'return node.type must be `branch`');
    assertDev(scope, Array.isArray(node?.branches), 'return node.branches must be an array');
    assertDev(scope, Array.isArray(node?.terminals), 'return node.terminals must be an array');
};

export const assertTrunkPassFactoryContract = (input = {}) => {
    assertDev('trunk.factory', isObject(input), 'input must be an object');
    assertDev('trunk.factory', isObject(input?.limits), '`limits` must be provided');
    assertDev('trunk.factory', isObject(input?.trunkPolicy), '`trunkPolicy` must be provided');
    assertDev('trunk.factory', isObject(input?.random), '`random` must be provided');

    assertDev('trunk.factory', isFiniteNumber(input?.limits?.trunkSegmentLimit), '`limits.trunkSegmentLimit` must be finite');
    assertDev('trunk.factory', isFiniteNumber(input?.limits?.structuralMaxDepth), '`limits.structuralMaxDepth` must be finite');

    assertDev('trunk.factory', isObject(input?.trunkPolicy?.trunkPathPlan), '`trunkPolicy.trunkPathPlan` must be an object');

    assertDev('trunk.factory', isFunction(input?.random?.createFallbackRandom), '`random.createFallbackRandom` must be a function');
    assertDev('trunk.factory', isFunction(input?.random?.nextRandomFn), '`random.nextRandomFn` must be a function');
    if (input?.hooks !== undefined) {
        assertDev('trunk.factory', isObject(input.hooks), '`hooks` must be an object when provided');
        if (input.hooks.onTrunkNode !== undefined) {
            assertDev('trunk.factory', isFunction(input.hooks.onTrunkNode), '`hooks.onTrunkNode` must be a function');
        }
    }
};

export const assertTrunkPassCallContract = ({ state, collections } = {}) => {
    assertBranchState('trunk.call', state);
    assertCollections('trunk.call', collections);
};

export const assertTrunkPassResultContract = (node) => {
    assertBranchNode('trunk.result', node);
};

export const assertScaffoldPassFactoryContract = (input = {}) => {
    assertDev('scaffold.factory', isObject(input), 'input must be an object');
    assertDev('scaffold.factory', isObject(input?.context), '`context` must be provided');
    assertDev('scaffold.factory', isObject(input?.tiers), '`tiers` must be provided');
    assertDev('scaffold.factory', isObject(input?.limits), '`limits` must be provided');
    assertDev('scaffold.factory', isObject(input?.decay), '`decay` must be provided');
    assertDev('scaffold.factory', isObject(input?.runtime), '`runtime` must be provided');
    assertDev('scaffold.factory', isObject(input?.schedule), '`schedule` must be provided');
    assertDev('scaffold.factory', isObject(input?.random), '`random` must be provided');

    assertDev('scaffold.factory', input?.context?.gene === undefined, '`context.gene` is forbidden (use resolved runtime/tier params)');
    assertDev('scaffold.factory', isObject(input?.context?.morphologyProfile), '`context.morphologyProfile` must be an object');
    assertDev('scaffold.factory', isFiniteNumber(input?.context?.scaffoldStrength), '`context.scaffoldStrength` must be finite');

    assertDev('scaffold.factory', isObject(input?.tiers?.tierStrategies), '`tiers.tierStrategies` must be an object');
    assertDev('scaffold.factory', isObject(input?.tiers?.tierModels), '`tiers.tierModels` must be an object');
    assertDev('scaffold.factory', isObject(input?.tiers?.scaffoldTierGene), '`tiers.scaffoldTierGene` must be an object');
    assertDev('scaffold.factory', isObject(input?.tiers?.scaffoldRootGene), '`tiers.scaffoldRootGene` must be an object');
    assertDev('scaffold.factory', isObject(input?.tiers?.scaffoldArcModel), '`tiers.scaffoldArcModel` must be an object');

    assertDev('scaffold.factory', isFiniteNumber(input?.limits?.trunkSegmentLimit), '`limits.trunkSegmentLimit` must be finite');
    assertDev('scaffold.factory', isFiniteNumber(input?.limits?.scaffoldMaxDepth), '`limits.scaffoldMaxDepth` must be finite');
    assertDev('scaffold.factory', isFiniteNumber(input?.limits?.twigMaxDepth), '`limits.twigMaxDepth` must be finite');
    assertDev('scaffold.factory', isFiniteNumber(input?.limits?.structuralMaxDepth), '`limits.structuralMaxDepth` must be finite');

    assertDev('scaffold.factory', isObject(input?.runtime?.scaffoldRuntime), '`runtime.scaffoldRuntime` must be an object');
    assertDev('scaffold.factory', isFiniteNumber(input?.runtime?.scaffoldRootLengthBase), '`runtime.scaffoldRootLengthBase` must be finite');
    assertDev('scaffold.factory', isFiniteNumber(input?.runtime?.scaffoldRootWidthBase), '`runtime.scaffoldRootWidthBase` must be finite');
    assertDev(
        'scaffold.factory',
        input?.runtime?.formScaffoldComposition === null
            || isObject(input?.runtime?.formScaffoldComposition),
        '`runtime.formScaffoldComposition` must be null or an object',
    );
    assertDev('scaffold.factory', isFunction(input?.random?.nextRandomFn), '`random.nextRandomFn` must be a function');
    assertDev('scaffold.factory', isFunction(input?.random?.createFallbackRandom), '`random.createFallbackRandom` must be a function');
    assertDev('scaffold.factory', isObject(input?.schedule?.trunkPathPlan), '`schedule.trunkPathPlan` must be an object');
    assertDev('scaffold.factory', isObject(input?.schedule?.scaffoldStationPlan), '`schedule.scaffoldStationPlan` must be an object');
    assertDev(
        'scaffold.factory',
        typeof input?.schedule?.trunkTargetHeight === 'number'
            && Number.isFinite(input.schedule.trunkTargetHeight)
            && input.schedule.trunkTargetHeight > 0,
        '`schedule.trunkTargetHeight` must be a positive finite number',
    );
    if (input?.hooks !== undefined) {
        assertDev('scaffold.factory', isObject(input.hooks), '`hooks` must be an object when provided');
        if (input.hooks.onScaffoldNode !== undefined) {
            assertDev('scaffold.factory', isFunction(input.hooks.onScaffoldNode), '`hooks.onScaffoldNode` must be a function');
        }
        if (input.hooks.onScaffoldRoot !== undefined) {
            assertDev('scaffold.factory', isFunction(input.hooks.onScaffoldRoot), '`hooks.onScaffoldRoot` must be a function');
        }
    }
};

export const assertScaffoldPassCollectionsContract = (collections) => {
    assertCollections('scaffold.call', collections);
};

export const assertScaffoldPassResultContract = (node) => {
    assertBranchNode('scaffold.result', node);
};

export const assertScaffoldPassApiContract = (api = {}) => {
    assertDev('scaffold.api', isObject(api), 'api must be an object');
    assertDev('scaffold.api', isFunction(api?.emitScaffoldPass), '`emitScaffoldPass` must be a function');
};

export const assertTwigPassFactoryContract = (input = {}) => {
    assertDev('twig.factory', isObject(input), 'input must be an object');
    assertDev('twig.factory', isObject(input?.context), '`context` must be provided');
    assertDev('twig.factory', isObject(input?.tiers), '`tiers` must be provided');
    assertDev('twig.factory', isObject(input?.limits), '`limits` must be provided');
    assertDev('twig.factory', isObject(input?.decay), '`decay` must be provided');
    assertDev('twig.factory', isObject(input?.runtime), '`runtime` must be provided');
    assertDev('twig.factory', isObject(input?.random), '`random` must be provided');
    assertDev('twig.factory', isObject(input?.hooks), '`hooks` must be provided');

    assertDev('twig.factory', input?.context?.gene === undefined, '`context.gene` is forbidden (use resolved runtime/tier params)');
    assertDev('twig.factory', isObject(input?.context?.morphologyProfile), '`context.morphologyProfile` must be an object');
    assertDev('twig.factory', isFiniteNumber(input?.context?.scaffoldStrength), '`context.scaffoldStrength` must be finite');

    assertDev('twig.factory', isObject(input?.tiers?.tierModels), '`tiers.tierModels` must be an object');
    assertDev('twig.factory', isObject(input?.tiers?.tierModelByTier), '`tiers.tierModelByTier` must be an object');
    assertDev('twig.factory', isObject(input?.tiers?.tierStrategies), '`tiers.tierStrategies` must be an object');
    assertDev('twig.factory', isObject(input?.tiers?.twigTierGene), '`tiers.twigTierGene` must be an object');

    assertDev('twig.factory', isFiniteNumber(input?.limits?.trunkSegmentLimit), '`limits.trunkSegmentLimit` must be finite');
    assertDev('twig.factory', isFiniteNumber(input?.limits?.twigMaxDepth), '`limits.twigMaxDepth` must be finite');
    assertDev('twig.factory', isFiniteNumber(input?.limits?.scaffoldMaxDepth), '`limits.scaffoldMaxDepth` must be finite');
    assertDev('twig.factory', isFiniteNumber(input?.limits?.structuralMaxDepth), '`limits.structuralMaxDepth` must be finite');

    assertDev('twig.factory', isFunction(input?.random?.nextRandomFn), '`random.nextRandomFn` must be a function');
    assertDev('twig.factory', isFunction(input?.random?.createFallbackRandom), '`random.createFallbackRandom` must be a function');
    assertDev('twig.factory', isFiniteNumber(input?.runtime?.branchChaos), '`runtime.branchChaos` must be finite');
    assertDev('twig.factory', isFiniteNumber(input?.runtime?.verticalBias), '`runtime.verticalBias` must be finite');
    assertDev('twig.factory', isFiniteNumber(input?.runtime?.trunkStyle), '`runtime.trunkStyle` must be finite');
    assertDev('twig.factory', isFiniteNumber(input?.runtime?.trunkBackboneLockStrength), '`runtime.trunkBackboneLockStrength` must be finite');
    assertDev('twig.factory', isFiniteNumber(input?.runtime?.twigNodeBloomChance), '`runtime.twigNodeBloomChance` must be finite');
    assertDev('twig.factory', isFiniteNumber(input?.runtime?.scaffoldUpperCoverage), '`runtime.scaffoldUpperCoverage` must be finite');
    assertDev(
        'twig.factory',
        input?.runtime?.formScaffoldComposition === null
            || isObject(input?.runtime?.formScaffoldComposition),
        '`runtime.formScaffoldComposition` must be null or an object',
    );
    assertDev('twig.factory', isFunction(input?.hooks?.addTerminalSet), '`hooks.addTerminalSet` must be a function');
    assertDev('twig.factory', isFunction(input?.hooks?.addScaffoldTipAccentSet), '`hooks.addScaffoldTipAccentSet` must be a function');
    if (input.hooks.onTwigSpawn !== undefined) {
        assertDev('twig.factory', isFunction(input.hooks.onTwigSpawn), '`hooks.onTwigSpawn` must be a function');
    }
    if (input.hooks.onTwigBudget !== undefined) {
        assertDev('twig.factory', isFunction(input.hooks.onTwigBudget), '`hooks.onTwigBudget` must be a function');
    }
};

export const assertTwigPassCollectionsContract = (collections) => {
    assertCollections('twig.call', collections);
};

export const assertTwigPassResultContract = (node) => {
    assertBranchNode('twig.result', node);
};

export const assertTwigPassApiContract = (api = {}) => {
    assertDev('twig.api', isObject(api), 'api must be an object');
    assertDev('twig.api', isFunction(api?.emitTwigPass), '`emitTwigPass` must be a function');
};
