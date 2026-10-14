export const TRUNK_PATH_PLAN_VERSION = 1;

const isObject = (value) => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
);

const isFiniteNumber = (value) => (
    typeof value === 'number'
    && Number.isFinite(value)
);

const failPlanContract = (reason) => {
    throw new Error(`ZEN_TRUNK_PATH_PLAN_V1_INVALID:${reason}`);
};

const assertFiniteField = (value, field) => {
    if (!isFiniteNumber(value)) {
        failPlanContract(field);
    }
};

const assertNearField = (actual, expected, field) => {
    if (
        !isFiniteNumber(actual)
        || !isFiniteNumber(expected)
        || Math.abs(actual - expected) > 1e-7
    ) {
        failPlanContract(field);
    }
};

const assertSpanContract = (span, index) => {
    if (!isObject(span)) {
        failPlanContract(`spans.${index}`);
    }
    if (span.index !== index) {
        failPlanContract(`spans.${index}.index`);
    }

    [
        'currentDepth',
        'trunkMainDepth',
        'currentX',
        'currentY',
        'length',
        'width',
        'parentAngle',
        'lastDir',
        'trunkSegmentLength',
        'curve',
        'curveIn',
        'curveOut',
        'previewRelativeOffset',
    ].forEach((field) => assertFiniteField(span[field], `spans.${index}.${field}`));

    if (!isObject(span.branchSegment)) {
        failPlanContract(`spans.${index}.branchSegment`);
    }
    [
        'startX',
        'startY',
        'cp1X',
        'cp1Y',
        'cp2X',
        'cp2Y',
        'endX',
        'endY',
        'curveIn',
        'curveOut',
    ].forEach((field) => assertFiniteField(
        span.branchSegment[field],
        `spans.${index}.branchSegment.${field}`,
    ));

    if (typeof span.isTerminal !== 'boolean') {
        failPlanContract(`spans.${index}.isTerminal`);
    }
    if (span.branchSegment.startX !== span.currentX) {
        failPlanContract(`spans.${index}.branchSegment.startX`);
    }
    if (span.branchSegment.startY !== span.currentY) {
        failPlanContract(`spans.${index}.branchSegment.startY`);
    }
    if (span.branchSegment.curveIn !== span.curveIn) {
        failPlanContract(`spans.${index}.branchSegment.curveIn`);
    }
    if (span.branchSegment.curveOut !== span.curveOut) {
        failPlanContract(`spans.${index}.branchSegment.curveOut`);
    }
    if (span.exactCubicControl !== undefined) {
        if (!isObject(span.exactCubicControl) || span.exactCubicControl.version !== 1) {
            failPlanContract(`spans.${index}.exactCubicControl`);
        }
        [
            'cp1Along',
            'cp1Normal',
            'cp2Along',
            'cp2Normal',
        ].forEach((field) => assertFiniteField(
            span.exactCubicControl[field],
            `spans.${index}.exactCubicControl.${field}`,
        ));
        const directionX = Math.cos(span.parentAngle);
        const directionY = Math.sin(span.parentAngle);
        const normalX = -directionY;
        const normalY = directionX;
        const expectedControls = {
            cp1X: span.currentX
                + (directionX * span.exactCubicControl.cp1Along)
                + (normalX * span.exactCubicControl.cp1Normal),
            cp1Y: span.currentY
                + (directionY * span.exactCubicControl.cp1Along)
                + (normalY * span.exactCubicControl.cp1Normal),
            cp2X: span.currentX
                + (directionX * span.exactCubicControl.cp2Along)
                + (normalX * span.exactCubicControl.cp2Normal),
            cp2Y: span.currentY
                + (directionY * span.exactCubicControl.cp2Along)
                + (normalY * span.exactCubicControl.cp2Normal),
        };
        Object.entries(expectedControls).forEach(([field, expected]) => {
            assertNearField(
                span.branchSegment[field],
                expected,
                `spans.${index}.exactCubicControl.${field}`,
            );
        });
    }
    if (span.isTerminal) {
        if (span.childState !== null) {
            failPlanContract(`spans.${index}.childState`);
        }
        return;
    }

    if (!isObject(span.childState)) {
        failPlanContract(`spans.${index}.childState`);
    }
    [
        'currentDepth',
        'currentX',
        'currentY',
        'length',
        'width',
        'parentAngle',
        'lastDir',
        'trunkMainDepth',
        'angleOffset',
    ].forEach((field) => assertFiniteField(
        span.childState[field],
        `spans.${index}.childState.${field}`,
    ));
    if (span.branchSegment.endX !== span.childState.currentX) {
        failPlanContract(`spans.${index}.branchSegment.endX`);
    }
    if (span.branchSegment.endY !== span.childState.currentY) {
        failPlanContract(`spans.${index}.branchSegment.endY`);
    }
};

