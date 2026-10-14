import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  closeQaCdpTarget,
  createQaCdpPageTarget,
  enableQaCdpNoFocusPageExecution,
  listQaCdpTargets,
  navigateQaCdpPageTarget,
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
  QaBrowserTargetLease,
  resolveQaBrowserEpoch,
} from '../../browser-qa/resources/BrowserTargetLease.mjs';
import { evaluate } from '../../e2e/extensionChromiumHarness.mjs';
import { QA_RUN_STATUSES } from '../contracts/qaTargetContract.mjs';

export const SOCIAL_SELECTOR_DRIFT_CORPUS_CONTRACT_VERSION = 1;

const PROTOCOL_SCOPE = 'social_selector_drift_independent_candidate_corpus';
const COLLECTION_POLICY = 'read_only_bounded_redacted_human_review_required';
const TARGET_POLICY = 'protocol_owned_exact_target_create_navigate_observe_close';
const OWNER_PURPOSE = 'social_selector_corpus';
const CDP_COMMAND_TIMEOUT_MS = 10_000;
const CDP_DETACH_TIMEOUT_MS = 1_000;
const STABILIZATION_QUIET_MS = 500;
const STABILIZATION_TIMEOUT_MS = 7_000;
const SURFACE_VALUES = Object.freeze([
  'x_post',
  'instagram_feed',
  'instagram_reels',
  'instagram_profile_grid_dialog',
]);
const ACTION_VALUES = Object.freeze([
  'bookmark',
  'comment',
  'like',
  'repost',
  'save',
  'share',
  'view',
]);
const ROLE_VALUES = Object.freeze([
  'instagram_dialog',
  'instagram_feed_action',
  'instagram_grid_overlay',
  'instagram_profile_stats',
  'instagram_reel_action',
  'x_action_group',
]);
const REMOVED_SENSITIVE_FIELDS = Object.freeze([
  'account_identity',
  'automatic_profile_write',
  'captions_or_post_text',
  'content_titles',
  'cookies',
  'experiment_flags',
  'full_page_html',
  'product_generated_selector',
  'raw_accessible_label',
  'raw_url',
  'svg_path_d',
]);

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
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

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requireProtocolOptions(plan) {
  const options = plan?.protocolOptions;
  if (
    !isPlainRecord(options)
    || options.scope !== PROTOCOL_SCOPE
    || options.collectionPolicy !== COLLECTION_POLICY
    || options.productDetectorInfluence !== false
    || options.profileWritePolicy !== 'forbidden'
    || options.targetPolicy !== TARGET_POLICY
  ) fail('QA_SOCIAL_SELECTOR_CORPUS_PROTOCOL_OPTIONS_INVALID');
  return options;
}

export function resolveSocialSelectorCorpusUrl(surface) {
  requireEnum(surface, SURFACE_VALUES, 'QA_SOCIAL_SELECTOR_CORPUS_SURFACE_INVALID');
  if (surface === 'x_post') {
    return 'https://x.com/XDevelopers/status/1228393702244134912';
  }
  if (surface === 'instagram_feed') return 'https://www.instagram.com/';
  if (surface === 'instagram_reels') return 'https://www.instagram.com/reels/';
  return 'https://www.instagram.com/instagram/';
}

function projectPageTargetSet(targets) {
  if (!Array.isArray(targets)) fail('QA_SOCIAL_SELECTOR_CORPUS_TARGETS_INVALID');
  const pages = targets
    .filter((target) => target?.type === 'page')
    .map((target) => {
      if (typeof target.targetId !== 'string' || !target.targetId) {
        fail('QA_SOCIAL_SELECTOR_CORPUS_TARGETS_INVALID');
      }
      return Object.freeze({ targetId: target.targetId });
    })
    .sort((left, right) => left.targetId.localeCompare(right.targetId));
  return Object.freeze({
    count: pages.length,
    digest: sha256Json(pages),
    pages: Object.freeze(pages),
  });
}

