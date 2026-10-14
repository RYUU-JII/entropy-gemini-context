#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  evaluate,
  ExtensionChromiumHarness,
  sleep,
} from './extensionChromiumHarness.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '../..');

const SITE_PROBES = Object.freeze({
  x: Object.freeze({
    siteId: 'x',
    url: 'https://x.com/home',
    candidateSelectors: Object.freeze([
      'main article[data-testid="tweet"]',
      'main article',
    ]),
  }),
  instagram: Object.freeze({
    siteId: 'instagram',
    url: 'https://www.instagram.com/',
    candidateSelectors: Object.freeze([
      'main[role="main"] article',
      'main article',
    ]),
  }),
  facebook: Object.freeze({
    siteId: 'facebook',
    url: 'https://www.facebook.com/',
    candidateSelectors: Object.freeze([
      '[role="main"] [role="feed"] [role="article"]',
      '[role="main"] [role="article"]',
    ]),
  }),
  youtube: Object.freeze({
    siteId: 'youtube',
    url: 'https://www.youtube.com/',
    candidateSelectors: Object.freeze([
      'ytd-rich-grid-renderer #contents '
        + '> ytd-rich-item-renderer:has(yt-lockup-view-model)',
    ]),
  }),
});

function parseBoundedInteger(value, code, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${code}:${String(value)}`);
  }
  return parsed;
}

export function parseContinuousFeedTopologyProbeArgs(argv) {
  const options = {
    sites: ['x', 'instagram', 'facebook'],
    profile: null,
    profileDirectory: null,
    chromePath: null,
    headless: true,
    settleMs: 5_000,
    scrollSteps: 3,
    stepSettleMs: 1_200,
  };
  for (const arg of argv) {
    if (arg.startsWith('--sites=')) {
      options.sites = arg.slice('--sites='.length).split(',').filter(Boolean);
    } else if (arg.startsWith('--site=')) {
      options.sites = [arg.slice('--site='.length)];
    } else if (arg.startsWith('--profile=')) {
      options.profile = arg.slice('--profile='.length);
    } else if (arg.startsWith('--profile-directory=')) {
      options.profileDirectory = arg.slice('--profile-directory='.length);
    } else if (arg.startsWith('--chrome=')) {
      options.chromePath = arg.slice('--chrome='.length);
    } else if (arg === '--headless') {
      options.headless = true;
    } else if (arg === '--headed') {
      options.headless = false;
    } else if (arg.startsWith('--settle-ms=')) {
      options.settleMs = parseBoundedInteger(
        arg.slice('--settle-ms='.length),
        'CONTINUOUS_FEED_TOPOLOGY_SETTLE_MS_INVALID',
        0,
        30_000,
      );
    } else if (arg.startsWith('--scroll-steps=')) {
      options.scrollSteps = parseBoundedInteger(
        arg.slice('--scroll-steps='.length),
        'CONTINUOUS_FEED_TOPOLOGY_SCROLL_STEPS_INVALID',
        0,
        12,
      );
    } else if (arg.startsWith('--step-settle-ms=')) {
      options.stepSettleMs = parseBoundedInteger(
        arg.slice('--step-settle-ms='.length),
        'CONTINUOUS_FEED_TOPOLOGY_STEP_SETTLE_MS_INVALID',
        0,
        10_000,
      );
    } else {
      throw new Error(`CONTINUOUS_FEED_TOPOLOGY_ARGUMENT_UNKNOWN:${arg}`);
    }
  }
  if (!options.profile || !path.isAbsolute(options.profile)) {
    throw new Error('CONTINUOUS_FEED_TOPOLOGY_QA_PROFILE_ABSOLUTE_REQUIRED');
  }
  if (!options.chromePath || !path.isAbsolute(options.chromePath)) {
    throw new Error('CONTINUOUS_FEED_TOPOLOGY_CHROME_ABSOLUTE_REQUIRED');
  }
  if (
    options.profileDirectory !== null
    && (
      !options.profileDirectory.trim()
      || options.profileDirectory !== options.profileDirectory.trim()
    )
  ) {
    throw new Error('CONTINUOUS_FEED_TOPOLOGY_PROFILE_DIRECTORY_INVALID');
  }
  if (options.sites.length === 0 || new Set(options.sites).size !== options.sites.length) {
    throw new Error('CONTINUOUS_FEED_TOPOLOGY_SITES_INVALID');
  }
  options.sites.forEach((siteId) => {
    if (!SITE_PROBES[siteId]) {
      throw new Error(`CONTINUOUS_FEED_TOPOLOGY_SITE_UNSUPPORTED:${siteId}`);
    }
  });
  return {
    ...options,
    profile: path.normalize(options.profile),
    chromePath: path.normalize(options.chromePath),
  };
}

function collectContinuousFeedTopology(config) {
  const isElement = (value) => value instanceof Element;
  const readRect = (node) => {
    if (!isElement(node)) return null;
    const rect = node.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  };
  const describe = (node) => {
    if (!isElement(node)) return null;
    const rect = readRect(node);
    const style = getComputedStyle(node);
    return {
      tagName: node.tagName,
      id: node.id || null,
      role: node.getAttribute('role'),
      dataTestId: node.getAttribute('data-testid'),
      ariaLabelPresent: node.hasAttribute('aria-label'),
      className: typeof node.className === 'string'
        ? node.className.trim().split(/\s+/u).filter(Boolean).slice(0, 6)
        : [],
      childElementCount: node.childElementCount,
      rect,
      display: style.display,
      flexDirection: style.flexDirection,
      flexWrap: style.flexWrap,
      position: style.position,
      overflowY: style.overflowY,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    };
  };
  const directChildWithin = (parent, node) => {
    if (!isElement(parent) || !isElement(node) || !parent.contains(node)) return null;
    let cursor = node;
    while (cursor.parentElement && cursor.parentElement !== parent) cursor = cursor.parentElement;
    return cursor.parentElement === parent ? cursor : null;
  };
  const lowestCommonAncestor = (left, right) => {
    const ancestors = new Set();
    let cursor = left;
    while (isElement(cursor)) {
      ancestors.add(cursor);
      cursor = cursor.parentElement;
    }
    cursor = right;
    while (isElement(cursor)) {
      if (ancestors.has(cursor)) return cursor;
      cursor = cursor.parentElement;
    }
    return null;
  };
  const uniqueOutermost = (nodes) => nodes.filter((node, index, all) => (
    isElement(node)
    && node.isConnected
    && !all.some((other, otherIndex) => (
      otherIndex !== index
      && isElement(other)
      && other.contains(node)
    ))
  ));
  const collectCandidates = () => {
    for (const selector of config.candidateSelectors) {
      const candidates = uniqueOutermost(Array.from(document.querySelectorAll(selector)));
      if (candidates.length > 0) return { selector, candidates };
    }
    return { selector: config.candidateSelectors[0], candidates: [] };
  };
  const { selector, candidates } = collectCandidates();
  const viewportCandidates = candidates
    .map((candidate) => ({ candidate, rect: readRect(candidate) }))
    .filter(({ rect }) => (
      rect
      && rect.width > 0
      && rect.height > 0
      && rect.bottom > -window.innerHeight
      && rect.top < window.innerHeight * 3
    ))
    .sort((left, right) => left.rect.top - right.rect.top);
  let lane = null;
  let anchor = null;
  for (let index = 0; index < viewportCandidates.length - 1; index += 1) {
    const left = viewportCandidates[index].candidate;
    const right = viewportCandidates[index + 1].candidate;
    const candidateLane = lowestCommonAncestor(left, right);
    if (
      !isElement(candidateLane)
      || candidateLane === document.body
      || candidateLane === document.documentElement
    ) continue;
    const leftBranch = directChildWithin(candidateLane, left);
    const rightBranch = directChildWithin(candidateLane, right);
    if (leftBranch && rightBranch && leftBranch !== rightBranch) {
      lane = candidateLane;
      anchor = left;
      break;
    }
  }
  if (!anchor && viewportCandidates.length > 0) {
    anchor = viewportCandidates.find(({ rect }) => rect.bottom > 0)?.candidate
      || viewportCandidates[0].candidate;
  }
  const anchorBranch = lane && anchor ? directChildWithin(lane, anchor) : null;
  const laneChildren = lane ? Array.from(lane.children) : [];
  const anchorBranchIndex = anchorBranch ? laneChildren.indexOf(anchorBranch) : -1;
  const followingBranches = anchorBranchIndex >= 0
    ? laneChildren.slice(anchorBranchIndex + 1)
    : [];
  const laneDirectTagCounts = Object.fromEntries(
    Array.from(laneChildren.reduce((counts, child) => {
      counts.set(child.tagName, (counts.get(child.tagName) || 0) + 1);
      return counts;
    }, new Map()).entries()).sort(([left], [right]) => left.localeCompare(right)),
  );
  const candidateRows = Array.from(viewportCandidates.reduce((rows, entry) => {
    const rowTop = Math.round(entry.rect.top / 4) * 4;
    const row = rows.get(rowTop) || { top: rowTop, count: 0 };
    row.count += 1;
    rows.set(rowTop, row);
    return rows;
  }, new Map()).values()).sort((left, right) => left.top - right.top);
  const ancestry = [];
  let cursor = anchor;
  for (let depth = 0; isElement(cursor) && depth < 18; depth += 1) {
    ancestry.push(describe(cursor));
    cursor = cursor.parentElement;
  }
  let scroller = anchor;
  while (isElement(scroller)) {
    const style = getComputedStyle(scroller);
    const scrollable = /^(?:auto|scroll)$/u.test(style.overflowY)
      && scroller.scrollHeight > scroller.clientHeight + 1;
    if (scrollable) break;
    scroller = scroller.parentElement;
  }
  if (!isElement(scroller)) scroller = document.scrollingElement;
  const loginSignals = {
    passwordInput: document.querySelectorAll('input[type="password"]').length,
    loginForm: document.querySelectorAll('form[action*="login"], form[data-testid*="login"]').length,
  };
  return {
    siteId: config.siteId,
    path: location.pathname,
    timeOrigin: performance.timeOrigin,
    readyState: document.readyState,
    visibilityState: document.visibilityState,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollY: Math.round(window.scrollY),
    },
    loginSignals,
    candidateSelector: selector,
    candidateCount: candidates.length,
    viewportCandidateCount: viewportCandidates.length,
    candidateRects: viewportCandidates.slice(0, 12).map(({ rect }) => rect),
    anchor: describe(anchor),
    anchorBranch: describe(anchorBranch),
    anchorBranchIndex,
    lane: describe(lane),
    laneCandidateCount: lane
      ? candidates.filter((candidate) => lane.contains(candidate)).length
      : 0,
    laneDirectTagCounts,
    candidateRows,
    followingBranchCount: followingBranches.length,
    followingBranches: followingBranches.slice(0, 12).map(describe),
    scroller: describe(scroller),
    ancestry,
  };
}

function advanceContinuousFeedTopologyProbe() {
  const root = document.scrollingElement;
  const distance = Math.max(320, Math.round(window.innerHeight * 0.82));
  if (root) root.scrollBy({ top: distance, behavior: 'instant' });
  else window.scrollBy({ top: distance, behavior: 'instant' });
  return {
    distance,
    scrollY: Math.round(window.scrollY),
    rootScrollTop: Math.round(Number(root?.scrollTop) || 0),
  };
}

async function readTopology(harness, page, site) {
  return evaluate(
    harness.cdp,
    page.sessionId,
    `(${collectContinuousFeedTopology.toString()})(${JSON.stringify(site)})`,
    { timeoutMs: 10_000 },
  );
}

export async function runContinuousFeedTopologyProbe(options) {
  const harness = new ExtensionChromiumHarness({
    chromePath: options.chromePath,
    distDir: '.',
    rootDir,
    headless: options.headless,
    keepTemp: false,
    qaProfileDir: options.profile,
    qaProfileDirectory: options.profileDirectory,
    extensionEnabled: false,
    tempPrefix: 'entropy-continuous-feed-topology-',
  });
  const results = [];
  try {
    await harness.start();
    for (const siteId of options.sites) {
      const site = SITE_PROBES[siteId];
      const page = await harness.openPage(site.url, {
        active: false,
        timeoutMs: 45_000,
      });
      await sleep(options.settleMs);
      const before = await readTopology(harness, page, site);
      const steps = [];
      for (let index = 0; index < options.scrollSteps; index += 1) {
        const advance = await evaluate(
          harness.cdp,
          page.sessionId,
          `(${advanceContinuousFeedTopologyProbe.toString()})()`,
          { timeoutMs: 5_000 },
        );
        await sleep(options.stepSettleMs);
        steps.push({
          advance,
          topology: await readTopology(harness, page, site),
        });
      }
      results.push({
        siteId,
        muted: true,
        headless: options.headless,
        browserProcessPolicy: 'single_process',
        profileDirectory: options.profileDirectory,
        before,
        steps,
      });
      await harness.closePage(page);
    }
    return {
      status: 'PASS',
      muted: true,
      headless: options.headless,
      browserProcessPolicy: 'single_process',
      profileDirectory: options.profileDirectory,
      results,
    };
  } finally {
    await harness.close();
  }
}

async function main() {
  const options = parseContinuousFeedTopologyProbeArgs(process.argv.slice(2));
  const result = await runContinuousFeedTopologyProbe(options);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
