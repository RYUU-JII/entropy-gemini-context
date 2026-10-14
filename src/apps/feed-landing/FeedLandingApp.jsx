import React, { useEffect, useRef, useState } from 'react';
import '@fontsource-variable/noto-sans-kr/wght.css';
import { FEED_ENDING, FEED_POSTS } from './content/posts.js';
import { SHORT_FORM_POSTS } from './content/shortFormPosts.js';
import { useFeedRepository } from './hooks/useFeedRepository.js';
import { useReducedMotion } from './hooks/useReducedMotion.js';
import { useFrictionJourney } from './experience/useFrictionJourney.js';
import { resolveFrictionState } from './model/frictionJourney.js';
import Navigation from './layout/Navigation.jsx';
import ContextSidebar from './layout/ContextSidebar.jsx';
import PostCard from './feed/PostCard.jsx';
import PostMedia from './media/PostMedia.jsx';
import CommentsDialog from './feed/CommentsDialog.jsx';
import ShareDialog from './feed/ShareDialog.jsx';
import FeedTerminus from './experience/FeedTerminus.jsx';
import FeedAfterword from './experience/FeedAfterword.jsx';
import ShortFormViewport from './shortform/ShortFormViewport.jsx';
import InformationDialog from './app/InformationDialog.jsx';
import SupportDialog from './app/SupportDialog.jsx';
import Icon, { EntropyMark } from './ui/Icon.jsx';
import './styles/index.css';

const ALL_POSTS = Object.freeze([...FEED_POSTS, ...SHORT_FORM_POSTS]);
function shortLinkIndex() {
  return SHORT_FORM_POSTS.findIndex((post) => window.location.hash === `#post-${post.id}`);
}
function startsInShortForm() {
  return window.location.hash === '#shortform' || shortLinkIndex() >= 0;
}

