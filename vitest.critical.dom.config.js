import { defineConfig } from 'vitest/config';
import { createEntropyVitestConfig } from './vitest.shared.js';
import { getCriticalDomTests } from './scripts/dev/fastTestProfile.mjs';

export default defineConfig(() => createEntropyVitestConfig({
  include: getCriticalDomTests(),
  exclude: [
    'tests/tmp*.test.{js,jsx}',
  ],
}));