export function createSocialSelectorCorpusStabilizationSource({
  quietMs = STABILIZATION_QUIET_MS,
  timeoutMs = STABILIZATION_TIMEOUT_MS,
} = {}) {
  if (!Number.isSafeInteger(quietMs) || quietMs < 100 || quietMs > 2_000) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_QUIET_WINDOW_INVALID', quietMs);
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= quietMs || timeoutMs > 15_000) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_STABILIZATION_TIMEOUT_INVALID', timeoutMs);
  }
  return `(() => new Promise((resolve) => {
    const quietMs = ${quietMs};
    const timeoutMs = ${timeoutMs};
    const startedAt = performance.now();
    let mutationCount = 0;
    let quietTimer = null;
    let deadlineTimer = null;
    let rootWaitTimer = null;
    let observer = null;
    const finish = (state) => {
      observer?.disconnect();
      clearTimeout(quietTimer);
      clearTimeout(deadlineTimer);
      clearTimeout(rootWaitTimer);
      resolve({ state, mutationCount, elapsedMs: Math.round(performance.now() - startedAt) });
    };
    const armQuiet = () => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        if (document.readyState === 'loading') {
          armQuiet();
          return;
        }
        finish('quiet');
      }, quietMs);
    };
    const beginObservation = () => {
      if (!document.documentElement) {
        rootWaitTimer = setTimeout(beginObservation, 25);
        return;
      }
      observer = new MutationObserver((records) => {
        mutationCount += records.length;
        armQuiet();
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
      armQuiet();
    };
    deadlineTimer = setTimeout(() => finish('deadline'), timeoutMs);
    beginObservation();
  }))()`;
}

