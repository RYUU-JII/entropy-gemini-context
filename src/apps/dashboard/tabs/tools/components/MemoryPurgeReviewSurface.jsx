import React, { Suspense, useEffect, useMemo, useState } from 'react';

import InlineActionReviewSurface from '../../../components/InlineActionReviewSurface.jsx';
import { THEME_IDS } from '@/themes/core/ids.js';
import { getThemeWidget } from '@/themes/core/registry/index.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

const VISIBLE_DOMAIN_LIMIT = 7;

function resolveModeKey(mode) {
  return mode === 'bookmark_destroy' ? 'bookmark_destroy' : 'history';
}

function resolveCountForMode(item, modeKey) {
  if (modeKey === 'history') {
    return Math.max(0, Number(item?.historyCount) || Number(item?.count) || 0);
  }
  return Math.max(0, Number(item?.bookmarkCount) || Number(item?.count) || 0);
}

function requireReviewHandler(handler, propName) {
  if (typeof handler !== 'function') {
    throw new Error(`[MemoryPurgeReviewSurface] Missing required handler "${propName}".`);
  }
  return handler;
}

function resolveModeCopy(t, modeKey) {
  if (modeKey === 'bookmark_destroy') {
    return {
      eyebrow: t('history_modal.modes.bookmark_destroy.badge'),
      title: t('history_modal.modes.bookmark_destroy.title'),
      description: t('history_modal.modes.bookmark_destroy.desc'),
      empty: t('history_modal.modes.bookmark_destroy.empty'),
      confirm: t('history_modal.modes.bookmark_destroy.confirm'),
      effect: t('history_modal.effects.bookmark_destroy'),
    };
  }
  return {
    eyebrow: t('history_modal.modes.history.badge'),
    title: t('history_modal.modes.history.title'),
    description: t('history_modal.modes.history.desc'),
    empty: t('history_modal.modes.history.empty'),
    confirm: t('history_modal.modes.history.confirm'),
    effect: t('history_modal.effects.history'),
  };
}

