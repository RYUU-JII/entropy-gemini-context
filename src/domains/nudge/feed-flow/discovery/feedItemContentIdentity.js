import { isElement } from '../resolve/ActiveScrollContainerResolver.js';

// Surface-local identity hint only. Never persist DOM content keys as history.
export function buildStableItemContentKey(node) {
  if (!isElement(node)) return '';
  // Prefer an item-level identifier. Lazy-loading a descendant link must not
  // change the identity of an already identified item.
  const attrs = ['data-item-id', 'data-video-id', 'data-post-id', 'data-id'];
  for (const attr of attrs) {
    const value = node.getAttribute?.(attr);
    if (value) return `${attr}:${value}`;
  }

  const contentLinkSelector = [
    'a[href*="/shorts/"]',
    'a[href*="/reel/"]',
    'a[href*="/reels/"]',
    'a[href*="/video/"]',
  ].join(', ');
  const link = node.matches?.(contentLinkSelector)
    ? node
    : node.querySelector?.(contentLinkSelector);
  const href = link?.getAttribute?.('href');
  if (href) {
    const pathname = typeof link?.pathname === 'string' ? link.pathname : '';
    const queryIndex = href.search(/[?#]/);
    const queryFreeHref = queryIndex >= 0 ? href.slice(0, queryIndex) : href;
    const stableHref = pathname ? pathname : queryFreeHref;
    return `href:${stableHref}`;
  }
  return '';
}

