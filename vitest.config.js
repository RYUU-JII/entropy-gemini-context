import { defineConfig } from 'vitest/config';
import { createEntropyVitestConfig, defaultCoverage } from './vitest.shared.js';
import { RELEASE_TEST_LANE_ENV, selectReleaseTestFiles } from './scripts/ci/releaseTestLane.mjs';

export default defineConfig(() => {
    const laneSelector = process.env[RELEASE_TEST_LANE_ENV];
    return createEntropyVitestConfig({
        include: laneSelector === undefined
            ? ['tests/**/*.{test,spec}.{js,jsx}']
            : selectReleaseTestFiles(laneSelector),
        exclude: ['tests/tmp*.test.{js,jsx}'],
        coverage: defaultCoverage,
    });
});