export function createSocialSelectorCorpusCaptureSource(requestedSurface) {
  requireEnum(
    requestedSurface,
    SURFACE_VALUES,
    'QA_SOCIAL_SELECTOR_CORPUS_SURFACE_INVALID',
  );
  return `(() => {
    const contractVersion = ${SOCIAL_SELECTOR_DRIFT_CORPUS_CONTRACT_VERSION};
    const requestedSurface = ${JSON.stringify(requestedSurface)};
    const removedSensitiveFields = ${JSON.stringify(REMOVED_SENSITIVE_FIELDS)};
    const actionPatterns = [
      ['comment', /(?:^|\\s)(?:comments?|repl(?:y|ies)|댓글|답글)(?:$|\\s|\\d)/iu],
      ['repost', /(?:^|\\s)(?:reposts?|retweets?|리포스트|재게시)(?:$|\\s|\\d)/iu],
      ['like', /(?:^|\\s)(?:like|liked|likes|좋아요)(?:$|\\s|\\d)/iu],
      ['bookmark', /(?:^|\\s)(?:bookmarks?|북마크)(?:$|\\s|\\d)/iu],
      ['view', /(?:^|\\s)(?:views?|조회수)(?:$|\\s|\\d)/iu],
      ['share', /(?:^|\\s)(?:share|공유)(?:$|\\s|\\d)/iu],
      ['save', /(?:^|\\s)(?:save|저장)(?:$|\\s|\\d)/iu],
    ];
    const numericPattern = /^\\s*[\\d,.]+(?:\\.[\\d]+)?\\s*(?:천|만|억|k|m|b)?\\s*$/iu;
    const statPattern = /게시물|posts?|팔로워|followers?|팔로잉|팔로우|following/iu;
    const profileClusterPattern = /(?:게시물|posts?).*(?:팔로워|followers?|팔로잉|팔로우|following)|(?:팔로워|followers?).*(?:팔로잉|팔로우|following)/iu;
    const normalize = (value) => String(value || '').replace(/\\s+/gu, ' ').trim();
    const shape = (value) => normalize(value).replace(/[0-9]/gu, '#').slice(0, 48);
    const isVisible = (node) => {
      if (!(node instanceof Element) || !node.isConnected) return false;
      if (node.closest('[hidden], [aria-hidden="true"]')) return false;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const actionLabel = (node) => {
      if (!(node instanceof Element)) return '';
      const nested = node.querySelector('svg[aria-label], svg title, [role="img"][aria-label], [role="img"][title]');
      return normalize([
        node.getAttribute('aria-label'),
        node.getAttribute('title'),
        nested?.tagName === 'TITLE' ? nested.textContent : nested?.getAttribute?.('aria-label'),
        nested?.getAttribute?.('title'),
      ].filter(Boolean).join(' '));
    };
    const actionIdentity = (node) => {
      const label = actionLabel(node);
      return actionPatterns.find(([, pattern]) => pattern.test(label))?.[0] || null;
    };
    const numericLeaves = (root, limit = 12) => {
      if (!(root instanceof Element)) return [];
      const nodes = [root, ...root.querySelectorAll('span, strong, div, [role="text"]')];
      const leaves = [];
      for (const node of nodes) {
        if (leaves.length >= limit) break;
        const text = normalize(node.textContent);
        if (!numericPattern.test(text) || !isVisible(node)) continue;
        const nested = [...node.querySelectorAll('span, strong, div, [role="text"]')]
          .some((child) => child !== node && numericPattern.test(normalize(child.textContent)));
        if (!nested) leaves.push(node);
      }
      return leaves;
    };
    const metricLeavesForControl = (control, root) => {
      const candidates = new Set(numericLeaves(control, 6));
      let current = control.parentElement;
      for (let depth = 0; current instanceof Element && depth < 5 && root.contains(current); depth += 1) {
        let sibling = current.nextElementSibling;
        while (sibling instanceof Element) {
          if (actionIdentity(sibling) || sibling.querySelector('button, [role="button"]')) break;
          numericLeaves(sibling, 4).forEach((leaf) => candidates.add(leaf));
          sibling = sibling.nextElementSibling;
        }
        if (current === root) break;
        current = current.parentElement;
      }
      return [...candidates].slice(0, 6);
    };
    const actionEvidence = (root) => {
      const evidence = [];
      const controls = [root, ...root.querySelectorAll('button, a, [role="button"], [role="link"]')];
      for (const control of controls) {
        const action = actionIdentity(control);
        if (!action || evidence.length >= 12 || !isVisible(control)) continue;
        const leaves = metricLeavesForControl(control, root);
        evidence.push({
          action,
          locale: /[가-힣]/u.test(actionLabel(control)) ? 'ko' : 'en',
          metricLeafCount: leaves.length,
          uniqueMetricLeaf: leaves.length === 1,
          countShape: leaves.length === 1 ? shape(leaves[0].textContent) : null,
        });
      }
      return evidence;
    };
    const safeAttrs = (node) => {
      const attrs = {};
      const classes = [...(node.classList || [])]
        .filter((token) => /^[A-Za-z0-9_-]{1,80}$/u.test(token))
        .slice(0, 10);
      if (classes.length > 0) attrs.classTokens = classes;
      if (node.hasAttribute('role')) attrs.role = node.getAttribute('role');
      if (node.hasAttribute('hidden')) attrs.hidden = '';
      if (node.hasAttribute('aria-hidden')) attrs['aria-hidden'] = node.getAttribute('aria-hidden');
      if (node.hasAttribute('href')) attrs.linkPresent = true;
      const identity = actionIdentity(node);
      if (identity) attrs.action = identity;
      return attrs;
    };
    const serialize = (root) => {
      let nodeCount = 0;
      const visit = (node, depth) => {
        if (nodeCount >= 80 || depth > 5) return null;
        nodeCount += 1;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = normalize(node.nodeValue);
          return text
            ? { node: 'text', kind: numericPattern.test(text) ? 'metric_shape' : 'redacted_content', value: numericPattern.test(text) ? shape(text) : '[REDACTED]' }
            : null;
        }
        if (!(node instanceof Element)) return null;
        if (node instanceof SVGElement) {
          return { node: 'element', tag: 'svg', attrs: { pathData: '[REDACTED]' }, children: [] };
        }
        const children = [];
        for (const child of node.childNodes) {
          const projected = visit(child, depth + 1);
          if (projected) children.push(projected);
          if (nodeCount >= 80) break;
        }
        return { node: 'element', tag: node.localName, attrs: safeAttrs(node), children };
      };
      const tree = visit(root, 0);
      return { nodeCount, tree };
    };
    const surfaces = [];
    const seen = new Set();
    const addSurface = (root, role, extra = {}) => {
      if (!(root instanceof Element) || seen.has(root) || surfaces.length >= 12) return;
      seen.add(root);
      const serialized = serialize(root);
      surfaces.push({
        surfaceId: 'surface-' + (surfaces.length + 1),
        role,
        visible: isVisible(root),
        actionEvidence: actionEvidence(root),
        numericLeafCount: numericLeaves(root, 24).length,
        nodeCount: serialized.nodeCount,
        tree: serialized.tree,
        ...extra,
      });
    };
    const host = location.hostname;
    const pathname = location.pathname;
    if (host === 'x.com' || host === 'twitter.com') {
      for (const group of document.querySelectorAll('article [role="group"], [data-testid="tweet"] [role="group"]')) {
        if (actionEvidence(group).some((entry) => entry.action === 'like')) {
          addSurface(group, 'x_action_group');
        }
      }
    }
    if (host === 'www.instagram.com' || host === 'instagram.com') {
      for (const dialog of document.querySelectorAll('[role="dialog"]')) {
        if (actionEvidence(dialog).length > 0) addSurface(dialog, 'instagram_dialog');
      }
      for (const article of document.querySelectorAll('article')) {
        if (actionEvidence(article).length === 0) continue;
        addSurface(
          article,
          /^\\/(?:reel|reels)\\//u.test(pathname)
            ? 'instagram_reel_action'
            : 'instagram_feed_action',
        );
      }
      for (const control of document.querySelectorAll('button, a, [role="button"], [role="link"]')) {
        if (!actionIdentity(control)) continue;
        const root = control.closest('article, section, [role="dialog"]')
          || control.parentElement?.parentElement
          || control.parentElement;
        if (!(root instanceof Element) || !actionEvidence(root).some((entry) => entry.action === 'like')) {
          continue;
        }
        addSurface(
          root,
          root.closest('[role="dialog"]')
            ? 'instagram_dialog'
            : /^\\/(?:reel|reels)\\//u.test(pathname)
              ? 'instagram_reel_action'
              : 'instagram_feed_action',
        );
      }
      for (const header of document.querySelectorAll('header')) {
        if (profileClusterPattern.test(normalize(header.textContent))) {
          addSurface(header, 'instagram_profile_stats', {
            statKindCount: ['posts', 'followers', 'following'].filter((kind) => {
              if (kind === 'posts') return /게시물|posts?/iu.test(header.textContent);
              if (kind === 'followers') return /팔로워|followers?/iu.test(header.textContent);
              return /팔로잉|팔로우|following/iu.test(header.textContent);
            }).length,
          });
        }
      }
      for (const link of document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
        if (!isVisible(link)) continue;
        const metricLeaves = numericLeaves(link, 12);
        const iconIdentityCount = [...link.querySelectorAll('svg[aria-label], [role="img"][aria-label]')]
          .map((node) => actionIdentity(node)).filter(Boolean).length;
        addSurface(link, 'instagram_grid_overlay', {
          gridLinkPresent: true,
          overlayMetricOpportunity: metricLeaves.length > 0 && iconIdentityCount > 0,
        });
      }
    }
    const routeKind = host === 'x.com' || host === 'twitter.com'
      ? (/\\/status\\/[^/]+/u.test(pathname) ? 'x_post' : 'other')
      : pathname === '/'
        ? 'instagram_feed'
        : /^\\/reels?(?:\\/|$)/u.test(pathname)
          ? 'instagram_reels'
          : /^\\/instagram\\/?$/u.test(pathname)
            ? 'instagram_profile'
            : /^\\/(?:p|reel)\\/[^/]+/u.test(pathname)
              ? 'instagram_post'
              : 'other';
    const signedIn = host === 'x.com' || host === 'twitter.com'
      ? Boolean(document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]'))
      : !document.querySelector('input[name="username"], form[action*="login"]')
        && Boolean(document.querySelector('nav, [role="navigation"], main'));
    return {
      contractVersion,
      requestedSurface,
      hostname: host,
      routeKind,
      locale: String(document.documentElement.lang || '').trim().toLowerCase() || null,
      readyState: document.readyState,
      signedIn,
      surfaceCounts: Object.fromEntries(${JSON.stringify(ROLE_VALUES)}.map((role) => [
        role,
        surfaces.filter((surface) => surface.role === role).length,
      ])),
      surfaces,
      removedSensitiveFields,
    };
  })()`;
}

