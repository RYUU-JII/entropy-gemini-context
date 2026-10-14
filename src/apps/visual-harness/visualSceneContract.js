import { assertCanonicalThemeId } from '../../themes/core/ids.js';

export const VISUAL_SCENE_CONTRACT_VERSION = 1;

export const VISUAL_SCENE_KINDS = Object.freeze({
  component: 'component',
  page: 'page',
});

export const VISUAL_CAPTURE_TARGETS = Object.freeze({
  selector: 'selector',
  viewport: 'viewport',
});

export const VISUAL_SCENE_LOCALES = Object.freeze(['en', 'ko']);
export const VISUAL_SCENE_REDUCED_MOTION = Object.freeze(['no-preference', 'reduce']);
export const VISUAL_SCENE_COLOR_SCHEMES = Object.freeze(['light', 'dark', 'no-preference']);

const SCENE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)+$/;
const CAPTURE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SCENE_SOURCE_MODULE_PATTERN = /^\.\/scenes\/[A-Z][A-Za-z0-9]*\.jsx$/;
const SCENE_SOURCE_EXPORT_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const MIN_VIEWPORT_EDGE = 64;
const MAX_VIEWPORT_EDGE = 4096;
const MIN_DEVICE_SCALE_FACTOR = 1;
const MAX_DEVICE_SCALE_FACTOR = 3;
const MIN_READY_TIMEOUT_MS = 1_000;
const MAX_READY_TIMEOUT_MS = 60_000;

export function createVisualSceneContractError(message, details = {}) {
  const error = new Error(message);
  error.code = 'VISUAL_SCENE_CONTRACT_INVALID';
  error.details = details && typeof details === 'object' ? { ...details } : {};
  return error;
}

function assertNonEmptyString(value, field, details = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createVisualSceneContractError(
      `[VisualHarness] ${field} must be a non-empty string.`,
      { ...details, field, value },
    );
  }
  return value.trim();
}

function assertIntegerInRange(value, field, min, max, details = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw createVisualSceneContractError(
      `[VisualHarness] ${field} must be an integer between ${min} and ${max}.`,
      { ...details, field, value, min, max },
    );
  }
  return value;
}

function normalizeViewport(viewport, sceneId) {
  if (!viewport || typeof viewport !== 'object' || Array.isArray(viewport)) {
    throw createVisualSceneContractError(
      '[VisualHarness] scene viewport must be an object.',
      { sceneId, viewport },
    );
  }

  const width = assertIntegerInRange(
    viewport.width,
    'viewport.width',
    MIN_VIEWPORT_EDGE,
    MAX_VIEWPORT_EDGE,
    { sceneId },
  );
  const height = assertIntegerInRange(
    viewport.height,
    'viewport.height',
    MIN_VIEWPORT_EDGE,
    MAX_VIEWPORT_EDGE,
    { sceneId },
  );
  const deviceScaleFactor = Number(viewport.deviceScaleFactor);
  if (
    !Number.isFinite(deviceScaleFactor)
    || deviceScaleFactor < MIN_DEVICE_SCALE_FACTOR
    || deviceScaleFactor > MAX_DEVICE_SCALE_FACTOR
  ) {
    throw createVisualSceneContractError(
      `[VisualHarness] viewport.deviceScaleFactor must be between ${MIN_DEVICE_SCALE_FACTOR} and ${MAX_DEVICE_SCALE_FACTOR}.`,
      { sceneId, deviceScaleFactor },
    );
  }

  return Object.freeze({ width, height, deviceScaleFactor });
}

