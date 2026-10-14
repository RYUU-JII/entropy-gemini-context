import {
  isFacebookHost,
  isInstagramHost,
  isRedditHost,
  isTikTokHost,
  isXHost,
  isYoutubeHost,
  normalizeSocialMetricsHost,
} from './hostUtils.js';

const numericCounter = /^\s*[\d,.]+(?:\.\d+)?\s*(천|만|억|K|M|B)?\s*$/i;
const timeSignal = /\d+\s*(초|분|시간|일|주|개월|년)\s*전/i;
const englishAgoSignal =
  /\d+\s*(?:seconds?|secs?|minutes?|mins?|hours?|days?|weeks?|months?|years?)\s+ago/i;
const compactTimeSignal = /^\s*(?:now|\d+\s*(?:s|m|h|d|w|mo|y))\s*$/i;
const dateSignal =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\d{4}[./-]\d{1,2}[./-]\d{1,2}/i;
const countLabelSignal =
  /\b\d[\d,.]*(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:likes?|reactions?|comments?|replies?|shares?|views?|plays?|followers?|following|upvotes?|bookmarks?|quotes?|reposts?|retweets?)\b/i;
const labelCountSignal =
  /\b(?:likes?|reactions?|comments?|replies?|shares?|views?|plays?|followers?|following|upvotes?|bookmarks?|quotes?|reposts?|retweets?)\s*\d[\d,.]*(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\b/i;

function getYoutubeTextPatterns(filterKey) {
  if (filterKey === 'feedbackCounts') {
    return [
      numericCounter,
      /(?:댓글|답글)\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*개?/i,
      countLabelSignal,
      labelCountSignal,
    ];
  }
  if (filterKey === 'viewCounts') {
    return [
      /조회수|views?/i,
      /^\s*[\d,.]+(?:\.\d+)?\s*(천|만|억|K|M|B)?\s*회?\s*$/i,
      /^\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)\s*[·•]\s*(?:\d+\s*(?:초|분|시간|일|주|개월|년)\s*전|\d+\s*(?:seconds?|secs?|minutes?|mins?|hours?|days?|weeks?|months?|years?)\s+ago)\s*$/i,
    ];
  }
  if (filterKey === 'timeSignals') {
    return [
      timeSignal,
      englishAgoSignal,
      /^\s*\d+\s*(?:s|m|h|d|w|mo|y)\s+ago\s*$/i,
      dateSignal,
    ];
  }
  if (filterKey === 'audienceCounts') return [/구독자|subscribers?/i, numericCounter];
  return [];
}

function getXTextPatterns(filterKey) {
  if (filterKey === 'feedbackCounts') {
    return [numericCounter, countLabelSignal, labelCountSignal];
  }
  if (filterKey === 'viewCounts') {
    return [
      numericCounter,
      countLabelSignal,
      labelCountSignal,
      /(?:^|[·•]\s*)[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:posts?|게시물)(?:\s*[·•]|$)/i,
    ];
  }
  if (filterKey === 'timeSignals') {
    return [
      timeSignal,
      englishAgoSignal,
      compactTimeSignal,
      /(?:^|[·•]\s*)trending\s+now(?:\s*[·•]|$)/i,
      /^[A-Za-z]{3}\s+\d{1,2}$/i,
      dateSignal,
    ];
  }
  if (filterKey === 'audienceCounts') {
    return [
      numericCounter,
      countLabelSignal,
      labelCountSignal,
      /^\s*[\d,.]+(?:\.\d+)?\s*(?:K|M|B|천|만|억)?\s*(?:posts?|게시물)\s*$/i,
    ];
  }
  return [];
}

function getInstagramTextPatterns(filterKey) {
  if (filterKey === 'feedbackCounts') {
    return [/좋아요|like|likes|댓글|답글|comment|reply/i, numericCounter];
  }
  if (filterKey === 'viewCounts') {
    return [
      /조회|views?/i,
      /^\s*[\d,.]+(?:\.\d+)?\s*(천|만|억|K|M|B)?\s*회?\s*$/i,
    ];
  }
  if (filterKey === 'timeSignals') return [timeSignal, /^\s*\d+\s*일\s*$/i, dateSignal];
  if (filterKey === 'audienceCounts') {
    return [/팔로워|followers?|팔로잉|following/i, numericCounter];
  }
  return [];
}

