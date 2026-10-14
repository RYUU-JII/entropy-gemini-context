// Raked-sand heightfield frame request: the one shape the dashboard ground and
// the artifact worker's heightfield renderer exchange. Everything the shader
// reads is here, already resolved to device pixels, world units and linear RGB,
// so the worker owns no palette, light or stage policy of its own.

export const ZEN_KARESANSUI_HEIGHTFIELD_VERSION = 1;
export const ZEN_KARESANSUI_HEIGHTFIELD_MAX_EDGE_PX = 4096;
export const ZEN_KARESANSUI_HEIGHTFIELD_MAX_PIXELS = 6 * 1024 * 1024;

const COLOR_KEYS = Object.freeze(['sun', 'shadeAmbient', 'bounce', 'horizon', 'sandRear', 'sandBase', 'sandFront']);

function invalid(field) {
  return new Error(`ZEN_KARESANSUI_HEIGHTFIELD_REQUEST_INVALID:${field}`);
}

function requireNumber(value, field, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw invalid(field);
  return value;
}

function requireVec3(value, field, min = -Infinity, max = Infinity) {
  if (!Array.isArray(value) || value.length !== 3) throw invalid(field);
  value.forEach((entry, index) => requireNumber(entry, `${field}[${index}]`, min, max));
  return value;
}

export function requireZenKaresansuiHeightfieldRequest(request) {
  if (!request || typeof request !== 'object') throw invalid('request');
  if (request.version !== ZEN_KARESANSUI_HEIGHTFIELD_VERSION) throw invalid('version');
  if (typeof request.key !== 'string' || !request.key) throw invalid('key');
  const { width, height } = request;
  if (!Number.isSafeInteger(width) || width < 1 || width > ZEN_KARESANSUI_HEIGHTFIELD_MAX_EDGE_PX) throw invalid('width');
  if (!Number.isSafeInteger(height) || height < 1 || height > ZEN_KARESANSUI_HEIGHTFIELD_MAX_EDGE_PX) throw invalid('height');
  if (width * height > ZEN_KARESANSUI_HEIGHTFIELD_MAX_PIXELS) throw invalid('area');
  requireNumber(request.pixelRatio, 'pixelRatio', 0.25, 4);

  const camera = request.camera;
  if (!camera || typeof camera !== 'object') throw invalid('camera');
  requireNumber(camera.horizonPx, 'camera.horizonPx', -4096, 0);
  requireNumber(camera.focalPx, 'camera.focalPx', 1, 20000);
  requireNumber(camera.eyeHeight, 'camera.eyeHeight', 1e-4, 100);
  requireNumber(camera.centerX, 'camera.centerX', -8192, 8192);

  const field = request.field;
  if (!field || typeof field !== 'object') throw invalid('field');
  requireNumber(field.innerRadius, 'field.innerRadius', 1e-5, 100);
  requireNumber(field.spacing, 'field.spacing', 1e-5, 100);
  requireNumber(field.ringCount, 'field.ringCount', 0, 64);
  requireNumber(field.ridge, 'field.ridge', 0, 2);

  const light = request.light;
  if (!light || typeof light !== 'object') throw invalid('light');
  requireVec3(light.direction, 'light.direction', -1, 1);
  if (light.direction[1] <= 0) throw invalid('light.direction');

  const colors = request.colors;
  if (!colors || typeof colors !== 'object') throw invalid('colors');
  COLOR_KEYS.forEach((key) => requireVec3(colors[key], `colors.${key}`, 0, 4));
  return request;
}