export function createInstagramDialogOpenSource() {
  return `(() => {
    const visible = (node) => {
      if (!(node instanceof Element) || node.closest('[hidden], [aria-hidden="true"]')) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const candidates = [...document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')]
      .filter((node) => visible(node));
    if (candidates.length === 0) return { attempted: false, candidateCount: 0 };
    candidates[0].click();
    return { attempted: true, candidateCount: candidates.length };
  })()`;
}

export function createInstagramGridRevealSource() {
  return `(() => {
    const visible = (node) => {
      if (!(node instanceof Element) || node.closest('[hidden], [aria-hidden="true"]')) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const candidates = [...document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')]
      .filter((node) => visible(node));
    if (candidates.length === 0) return { attempted: false, candidateCount: 0 };
    const target = candidates[0];
    for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true }));
    }
    return { attempted: true, candidateCount: candidates.length };
  })()`;
}

function validateTree(node, depth = 0) {
  if (!isPlainRecord(node) || depth > 6) fail('QA_SOCIAL_SELECTOR_CORPUS_TREE_INVALID');
  if (node.node === 'text') {
    if (
      !['metric_shape', 'redacted_content'].includes(node.kind)
      || typeof node.value !== 'string'
      || node.value.length > 48
    ) fail('QA_SOCIAL_SELECTOR_CORPUS_TREE_INVALID');
    return;
  }
  if (
    node.node !== 'element'
    || typeof node.tag !== 'string'
    || !node.tag
    || !isPlainRecord(node.attrs)
    || !Array.isArray(node.children)
    || node.children.length > 80
  ) fail('QA_SOCIAL_SELECTOR_CORPUS_TREE_INVALID');
  const allowedAttrs = [
    'action',
    'aria-hidden',
    'classTokens',
    'hidden',
    'linkPresent',
    'pathData',
    'role',
  ];
  if (Object.keys(node.attrs).some((key) => !allowedAttrs.includes(key))) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_TREE_INVALID');
  }
  if (node.attrs.action !== undefined && !ACTION_VALUES.includes(node.attrs.action)) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_TREE_INVALID');
  }
  if (node.attrs.pathData !== undefined && node.attrs.pathData !== '[REDACTED]') {
    fail('QA_SOCIAL_SELECTOR_CORPUS_TREE_INVALID');
  }
  if (
    node.attrs.classTokens !== undefined
    && (
      !Array.isArray(node.attrs.classTokens)
      || node.attrs.classTokens.length > 10
      || node.attrs.classTokens.some((token) => (
        typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/u.test(token)
      ))
    )
  ) fail('QA_SOCIAL_SELECTOR_CORPUS_TREE_INVALID');
  node.children.forEach((child) => validateTree(child, depth + 1));
}

