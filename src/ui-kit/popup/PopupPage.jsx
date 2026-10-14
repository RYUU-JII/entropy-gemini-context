import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  LayoutDashboard,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  buildPopupEffects,
  formatPopupDurationShort,
} from '../../lib/popup/popupPresentation.js';
import { useModalDialogFocus } from '../hooks/useModalDialogFocus.js';
import { SPECIAL_SESSION_DURATION_OPTIONS_MINUTES } from '../../domains/settings/config/specialSession.js';
import PopupMediaSupport from './PopupMediaSupport.jsx';
import Favicon from '../Favicon.jsx';
import { KekkaiIcon } from '../Icons.jsx';

function clampRatio(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(numeric, 1));
}

function resolveStatusTone(tone) {
  if (tone === 'alert' || tone === 'warn' || tone === 'muted' || tone === 'active') {
    return tone;
  }
  return 'ok';
}

function LoadingBlock({ className = '' }) {
  return (
    <div className={`popup-loading-block ${className}`.trim()} />
  );
}

function PopupSiteHeader({
  contextDomain,
  displayDomain,
  pageUrl,
  statusLabel,
}) {
  return (
    <header className="popup-site-header">
      <Favicon
        className="popup-favicon"
        domain={contextDomain}
        fallbackClassName="popup-favicon__letter"
        fallbackLabel={displayDomain}
        fallbackStyle={{ color: 'inherit' }}
        imgClassName="popup-favicon__image"
        pageUrl={pageUrl}
        size={28}
        sourceSize={52}
        style={{ backgroundColor: 'transparent' }}
        unframed
      />
      <div className="popup-site-header__copy">
        <div className="popup-site-header__domain">{displayDomain}</div>
      </div>
      <span className="popup-site-status">{statusLabel}</span>
    </header>
  );
}

function PopupReadout({
  t,
  todayMs,
  weeklyAverageDailyMs,
}) {
  return (
    <section
      className="popup-readout"
      aria-label={t('popup.labels.today')}
    >
      <div className="popup-readout__primary">
        <div className="popup-readout__label">{t('popup.labels.today')}</div>
        <div className="popup-readout__value" data-long={formatPopupDurationShort(todayMs, t).length > 8}>{formatPopupDurationShort(todayMs, t)}</div>
      </div>

      <div className="popup-readout__context">
        <div className="popup-readout__context-row">
          <span>{t('popup.labels.seven_day_avg')}</span>
          <strong>{formatPopupDurationShort(weeklyAverageDailyMs, t)}</strong>
        </div>
      </div>
    </section>
  );
}

function PopupDetailSurface({ title, closeLabel, onClose, isBusy = false, children }) {
  const titleRef = useRef(null);
  const dialogRef = useModalDialogFocus({ onEscape: onClose, escapeBlocked: isBusy, initialFocusRef: titleRef });
  return (
    <section className="popup-detail" role="dialog" aria-modal="true" aria-label={title} ref={dialogRef}>
      <header className="popup-detail__header">
        <button type="button" className="popup-detail__back" onClick={onClose} disabled={isBusy} aria-label={closeLabel}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h2 ref={titleRef} tabIndex={-1}>{title}</h2>
      </header>
      <div className="popup-detail__body">{children}</div>
    </section>
  );
}

function PopupEffects({ snapshot, dashboardHref, t }) {
  const [open, setOpen] = useState(false);
  const effects = buildPopupEffects({ snapshot, t });
  if (!snapshot.protection.isProtected) return null;
  const title = t('popup.design.effects');
  return (
    <>
      <button type="button" className="popup-effects-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span>{title}</span>
        <strong>{String(effects.length).padStart(2, '0')}</strong>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      {open ? (
        <PopupDetailSurface title={title} closeLabel={t('action.close')} onClose={() => setOpen(false)}>
          {effects.length ? ['filter', 'artifact'].map((category) => {
            const entries = effects.filter((effect) => effect.category === category);
            return entries.length ? (
              <section className="popup-effects-group" key={category}>
                <h3>{t(`popup.design.${category}`)}</h3>
                <ul>{entries.map((effect) => <li key={effect.id}><strong>{effect.label}</strong><p>{effect.description}</p></li>)}</ul>
              </section>
            ) : null;
          }) : <p className="popup-detail__intro">{t('popup.design.no_effects')}</p>}
          <a className="popup-detail__dashboard" href={dashboardHref} target="_blank" rel="noreferrer">{t('popup.actions.open_dashboard')} <ArrowUpRight size={16} aria-hidden="true" /></a>
        </PopupDetailSurface>
      ) : null}
    </>
  );
}

