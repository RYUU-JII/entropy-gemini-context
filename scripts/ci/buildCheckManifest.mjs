export const BUILD_CHECK_PHASES = Object.freeze([
  'dev',
  'build',
  'prebuild',
  'release',
  'structural',
]);

const categories = Object.freeze(['architecture', 'security', 'product-contract']);

const ownerDocs = Object.freeze({
  i18n: 'docs/architecture/i18n/i18n-architecture-target.md',
  documents: 'docs/governance/document-system.md',
  development: 'docs/operations/dev-verification-workflow.md',
  dashboard: 'docs/architecture/repository/dashboard-launch-loading-boundary-map.md',
  artifacts: 'docs/architecture/themes/artifacts/artifact-scene-runtime-core-spec.md',
  stats: 'docs/architecture/repository/storage-stats-tracking-boundary-map.md',
  personalBaseline: 'docs/architecture/repository/personal-baseline-boundary-map.md',
  sitePull: 'docs/architecture/repository/site-pull-pattern-boundary-map.md',
  nudge: 'docs/architecture/repository/friction-nudge-effect-boundary-map.md',
  background: 'docs/system-architecture/05-background-runtime-owners.md',
  topology: 'docs/system-architecture/01-topology.md',
  storage: 'docs/system-architecture/02-runtime-storage-boundaries.md',
  themes: 'docs/system-architecture/03-theme-plugin-and-zen.md',
  rendering: 'docs/architecture/repository/render-runtime-budget-boundary-map.md',
  pond: 'docs/architecture/themes/zen/zen-pond-render-worker-spec.md',
  workers: 'docs/architecture/workers/worker-runtime-control-plane.md',
  navigation: 'docs/architecture/repository/navigation-continuity-runtime-boundary-map.md',
  consumption: 'docs/architecture/runtime/consumption-memory-runtime.md',
  ensoResearch: 'docs/architecture/themes/zen/zen-enso-research-workspace.md',
  content: 'docs/architecture/runtime/content-runtime-target-architecture.md',
  qa: 'docs/operations/qa/entropy-qa-control-plane.md',
  quality: 'docs/operations/ci/quality-gate.md',
  security: 'docs/operations/runbooks/chrome-web-store-submission-guide.md',
  scenes: 'docs/architecture/themes/scene/artifact-gallery-scene-spec.md',
});

const check = (id, category, ownerDoc, phases = {}) => ({
  id,
  script: id,
  category,
  ownerDoc,
  phases,
});