export function validateSocialSelectorCorpusCapture(capture) {
  const exactKeys = [
    'contractVersion',
    'hostname',
    'locale',
    'readyState',
    'removedSensitiveFields',
    'requestedSurface',
    'routeKind',
    'signedIn',
    'surfaceCounts',
    'surfaces',
  ];
  if (!isPlainRecord(capture)) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_INVALID', 'shape');
  }
  if (!sameStrings(Object.keys(capture).sort(), exactKeys.sort())) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_INVALID', 'keys');
  }
  if (capture.contractVersion !== SOCIAL_SELECTOR_DRIFT_CORPUS_CONTRACT_VERSION) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_INVALID', 'version');
  }
  if (!SURFACE_VALUES.includes(capture.requestedSurface)) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_INVALID', 'surface');
  }
  if (!['interactive', 'complete'].includes(capture.readyState)) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_INVALID', 'ready_state');
  }
  if (typeof capture.signedIn !== 'boolean') {
    fail('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_INVALID', 'signed_in');
  }
  if (!isPlainRecord(capture.surfaceCounts)) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_INVALID', 'counts_shape');
  }
  if (!sameStrings(Object.keys(capture.surfaceCounts).sort(), [...ROLE_VALUES].sort())) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_INVALID', 'counts_keys');
  }
  if (!Array.isArray(capture.surfaces) || capture.surfaces.length > 12) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_INVALID', 'surface_count');
  }
  if (!sameStrings(capture.removedSensitiveFields, REMOVED_SENSITIVE_FIELDS)) {
    fail('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_INVALID', 'redaction_contract');
  }
  capture.surfaces.forEach((surface) => {
    const allowedExtra = surface.role === 'instagram_profile_stats'
      ? ['statKindCount']
      : surface.role === 'instagram_grid_overlay'
        ? ['gridLinkPresent', 'overlayMetricOpportunity']
        : [];
    const keys = [
      'actionEvidence',
      'nodeCount',
      'numericLeafCount',
      'role',
      'surfaceId',
      'tree',
      'visible',
      ...allowedExtra,
    ].sort();
    if (
      !isPlainRecord(surface)
      || !sameStrings(Object.keys(surface).sort(), keys)
      || !/^surface-(?:[1-9]|1[0-2])$/u.test(surface.surfaceId)
      || !ROLE_VALUES.includes(surface.role)
      || typeof surface.visible !== 'boolean'
      || !Number.isSafeInteger(surface.numericLeafCount)
      || surface.numericLeafCount < 0
      || surface.numericLeafCount > 24
      || !Number.isSafeInteger(surface.nodeCount)
      || surface.nodeCount < 1
      || surface.nodeCount > 80
      || !Array.isArray(surface.actionEvidence)
      || surface.actionEvidence.length > 12
    ) fail('QA_SOCIAL_SELECTOR_CORPUS_SURFACE_INVALID');
    surface.actionEvidence.forEach((entry) => {
      if (
        !isPlainRecord(entry)
        || !sameStrings(
          Object.keys(entry).sort(),
          ['action', 'countShape', 'locale', 'metricLeafCount', 'uniqueMetricLeaf'],
        )
        || !ACTION_VALUES.includes(entry.action)
        || !['en', 'ko'].includes(entry.locale)
        || !Number.isSafeInteger(entry.metricLeafCount)
        || entry.metricLeafCount < 0
        || entry.metricLeafCount > 6
        || typeof entry.uniqueMetricLeaf !== 'boolean'
        || (entry.uniqueMetricLeaf !== (entry.metricLeafCount === 1))
        || (entry.countShape !== null && typeof entry.countShape !== 'string')
      ) fail('QA_SOCIAL_SELECTOR_CORPUS_ACTION_EVIDENCE_INVALID');
    });
    validateTree(surface.tree);
  });
  ROLE_VALUES.forEach((role) => {
    if (
      capture.surfaceCounts[role]
      !== capture.surfaces.filter((surface) => surface.role === role).length
    ) fail('QA_SOCIAL_SELECTOR_CORPUS_COUNTS_INVALID');
  });
  return capture;
}