export default function FeedLandingApp() {
  const { repository, snapshot } = useFeedRepository();
  const reducedMotion = useReducedMotion();
  const feedRef = useRef(null);
  const [view, setView] = useState(() => startsInShortForm() ? 'shortform' : 'feed');
  const [modal, setModal] = useState(null);
  const [shortSession, setShortSession] = useState(() => {
    const index = Math.max(0, shortLinkIndex());
    return { index, deepest: index };
  });
  const [shortRequestedIndex, setShortRequestedIndex] = useState(null);
  const feedFriction = useFrictionJourney(feedRef, view === 'feed', reducedMotion);
  const friction = view === 'feed'
    ? feedFriction
    : resolveFrictionState(shortSession.deepest / SHORT_FORM_POSTS.length, reducedMotion);
  const selectedPost = modal?.postId ? ALL_POSTS.find((post) => post.id === modal.postId) : null;
  if (modal?.postId && !selectedPost) throw new Error(`FEED_MODAL_POST_UNKNOWN:${modal.postId}`);
  const closeModal = () => setModal(null);
  const explain = () => setModal({ kind: 'explain' });
  const product = () => setModal({ kind: 'product' });
  const support = () => setModal({ kind: 'support' });
  const comments = (postId) => setModal({ kind: 'comments', postId });
  const share = (postId) => setModal({ kind: 'share', postId });
  const navigate = (next) => {
    if (!['feed', 'shortform'].includes(next)) throw new Error(`FEED_VIEW_UNKNOWN:${next}`);
    setShortRequestedIndex(null);
    setView(next);
    window.history.replaceState(null, '', next === 'shortform' ? '#shortform' : '#feed');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  useEffect(() => {
    let frame = 0;
    const revealHash = () => {
      const index = shortLinkIndex();
      if (index >= 0 || window.location.hash === '#shortform') {
        setView('shortform');
        setShortRequestedIndex(index >= 0 ? index : null);
        return;
      }
      const post = FEED_POSTS.find((item) => window.location.hash === `#post-${item.id}`);
      if (!post) return;
      setView('feed');
      frame = requestAnimationFrame(() => {
        document.getElementById(`post-${post.id}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    };
    frame = requestAnimationFrame(revealHash);
    window.addEventListener('hashchange', revealHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', revealHash);
    };
  }, [view]);

  return (
    <div className="entropy-feed-app" data-view={view} data-friction-phase={friction.phase}>
      <a className="feed-skip-link" href="#feed-main">콘텐츠로 건너뛰기</a>
      <div className="feed-layout">
        <Navigation view={view} onNavigate={navigate} onProduct={product} onSupport={support} />
        <main id="feed-main" className="feed-main" tabIndex={-1}>
          <header className="feed-topbar">
            <div className="feed-mobile-brand"><EntropyMark size={24} /><span>entropy.</span></div>
            <span className="feed-topbar-title">{view === 'shortform' ? '숏폼' : '피드'}</span>
            {view === 'feed' && <span className="feed-journey-hint">Entropy 체험 피드 · 끝까지 내려가 보세요</span>}
            <button type="button" className="feed-icon-button" aria-label="이 피드에 대하여" onClick={explain}><Icon name="info" size={18} /></button>
          </header>
          <h1 className="feed-sr-only">{view === 'shortform' ? 'Entropy 숏폼' : 'Entropy 피드'}</h1>
          {view === 'shortform' ? (
            <ShortFormViewport
              session={shortSession} onSessionChange={setShortSession} requestedIndex={shortRequestedIndex}
              snapshot={snapshot} repository={repository} friction={friction}
              reducedMotion={reducedMotion} suspended={modal !== null}
              onComments={comments} onShare={share} onProduct={product}
            />
          ) : (
            <>
              <div ref={feedRef} className="feed-stream">
                {FEED_POSTS.map((post) => (
                  <PostCard key={post.id} post={post} state={snapshot.posts[post.id]} repository={repository}
                    friction={friction} reducedMotion={reducedMotion} onComments={comments} onShare={share} />
                ))}
              </div>
              <FeedTerminus horizon={FEED_ENDING.horizon} />
              <FeedAfterword
                afterword={FEED_ENDING.afterword} friction={friction}
                comparison={<PostMedia media={FEED_ENDING.comparison.media} reducedMotion={reducedMotion} interactive={false} />}
                comparisonLead={FEED_ENDING.comparison.lead} onProduct={product}
                onRestart={() => window.scrollTo({ top: 0, behavior: 'auto' })}
              />
              <p className="feed-stream-disclosure">작품과 이야기, 계정은 이 체험을 위한 오리지널입니다. 반응은 현재 페이지에서만 유지됩니다.</p>
            </>
          )}
        </main>
        <ContextSidebar />
      </div>
      <nav className="feed-mobile-nav" aria-label="모바일 탐색">
        <button type="button" aria-label="피드" aria-current={view === 'feed' ? 'page' : undefined} onClick={() => navigate('feed')}><Icon name="home" /><span>피드</span></button>
        <button type="button" aria-label="숏폼" aria-current={view === 'shortform' ? 'page' : undefined} onClick={() => navigate('shortform')}><Icon name="shortform" /><span>숏폼</span></button>
        <button type="button" aria-label="Entropy 소개" onClick={product}><EntropyMark size={21} /><span>소개</span></button>
        <button type="button" aria-label="후원 안내" onClick={support}><Icon name="support" /><span>후원</span></button>
      </nav>
      {modal?.kind === 'comments' && <CommentsDialog post={selectedPost} state={snapshot.posts[selectedPost.id]} repository={repository} onClose={closeModal} />}
      {modal?.kind === 'share' && <ShareDialog post={selectedPost} onClose={closeModal} />}
      {modal?.kind === 'support' && <SupportDialog onClose={closeModal} />}
      {(modal?.kind === 'explain' || modal?.kind === 'product') && <InformationDialog kind={modal.kind} onClose={closeModal} />}
    </div>
  );
}
