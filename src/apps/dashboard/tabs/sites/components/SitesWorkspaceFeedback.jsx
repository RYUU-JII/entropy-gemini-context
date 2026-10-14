import React from 'react';

// Fixture-compatible in-flow feedback. Policy review and undo actions belong
// beside the selected site's controls, never in a detached notice stack.
export function SitesWorkspaceNotices({ variant = 'standard', errorMessage = '', errorActionLabel = '',
  errorActionPending = false, onErrorAction, successMessage = '' }) {
  if (!['standard', 'paper'].includes(variant)) throw new Error('SITES_NOTICE_VARIANT_INVALID');
  if (!errorMessage && !successMessage) return null;
  return <div className="sites-inline-feedback" data-variant={variant} role={errorMessage ? 'alert' : 'status'}>
    <p>{errorMessage || successMessage}</p>
    {errorMessage && errorActionLabel && <button type="button" disabled={errorActionPending} onClick={onErrorAction}>{errorActionLabel}</button>}
  </div>;
}
