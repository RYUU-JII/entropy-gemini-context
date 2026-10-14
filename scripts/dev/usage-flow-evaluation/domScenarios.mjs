// Authored DOM/geometry expectations. No production, QA, or classifier imports.
// Rectangles are synthetic [left, top, width, height], not browser layout evidence.
export const feedDomScenarios = [
  {
    id: 'vertical-three-items', layout: 'vertical_list', boundarySource: 'declared', selector: 'article',
    html: '<main id="feed"><article id="a"></article><article id="b"></article><article id="c"></article></main>',
    rects: { feed: [0, 0, 800, 600], a: [0, 0, 800, 300], b: [0, 300, 800, 300], c: [0, 600, 800, 300] },
    expected: { boundaries: ['a', 'b', 'c'], visible: ['a', 'b'], fractions: { a: [1, 0.5], c: [0, 0] } },
  },
  {
    id: 'nested-long-document', layout: 'vertical_list', boundarySource: 'heuristic',
    html: '<main id="feed"><article id="a"><div class="post"><div class="post-body"><div class="post-content">'
      + 'A single long article with nested presentation wrappers. '.repeat(80) + '</div></div></div></article></main>',
    rects: { feed: [0, 0, 800, 600], a: [0, 0, 800, 2400] },
    expected: { boundaries: ['a'], visible: ['a'], fractions: { a: [0.25, 1] }, contentClass: 'document' },
  },
  {
    id: 'generic-grid-container-is-not-item', layout: 'grid', boundarySource: 'heuristic',
    html: '<main id="feed"><div class="results-grid"><div id="a" class="product-card"><a href="/a"><img></a></div><div id="b" class="product-card"><a href="/b"><img></a></div><div id="c" class="product-card"><a href="/c"><img></a></div><div id="d" class="product-card"><a href="/d"><img></a></div></div></main>',
    rects: { feed: [0, 0, 800, 600], a: [0, 0, 400, 300], b: [400, 0, 400, 300], c: [0, 300, 400, 300], d: [400, 300, 400, 300] },
    expected: { boundaries: ['a', 'b', 'c', 'd'], visible: ['a', 'b', 'c', 'd'], fractions: { a: [1, 0.25], d: [1, 0.25] }, contentClass: 'feed' },
  },
  {
    id: 'paged-single-visible-item', layout: 'paged_item', boundarySource: 'declared', selector: 'article',
    html: '<main id="feed"><article id="a"><video></video></article><article id="b"><video></video></article></main>',
    rects: { feed: [0, 0, 800, 600], a: [0, 0, 800, 600], b: [0, 600, 800, 600] },
    expected: { boundaries: ['a', 'b'], visible: ['a'], fractions: { a: [1, 1], b: [0, 0] } },
  },
  {
    id: 'paged-mid-transition-retains-both', layout: 'paged_item', boundarySource: 'declared', selector: 'article',
    html: '<main id="feed"><article id="a"></article><article id="b"></article></main>',
    rects: { feed: [0, 0, 800, 600], a: [0, -300, 800, 600], b: [0, 300, 800, 600] },
    expected: { boundaries: ['a', 'b'], visible: ['a', 'b'], fractions: { a: [0.5, 0.5], b: [0.5, 0.5] } },
  },
  {
    id: 'nested-comments-belong-to-post', layout: 'vertical_list', boundarySource: 'heuristic',
    html: '<main id="feed"><article id="a"><section><article id="comment"></article><ul><li id="reply"></li></ul></section></article><article id="b"></article></main>',
    rects: { feed: [0, 0, 800, 600], a: [0, 0, 800, 400], b: [0, 400, 800, 400] },
    expected: { boundaries: ['a', 'b'], visible: ['a', 'b'], fractions: { b: [0.5, 1 / 3] } },
  },
  {
    id: 'inner-scroller-clips-cards', layout: 'vertical_list', boundarySource: 'declared', selector: 'article',
    html: '<main id="feed"><div id="clip" style="overflow:auto"><article id="a"></article><article id="b"></article></div></main>',
    rects: { feed: [0, 0, 800, 600], clip: [0, 100, 800, 200], a: [0, 0, 800, 200], b: [0, 300, 800, 200] },
    expected: { boundaries: ['a', 'b'], visible: ['a'], fractions: { a: [0.5, 1 / 6], b: [0, 0] } },
  },
  {
    id: 'hidden-panel-is-not-exposed', layout: 'grid', boundarySource: 'declared', selector: 'article',
    html: '<main id="feed"><div hidden><article id="a"></article></div><article id="b"></article></main>',
    rects: { feed: [0, 0, 800, 600], a: [0, 0, 400, 600], b: [400, 0, 400, 600] },
    expected: { boundaries: ['a', 'b'], visible: ['b'], fractions: { a: [null, null], b: [1, 0.5] } },
  },
  {
    id: 'hidden-document-has-no-exposure', layout: 'paged_item', boundarySource: 'declared', selector: 'article', visibility: 'hidden',
    html: '<main id="feed"><article id="a"></article></main>',
    rects: { feed: [0, 0, 800, 600], a: [0, 0, 800, 600] },
    expected: { boundaries: ['a'], visible: [], fractions: { a: [null, null] } },
  },
  {
    id: 'zero-geometry-is-unavailable', layout: 'vertical_list', boundarySource: 'declared', selector: 'article',
    html: '<main id="feed"><article id="a"></article></main>',
    rects: { feed: [0, 0, 800, 600], a: [0, 0, 0, 0] },
    expected: { boundaries: ['a'], visible: [], fractions: { a: [null, null] } },
  },
  {
    id: 'offscreen-supply-is-not-exposure', layout: 'vertical_list', boundarySource: 'declared', selector: 'article',
    html: '<main id="feed"><article id="a"></article><article id="new"></article></main>',
    rects: { feed: [0, 0, 800, 600], a: [0, 0, 800, 600], new: [0, 4000, 800, 600] },
    expected: { boundaries: ['a', 'new'], visible: ['a'], fractions: { new: [0, 0] } },
  },
  {
    id: 'autoplay-aside-is-outside-region', layout: 'paged_item', boundarySource: 'declared', selector: 'article',
    html: '<main id="feed"><article id="a"><video></video></article></main><aside><article id="ad"><video autoplay></video></article></aside>',
    rects: { feed: [0, 0, 600, 600], a: [0, 0, 600, 600], ad: [600, 0, 200, 150] },
    expected: { boundaries: ['a'], visible: ['a'], fractions: { a: [1, 1] } },
  },
];

