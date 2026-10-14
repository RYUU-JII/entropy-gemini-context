import React, { useEffect, useRef } from 'react';
import { ArrowLeft, ChevronDown, MoreHorizontal } from 'lucide-react';
import { ZenReadingBlock } from '@/themes/plugins/zen/api/homeReadingSpace.js';
import { SitesRegistryFavicon } from '@/themes/core/widgets/shared/sites/index.js';

export function SitesWorkspaceHeader({ t, globalCap, mode = 'ledger', minimal = false, onBack, backLabel = null }) {
  return <header className="sites-workspace-heading">
    <div>{mode === 'notebook' ? <>
      <h1 className="sr-only">{t('workspace.ledger_title')}</h1>
      <button className="sites-notebook-heading__back" data-workspace-action="back" type="button" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />{backLabel === null ? t('workspace.back_to_ledger') : backLabel}</button>
    </> : <><h1>{t('workspace.ledger_title')}</h1>{!minimal && <p>{t('workspace.ledger_description')}</p>}</>}</div>
    <div className="sites-workspace-heading__cap">{globalCap}</div>
  </header>;
}

export function SitesNotebookHeader({ domain, title = domain, domains = [], isOpen, onSelect, onBack = null, t, minimal = false, protectionControl = null, recordingControl = null, siteCapControl = null, policyLabel = null, policyFeedback = null }) {
  const heading = useRef(null);
  useEffect(() => {
    if (isOpen) heading.current?.focus({ preventScroll: true });
  }, [domain, isOpen]);
  return <header className="sites-notebook-heading">
    <ZenReadingBlock className="sites-notebook-heading__row">
      {minimal && onBack && <button className="sites-notebook-heading__back" data-workspace-action="back" type="button" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />{t('workspace.ledger_title')}</button>}
      <div className="sites-notebook-heading__identity">{domain && <SitesRegistryFavicon domain={domain} size={minimal ? 24 : 32} />}
        <h2 ref={heading} tabIndex={-1}>{title}</h2></div>
      {!minimal && domains.length > 0 && <label className="sites-notebook-heading__switch"><span>{t('workspace.switch_site')}</span>
        <select value={domain} aria-label={t('workspace.switch_site')} onChange={(event) => onSelect(event.target.value)}>
          {domains.map((item) => <option key={item} value={item}>{item}</option>)}
        </select><ChevronDown size={13} aria-hidden="true" />
      </label>}
      {minimal && <span className="zen-record-policy">{policyLabel}</span>}
      {minimal ? <details className="zen-record-management" onKeyDown={event => {
        if (event.key === 'Escape' && !event.defaultPrevented && event.currentTarget.open) {
          event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false;
          event.currentTarget.querySelector('summary').focus();
        }
      }}><summary aria-label={t('recording.site_menu', { domain })}><MoreHorizontal size={18} /></summary>
        <div className="sites-notebook-heading__controls">{protectionControl}{recordingControl}{siteCapControl}</div>
      </details> : <div className="sites-notebook-heading__controls">{protectionControl}{recordingControl}</div>}
    </ZenReadingBlock>
    {policyFeedback}
  </header>;
}
