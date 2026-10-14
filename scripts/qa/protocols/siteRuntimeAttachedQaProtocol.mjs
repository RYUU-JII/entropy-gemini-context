import { createHash } from 'node:crypto';

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
  getSiteScenario,
} from '../../e2e/sites/scenarioCatalog.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';

const ATTACHED_SURFACE_SCOPE = (
  'managed_browser_reddit_access_and_dom_structural_opportunity_only'
);
const ATTACHED_SETTINGS_SITE_RULE_POLICY = 'zero_settings_and_site_rule_commands';
const ATTACHED_EXISTING_TARGET_POLICY = 'unique_exact_route_attach_evaluate_detach';
const REDDIT_HOSTNAME = 'www.reddit.com';
const REDDIT_ROUTE_PATTERN = /^\/r\/popular\/?$/u;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/u;
const CDP_COMMAND_TIMEOUT_MS = 5_000;
const CDP_DETACH_TIMEOUT_MS = 1_000;
const SCENARIO_IDS = Object.freeze([
  'reddit-public-metrics',
  'reddit-media-targeting',
  'reddit-text-targeting',
]);
const OPPORTUNITY_KEYS = Object.freeze(['metric', 'media', 'text']);
const OPPORTUNITY_CATEGORIES = Object.freeze([
  'postContainers',
  'metrics',
  'media',
  'text',
]);
const RAW_OBSERVATION_KEYS = Object.freeze([
  'catalogPostContainerCount',
  'challengePresent',
  'documentComplete',
  'hostname',
  'loginRoute',
  'mediaOpportunityCount',
  'metricOpportunityCount',
  'pathname',
  'postContainerCount',
  'relationshipEvidence',
  'responseStatus',
  'selectorEvidence',
  'structuralPostContainerCount',
  'textOpportunityCount',
]);
const MERGED_OBSERVATION_KEYS = Object.freeze([
  ...RAW_OBSERVATION_KEYS,
  'catalogSelectorCoverage',
  'degradation',
  'sampleCount',
  'semanticRelationshipOracle',
  'structuralRecoveryUsed',
]);

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeExactRedditTargetUrl(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname !== REDDIT_HOSTNAME
    || !REDDIT_ROUTE_PATTERN.test(parsed.pathname)
    || parsed.username
    || parsed.password
    || parsed.port
    || parsed.hash
  ) return null;
  return parsed.href;
}

