const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const isFiniteNumber = (value) => Number.isFinite(Number(value));
const toFinite = (value, fallback = 0) => (isFiniteNumber(value) ? Number(value) : fallback);

const requireExactCubicCoordinate = (value, field) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`ZEN_BRANCH_GEOMETRY_EXACT_CUBIC_INVALID:${field}`);
    }
    return value;
};

const resolveExactCubicControl = (control = null) => {
    if (control === null || control === undefined) {
        return null;
    }
    if (!control || typeof control !== 'object' || Array.isArray(control)) {
        throw new Error('ZEN_BRANCH_GEOMETRY_EXACT_CUBIC_CONTROL_INVALID:control');
    }
    if (control.version !== 1) {
        throw new Error('ZEN_BRANCH_GEOMETRY_EXACT_CUBIC_CONTROL_INVALID:version');
    }
    return {
        version: 1,
        cp1Along: requireExactCubicCoordinate(control.cp1Along, 'control.cp1Along'),
        cp1Normal: requireExactCubicCoordinate(control.cp1Normal, 'control.cp1Normal'),
        cp2Along: requireExactCubicCoordinate(control.cp2Along, 'control.cp2Along'),
        cp2Normal: requireExactCubicCoordinate(control.cp2Normal, 'control.cp2Normal'),
    };
};

const resolveCubicControls = (segment = {}) => {
    const startX = toFinite(segment.startX);
    const startY = toFinite(segment.startY);
    const endX = toFinite(segment.endX);
    const endY = toFinite(segment.endY);

    if (
        isFiniteNumber(segment.cp1X)
        && isFiniteNumber(segment.cp1Y)
        && isFiniteNumber(segment.cp2X)
        && isFiniteNumber(segment.cp2Y)
    ) {
        return {
            startX,
            startY,
            cp1X: Number(segment.cp1X),
            cp1Y: Number(segment.cp1Y),
            cp2X: Number(segment.cp2X),
            cp2Y: Number(segment.cp2Y),
            endX,
            endY,
        };
    }

    if (isFiniteNumber(segment.controlX) && isFiniteNumber(segment.controlY)) {
        const controlX = Number(segment.controlX);
        const controlY = Number(segment.controlY);
        const cp1X = startX + ((controlX - startX) * (2 / 3));
        const cp1Y = startY + ((controlY - startY) * (2 / 3));
        const cp2X = endX + ((controlX - endX) * (2 / 3));
        const cp2Y = endY + ((controlY - endY) * (2 / 3));
        return {
            startX,
            startY,
            cp1X,
            cp1Y,
            cp2X,
            cp2Y,
            endX,
            endY,
        };
    }

    const dx = endX - startX;
    const dy = endY - startY;
    return {
        startX,
        startY,
        cp1X: startX + dx * (1 / 3),
        cp1Y: startY + dy * (1 / 3),
        cp2X: startX + dx * (2 / 3),
        cp2Y: startY + dy * (2 / 3),
        endX,
        endY,
    };
};

const CUBIC_ROOT_EPSILON = 1e-9;

const resolveCubicExtremaParameters = (start, control1, control2, end) => {
    const quadratic = 3 * (-start + (3 * control1) - (3 * control2) + end);
    const linear = 6 * (start - (2 * control1) + control2);
    const constant = 3 * (control1 - start);

    if (Math.abs(quadratic) <= CUBIC_ROOT_EPSILON) {
        if (Math.abs(linear) <= CUBIC_ROOT_EPSILON) {
            return [];
        }
        const root = -constant / linear;
        return root > 0 && root < 1 ? [root] : [];
    }

    const discriminant = (linear * linear) - (4 * quadratic * constant);
    if (discriminant < -CUBIC_ROOT_EPSILON) {
        return [];
    }
    const sqrtDiscriminant = Math.sqrt(Math.max(0, discriminant));
    return [
        (-linear + sqrtDiscriminant) / (2 * quadratic),
        (-linear - sqrtDiscriminant) / (2 * quadratic),
    ].filter((root, index, roots) => (
        root > 0
        && root < 1
        && roots.findIndex((candidate) => Math.abs(candidate - root) <= CUBIC_ROOT_EPSILON)
            === index
    ));
};

