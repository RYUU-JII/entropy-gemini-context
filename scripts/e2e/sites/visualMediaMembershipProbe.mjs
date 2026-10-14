import { evaluate } from '../extensionChromiumHarness.mjs';
import { performVisualShortFormContextProbe, createVisualShortFormContextContract } from './visualShortFormContextProbe.mjs';
import { createVisualRemovalCostContract } from './visualRemovalCostProbe.mjs';

// A controlled fixture inside the declared site-runtime owner. No product
// classifier imports, additional observers, browser launches, or media requests.
export async function performVisualMediaMembershipProbe(harness, page) {
  const membership = await evaluate(harness.cdp, page.sessionId, `(async () => {
    const fixtureId = 'entropy-qa-media-membership';
    if (document.getElementById(fixtureId)) throw new Error('MEDIA_MEMBERSHIP_FIXTURE_ALREADY_EXISTS');
    // Use the shipped thumbnail context without running a site's custom-element
    // connected/disconnected callbacks on the fixture's own child nodes.
    const card = document.createElement('div');
    card.className = 'entropy-qa-thumbnail';
    card.id = fixtureId;
    card.style.cssText = 'display:block;position:fixed;left:8px;top:8px;width:320px;height:360px;z-index:1000';
    const image = document.createElement('img');
    image.width = 320;
    image.height = 180;
    image.style.cssText = 'display:block;width:320px;height:180px;filter:sepia(0.4)';
    const plainSource = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="blue"/></svg>');
    // The shipped YouTube candidate contract includes this src substring.
    const candidateSource = plainSource + '#ytimg.com/vi/qa';
    image.src = candidateSource;
    const negative = image.cloneNode();
    negative.src = plainSource;
    card.append(image, negative);
    const checkpoints = {};
    const sample = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        blurApplied: /blur\\(/.test(getComputedStyle(element).filter),
        inlineFilter: element.style.filter,
        computedFilter: getComputedStyle(element).filter,
        connected: element.isConnected,
        width: rect.width,
        height: rect.height,
      };
    };
    const wait = async (name, expected, element = image) => {
      const started = performance.now();
      let snapshot;
      do {
        snapshot = sample(element);
        if (expected(snapshot)) { checkpoints[name] = snapshot; return; }
        await new Promise(resolve => setTimeout(resolve, 50));
      } while (performance.now() - started < 8000);
      checkpoints[name] = { ...snapshot, timedOut: true };
    };
    document.body.append(card);
    try {
      await wait('applied', s => s.blurApplied);
      checkpoints.negative = sample(negative);
      image.style.filter = 'contrast(1.4)';
      image.src = plainSource;
      await wait('revoked', s => !s.blurApplied);
      image.src = candidateSource;
      await wait('reapplied', s => s.blurApplied);
      card.remove();
      // Page-world getAnimations() did not enumerate the extension's effects
      // in the audited Chrome runs. Do not interpret [] as cancellation proof.
      // Allow the existing removal queue to settle, then inspect synchronously
      // on ineligible reattachment, before another mutation callback can repair it.
      await new Promise(resolve => setTimeout(resolve, 1500));
      image.src = plainSource;
      document.body.append(card);
      checkpoints.reattached = sample(image);
    } finally {
      card.remove();
    }
    return { status: 'performed', checkpoints, fixtureRemoved: !card.isConnected };
  })()`, { timeoutMs: 40_000 });
  return { ...membership, shortFormContexts: await performVisualShortFormContextProbe(harness, page) };
}

export function createVisualMediaMembershipContracts(actionResults = []) {
  return actionResults.filter(result => result.kind === 'visual_media_membership_probe').flatMap(result => {
    const { applied, negative, revoked, reapplied, reattached } = result.checkpoints || {};
    const active = sample => sample?.timedOut !== true && sample?.connected === true
      && sample?.blurApplied === true
      && typeof sample?.computedFilter === 'string'
      && sample?.width >= 320 && sample?.height >= 180;
    const cleared = sample => sample?.timedOut !== true
      && sample?.blurApplied === false;
    const passed = result.status === 'performed' && result.fixtureRemoved === true
      && active(applied) && applied.inlineFilter === 'sepia(0.4)'
      && applied.computedFilter.startsWith('sepia(0.4) ')
      && cleared(negative) && negative.connected === true
      && cleared(revoked) && revoked.connected === true
      && revoked.inlineFilter === 'contrast(1.4)' && revoked.computedFilter === 'contrast(1.4)'
      && active(reapplied) && reapplied.inlineFilter === 'contrast(1.4)'
      && reapplied.computedFilter.startsWith('contrast(1.4) ')
      && cleared(reattached) && reattached.connected === true
      && reattached.inlineFilter === 'contrast(1.4)' && reattached.computedFilter === 'contrast(1.4)';
    return [{
      id: 'visual_media_membership', status: passed ? 'PASS' : 'FAIL', evidence: result,
      message: 'Controlled YouTube media membership, host filter composition and no retained effect on ineligible reattachment.',
    }, createVisualShortFormContextContract(result.shortFormContexts),
    ...(result.removalCostRequired ? [createVisualRemovalCostContract(result.removalCost)] : [])];
  });
}
