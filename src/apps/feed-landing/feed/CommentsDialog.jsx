import React, { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import { EntropyMark } from '../ui/Icon.jsx';
import { MAX_COMMENT_LENGTH } from '../data/createSessionFeedRepository.js';

export default function CommentsDialog({ post, state, repository, onClose }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const updateDraft = (event) => {
    const nextDraft = event.target.value;
    if (Array.from(nextDraft).length <= MAX_COMMENT_LENGTH) setDraft(nextDraft);
  };
  const submit = (event) => {
    event.preventDefault();
    try {
      repository.addComment(post.id, draft);
      setDraft('');
      setError('');
    } catch (failure) {
      setError(`댓글을 남기지 못했습니다. ${failure.message}`);
    }
  };
  return (
    <Modal title="댓글" onClose={onClose}>
      <p className="feed-modal-context">{post.title}</p>
      <div className="feed-comments-list" aria-live="polite">
        {state.comments.length === 0 && (
          <div className="feed-empty-comments">
            <span className="feed-comment-glyph">↳</span>
            <h3>아직은 조용한 공간.</h3>
            <p>이 작품에서 발견한 것을 남겨보세요.</p>
          </div>
        )}
        {state.comments.map((comment) => (
          <div className="feed-comment" key={comment.id}>
            <span className="feed-avatar"><EntropyMark size={18} /></span>
            <div>
              <strong>{comment.author}</strong>
              <p>{comment.body}</p>
              <button
                type="button"
                onClick={() => repository.removeComment(post.id, comment.id)}
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      <form className="feed-comment-form" onSubmit={submit}>
        <label htmlFor="feed-comment-draft">댓글 남기기</label>
        <textarea
          id="feed-comment-draft"
          value={draft}
          onChange={updateDraft}
          aria-describedby="feed-comment-limit"
          rows={3}
          placeholder="어떤 생각이 들었나요?"
          required
        />
        <div>
          <span id="feed-comment-limit">{Array.from(draft).length} / {MAX_COMMENT_LENGTH}</span>
          <button
            className="feed-button feed-button-primary"
            type="submit"
            disabled={!draft.trim()}
          >
            게시
          </button>
        </div>
      </form>
      {error && <p role="alert" className="feed-error">{error}</p>}
      <p className="feed-session-notice">이 시제품의 댓글과 반응은 현재 페이지에서만 유지됩니다. 새로고침하면 사라집니다.</p>
    </Modal>
  );
}