// Source order owns prebuild/build order. Additional phase positions preserve
// their existing execution order without registering a check more than once.
const prebuildChecks = [
  check('i18n:sync:modules', 'product-contract', ownerDocs.i18n, { structural: 0 }),
  check('check:i18n:contract', 'product-contract', ownerDocs.i18n, { structural: 1 }),
  check('check:i18n:duplication-guard', 'product-contract', ownerDocs.i18n),
  check('check:docs:paths', 'architecture', ownerDocs.documents, { structural: 4 }),
  check('check:i18n:no-default-value', 'product-contract', ownerDocs.i18n),
  check('check:i18n:dynamic-families', 'product-contract', ownerDocs.i18n),
  check('check:i18n:ownership', 'architecture', ownerDocs.i18n, { structural: 2 }),
  check('check:i18n:robustness', 'product-contract', ownerDocs.i18n, { structural: 3 }),
  check('check:background:i18n-leaf', 'architecture', ownerDocs.i18n),
  check('check:runtime:i18n-boundaries', 'architecture', ownerDocs.i18n),
  check('check:settings:preview-i18n-contract', 'product-contract', ownerDocs.i18n),
  check('check:react:i18n-hook-boundaries', 'architecture', ownerDocs.i18n),
  check('check:ui:i18n-hardcoded-strings', 'product-contract', ownerDocs.i18n),
  check('check:dev:react-refresh-contract', 'product-contract', ownerDocs.development, { dev: 0 }),
  check('check:dev-extension:publication-contract', 'architecture', ownerDocs.development, { dev: 1 }),
  check('check:dashboard:i18n-contract', 'product-contract', ownerDocs.i18n),
  check('check:dashboard:owner-architecture', 'architecture', ownerDocs.dashboard, { structural: 5 }),
  check('check:tools:artifact-render-pipeline', 'architecture', ownerDocs.artifacts, { structural: 15 }),
  check('check:stats:projection-architecture', 'architecture', ownerDocs.stats),
  check('check:stats:read-model-architecture', 'architecture', ownerDocs.stats, { structural: 6 }),
  check('check:personal-baseline:architecture', 'architecture', ownerDocs.personalBaseline),
  check('check:site-pull-pattern:architecture', 'architecture', ownerDocs.sitePull),
  check('check:nudge-domain:owner-architecture', 'architecture', ownerDocs.nudge, { structural: 7 }),
  check('check:intervention-scheduler', 'architecture', ownerDocs.background),
  check('check:architecture:legacy-free', 'architecture', ownerDocs.topology, { structural: 8 }),
  check('check:release-v1:baseline', 'architecture', ownerDocs.storage, { structural: 9 }),
  check('check:theme-preference:owner-architecture', 'architecture', ownerDocs.themes, { structural: 10 }),
  check('check:theme-widget:no-fallbacks', 'architecture', ownerDocs.themes, { structural: 11 }),
  check('check:theme-typography:layering', 'architecture', ownerDocs.themes, { structural: 12 }),
  check('check:theme-boot-loader:contract', 'architecture', ownerDocs.themes, { dev: 2 }),
  check('check:theme-seam-role-architecture', 'architecture', ownerDocs.themes, { structural: 13 }),
  check('check:theme-shared-seams:architecture', 'architecture', ownerDocs.themes),
  check('check:theme-public-entry-boundaries', 'architecture', ownerDocs.themes, { structural: 14 }),
  check('check:ui-kit:owner-boundaries', 'architecture', ownerDocs.topology),
  check('check:ui-kit:concept-icons', 'product-contract', ownerDocs.topology),
  check('check:render-runtime-budget:architecture', 'architecture', ownerDocs.rendering),
  check('check:zen-pond-research:boundary', 'architecture', ownerDocs.pond, { structural: 16 }),
  check('check:zen-pond-worker:architecture', 'architecture', ownerDocs.pond, { structural: 17 }),
  check('check:zen:pond-static-assets', 'product-contract', ownerDocs.pond),
  check('check:worker-runtime:admission-boundary', 'architecture', ownerDocs.workers, { structural: 18 }),
  check('check:navigation-continuity:architecture', 'architecture', ownerDocs.navigation),
  check('check:tracking-browser-events:architecture', 'architecture', ownerDocs.background, { structural: 19 }),
  check('check:consumption-memory:boundary', 'architecture', ownerDocs.consumption),
  check('check:enso:research-boundary', 'architecture', ownerDocs.ensoResearch),
  check('check:content-script:ownership', 'architecture', ownerDocs.content, { dev: 3, structural: 20 }),
  check('check:content-runtime:bootstrap-contract', 'architecture', ownerDocs.content, { dev: 4, structural: 21 }),
  check('check:friction-runtime:architecture', 'architecture', ownerDocs.nudge, { dev: 5, structural: 22 }),
  check('check:protection:cooling-curve', 'architecture', 'docs/architecture/runtime/cooling-curve-runtime.md', { dev: 6, structural: 30 }),
  check('check:qa:architecture', 'architecture', ownerDocs.qa),
  check('check:qa:mv3-nightly', 'product-contract', ownerDocs.quality),
  check('check:ci:product-workflow', 'product-contract', ownerDocs.quality, { structural: 23 }),
];

const buildChecks = [
  check('check:security:surface', 'security', ownerDocs.security, { structural: 24 }),
  check('check:zen:architecture', 'architecture', ownerDocs.themes, { structural: 25 }),
  check('check:zen:env-control-surface', 'architecture', ownerDocs.pond),
  check('check:tools:scene-normalization', 'architecture', ownerDocs.scenes),
  check('check:boot:timeout-contract', 'product-contract', ownerDocs.dashboard),
  check('check:background-kernel:architecture', 'architecture', ownerDocs.background),
  check('check:extension-api-boundaries', 'architecture', ownerDocs.background, { structural: 26 }),
  check('check:tab-time-tracker:architecture', 'architecture', ownerDocs.stats),
  check('check:theme-state:contract', 'architecture', ownerDocs.themes),
  check('check:storage:architecture-boundaries', 'architecture', ownerDocs.storage, { structural: 27 }),
  check('check:storage:versioning-policy', 'architecture', 'docs/architecture/storage/storage-versioning-and-migration-policy.md', { structural: 29 }),
  check('check:bus:sender-boundaries', 'security', ownerDocs.background, { structural: 28 }),
  check('check:ui:no-native-dialogs', 'product-contract', ownerDocs.dashboard),
];

