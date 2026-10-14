import { evaluate } from '../extensionChromiumHarness.mjs';
import { randomUUID } from 'node:crypto';

// Inclusive sampled time, not exact CPU cycles or selector-internal node visits.
// Keep only declared owner groups; no page URLs or arbitrary stacks leave here.
export function summarizeVisualRemovalProfile(profile, extensionId) {
  if (!/^[a-p]{32}$/.test(extensionId)) throw new Error('VISUAL_REMOVAL_PROFILE_OWNER_INVALID');
  if (!Array.isArray(profile?.nodes) || !Array.isArray(profile.samples)
    || !Array.isArray(profile.timeDeltas) || profile.samples.length !== profile.timeDeltas.length
    || profile.samples.length === 0
    || profile.nodes.length > 25000 || profile.samples.length > 200000) {
    throw new Error('VISUAL_REMOVAL_PROFILE_INVALID');
  }
  const nodes = new Map(profile.nodes.map(node => [node.id, node]));
  const ownedPrefix = `chrome-extension://${extensionId}/`;
  const parents = new Map();
  for (const node of profile.nodes) for (const id of node.children || []) parents.set(id, node.id);
  const groups = { structural: ['collectShortFormStructuralContextRoots'], cleanup: ['cleanupMediaFilters'],
    observerWork: ['runObserverWork'], qualification: ['shouldApplyToMediaElement', 'resolveMediaFilterForElement'] };
  const result = Object.fromEntries(Object.keys(groups).map(key => [key, { samples: 0, inclusiveMs: 0, framePresent: false }]));
  for (const node of nodes.values()) for (const [key, names] of Object.entries(groups)) {
    if (names.includes(node.callFrame?.functionName) && node.callFrame?.url?.startsWith(ownedPrefix)) result[key].framePresent = true;
  }
  for (let index = 0; index < profile.samples.length; index += 1) {
    const delta = profile.timeDeltas[index];
    if (!Number.isFinite(delta) || delta < 0 || !nodes.has(profile.samples[index])) throw new Error('VISUAL_REMOVAL_PROFILE_SAMPLE_INVALID');
    let id = profile.samples[index]; const seen = new Set(); const matched = new Set();
    while (id !== undefined) {
      if (seen.has(id)) throw new Error('VISUAL_REMOVAL_PROFILE_CYCLE');
      seen.add(id); const frame = nodes.get(id)?.callFrame;
      if (frame?.url?.startsWith(ownedPrefix)) for (const [key, names] of Object.entries(groups)) {
        if (names.includes(frame.functionName)) matched.add(key);
      }
      id = parents.get(id);
    }
    for (const key of matched) { result[key].samples += 1; result[key].inclusiveMs += delta / 1000; }
  }
  return { state: 'sampled', requestedIntervalUs: 100, sampleCount: profile.samples.length,
    sampledDurationMs: profile.timeDeltas.reduce((sum, value) => sum + value, 0) / 1000,
    scope: 'exact_owned_extension', groups: result,
    limitation: 'Inclusive groups overlap; zero samples are below sampling resolution, not proof of zero cost. Sampling overhead is included.' };
}

async function profileWork(harness, page, work) {
  const send = (method, params = {}) => harness.cdp.send(method, params, page.sessionId, { timeoutMs: 10000 });
  let enabled = false; let started = false; let value; let profile;
  try {
    await send('Profiler.enable'); enabled = true;
    await send('Profiler.setSamplingInterval', { interval: 100 });
    await send('Profiler.start'); started = true;
    value = await work();
  } finally {
    try { if (started) profile = (await send('Profiler.stop')).profile; }
    finally { if (enabled) await send('Profiler.disable'); }
  }
  return { ...value, sampledCpu: summarizeVisualRemovalProfile(profile, harness.extensionId) };
}

