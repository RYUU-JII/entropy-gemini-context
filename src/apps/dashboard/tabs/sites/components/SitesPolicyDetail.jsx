import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { SitesProtectionMark, sitesRecordingLabel } from '@/themes/core/widgets/shared/sites/index.js';

export function SitesRecordingActions({ domain, recording, onExclude, onSettings, onManageExclusions, isPresented = true, minimal = false, excluded = false, restoring = false, onRestore }) {
  const { t } = useAppTranslation('sites');
  const [review, setReview] = useState(false);
  const [pending, setPending] = useState(false);
  const trigger = useRef(null);
  const confirm = useRef(null);
  const restoreFocus = useRef(false);
  useEffect(() => { if (!isPresented) setReview(false); }, [isPresented]);
  useEffect(() => { if (review) confirm.current?.focus({ preventScroll: true }); }, [review]);
  useLayoutEffect(() => {
    if (!review && !pending && restoreFocus.current && isPresented) {
      restoreFocus.current = false;
      if (document.activeElement === document.body) trigger.current?.focus({ preventScroll: true });
    }
  }, [review, pending, excluded, isPresented]);
  if (!domain) return null;
  const run = async () => {
    if (pending) return;
    setPending(true);
    try { if (await onExclude(domain) !== false) { restoreFocus.current = true; setReview(false); } } finally { setPending(false); }
  };
  return <div className="sites-recording-actions" data-presentation={minimal ? 'note' : 'standard'} onKeyDown={event => {
    if (event.key === 'Escape' && review && !pending) {
      event.preventDefault(); event.stopPropagation(); setReview(false); trigger.current?.focus({ preventScroll: true });
    }
  }}>
    <span>{sitesRecordingLabel(recording, t)}</span>
    {excluded ? <button ref={trigger} type="button" disabled={restoring} onClick={() => void onRestore(domain)}>{t(restoring ? 'tracking_exclusion.restoring' : 'tracking_exclusion.restore')}</button>
      : recording.reason === 'excluded' ? <button ref={trigger} type="button" onClick={onManageExclusions}>{t('recording.manage_exclusions')}</button>
      : <button ref={trigger} type="button" disabled={pending} aria-expanded={review} onClick={() => setReview(!review)}>{t('recording.exclude')}</button>}
    <button type="button" onClick={onSettings}>{t('recording.settings')}</button>
    {review && <div className="sites-inline-review" aria-busy={pending}>
      <p>{t('recording.exclude_body')}</p>
      <button ref={confirm} type="button" disabled={pending} onClick={() => void run()}>{t('recording.exclude')}</button>
      <button type="button" disabled={pending} onClick={() => { setReview(false); trigger.current?.focus(); }}>{t('common:action.cancel')}</button>
    </div>}
  </div>;
}

export default function SitesPolicyDetail({ entry, world = 'standard', onSettings }) {
  const { t } = useAppTranslation('sites');
  const { recording, type } = entry;
  const isBlocked = type === 'blocked';
  const minimal = world === 'zen';
  return <section id="sites-site-detail" className="sites-policy-detail" aria-labelledby="sites-policy-title" data-detail-mode="policy_only" data-presentation={minimal ? 'minimal' : 'standard'}>
    {!minimal && <SitesProtectionMark world={world} size={40} />}
    {!minimal && <div className="sites-intel-eyebrow">{sitesRecordingLabel(recording, t)}</div>}
    <h2 id="sites-policy-title">{t(isBlocked ? 'recording.policy_protected_title' : 'recording.policy_title')}</h2>
    <p>{t('recording.policy_body')}</p>
    {!minimal && <dl><div><dt>{t('recording.site_policy')}</dt><dd>{t(isBlocked ? 'registry.blocked_label' : type === 'allowed' ? 'recording.manage_allowed' : 'recording.unprotected')}</dd></div>
      <div><dt>{t('recording.time_cap')}</dt><dd>{t('recording.cap_inactive')}</dd></div></dl>}
    <p className="sites-policy-detail__note">{t('recording.cap_unavailable')}</p>
    {onSettings && <div className="sites-policy-detail__actions">
      <button type="button" onClick={onSettings}>{t('recording.settings')}</button>
    </div>}
  </section>;
}
