import React from 'react';

/**
 * Declarative stream endpoint. It states that nothing follows; it asks no question
 * and offers no continuation. The empty run below lets further scrolling find nothing.
 */
export default function FeedTerminus({ horizon }) {
  if (typeof horizon?.title !== 'string' || typeof horizon?.detail !== 'string') throw new Error('FEED_TERMINUS_COPY_REQUIRED');
  return (
    <>
      <section className="feed-horizon feed-terminus" id="feed-horizon" aria-labelledby="feed-horizon-title">
        <div className="feed-horizon-boundary" aria-hidden="true"><span /><i /><span /></div>
        <span className="feed-eyebrow">FEED HORIZON</span>
        <h2 id="feed-horizon-title">{horizon.title}</h2>
        <p>{horizon.detail}</p>
        <span className="feed-horizon-footnote">끝이 없는 흐름에, 하나의 끝.</span>
      </section>
      <div className="feed-terminus-void" aria-hidden="true" />
    </>
  );
}
