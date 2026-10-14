import React, { useEffect, useId, useRef } from 'react';
import Icon from './Icon.jsx';

export default function Modal({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`feed-modal ${className}`}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="feed-modal-inner">
        <header className="feed-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="feed-icon-button"
            aria-label="닫기"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