// Release order remains prebuild followed by build; generation/synchronization
// entries retain their positions and are not treated as read-only checks.
export const buildCheckManifest = Object.freeze([
  ...prebuildChecks.map((entry, index) => Object.freeze({
    ...entry,
    phases: Object.freeze({ ...entry.phases, prebuild: index, release: index }),
  })),
  ...buildChecks.map((entry, index) => Object.freeze({
    ...entry,
    phases: Object.freeze({
      ...entry.phases,
      build: index,
      release: prebuildChecks.length + index,
    }),
  })),
]);

function fail(code, detail) {
  throw new Error(`${code}:${detail}`);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Validate registration data; supply packageScripts when planning execution. */
export function validateBuildCheckManifest(manifest, packageScripts) {
  if (!Array.isArray(manifest) || manifest.length === 0) {
    fail('BUILD_CHECK_MANIFEST_INVALID', 'expected non-empty array');
  }
  if (packageScripts !== undefined && !isRecord(packageScripts)) {
    fail('BUILD_CHECK_PACKAGE_SCRIPTS_INVALID', 'expected object');
  }

  const ids = new Set();
  const scripts = new Set();
  const positions = new Map(BUILD_CHECK_PHASES.map((phase) => [phase, new Map()]));
  for (const entry of manifest) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim()) {
      fail('BUILD_CHECK_MANIFEST_ENTRY_INVALID', 'expected non-empty id');
    }
    if (ids.has(entry.id)) fail('BUILD_CHECK_MANIFEST_DUPLICATE_ID', entry.id);
    ids.add(entry.id);

    if (typeof entry.script !== 'string' || !entry.script.trim()) {
      fail('BUILD_CHECK_MANIFEST_SCRIPT_INVALID', entry.id);
    }
    if (scripts.has(entry.script)) fail('BUILD_CHECK_MANIFEST_DUPLICATE_SCRIPT', entry.script);
    scripts.add(entry.script);
    if (packageScripts !== undefined && (
      !Object.hasOwn(packageScripts, entry.script)
      || typeof packageScripts[entry.script] !== 'string'
      || !packageScripts[entry.script].trim()
    )) {
      fail('BUILD_CHECK_MANIFEST_SCRIPT_MISSING', entry.script);
    }
    if (!categories.includes(entry.category)) {
      fail('BUILD_CHECK_MANIFEST_CATEGORY_INVALID', entry.id);
    }
    if (typeof entry.ownerDoc !== 'string' || !entry.ownerDoc.trim()) {
      fail('BUILD_CHECK_MANIFEST_OWNER_DOC_INVALID', entry.id);
    }
    if (!isRecord(entry.phases) || Object.keys(entry.phases).length === 0) {
      fail('BUILD_CHECK_MANIFEST_PHASES_INVALID', entry.id);
    }
    for (const [phase, position] of Object.entries(entry.phases)) {
      if (!positions.has(phase)) fail('BUILD_CHECK_PHASE_UNKNOWN', phase);
      if (!Number.isInteger(position) || position < 0) {
        fail('BUILD_CHECK_MANIFEST_POSITION_INVALID', `${entry.id}:${phase}`);
      }
      const phasePositions = positions.get(phase);
      if (phasePositions.has(position)) {
        fail('BUILD_CHECK_MANIFEST_POSITION_DUPLICATE', `${phase}:${position}`);
      }
      phasePositions.set(position, entry.id);
    }
    if (Object.hasOwn(entry.phases, 'structural') && !Object.hasOwn(entry.phases, 'release')) {
      fail('STRUCTURAL_CHECK_NOT_RELEASE_OWNED', entry.id);
    }
  }
  for (const [phase, phasePositions] of positions) {
    if (phasePositions.size === 0) fail('BUILD_CHECK_MANIFEST_PHASE_EMPTY', phase);
    for (let position = 0; position < phasePositions.size; position += 1) {
      if (!phasePositions.has(position)) {
        fail('BUILD_CHECK_MANIFEST_POSITION_MISSING', `${phase}:${position}`);
      }
    }
  }
  return true;
}

/** Return ordered records without executing checks or reading repository files. */
export function getBuildCheckPlan(phase, {
  manifest = buildCheckManifest,
  packageScripts,
} = {}) {
  if (!BUILD_CHECK_PHASES.includes(phase)) fail('BUILD_CHECK_PHASE_UNKNOWN', phase);
  validateBuildCheckManifest(manifest, packageScripts);
  return manifest
    .filter((entry) => Object.hasOwn(entry.phases, phase))
    .sort((left, right) => left.phases[phase] - right.phases[phase]);
}
