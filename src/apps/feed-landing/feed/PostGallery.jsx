import React, { useState } from 'react';
import PostMedia from '../media/PostMedia.jsx';
import Icon from '../ui/Icon.jsx';

export default function PostGallery({ items, reducedMotion }) {
  const [index, setIndex] = useState(0);
  if (!Array.isArray(items) || items.length < 2) throw new Error('FEED_GALLERY_ITEMS_REQUIRED');

  return (
    <div className="feed-gallery" role="group" aria-label="작품 갤러리">
      <PostMedia media={items[index]} reducedMotion={reducedMotion} />
      <span className="feed-gallery-index" aria-live="polite">
        {index + 1} / {items.length}
      </span>
      {index > 0 && (
        <button
          type="button"
          className="feed-gallery-arrow feed-gallery-prev"
          aria-label="이전 작품"
          onClick={() => setIndex(index - 1)}
        >
          <Icon name="chevron" />
        </button>
      )}
      {index < items.length - 1 && (
        <button
          type="button"
          className="feed-gallery-arrow feed-gallery-next"
          aria-label="다음 작품"
          onClick={() => setIndex(index + 1)}
        >
          <Icon name="chevron" />
        </button>
      )}
      <div className="feed-gallery-dots">
        {items.map((item, dot) => (
          <button
            key={`${item.type}-${dot}`}
            type="button"
            aria-label={`${dot + 1}번째 작품 보기`}
            aria-current={dot === index ? 'true' : undefined}
            onClick={() => setIndex(dot)}
          />
        ))}
      </div>
    </div>
  );
}
