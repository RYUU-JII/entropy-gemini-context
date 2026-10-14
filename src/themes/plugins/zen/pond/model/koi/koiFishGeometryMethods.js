import {
    createKoiBodyPath,
    getKoiBodyRadius,
    getKoiLocalBend,
    koiContainsPoint,
    resolveKoiDimensionInputs,
    updateKoiDimensions,
} from '../../../../../../domains/nudge/koi/render/KoiRenderGeometry.js';

const GEOMETRY_EPSILON = 1e-6;

const koiFishGeometryMethods = {
getBodyRadius(t, size) {
    return getKoiBodyRadius(this, t, size);
},

createBodyPath(ctx, size, returnPoints = false) {
    return createKoiBodyPath(this, ctx, size, returnPoints);
},

invalidateGeometryDimensions() {
    this.geometryDirty = true;
},

syncGeometryDimensions(tuningOverride) {
    const next = resolveKoiDimensionInputs(this, tuningOverride);
    const baseSizeDirty = Math.abs((this.baseSize || 0) - next.baseSize) > GEOMETRY_EPSILON;
    const historyLengthDirty = this.historyLength !== next.historyLength;
    const segmentSpacingDirty = Math.abs((this.segmentSpacing || 0) - next.segmentSpacing) > GEOMETRY_EPSILON;
    if (!this.geometryDirty && !baseSizeDirty && !historyLengthDirty && !segmentSpacingDirty) {
        return false;
    }
    this.updateDimensions(tuningOverride);
    return true;
},

updateDimensions(tuningOverride) {
    const result = updateKoiDimensions(this, tuningOverride);
    this.geometryDirty = false;
    return result;
},

getLocalBend(idx) {
    return getKoiLocalBend(this, idx);
},

containsPoint(px, py) {
    return koiContainsPoint(this, px, py);
}
};

export { koiFishGeometryMethods };