function hasUniqueLikeOpportunity(capture, role) {
  return capture.surfaces.some((surface) => (
    surface.role === role
    && surface.visible
    && surface.actionEvidence.some((entry) => (
      entry.action === 'like' && entry.uniqueMetricLeaf
    ))
  ));
}

export function classifySocialSelectorCorpusCaptures({
  requestedSurface,
  initial,
  afterReveal = null,
  afterInteraction = null,
  gridReveal = null,
  interaction = null,
} = {}) {
  requireEnum(
    requestedSurface,
    SURFACE_VALUES,
    'QA_SOCIAL_SELECTOR_CORPUS_SURFACE_INVALID',
  );
  validateSocialSelectorCorpusCapture(initial);
  if (afterReveal !== null) validateSocialSelectorCorpusCapture(afterReveal);
  if (afterInteraction !== null) validateSocialSelectorCorpusCapture(afterInteraction);
  let routeMatches = false;
  let authenticationMatches = true;
  let opportunityObserved = false;
  if (requestedSurface === 'x_post') {
    routeMatches = initial.routeKind === 'x_post';
    opportunityObserved = hasUniqueLikeOpportunity(initial, 'x_action_group');
  } else if (requestedSurface === 'instagram_feed') {
    routeMatches = initial.routeKind === 'instagram_feed';
    authenticationMatches = initial.signedIn;
    opportunityObserved = hasUniqueLikeOpportunity(initial, 'instagram_feed_action');
  } else if (requestedSurface === 'instagram_reels') {
    routeMatches = initial.routeKind === 'instagram_reels';
    authenticationMatches = initial.signedIn;
    opportunityObserved = hasUniqueLikeOpportunity(initial, 'instagram_reel_action');
  } else {
    routeMatches = initial.routeKind === 'instagram_profile';
    authenticationMatches = initial.signedIn;
    const profileObserved = [initial, afterReveal]
      .some((capture) => capture?.surfaceCounts?.instagram_profile_stats > 0);
    const gridObserved = afterReveal?.surfaces?.some((surface) => (
      surface.role === 'instagram_grid_overlay'
      && surface.visible
      && surface.gridLinkPresent === true
      && surface.overlayMetricOpportunity === true
    )) === true;
    const dialogObserved = afterInteraction !== null
      && hasUniqueLikeOpportunity(afterInteraction, 'instagram_dialog');
    opportunityObserved = profileObserved
      && gridObserved
      && gridReveal?.attempted === true
      && interaction?.attempted === true
      && dialogObserved;
  }
  const complete = routeMatches && authenticationMatches && opportunityObserved;
  return Object.freeze({
    status: complete ? QA_RUN_STATUSES.PASS : QA_RUN_STATUSES.INCONCLUSIVE,
    complete,
    routeMatches,
    authenticationMatches,
    opportunityObserved,
  });
}

async function collectCaptureOnce(cdp, sessionId, requestedSurface) {
  const stabilization = await evaluate(
    cdp,
    sessionId,
    createSocialSelectorCorpusStabilizationSource(),
    { timeoutMs: STABILIZATION_TIMEOUT_MS + 1_000 },
  );
  if (
    !isPlainRecord(stabilization)
    || !['quiet', 'deadline'].includes(stabilization.state)
    || !Number.isSafeInteger(stabilization.mutationCount)
    || stabilization.mutationCount < 0
  ) fail('QA_SOCIAL_SELECTOR_CORPUS_STABILIZATION_INVALID');
  const capture = await evaluate(
    cdp,
    sessionId,
    createSocialSelectorCorpusCaptureSource(requestedSurface),
    { awaitPromise: false, timeoutMs: CDP_COMMAND_TIMEOUT_MS },
  );
  validateSocialSelectorCorpusCapture(capture);
  return Object.freeze({ stabilization: Object.freeze(stabilization), capture });
}

function hasRequestedSurfaceOpportunity(capture, requestedSurface) {
  if (requestedSurface === 'x_post') return capture.surfaceCounts.x_action_group > 0;
  if (requestedSurface === 'instagram_feed') {
    return capture.surfaceCounts.instagram_feed_action > 0;
  }
  if (requestedSurface === 'instagram_reels') {
    return capture.surfaceCounts.instagram_reel_action > 0;
  }
  return capture.surfaceCounts.instagram_profile_stats > 0
    && capture.surfaceCounts.instagram_grid_overlay > 0;
}