export default function MemoryPurgeReviewSurface({
  themeId = '',
  accentColor = '',
  mode = 'history',
  preview = null,
  requirePasscode = false,
  passcodeInput = '',
  backupState = null,
  onPasscodeInputChange = null,
  onBackupBookmarks = null,
  onConfirm,
  onCancel,
}) {
  const { t } = useAppTranslation('tools');
  // Only themes that declare their own sheet are asked for one; probing a
  // theme that does not would log a missing-widget error on every render.
  const ThemeReviewSurface = useMemo(() => (
    themeId === THEME_IDS.ZEN
      ? getThemeWidget(themeId, 'ArtifactMemoryPurgeReview')
      : null
  ), [themeId]);
  const modeKey = resolveModeKey(mode);
  const modeCopy = useMemo(() => resolveModeCopy(t, modeKey), [modeKey, t]);
  const [acknowledged, setAcknowledged] = useState(false);
  const isBookmarkDestroyMode = modeKey === 'bookmark_destroy';
  const isLoading = preview?.loading === true;
  const isBackupBusy = backupState?.loading === true;
  const normalizedItems = useMemo(() => (
    Array.isArray(preview?.items)
      ? preview.items
        .map((item) => ({ domain: item?.domain, count: resolveCountForMode(item, modeKey) }))
        .sort((left, right) => right.count - left.count)
      : []
  ), [modeKey, preview?.items]);
  const visibleItems = normalizedItems.slice(0, VISIBLE_DOMAIN_LIMIT);
  const hiddenDomainCount = Math.max(0, normalizedItems.length - visibleItems.length);
  const totalCount = normalizedItems.reduce((sum, item) => sum + item.count, 0);

  useEffect(() => {
    setAcknowledged(false);
  }, [modeKey]);

  const confirmHandler = requireReviewHandler(onConfirm, 'onConfirm');
  const cancelHandler = requireReviewHandler(onCancel, 'onCancel');
  const passcodeInputChangeHandler = requirePasscode
    ? requireReviewHandler(onPasscodeInputChange, 'onPasscodeInputChange')
    : onPasscodeInputChange;
  const backupBookmarksHandler = isBookmarkDestroyMode
    ? requireReviewHandler(onBackupBookmarks, 'onBackupBookmarks')
    : onBackupBookmarks;
  const confirmationBlocked = isLoading
    || isBackupBusy
    || (requirePasscode && !passcodeInput.trim())
    || (isBookmarkDestroyMode && !acknowledged);

  // Zen owns its own sheet: the garden's paper/hairline/ink language cannot be
  // reached by restyling the console-shaped default surface, so the theme
  // renders the same view model instead of inheriting this markup.
  if (themeId === THEME_IDS.ZEN) {
    if (!ThemeReviewSurface) {
      throw new Error(
        `[MemoryPurgeReviewSurface] Theme "${themeId}" declares no ArtifactMemoryPurgeReview widget.`,
      );
    }
    return (
      <Suspense fallback={null}>
        <ThemeReviewSurface
          modeKey={modeKey}
          modeCopy={modeCopy}
          accentColor={accentColor}
          items={visibleItems}
          hiddenDomainCount={hiddenDomainCount}
          totalCount={totalCount}
          domainCount={normalizedItems.length}
          isLoading={isLoading}
          isBackupBusy={isBackupBusy}
          backupError={backupState?.error || ''}
          requirePasscode={requirePasscode}
          passcodeInput={passcodeInput}
          acknowledged={acknowledged}
          confirmationBlocked={confirmationBlocked}
          onPasscodeInputChange={passcodeInputChangeHandler}
          onAcknowledgedChange={setAcknowledged}
          onBackupBookmarks={backupBookmarksHandler}
          onConfirm={confirmHandler}
          onCancel={cancelHandler}
        />
      </Suspense>
    );
  }

  return (
    <InlineActionReviewSurface
      eyebrow={modeCopy.eyebrow}
      title={modeCopy.title}
      description={modeCopy.description}
      backLabel={t('history_modal.cancel')}
      onBack={cancelHandler}
      tone={isBookmarkDestroyMode ? 'danger' : 'warning'}
      className="bg-transparent"
      actions={(
        <div className="flex justify-end">
          <button
            type="button"
            onClick={confirmHandler}
            disabled={confirmationBlocked}
            className={`rounded-[8px] border bg-surface px-4 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
              isBookmarkDestroyMode
                ? 'border-danger/30 text-danger hover:border-danger/45 hover:bg-danger/5'
                : 'border-accent/25 text-accent hover:border-accent/40 hover:bg-surface-elevated'
            }`}
          >
            {modeCopy.confirm}
          </button>
        </div>
      )}
    >
      <div data-memory-purge-review={modeKey} className="space-y-5">
        <section className="border-y border-border/30 py-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-muted">
                {modeCopy.effect}
              </p>
              <p className="mt-2 text-[2rem] font-black leading-none tabular-nums text-on-surface">
                {t('history_modal.preview_total', { count: totalCount })}
              </p>
            </div>
            <p className="pb-0.5 text-right font-mono text-[10px] uppercase tracking-[0.12em] text-on-surface-muted">
              {t('history_modal.affected_domains', { count: normalizedItems.length })}
            </p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-on-surface-muted">
            {t('history_modal.impact_hint')}
          </p>
        </section>

        <section aria-label={t('history_modal.affected_list_label')}>
          {isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse border-b border-border/25 bg-surface-elevated/15" />
              ))}
            </div>
          ) : null}

          {!isLoading && visibleItems.length > 0 ? (
            <div role="list" className="divide-y divide-border/30 border-y border-border/30">
              {visibleItems.map((item) => (
                <div key={item.domain} role="listitem" className="flex items-center justify-between gap-4 py-3">
                  <span className="min-w-0 truncate text-[12px] font-medium text-on-surface-muted" title={item.domain}>
                    {item.domain}
                  </span>
                  <span className="shrink-0 font-mono text-[12px] font-bold tabular-nums text-on-surface">
                    {item.count}
                  </span>
                </div>
              ))}
              {hiddenDomainCount > 0 ? (
                <div className="py-3 text-[11px] text-on-surface-muted">
                  {t('history_modal.more_domains', { count: hiddenDomainCount })}
                </div>
              ) : null}
            </div>
          ) : null}

          {!isLoading && visibleItems.length === 0 ? (
            <p className="border-y border-dashed border-border/40 py-6 text-center text-sm text-on-surface-muted">
              {modeCopy.empty}
            </p>
          ) : null}
        </section>

        {requirePasscode ? (
          <label className="block border-b border-border/30 pb-5">
            <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-muted">
              {t('history_modal.passcode_label')}
            </span>
            <input
              type="password"
              value={passcodeInput}
              onChange={(event) => passcodeInputChangeHandler(event.target.value)}
              placeholder={t('history_modal.passcode_placeholder')}
              className="w-full rounded-[8px] border border-border/35 bg-surface px-3 py-2.5 text-sm text-on-surface outline-hidden transition focus:border-accent/35"
            />
          </label>
        ) : null}

        {isBookmarkDestroyMode ? (
          <section className="space-y-4 border-y border-danger/25 py-4">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-danger">
                {t('history_modal.irreversible_badge')}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-on-surface-muted">
                {t('history_modal.irreversible_body')}
              </p>
            </div>
            <button
              type="button"
              onClick={backupBookmarksHandler}
              disabled={isLoading || isBackupBusy || visibleItems.length === 0}
              className="rounded-[8px] border border-border/40 bg-surface px-3 py-2 text-xs font-semibold text-on-surface-muted transition hover:border-accent/25 hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isBackupBusy ? t('history_modal.backup_busy') : t('history_modal.backup_cta')}
            </button>
            {backupState?.error ? (
              <p role="alert" className="text-xs leading-relaxed text-danger">{backupState.error}</p>
            ) : null}
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-danger)]"
              />
              <span className="text-xs font-semibold leading-relaxed text-on-surface">
                {t('history_modal.bookmark_acknowledgement')}
              </span>
            </label>
          </section>
        ) : null}
      </div>
    </InlineActionReviewSurface>
  );
}