export const feedIdentityScenarios = [
  { id: 'same-content-remount', initial: '<article data-post-id="a"></article>', replacement: '<article data-post-id="a"></article>', operation: 'remount', expectedFresh: 0 },
  { id: 'different-content-remount', initial: '<article data-post-id="a"></article>', replacement: '<article data-post-id="b"></article>', operation: 'remount', expectedFresh: 1 },
  { id: 'same-node-new-content', initial: '<article data-post-id="a"></article>', replacement: '<article data-post-id="b"><span>new body</span></article>', operation: 'recycle', expectedFresh: 1 },
  { id: 'nested-content-update', initial: '<article data-post-id="a"></article>', replacement: '<article data-post-id="a"><article><span>new comment</span></article></article>', operation: 'recycle', expectedFresh: 0 },
  { id: 'identity-becomes-available', initial: '<article></article>', replacement: '<article data-post-id="a"><span>loaded</span></article>', operation: 'recycle', expectedFresh: 0 },
  { id: 'lazy-link-does-not-replace-identified-content', initial: '<article data-post-id="a"></article>', replacement: '<article data-post-id="a"><a href="/video/a">loaded</a></article>', operation: 'recycle', expectedFresh: 0 },
  // Unkeyed remounts are node supply, explicitly not proven unique content.
  { id: 'unkeyed-remount-is-only-node-supply', initial: '<article></article>', replacement: '<article></article>', operation: 'remount', expectedFresh: 1 },
];