function normalizeCapture(capture, index, sceneId) {
  if (!capture || typeof capture !== 'object' || Array.isArray(capture)) {
    throw createVisualSceneContractError(
      '[VisualHarness] each capture must be an object.',
      { sceneId, index, capture },
    );
  }

  const name = assertNonEmptyString(capture.name, 'capture.name', { sceneId, index });
  if (!CAPTURE_NAME_PATTERN.test(name)) {
    throw createVisualSceneContractError(
      '[VisualHarness] capture.name must use lowercase kebab-case.',
      { sceneId, index, name },
    );
  }

  const target = assertNonEmptyString(capture.target, 'capture.target', { sceneId, index });
  if (!Object.values(VISUAL_CAPTURE_TARGETS).includes(target)) {
    throw createVisualSceneContractError(
      '[VisualHarness] capture.target must be viewport or selector.',
      { sceneId, index, target },
    );
  }

  let selector = '';
  if (target === VISUAL_CAPTURE_TARGETS.selector) {
    selector = assertNonEmptyString(capture.selector, 'capture.selector', {
      sceneId,
      index,
      name,
    });
  } else if (capture.selector !== undefined) {
    throw createVisualSceneContractError(
      '[VisualHarness] viewport captures must not declare a selector.',
      { sceneId, index, name, selector: capture.selector },
    );
  }

  return Object.freeze({ name, target, selector });
}

function normalizeCaptures(captures, sceneId) {
  if (!Array.isArray(captures) || captures.length === 0) {
    throw createVisualSceneContractError(
      '[VisualHarness] scene captures must contain at least one capture.',
      { sceneId, captures },
    );
  }

  const normalized = captures.map((capture, index) => normalizeCapture(capture, index, sceneId));
  const captureNames = new Set();
  normalized.forEach((capture) => {
    if (captureNames.has(capture.name)) {
      throw createVisualSceneContractError(
        '[VisualHarness] capture names must be unique within a scene.',
        { sceneId, captureName: capture.name },
      );
    }
    captureNames.add(capture.name);
  });

  return Object.freeze(normalized);
}

function normalizeBrowserPreferences(preferences, sceneId) {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    throw createVisualSceneContractError(
      '[VisualHarness] browserPreferences must be an object.',
      { sceneId, preferences },
    );
  }

  const reducedMotion = assertNonEmptyString(
    preferences.reducedMotion,
    'browserPreferences.reducedMotion',
    { sceneId },
  );
  if (!VISUAL_SCENE_REDUCED_MOTION.includes(reducedMotion)) {
    throw createVisualSceneContractError(
      '[VisualHarness] browserPreferences.reducedMotion is unsupported.',
      { sceneId, reducedMotion, supported: VISUAL_SCENE_REDUCED_MOTION },
    );
  }

  const colorScheme = assertNonEmptyString(
    preferences.colorScheme,
    'browserPreferences.colorScheme',
    { sceneId },
  );
  if (!VISUAL_SCENE_COLOR_SCHEMES.includes(colorScheme)) {
    throw createVisualSceneContractError(
      '[VisualHarness] browserPreferences.colorScheme is unsupported.',
      { sceneId, colorScheme, supported: VISUAL_SCENE_COLOR_SCHEMES },
    );
  }

  return Object.freeze({ reducedMotion, colorScheme });
}

