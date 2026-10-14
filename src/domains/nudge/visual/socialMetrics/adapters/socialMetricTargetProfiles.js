import {
  TARGET_MERGE_POLICIES,
  TARGET_VALUE_KINDS,
  createTargetProfileResolver,
  defineTargetProfileFields,
} from '../../../targeting/contracts/targetProfileContracts.js';
import { SOCIAL_METRIC_FILTER_KEYS } from '../contracts/socialMetricContracts.js';
import { FACEBOOK_SOCIAL_METRIC_TARGETS } from './facebookProfile.js';
import { INSTAGRAM_SOCIAL_METRIC_TARGETS } from './instagramProfile.js';
import { REDDIT_SOCIAL_METRIC_TARGETS } from './redditProfile.js';
import { TIKTOK_SOCIAL_METRIC_TARGETS } from './tiktokProfile.js';
import { X_SOCIAL_METRIC_TARGETS } from './xProfile.js';
import { YOUTUBE_SOCIAL_METRIC_TARGETS } from './youtubeProfile.js';

export const SOCIAL_METRIC_TARGET_PROFILE_SCHEMA = Object.freeze({
  metricSelectors: Object.freeze({
    kind: TARGET_VALUE_KINDS.SELECTOR_LIST_MAP,
    keys: SOCIAL_METRIC_FILTER_KEYS,
    allowEmpty: true,
    requireAllInOverrides: true,
  }),
  scanRoots: Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR_LIST, allowEmpty: true }),
});

export const SOCIAL_METRIC_TARGET_MERGE_POLICIES = Object.freeze({
  metricSelectors: TARGET_MERGE_POLICIES.REPLACE,
  scanRoots: TARGET_MERGE_POLICIES.REPLACE,
});

const SOCIAL_METRIC_TARGET_PROFILES = {
  default: {
    metricSelectors: {
      feedbackCounts: [],
      viewCounts: [],
      timeSignals: [],
      audienceCounts: [],
    },
    scanRoots: [],
  },
  youtube: YOUTUBE_SOCIAL_METRIC_TARGETS,
  x: X_SOCIAL_METRIC_TARGETS,
  instagram: INSTAGRAM_SOCIAL_METRIC_TARGETS,
  tiktok: TIKTOK_SOCIAL_METRIC_TARGETS,
  facebook: FACEBOOK_SOCIAL_METRIC_TARGETS,
  reddit: REDDIT_SOCIAL_METRIC_TARGETS,
};

export const getSocialMetricTargetProfile = createTargetProfileResolver({
  ownerId: 'social_metrics',
  schema: SOCIAL_METRIC_TARGET_PROFILE_SCHEMA,
  mergePolicies: SOCIAL_METRIC_TARGET_MERGE_POLICIES,
  profiles: SOCIAL_METRIC_TARGET_PROFILES,
});

export function getSocialMetricTargets(hostname = '') {
  return getSocialMetricTargetProfile(hostname).targets;
}

export function validateSocialMetricTargets(targets) {
  return defineTargetProfileFields({
    ownerId: 'social_metrics',
    schema: SOCIAL_METRIC_TARGET_PROFILE_SCHEMA,
    fields: targets,
    path: 'runtime_override',
  });
}