export async function performVisualRemovalCostProbe(harness, page, measure) {
  const cases = [];
  for (const count of [0, 3, 300]) for (const kind of ['outside', 'positive', 'base']) {
    const fixtureId = `entropy-qa-removal-cost-${randomUUID()}`;
    try {
      const setup = await evaluate(harness.cdp, page.sessionId, `(async () => {
      const id = ${JSON.stringify(fixtureId)};
      if (document.getElementById(id)) throw new Error('VISUAL_REMOVAL_FIXTURE_EXISTS');
      const fixture = document.createElement('div'); fixture.id = id;
      fixture.dataset.entropyRemovalOwner = id;
      fixture.style.cssText = 'position:fixed;left:0;top:0;width:180px;height:320px;pointer-events:none';
      const grid = document.createElement('grid-shelf-view-model'); const outside = document.createElement('aside');
      fixture.append(grid, outside);
      const images = [];
      for (let i = 0; i < ${count}; i++) {
        const card = document.createElement('div'); card.className = 'entropy-qa-thumbnail';
        const image = document.createElement('img'); image.width = 180; image.height = 320;
        image.style.cssText = 'position:absolute;left:0;top:0;width:180px;height:320px;filter:sepia(0.4)';
        image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="320"/>') + '#ytimg.com/vi/qa';
        card.append(image); grid.append(card); images.push(image);
      }
      if (${JSON.stringify(kind)} === 'positive') grid.append(document.createElement('ytm-shorts-lockup-view-model'));
      const parent = ${JSON.stringify(kind)} === 'outside' ? outside : grid;
      for (let i = 0; i < 24; i++) { const node = document.createElement('span'); node.dataset.entropyRemovalItem = 'true'; parent.append(node); }
      document.body.append(fixture);
      const expected = ${kind === 'positive' ? 0.98 : 0.35};
      const read = () => images.map(image => ({ inline: image.style.filter, filter: getComputedStyle(image).filter }));
      const start = performance.now(); let before;
      do {
        before = read();
        if (before.every(value => value.inline === 'sepia(0.4)' && Math.abs(Number(value.filter.match(/blur\\(([\\d.]+)px\\)/)?.[1]) - expected) < 0.015)) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      } while (performance.now() - start < 10000);
      await new Promise(resolve => setTimeout(resolve, 300));
      return { count: images.length, expected, before };
    })()`, { timeoutMs: 15000 });
      const measured = await profileWork(harness, page, () => measure(() => evaluate(harness.cdp, page.sessionId, `(async () => {
        const fixture = document.getElementById(${JSON.stringify(fixtureId)});
        if (!fixture) throw new Error('VISUAL_REMOVAL_FIXTURE_MISSING');
        const nodes = [...fixture.querySelectorAll('[data-entropy-removal-item]')];
        const startedAt = performance.now();
        for (const node of nodes) { node.remove(); await new Promise(resolve => setTimeout(resolve, 60)); }
        await new Promise(resolve => setTimeout(resolve, 300));
        return { requestedRemovals: nodes.length, elapsedMs: performance.now() - startedAt };
      })()`, { timeoutMs: 15000 })));
      const after = await evaluate(harness.cdp, page.sessionId, `(() => {
        const fixture = document.getElementById(${JSON.stringify(fixtureId)});
        return [...fixture.querySelectorAll('img')].map(image => ({ inline: image.style.filter, filter: getComputedStyle(image).filter }));
      })()`);
      cases.push({ kind, count, setup, ...measured, after });
    } finally {
      await evaluate(harness.cdp, page.sessionId, `(() => {
        const id = ${JSON.stringify(fixtureId)}; const fixture = document.getElementById(id);
        if (fixture) {
          if (fixture.dataset.entropyRemovalOwner !== id) throw new Error('VISUAL_REMOVAL_FIXTURE_OWNERSHIP_CHANGED');
          fixture.remove();
          if (fixture.isConnected) throw new Error('VISUAL_REMOVAL_FIXTURE_CLEANUP_FAILED');
        }
      })()`);
    }
  }
  return { state: 'measured', cases, fixtureRemoved: true, fixtureOnlyCounts: true,
    limitation: 'The real site remains live. The CPU profile surrounds the whole measured-action helper, including metric snapshots and contention projection; runtimeCost.window covers the inner mutation action. Do not sum or normalize these different windows together. Fixture setup and effect reads are outside both. Timers request separation but do not prove one flush per removal.' };
}

export function createVisualRemovalCostContract(evidence) {
  const validFilter = (item, expected) => {
    const terms = typeof item?.filter === 'string' ? [...item.filter.matchAll(/blur\(([\d.]+)px\)/g)] : [];
    return item?.inline === 'sepia(0.4)' && item.filter.startsWith('sepia(0.4) ')
      && terms.length === 1 && Math.abs(Number(terms[0][1]) - expected) < 0.015;
  };
  const passed = evidence?.state === 'measured' && evidence.fixtureRemoved === true && evidence.cases?.length === 9
    && [0, 3, 300].every(count => ['outside', 'positive', 'base'].every(kind => {
      const rows = evidence.cases.filter(row => row.count === count && row.kind === kind);
      const row = rows[0]; const expected = kind === 'positive' ? 0.98 : 0.35;
      return rows.length === 1 && row.value?.requestedRemovals === 24 && row.sampledCpu?.state === 'sampled'
        && row.sampledCpu.sampleCount > 0 && row.sampledCpu.scope === 'exact_owned_extension'
        && row.runtimeCost?.state === 'measured' && row.runtimeCost.window?.durationMs > 0
        && row.setup?.count === count && row.setup.before?.length === count && row.after?.length === count
        && [...row.setup.before, ...row.after].every(item => validFilter(item, expected));
    }));
  return { id: 'visual_removal_cost_fixture', status: passed ? 'PASS' : 'FAIL', evidence,
    message: 'Fixed removal workload and preserved effects; PASS does not assert CPU improvement or absence of site noise.' };
}
