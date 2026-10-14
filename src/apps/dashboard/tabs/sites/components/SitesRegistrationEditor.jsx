import React, { useEffect, useId, useRef, useState } from 'react';
import { normalizePermissionDomainInput } from '@/lib/permissions.js';

// The existing registry composer lives in the selected notebook. Its only
// input is the site address; daily time stays with the canonical cap editor.
export default function SitesRegistrationEditor({ type, initialDomain = '', presentationState, onRegister, onRegistered, onCancel, disabled = false, t }) {
  const id = useId();
  const input = useRef(null);
  const [domainDraft, setDomainDraft] = useState(() => presentationState.domainDraft ?? initialDomain);
  const [pending, setPending] = useState(() => presentationState.pending || null);
  const [move, setMove] = useState(() => presentationState.move || null);
  const [error, setError] = useState(() => presentationState.error || '');
  const handlers = useRef({ onRegistered });
  handlers.current = { onRegistered };
  const domain = normalizePermissionDomainInput(domainDraft);

  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { Object.assign(presentationState, { domainDraft, move, error }); }, [domainDraft, move, error, presentationState]);
  useEffect(() => {
    if (!pending) return undefined;
    let active = true;
    void pending.then((result) => {
      if (result === true || result?.ok === true) {
        Object.assign(presentationState, { domainDraft: '', move: null, error: '' });
        if (active) handlers.current.onRegistered(domain);
      } else if (result?.kind === 'confirm_move') {
        const nextMove = { domain: result.admission.normalizedDomain, fromType: result.admission.existingType };
        const message = t(result.messageKey, result.messageParams);
        Object.assign(presentationState, { move: nextMove, error: message });
        if (active) { setMove(nextMove); setError(message); }
      } else {
        const message = result?.message || (result?.messageKey ? t(result.messageKey, result.messageParams) : t('errors.save_failed'));
        presentationState.error = message;
        if (active) setError(message);
      }
    }).catch((failure) => {
      presentationState.error = failure.message;
      if (active) setError(failure.message);
    }).finally(() => {
      if (presentationState.pending === pending) presentationState.pending = null;
      if (active) setPending(null);
    });
    return () => { active = false; };
  }, [domain, pending, presentationState, t]);

  const submit = (event) => {
    event.preventDefault();
    if (!domain || pending || disabled) return;
    setError('');
    const operation = Promise.resolve().then(() => onRegister(domain, type, { moveFromType: move?.domain === domain ? move.fromType : null, structured: true }));
    presentationState.pending = operation;
    setPending(operation);
  };
  return <form className="sites-registry-composer" onSubmit={submit} aria-busy={Boolean(pending)}
    onKeyDown={(event) => { if (event.key === 'Escape' && !pending) { event.preventDefault(); onCancel(); } }}>
    <label htmlFor={id}>{t(type === 'blocked' ? 'registry.add_protected' : 'recording.add_allowed')}</label>
    <div className="sites-registry-composer__fields">
      <input ref={input} id={id} required type="text" value={domainDraft} disabled={Boolean(pending)} autoComplete="off" spellCheck={false}
        placeholder="example.com" onChange={(event) => { setDomainDraft(event.target.value); setMove(null); setError(''); }} />
      <button type="submit" disabled={!domain || Boolean(pending) || disabled}>{t(pending ? 'sites_hud.saving' : move ? type === 'blocked' ? 'admission.move_to_blocked' : 'admission.move_to_allowed' : 'registry.add_confirm')}</button>
      <button type="button" disabled={Boolean(pending)} onClick={onCancel}>{t('common:action.cancel')}</button>
    </div>
    {move && <p>{t(type === 'blocked' ? 'registry.move_protected_effect' : 'registry.move_allowed_effect', { domain })}</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
