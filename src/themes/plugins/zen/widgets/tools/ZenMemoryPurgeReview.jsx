import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { getZenArtifactColorTokens } from '@/themes/core/tools/zenArtifactColorTokens.js';
import './ZenMemoryPurgeReview.css';

const SKELETON_ROW_COUNT = 4;

// The rite's mark, carried in the same slender vertical cell the artifact
// panel uses for its index: 流 lets the traces flow away, 斷 severs the
// handles that lead back. Ornamental, so it stays out of the a11y tree.
const MODE_MARKS = Object.freeze({
  history: '流',
  bookmark_destroy: '斷',
});

/**
 * ZenMemoryPurgeReview
 * - Zen-native presentation for the Lethe (망각의 물결) confirmation sheet.
 * - Reads as one sheet of paper: identity block over a single strong rule,
 *   a tally set in light ink, then the ledger of domains as hairline rows.
 * - Every row draws its own waterline — a hairline as long as that domain's
 *   share of the heaviest one — so "how much of this is me" is legible before
 *   any number is read.
 * - Presentation only: totals, ordering, and handler contracts are owned by
 *   MemoryPurgeReviewSurface.
 */
export default function ZenMemoryPurgeReview({
  modeKey,
  modeCopy,
  accentColor = '',
  items = [],
  hiddenDomainCount = 0,
  totalCount = 0,
  domainCount = 0,
  isLoading = false,
  isBackupBusy = false,
  backupError = '',
  requirePasscode = false,
  passcodeInput = '',
  acknowledged = false,
  confirmationBlocked = false,
  onPasscodeInputChange,
  onAcknowledgedChange,
  onBackupBookmarks,
  onConfirm,
  onCancel,
}) {
  const { t } = useAppTranslation('tools');
  const titleId = useId();
  const descriptionId = useId();
  const returnButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const bodyRef = useRef(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const isBookmarkDestroyMode = modeKey === 'bookmark_destroy';

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    previouslyFocusedRef.current = document.activeElement;
    returnButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [onCancel]);

  // The closing mist is drawn only while something is still below the fold —
  // painted unconditionally it would wash out the privacy note on a short
  // ledger, where there is nothing to hint at.
  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return undefined;
    const sync = () => {
      setHasMoreBelow(node.scrollHeight - node.scrollTop - node.clientHeight > 4);
    };
    sync();
    node.addEventListener('scroll', sync, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(sync) : null;
    observer?.observe(node);
    return () => {
      node.removeEventListener('scroll', sync);
      observer?.disconnect();
    };
  }, [items, isLoading, isBookmarkDestroyMode, requirePasscode]);

  // The waterline is relative to the heaviest domain on the sheet, not to the
  // total: with one dominant domain the rest would otherwise collapse into
  // invisible stubs and the ledger would stop reading as a comparison.
  const heaviestCount = useMemo(
    () => items.reduce((peak, item) => Math.max(peak, item.count), 0),
    [items],
  );

  const surfaceStyle = {
    '--zen-purge-accent': isBookmarkDestroyMode
      ? 'var(--zen-ink-shu)'
      : accentColor === '' ? getZenArtifactColorTokens('echo').controls.accent : accentColor,
  };

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      aria-describedby={modeCopy.description ? descriptionId : undefined}
      data-dashboard-inline-action-review="true"
      data-memory-purge-review={modeKey}
      data-zen-purge-mode={modeKey}
      data-zen-purge-more={hasMoreBelow ? 'true' : 'false'}
      className="zen-purge font-sans"
      style={surfaceStyle}
    >
      <header className="zen-purge__identity">
        <button
          ref={returnButtonRef}
          type="button"
          onClick={onCancel}
          className="zen-purge__return font-sans"
        >
          <span className="zen-purge__return-arrow" aria-hidden="true" />
          {t('history_modal.cancel')}
        </button>

        <div className="zen-purge__identity-top">
          <div className="zen-purge__mark" aria-hidden="true">
            <span>{MODE_MARKS[modeKey] || MODE_MARKS.history}</span>
          </div>

          <div className="min-w-0">
            <span className="zen-purge__eyebrow">{modeCopy.eyebrow}</span>
            <h2 id={titleId} className="zen-purge__title font-heading">
              {modeCopy.title}
            </h2>
          </div>
        </div>

        {modeCopy.description ? (
          <p id={descriptionId} className="zen-purge__inscription font-serif">
            {modeCopy.description}
          </p>
        ) : null}
      </header>

      <div ref={bodyRef} className="zen-purge__body custom-scrollbar">
        <section className="zen-purge__tally">
          <div>
            <p className="zen-purge__count">
              <span className="zen-purge__count-value">{totalCount}</span>
              <span className="zen-purge__count-unit">
                {t('history_modal.records_unit')}
              </span>
            </p>
            <p className="zen-purge__effect">{modeCopy.effect}</p>
          </div>
          <p className="zen-purge__domains">
            {t('history_modal.affected_domains', { count: domainCount })}
          </p>
        </section>

        <section aria-label={t('history_modal.affected_list_label')}>
          <p className="zen-purge__ledger-head">
            {t('history_modal.affected_list_label')}
          </p>

          {isLoading ? (
            <div aria-busy="true">
              {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
                <div key={index} className="zen-purge__skeleton" />
              ))}
            </div>
          ) : null}

          {!isLoading && items.length > 0 ? (
            <div role="list">
              {items.map((item) => (
                <div
                  key={item.domain}
                  role="listitem"
                  className="zen-purge__row"
                  style={{
                    '--zen-purge-row-share': `${heaviestCount > 0
                      ? Math.max(4, Math.round((item.count / heaviestCount) * 100))
                      : 0}%`,
                  }}
                >
                  <span className="zen-purge__row-domain" title={item.domain}>
                    {item.domain}
                  </span>
                  <span className="zen-purge__row-count font-mono">{item.count}</span>
                </div>
              ))}
              {hiddenDomainCount > 0 ? (
                <p className="zen-purge__row-more">
                  {t('history_modal.more_domains', { count: hiddenDomainCount })}
                </p>
              ) : null}
            </div>
          ) : null}

          {!isLoading && items.length === 0 ? (
            <p className="zen-purge__empty font-serif">{modeCopy.empty}</p>
          ) : null}

          <p className="zen-purge__hint font-serif">{t('history_modal.impact_hint')}</p>
        </section>

        {requirePasscode ? (
          <label className="zen-purge__passcode">
            <span className="zen-purge__field-label">
              {t('history_modal.passcode_label')}
            </span>
            <input
              type="password"
              value={passcodeInput}
              onChange={(event) => onPasscodeInputChange(event.target.value)}
              placeholder={t('history_modal.passcode_placeholder')}
              className="zen-purge__passcode-input font-sans"
            />
          </label>
        ) : null}

        {isBookmarkDestroyMode ? (
          <section className="zen-purge__warning">
            <p className="zen-purge__warning-badge">
              {t('history_modal.irreversible_badge')}
            </p>
            <p className="zen-purge__warning-body font-serif">
              {t('history_modal.irreversible_body')}
            </p>
            <button
              type="button"
              onClick={onBackupBookmarks}
              disabled={isLoading || isBackupBusy || items.length === 0}
              className="zen-purge__ghost-button font-sans"
            >
              {isBackupBusy ? t('history_modal.backup_busy') : t('history_modal.backup_cta')}
            </button>
            {backupError ? (
              <p role="alert" className="zen-purge__error">{backupError}</p>
            ) : null}
            <label className="zen-purge__acknowledge">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => onAcknowledgedChange(event.target.checked)}
              />
              <span>{t('history_modal.bookmark_acknowledgement')}</span>
            </label>
          </section>
        ) : null}
      </div>

      <footer className="zen-purge__footer">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmationBlocked}
          className="zen-purge__confirm font-sans"
        >
          {modeCopy.confirm}
        </button>
      </footer>
    </section>
  );
}
