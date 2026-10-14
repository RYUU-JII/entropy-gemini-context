import {
  collectFacebookSemanticMetricCandidates,
  collectFacebookSemanticMutationRoots,
  createFacebookSemanticMetricCandidateCollectionPlan,
} from './facebookAdapter.js';
import {
  collectInstagramSemanticMetricCandidates,
  collectInstagramSemanticMutationRoots,
  createInstagramSemanticMetricCandidateCollectionPlan,
} from './instagramAdapter.js';
import {
  collectYoutubeSemanticMetricCandidates,
  collectYoutubeSemanticMutationRoots,
  createYoutubeSemanticMetricCandidateCollectionPlan,
} from './youtubeAdapter.js';
import {
  collectXSemanticMetricCandidates,
  collectXSemanticMutationRoots,
  createXSemanticMetricCandidateCollectionPlan,
} from './xAdapter.js';
import {
  collectRedditSemanticMetricCandidates,
  collectRedditSemanticMutationRoots,
  createRedditSemanticMetricCandidateCollectionPlan,
} from './redditAdapter.js';
import {
  collectTikTokSemanticMetricCandidates,
  collectTikTokSemanticMutationRoots,
  createTikTokSemanticMetricCandidateCollectionPlan,
} from './tiktokAdapter.js';
import {
  REDDIT_SEMANTIC_MUTATION_ATTRIBUTES,
} from './redditSemanticMutationAttributes.js';
import {
  isFacebookHost,
  isInstagramHost,
  isRedditHost,
  isTikTokHost,
  isXHost,
  isYoutubeHost,
  normalizeSocialMetricsHost,
} from './hostUtils.js';

const ACTION_SEMANTIC_MUTATION_ATTRIBUTES = Object.freeze([
  'aria-label',
  'href',
  'role',
  'title',
]);
const INSTAGRAM_SEMANTIC_MUTATION_ATTRIBUTES = Object.freeze([
  ...ACTION_SEMANTIC_MUTATION_ATTRIBUTES,
  'contenteditable',
]);
const TIKTOK_SEMANTIC_MUTATION_ATTRIBUTES = Object.freeze([
  'aria-label',
  'data-e2e',
  'role',
]);
const EMPTY_SEMANTIC_MUTATION_ATTRIBUTES = Object.freeze([]);

function createInstagramSemanticAdapter() {
  return Object.freeze({
    collectMetricCandidates: (entry) => collectInstagramSemanticMetricCandidates(entry),
    createMetricCandidateCollectionPlan: (entry) => (
      createInstagramSemanticMetricCandidateCollectionPlan(entry)
    ),
    collectMutationRoots: (payload) => collectInstagramSemanticMutationRoots(payload),
  });
}

function createFacebookSemanticAdapter() {
  return Object.freeze({
    collectMetricCandidates: (entry) => collectFacebookSemanticMetricCandidates(entry),
    createMetricCandidateCollectionPlan: (entry) => (
      createFacebookSemanticMetricCandidateCollectionPlan(entry)
    ),
    collectMutationRoots: (payload) => collectFacebookSemanticMutationRoots(payload),
  });
}

function createYoutubeSemanticAdapter() {
  return Object.freeze({
    collectMetricCandidates: (entry) => collectYoutubeSemanticMetricCandidates(entry),
    createMetricCandidateCollectionPlan: (entry) => (
      createYoutubeSemanticMetricCandidateCollectionPlan(entry)
    ),
    collectMutationRoots: (payload) => collectYoutubeSemanticMutationRoots(payload),
  });
}

function createXSemanticAdapter(activeEntries = []) {
  const collectMetricCandidates = (entry) => collectXSemanticMetricCandidates(entry);
  return Object.freeze({
    collectMetricCandidates,
    createMetricCandidateCollectionPlan: (entry) => (
      createXSemanticMetricCandidateCollectionPlan(entry)
    ),
    collectMutationRoots: (payload) => (
      activeEntries.flatMap((entry) => collectXSemanticMutationRoots(payload, entry))
    ),
  });
}

function createRedditSemanticAdapter() {
  return Object.freeze({
    collectMetricCandidates: (entry) => collectRedditSemanticMetricCandidates(entry),
    createMetricCandidateCollectionPlan: (entry) => (
      createRedditSemanticMetricCandidateCollectionPlan(entry)
    ),
    collectMutationRoots: (payload) => collectRedditSemanticMutationRoots(payload),
  });
}

function createTikTokSemanticAdapter() {
  return Object.freeze({
    collectMetricCandidates: (entry) => collectTikTokSemanticMetricCandidates(entry),
    createMetricCandidateCollectionPlan: (entry) => (
      createTikTokSemanticMetricCandidateCollectionPlan(entry)
    ),
    collectMutationRoots: (payload) => collectTikTokSemanticMutationRoots(payload),
  });
}

const EMPTY_SEMANTIC_ADAPTER = Object.freeze({
  collectMetricCandidates: () => [],
  createMetricCandidateCollectionPlan: () => Object.freeze({
    scopes: Object.freeze([]),
    createScopeCursor: () => Object.freeze({
      next: () => ({ done: true, value: undefined }),
    }),
  }),
  collectMutationRoots: () => [],
});

export function getPlatformSemanticMutationAttributes(hostname = '') {
  const host = normalizeSocialMetricsHost(hostname);
  if (isRedditHost(host)) return REDDIT_SEMANTIC_MUTATION_ATTRIBUTES;
  if (isTikTokHost(host)) return TIKTOK_SEMANTIC_MUTATION_ATTRIBUTES;
  if (isInstagramHost(host)) return INSTAGRAM_SEMANTIC_MUTATION_ATTRIBUTES;
  if (
    isFacebookHost(host)
    || isYoutubeHost(host)
    || isXHost(host)
  ) {
    return ACTION_SEMANTIC_MUTATION_ATTRIBUTES;
  }
  return EMPTY_SEMANTIC_MUTATION_ATTRIBUTES;
}

export function createPlatformSemanticAdapter(hostname = '', activeEntries = []) {
  const host = normalizeSocialMetricsHost(hostname);
  if (isFacebookHost(host)) return createFacebookSemanticAdapter();
  if (isInstagramHost(host)) return createInstagramSemanticAdapter();
  if (isYoutubeHost(host)) return createYoutubeSemanticAdapter();
  if (isXHost(host)) return createXSemanticAdapter(activeEntries);
  if (isRedditHost(host)) return createRedditSemanticAdapter();
  if (isTikTokHost(host)) return createTikTokSemanticAdapter();
  return EMPTY_SEMANTIC_ADAPTER;
}