export const requireTrunkPathPlanV1 = (plan) => {
    if (!isObject(plan)) {
        failPlanContract('plan');
    }
    if (plan.version !== TRUNK_PATH_PLAN_VERSION) {
        failPlanContract('version');
    }
    if (typeof plan.plannerId !== 'string' || !plan.plannerId.trim()) {
        failPlanContract('plannerId');
    }
    assertFiniteField(plan.trunkSegmentLimit, 'trunkSegmentLimit');
    assertFiniteField(plan.structuralMaxDepth, 'structuralMaxDepth');
    if (!Number.isSafeInteger(plan.trunkSegmentLimit) || plan.trunkSegmentLimit < 1) {
        failPlanContract('trunkSegmentLimit');
    }
    if (!Number.isSafeInteger(plan.structuralMaxDepth) || plan.structuralMaxDepth < 1) {
        failPlanContract('structuralMaxDepth');
    }
    if (!Array.isArray(plan.spans) || plan.spans.length === 0) {
        failPlanContract('spans');
    }
    if (plan.spans.length > plan.trunkSegmentLimit) {
        failPlanContract('spans.length');
    }
    plan.spans.forEach((span, index) => {
        assertSpanContract(span, index);
        if (span.trunkMainDepth !== index + 1) {
            failPlanContract(`spans.${index}.trunkMainDepth`);
        }
        if (!Number.isSafeInteger(span.currentDepth) || span.currentDepth < 1) {
            failPlanContract(`spans.${index}.currentDepth`);
        }
        // A trunk span is physical carrier tessellation. `structuralMaxDepth`
        // belongs to biological scaffold/twig recursion and must not truncate
        // or be expanded by the number of carrier spans.
        const reachedLimit = span.trunkMainDepth >= plan.trunkSegmentLimit;
        if (span.isTerminal !== reachedLimit) {
            failPlanContract(`spans.${index}.isTerminal`);
        }
        const nextSpan = plan.spans[index + 1];
        if (!nextSpan) {
            return;
        }
        if (span.isTerminal) {
            failPlanContract(`spans.${index}.isTerminal`);
        }
        [
            'currentDepth',
            'currentX',
            'currentY',
            'length',
            'width',
            'parentAngle',
            'lastDir',
            'trunkMainDepth',
        ].forEach((field) => {
            if (span.childState[field] !== nextSpan[field]) {
                failPlanContract(`spans.${index}.childState.${field}`);
            }
        });
    });
    if (!plan.spans.at(-1)?.isTerminal) {
        failPlanContract('terminalSpan');
    }
    return plan;
};

export const createTrunkPathPlanV1 = ({
    plannerId,
    trunkSegmentLimit,
    structuralMaxDepth,
    spans,
} = {}) => requireTrunkPathPlanV1({
    version: TRUNK_PATH_PLAN_VERSION,
    plannerId,
    trunkSegmentLimit,
    structuralMaxDepth,
    spans,
});

export const resolveTrunkPathPlanSpanV1 = (plan, spanIndex) => {
    const resolvedPlan = requireTrunkPathPlanV1(plan);
    const index = Math.round(Number(spanIndex));
    if (!Number.isSafeInteger(index) || index < 0 || index >= resolvedPlan.spans.length) {
        failPlanContract(`spanIndex.${String(spanIndex)}`);
    }
    return resolvedPlan.spans[index];
};
