import React, { useEffect, useRef, useState } from 'react';

export default function SiteGoalRecommendation({ domain, draft, onApply, t }) {
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    sequence.current += 1; setConfirming(false); setSaving(false); setError('');
    return () => { sequence.current += 1; };
  }, [domain, draft?.suggestedMinutes, draft?.status]);
  if (draft?.status !== 'ready' || !(draft.suggestedMinutes > 0)) return null;
  const apply = async () => {
    if (saving) return;
    const revision = ++sequence.current;
    setSaving(true); setError('');
    try {
      if (typeof onApply !== 'function') throw new Error('SITES_SCORE_SETUP_APPLY_HANDLER_MISSING');
      const applied = await onApply(draft);
      if (revision !== sequence.current) return;
      if (applied !== true) throw new Error('SITES_SCORE_SETUP_APPLY_FAILED');
      setConfirming(false);
    } catch {
      if (revision === sequence.current) setError(t('site_workspace.goal_save_error'));
    } finally {
      if (revision === sequence.current) setSaving(false);
    }
  };
  return <div className="sites-intel-recommendation">
    {confirming ? <div data-testid="score-setup-recommendation-confirmation" role="group"
      aria-label={t('site_workspace.goal_recommendation_confirm_title', { domain, value: draft.suggestedMinutes })}>
      <p>{t('site_workspace.goal_recommendation_confirm_title', { domain, value: draft.suggestedMinutes })}</p>
      <p>{t('site_workspace.goal_recommendation_confirm_description', { domain, value: draft.suggestedMinutes })}</p>
      <div className="sites-intel-action-row">
        <button type="button" disabled={saving} onClick={() => void apply()}>{t('site_workspace.goal_recommendation_confirm_action', { value: draft.suggestedMinutes })}</button>
        <button type="button" disabled={saving} onClick={() => { setConfirming(false); setError(''); }}>{t('site_workspace.goal_recommendation_confirm_cancel')}</button>
      </div>
    </div> : <button type="button" onClick={() => setConfirming(true)}>
      {t('site_workspace.goal_recommendation', { value: draft.suggestedMinutes })}
    </button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
