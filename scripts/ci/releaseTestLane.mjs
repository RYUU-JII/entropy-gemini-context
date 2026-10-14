import fs from 'node:fs';
import path from 'node:path';

export const RESEARCH_SOURCE_TOKENS = Object.freeze([
  'scripts/dev/zen-bonsai-morphology-research',
  'scripts/dev/zen-pond-render-research',
]);
export const RESEARCH_SOURCE_TOKEN = RESEARCH_SOURCE_TOKENS[0];
export const RELEASE_TEST_LANE_ENV = 'ENTROPY_TEST_LANE';
export const RELEASE_RESEARCH_GUARD_TESTS = Object.freeze([
  'tests/zenBonsaiMorphologyResearchBoundary.test.js',
]);
export const RESEARCH_MIXED_OWNER_TESTS = Object.freeze([
  'tests/themes/zenPondPresentationDensityResearchCandidate.test.js',
  'tests/themes/zenPondResearchHarness.test.js',
]);

const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:cjs|js|jsx|mjs|ts|tsx)$/u;
const PRODUCT_SOURCE_IMPORT_PATTERNS = Object.freeze([
  /\bfrom\s+['"](?:\.\.\/)+src\//u,
  /\bimport\s+['"](?:\.\.\/)+src\//u,
  /\bimport\s*\(\s*['"](?:\.\.\/)+src\//u,
]);

const toPosixPath = (value) => String(value || '').replaceAll(path.sep, '/');

const collectFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(absolutePath) : [absolutePath];
  });

export function classifyTestSource({ relativePath, source } = {}) {
  const normalizedPath = toPosixPath(relativePath);
  const normalizedSource = String(source || '');
  const referencesDetachedResearch = RESEARCH_SOURCE_TOKENS.some(
    (token) => normalizedSource.includes(token),
  );
  const isReleaseResearchGuard = RELEASE_RESEARCH_GUARD_TESTS.includes(normalizedPath);
  const isApprovedMixedResearch = RESEARCH_MIXED_OWNER_TESTS.includes(normalizedPath);
  const importsProductSource = PRODUCT_SOURCE_IMPORT_PATTERNS.some(
    (pattern) => pattern.test(normalizedSource),
  );

  if (
    referencesDetachedResearch
    && importsProductSource
    && !isReleaseResearchGuard
    && !isApprovedMixedResearch
  ) {
    throw new Error(`RELEASE_TEST_LANE_MIXED_OWNER:${normalizedPath}`);
  }

  return Object.freeze({
    isReleaseResearchGuard,
    isApprovedMixedResearch,
    referencesDetachedResearch,
    releaseEligible: !referencesDetachedResearch || isReleaseResearchGuard,
    researchEligible: referencesDetachedResearch,
  });
}

export function collectReleaseTestLane({ rootDir = process.cwd() } = {}) {
  const testsRoot = path.join(rootDir, 'tests');
  const records = collectFiles(testsRoot)
    .filter((absolutePath) => TEST_FILE_PATTERN.test(absolutePath))
    .map((absolutePath) => {
      const relativePath = toPosixPath(path.relative(rootDir, absolutePath));
      const source = fs.readFileSync(absolutePath, 'utf8');
      return Object.freeze({
        absolutePath,
        relativePath,
        ...classifyTestSource({ relativePath, source }),
      });
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  const releaseTests = records
    .filter((record) => record.releaseEligible)
    .map((record) => record.relativePath);
  const researchTests = records
    .filter((record) => record.researchEligible)
    .map((record) => record.relativePath);

  if (releaseTests.length === 0) {
    throw new Error('RELEASE_TEST_LANE_EMPTY');
  }
  if (researchTests.length === 0) {
    throw new Error('RESEARCH_TEST_LANE_EMPTY');
  }
  RELEASE_RESEARCH_GUARD_TESTS.forEach((relativePath) => {
    if (!releaseTests.includes(relativePath) || !researchTests.includes(relativePath)) {
      throw new Error(`RELEASE_RESEARCH_GUARD_MISSING:${relativePath}`);
    }
  });

  return Object.freeze({
    allTests: Object.freeze(records.map((record) => record.relativePath)),
    releaseTests: Object.freeze(releaseTests),
    researchTests: Object.freeze(researchTests),
  });
}

/**
 * Tests that belong only to the detached research lane.
 *
 * That lane is product-ineligible by its own declared contract and may carry unmet
 * research targets, so lanes meant to answer "is what ships healthy?" exclude it. The
 * release/research guard test is deliberately in both lanes and therefore not returned
 * here: it is the thing that proves the boundary, and it must run everywhere.
 */
export function collectResearchOnlyTests(options = {}) {
  const lane = collectReleaseTestLane(options);
  const releaseTests = new Set(lane.releaseTests);
  return Object.freeze(
    lane.researchTests.filter((relativePath) => !releaseTests.has(relativePath)),
  );
}

/** Keep lane selection inside Vitest instead of serializing every file in argv. */
export function selectReleaseTestFiles(selector, options = {}) {
  if (selector !== 'release' && selector !== 'research') {
    throw new Error(`RELEASE_TEST_LANE_SELECTOR_INVALID:${selector}`);
  }
  const lane = options.lane ?? collectReleaseTestLane(options);
  const selected = selector === 'research' ? lane.researchTests : lane.releaseTests;
  // Match the existing default Vitest include vocabulary; the collector also
  // recognizes other test extensions used by independent configurations.
  return Object.freeze(selected.filter((file) => /\.(?:test|spec)\.(?:js|jsx)$/u.test(file)));
}