export class BranchGeometryModel {
    static createQuadraticSegment({
        startX = 0,
        startY = 0,
        angle = 0,
        length = 0,
        curve = 0,
    } = {}) {
        const resolvedStartX = toFinite(startX);
        const resolvedStartY = toFinite(startY);
        const resolvedAngle = toFinite(angle);
        const resolvedLength = toFinite(length);
        const resolvedCurve = toFinite(curve);
        const endX = resolvedStartX + Math.cos(resolvedAngle) * resolvedLength;
        const endY = resolvedStartY + Math.sin(resolvedAngle) * resolvedLength;
        const midX = (startX + endX) * 0.5;
        const midY = (startY + endY) * 0.5;
        const normalX = -(endY - resolvedStartY);
        const normalY = endX - resolvedStartX;
        const normalLen = Math.hypot(normalX, normalY) || 1;
        const controlX = midX + (normalX / normalLen) * resolvedCurve;
        const controlY = midY + (normalY / normalLen) * resolvedCurve;
        const cp1X = resolvedStartX + ((controlX - resolvedStartX) * (2 / 3));
        const cp1Y = resolvedStartY + ((controlY - resolvedStartY) * (2 / 3));
        const cp2X = endX + ((controlX - endX) * (2 / 3));
        const cp2Y = endY + ((controlY - endY) * (2 / 3));

        return {
            startX: resolvedStartX,
            startY: resolvedStartY,
            controlX,
            controlY,
            cp1X,
            cp1Y,
            cp2X,
            cp2Y,
            endX,
            endY,
            curve: resolvedCurve,
            curveIn: resolvedCurve,
            curveOut: resolvedCurve,
        };
    }

    static createCubicSegment({
        startX = 0,
        startY = 0,
        angle = 0,
        length = 0,
        curveIn = null,
        curveOut = null,
        exactCubicControl = null,
    } = {}) {
        const resolvedStartX = toFinite(startX);
        const resolvedStartY = toFinite(startY);
        const resolvedAngle = toFinite(angle);
        const resolvedLength = toFinite(length);
        const resolvedExactControl = resolveExactCubicControl(exactCubicControl);
        const resolvedCurveIn = curveIn !== null && curveIn !== undefined
            ? toFinite(curveIn)
            : (resolvedExactControl?.cp1Normal || 0);
        const resolvedCurveOut = curveOut !== null && curveOut !== undefined
            ? toFinite(curveOut)
            : (resolvedExactControl?.cp2Normal || 0);
        const cp1Along = resolvedExactControl?.cp1Along ?? (resolvedLength / 3);
        const cp2Along = resolvedExactControl?.cp2Along ?? ((resolvedLength * 2) / 3);

        const dirX = Math.cos(resolvedAngle);
        const dirY = Math.sin(resolvedAngle);
        const normalX = -dirY;
        const normalY = dirX;
        const endX = resolvedStartX + dirX * resolvedLength;
        const endY = resolvedStartY + dirY * resolvedLength;
        const cp1X = resolvedStartX + dirX * cp1Along + normalX * resolvedCurveIn;
        const cp1Y = resolvedStartY + dirY * cp1Along + normalY * resolvedCurveIn;
        const cp2X = resolvedStartX + dirX * cp2Along + normalX * resolvedCurveOut;
        const cp2Y = resolvedStartY + dirY * cp2Along + normalY * resolvedCurveOut;

        return {
            startX: resolvedStartX,
            startY: resolvedStartY,
            controlX: (cp1X + cp2X) * 0.5,
            controlY: (cp1Y + cp2Y) * 0.5,
            cp1X,
            cp1Y,
            cp2X,
            cp2Y,
            endX,
            endY,
            curve: (resolvedCurveIn + resolvedCurveOut) * 0.5,
            curveIn: resolvedCurveIn,
            curveOut: resolvedCurveOut,
        };
    }

    static createExactCubicSegment({
        startX,
        startY,
        cp1X,
        cp1Y,
        cp2X,
        cp2Y,
        endX,
        endY,
    } = {}) {
        const resolvedStartX = requireExactCubicCoordinate(startX, 'startX');
        const resolvedStartY = requireExactCubicCoordinate(startY, 'startY');
        const resolvedCp1X = requireExactCubicCoordinate(cp1X, 'cp1X');
        const resolvedCp1Y = requireExactCubicCoordinate(cp1Y, 'cp1Y');
        const resolvedCp2X = requireExactCubicCoordinate(cp2X, 'cp2X');
        const resolvedCp2Y = requireExactCubicCoordinate(cp2Y, 'cp2Y');
        const resolvedEndX = requireExactCubicCoordinate(endX, 'endX');
        const resolvedEndY = requireExactCubicCoordinate(endY, 'endY');
        const dx = resolvedEndX - resolvedStartX;
        const dy = resolvedEndY - resolvedStartY;
        const chordLength = Math.hypot(dx, dy);
        const normalX = chordLength > 0 ? -(dy / chordLength) : 0;
        const normalY = chordLength > 0 ? dx / chordLength : 0;
        const curveIn = ((resolvedCp1X - resolvedStartX) * normalX)
            + ((resolvedCp1Y - resolvedStartY) * normalY);
        const curveOut = ((resolvedCp2X - resolvedStartX) * normalX)
            + ((resolvedCp2Y - resolvedStartY) * normalY);

        return {
            startX: resolvedStartX,
            startY: resolvedStartY,
            controlX: (resolvedCp1X + resolvedCp2X) * 0.5,
            controlY: (resolvedCp1Y + resolvedCp2Y) * 0.5,
            cp1X: resolvedCp1X,
            cp1Y: resolvedCp1Y,
            cp2X: resolvedCp2X,
            cp2Y: resolvedCp2Y,
            endX: resolvedEndX,
            endY: resolvedEndY,
            curve: (curveIn + curveOut) * 0.5,
            curveIn,
            curveOut,
        };
    }

