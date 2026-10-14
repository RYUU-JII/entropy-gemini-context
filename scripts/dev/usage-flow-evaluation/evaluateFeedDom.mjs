import { isDeepStrictEqual } from 'node:util';
import { JSDOM } from 'jsdom';
import { GENERIC_FEED_ITEM_SELECTOR } from '../../../src/domains/nudge/feed-flow/discovery/genericFeedItemFeatures.js';
import { isGenericFeedItemCandidate, resolveFeedItemBoundaries } from '../../../src/domains/nudge/feed-flow/discovery/feedItemBoundaries.js';
import GenericFeedItemDiscovery from '../../../src/domains/nudge/feed-flow/discovery/GenericFeedItemDiscovery.js';
import GenericSurfaceClassifier from '../../../src/domains/nudge/feed-flow/classify/GenericSurfaceClassifier.js';
import { readFeedRegionSnapshot } from '../../../src/domains/nudge/feed-flow/observation/readFeedRegionSnapshot.js';
import FeedStructureLearner from '../../../src/domains/nudge/feed-flow/learning/FeedStructureLearner.js';

const discoverySelector = ':is(article,main,section,figure,[role="article"],[role="main"],[role="listitem"])';

function readCompleteFreshItems(observation) {
  if (!observation.complete) throw new Error(`FIXTURE_SUPPLY_OBSERVATION_INCOMPLETE:${observation.reason}`);
  return observation.freshItems;
}

function withDom(html, run) {
  const dom = new JSDOM(html, { url: 'https://fixture.invalid/feed', pretendToBeVisual: true });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Element');
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: dom.window.Element });
  try { return run(dom.window); } finally {
    dom.window.close();
    if (previous) Object.defineProperty(globalThis, 'Element', previous);
    else delete globalThis.Element;
  }
}

function measureScene({ html, rects, layout, boundarySource, selector, visibility = 'visible' }) {
  return withDom(html, (windowRef) => {
    const documentRef = windowRef.document;
    Object.defineProperty(windowRef, 'innerWidth', { value: 800 });
    Object.defineProperty(windowRef, 'innerHeight', { value: 600 });
    Object.defineProperty(documentRef, 'visibilityState', { value: visibility, configurable: true });
    for (const [id, [left, top, width, height]] of Object.entries(rects)) {
      const element = documentRef.getElementById(id);
      if (!element) throw new Error(`FIXTURE_RECT_TARGET_MISSING:${id}`);
      element.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height });
    }
    const region = documentRef.getElementById('feed');
    const declared = boundarySource === 'declared';
    const candidates = Array.from(region.querySelectorAll(declared ? selector : GENERIC_FEED_ITEM_SELECTOR));
    const items = resolveFeedItemBoundaries(declared ? candidates : candidates.filter(isGenericFeedItemCandidate), { declared });
    const snapshot = readFeedRegionSnapshot({ region, items, layout, boundarySource, at: 1000 });
    const discovery = new GenericFeedItemDiscovery({ documentRef });
    discovery.setSurface({ profileId: declared ? 'fixture' : 'default', candidateItemSelectors: declared ? selector : discoverySelector });
    const fresh = readCompleteFreshItems(discovery.observeMutations({ mutations: [{ target: region, addedNodes: [region] }] }));
    const classified = new GenericSurfaceClassifier({ windowRef, documentRef }).classify({ feedDiscoveryItemSelector: discoverySelector });
    return {
      boundaries: items.map((item) => item.id),
      visible: snapshot.visibleItems.map((item) => item.element.id),
      fractions: Object.fromEntries(snapshot.items.map((item) => [item.element.id, [item.itemFraction, item.regionFraction]])),
      statuses: Object.fromEntries(snapshot.items.map((item) => [item.element.id, item.geometryStatus])),
      contentClass: classified.contentClass,
      classifierItemCount: classified.repeatedItemCount,
      fresh, limitations: snapshot.limitations,
    };
  });
}

