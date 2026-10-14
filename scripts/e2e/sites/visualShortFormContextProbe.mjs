import { evaluate } from '../extensionChromiumHarness.mjs';

// Independent computed-style oracle, run only by the existing owned site target.
// Product selectors/classifiers are not imported or overridden.
export async function performVisualShortFormContextProbe(harness, page) {
  return evaluate(harness.cdp, page.sessionId, `(async () => {
    const fixtureId = 'entropy-qa-grid-context';
    if (document.getElementById(fixtureId)) throw new Error('GRID_CONTEXT_FIXTURE_ALREADY_EXISTS');
    const cases = [];
    const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.015;
    const sample = image => {
      const computedFilter = getComputedStyle(image).filter;
      const match = computedFilter.match(/blur\\(\\s*([\\d.]+)px\\s*\\)/);
      const rect = image.getBoundingClientRect();
      return { blurPx: match ? Number(match[1]) : null, computedFilter,
        inlineFilter: image.style.filter, connected: image.isConnected, width: rect.width, height: rect.height };
    };
    for (const tag of ['ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2']) {
      const fixture = document.createElement('div');
      fixture.id = fixtureId;
      fixture.style.cssText = 'display:flex;position:fixed;left:8px;top:8px;z-index:1000';
      const makeGrid = () => {
        const grid = document.createElement('grid-shelf-view-model');
        const card = document.createElement('div'); card.className = 'entropy-qa-thumbnail';
        const image = document.createElement('img'); image.width = 180; image.height = 320;
        image.style.cssText = 'display:block;width:180px;height:320px;filter:sepia(0.4)';
        image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="320"><rect width="180" height="320" fill="blue"/></svg>') + '#ytimg.com/vi/qa';
        card.append(image); grid.append(card); fixture.append(grid);
        return { grid, image };
      };
      const left = makeGrid(); const right = makeGrid(); const warm = makeGrid();
      const initialEvidence = document.createElement(tag); warm.grid.append(initialEvidence);
      const checkpoints = {};
      const wait = async (name, expected) => {
        const start = performance.now(); let snapshot;
        do {
          snapshot = { left: sample(left.image), right: sample(right.image), warm: sample(warm.image) };
          if (expected(snapshot)) { checkpoints[name] = snapshot; return; }
          await new Promise(resolve => setTimeout(resolve, 50));
        } while (performance.now() - start < 5000);
        checkpoints[name] = { ...snapshot, timedOut: true };
      };
      document.body.append(fixture);
      try {
        await wait('initial', s => s.left.blurPx > 0 && s.right.blurPx > 0 && s.warm.blurPx > s.left.blurPx);
        const base = checkpoints.initial.left.blurPx;
        const boosted = Math.round(Math.min(2.6, base * 1.8 + 0.35) * 100) / 100;
        const wrapper = document.createElement('div'); wrapper.append(document.createElement(tag));
        left.grid.append(wrapper);
        await wait('added', s => near(s.left.blurPx, boosted) && near(s.right.blurPx, base));
        right.grid.append(wrapper);
        await wait('moved', s => near(s.left.blurPx, base) && near(s.right.blurPx, boosted));
        const relocatedEvidence = wrapper.firstElementChild;
        wrapper.remove(); left.grid.append(relocatedEvidence);
        await wait('rewrittenRemoval', s => near(s.left.blurPx, boosted) && near(s.right.blurPx, base));
        relocatedEvidence.remove(); initialEvidence.remove();
        await wait('removed', s => near(s.left.blurPx, base) && near(s.right.blurPx, base) && near(s.warm.blurPx, base));
        const delayedWrapper = document.createElement('div'); delayedWrapper.append(document.createElement(tag));
        left.grid.append(delayedWrapper);
        await wait('delayedReady', s => near(s.left.blurPx, boosted) && near(s.right.blurPx, base) && near(s.warm.blurPx, base));
        delayedWrapper.remove();
        // Native observer delivery precedes this microtask continuation, but
        // the Hub frame and cooperative consumer have not run. Detached edits
        // after delivery are not covered by transient subtree observation.
        await Promise.resolve();
        delayedWrapper.replaceChildren();
        await wait('delayedRemoval', s => near(s.left.blurPx, base) && near(s.right.blurPx, base) && near(s.warm.blurPx, base));
        cases.push({ tag, base, boosted, checkpoints });
      } finally {
        fixture.remove();
      }
    }
    return { status: 'performed', cases, fixtureRemoved: !document.getElementById(fixtureId) };
  })()`, { timeoutMs: 60_000 });
}

export function createVisualShortFormContextContract(evidence) {
  const tags = ['ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2'];
  const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.015;
  const active = (sample, expected) => {
    const filters = typeof sample?.computedFilter === 'string'
      ? [...sample.computedFilter.matchAll(/blur\(\s*([\d.]+)px\s*\)/g)] : [];
    return sample?.connected === true && sample.width >= 180 && sample.height >= 320
      && sample.inlineFilter === 'sepia(0.4)' && typeof sample.computedFilter === 'string'
      && sample.computedFilter.startsWith('sepia(0.4) ')
      && filters.length === 1 && near(Number(filters[0][1]), expected) && near(sample.blurPx, expected);
  };
  const passed = evidence?.status === 'performed' && evidence.fixtureRemoved === true
    && evidence.cases?.length === tags.length && tags.every(tag => {
      const item = evidence.cases.find(value => value.tag === tag);
      if (!item || !(item.base > 0) || !(item.boosted > item.base)
        || !near(item.boosted, Math.round(Math.min(2.6, item.base * 1.8 + 0.35) * 100) / 100)) return false;
      const expected = { initial: [item.base, item.base, item.boosted], added: [item.boosted, item.base, item.boosted],
        moved: [item.base, item.boosted, item.boosted], rewrittenRemoval: [item.boosted, item.base, item.boosted],
        removed: [item.base, item.base, item.base], delayedReady: [item.boosted, item.base, item.base],
        delayedRemoval: [item.base, item.base, item.base] };
      return Object.entries(expected).every(([name, levels]) => {
        const checkpoint = item.checkpoints?.[name];
        return checkpoint && checkpoint.timedOut !== true
          && ['left', 'right', 'warm'].every((key, index) => active(checkpoint[key], levels[index]));
      });
    });
  return { id: 'visual_short_form_grid_context', status: passed ? 'PASS' : 'FAIL', evidence,
    message: 'Controlled YouTube portrait grid context addition, relocation and last-evidence removal for both lockup versions.' };
}