    static createExactCubicControl(segment) {
        const controls = resolveCubicControls(segment);
        const dx = controls.endX - controls.startX;
        const dy = controls.endY - controls.startY;
        const chordLength = Math.hypot(dx, dy);
        if (chordLength <= 1e-9) {
            throw new Error('ZEN_BRANCH_GEOMETRY_EXACT_CUBIC_CONTROL_INVALID:chordLength');
        }
        const dirX = dx / chordLength;
        const dirY = dy / chordLength;
        const normalX = -dirY;
        const normalY = dirX;
        const cp1Dx = controls.cp1X - controls.startX;
        const cp1Dy = controls.cp1Y - controls.startY;
        const cp2Dx = controls.cp2X - controls.startX;
        const cp2Dy = controls.cp2Y - controls.startY;
        return Object.freeze({
            version: 1,
            cp1Along: (cp1Dx * dirX) + (cp1Dy * dirY),
            cp1Normal: (cp1Dx * normalX) + (cp1Dy * normalY),
            cp2Along: (cp2Dx * dirX) + (cp2Dy * dirY),
            cp2Normal: (cp2Dx * normalX) + (cp2Dy * normalY),
        });
    }

    static createSegment({
        startX = 0,
        startY = 0,
        angle = 0,
        length = 0,
        curve = 0,
        curveIn = null,
        curveOut = null,
        exactCubicControl = null,
    } = {}) {
        const resolvedCurve = toFinite(curve);
        const hasCurveIn = isFiniteNumber(curveIn);
        const hasCurveOut = isFiniteNumber(curveOut);
        if (hasCurveIn || hasCurveOut || exactCubicControl !== null) {
            return BranchGeometryModel.createCubicSegment({
                startX,
                startY,
                angle,
                length,
                curveIn: hasCurveIn ? Number(curveIn) : resolvedCurve,
                curveOut: hasCurveOut ? Number(curveOut) : resolvedCurve,
                exactCubicControl,
            });
        }
        return BranchGeometryModel.createQuadraticSegment({
            startX,
            startY,
            angle,
            length,
            curve: resolvedCurve,
        });
    }

    static pointAt(segment, t = 0) {
        const {
            startX,
            startY,
            cp1X,
            cp1Y,
            cp2X,
            cp2Y,
            endX,
            endY,
        } = resolveCubicControls(segment);
        const clampedT = clamp01(t);
        const invT = 1 - clampedT;
        const x = (invT * invT * invT * startX)
            + (3 * invT * invT * clampedT * cp1X)
            + (3 * invT * clampedT * clampedT * cp2X)
            + (clampedT * clampedT * clampedT * endX);
        const y = (invT * invT * invT * startY)
            + (3 * invT * invT * clampedT * cp1Y)
            + (3 * invT * clampedT * clampedT * cp2Y)
            + (clampedT * clampedT * clampedT * endY);

        return { x, y };
    }

    static getBounds(segment) {
        const controls = resolveCubicControls(segment);
        const parameters = Array.from(new Set([
            0,
            1,
            ...resolveCubicExtremaParameters(
                controls.startX,
                controls.cp1X,
                controls.cp2X,
                controls.endX,
            ),
            ...resolveCubicExtremaParameters(
                controls.startY,
                controls.cp1Y,
                controls.cp2Y,
                controls.endY,
            ),
        ]));
        const points = parameters.map((t) => BranchGeometryModel.pointAt(controls, t));
        const xValues = points.map((point) => point.x);
        const yValues = points.map((point) => point.y);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        return {
            minX,
            maxX,
            minY,
            maxY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    static tangentAt(segment, t = 0) {
        const {
            startX,
            startY,
            cp1X,
            cp1Y,
            cp2X,
            cp2Y,
            endX,
            endY,
        } = resolveCubicControls(segment);
        const clampedT = clamp01(t);
        const invT = 1 - clampedT;
        const dx = (3 * invT * invT * (cp1X - startX))
            + (6 * invT * clampedT * (cp2X - cp1X))
            + (3 * clampedT * clampedT * (endX - cp2X));
        const dy = (3 * invT * invT * (cp1Y - startY))
            + (6 * invT * clampedT * (cp2Y - cp1Y))
            + (3 * clampedT * clampedT * (endY - cp2Y));
        return { dx, dy };
    }

    static angleAt(segment, t = 0) {
        const tangent = BranchGeometryModel.tangentAt(segment, t);
        return Math.atan2(tangent.dy, tangent.dx);
    }

    static pointAndAngleAt(segment, t = 0) {
        const point = BranchGeometryModel.pointAt(segment, t);
        return {
            x: point.x,
            y: point.y,
            angle: BranchGeometryModel.angleAt(segment, t),
        };
    }
}