async function collectCapture(cdp, sessionId, requestedSurface) {
  const first = await collectCaptureOnce(cdp, sessionId, requestedSurface);
  if (hasRequestedSurfaceOpportunity(first.capture, requestedSurface)) {
    return Object.freeze({
      ...first,
      hydrationGraceUsed: false,
      priorStabilization: null,
    });
  }
  const second = await collectCaptureOnce(cdp, sessionId, requestedSurface);
  return Object.freeze({
    ...second,
    hydrationGraceUsed: true,
    priorStabilization: first.stabilization,
  });
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
  createTarget = createQaCdpPageTarget,
  navigateTarget = navigateQaCdpPageTarget,
  closeTarget = closeQaCdpTarget,
  enableNoFocusExecution = enableQaCdpNoFocusPageExecution,
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
  ) fail('QA_SOCIAL_SELECTOR_CORPUS_ATTACHED_BROWSER_REQUIRED');
  const capacity = await capacityFactory({
    rootDir: plan.rootDir,
    ownerId: `${plan.runId}:social-selector-corpus`,
    browserResourceIdentities: resolveBrowserQaPhysicalResourceIdentities({
      cdpEndpoint: browser.cdpEndpoint,
      userDataDir: browser.profile,
      profileDirectory: browser.profileDirectory,
    }),
  });
  let cdp = null;
  let sessionId = null;
  let targetLease = null;
  let ownedTarget = null;
  let primaryError = null;
  let baseline = null;
  const closeReceipts = [];
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
    ) fail('QA_SOCIAL_SELECTOR_CORPUS_CONNECTED_BROWSER_IDENTITY_MISMATCH');
    baseline = projectPageTargetSet(await listTargets(cdp));
    const browserEpoch = resolveQaBrowserEpoch({
      webSocketDebuggerUrl: probe.webSocketDebuggerUrl,
    });
    targetLease = new QaBrowserTargetLease({
      browserEpoch,
      ownerId: `${plan.runId}:social-selector-corpus-target`,
      baselineTargetIds: baseline.pages.map((target) => target.targetId),
    });
    ownedTarget = await createTarget(cdp, {
      url: 'about:blank',
      background: true,
      timeoutMs: CDP_COMMAND_TIMEOUT_MS,
      recoverAmbiguousCreation: true,
      ownerPurpose: OWNER_PURPOSE,
      browserEpoch,
    });
    targetLease.register({
      targetId: ownedTarget.targetId,
      purpose: OWNER_PURPOSE,
      initialUrl: ownedTarget.initialUrl,
    });
    await navigateTarget(
      cdp,
      ownedTarget,
      resolveSocialSelectorCorpusUrl(plan.parameters.surface),
      { timeoutMs: 45_000, activateTarget: false },
    );
    const attached = await cdp.send('Target.attachToTarget', {
      targetId: ownedTarget.targetId,
      flatten: true,
    }, null, { timeoutMs: CDP_COMMAND_TIMEOUT_MS });
    if (typeof attached?.sessionId !== 'string' || !attached.sessionId) {
      fail('QA_SOCIAL_SELECTOR_CORPUS_ATTACH_SESSION_REQUIRED');
    }
    sessionId = attached.sessionId;
    await cdp.send('Runtime.enable', {}, sessionId, { timeoutMs: CDP_COMMAND_TIMEOUT_MS });
    const noFocusExecution = await enableNoFocusExecution(
      cdp,
      ownedTarget,
      sessionId,
      { timeoutMs: CDP_COMMAND_TIMEOUT_MS },
    );
    const initial = await collectCapture(cdp, sessionId, plan.parameters.surface);
    let gridReveal = null;
    let afterReveal = null;
    let interaction = null;
    let afterInteraction = null;
    if (plan.parameters.surface === 'instagram_profile_grid_dialog') {
      gridReveal = await evaluate(
        cdp,
        sessionId,
        createInstagramGridRevealSource(),
        { awaitPromise: false, timeoutMs: CDP_COMMAND_TIMEOUT_MS },
      );
      if (
        !isPlainRecord(gridReveal)
        || typeof gridReveal.attempted !== 'boolean'
        || !Number.isSafeInteger(gridReveal.candidateCount)
        || gridReveal.candidateCount < 0
      ) fail('QA_SOCIAL_SELECTOR_CORPUS_GRID_REVEAL_INVALID');
      afterReveal = await collectCapture(cdp, sessionId, plan.parameters.surface);
      interaction = await evaluate(
        cdp,
        sessionId,
        createInstagramDialogOpenSource(),
        { awaitPromise: false, timeoutMs: CDP_COMMAND_TIMEOUT_MS },
      );
      if (
        !isPlainRecord(interaction)
        || typeof interaction.attempted !== 'boolean'
        || !Number.isSafeInteger(interaction.candidateCount)
        || interaction.candidateCount < 0
      ) fail('QA_SOCIAL_SELECTOR_CORPUS_DIALOG_INTERACTION_INVALID');
      afterInteraction = await collectCapture(cdp, sessionId, plan.parameters.surface);
    }
    await cdp.send('Target.detachFromTarget', { sessionId }, null, {
      timeoutMs: CDP_DETACH_TIMEOUT_MS,
    });
    sessionId = null;
    closeReceipts.push(await targetLease.release(ownedTarget.targetId, {
      closeTarget: (targetId) => closeTarget(cdp, targetId, {
        timeoutMs: CDP_COMMAND_TIMEOUT_MS,
      }),
    }));
    const finalInventory = projectPageTargetSet(await listTargets(cdp));
    if (
      finalInventory.count !== baseline.count
      || finalInventory.digest !== baseline.digest
    ) fail('QA_SOCIAL_SELECTOR_CORPUS_OPERATOR_TARGET_SET_CHANGED');
    return Object.freeze({
      initial,
      gridReveal: gridReveal ? Object.freeze(gridReveal) : null,
      afterReveal,
      interaction: interaction ? Object.freeze(interaction) : null,
      afterInteraction,
      browserProduct: probe.browser,
      cleanup: Object.freeze({
        processAction: 'attach_disconnect_only',
        targetOwnership: 'protocol_owned_exact_target',
        targetCreationCount: 1,
        targetNavigationCount: 1,
        targetActivationCount: 0,
        targetCloseCount: closeReceipts.length,
        baselinePageTargetSetPreserved: true,
        pageTargetSetDigest: finalInventory.digest,
        osFocusRequestIssued: false,
        noFocusExecution,
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
    if (targetLease && cdp && targetLease.snapshot().ownedTargetCount > 0) {
      await targetLease.releaseAll({
        closeTarget: (targetId) => closeTarget(cdp, targetId, {
          timeoutMs: CDP_COMMAND_TIMEOUT_MS,
        }),
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
          'QA_SOCIAL_SELECTOR_CORPUS_OBSERVE_AND_CLEANUP_FAILED',
          { cause: primaryError },
        );
      }
      if (cleanupErrors.length === 1) throw cleanupErrors[0];
      throw new AggregateError(cleanupErrors, 'QA_SOCIAL_SELECTOR_CORPUS_CLEANUP_FAILED');
    }
  }
}

export async function executeQaProtocol(context, dependencies = {}) {
  const { plan, artifact, browser, evidence, attachmentsDir } = context;
  requireProtocolOptions(plan);
  if (artifact !== null) fail('QA_SOCIAL_SELECTOR_CORPUS_ARTIFACT_FORBIDDEN');
  requireEnum(
    plan.parameters.surface,
    SURFACE_VALUES,
    'QA_SOCIAL_SELECTOR_CORPUS_SURFACE_INVALID',
  );
  await evidence.event('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_STARTED', {
    surface: plan.parameters.surface,
    productDetectorInfluence: false,
  });
  const observed = await runAttachedCapture({ ...dependencies, plan, browser });
  const acceptance = classifySocialSelectorCorpusCaptures({
    requestedSurface: plan.parameters.surface,
    initial: observed.initial.capture,
    afterReveal: observed.afterReveal?.capture || null,
    afterInteraction: observed.afterInteraction?.capture || null,
    gridReveal: observed.gridReveal,
    interaction: observed.interaction,
  });
  const report = Object.freeze({
    contractVersion: SOCIAL_SELECTOR_DRIFT_CORPUS_CONTRACT_VERSION,
    targetId: plan.targetId,
    requestedSurface: plan.parameters.surface,
    collectionPolicy: COLLECTION_POLICY,
    productDetectorInfluence: false,
    automaticProfileWrite: false,
    initial: observed.initial,
    gridReveal: observed.gridReveal,
    afterReveal: observed.afterReveal,
    interaction: observed.interaction,
    afterInteraction: observed.afterInteraction,
    acceptance,
    cleanup: observed.cleanup,
    browserProduct: observed.browserProduct,
  });
  await fs.mkdir(attachmentsDir, { recursive: true });
  const reportPath = path.join(attachmentsDir, 'social-selector-drift-corpus.json');
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  await evidence.event('QA_SOCIAL_SELECTOR_CORPUS_CAPTURE_FINISHED', {
    status: acceptance.status,
    surface: plan.parameters.surface,
    routeMatches: acceptance.routeMatches,
    authenticationMatches: acceptance.authenticationMatches,
    opportunityObserved: acceptance.opportunityObserved,
    initialSurfaceCount: observed.initial.capture.surfaces.length,
    afterInteractionSurfaceCount: observed.afterInteraction?.capture.surfaces.length || 0,
    afterRevealSurfaceCount: observed.afterReveal?.capture.surfaces.length || 0,
  });
  return Object.freeze({
    status: acceptance.status,
    protocol: 'social_selector_drift_corpus',
    scope: PROTOCOL_SCOPE,
    reportPath,
    report,
  });
}
