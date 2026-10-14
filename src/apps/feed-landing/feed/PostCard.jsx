import React, { useId, useMemo } from 'react';
import { FEED_AUTHORS } from '../content/posts.js';
import { projectFeedText } from '../model/projectFeedText.js';
import PostMedia from '../media/PostMedia.jsx';
import { EntropyMark } from '../ui/Icon.jsx';
import PostActions from './PostActions.jsx';
import PostGallery from './PostGallery.jsx';

const POST_FORMATS = new Set(['visual', 'gallery', 'text', 'interactive', 'quote']);

export default function PostCard({
  post,
  state,
  friction,
  reducedMotion,
  repository,
  onComments,
  onShare,
}) {
  const titleId = useId();
  const author = FEED_AUTHORS[post.authorId];
  if (!author) throw new Error(`FEED_AUTHOR_UNKNOWN:${post.authorId}`);
  if (!POST_FORMATS.has(post.format)) throw new Error(`FEED_FORMAT_UNKNOWN:${post.format}`);

  const projectedBody = useMemo(
    () => projectFeedText(post.body, friction.shuffle, post.id),
    [post.body, post.id, friction.shuffle],
  );
  const style = {
    '--post-desaturation': friction.desaturation,
    '--post-blur': `${friction.blurPx}px`,
    '--post-signal-opacity': 1 - friction.signalReduction * 0.58,
  };

  return (
    <article
      id={`post-${post.id}`}
      className={`feed-post feed-post-${post.format}`}
      aria-labelledby={titleId}
      style={style}
      data-post-id={post.id}
    >
      <header className="feed-post-header">
        <span className="feed-avatar" data-author={author.id} aria-hidden="true">
          {author.mark ? <EntropyMark size={22} /> : author.initials}
        </span>
        <div className="feed-author">
          <span className="feed-author-name">
            {author.name}
          </span>
          <span className="feed-author-handle">@{author.handle}{post.meta && <> · {post.meta}</>}</span>
        </div>
      </header>

      <div className="feed-post-content">
        {post.format === 'quote' ? (
          <div className="feed-quote">
            <span aria-hidden="true">“</span>
            <blockquote>{post.quote}</blockquote>
          </div>
        ) : (
          <>
            <div className="feed-post-copy">
              <h2 id={titleId}>{post.title}</h2>
              {post.body && (
                <p>
                  {projectedBody !== post.body ? (
                    <>
                      <span aria-hidden="true">{projectedBody}</span>
                      <span className="feed-sr-only">{post.body}</span>
                    </>
                  ) : post.body}
                </p>
              )}
            </div>
            {post.format === 'gallery' ? (
              <div className="feed-media-filter">
                <PostGallery items={post.gallery} reducedMotion={reducedMotion} />
              </div>
            ) : post.media && (
              <div className="feed-media-filter">
                <PostMedia media={post.media} reducedMotion={reducedMotion} />
              </div>
            )}
          </>
        )}
        {post.format === 'quote' && (
          <div className="feed-post-copy">
            <h2 id={titleId}>{post.title}</h2>
            <p>
              {projectedBody !== post.body ? (
                <>
                  <span aria-hidden="true">{projectedBody}</span>
                  <span className="feed-sr-only">{post.body}</span>
                </>
              ) : post.body}
            </p>
          </div>
        )}
      </div>

      <PostActions
        state={state}
        onLike={() => repository.toggleLike(post.id)}
        onComment={() => onComments(post.id)}
        onShare={() => onShare(post.id)}
      />
      {state.comments.length > 0 && (
        <footer className="feed-post-footer">
          <button type="button" onClick={() => onComments(post.id)}>
            댓글 {state.comments.length}개 보기
          </button>
        </footer>
      )}
    </article>
  );
}
