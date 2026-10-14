import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const failures = [];

async function readText(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), 'utf8');
}

function requireIncludes(source, relativePath, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) {
      failures.push(`${relativePath} must include ${JSON.stringify(token)}.`);
    }
  }
}

const [
  packageSource,
  publisherSource,
  buildProfileSource,
  runtimeArchitectureSource,
  workflowSource,
] = await Promise.all([
  readText('package.json'),
  readText('scripts/dev/devExtensionArtifactPublisher.mjs'),
  readText('src/platform/build/extensionManifestProfile.js'),
  readText('docs/architecture/runtime/multiplatform-extension-runtime.md'),
  readText('docs/operations/dev-verification-workflow.md'),
]);

const packageJson = JSON.parse(packageSource);
const scripts = packageJson?.scripts || {};
if (scripts.build !== 'node ./scripts/dev/build-dev-extension.mjs --artifact-only') {
  failures.push('package.json build must use the staged artifact-only development extension publisher.');
}
for (const scriptName of ['dev', 'dev:quick']) {
  if (!String(scripts[scriptName] || '').includes('scripts/dev/watch-dev-extension.mjs')) {
    failures.push(`package.json ${scriptName} must use the stable artifact watch owner.`);
  }
}
for (const [alias, canonical] of [
  ['build:quick', 'build'],
  ['build:dev', 'build'],
  ['build:dev:quick', 'build'],
  ['build:prod:quick', 'build:prod'],
  ['dev:checked', 'dev'],
]) {
  if (scripts[alias] !== `npm run ${canonical} --`) {
    failures.push(`package.json ${alias} must forward arguments to the canonical ${canonical} command.`);
  }
  for (const hook of [`pre${alias}`, `post${alias}`, `pre${canonical}`, `post${canonical}`]) {
    if (Object.hasOwn(scripts, hook)) {
      failures.push(`package.json ${hook} must not add hidden lifecycle work to a forwarding alias.`);
    }
  }
}

requireIncludes(publisherSource, 'scripts/dev/devExtensionArtifactPublisher.mjs', [
  "stagingRoot: path.join(ownerDir, 'staging')",
  "previousDir: path.join(ownerDir, 'previous')",
  'captured.digest !== current.digest',
  'inputs = await captureInputs(paths.rootDir)',
  'buildRoot: inputs.rootDir',
  'inputDigest: inputs.inputDigest',
  'await inputs.release()',
  'publishDevExtensionArtifactTransaction({',
  'DEV_EXTENSION_ARTIFACT_ROLLBACK_FAILED',
  'export async function pinDevExtensionForRealUse(rootDir)',
  'export async function inspectDevExtensionRealUsePin(rootDir)',
  'export async function releaseDevExtensionRealUsePin(rootDir, { pinId } = {})',
  'export async function resolveDevExtensionArtifactSource(rootDir, configuredArtifactDir)',
  "realUsePinPath: path.join(ownerDir, 'real-use-pin.json')",
  "latestDir: path.join(ownerDir, 'latest')",
  'DEV_EXTENSION_REAL_USE_PIN_CONSUMER_CHANGED',
  'DEV_EXTENSION_REAL_USE_PIN_RECORD_MISSING',
  'const activeDir = await resolveDevExtensionArtifactSource(paths.rootDir, paths.activeDir)',
  'await commitPublication()',
  'if (promoted) await renamePublication(canonicalActiveDir, canonicalStagingDir)',
  'if (retired) await renamePublication(canonicalPreviousDir, canonicalActiveDir)',
]);
const leaseSource = await readText('scripts/qa/resources/QaArtifactLease.mjs');
requireIncludes(leaseSource, 'scripts/qa/resources/QaArtifactLease.mjs', [
  'await resolveDevExtensionArtifactSource(plan.rootDir, plan.artifactPaths.devExtension)',
  'await resolveDevExtensionArtifactSource(this.plan.rootDir, this.plan.artifactPaths.devExtension)',
  'withDevExtensionPublicationLock(this.plan.rootDir',
  'fs.cp(sourcePath, this.pinnedDir',
]);
const realUsePinTest = await readText('tests/devExtensionRealUsePin.test.js');
requireIncludes(realUsePinTest, 'tests/devExtensionRealUsePin.test.js', [
  'concurrent publishers leave the exact loaded dist stable while QA advances to latest',
  'a release receipt commit failure restores exact dist and preserves latest plus the active record',
  'custom artifact paths retain their own authority even if the canonical pin record is corrupt',
]);
const qaControlPlaneSource = await readText('docs/operations/qa/entropy-qa-control-plane.md');
requireIncludes(qaControlPlaneSource, 'docs/operations/qa/entropy-qa-control-plane.md', [
  'real-use-pin.json',
  'The pin has no expiration',
  'Release requires the exact pin ID',
  'state: released',
]);
requireIncludes(buildProfileSource, 'src/platform/build/extensionManifestProfile.js', [
  'EXTENSION_BUILD_ACTIVE_DEV_OUTPUT_MUTATION',
  'EXTENSION_BUILD_OUTPUT_PROFILE_COLLISION',
]);
const viteConfigSource = await readText('vite.config.js');
requireIncludes(viteConfigSource, 'vite.config.js', [
  'isReadOnlyViteConfigConsumer',
  'const preflightOutDir = resolveCliOutDir() || extensionOutDir',
  'const crx = visualHarnessServe || readOnlyViteConfigConsumer',
  '...(crx ? [crx({ manifest: runtimeManifest })] : [])',
]);
requireIncludes(
  runtimeArchitectureSource,
  'docs/architecture/runtime/multiplatform-extension-runtime.md',
  [
    '.artifacts/dev-extension-builds/staging',
    '.artifacts/dev-extension-builds/previous',
    'EXTENSION_BUILD_ACTIVE_DEV_OUTPUT_MUTATION:dev:dist',
  ],
);
requireIncludes(workflowSource, 'docs/operations/dev-verification-workflow.md', [
  '빌드 중 입력이 바뀌면',
  '새 dev 버전을',
  '활성화하는 공개 명령은 `npm run build`와 `npm run dev`다.',
]);

if (failures.length > 0) {
  console.error('[check-dev-extension-publication-contract] Contract violation detected:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
