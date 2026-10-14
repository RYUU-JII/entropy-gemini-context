import React, { useEffect, useId, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';

function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ');
}

const TONE_CLASSES = Object.freeze({
  neutral: 'text-on-surface-muted',
  warning: 'text-warning',
  danger: 'text-danger',
  accent: 'text-accent',
});

export default function InlineActionReviewSurface({
  eyebrow = '',
  title,
  description = '',
  backLabel,
  onBack,
  tone = 'neutral',
  children,
  actions = null,
  className = '',
}) {
  const titleId = useId();
  const descriptionId = useId();
  const backButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    previouslyFocusedRef.current = document.activeElement;
    backButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onBack();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [onBack]);

  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('INLINE_ACTION_REVIEW_TITLE_REQUIRED');
  }
  if (typeof backLabel !== 'string' || !backLabel.trim()) {
    throw new Error('INLINE_ACTION_REVIEW_BACK_LABEL_REQUIRED');
  }
  if (typeof onBack !== 'function') {
    throw new Error('INLINE_ACTION_REVIEW_BACK_HANDLER_REQUIRED');
  }

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-dashboard-inline-action-review="true"
      className={joinClasses(
        'flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface text-on-surface',
        className,
      )}
    >
      <header className="shrink-0 border-b border-border/30 px-5 pb-4 pt-5">
        <button
          ref={backButtonRef}
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-muted transition hover:text-on-surface focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/30"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {backLabel}
        </button>
        {eyebrow ? (
          <p className={joinClasses(
            'text-[10px] font-black uppercase tracking-[0.16em]',
            TONE_CLASSES[tone] || TONE_CLASSES.neutral,
          )}>
            {eyebrow}
          </p>
        ) : null}
        <h2 id={titleId} className="mt-2 text-[1.65rem] font-black leading-tight tracking-tight">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-3 text-[13px] leading-relaxed text-on-surface-muted">
            {description}
          </p>
        ) : null}
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-5">
        {children}
      </div>

      {actions ? (
        <footer className="shrink-0 border-t border-border/30 bg-surface px-5 py-4">
          {actions}
        </footer>
      ) : null}
    </section>
  );
}
