import React, { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Icon from '../ui/Icon.jsx';
import { createPostShareUrl } from '../app/siteConfig.js';

export default function ShareDialog({ post, onClose }) {
  const url = createPostShareUrl(post.id);
  const [status, setStatus] = useState('');
  const copy = async () => {
    if (!navigator.clipboard?.writeText) {
      setStatus('이 브라우저에서는 자동 복사를 지원하지 않습니다. 아래 링크를 선택해 복사하세요.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus('게시물 링크를 복사했습니다.');
    } catch (error) {
      setStatus(`링크 복사가 허용되지 않았습니다. 아래 링크를 직접 복사하세요. (${error.name})`);
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: post.title, text: 'Entropy — 조금 다른 피드', url });
      setStatus('공유 창을 닫았습니다.');
    } catch (error) {
      setStatus(error.name === 'AbortError' ? '공유를 취소했습니다.' : `공유하지 못했습니다. (${error.name})`);
    }
  };
  return (
    <Modal title="이 발견 공유하기" onClose={onClose}>
      <p className="feed-modal-context">{post.title}</p>
      <label className="feed-field-label" htmlFor="feed-share-url">게시물 고유 링크</label>
      <input
        id="feed-share-url"
        className="feed-share-input"
        readOnly
        value={url}
        onFocus={(event) => event.target.select()}
      />
      <div className="feed-share-buttons">
        <button type="button" className="feed-button feed-button-primary" onClick={copy}>
          <Icon name="share" size={16} />링크 복사
        </button>
        {typeof navigator.share === 'function' && (
          <button type="button" className="feed-button" onClick={share}>다른 앱으로 공유</button>
        )}
      </div>
      <p className="feed-status" role="status">{status}</p>
    </Modal>
  );
}
