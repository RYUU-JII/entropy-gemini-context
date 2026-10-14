export function createDeterministicRandom(seed = 1) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function withDeterministicMathRandom(seed, task) {
  if (typeof task !== 'function') {
    throw new Error('[VisualHarness] deterministic random task is required.');
  }
  const originalRandom = Math.random;
  const deterministicRandom = createDeterministicRandom(seed);
  Math.random = deterministicRandom;
  try {
    return task(deterministicRandom);
  } finally {
    Math.random = originalRandom;
  }
}