export function defineVisualSceneCatalogEntry({
  browserPreferences,
  captures,
  id,
  kind,
  sourceModule,
  sourceExport = 'default',
  locale,
  readyTimeoutMs,
  themeId,
  title,
  viewport,
}) {
  const normalizedId = assertNonEmptyString(id, 'scene.id');
  if (!SCENE_ID_PATTERN.test(normalizedId)) {
    throw createVisualSceneContractError(
      '[VisualHarness] scene.id must contain at least two lowercase kebab-case path segments.',
      { sceneId: normalizedId },
    );
  }

  const normalizedTitle = assertNonEmptyString(title, 'scene.title', { sceneId: normalizedId });
  const normalizedKind = assertNonEmptyString(kind, 'scene.kind', { sceneId: normalizedId });
  if (!Object.values(VISUAL_SCENE_KINDS).includes(normalizedKind)) {
    throw createVisualSceneContractError(
      '[VisualHarness] scene.kind must be component or page.',
      { sceneId: normalizedId, kind: normalizedKind },
    );
  }

  const normalizedLocale = assertNonEmptyString(locale, 'scene.locale', { sceneId: normalizedId });
  if (!VISUAL_SCENE_LOCALES.includes(normalizedLocale)) {
    throw createVisualSceneContractError(
      '[VisualHarness] scene.locale is unsupported.',
      { sceneId: normalizedId, locale: normalizedLocale, supported: VISUAL_SCENE_LOCALES },
    );
  }

  const normalizedThemeId = themeId === ''
    ? ''
    : assertCanonicalThemeId(themeId, `visual harness scene '${normalizedId}'`);
  const normalizedSourceModule = assertNonEmptyString(sourceModule, 'scene.sourceModule', { sceneId: normalizedId });
  const normalizedSourceExport = assertNonEmptyString(sourceExport, 'scene.sourceExport', { sceneId: normalizedId });
  if (!SCENE_SOURCE_MODULE_PATTERN.test(normalizedSourceModule)) {
    throw createVisualSceneContractError(
      '[VisualHarness] scene.sourceModule must name a JSX file in the owned scenes directory.',
      { sceneId: normalizedId, sourceModule: normalizedSourceModule },
    );
  }
  if (!SCENE_SOURCE_EXPORT_PATTERN.test(normalizedSourceExport)) {
    throw createVisualSceneContractError(
      '[VisualHarness] scene.sourceExport must be a module export name.',
      { sceneId: normalizedId, sourceExport: normalizedSourceExport },
    );
  }

  const normalizedReadyTimeoutMs = assertIntegerInRange(
    readyTimeoutMs,
    'scene.readyTimeoutMs',
    MIN_READY_TIMEOUT_MS,
    MAX_READY_TIMEOUT_MS,
    { sceneId: normalizedId },
  );

  return Object.freeze({
    contractVersion: VISUAL_SCENE_CONTRACT_VERSION,
    id: normalizedId,
    title: normalizedTitle,
    kind: normalizedKind,
    locale: normalizedLocale,
    themeId: normalizedThemeId,
    viewport: normalizeViewport(viewport, normalizedId),
    browserPreferences: normalizeBrowserPreferences(browserPreferences, normalizedId),
    readyTimeoutMs: normalizedReadyTimeoutMs,
    captures: normalizeCaptures(captures, normalizedId),
    sourceModule: normalizedSourceModule,
    sourceExport: normalizedSourceExport,
  });
}

export function defineVisualSceneImplementation({ Component, prepare = null }) {
  if (typeof Component !== 'function') {
    throw createVisualSceneContractError(
      '[VisualHarness] scene implementation Component must be a React component function.',
      { componentType: typeof Component },
    );
  }
  if (prepare !== null && typeof prepare !== 'function') {
    throw createVisualSceneContractError(
      '[VisualHarness] scene implementation prepare must be a function when provided.',
      { prepareType: typeof prepare },
    );
  }

  return Object.freeze({ Component, prepare });
}

export function toVisualSceneManifest(entry) {
  return Object.freeze({
    contractVersion: entry.contractVersion,
    id: entry.id,
    title: entry.title,
    kind: entry.kind,
    locale: entry.locale,
    themeId: entry.themeId,
    viewport: entry.viewport,
    browserPreferences: entry.browserPreferences,
    readyTimeoutMs: entry.readyTimeoutMs,
    captures: entry.captures,
  });
}

export function assembleVisualScene(entry, implementation) {
  if (!implementation || typeof implementation !== 'object' || Array.isArray(implementation)) {
    throw createVisualSceneContractError(
      '[VisualHarness] scene module must default-export a visual scene implementation.',
      { sceneId: entry.id, implementationType: typeof implementation },
    );
  }

  const normalizedImplementation = defineVisualSceneImplementation(implementation);
  return Object.freeze({
    manifest: toVisualSceneManifest(entry),
    Component: normalizedImplementation.Component,
    prepare: normalizedImplementation.prepare,
  });
}
