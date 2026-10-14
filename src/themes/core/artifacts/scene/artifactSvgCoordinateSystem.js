const assertFiniteNumber = (value, fieldName) => {
  if (!Number.isFinite(value)) {
    throw new Error(`[artifactSvgCoordinateSystem] ${fieldName} must be a finite number.`);
  }
};

const assertPositiveFiniteNumber = (value, fieldName) => {
  assertFiniteNumber(value, fieldName);
  if (value <= 0) {
    throw new Error(`[artifactSvgCoordinateSystem] ${fieldName} must be greater than zero.`);
  }
};

const assertPercentValue = (value, fieldName) => {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?%$/.test(value.trim())) {
    throw new Error(`[artifactSvgCoordinateSystem] ${fieldName} must be an explicit percentage string.`);
  }
};

const freezeRegion = (region) => Object.freeze(region);

export const ARTIFACT_SVG_FILTER_UNITS = Object.freeze({
  userSpaceOnUse: 'userSpaceOnUse',
  objectBoundingBox: 'objectBoundingBox',
});

export const ARTIFACT_SVG_VIEWBOX_ORIGIN = Object.freeze({
  x: 0,
  y: 0,
});

export function createArtifactSvgViewBox(width, height, origin = ARTIFACT_SVG_VIEWBOX_ORIGIN) {
  if (!origin || typeof origin !== 'object') {
    throw new Error('[artifactSvgCoordinateSystem] viewBox origin must be an object.');
  }

  const { x, y } = origin;

  assertFiniteNumber(x, 'viewBox.x');
  assertFiniteNumber(y, 'viewBox.y');
  assertPositiveFiniteNumber(width, 'viewBox.width');
  assertPositiveFiniteNumber(height, 'viewBox.height');

  return `${x} ${y} ${width} ${height}`;
}

export function createArtifactUserSpaceFilterRegion({ x, y, width, height }) {
  assertFiniteNumber(x, 'x');
  assertFiniteNumber(y, 'y');
  assertFiniteNumber(width, 'width');
  assertFiniteNumber(height, 'height');

  return freezeRegion({
    x: String(x),
    y: String(y),
    width: String(width),
    height: String(height),
    filterUnits: ARTIFACT_SVG_FILTER_UNITS.userSpaceOnUse,
  });
}

export function createArtifactObjectBoundingBoxFilterRegion({ x, y, width, height }) {
  assertPercentValue(x, 'x');
  assertPercentValue(y, 'y');
  assertPercentValue(width, 'width');
  assertPercentValue(height, 'height');

  return freezeRegion({
    x,
    y,
    width,
    height,
    filterUnits: ARTIFACT_SVG_FILTER_UNITS.objectBoundingBox,
  });
}

export const ARTIFACT_SVG_FILTER_REGIONS = Object.freeze({
  objectGlow: createArtifactObjectBoundingBoxFilterRegion({
    x: '-50%',
    y: '-50%',
    width: '200%',
    height: '200%',
  }),
  objectHeavyGlow: createArtifactObjectBoundingBoxFilterRegion({
    x: '-100%',
    y: '-100%',
    width: '300%',
    height: '300%',
  }),
  tightObjectBlur: createArtifactObjectBoundingBoxFilterRegion({
    x: '-10%',
    y: '-10%',
    width: '120%',
    height: '120%',
  }),
  zenStoneSoftShadow: createArtifactObjectBoundingBoxFilterRegion({
    x: '-35%',
    y: '-35%',
    width: '170%',
    height: '170%',
  }),
  zenStoneGrain: createArtifactObjectBoundingBoxFilterRegion({
    x: '-20%',
    y: '-20%',
    width: '140%',
    height: '140%',
  }),
  zenRopeShadow: createArtifactObjectBoundingBoxFilterRegion({
    x: '-25%',
    y: '-25%',
    width: '150%',
    height: '150%',
  }),
  zenShojiSoftShadow: createArtifactUserSpaceFilterRegion({
    x: 45,
    y: 38,
    width: 250,
    height: 272,
  }),
});
