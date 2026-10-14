import React, { useRef } from 'react';
import { SHORT_FORM_ENDING, SHORT_FORM_POSTS } from '../content/shortFormPosts.js';
import { useShortFormNavigation } from './useShortFormNavigation.js';
import ShortFormCard from './ShortFormCard.jsx';
import FeedTerminus from '../experience/FeedTerminus.jsx';
import FeedAfterword from '../experience/FeedAfterword.jsx';
import Icon from '../ui/Icon.jsx';

export default function ShortFormViewport({ session, onSessionChange, requestedIndex, snapshot, repository, friction, reducedMotion, suspended, onComments, onShare, onProduct }) {
  const viewportRef = useRef(null);
  const lastIndex = SHORT_FORM_POSTS.length;
  const { goTo, onKeyDown } = useShortFormNavigation({ viewportRef, lastIndex, session, onSessionChange, reducedMotion, requestedIndex });
  return (
    <div className="short-stage">
      <div ref={viewportRef} className="short-viewport" role="region" aria-label="숏폼 영상 피드" tabIndex={0} onKeyDown={onKeyDown} data-short-index={session.index}>
        {SHORT_FORM_POSTS.map((post, index) => (
          <ShortFormCard key={post.id} post={post} active={session.index === index} state={snapshot.posts[post.id]} repository={repository} friction={friction} reducedMotion={reducedMotion} suspended={suspended} onComments={onComments} onShare={onShare} onProduct={onProduct} />
        ))}
        <div className="short-terminus" data-active={session.index === lastIndex} aria-hidden={session.index !== lastIndex} inert={session.index !== lastIndex}>
          <FeedTerminus horizon={SHORT_FORM_ENDING.horizon} />
          <FeedAfterword
            afterword={SHORT_FORM_ENDING.afterword} friction={friction}
            comparison={<img className="short-comparison-poster" src={SHORT_FORM_ENDING.comparison.poster} alt={SHORT_FORM_ENDING.comparison.alt} />}
            comparisonLead={SHORT_FORM_ENDING.comparison.lead} onProduct={onProduct}
            onRestart={() => goTo(0)}
          />
        </div>
      </div>
      <nav className="short-page-controls" aria-label="영상 이동">
        <button type="button" aria-label="이전 영상" disabled={session.index === 0} onClick={() => goTo(session.index - 1)}><Icon name="chevron" /></button>
        <button type="button" aria-label="다음 영상" disabled={session.index === lastIndex} onClick={() => goTo(session.index + 1)}><Icon name="chevron" /></button>
      </nav>
    </div>
  );
}
