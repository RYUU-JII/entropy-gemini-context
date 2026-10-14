import {
  TARGET_MERGE_POLICIES,
  TARGET_VALUE_KINDS,
  createTargetProfileResolver,
} from '../targeting/contracts/targetProfileContracts.js';

export const BEHAVIOR_TARGET_PROFILE_SCHEMA = Object.freeze({
  feedObservationItemTargets: Object.freeze({ kind: TARGET_VALUE_KINDS.SELECTOR }),
});

export const BEHAVIOR_TARGET_MERGE_POLICIES = Object.freeze({
  feedObservationItemTargets: TARGET_MERGE_POLICIES.REPLACE,
});

const BEHAVIOR_TARGET_PROFILES = {
  default: {
    feedObservationItemTargets:
      ':is(article, main, section, figure, [role="article"], [role="main"], [role="listitem"])',
  },
  youtube: {
    feedObservationItemTargets:
      ':is(ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, yt-lockup-view-model)',
  },
  x: {
    feedObservationItemTargets: ':is(article, [data-testid="tweet"])',
  },
  instagram: {
    feedObservationItemTargets: ':is(article, section[role="dialog"], div[role="dialog"])',
  },
  tiktok: {
    feedObservationItemTargets:
      ':is([data-e2e="recommend-list-item-container"], [data-e2e="user-post-item"], [data-e2e*="feed-item" i], [data-e2e*="video-item" i], [data-e2e*="browse-video" i], [data-e2e*="video-player" i], [data-e2e*="recommend-video" i])',
  },
  facebook: {
    feedObservationItemTargets:
      ':is([role="article"], [data-pagelet^="FeedUnit_"], [data-pagelet*="FeedUnit" i], [aria-posinset][aria-describedby])',
  },
  reddit: {
    feedObservationItemTargets:
      ':is(shreddit-post, shreddit-comment, [data-testid="post-container"], [data-testid*="post" i], article)',
  },
};

export const getBehaviorTargetProfile = createTargetProfileResolver({
  ownerId: 'behavior',
  schema: BEHAVIOR_TARGET_PROFILE_SCHEMA,
  mergePolicies: BEHAVIOR_TARGET_MERGE_POLICIES,
  profiles: BEHAVIOR_TARGET_PROFILES,
});

export function getBehaviorTargets(hostname = '') {
  return getBehaviorTargetProfile(hostname).targets;
}
