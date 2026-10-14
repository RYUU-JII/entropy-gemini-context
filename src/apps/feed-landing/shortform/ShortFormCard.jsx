import React, { useId, useMemo, useState } from 'react';
import { FEED_AUTHORS } from '../content/posts.js';
import { SHORT_FORM_FORMATS } from '../content/shortFormPosts.js';
import { projectFeedText } from '../model/projectFeedText.js';
import Icon, { EntropyMark } from '../ui/Icon.jsx';
import ShortFormVideo from './ShortFormVideo.jsx';

export default function ShortFormCard({ post, active, state, repository, friction, suspended, reducedMotion, onComments, onShare, onProduct }) {
  const titleId = useId();
  const author = FEED_AUTHORS[post.authorId];
  if (!author) throw new Error(`SHORT_FORM_AUTHOR_UNKNOWN:${post.authorId}`);
  if (!SHORT_FORM_FORMATS.includes(post.format)) throw new Error(`SHORT_FORM_FORMAT_UNKNOWN:${post.format}`);
  const [burst, setBurst] = useState(0);
  const projectedBody = useMemo(() => projectFeedText(post.body, friction.shuffle, post.id), [post, friction.shuffle]);
  const like = () => {
    if (!state.liked) { repository.toggleLike(post.id); setBurst((value) => value + 1); }
  };
  const style = {
    '--short-desaturation': friction.desaturation,
    '--short-blur': `${friction.blurPx}px`,
    '--short-signal-opacity': 1 - friction.signalReduction * 0.85,
  };
  return (
    <article id={`post-${post.id}`} className={`short-card short-card-${post.format}`} aria-labelledby={titleId} aria-hidden={!active} inert={!active} data-active={active} style={style}>
      <div className="short-surface">
        <ShortFormVideo video={post.video} active={active} suspended={suspended} reducedMotion={reducedMotion} onLike={like} />
        <div className="short-shade" aria-hidden="true" />
        <header className="short-profile">
          <button type="button" className="short-profile-avatar" aria-label="Entropy 소개" onClick={onProduct}><EntropyMark size={24} /></button>
          <span>{author.name}</span>
        </header>
        <div className="short-caption">
          {post.format === 'reel' && <strong>@{author.handle}</strong>}
          <h2 id={titleId}>{post.title}</h2>
          <p>{projectedBody !== post.body ? <><span aria-hidden="true">{projectedBody}</span><span className="feed-sr-only">{post.body}</span></> : post.body}</p>
        </div>
        <div className="short-actions" role="group" aria-label="영상 반응">
          <button type="button" aria-label="좋아요" aria-pressed={state.liked} onClick={() => repository.toggleLike(post.id)} className={state.liked ? 'is-liked' : ''}><Icon name="heart" size={28} /><span>{state.likeCount}</span></button>
          <button type="button" aria-label="댓글" onClick={() => onComments(post.id)}><Icon name="comment" size={27} /><span>{state.comments.length}</span></button>
          <button type="button" aria-label="공유" onClick={() => onShare(post.id)}><Icon name="share" size={26} /></button>
        </div>
        {burst > 0 && !reducedMotion && <span key={burst} className="short-like-burst" aria-hidden="true" onAnimationEnd={() => setBurst(0)}><Icon name="heart" size={90} /></span>}
      </div>
    </article>
  );
}
