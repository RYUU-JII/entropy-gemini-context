import React from 'react';
import SitesWorkspace from './SitesWorkspace.jsx';
import { SitesWorkspaceHeader } from './SitesWorkspaceHeader.jsx';

export default function SitesTabLoadingShell({ workspaceVariant, t }) {
  return <section id="sites-tab" className="flex h-full min-h-0 flex-col overflow-y-auto bg-transparent font-sans">
    <SitesWorkspace variant={workspaceVariant} toolbar={<SitesWorkspaceHeader t={t} globalCap={
      <div data-testid="sites-tab-loading" role="status" aria-label={t('common:status.loading')} className="sites-cap-loading animate-pulse">
        <span className="sr-only">{t('common:status.loading')}</span><div className="h-3 w-24 bg-border/14" /><div className="h-5 w-20 bg-border/18" />
      </div>} />}
      registryPane={<div className="sites-ledger-loading animate-pulse" aria-hidden="true">
        <div className="h-10 w-64 max-w-full bg-border/10" />
        {[0, 1, 2, 3].map((item) => <div key={item} className="sites-ledger-loading__row"><div className="h-8 w-8 bg-border/12" /><div className="h-3 w-32 bg-border/12" /><div className="ml-auto h-3 w-20 bg-border/12" /></div>)}
      </div>} />
  </section>;
}
