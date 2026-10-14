export const SITE_CONFIG = Object.freeze({
  sourceUrl: 'https://github.com/RYUU-JII/Entropy',
  developerUrl: 'https://github.com/RYUU-JII',
  supportUrl: 'https://github.com/RYUU-JII/Entropy/issues',
  privacyUrl: './privacy/',
  storeUrl: typeof __ENTROPY_FEED_STORE_URL__ === 'string' ? __ENTROPY_FEED_STORE_URL__ : null,
});

// One install destination: a validated Store listing when configured, otherwise the real project instructions.
export const INSTALL_LINK = Object.freeze(SITE_CONFIG.storeUrl === null
  ? { href: `${SITE_CONFIG.sourceUrl}#빠른-시작`, label: '프로젝트에서 설치 안내 보기' }
  : { href: SITE_CONFIG.storeUrl, label: 'Chrome Web Store에서 보기' });

export function createPostShareUrl(postId) {
  const url = new URL(window.location.href);
  url.hash = `post-${postId}`;
  return url.href;
}