function projectPageTargetSet(targets) {
  if (!Array.isArray(targets)) fail('QA_REDDIT_SURFACE_TARGET_INVENTORY_INVALID');
  const pages = targets
    .filter((target) => target?.type === 'page')
    .map((target) => {
      if (typeof target.targetId !== 'string' || !target.targetId) {
        fail('QA_REDDIT_SURFACE_TARGET_INVENTORY_INVALID');
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

function requireUniqueExistingRedditTarget(inventory, targetUrl) {
  const expectedUrl = normalizeExactRedditTargetUrl(targetUrl);
  if (!expectedUrl) fail('QA_REDDIT_SURFACE_TARGET_URL_INVALID');
  const matches = inventory.pages.filter((target) => (
    normalizeExactRedditTargetUrl(target.url) === expectedUrl
  ));
  if (matches.length === 0) {
    const error = new Error('QA_REDDIT_SURFACE_EXISTING_TARGET_REQUIRED');
    error.code = 'QA_REDDIT_SURFACE_EXISTING_TARGET_REQUIRED';
    error.nextAction = 'open_exact_reddit_route_in_declared_qa_browser_then_retry';
    throw error;
  }
  if (matches.length !== 1) {
    fail('QA_REDDIT_SURFACE_EXISTING_TARGET_AMBIGUOUS', matches.length);
  }
  return matches[0];
}

async function evaluateAttachedPage(cdp, sessionId, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: false,
    returnByValue: true,
  }, sessionId, { timeoutMs: CDP_COMMAND_TIMEOUT_MS });
  if (result?.exceptionDetails || !result?.result || !('value' in result.result)) {
    fail('QA_REDDIT_SURFACE_EVALUATION_FAILED');
  }
  return result.result.value;
}

function sameStrings(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function isPlainRecord(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, keys) {
  return isPlainRecord(value)
    && sameStrings(Object.keys(value).sort(), [...keys].sort());
}

function requireCount(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) fail(code, value);
  return value;
}

function validateOpportunityEvidence(value, code) {
  if (!hasExactKeys(value, OPPORTUNITY_KEYS)) fail(code);
  for (const key of OPPORTUNITY_KEYS) requireCount(value[key], code);
  return value;
}

export function validateRedditSurfaceRawObservation(observation) {
  if (
    !hasExactKeys(observation, RAW_OBSERVATION_KEYS)
    || typeof observation.hostname !== 'string'
    || !observation.hostname
    || typeof observation.pathname !== 'string'
    || !observation.pathname.startsWith('/')
    || (
      observation.responseStatus !== null
      && (
        !Number.isSafeInteger(observation.responseStatus)
        || observation.responseStatus < 100
        || observation.responseStatus > 599
      )
    )
    || typeof observation.documentComplete !== 'boolean'
    || typeof observation.loginRoute !== 'boolean'
    || typeof observation.challengePresent !== 'boolean'
  ) {
    fail('QA_REDDIT_SURFACE_OBSERVATION_SCHEMA_INVALID');
  }
  requireCount(
    observation.postContainerCount,
    'QA_REDDIT_SURFACE_OBSERVATION_COUNT_INVALID',
  );
  requireCount(
    observation.catalogPostContainerCount,
    'QA_REDDIT_SURFACE_OBSERVATION_COUNT_INVALID',
  );
  requireCount(
    observation.structuralPostContainerCount,
    'QA_REDDIT_SURFACE_OBSERVATION_COUNT_INVALID',
  );
  if (
    observation.postContainerCount
      < Math.max(
        observation.catalogPostContainerCount,
        observation.structuralPostContainerCount,
      )
    || observation.postContainerCount
      > observation.catalogPostContainerCount + observation.structuralPostContainerCount
  ) {
    fail('QA_REDDIT_SURFACE_POST_CONTAINER_COUNT_MISMATCH');
  }
  const selector = validateOpportunityEvidence(
    observation.selectorEvidence,
    'QA_REDDIT_SURFACE_SELECTOR_EVIDENCE_INVALID',
  );
  const relationship = validateOpportunityEvidence(
    observation.relationshipEvidence,
    'QA_REDDIT_SURFACE_RELATIONSHIP_EVIDENCE_INVALID',
  );
  const countByKey = {
    metric: observation.metricOpportunityCount,
    media: observation.mediaOpportunityCount,
    text: observation.textOpportunityCount,
  };
  for (const key of OPPORTUNITY_KEYS) {
    requireCount(countByKey[key], 'QA_REDDIT_SURFACE_OBSERVATION_COUNT_INVALID');
    if (countByKey[key] !== Math.max(selector[key], relationship[key])) {
      fail('QA_REDDIT_SURFACE_OPPORTUNITY_COUNT_MISMATCH', key);
    }
  }
  return observation;
}

export function isRedditChallengeOwnerText(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (!normalized || normalized.length > 160) return false;
  return /^(?:(?:access denied|request blocked|blocked)|(?:(?:you(?:'ve| have) been )?blocked by (?:reddit|network security))|network security|(?:(?:security|robot) (?:check|challenge|verification)(?: required)?)|are you (?:a )?robot|(?:please )?(?:verify|prove) (?:that )?you(?:'re| are) human|captcha(?: verification| challenge| required)?)(?:\s*[|—-]\s*reddit)?[.!?]?$/iu
    .test(normalized);
}

export function shouldClassifyRedditChallengeTextSurface({
  postContainerCount,
  bodyText,
  ownerChallengeShaped,
} = {}) {
  if (
    !Number.isSafeInteger(postContainerCount)
    || postContainerCount < 0
    || typeof bodyText !== 'string'
    || typeof ownerChallengeShaped !== 'boolean'
  ) return false;
  return postContainerCount === 0
    && bodyText.trim().length <= 2_500
    && ownerChallengeShaped;
}

function canonicalSelectors(values, code) {
  if (!Array.isArray(values) || values.length === 0) fail(code);
  const selectors = [...new Set(values)];
  if (selectors.some((selector) => (
    typeof selector !== 'string'
    || !selector.trim()
    || selector !== selector.trim()
  ))) fail(code);
  return Object.freeze(selectors);
}

export function resolveRedditSurfaceSelectorInputs() {
  const metrics = getSiteScenario('reddit-public-metrics');
  const media = getSiteScenario('reddit-media-targeting');
  const text = getSiteScenario('reddit-text-targeting');
  if (
    metrics.siteId !== 'reddit'
    || media.siteId !== 'reddit'
    || text.siteId !== 'reddit'
  ) {
    fail('QA_REDDIT_SURFACE_SCENARIO_OWNER_MISMATCH');
  }
  return Object.freeze({
    scenarioIds: SCENARIO_IDS,
    post: canonicalSelectors(
      metrics.readiness?.selectors,
      'QA_REDDIT_SURFACE_POST_SELECTORS_REQUIRED',
    ),
    metrics: canonicalSelectors([
      ...(metrics.observableEffects?.candidateSelectors || []),
      ...(metrics.readiness?.conditions || []).flatMap((condition) => (
        condition?.id === 'metric-candidate-present' ? condition.selectors || [] : []
      )),
    ], 'QA_REDDIT_SURFACE_METRIC_SELECTORS_REQUIRED'),
    media: canonicalSelectors(
      media.observableEffects?.targetingOracle?.positiveSelectors,
      'QA_REDDIT_SURFACE_MEDIA_SELECTORS_REQUIRED',
    ),
    text: canonicalSelectors(
      text.observableEffects?.targetingOracle?.positiveSelectors,
      'QA_REDDIT_SURFACE_TEXT_SELECTORS_REQUIRED',
    ),
  });
}

function requireProtocolContract(plan, artifact, browser) {
  const options = plan?.protocolOptions;
  if (
    options?.scope !== ATTACHED_SURFACE_SCOPE
    || options.site !== 'reddit'
    || options.targetUrl !== 'https://www.reddit.com/r/popular/'
    || !sameStrings(options.selectorScenarioIds, SCENARIO_IDS)
    || options.settingsAndSiteRulePolicy !== ATTACHED_SETTINGS_SITE_RULE_POLICY
    || options.existingTargetPolicy !== ATTACHED_EXISTING_TARGET_POLICY
  ) {
    fail('QA_REDDIT_SURFACE_PROTOCOL_OPTIONS_INVALID');
  }
  if (artifact !== null) fail('QA_REDDIT_SURFACE_ARTIFACT_FORBIDDEN');
  if (
    browser?.processOwnership !== 'attach_only'
    || browser.browserClass !== 'managed_persistent'
    || browser.lifecyclePolicy !== 'managed'
    || browser.browserIdentity?.status !== 'declared_identity_verified'
    || browser.profileSlotId !== browser.browserIdentity.profileSlotId
    || plan.browserExecution?.processOwnership !== 'attach_only'
    || plan.browserExecution.startPolicy !== 'managed_ensure_before_attach'
    || plan.browserExecution.extensionRuntime !== 'none'
    || plan.browserExecution.headless !== null
    || plan.browserExecution.documentVisibility !== 'background_allowed'
    || plan.browserExecution.targetActivation !== 'background'
    || plan.browserExecution.osFocus !== 'never'
  ) {
    fail('QA_REDDIT_SURFACE_MANAGED_ATTACH_BROWSER_REQUIRED');
  }
  return options;
}

export function createRedditSurfaceObservationSource(selectorInputs) {
  return `(() => {
    const input = ${JSON.stringify(selectorInputs)};
    const safeQueryAll = (root, selectors) => {
      const seen = new Set();
      const result = [];
      for (const selector of selectors) {
        let matches = [];
        try { matches = root.querySelectorAll(selector); } catch { continue; }
        for (const element of matches) {
          if (!seen.has(element)) {
            seen.add(element);
            result.push(element);
          }
        }
      }
      return result;
    };
    const visible = (element, minimum = {}) => {
      if (!(element instanceof Element)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const width = Math.max(0, rect.width);
      const height = Math.max(0, rect.height);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > 0
        && width >= (minimum.width || 1)
        && height >= (minimum.height || 1)
        && width * height >= (minimum.area || 1);
    };
    const catalogPosts = safeQueryAll(document, input.post).filter((element) => (
      visible(element, { width: 120, height: 60, area: 7200 })
    ));
    // This oracle is deliberately independent of input.post. It identifies a
    // Reddit post by semantic container and action/permalink hierarchy rather
    // than by the product/catalog selector set above.
    const redditPermalinkPath = (anchor) => {
      try {
        const url = new URL(anchor.getAttribute('href') || '', location.href);
        return url.origin === location.origin && url.pathname.includes('/comments/')
          ? url.pathname
          : null;
      } catch {
        return null;
      }
    };
    const validPermalinks = safeQueryAll(document, ['a[href]'])
      .filter((anchor) => visible(anchor))
      .map((anchor) => ({ anchor, path: redditPermalinkPath(anchor) }))
      .filter((entry) => entry.path !== null);
    const structuralCandidate = (root) => {
      const meaningfulText = safeQueryAll(root, ['h1', 'h2', 'h3', 'p'])
        .some((element) => (
          visible(element, { width: 20, height: 10, area: 200 })
          && String(element.textContent || '').trim().length >= 4
        ));
      const signalCount = [
        ['[aria-label*="vote" i]'],
        ['[aria-label*="comment" i]'],
        ['time[datetime]'],
        ['img', 'video', 'picture'],
      ].filter((selectors) => safeQueryAll(root, selectors).some((element) => visible(element)))
        .length;
      const ownedPermalinkPaths = new Set(
        validPermalinks
          .filter(({ anchor }) => root.contains(anchor))
          .map(({ path }) => path),
      );
      return !root.matches('html,body,main,[role="main"],[role="feed"]')
        && visible(root, { width: 120, height: 60, area: 7200 })
        && meaningfulText
        && signalCount >= 2
        && ownedPermalinkPaths.size === 1;
    };
    const structuralRootByPermalinkPath = new Map();
    for (const { anchor, path } of validPermalinks) {
      if (structuralRootByPermalinkPath.has(path)) continue;
      let root = anchor.parentElement;
      for (let depth = 0; root && depth < 8; depth += 1, root = root.parentElement) {
        if (structuralCandidate(root)) {
          structuralRootByPermalinkPath.set(path, root);
          break;
        }
      }
    }
    for (const root of safeQueryAll(document, [
      'article',
      '[role="article"]',
      '[role="listitem"]',
    ])) {
      if (!structuralCandidate(root)) continue;
      for (const { anchor, path } of validPermalinks) {
        if (!structuralRootByPermalinkPath.has(path) && root.contains(anchor)) {
          structuralRootByPermalinkPath.set(path, root);
        }
      }
    }
    const structuralPosts = new Set(structuralRootByPermalinkPath.values());
    const posts = new Set([...catalogPosts, ...structuralPosts]);
    const descendants = (roots, selectors, predicate) => {
      const seen = new Set();
      for (const post of roots) {
        for (const element of safeQueryAll(post, selectors)) {
          if (predicate(element)) seen.add(element);
        }
      }
      return seen.size;
    };
    const selectorMetricCount = descendants(catalogPosts, input.metrics, (element) => (
      visible(element)
    ));
    const relationalMetricCount = descendants(structuralPosts, [
      'time[datetime]',
      '[aria-label*="vote" i]',
      '[aria-label*="comment" i]',
      '[aria-label*="ago" i]',
    ], (element) => visible(element));
    const selectorMediaCount = descendants(catalogPosts, input.media, (element) => (
      visible(element, { width: 90, height: 60, area: 6200 })
    ));
    const relationalMediaCount = descendants(
      structuralPosts,
      ['img', 'video', 'picture img'],
      (element) => {
      if (!visible(element, { width: 90, height: 60, area: 6200 })) return false;
      const label = String(element.getAttribute('alt') || element.getAttribute('aria-label') || '');
      return !/(avatar|profile)/iu.test(label);
      },
    );
    const selectorTextCount = descendants(catalogPosts, input.text, (element) => (
      visible(element, { width: 20, height: 10, area: 200 })
      && String(element.textContent || '').trim().length >= 4
    ));
    const relationalTextCount = descendants(structuralPosts, ['h1', 'h2', 'h3', 'p'], (element) => (
      !element.closest('input,textarea,pre,code,[contenteditable="true"]')
      && visible(element, { width: 20, height: 10, area: 200 })
      && String(element.textContent || '').trim().length >= 4
    ));
    const navigation = performance.getEntriesByType('navigation')[0] || null;
    const responseStatus = Number(navigation && navigation.responseStatus);
    const bodyText = String(document.body && document.body.innerText || '').trim();
    const ownerChallengeShaped = [
      document.title,
      ...safeQueryAll(document, ['h1', 'h2'])
        .filter((element) => visible(element))
        .slice(0, 4)
        .map((element) => String(element.textContent || '').trim()),
    ].some((text) => (${isRedditChallengeOwnerText.toString()})(text));
    const challengeSelectorPresent = safeQueryAll(document, [
      'iframe[src*="captcha" i]',
      '[data-testid*="captcha" i]',
      '[class*="captcha" i]',
      '[id*="captcha" i]',
      '[data-testid*="challenge" i]',
    ]).some((element) => visible(element));
    return {
      hostname: location.hostname,
      pathname: location.pathname,
      responseStatus: Number.isFinite(responseStatus) && responseStatus > 0
        ? responseStatus
        : null,
      documentComplete: document.readyState === 'complete',
      loginRoute: /^\\/login(?:\\/|$)/u.test(location.pathname),
      challengePresent: challengeSelectorPresent
        || (${shouldClassifyRedditChallengeTextSurface.toString()})({
          postContainerCount: posts.size,
          bodyText,
          ownerChallengeShaped,
        }),
      postContainerCount: posts.size,
      catalogPostContainerCount: catalogPosts.length,
      structuralPostContainerCount: structuralPosts.size,
      metricOpportunityCount: Math.max(selectorMetricCount, relationalMetricCount),
      mediaOpportunityCount: Math.max(selectorMediaCount, relationalMediaCount),
      textOpportunityCount: Math.max(selectorTextCount, relationalTextCount),
      selectorEvidence: {
        metric: selectorMetricCount,
        media: selectorMediaCount,
        text: selectorTextCount,
      },
      relationshipEvidence: {
        metric: relationalMetricCount,
        media: relationalMediaCount,
        text: relationalTextCount,
      },
    };
  })()`;
}

function mergeObservations(observations) {
  if (!Array.isArray(observations) || observations.length === 0) {
    fail('QA_REDDIT_SURFACE_OBSERVATION_SAMPLE_REQUIRED');
  }
  observations.forEach(validateRedditSurfaceRawObservation);
  const last = observations.at(-1);
  const maximum = (field) => Math.max(...observations.map((entry) => entry[field]));
  const selectorEvidence = Object.freeze({
    metric: Math.max(...observations.map((entry) => entry.selectorEvidence.metric)),
    media: Math.max(...observations.map((entry) => entry.selectorEvidence.media)),
    text: Math.max(...observations.map((entry) => entry.selectorEvidence.text)),
  });
  const relationshipEvidence = Object.freeze({
    metric: Math.max(...observations.map((entry) => entry.relationshipEvidence.metric)),
    media: Math.max(...observations.map((entry) => entry.relationshipEvidence.media)),
    text: Math.max(...observations.map((entry) => entry.relationshipEvidence.text)),
  });
  const catalogPostContainerCount = maximum('catalogPostContainerCount');
  const structuralPostContainerCount = maximum('structuralPostContainerCount');
  const catalogSelectorCoverage = Object.freeze({
    postContainers: catalogPostContainerCount > 0,
    metrics: selectorEvidence.metric > 0,
    media: selectorEvidence.media > 0,
    text: selectorEvidence.text > 0,
  });
  const structuralRecoveryUsed = Object.freeze({
    postContainers:
      catalogPostContainerCount === 0 && structuralPostContainerCount > 0,
    metrics: selectorEvidence.metric === 0 && relationshipEvidence.metric > 0,
    media: selectorEvidence.media === 0 && relationshipEvidence.media > 0,
    text: selectorEvidence.text === 0 && relationshipEvidence.text > 0,
  });
  const structuralRecoveryCategories = OPPORTUNITY_CATEGORIES.filter(
    (key) => structuralRecoveryUsed[key],
  );
  const merged = {
    hostname: last.hostname,
    pathname: last.pathname,
    responseStatus: observations.find((entry) => entry.responseStatus !== null)
      ?.responseStatus ?? null,
    documentComplete: observations.some((entry) => entry.documentComplete === true),
    loginRoute: observations.some((entry) => entry.loginRoute === true),
    challengePresent: observations.some((entry) => entry.challengePresent === true),
    postContainerCount: maximum('postContainerCount'),
    catalogPostContainerCount,
    structuralPostContainerCount,
    metricOpportunityCount: maximum('metricOpportunityCount'),
    mediaOpportunityCount: maximum('mediaOpportunityCount'),
    textOpportunityCount: maximum('textOpportunityCount'),
    selectorEvidence,
    relationshipEvidence,
    catalogSelectorCoverage,
    structuralRecoveryUsed,
    degradation: Object.freeze({
      state: structuralRecoveryCategories.length > 0
        ? 'catalog_selector_miss_structural_opportunity_recovered'
        : 'none',
      categories: Object.freeze(structuralRecoveryCategories),
    }),
    semanticRelationshipOracle: Object.freeze({
      role: 'independent_semantic_element_and_container_relationship_probe',
      productSelectorFallback: false,
    }),
    sampleCount: observations.length,
  };
  return validateRedditSurfaceObservation(merged);
}

export function validateRedditSurfaceObservation(observation) {
  if (
    !hasExactKeys(observation, MERGED_OBSERVATION_KEYS)
    || !hasExactKeys(observation.catalogSelectorCoverage, OPPORTUNITY_CATEGORIES)
    || !hasExactKeys(observation.structuralRecoveryUsed, OPPORTUNITY_CATEGORIES)
    || OPPORTUNITY_CATEGORIES.some((key) => (
      typeof observation.catalogSelectorCoverage[key] !== 'boolean'
      || typeof observation.structuralRecoveryUsed[key] !== 'boolean'
    ))
    || observation.catalogSelectorCoverage.postContainers
      !== (observation.catalogPostContainerCount > 0)
    || observation.catalogSelectorCoverage.metrics
      !== (observation.selectorEvidence.metric > 0)
    || observation.catalogSelectorCoverage.media
      !== (observation.selectorEvidence.media > 0)
    || observation.catalogSelectorCoverage.text
      !== (observation.selectorEvidence.text > 0)
    || observation.structuralRecoveryUsed.postContainers
      !== (
        observation.catalogPostContainerCount === 0
        && observation.structuralPostContainerCount > 0
      )
    || observation.structuralRecoveryUsed.metrics
      !== (
        observation.selectorEvidence.metric === 0
        && observation.relationshipEvidence.metric > 0
      )
    || observation.structuralRecoveryUsed.media
      !== (
        observation.selectorEvidence.media === 0
        && observation.relationshipEvidence.media > 0
      )
    || observation.structuralRecoveryUsed.text
      !== (
        observation.selectorEvidence.text === 0
        && observation.relationshipEvidence.text > 0
      )
    || !hasExactKeys(observation.degradation, ['categories', 'state'])
    || !Array.isArray(observation.degradation.categories)
    || observation.degradation.categories.some(
      (key) => !OPPORTUNITY_CATEGORIES.includes(key),
    )
    || new Set(observation.degradation.categories).size
      !== observation.degradation.categories.length
    || !hasExactKeys(
      observation.semanticRelationshipOracle,
      ['productSelectorFallback', 'role'],
    )
    || observation.semanticRelationshipOracle.role
      !== 'independent_semantic_element_and_container_relationship_probe'
    || observation.semanticRelationshipOracle.productSelectorFallback !== false
  ) {
    fail('QA_REDDIT_SURFACE_MERGED_OBSERVATION_SCHEMA_INVALID');
  }
  const raw = Object.fromEntries(
    RAW_OBSERVATION_KEYS.map((key) => [key, observation[key]]),
  );
  validateRedditSurfaceRawObservation(raw);
  requireCount(observation.sampleCount, 'QA_REDDIT_SURFACE_SAMPLE_COUNT_INVALID');
  if (observation.sampleCount < 1) fail('QA_REDDIT_SURFACE_SAMPLE_COUNT_INVALID');
  const recovered = OPPORTUNITY_CATEGORIES.filter(
    (key) => observation.structuralRecoveryUsed[key],
  );
  const expectedState = recovered.length > 0
    ? 'catalog_selector_miss_structural_opportunity_recovered'
    : 'none';
  if (
    observation.degradation.state !== expectedState
    || !sameStrings(observation.degradation.categories, recovered)
  ) {
    fail('QA_REDDIT_SURFACE_DEGRADATION_EVIDENCE_INVALID');
  }
  return Object.freeze(observation);
}

export async function collectRedditSurfaceObservation({
  cdp,
  sessionId,
  selectorInputs = resolveRedditSurfaceSelectorInputs(),
  evaluatePage = evaluateAttachedPage,
} = {}) {
  const source = createRedditSurfaceObservationSource(selectorInputs);
  const observation = await evaluatePage(cdp, sessionId, source);
  return mergeObservations([observation]);
}

export function classifyRedditSurfaceObservation(observation) {
  validateRedditSurfaceObservation(observation);
  const accessBlocked = observation.loginRoute === true
    || observation.challengePresent === true
    || observation.hostname !== REDDIT_HOSTNAME;
  const routeMatches = REDDIT_ROUTE_PATTERN.test(observation.pathname || '');
  const opportunities = Object.freeze({
    postContainers: observation.postContainerCount > 0,
    metrics: observation.metricOpportunityCount > 0,
    media: observation.mediaOpportunityCount > 0,
    text: observation.textOpportunityCount > 0,
  });
  const complete = !accessBlocked
    && routeMatches
    && observation.documentComplete === true
    && Object.values(opportunities).every(Boolean);
  return Object.freeze({
    status: accessBlocked
      ? QA_RUN_STATUSES.BLOCKED
      : complete
        ? QA_RUN_STATUSES.PASS
        : QA_RUN_STATUSES.INCONCLUSIVE,
    access: accessBlocked ? 'blocked' : 'normal_route',
    routeMatches,
    opportunities,
    complete,
  });
}

export async function executeQaProtocol(context, {
  probeBrowser = probePersistentBrowserCdp,
  verifyBrowserIdentity = verifyAttachedBrowserIdentity,
  capacityFactory = acquireBrowserCapacity,
  cdpFactory = (webSocketUrl) => new CdpConnection(webSocketUrl, {
    commandTimeoutMs: CDP_COMMAND_TIMEOUT_MS,
  }),
  listTargets = listQaCdpTargets,
  collectObservation = collectRedditSurfaceObservation,
} = {}) {
  const {
    plan,
    artifact,
    browser,
    evidence,
  } = context;
  const options = requireProtocolContract(plan, artifact, browser);
  const selectorInputs = resolveRedditSurfaceSelectorInputs();
  const capacity = await capacityFactory({
    rootDir: plan.rootDir,
    ownerId: `${plan.runId}:reddit-surface-observation`,
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
  let observedTarget = null;
  let observation = null;
  let attachedBrowserIdentity = null;
  let browserEpoch = null;
  try {
    const probe = await probeBrowser(browser.cdpEndpoint);
    if (
      probe?.status !== 'ready'
      || typeof probe.browserEpoch !== 'string'
      || typeof probe.webSocketDebuggerUrl !== 'string'
    ) {
      const error = new Error('QA_CDP_UNAVAILABLE');
      error.code = 'QA_CDP_UNAVAILABLE';
      throw error;
    }
    cdp = cdpFactory(probe.webSocketDebuggerUrl);
    await cdp.open();
    attachedBrowserIdentity = await verifyBrowserIdentity(cdp, {
      cdpEndpoint: browser.cdpEndpoint,
      expectedBrowserIdentity: browser.browserIdentity,
    });
    if (
      attachedBrowserIdentity?.status !== 'declared_identity_verified'
      || attachedBrowserIdentity.profileSlotId !== browser.profileSlotId
      || attachedBrowserIdentity.version?.product !== probe.browser
      || attachedBrowserIdentity.version?.protocolVersion !== probe.protocolVersion
    ) {
      fail('QA_REDDIT_SURFACE_CONNECTED_BROWSER_IDENTITY_MISMATCH');
    }
    browserEpoch = probe.browserEpoch;
    baseline = projectPageTargetSet(await listTargets(cdp));
    observedTarget = requireUniqueExistingRedditTarget(baseline, options.targetUrl);
    const attached = await cdp.send('Target.attachToTarget', {
      targetId: observedTarget.targetId,
      flatten: true,
    }, null, { timeoutMs: CDP_COMMAND_TIMEOUT_MS });
    if (typeof attached?.sessionId !== 'string' || !attached.sessionId) {
      fail('QA_REDDIT_SURFACE_ATTACH_SESSION_REQUIRED');
    }
    sessionId = attached.sessionId;
    await cdp.send('Runtime.enable', {}, sessionId, {
      timeoutMs: CDP_COMMAND_TIMEOUT_MS,
    });
    observation = await collectObservation({
      cdp,
      sessionId,
      selectorInputs,
    });
    await cdp.send('Target.detachFromTarget', { sessionId }, null, {
      timeoutMs: CDP_DETACH_TIMEOUT_MS,
    });
    sessionId = null;
    finalInventory = projectPageTargetSet(await listTargets(cdp));
    if (
      finalInventory.count !== baseline.count
      || finalInventory.digest !== baseline.digest
    ) {
      fail('QA_REDDIT_SURFACE_OPERATOR_TARGET_SET_CHANGED');
    }
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
          'QA_REDDIT_SURFACE_OBSERVE_AND_DETACH_FAILED',
          { cause: primaryError },
        );
      }
      if (cleanupErrors.length === 1) throw cleanupErrors[0];
      throw new AggregateError(
        cleanupErrors,
        'QA_REDDIT_SURFACE_DETACH_FAILED',
      );
    }
  }
  const acceptance = classifyRedditSurfaceObservation(observation);
  await evidence.event('QA_REDDIT_SURFACE_ATTACHED_OBSERVED', {
    scope: ATTACHED_SURFACE_SCOPE,
    profileSlotId: browser.profileSlotId,
    access: acceptance.access,
    degradation: observation.degradation,
  });
  const cleanup = Object.freeze({
    processAction: 'attach_disconnect_only',
    observedTargetOwnership: 'operator_owned_borrowed_observation',
    baselinePageTargetSetPreserved: true,
    baselinePageTargetCount: baseline.count,
    finalPageTargetCount: finalInventory.count,
    pageTargetSetDigest: finalInventory.digest,
    targetCreationCount: 0,
    targetNavigationCount: 0,
    targetActivationCount: 0,
    targetCloseCount: 0,
    scrollCount: 0,
    osFocusRequestIssued: false,
  });

  return Object.freeze({
    status: acceptance.status,
    protocol: 'site_runtime_attached',
    scope: ATTACHED_SURFACE_SCOPE,
    site: 'reddit',
    targetUrl: options.targetUrl,
    productEffectAcceptance: 'not_claimed',
    disableReenableAcceptance: 'not_claimed',
    fullReleaseParity: 'not_claimed',
    extensionDisabledControl: Object.freeze({
      state: 'not_applicable',
      reason: 'attach_only_persistent_profile_control_forbidden',
    }),
    actionEvidence: Object.freeze({
      policy: ATTACHED_SETTINGS_SITE_RULE_POLICY,
      settingsCommandCount: 0,
      siteRuleCommandCount: 0,
      artifactStageCount: 0,
      extensionReloadCount: 0,
      pageNavigationCount: 0,
      pageActivationCount: 0,
      boundedScrollCount: 0,
      profileSiteRuntimeSideEffects: 'not_measured_not_restored',
      extensionEffects: 'not_attributed_not_measured',
    }),
    targetAdmission: Object.freeze({
      ownership: 'operator_owned_borrowed_observation',
      exactRouteUnique: true,
      targetCreated: false,
      targetActivated: false,
      targetNavigated: false,
      windowFocusRequested: false,
    }),
    artifactRuntimeIdentity: Object.freeze({
      state: 'not_observed',
      reason: 'attached_access_oracle_does_not_claim_extension_runtime_identity',
    }),
    observation,
    acceptance,
    attachedBrowserObservation: Object.freeze({
      browserClass: 'managed_persistent',
      processOwnership: 'attach_only',
      profileSlotId: browser.profileSlotId,
      browserEpochDigest: sha256Json(browserEpoch),
      connectedIdentityStatus: attachedBrowserIdentity.status,
      connectedProduct: attachedBrowserIdentity.version.product,
      connectedProtocolVersion: attachedBrowserIdentity.version.protocolVersion,
      headless: null,
      processAction: cleanup.processAction,
      baselinePageTargetSetPreserved: cleanup.baselinePageTargetSetPreserved,
      observedTargetOwnership: cleanup.observedTargetOwnership,
      targetCreationCount: cleanup.targetCreationCount,
      targetCloseCount: cleanup.targetCloseCount,
      osFocusRequestIssued: cleanup.osFocusRequestIssued,
    }),
    cleanup,
  });
}
