import React from 'react';
import Icon from '../ui/Icon.jsx';

export default function PostActions({ state, onLike, onComment, onShare }) {
  return (
    <div className="feed-post-actions">
      <div className="feed-post-actions-start">
        <button
          type="button"
          aria-label="좋아요"
          aria-pressed={state.liked}
          className={`feed-action ${state.liked ? 'is-liked' : ''}`}
          onClick={onLike}
        >
          <Icon name="heart" />
          <span>{state.likeCount}</span>
        </button>
        <button
          type="button"
          aria-label="댓글"
          className="feed-action"
          onClick={onComment}
        >
          <Icon name="comment" />
          <span>{state.comments.length}</span>
        </button>
        <button
          type="button"
          aria-label="공유"
          className="feed-action"
          onClick={onShare}
        >
          <Icon name="share" />
        </button>
      </div>
    </div>
  );
}
