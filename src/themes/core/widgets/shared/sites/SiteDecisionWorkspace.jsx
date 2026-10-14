import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import SiteIntelBoundary from './SiteIntelBoundary.jsx';
import SiteIntelReadingSurface from './SiteIntelReadingSurface.jsx';
import SiteGoalRecommendation from './SiteGoalRecommendation.jsx';
import SiteObservedUsage from './SiteObservedUsage.jsx';
import SitesProtectionMark from './SitesProtectionMark.jsx';
import './siteIntelReading.css';

function formatDetailDiagnostic(error) {
  if (!error) return '';
  const { code, message } = error;
  if (!code || message === code || message?.startsWith(`${code}:`)) return message || '';
  return [code, message].filter(Boolean).join(': ');
}

export default function SiteDecisionWorkspace({
  intel, targetPanelViewModel, targetPanelError = null, detailStatus = 'ready', labels = {}, variant = 'standard', onRetry = null,
  scoreSetupDraft = null, onApplyScoreSetupDraft = null,
  usageEntry = null, averageWindow = null, detailError = null, layout = 'notebook', siteCapControl = null,
  readingComponent: ReadingComponent = null,
  presentationState = null, notebookNavigation = null,
}) {
  const { t } = useAppTranslation('sites');
  if (!intel?.domain) return (
    <div id="sites-site-detail-empty" data-variant={variant} role="region" aria-labelledby="sites-site-detail-empty-heading" className="sites-intel-empty">
      <div className="sites-intel-empty__card">
        {variant !== 'zen' && (
          <SitesProtectionMark world={variant} size={32} className="sites-intel-empty__icon" />
        )}
        <h2 id="sites-site-detail-empty-heading">
          {variant === 'zen' ? t('registry.empty_selection_title') : (labels.selectPrompt || t('target_protocol.select_prompt'))}
        </h2>
        <p>
          {variant === 'zen' ? t('registry.empty_selection_desc') : t('site_workspace.empty_body')}
        </p>
      </div>
    </div>
  );

  const ready = intel.isReady === true || detailStatus === 'ready';
  if (presentationState) {
    presentationState.reading ||= {};
    presentationState.usage ||= {};
  }
  const detailDiagnostic = formatDetailDiagnostic(detailError);
  const selectedUsageEntry = usageEntry?.domain === intel.domain ? usageEntry : null;
  const reading = ready ? (
    <SiteIntelBoundary domain={intel.domain} profile={intel.sitePullProfile} t={t}>
      <SiteIntelReadingSurface intel={intel} viewModel={targetPanelViewModel} projectionError={targetPanelError} t={t}
        presentationState={presentationState?.reading} />
    </SiteIntelBoundary>
  ) : (
    <div className={`site-intel__query ${detailStatus === 'error' ? 'site-intel__query--error' : ''}`} role={detailStatus === 'error' ? 'alert' : 'status'}>
      <div className="site-intel__query-card">
        {variant !== 'zen' && <SitesProtectionMark world={variant} size={32} className="site-intel__query-icon" />}
        <h3>{t(detailStatus === 'error' ? 'site_workspace.detail_unavailable_label' : 'site_workspace.detail_pending_label')}</h3>
        <p>{t(detailStatus === 'error' ? 'site_workspace.detail_unavailable_body' : 'site_workspace.detail_pending_body')}</p>
        {detailStatus === 'error' && detailDiagnostic && <code>{detailDiagnostic}</code>}
        {detailStatus === 'error' && typeof onRetry === 'function' && (
          <button type="button" className="site-intel__query-retry-btn" onClick={onRetry}>
            <RefreshCw size={13} aria-hidden="true" />
            <span>{t('common:dashboard.main_panel.retry')}</span>
          </button>
        )}
      </div>
    </div>
  );
  const observedUsage = selectedUsageEntry && (
    <SiteIntelBoundary domain={intel.domain} profile={selectedUsageEntry} t={t}>
      <SiteObservedUsage entry={selectedUsageEntry} window={averageWindow} t={t} />
    </SiteIntelBoundary>
  );
  return (
    <div id="sites-site-detail" className="site-intel" data-variant={variant} data-layout={layout} role="region" aria-labelledby="sites-site-detail-heading">
      <h2 id="sites-site-detail-heading" className="sr-only">{intel.domain}</h2>
      <div className="site-intel__content">
        {intel.captureFixtureId && <p className="site-intel__coverage" data-intel-capture-case={intel.captureFixtureId}>{t('intel_reading.fixture')}</p>}
        {ready && detailStatus === 'error' && (
          <div className="site-intel__refresh-error" role="alert">
            <span>{t('site_workspace.detail_refresh_error_short')}</span>
            {detailDiagnostic && <code>{detailDiagnostic}</code>}
            {typeof onRetry === 'function' && <button type="button" className="site-intel__query-retry-btn" onClick={onRetry}>{t('common:dashboard.main_panel.retry')}</button>}
          </div>
        )}
        {ReadingComponent ? <ReadingComponent intel={intel} ready={ready} t={t}
          notebookNavigation={notebookNavigation}
          presentationState={presentationState?.usage}
          usageEntry={selectedUsageEntry} averageWindow={averageWindow}
          siteCapControl={siteCapControl} reading={reading} observedUsage={observedUsage} /> : <>{reading}{observedUsage}</>}
        {scoreSetupDraft && (
          <SiteGoalRecommendation
            domain={intel.domain}
            draft={scoreSetupDraft}
            onApply={onApplyScoreSetupDraft}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
