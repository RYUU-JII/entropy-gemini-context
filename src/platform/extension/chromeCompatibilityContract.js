const REVIEWED_FEATURE_FLOORS = Object.freeze({
  chromeStorageSession: 102,
  cssHasSelector: 105,
  cssDynamicViewportUnits: 108,
  cssColorMix: 111,
  schedulerYield: 129,
});

const publicMinimumMajorVersion = Math.max(
  ...Object.values(REVIEWED_FEATURE_FLOORS),
);

/**
 * Canonical public-Chrome compatibility contract.
 *
 * `src/manifest.json` must retain a static JSON literal for browser tooling, so
 * build/release guards assert that literal against this owner instead of
 * introducing a generated or fallback manifest path.
 */
export const CHROME_COMPATIBILITY_CONTRACT = Object.freeze({
  schemaVersion: 1,
  publicMinimumVersion: String(publicMinimumMajorVersion),
  viteTarget: `chrome${publicMinimumMajorVersion}`,
  reviewedFeatureFloors: REVIEWED_FEATURE_FLOORS,
});

export function assertCanonicalManifestChromeCompatibility(
  manifest,
  { source = 'manifest' } = {},
) {
  const actual = manifest?.minimum_chrome_version;
  const expected = CHROME_COMPATIBILITY_CONTRACT.publicMinimumVersion;
  if (actual !== expected) {
    throw new Error(
      `CHROME_COMPATIBILITY_MANIFEST_MISMATCH:${source}:expected=${expected}:actual=${String(actual)}`,
    );
  }
  return manifest;
}
