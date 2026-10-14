import { defineConfig } from 'vitest/config';
import { createEntropyVitestConfig } from './vitest.shared.js';
import { getDomFastTests, getFullOnlyTests } from './scripts/dev/fastTestProfile.mjs';
import { collectResearchOnlyTests } from './scripts/ci/releaseTestLane.mjs';

const domFastInclude = [
  'tests/**/*.test.jsx',
  'tests/**/*.spec.jsx',
  ...getDomFastTests(),
];

export default defineConfig(() => createEntropyVitestConfig({
  include: domFastInclude,
  exclude: [
    'tests/tmp*.test.{js,jsx}',
    ...getFullOnlyTests(),
    // Same reason as the fast logic lane: detached research does not gate this one.
    ...collectResearchOnlyTests(),
  ],
}));
