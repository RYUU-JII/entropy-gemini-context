import React, { useEffect, useRef } from 'react';
import { Undo2 } from 'lucide-react';
import { ProtectionReleaseIcon } from '@/ui-kit/Icons.jsx';

export default function SiteReleaseControl({ domain, type, control, labels = {}, t }) {
  const action = useRef(null);
  const confirm = useRef(null);
  const undo = useRef(null);
  const phase = control?.phase || 'idle';
  useEffect(() => {
    if (phase === 'review') confirm.current?.focus({ preventScroll: true });
    if (phase === 'grace') undo.current?.focus({ preventScroll: true });
  }, [phase]);
  if (!control) return null;
  const label = labels.releaseBlocked || t(type === 'blocked' ? 'release.confirm_blocked' : 'release.confirm_allowed');
  return <div className="sites-release-control" data-release-phase={phase} onKeyDown={event => {
    if (event.key !== 'Escape' || !['review', 'grace'].includes(phase)) return;
    event.preventDefault(); event.stopPropagation();
    if (phase === 'review') control.onKeep(); else control.onCancel();
    requestAnimationFrame(() => action.current?.focus({ preventScroll: true }));
  }}>
    {phase === 'idle' ? <button ref={action} type="button" disabled={control.blockedByOtherPending} onClick={control.onRequest}>
      <ProtectionReleaseIcon size={13} aria-hidden="true" />{label}
    </button> : phase === 'review' ? <div className="sites-inline-review">
      <p>{t(type === 'blocked' ? 'release.dialog_body_blocked' : 'release.dialog_body_allowed')}</p>
      <button ref={confirm} type="button" disabled={control.blockedByOtherPending} onClick={control.onConfirm}>{label}</button>
      <button type="button" onClick={() => { control.onKeep(); requestAnimationFrame(() => action.current?.focus()); }}>{t('common:action.cancel')}</button>
    </div> : <>
      <p aria-live="off">{phase === 'grace' ? t('release.grace_title', { domain, seconds: control.remainingSeconds })
        : t(phase === 'failed' ? 'release.failed_body' : 'release.committing')}</p>
      <span className="sr-only" role={phase === 'failed' ? 'alert' : 'status'}>{t(phase === 'grace' ? 'release.grace_body' : phase === 'failed' ? 'release.failed_body' : 'release.committing')}</span>
      {phase !== 'committing' && <button ref={undo} type="button" onClick={() => { control.onCancel(); requestAnimationFrame(() => action.current?.focus()); }}>
        <Undo2 size={13} aria-hidden="true" />{labels.releaseUndo || t('release.cancel_pending')}
      </button>}
      {phase === 'failed' && <button type="button" onClick={control.onRequest}>{t('sites_hud.retry')}</button>}
    </>}
  </div>;
}
