// The artifact build wrapper and development source snapshot consume this same
// ordered catalog. Structural/release gates remain separate verification owners.
export const EXTENSION_ARTIFACT_CHECK_PATHS = Object.freeze([
  'scripts/ci/check-content-runtime-bootstrap-artifact-contract.mjs',
  'scripts/ci/check-dist-no-dynamic-code.mjs',
  'scripts/ci/check-public-build-debug-surface.mjs',
  'scripts/ci/check-context-bundle-budget.mjs',
  'scripts/ci/check-zen-home-renderer-worker-artifact-contract.mjs',
  'scripts/ci/check-zen-model-worker-artifact-contract.mjs',
  'scripts/ci/check-dashboard-boot-artifact-contract.mjs',
  'scripts/ci/check-background-i18n-leaf-artifact-contract.mjs',
  'scripts/ci/check-content-runtime-browser-like-contract.mjs',
  'scripts/ci/check-background-service-worker-contract.mjs',
]);