function PopupGoalCard({
  goalControlState,
  isSaving,
  onSubmit,
  t,
  todayMs,
}) {
  const savedGoalMinutes = goalControlState.savedGoalMinutes;
  const goalMs = savedGoalMinutes * 60000;
  const progressRatio = goalMs > 0 ? Number(todayMs || 0) / goalMs : 0;
  const progressPercent = clampRatio(progressRatio) * 100;
  const progressValue = Math.round(progressPercent);
  const goalLabel = savedGoalMinutes > 0
    ? formatPopupDurationShort(goalMs, t)
    : t('popup.labels.no_goal');

  return (
    <section
      className="popup-goal-card"
    >
      {goalControlState.showStartSurface ? (
        <div className="popup-goal-card__panel popup-goal-card__panel--locked">
          <div className="popup-goal-card__locked-copy">
            <span>{t('popup.labels.register_site')}</span>
          </div>
          <button
            type="button"
            className="popup-goal-card__start-surface"
            data-busy={isSaving}
            disabled={goalControlState.actionDisabled}
            onClick={onSubmit}
          >
            {goalControlState.actionLabel}
          </button>

          <div
            aria-live="polite"
            className="popup-goal-card__assist"
            data-tone={goalControlState.assistTone}
          >
            {goalControlState.assistText || t('popup.messages.dashboard_goal_hint')}
          </div>
        </div>
      ) : (
        <div className="popup-goal-card__panel popup-goal-card__panel--active">
          <div className="popup-goal-card__progress-head">
            <span>{t('popup.labels.daily_goal')} <strong>{goalLabel}</strong></span>
            {savedGoalMinutes > 0 && <span>{t(progressRatio >= 1 ? 'popup.design.over' : 'popup.design.remaining', { duration: formatPopupDurationShort(Math.abs(goalMs - todayMs), t) })}</span>}
          </div>

          {savedGoalMinutes > 0 && <div
            aria-label={t('popup.labels.progress_against_goal', { goal: savedGoalMinutes })}
            aria-valuemax="100"
            aria-valuemin="0"
            aria-valuenow={progressValue}
            className="popup-goal-card__progress"
            role="progressbar"
          >
            <div
              className="popup-goal-card__progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>}

          <div
            aria-live="polite"
            className="popup-goal-card__assist"
            data-tone={goalControlState.assistTone}
          >
            {goalControlState.assistText || t('popup.messages.dashboard_goal_hint')}
          </div>
        </div>
      )}
    </section>
  );
}

function PopupNotice({
  body,
  title,
  tone = 'muted',
}) {
  return (
    <section
      className="popup-notice"
      data-tone={tone}
    >
      <div className="popup-notice__title">{title}</div>
      <div className="popup-notice__body">{body}</div>
    </section>
  );
}

function PopupRailButton({
  children,
  disabled = false,
  label,
  onClick,
  ...restProps
}) {
  return (
    <button
      type="button"
      className="popup-rail-button"
      aria-label={label}
      data-tooltip={label}
      disabled={disabled}
      onClick={onClick}
      {...restProps}
    >
      {children}
    </button>
  );
}

function PopupIsolationDrawer({
  isBusy = false,
  onConfirm,
  t,
}) {
  const [durationMinutes, setDurationMinutes] = useState(SPECIAL_SESSION_DURATION_OPTIONS_MINUTES[0]);

  return (
    <div className="popup-isolation-drawer" role="group" aria-label={t('popup.isolation_picker.title')}>
      <div className="popup-isolation-drawer__durations">
        {SPECIAL_SESSION_DURATION_OPTIONS_MINUTES.map((minutes) => (
          <button
            key={minutes}
            type="button"
            aria-pressed={durationMinutes === minutes}
            className="popup-isolation-drawer__duration"
            disabled={isBusy}
            onClick={() => setDurationMinutes(minutes)}
          >
            {t('popup.isolation_picker.duration_minutes', { minutes })}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="popup-isolation-drawer__confirm"
        disabled={isBusy}
        onClick={() => onConfirm(durationMinutes)}
      >
        {isBusy ? t('popup.actions.starting_special_session') : t('popup.isolation_picker.start')}
      </button>
    </div>
  );
}

function PopupAppRail({
  canAllowCurrentSiteForSession = false,
  dashboardHref,
  isolationPickerOpen = false,
  isSpecialSessionSaving = false,
  mediaSupport,
  onAllowCurrentSiteForSession,
  onCancelIsolationPicker,
  onConfirmStartIsolationSession,
  onEndSpecialSession,
  onToggleIsolationPicker,
  sitesHref = '',
  specialSession = null,
  specialSessionAction = 'idle',
  t,
}) {
  const [sessionOpen, setSessionOpen] = useState(false);
  const active = specialSession?.active === true;
  useEffect(() => { if (!active) setSessionOpen(false); }, [active]);
  const open = isolationPickerOpen || (active && sessionOpen);
  const close = () => {
    setSessionOpen(false);
    onCancelIsolationPicker?.();
  };
  return (
    <aside className="popup-app-rail" aria-label="Entropy">
      <div className="popup-app-rail__utility-group">
        {typeof onToggleIsolationPicker === 'function' ? (
          <PopupRailButton
            label={active ? t('popup.design.session') : t('popup.actions.start_isolation_session')}
            disabled={isSpecialSessionSaving}
            aria-haspopup="dialog"
            aria-expanded={open}
            data-active={active || open}
            onClick={() => active ? setSessionOpen(true) : onToggleIsolationPicker()}
          >
            <KekkaiIcon size={20} strokeWidth={1.6} aria-hidden="true" />
            <span>{t('popup.design.isolation')}</span>
            {active ? <small className="popup-rail-button__status"><span className="popup-visually-hidden">{t('popup.design.running')}</span></small> : null}
          </PopupRailButton>
        ) : null}
        <PopupMediaSupport media={mediaSupport} t={t} />
      </div>
      <div className="popup-app-rail__nav-group">
        {sitesHref ? (
          <a className="popup-rail-button popup-rail-button--nav popup-rail-button--sites" href={sitesHref} rel="noreferrer" target="_blank" aria-label={t('popup.actions.open_sites')}>
            <SlidersHorizontal size={20} strokeWidth={1.6} aria-hidden="true" />
            <span>{t('popup.design.sites')}</span>
            <ArrowUpRight className="popup-rail-button__external" size={11} strokeWidth={2} aria-hidden="true" />
          </a>
        ) : null}
        <a className="popup-rail-button popup-rail-button--nav popup-rail-button--dashboard" href={dashboardHref} rel="noreferrer" target="_blank" aria-label={t('popup.actions.open_dashboard')}>
          <LayoutDashboard size={20} strokeWidth={1.6} aria-hidden="true" />
          <span>{t('popup.design.dashboard')}</span>
          <ArrowUpRight className="popup-rail-button__external" size={11} strokeWidth={2} aria-hidden="true" />
        </a>
      </div>
      {open ? (
        <PopupDetailSurface title={t('popup.design.session')} closeLabel={t('action.close')} onClose={close} isBusy={isSpecialSessionSaving}>
          {active ? (
            <div className="popup-session-active">
              <KekkaiIcon size={44} strokeWidth={1.2} aria-hidden="true" />
              <h3>{t('popup.design.running')}</h3>
              <p>{t('popup.design.session_active_hint')}</p>
              <button type="button" className="popup-session-end" disabled={isSpecialSessionSaving} onClick={onEndSpecialSession}>
                {t(specialSessionAction === 'end' ? 'popup.actions.ending_special_session' : specialSession.source === 'schedule' ? 'popup.actions.end_occurrence' : 'popup.actions.end_special_session')}
              </button>
              {canAllowCurrentSiteForSession ? (
                <button type="button" className="popup-session-allow" disabled={isSpecialSessionSaving} onClick={onAllowCurrentSiteForSession}>
                  {t(specialSessionAction === 'allow' ? 'popup.actions.allowing_current_site_for_session' : 'popup.actions.allow_current_site_for_session')}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <p className="popup-detail__intro">{t('popup.design.session_hint')}</p>
              <PopupIsolationDrawer isBusy={isSpecialSessionSaving} onConfirm={onConfirmStartIsolationSession} t={t} />
            </>
          )}
        </PopupDetailSurface>
      ) : null}
    </aside>
  );
}

function PopupPermissionFact({
  detail,
  label,
}) {
  return (
    <div
      aria-label={`${label}. ${detail}`}
      className="popup-permission-sheet__fact"
      data-tooltip={detail}
      role="note"
      tabIndex={0}
    >
      {label}
    </div>
  );
}

function PopupPermissionSheet({
  domain,
  isSaving,
  onConfirmDomain,
  onCancel,
  t,
}) {
  const cancelButtonRef = useRef(null);
  const dialogRef = useModalDialogFocus({
    escapeBlocked: isSaving,
    initialFocusRef: cancelButtonRef,
    onEscape: onCancel,
  });

  return (
    <div className="popup-overlay" role="presentation">
      <section
        ref={dialogRef}
        aria-labelledby="popup-permission-sheet-title"
        aria-describedby="popup-permission-sheet-description"
        aria-modal="true"
        aria-busy={isSaving}
        className="popup-card popup-permission-sheet"
        role="dialog"
        tabIndex={-1}
      >
        <div className="popup-permission-sheet__eyebrow">
          {t('popup.permission_sheet.eyebrow')}
        </div>
        <h2 id="popup-permission-sheet-title" className="popup-permission-sheet__title">
          {t('popup.permission_sheet.title', { domain })}
        </h2>
        <p
          id="popup-permission-sheet-description"
          className="popup-permission-sheet__body"
        >
          {t('popup.permission_sheet.body')}
        </p>

        <div className="popup-permission-sheet__facts">
          <PopupPermissionFact
            detail={t('popup.permission_sheet.scope_detail')}
            label={t('popup.permission_sheet.scope')}
          />
          <PopupPermissionFact
            detail={t('popup.permission_sheet.local_only_detail')}
            label={t('popup.permission_sheet.local_only')}
          />
          <PopupPermissionFact
            detail={t('popup.permission_sheet.immediate_apply_detail')}
            label={t('popup.permission_sheet.immediate_apply')}
          />
        </div>

        <div
          className="popup-permission-sheet__actions"
          data-layout="default"
        >
          <button
            ref={cancelButtonRef}
            type="button"
            className="popup-permission-sheet__button popup-permission-sheet__button--secondary"
            disabled={isSaving}
            onClick={onCancel}
          >
            {t('popup.permission_sheet.cancel')}
          </button>
          <button
            type="button"
            className="popup-permission-sheet__button popup-permission-sheet__button--primary"
            disabled={isSaving}
            onClick={onConfirmDomain}
          >
            {isSaving
              ? t('popup.actions.starting_protection')
              : t('popup.permission_sheet.confirm')}
          </button>
        </div>
      </section>
    </div>
  );
}

function PopupLoadingState({ dashboardHref, t }) {
  return (
    <div className="popup-layout popup-layout--supported">
      <section className="popup-card popup-site-panel popup-site-panel--loading">
        <header className="popup-site-header">
          <div className="popup-favicon popup-favicon--loading">
            <span className="popup-favicon__letter">E</span>
          </div>
          <div className="popup-site-header__copy">
            <LoadingBlock className="popup-loading-block--title" />
          </div>
        </header>

        <section className="popup-readout popup-readout--loading">
          <div className="popup-readout__primary">
            <LoadingBlock className="popup-loading-block--label" />
            <LoadingBlock className="popup-loading-block--value" />
            <LoadingBlock className="popup-loading-block--hint" />
          </div>
          <div className="popup-readout__context">
            <LoadingBlock className="popup-loading-block--context" />
            <LoadingBlock className="popup-loading-block--context" />
          </div>
        </section>

        <section className="popup-goal-card">
          <div className="popup-goal-card__panel popup-goal-card__panel--active">
            <LoadingBlock className="popup-loading-block--limit-head" />
            <LoadingBlock className="popup-loading-block--track" />
            <LoadingBlock className="popup-loading-block--assist" />
          </div>
        </section>
      </section>

      <PopupAppRail dashboardHref={dashboardHref} t={t} />
    </div>
  );
}

function PopupSupportedState({
  contextDomain,
  pageUrl,
  canAllowCurrentSiteForSession,
  displayDomain,
  goalControlState,
  handleAllowCurrentSiteForSession,
  handleCancelIsolationPicker,
  handleConfirmStartIsolationSession,
  handleEndSpecialSession,
  handleProtectSite,
  handleToggleIsolationPicker,
  isolationPickerOpen,
  isSaving,
  isSpecialSessionSaving,
  mediaSupport,
  dashboardHref,
  shareOfTracked,
  sitesHref,
  snapshot,
  specialSession,
  specialSessionAction,
  statusMeta,
  t,
  todayMs,
  weeklyAverageDailyMs,
}) {
  const statusTone = resolveStatusTone(statusMeta?.tone);

  return (
    <div className="popup-layout popup-layout--supported" data-isolation-picker-open={isolationPickerOpen}>
      <main
        className="popup-card popup-site-panel"
        data-tone={statusTone}
      >
        <PopupSiteHeader
          contextDomain={contextDomain}
          pageUrl={pageUrl}
          displayDomain={displayDomain}
          statusLabel={statusMeta?.label}
        />

        <PopupReadout
          shareOfTracked={shareOfTracked}
          t={t}
          todayMs={todayMs}
          weeklyAverageDailyMs={weeklyAverageDailyMs}
        />

        <PopupGoalCard
          goalControlState={goalControlState}
          isSaving={isSaving}
          onSubmit={handleProtectSite}
          t={t}
          todayMs={todayMs}
        />

        <PopupEffects snapshot={snapshot} dashboardHref={dashboardHref} t={t} />
      </main>

      <PopupAppRail
        canAllowCurrentSiteForSession={canAllowCurrentSiteForSession}
        dashboardHref={dashboardHref}
        isolationPickerOpen={isolationPickerOpen}
        isSpecialSessionSaving={isSpecialSessionSaving}
        mediaSupport={mediaSupport}
        onAllowCurrentSiteForSession={handleAllowCurrentSiteForSession}
        onCancelIsolationPicker={handleCancelIsolationPicker}
        onConfirmStartIsolationSession={handleConfirmStartIsolationSession}
        onEndSpecialSession={handleEndSpecialSession}
        onToggleIsolationPicker={handleToggleIsolationPicker}
        sitesHref={sitesHref}
        specialSession={specialSession}
        specialSessionAction={specialSessionAction}
        t={t}
      />
    </div>
  );
}

function PopupUnsupportedState({
  contextDomain,
  pageUrl,
  canAllowCurrentSiteForSession,
  displayDomain,
  handleAllowCurrentSiteForSession,
  handleCancelIsolationPicker,
  handleConfirmStartIsolationSession,
  handleEndSpecialSession,
  handleToggleIsolationPicker,
  isolationPickerOpen,
  isSpecialSessionSaving,
  mediaSupport,
  messageCode,
  dashboardHref,
  sitesHref,
  specialSession,
  specialSessionAction,
  statusMeta,
  t,
}) {
  const statusTone = resolveStatusTone(statusMeta?.tone);
  const unsupportedTitle = messageCode === 'load_error'
    ? t('popup.messages.load_error')
    : t('popup.messages.page_unavailable');
  const unsupportedBody = messageCode === 'load_error'
    ? t('popup.messages.dashboard_hint')
    : statusMeta?.detail;

  return (
    <div className="popup-layout popup-layout--unsupported" data-isolation-picker-open={isolationPickerOpen}>
      <main
        className="popup-card popup-site-panel popup-site-panel--notice"
        data-tone={statusTone}
      >
        <PopupSiteHeader
          contextDomain={contextDomain}
          pageUrl={pageUrl}
          displayDomain={displayDomain}
          statusLabel={statusMeta?.label}
        />

        <PopupNotice
          body={unsupportedBody}
          title={unsupportedTitle}
          tone={statusTone}
        />
      </main>

      <PopupAppRail
        canAllowCurrentSiteForSession={canAllowCurrentSiteForSession}
        dashboardHref={dashboardHref}
        isolationPickerOpen={isolationPickerOpen}
        isSpecialSessionSaving={isSpecialSessionSaving}
        mediaSupport={mediaSupport}
        onAllowCurrentSiteForSession={handleAllowCurrentSiteForSession}
        onCancelIsolationPicker={handleCancelIsolationPicker}
        onConfirmStartIsolationSession={handleConfirmStartIsolationSession}
        onEndSpecialSession={handleEndSpecialSession}
        onToggleIsolationPicker={handleToggleIsolationPicker}
        sitesHref={sitesHref}
        specialSession={specialSession}
        specialSessionAction={specialSessionAction}
        t={t}
      />
    </div>
  );
}

export default function PopupPage({
  contextDomain,
  pageUrl,
  canAllowCurrentSiteForSession,
  dashboardHref,
  displayDomain,
  goalControlState,
  handleAllowCurrentSiteForSession,
  handleCancelIsolationPicker,
  handleConfirmStartIsolationSession,
  handleEndSpecialSession,
  handleProtectSite,
  handleToggleIsolationPicker,
  isolationPickerOpen,
  isReady,
  isSaving,
  isSpecialSessionSaving,
  isSupported,
  mediaSupport,
  message,
  messageCode,
  permissionPromptState,
  snapshot,
  sitesHref,
  specialSession,
  specialSessionAction,
  handleCancelPermissionPrompt,
  handleConfirmPermissionPrompt,
  shareOfTracked,
  statusMeta,
  t,
  todayMs,
  weeklyAverageDailyMs,
}) {
  const [dismissedMessage, setDismissedMessage] = useState(null);
  return (
    <div className="popup-shell" data-site-domain={contextDomain}>
      <div
        aria-live="polite"
        className="popup-action-message"
        hidden={!message || dismissedMessage === message}
      >
        <span>{message}</span>
        <button type="button" aria-label={t('action.close')} onClick={() => setDismissedMessage(message)}>×</button>
      </div>

      {!isReady ? (
        <PopupLoadingState dashboardHref={dashboardHref} t={t} />
      ) : isSupported ? (
        <PopupSupportedState
          contextDomain={contextDomain}
          pageUrl={pageUrl}
          canAllowCurrentSiteForSession={canAllowCurrentSiteForSession}
          dashboardHref={dashboardHref}
          displayDomain={displayDomain}
          goalControlState={goalControlState}
          handleAllowCurrentSiteForSession={handleAllowCurrentSiteForSession}
          handleCancelIsolationPicker={handleCancelIsolationPicker}
          handleConfirmStartIsolationSession={handleConfirmStartIsolationSession}
          handleEndSpecialSession={handleEndSpecialSession}
          handleProtectSite={handleProtectSite}
          handleToggleIsolationPicker={handleToggleIsolationPicker}
          isolationPickerOpen={isolationPickerOpen}
          isSaving={isSaving}
          isSpecialSessionSaving={isSpecialSessionSaving}
          mediaSupport={mediaSupport}
          shareOfTracked={shareOfTracked}
          sitesHref={sitesHref}
          snapshot={snapshot}
          specialSession={specialSession}
          specialSessionAction={specialSessionAction}
          statusMeta={statusMeta}
          t={t}
          todayMs={todayMs}
          weeklyAverageDailyMs={weeklyAverageDailyMs}
        />
      ) : (
        <PopupUnsupportedState
          contextDomain={contextDomain}
          pageUrl={pageUrl}
          canAllowCurrentSiteForSession={canAllowCurrentSiteForSession}
          dashboardHref={dashboardHref}
          displayDomain={displayDomain}
          handleAllowCurrentSiteForSession={handleAllowCurrentSiteForSession}
          handleCancelIsolationPicker={handleCancelIsolationPicker}
          handleConfirmStartIsolationSession={handleConfirmStartIsolationSession}
          handleEndSpecialSession={handleEndSpecialSession}
          handleToggleIsolationPicker={handleToggleIsolationPicker}
          isolationPickerOpen={isolationPickerOpen}
          isSpecialSessionSaving={isSpecialSessionSaving}
          mediaSupport={mediaSupport}
          messageCode={messageCode}
          sitesHref={sitesHref}
          specialSession={specialSession}
          specialSessionAction={specialSessionAction}
          statusMeta={statusMeta}
          t={t}
        />
      )}

      {permissionPromptState ? (
        <PopupPermissionSheet
          domain={permissionPromptState.domain}
          isSaving={isSaving}
          onConfirmDomain={handleConfirmPermissionPrompt}
          onCancel={handleCancelPermissionPrompt}
          t={t}
        />
      ) : null}
    </div>
  );
}