function getTikTokTextPatterns(filterKey) {
  if (filterKey === 'feedbackCounts' || filterKey === 'viewCounts' || filterKey === 'audienceCounts') {
    return [numericCounter, countLabelSignal, labelCountSignal];
  }
  if (filterKey === 'timeSignals') {
    return [
      timeSignal,
      englishAgoSignal,
      compactTimeSignal,
      /^\s*\d{1,2}-\d{1,2}\s*$/i,
      dateSignal,
    ];
  }
  return [];
}

function getFacebookTextPatterns(filterKey) {
  if (filterKey === 'feedbackCounts') {
    return [
      numericCounter,
      countLabelSignal,
      labelCountSignal,
      /(?:좋아요|반응|공감|댓글|답글|공유|리포스트|재게시|likes?|reactions?|comments?|replies?|shares?|reposts?|reshares?)\s*[:：]?\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:명|개|회|번)?|[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:명|개|회|번)?\s*(?:좋아요|반응|공감|댓글|답글|공유|리포스트|재게시|likes?|reactions?|comments?|replies?|shares?|reposts?|reshares?)/i,
    ];
  }
  if (filterKey === 'viewCounts') {
    return [
      numericCounter,
      countLabelSignal,
      labelCountSignal,
      /(?:조회|재생|views?|plays?)\s*[:：]?\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:명|개|회|번)?|[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:명|개|회|번)?\s*(?:조회|재생|views?|plays?)/i,
    ];
  }
  if (filterKey === 'timeSignals') {
    return [
      timeSignal,
      englishAgoSignal,
      compactTimeSignal,
      /^\s*\d+\s*(?:초|분|시간|일|주|개월|년)\s*$/i,
      dateSignal,
    ];
  }
  if (filterKey === 'audienceCounts') {
    return [
      numericCounter,
      countLabelSignal,
      labelCountSignal,
      /(?:팔로워|팔로잉|followers?|following)\s*[:：]?\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:명|개)?|[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:명|개)?\s*(?:팔로워|팔로잉|followers?|following)/i,
    ];
  }
  return [];
}

function getRedditTextPatterns(filterKey) {
  if (filterKey === 'feedbackCounts') {
    return [
      numericCounter,
      countLabelSignal,
      labelCountSignal,
      /(?:좋아요|업보트|댓글|likes?|upvotes?|comments?)\s*[:：]?\s*[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:개|회|번)?|[\d,.]+(?:\.\d+)?\s*(?:천|만|억|K|M|B)?\s*(?:개|회|번)?\s*(?:좋아요|업보트|댓글|likes?|upvotes?|comments?)/i,
    ];
  }
  if (filterKey === 'viewCounts' || filterKey === 'audienceCounts') {
    return [numericCounter, countLabelSignal, labelCountSignal];
  }
  if (filterKey === 'timeSignals') {
    return [
      timeSignal,
      englishAgoSignal,
      compactTimeSignal,
      /^\s*\d+\s*(?:s|m|h|d|w|mo|y)\s+ago\s*$/i,
      dateSignal,
    ];
  }
  return [];
}

export function getSocialMetricTextPatternsForHost(hostname, filterKey) {
  const host = normalizeSocialMetricsHost(hostname);
  if (isYoutubeHost(host)) return getYoutubeTextPatterns(filterKey);
  if (isXHost(host)) return getXTextPatterns(filterKey);
  if (isInstagramHost(host)) return getInstagramTextPatterns(filterKey);
  if (isTikTokHost(host)) return getTikTokTextPatterns(filterKey);
  if (isFacebookHost(host)) return getFacebookTextPatterns(filterKey);
  if (isRedditHost(host)) return getRedditTextPatterns(filterKey);
  return [];
}
