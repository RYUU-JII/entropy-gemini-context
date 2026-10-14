import { isElement } from '../resolve/ActiveScrollContainerResolver.js';

export const GENERIC_FEED_ITEM_SELECTOR =
  ':is(article, li, section, figure, div, [role="article"], [role="listitem"])';

const EXCLUDED_TAG_NAMES = new Set([
  'script',
  'style',
  'nav',
  'header',
  'footer',
  'aside',
]);

const CARDISH_CLASS_PATTERN =
  /(card|item|post|feed|story|product|thumb|tile|listing|grid|result)/i;

export function getGenericFeedItemTextLength(node) {
  if (!isElement(node)) return 0;
  return (node.textContent || '').replace(/\s+/g, ' ').trim().length;
}

export function hasGenericFeedItemMedia(node) {
  if (!isElement(node)) return false;
  return !!node.querySelector?.('img, picture img, video, canvas, [role="img"]');
}

export function hasGenericFeedItemAction(node) {
  if (!isElement(node)) return false;
  return !!node.querySelector?.('a[href], button, [role="button"], [role="link"]');
}

export function getGenericFeedItemSiblingSimilarity(node) {
  const parent = node?.parentElement;
  if (!parent) return 0;
  const siblings = Array.from(parent.children || []);
  if (siblings.length < 3) return 0;

  const similarCount = siblings.reduce((count, sibling) => (
    isElement(sibling) && sibling.tagName === node.tagName ? count + 1 : count
  ), 0);
  return similarCount / siblings.length;
}

export function readGenericFeedItemFeatures(node) {
  if (!isElement(node)) {
    return Object.freeze({
      eligible: false,
      canonicalItem: false,
      classHint: false,
      textLength: 0,
      media: false,
      action: false,
      siblingSimilarity: 0,
    });
  }

  const tagName = node.tagName.toLowerCase();
  const className = typeof node.className === 'string' ? node.className : '';
  return Object.freeze({
    eligible: node.isConnected === true && !EXCLUDED_TAG_NAMES.has(tagName),
    canonicalItem: node.matches?.(
      '[role="article"], [role="listitem"], article, li',
    ) === true,
    classHint: CARDISH_CLASS_PATTERN.test(className),
    textLength: getGenericFeedItemTextLength(node),
    media: hasGenericFeedItemMedia(node),
    action: hasGenericFeedItemAction(node),
    siblingSimilarity: getGenericFeedItemSiblingSimilarity(node),
  });
}
