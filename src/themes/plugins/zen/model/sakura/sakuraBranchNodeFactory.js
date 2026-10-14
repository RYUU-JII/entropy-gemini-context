import { ShapePriorModel, SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel';

export const createBranchNode = ({
    nodeRandom,
    branchOrder,
    length,
    width,
    curve,
    curveIn,
    curveOut,
    exactCubicControl = null,
    includeLenticels,
    nextRandomFn,
}) => {
    const resolvedCurve = Number.isFinite(Number(curve)) ? Number(curve) : 0;
    const resolvedCurveIn = Number.isFinite(Number(curveIn))
        ? Number(curveIn)
        : resolvedCurve;
    const resolvedCurveOut = Number.isFinite(Number(curveOut))
        ? Number(curveOut)
        : resolvedCurve;
    const node = {
        type: 'branch',
        nodeId: nodeRandom?.getNodeId?.() || null,
        branchOrder,
        branchOrderName: ShapePriorModel.resolveSakuraOrderName(branchOrder),
        length,
        width,
        curve: resolvedCurve,
        curveIn: resolvedCurveIn,
        curveOut: resolvedCurveOut,
        lenticels: [],
        branches: [],
        terminals: [],
    };
    if (exactCubicControl !== null) {
        node.exactCubicControl = exactCubicControl;
    }

    const canRenderMatureBarkDetail = (
        includeLenticels
        && width > 5.8
        && (
            branchOrder === SAKURA_BRANCH_ORDER.TRUNK
            || branchOrder === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH
        )
    );
    if (canRenderMatureBarkDetail) {
        const lenticelCount = Math.max(1, Math.min(4, Math.round(length * 0.035)));
        const tSlotSpan = 0.84 / lenticelCount;
        for (let index = 0; index < lenticelCount; index += 1) {
            const laneSide = index % 2 === 0 ? -1 : 1;
            const tBase = 0.08 + (tSlotSpan * (index + 0.5));
            const tJitter = (nextRandomFn(nodeRandom, `lenticel_${index}_t`) - 0.5) * tSlotSpan * 0.64;
            const laneOffset = laneSide
                * width
                * (0.18 + nextRandomFn(nodeRandom, `lenticel_${index}_lane`) * 0.1);
            const offsetJitter = (nextRandomFn(nodeRandom, `lenticel_${index}_offset`) - 0.5) * width * 0.07;
            node.lenticels.push({
                t: Math.max(0.08, Math.min(0.92, tBase + tJitter)),
                w: width * (0.03 + nextRandomFn(nodeRandom, `lenticel_${index}_width`) * 0.025),
                span: width * (0.22 + nextRandomFn(nodeRandom, `lenticel_${index}_span`) * 0.14),
                offset: laneOffset + offsetJitter,
                tilt: (nextRandomFn(nodeRandom, `lenticel_${index}_tilt`) - 0.5) * 0.26,
                alpha: 0.055 + nextRandomFn(nodeRandom, `lenticel_${index}_alpha`) * 0.055,
            });
        }
    }

    return node;
};
