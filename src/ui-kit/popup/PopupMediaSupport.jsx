import { ArrowLeft, MonitorPlay, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { useModalDialogFocus } from '../hooks/useModalDialogFocus.js';
import './PopupMediaSupport.css';

function MediaSupportDialog({ media, onClose, t }) {
  const busy = media.permission.status === 'requesting';
  const titleRef = useRef(null);
  const dialogRef = useModalDialogFocus({ onEscape: onClose, escapeBlocked: busy, initialFocusRef: titleRef });
  const result = media.result;
  const observed = result?.frames.filter((frame) => frame.observedCount !== null);
  const observedCount = observed?.reduce((count, frame) => count + frame.observedCount, 0);
  return (
    <section className="popup-detail" role="dialog" aria-modal="true" aria-label={t('popup.media_support.title')} ref={dialogRef}>
      <header className="popup-detail__header">
        <button type="button" className="popup-detail__back" onClick={onClose} disabled={busy} aria-label={t('action.close')}>
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h2 ref={titleRef} tabIndex={-1}>{t('popup.media_support.title')}</h2>
      </header>
      <div className="popup-detail__body popup-media-support">
        <p>{t('popup.media_support.scope')}</p>
        <button type="button" className="popup-media-support__refresh" onClick={media.refresh} disabled={busy || media.status === 'loading'}>
          <RefreshCw size={14} aria-hidden="true" />
          {t(media.status === 'loading' ? 'popup.media_support.loading' : 'popup.media_support.refresh')}
        </button>
        {media.status === 'failed' ? <p role="alert">{t('popup.media_support.load_failed')}</p> : null}
        {result ? (
          <>
            <p>{t(result.coverage === 'unknown' ? 'popup.media_support.coverage_unknown' : 'popup.media_support.coverage_known', { count: result.frames.length })}</p>
            <dl className="popup-media-support__facts">
              <dt>{t('popup.media_support.detected')}</dt>
              <dd>{observed.length ? t(observed.length < result.frames.length ? 'popup.media_support.count_partial' : 'popup.media_support.count', { count: observedCount }) : t('popup.media_support.unobserved')}</dd>
              <dt>{t('popup.media_support.pause_supported')}</dt>
              <dd>{t('popup.media_support.frames', { count: result.frames.filter((frame) => frame.pause === 'supported').length })}</dd>
              <dt>{t('popup.media_support.command_accepted')}</dt>
              <dd>{t('popup.media_support.frames', { count: result.frames.filter((frame) => frame.commandAccepted).length })}</dd>
              <dt>{t('popup.media_support.pause_verified')}</dt>
              <dd>{t('popup.media_support.frames', { count: result.frames.filter((frame) => frame.verifiedPaused).length })}</dd>
              <dt>{t('popup.media_support.resume_supported')}</dt>
              <dd>{t('popup.media_support.frames', { count: result.frames.filter((frame) => frame.resume === 'supported').length })}</dd>
              <dt>{t('popup.media_support.seek')}</dt>
              <dd>{t('popup.media_support.seek_unavailable')}</dd>
            </dl>
            <p>{t(result.activeHolds > 0 ? 'popup.media_support.hold_active' : 'popup.media_support.hold_inactive')}</p>
            <p>{t('popup.media_support.evidence_scope')}</p>
            {result.frames.some((frame) => frame.status === 'managed_by_top') ? <p>{t('popup.media_support.managed_by_top')}</p> : null}
            {result.frames.some((frame) => ['failed', 'partial', 'receiver_unavailable'].includes(frame.status)) ? <p role="status">{t('popup.media_support.partial')}</p> : null}
            {result.requiredOrigins.length > 0 ? (
              <section className="popup-media-support__permissions" aria-label={t('popup.media_support.permission_title')}>
                <h3>{t('popup.media_support.permission_title')}</h3>
                <p>{t('popup.media_support.permission_scope')}</p>
                <ul>{result.requiredOrigins.map((origin) => (
                  <li key={origin}>
                    <span>{origin}</span>
                    <button type="button" disabled={busy || media.status !== 'ready'} onClick={() => media.requestOrigin(origin)}>
                      {t('popup.media_support.allow_origin', { origin })}
                    </button>
                  </li>
                ))}</ul>
              </section>
            ) : null}
          </>
        ) : null}
        <div aria-live="polite">
          {media.permission.status === 'granted' ? <p>{t('popup.media_support.granted_reload')}</p> : null}
          {media.permission.status === 'denied' ? <p>{t('popup.media_support.permission_denied')}</p> : null}
          {media.permission.status === 'failed' ? <p role="alert">{t(media.permission.errorCode === 'EMBED_MEDIA_PERMISSION_PORT_UNSUPPORTED' ? 'popup.media_support.port_unsupported' : 'popup.media_support.permission_failed')}</p> : null}
        </div>
      </div>
    </section>
  );
}

export default function PopupMediaSupport({ media, t }) {
  const [open, setOpen] = useState(false);
  if (!media?.available) return null;
  return (
    <>
      <button type="button" className="popup-rail-button" aria-label={t('popup.media_support.title')} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setOpen(true); void media.refresh(); }}>
        <MonitorPlay size={20} strokeWidth={1.6} aria-hidden="true" />
        <span>{t('popup.media_support.label')}</span>
      </button>
      {open ? <MediaSupportDialog media={media} onClose={() => setOpen(false)} t={t} /> : null}
    </>
  );
}
