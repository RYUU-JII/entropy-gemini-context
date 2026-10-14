import { cloneAndFreezeTargetValue } from '../../../targeting/contracts/targetProfileContracts.js';

export const REDDIT_SOCIAL_METRIC_TARGETS = cloneAndFreezeTargetValue({
  metricSelectors: {
    feedbackCounts: [
      '[data-testid="action-row"] [data-post-click-location="vote"] faceplate-number',
      '[data-testid="action-row"] [data-action-bar-action="comments"] faceplate-number',
      '[slot="actionRow"][data-testid="seeker-action-row"] > faceplate-number',
      'reddit-pdp-right-rail-post div:has(> faceplate-number)',
    ],
    viewCounts: [],
    timeSignals: ['faceplate-timeago time'],
    audienceCounts: [],
  },
  scanRoots: [
    'shreddit-post',
    'shreddit-comment',
    '[data-testid="post-container"]',
    '[data-testid*="post" i]',
    '[data-testid*="comment" i]',
    'article',
    'faceplate-timeago',
    'reddit-pdp-right-rail-post',
  ],
});