function measureIdentity({ initial, replacement, operation }) {
  return withDom(`<main id="feed">${initial}</main>`, (windowRef) => {
    const documentRef = windowRef.document;
    const region = documentRef.getElementById('feed');
    const discovery = new GenericFeedItemDiscovery({ documentRef });
    discovery.setSurface({ profileId: 'fixture', candidateItemSelectors: 'article' });
    if (!discovery.seedKnownItems().complete) throw new Error('FIXTURE_SUPPLY_SEED_INCOMPLETE');
    const holder = documentRef.createElement('div');
    holder.innerHTML = replacement;
    const next = holder.firstElementChild;
    let target;
    let addedNodes;
    if (operation === 'remount') {
      region.replaceChildren(next);
      target = region;
      addedNodes = [next];
    } else if (operation === 'recycle') {
      target = region.firstElementChild;
      for (const name of target.getAttributeNames()) target.removeAttribute(name);
      for (const name of next.getAttributeNames()) target.setAttribute(name, next.getAttribute(name));
      target.replaceChildren(...next.childNodes);
      addedNodes = Array.from(target.childNodes);
    } else throw new Error('FIXTURE_OPERATION_INVALID');
    return readCompleteFreshItems(discovery.observeMutations({ mutations: [{ type: 'childList', target, addedNodes }] }));
  });
}

function measureEvidence(duplicateFlags) {
  const learner = new FeedStructureLearner();
  for (let i = 0; i < 10; i += 1) learner.observe({
    surfaceMode: 'paged', surfaceConfidence: 0.96,
    dominantTransitionConfirmed: true,
    ...(duplicateFlags ? { virtualTurnover: true, supplyStep: true } : {}),
  });
  return learner.getSnapshot();
}

export function evaluateFeedDom({ scenes, identities }) {
  if (!scenes.length || !identities.length) throw new Error('FEED_DOM_CORPUS_EMPTY');
  const results = [];
  const check = (checks, name, actual, expected) => checks.push({ name, actual, expected, passed: isDeepStrictEqual(actual, expected) });
  for (const scene of scenes) {
    const checks = [];
    try {
      // Oracle fields are deliberately stripped before calling measurement code.
      const { expected, id, ...input } = scene;
      const actual = measureScene(input);
      check(checks, 'independent item boundaries', actual.boundaries, expected.boundaries);
      check(checks, 'all geometrically exposed items', actual.visible, expected.visible);
      check(checks, 'supply uses the same boundaries', actual.fresh, expected.boundaries.length);
      for (const [item, fractions] of Object.entries(expected.fractions)) check(checks, `fractions:${item}`, actual.fractions[item], fractions);
      if (expected.contentClass) {
        check(checks, 'generic content class', actual.contentClass, expected.contentClass);
        check(checks, 'classifier uses the same boundaries', actual.classifierItemCount, expected.boundaries.length);
      }
      check(checks, 'geometry does not assert user progression', actual.limitations.includes('user_progression_unmeasured'), true);
      results.push({ id, status: checks.every((entry) => entry.passed) ? 'pass' : 'fail', checks, actual });
    } catch (error) { results.push({ id: scene.id, status: 'error', error: String(error), checks }); }
  }
  for (const scene of identities) {
    const checks = [];
    try {
      const { id, expectedFresh, ...input } = scene;
      check(checks, 'content versus node supply', measureIdentity(input), expectedFresh);
      results.push({ id, status: checks.every((entry) => entry.passed) ? 'pass' : 'fail', checks });
    } catch (error) { results.push({ id: scene.id, status: 'error', error: String(error), checks }); }
  }
  const single = measureEvidence(false);
  const duplicate = measureEvidence(true);
  const checks = [];
  check(checks, 'derived flags add no confidence', duplicate.confidence, single.confidence);
  check(checks, 'derived flags add no corroborating channels', duplicate.sampleCounts.corroboratingChannels, single.sampleCounts.corroboratingChannels);
  check(checks, 'one dynamic confirmation per record', single.sampleCounts.dynamicConfirmations, 10);
  check(checks, 'derived flags add no dynamic confirmations', duplicate.sampleCounts.dynamicConfirmations, single.sampleCounts.dynamicConfirmations);
  results.push({ id: 'correlated-evidence-invariance', status: checks.every((entry) => entry.passed) ? 'pass' : 'fail', checks });
  return { status: results.every((entry) => entry.status === 'pass') ? 'pass' : 'fail', results };
}
