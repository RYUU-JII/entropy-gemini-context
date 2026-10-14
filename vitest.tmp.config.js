import { defineConfig } from 'vitest/config';
import { createEntropyVitestConfig } from './vitest.shared.js';

export default defineConfig(() => createEntropyVitestConfig({
    include: ['tests/tmp*.test.js'],
    testTimeout: 30000,
}));
