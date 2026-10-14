import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  listQaCdpTargets,
} from '../../browser-qa/browser/cdpTargetOwner.mjs';
import {
  verifyAttachedBrowserIdentity,
} from '../../browser-qa/browser/attachedBrowserIdentity.mjs';
import { CdpConnection } from '../../browser-qa/cdp/CdpConnection.mjs';
import {
  probePersistentBrowserCdp,
} from '../../browser-qa/lifecycle/persistentBrowserLifecycle.mjs';
import {
  acquireBrowserCapacity,
} from '../../browser-qa/resources/BrowserCapacityLease.mjs';
import {
  resolveBrowserQaPhysicalResourceIdentities,
} from '../../browser-qa/resources/browserResourceScope.mjs';
import {
  ExtensionChromiumHarness,
  evaluate,
} from '../../e2e/extensionChromiumHarness.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';

export const YOUTUBE_SELECTOR_DRIFT_CORPUS_CONTRACT_VERSION = 1;

const PROTOCOL_SCOPE = 'youtube_selector_drift_independent_candidate_corpus';
const COLLECTION_POLICY = 'read_only_bounded_redacted_human_review_required';
const EXISTING_TARGET_POLICY = 'unique_existing_route_attach_evaluate_detach';
const CDP_COMMAND_TIMEOUT_MS = 8_000;
const CDP_DETACH_TIMEOUT_MS = 1_000;
const STABILIZATION_QUIET_MS = 500;
const STABILIZATION_TIMEOUT_MS = 6_000;
const YOUTUBE_HOSTNAME = 'www.youtube.com';
const SURFACE_VALUES = Object.freeze(['watch', 'shorts']);
const LOCALE_VALUES = Object.freeze(['en', 'ko']);
const REMOVED_SENSITIVE_FIELDS = Object.freeze([
  'account_identity',
  'automatic_profile_write',
  'comment_text',
  'content_titles',
  'cookies',
  'experiment_flags',
  'full_page_html',
  'product_generated_selector',
  'raw_accessible_label',
  'raw_url_query_or_fragment',
  'svg_path_d',
  'ytcfg',
]);

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isPlainRecord(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function sameStrings(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function requireEnum(value, values, code) {
  if (!values.includes(value)) fail(code, value || 'missing');
  return value;
}

function requireProtocolOptions(plan) {
  const options = plan?.protocolOptions;
  if (
    !isPlainRecord(options)
    || options.scope !== PROTOCOL_SCOPE
    || options.collectionPolicy !== COLLECTION_POLICY
    || options.productDetectorInfluence !== false
    || options.profileWritePolicy !== 'forbidden'
    || options.existingTargetPolicy !== EXISTING_TARGET_POLICY
  ) {
    fail('QA_YOUTUBE_SELECTOR_CORPUS_PROTOCOL_OPTIONS_INVALID');
  }
  return options;
}

function parseYoutubeRoute(value) {
  if (typeof value !== 'string' || !value) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname !== YOUTUBE_HOSTNAME
    || parsed.username
    || parsed.password
    || parsed.port
  ) return null;
  if (parsed.pathname === '/watch') return 'watch';
  if (/^\/shorts\/[^/]+\/?$/u.test(parsed.pathname)) return 'shorts';
  return null;
}

export function resolveYoutubeSelectorCorpusPublicUrl({ surface, locale }) {
  requireEnum(surface, SURFACE_VALUES, 'QA_YOUTUBE_SELECTOR_CORPUS_SURFACE_INVALID');
  requireEnum(locale, LOCALE_VALUES, 'QA_YOUTUBE_SELECTOR_CORPUS_LOCALE_INVALID');
  const localeParams = locale === 'ko' ? 'hl=ko&gl=KR' : 'hl=en&gl=US';
  return surface === 'watch'
    ? `https://${YOUTUBE_HOSTNAME}/watch?v=jNQXAC9IVRw&${localeParams}`
    : `https://${YOUTUBE_HOSTNAME}/shorts/3_YhyeHjOWI?${localeParams}`;
}

function projectPageTargetSet(targets) {
  if (!Array.isArray(targets)) fail('QA_YOUTUBE_SELECTOR_CORPUS_TARGETS_INVALID');
  const pages = targets
    .filter((target) => target?.type === 'page')
    .map((target) => {
      if (typeof target.targetId !== 'string' || !target.targetId) {
        fail('QA_YOUTUBE_SELECTOR_CORPUS_TARGETS_INVALID');
      }
      return Object.freeze({
        targetId: target.targetId,
        url: typeof target.url === 'string' ? target.url : '',
      });
    })
    .sort((left, right) => left.targetId.localeCompare(right.targetId));
  return Object.freeze({
    count: pages.length,
    digest: sha256Json(pages),
    pages: Object.freeze(pages),
  });
}

export function selectUniqueExistingYoutubeTarget(targets, surface) {
  requireEnum(surface, SURFACE_VALUES, 'QA_YOUTUBE_SELECTOR_CORPUS_SURFACE_INVALID');
  const inventory = projectPageTargetSet(targets);
  const matches = inventory.pages.filter((target) => parseYoutubeRoute(target.url) === surface);
  if (matches.length === 0) {
    const error = new Error(
      'QA_ATTACHED_BROWSER_YOUTUBE_SELECTOR_CORPUS_EXISTING_TARGET_REQUIRED',
    );
    error.code = 'QA_ATTACHED_BROWSER_YOUTUBE_SELECTOR_CORPUS_EXISTING_TARGET_REQUIRED';
    error.nextAction = `open_one_youtube_${surface}_tab_in_declared_qa_browser_then_retry`;
    throw error;
  }
  if (matches.length !== 1) {
    fail(
      'QA_ATTACHED_BROWSER_YOUTUBE_SELECTOR_CORPUS_EXISTING_TARGET_AMBIGUOUS',
      matches.length,
    );
  }
  return Object.freeze({ inventory, target: matches[0] });
}

export function createYoutubeSelectorCorpusStabilizationSource({
  quietMs = STABILIZATION_QUIET_MS,
  timeoutMs = STABILIZATION_TIMEOUT_MS,
} = {}) {
  if (!Number.isSafeInteger(quietMs) || quietMs < 100 || quietMs > 2_000) {
    fail('QA_YOUTUBE_SELECTOR_CORPUS_QUIET_WINDOW_INVALID', quietMs);
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= quietMs || timeoutMs > 15_000) {
    fail('QA_YOUTUBE_SELECTOR_CORPUS_STABILIZATION_TIMEOUT_INVALID', timeoutMs);
  }
  return `(() => new Promise((resolve) => {
    const quietMs = ${quietMs};
    const timeoutMs = ${timeoutMs};
    const startedAt = performance.now();
    let mutationCount = 0;
    let quietTimer = null;
    let deadlineTimer = null;
    const finish = (state) => {
      observer.disconnect();
      clearTimeout(quietTimer);
      clearTimeout(deadlineTimer);
      resolve({ state, mutationCount, elapsedMs: Math.round(performance.now() - startedAt) });
    };
    const armQuiet = () => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => finish('quiet'), quietMs);
    };
    const observer = new MutationObserver((records) => {
      mutationCount += records.length;
      armQuiet();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    deadlineTimer = setTimeout(() => finish('deadline'), timeoutMs);
    armQuiet();
  }))()`;
}

export function createYoutubeSelectorCorpusCaptureSource() {
  return `(() => {
    const contractVersion = ${YOUTUBE_SELECTOR_DRIFT_CORPUS_CONTRACT_VERSION};
    const removedSensitiveFields = ${JSON.stringify(REMOVED_SENSITIVE_FIELDS)};
    const actionPatterns = [
      ['dislike', /(?:^|\\s)(?:dislike|싫어요|낮게 평가)(?:$|\\s|\\d)/iu],
      ['like', /(?:^|\\s)(?:like|liked|좋아요|높게 평가)(?:$|\\s|\\d)/iu],
      ['comment', /(?:^|\\s)(?:comments?|댓글)(?:$|\\s|\\d)/iu],
      ['share', /(?:^|\\s)(?:share|공유)(?:$|\\s|\\d)/iu],
      ['save', /(?:^|\\s)(?:save|저장)(?:$|\\s|\\d)/iu],
    ];
    const countPattern = /^(?:조회수\\s*)?[\\d,.]+(?:\\.[\\d]+)?\\s*(?:천|만|억|k|m|b)?\\s*(?:회|명|개|views?)?$/iu;
    const timePattern = /^(?:\\d+\\s*(?:초|분|시간|일|주|개월|년)\\s*전|\\d+\\s*(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\\s+ago)$/iu;
    const separatorPattern = /^[\\s·•|,]+$/u;
    const tokenShape = (value) => String(value || '')
      .replace(/[0-9]/gu, '#')
      .replace(/\\s+/gu, ' ')
      .trim()
      .slice(0, 64);
    const actionIdentity = (node) => {
      const label = [
        node.getAttribute?.('aria-label'),
        node.getAttribute?.('title'),
        node.getAttribute?.('data-tooltip-text'),
      ].filter(Boolean).join(' ');
      return actionPatterns.find(([, pattern]) => pattern.test(label))?.[0] || null;
    };
    const componentIdentity = (node) => {
      if (!(node instanceof Element)) return null;
      if (node.matches('like-button-view-model, ytd-like-button-renderer')) return 'like';
      if (node.matches('dislike-button-view-model, ytd-dislike-button-renderer')) return 'dislike';
      return null;
    };
    const safeText = (value) => {
      const text = String(value || '').replace(/\\s+/gu, ' ').trim();
      if (!text) return null;
      if (separatorPattern.test(text)) return { node: 'text', kind: 'separator', value: text.slice(0, 8) };
      if (timePattern.test(text) && text.length <= 64) return { node: 'text', kind: 'time_shape', value: tokenShape(text) };
      if (countPattern.test(text) && text.length <= 64) return { node: 'text', kind: 'metric_shape', value: tokenShape(text) };
      return { node: 'text', kind: 'redacted_content', value: '[REDACTED]' };
    };
    const safeAttributes = (node) => {
      const attributes = {};
      if (node.id && /^[A-Za-z0-9_-]{1,80}$/u.test(node.id)) attributes.idToken = node.id;
      const classTokens = Array.from(node.classList || [])
        .filter((token) => /^[A-Za-z0-9_-]{1,80}$/u.test(token))
        .slice(0, 12);
      if (classTokens.length > 0) attributes.classTokens = classTokens;
      for (const name of ['role', 'aria-hidden', 'hidden', 'is']) {
        if (node.hasAttribute(name)) attributes[name] = node.getAttribute(name);
      }
      if (node.hasAttribute('href')) attributes.linkPresent = true;
      const identity = actionIdentity(node);
      if (identity) {
        const rawLabel = String(
          node.getAttribute('aria-label') || node.getAttribute('title') || '',
        );
        const count = rawLabel.match(/[\\d,.]+(?:\\.[\\d]+)?\\s*(?:천|만|억|k|m|b)?/iu)?.[0] || '';
        attributes.actionLabel = {
          identity,
          locale: /[가-힣]/u.test(rawLabel) ? 'ko' : 'en',
          countShape: count ? tokenShape(count) : null,
        };
      }
      return attributes;
    };
    const serialize = (root) => {
      let nodeCount = 0;
      const visit = (node, depth) => {
        if (nodeCount >= 96 || depth > 6) return null;
        nodeCount += 1;
        if (node.nodeType === Node.TEXT_NODE) return safeText(node.nodeValue);
        if (!(node instanceof Element)) return null;
        if (node instanceof SVGElement) {
          return { node: 'element', tag: 'svg', attrs: { pathData: '[REDACTED]' }, children: [] };
        }
        const children = [];
        for (const child of node.childNodes) {
          const serialized = visit(child, depth + 1);
          if (serialized) children.push(serialized);
          if (nodeCount >= 96) break;
        }
        return {
          node: 'element',
          tag: node.localName,
          attrs: safeAttributes(node),
          children,
        };
      };
      return { tree: visit(root, 0), nodeCount };
    };
    const roots = [];
    const seen = new Set();
    const addRoot = (root, role) => {
      if (!(root instanceof Element) || seen.has(root) || roots.length >= 8) return;
      seen.add(root);
      roots.push({ root, role });
    };
    for (const node of document.querySelectorAll(
      'ytd-watch-info-text, ytd-video-view-count-renderer, ytd-watch-metadata',
    )) addRoot(node, 'watch_metadata');
    for (const node of document.querySelectorAll(
      'like-button-view-model, dislike-button-view-model, ytd-like-button-renderer, ytd-dislike-button-renderer, ytd-shorts-player-controls',
    )) addRoot(node, 'action_cluster');
    for (const node of document.querySelectorAll('[aria-label], [title], [data-tooltip-text]')) {
      if (!actionIdentity(node)) continue;
      addRoot(node.closest(
        'yt-player-quick-action-buttons, ytd-segmented-like-dislike-button-renderer, #top-level-buttons-computed, ytd-menu-renderer, ytd-reel-video-renderer, ytd-shorts-player-controls',
      ) || node.parentElement?.parentElement || node.parentElement || node, 'action_cluster');
    }
    const surfaces = roots.map(({ root, role }, index) => {
      const serialized = serialize(root);
      const actionIdentities = Array.from(new Set(
        [root, ...root.querySelectorAll(
          '[aria-label], [title], [data-tooltip-text], like-button-view-model, dislike-button-view-model, ytd-like-button-renderer, ytd-dislike-button-renderer',
        )]
          .flatMap((node) => [componentIdentity(node), actionIdentity(node)])
          .filter(Boolean),
      )).sort();
      return {
        surfaceId: 'surface-' + (index + 1),
        role,
        actionIdentities,
        nodeCount: serialized.nodeCount,
        tree: serialized.tree,
      };
    });
    const routeKind = location.pathname === '/watch'
      ? 'watch'
      : location.pathname.startsWith('/shorts/')
        ? 'shorts'
        : 'other';
    return {
      contractVersion,
      hostname: location.hostname,
      routeKind,
      locale: String(document.documentElement.lang || '').trim().toLowerCase() || null,
      readyState: document.readyState,
      signedIn: Boolean(document.querySelector('ytd-topbar-menu-button-renderer #avatar-btn')),
      surfaceCounts: {
        total: surfaces.length,
        actionCluster: surfaces.filter((surface) => surface.role === 'action_cluster').length,
        watchMetadata: surfaces.filter((surface) => surface.role === 'watch_metadata').length,
      },
      surfaces,
      removedSensitiveFields,
    };
  })()`;
}

function validateTree(node, depth = 0) {
  if (!isPlainRecord(node) || depth > 7) {
    fail('QA_YOUTUBE_SELECTOR_CORPUS_TREE_INVALID');
  }
  if (node.node === 'text') {
    if (
      !['separator', 'time_shape', 'metric_shape', 'redacted_content'].includes(node.kind)
      || typeof node.value !== 'string'
      || node.value.length > 64
    ) fail('QA_YOUTUBE_SELECTOR_CORPUS_TREE_INVALID');
    return;
  }
  if (
    node.node !== 'element'
    || typeof node.tag !== 'string'
    || !node.tag
    || !isPlainRecord(node.attrs)
    || !Array.isArray(node.children)
    || node.children.length > 96
  ) fail('QA_YOUTUBE_SELECTOR_CORPUS_TREE_INVALID');
  const allowedAttributeKeys = [
    'actionLabel',
    'aria-hidden',
    'classTokens',
    'hidden',
    'idToken',
    'is',
    'linkPresent',
    'pathData',
    'role',
  ];
  if (Object.keys(node.attrs).some((key) => !allowedAttributeKeys.includes(key))) {
    fail('QA_YOUTUBE_SELECTOR_CORPUS_TREE_INVALID');
  }
  if (
    Object.hasOwn(node.attrs, 'idToken')
    && (
      typeof node.attrs.idToken !== 'string'
      || !/^[A-Za-z0-9_-]{1,80}$/u.test(node.attrs.idToken)
    )
  ) fail('QA_YOUTUBE_SELECTOR_CORPUS_TREE_INVALID');
  if (
    Object.hasOwn(node.attrs, 'classTokens')
    && (
      !Array.isArray(node.attrs.classTokens)
      || node.attrs.classTokens.length > 12
      || node.attrs.classTokens.some((token) => (
        typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/u.test(token)
      ))
    )
  ) fail('QA_YOUTUBE_SELECTOR_CORPUS_TREE_INVALID');
  if (
    Object.hasOwn(node.attrs, 'linkPresent')
    && node.attrs.linkPresent !== true
  ) fail('QA_YOUTUBE_SELECTOR_CORPUS_TREE_INVALID');
  if (
    Object.hasOwn(node.attrs, 'pathData')
    && node.attrs.pathData !== '[REDACTED]'
  ) fail('QA_YOUTUBE_SELECTOR_CORPUS_TREE_INVALID');
  if (Object.hasOwn(node.attrs, 'actionLabel')) {
    const label = node.attrs.actionLabel;
    if (
      !isPlainRecord(label)
      || !sameStrings(
        Object.keys(label).sort(),
        ['countShape', 'identity', 'locale'],
      )
      || !['comment', 'dislike', 'like', 'save', 'share'].includes(label.identity)
      || !LOCALE_VALUES.includes(label.locale)
      || (
        label.countShape !== null
        && (typeof label.countShape !== 'string' || label.countShape.length > 64)
      )
    ) fail('QA_YOUTUBE_SELECTOR_CORPUS_TREE_INVALID');
  }
  node.children.forEach((child) => validateTree(child, depth + 1));
}

export function validateYoutubeSelectorCorpusCapture(capture) {
  const exactKeys = [
    'contractVersion',
    'hostname',
    'locale',
    'readyState',
    'removedSensitiveFields',
    'routeKind',
    'signedIn',
    'surfaceCounts',
    'surfaces',
  ];
  if (
    !isPlainRecord(capture)
    || !sameStrings(Object.keys(capture).sort(), exactKeys.sort())
    || capture.contractVersion !== YOUTUBE_SELECTOR_DRIFT_CORPUS_CONTRACT_VERSION
    || capture.hostname !== YOUTUBE_HOSTNAME
    || !['watch', 'shorts', 'other'].includes(capture.routeKind)
    || !['interactive', 'complete'].includes(capture.readyState)
    || typeof capture.signedIn !== 'boolean'
    || !isPlainRecord(capture.surfaceCounts)
    || !sameStrings(
      Object.keys(capture.surfaceCounts).sort(),
      ['actionCluster', 'total', 'watchMetadata'],
    )
    || !Array.isArray(capture.surfaces)
    || capture.surfaces.length > 8
    || !sameStrings(capture.removedSensitiveFields, REMOVED_SENSITIVE_FIELDS)
  ) fail('QA_YOUTUBE_SELECTOR_CORPUS_CAPTURE_INVALID');
  capture.surfaces.forEach((surface) => {
    if (
      !isPlainRecord(surface)
      || !sameStrings(
        Object.keys(surface).sort(),
        ['actionIdentities', 'nodeCount', 'role', 'surfaceId', 'tree'],
      )
      || !/^surface-[1-8]$/u.test(surface.surfaceId)
      || !['action_cluster', 'watch_metadata'].includes(surface.role)
      || !Array.isArray(surface.actionIdentities)
      || surface.actionIdentities.some((identity) => (
        !['comment', 'dislike', 'like', 'save', 'share'].includes(identity)
      ))
      || !Number.isSafeInteger(surface.nodeCount)
      || surface.nodeCount < 1
      || surface.nodeCount > 96
    ) fail('QA_YOUTUBE_SELECTOR_CORPUS_SURFACE_INVALID');
    validateTree(surface.tree);
  });
  if (
    capture.surfaceCounts.total !== capture.surfaces.length
    || capture.surfaceCounts.actionCluster !== capture.surfaces.filter(
      (surface) => surface.role === 'action_cluster',
    ).length
    || capture.surfaceCounts.watchMetadata !== capture.surfaces.filter(
      (surface) => surface.role === 'watch_metadata',
    ).length
  ) fail('QA_YOUTUBE_SELECTOR_CORPUS_COUNTS_INVALID');
  return capture;
}

export function classifyYoutubeSelectorCorpusCapture(capture, {
  requestedSurface,
  requestedLocale = null,
  requireSignedIn = false,
} = {}) {
  validateYoutubeSelectorCorpusCapture(capture);
  requireEnum(
    requestedSurface,
    SURFACE_VALUES,
    'QA_YOUTUBE_SELECTOR_CORPUS_SURFACE_INVALID',
  );
  if (requestedLocale !== null) {
    requireEnum(
      requestedLocale,
      LOCALE_VALUES,
      'QA_YOUTUBE_SELECTOR_CORPUS_LOCALE_INVALID',
    );
  }
  const routeMatches = capture.routeKind === requestedSurface;
  const localeMatches = requestedLocale === null
    || capture.locale === requestedLocale
    || capture.locale?.startsWith(`${requestedLocale}-`) === true;
  const authenticationMatches = requireSignedIn === false || capture.signedIn === true;
  const observedActionIdentities = new Set(
    capture.surfaces.flatMap((surface) => surface.actionIdentities),
  );
  const requiredActionObserved = observedActionIdentities.has('like');
  const opportunityObserved = requestedSurface === 'watch'
    ? capture.surfaceCounts.watchMetadata > 0
      && capture.surfaceCounts.actionCluster > 0
      && requiredActionObserved
    : capture.surfaceCounts.actionCluster > 0 && requiredActionObserved;
  const complete = routeMatches
    && localeMatches
    && authenticationMatches
    && opportunityObserved;
  return Object.freeze({
    status: complete ? QA_RUN_STATUSES.PASS : QA_RUN_STATUSES.INCONCLUSIVE,
    complete,
    routeMatches,
    localeMatches,
    authenticationMatches,
    requiredActionObserved,
    opportunityObserved,
  });
}

async function collectCapture(cdp, sessionId) {
  const stabilization = await evaluate(
    cdp,
    sessionId,
    createYoutubeSelectorCorpusStabilizationSource(),
    { timeoutMs: STABILIZATION_TIMEOUT_MS + 1_000 },
  );
  if (
    !isPlainRecord(stabilization)
    || !['quiet', 'deadline'].includes(stabilization.state)
    || !Number.isSafeInteger(stabilization.mutationCount)
    || stabilization.mutationCount < 0
  ) fail('QA_YOUTUBE_SELECTOR_CORPUS_STABILIZATION_INVALID');
  const capture = await evaluate(
    cdp,
    sessionId,
    createYoutubeSelectorCorpusCaptureSource(),
    { awaitPromise: false, timeoutMs: CDP_COMMAND_TIMEOUT_MS },
  );
  validateYoutubeSelectorCorpusCapture(capture);
  return Object.freeze({ stabilization: Object.freeze(stabilization), capture });
}

async function runOwnedCapture({ plan, browser }) {
  if (
    plan.browserExecution?.processOwnership !== 'owned'
    || plan.browserExecution.extensionRuntime !== 'none'
    || browser?.processOwnership !== 'owned'
    || typeof browser.chrome !== 'string'
  ) fail('QA_YOUTUBE_SELECTOR_CORPUS_OWNED_BROWSER_REQUIRED');
  const harness = new ExtensionChromiumHarness({
    chromePath: browser.chrome,
    distDir: '.',
    rootDir: plan.rootDir,
    headless: plan.browserExecution.headless,
    browserExecution: plan.browserExecution,
    audioPolicy: plan.browserExecution.audioPolicy,
    renderingRequirement: plan.browserExecution.renderingRequirement,
    keepTemp: false,
    qaProfileDir: null,
    tempPrefix: 'entropy-youtube-selector-corpus-',
    extensionEnabled: false,
    launchEnvironment: browser.launchEnvironment,
  });
  let page = null;
  try {
    await harness.start();
    page = await harness.openPage('about:blank', { active: true, timeoutMs: 45_000 });
    const locale = plan.parameters.locale === 'ko' ? 'ko-KR' : 'en-US';
    await harness.cdp.send('Network.enable', {}, page.sessionId, {
      timeoutMs: CDP_COMMAND_TIMEOUT_MS,
    });
    await harness.cdp.send('Network.setExtraHTTPHeaders', {
      headers: {
        'Accept-Language': plan.parameters.locale === 'ko'
          ? 'ko-KR,ko;q=0.9,en;q=0.5'
          : 'en-US,en;q=0.9',
      },
    }, page.sessionId, { timeoutMs: CDP_COMMAND_TIMEOUT_MS });
    await harness.cdp.send('Emulation.setLocaleOverride', { locale }, page.sessionId, {
      timeoutMs: CDP_COMMAND_TIMEOUT_MS,
    });
    await harness.navigatePage(page, resolveYoutubeSelectorCorpusPublicUrl({
      surface: plan.parameters.surface,
      locale: plan.parameters.locale,
    }), { timeoutMs: 45_000 });
    const evidence = await collectCapture(harness.cdp, page.sessionId);
    return Object.freeze({
      ...evidence,
      browserProduct: harness.browserVersion?.Browser || null,
      cleanup: Object.freeze({
        processAction: 'owned_browser_close',
        targetOwnership: 'protocol_owned',
        targetCreationCount: 1,
        targetNavigationCount: 1,
        osFocusRequestIssued: false,
      }),
    });
  } finally {
    await harness.close();
  }
}

async function runAttachedCapture({
  plan,
  browser,
  probeBrowser = probePersistentBrowserCdp,
  verifyBrowserIdentity = verifyAttachedBrowserIdentity,
  capacityFactory = acquireBrowserCapacity,
  cdpFactory = (webSocketUrl) => new CdpConnection(webSocketUrl, {
    requestTimeoutMs: CDP_COMMAND_TIMEOUT_MS,
  }),
  listTargets = listQaCdpTargets,
} = {}) {
  if (
    plan.browserExecution?.processOwnership !== 'attach_only'
    || plan.browserExecution.extensionRuntime !== 'none'
    || plan.browserExecution.documentVisibility !== 'background_allowed'
    || plan.browserExecution.targetActivation !== 'background'
    || plan.browserExecution.osFocus !== 'never'
    || browser?.processOwnership !== 'attach_only'
    || browser.browserClass !== 'managed_persistent'
    || browser.browserIdentity?.status !== 'declared_identity_verified'
  ) fail('QA_YOUTUBE_SELECTOR_CORPUS_ATTACHED_BROWSER_REQUIRED');
  const capacity = await capacityFactory({
    rootDir: plan.rootDir,
    ownerId: `${plan.runId}:youtube-selector-corpus`,
    browserResourceIdentities: resolveBrowserQaPhysicalResourceIdentities({
      cdpEndpoint: browser.cdpEndpoint,
      userDataDir: browser.profile,
      profileDirectory: browser.profileDirectory,
    }),
  });
  let cdp = null;
  let sessionId = null;
  let primaryError = null;
  let baseline = null;
  let finalInventory = null;
  try {
    const probe = await probeBrowser(browser.cdpEndpoint);
    if (
      probe?.status !== 'ready'
      || typeof probe.browserEpoch !== 'string'
      || typeof probe.webSocketDebuggerUrl !== 'string'
    ) fail('QA_CDP_UNAVAILABLE');
    cdp = cdpFactory(probe.webSocketDebuggerUrl);
    await cdp.open();
    const attachedIdentity = await verifyBrowserIdentity(cdp, {
      cdpEndpoint: browser.cdpEndpoint,
      expectedBrowserIdentity: browser.browserIdentity,
    });
    if (
      attachedIdentity?.status !== 'declared_identity_verified'
      || attachedIdentity.profileSlotId !== browser.profileSlotId
    ) fail('QA_YOUTUBE_SELECTOR_CORPUS_CONNECTED_BROWSER_IDENTITY_MISMATCH');
    const selected = selectUniqueExistingYoutubeTarget(
      await listTargets(cdp),
      plan.parameters.surface,
    );
    baseline = selected.inventory;
    const attached = await cdp.send('Target.attachToTarget', {
      targetId: selected.target.targetId,
      flatten: true,
    }, null, { timeoutMs: CDP_COMMAND_TIMEOUT_MS });
    if (typeof attached?.sessionId !== 'string' || !attached.sessionId) {
      fail('QA_YOUTUBE_SELECTOR_CORPUS_ATTACH_SESSION_REQUIRED');
    }
    sessionId = attached.sessionId;
    await cdp.send('Runtime.enable', {}, sessionId, { timeoutMs: CDP_COMMAND_TIMEOUT_MS });
    const evidence = await collectCapture(cdp, sessionId);
    await cdp.send('Target.detachFromTarget', { sessionId }, null, {
      timeoutMs: CDP_DETACH_TIMEOUT_MS,
    });
    sessionId = null;
    finalInventory = projectPageTargetSet(await listTargets(cdp));
    if (
      finalInventory.count !== baseline.count
      || finalInventory.digest !== baseline.digest
    ) fail('QA_YOUTUBE_SELECTOR_CORPUS_OPERATOR_TARGET_SET_CHANGED');
    return Object.freeze({
      ...evidence,
      browserProduct: probe.browser,
      cleanup: Object.freeze({
        processAction: 'attach_disconnect_only',
        targetOwnership: 'operator_owned_borrowed_observation',
        targetCreationCount: 0,
        targetNavigationCount: 0,
        targetActivationCount: 0,
        targetCloseCount: 0,
        baselinePageTargetSetPreserved: true,
        pageTargetSetDigest: finalInventory.digest,
        osFocusRequestIssued: false,
      }),
    });
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (sessionId && cdp) {
      await cdp.send('Target.detachFromTarget', { sessionId }, null, {
        timeoutMs: CDP_DETACH_TIMEOUT_MS,
      }).catch((error) => cleanupErrors.push(error));
    }
    if (cdp) {
      try {
        cdp.close();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    await capacity.release().catch((error) => cleanupErrors.push(error));
    if (cleanupErrors.length > 0) {
      if (primaryError) {
        throw new AggregateError(
          [primaryError, ...cleanupErrors],
          'QA_YOUTUBE_SELECTOR_CORPUS_OBSERVE_AND_DETACH_FAILED',
          { cause: primaryError },
        );
      }
      if (cleanupErrors.length === 1) throw cleanupErrors[0];
      throw new AggregateError(cleanupErrors, 'QA_YOUTUBE_SELECTOR_CORPUS_DETACH_FAILED');
    }
  }
}

export async function executeQaProtocol(context, dependencies = {}) {
  const {
    plan,
    artifact,
    browser,
    evidence,
    attachmentsDir,
  } = context;
  requireProtocolOptions(plan);
  if (artifact !== null) fail('QA_YOUTUBE_SELECTOR_CORPUS_ARTIFACT_FORBIDDEN');
  requireEnum(
    plan.parameters.surface,
    SURFACE_VALUES,
    'QA_YOUTUBE_SELECTOR_CORPUS_SURFACE_INVALID',
  );
  const attached = browser?.processOwnership === 'attach_only';
  if (!attached) {
    requireEnum(
      plan.parameters.locale,
      LOCALE_VALUES,
      'QA_YOUTUBE_SELECTOR_CORPUS_LOCALE_INVALID',
    );
  }
  await evidence.event('QA_YOUTUBE_SELECTOR_CORPUS_CAPTURE_STARTED', {
    mode: attached ? 'authenticated_attach_only' : 'public_disposable',
    surface: plan.parameters.surface,
    locale: attached ? 'observed_from_document' : plan.parameters.locale,
    productDetectorInfluence: false,
  });
  const observed = attached
    ? await runAttachedCapture({ ...dependencies, plan, browser })
    : await runOwnedCapture({ plan, browser });
  const acceptance = classifyYoutubeSelectorCorpusCapture(observed.capture, {
    requestedSurface: plan.parameters.surface,
    requestedLocale: attached ? null : plan.parameters.locale,
    requireSignedIn: attached,
  });
  const report = Object.freeze({
    contractVersion: YOUTUBE_SELECTOR_DRIFT_CORPUS_CONTRACT_VERSION,
    targetId: plan.targetId,
    mode: attached ? 'authenticated_attach_only' : 'public_disposable',
    requested: Object.freeze({
      surface: plan.parameters.surface,
      locale: attached ? null : plan.parameters.locale,
      signedInRequired: attached,
    }),
    collectionPolicy: COLLECTION_POLICY,
    productDetectorInfluence: false,
    automaticProfileWrite: false,
    stabilization: observed.stabilization,
    capture: observed.capture,
    acceptance,
    cleanup: observed.cleanup,
    browserProduct: observed.browserProduct,
  });
  await fs.mkdir(attachmentsDir, { recursive: true });
  const reportPath = path.join(attachmentsDir, 'youtube-selector-drift-corpus.json');
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  await evidence.event('QA_YOUTUBE_SELECTOR_CORPUS_CAPTURE_FINISHED', {
    status: acceptance.status,
    routeMatches: acceptance.routeMatches,
    localeMatches: acceptance.localeMatches,
    authenticationMatches: acceptance.authenticationMatches,
    opportunityObserved: acceptance.opportunityObserved,
    surfaceCount: observed.capture.surfaceCounts.total,
  });
  return Object.freeze({
    status: acceptance.status,
    protocol: 'youtube_selector_drift_corpus',
    scope: PROTOCOL_SCOPE,
    reportPath,
    report,
  });
}
