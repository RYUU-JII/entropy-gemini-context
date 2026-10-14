import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { buildSiteIntelPresentation } from './siteIntelPresentation.js';
import SiteIntelHourlyField from './SiteIntelHourlyField.jsx';
import { buildSiteIntelHourlyContext } from './siteIntelHourlyContext.js';

function Period({ period }) {
  return <span>{period.label}</span>;
}

export default function SiteIntelReadingSurface({ intel, viewModel, projectionError, t, presentationState }) {
  if (projectionError) throw projectionError;
  if (!viewModel || typeof viewModel !== 'object') throw new Error('SITES_TARGET_PANEL_VIEW_MODEL_REQUIRED');
  const model = useMemo(() => buildSiteIntelPresentation({ profile: intel.sitePullProfile, t }), [intel.sitePullProfile, t]);
  const [selection, setSelection] = useState(() => ({ domain: intel.domain,
    page: presentationState?.page || 'summary', metricId: presentationState?.metricId || null }));
  const activeSelection = selection.domain === intel.domain ? selection : {
    domain: intel.domain, page: presentationState?.page || 'summary', metricId: presentationState?.metricId || null };
  const page = activeSelection.page;
  const primaryMetric = model.metrics[0] || null;
  // The headline owns the chart's subject. Opening an explanation cannot
  // silently switch its period or unit, including for a secondary metric.
  const context = useMemo(() => buildSiteIntelHourlyContext(intel, primaryMetric),
    [intel.temporalContext, primaryMetric]);
  const claim = model.claims.find(item => item.surfaceItemId === model.surfaceItemId);
  const id = useId();
  const tabRefs = useRef({});
  const returnFocus = useRef(null);
  const readingFocus = useRef(null);
  // A refreshed headline may withdraw a metric slot entirely. Preserve a
  // keyboard reader's place, without taking focus back from another pane.
  useLayoutEffect(() => {
    if (readingFocus.current && !readingFocus.current.isConnected && document.activeElement === document.body) {
      tabRefs.current[page]?.focus({ preventScroll: true });
    }
  }, [model, page]);
  useLayoutEffect(() => {
    if (presentationState) Object.assign(presentationState, { page, metricId: activeSelection.metricId });
  }, [page, activeSelection.metricId, presentationState]);
  useEffect(() => {
    setSelection(current => current.domain === intel.domain ? current : { domain: intel.domain,
      page: presentationState?.page || 'summary', metricId: presentationState?.metricId || null });
    returnFocus.current = null;
  }, [intel.domain, presentationState]);
  const changePage = (next, metricId = null) => setSelection({ domain: intel.domain, page: next, metricId });
  const showEvidence = (event, metricId) => {
    returnFocus.current = event.currentTarget;
    changePage('evidence', metricId);
  };
  const scope = t('intel_reading.coverage', { observed: model.observation.observedWeeklyDays, days: model.observation.windowDayCount });
  const referenceNote = model.metrics.some(item => item.period === 'personal_reference') ? t('intel_reading.personal_reference')
    : model.metrics.some(item => item.period.includes('trajectory')) ? t('intel_reading.trajectory_reference') : null;
  return <div className="site-intel__body" data-intel-state={model.state} data-intel-kind={model.kind}
    data-intel-pattern={model.patternId} data-intel-page={page}
    onFocusCapture={event => { readingFocus.current = event.target; }}
    onBlurCapture={event => {
      if (event.target.isConnected && !event.currentTarget.contains(event.relatedTarget)) readingFocus.current = null;
    }} onKeyDown={event => {
      if (event.key === 'Escape' && page === 'evidence') {
        event.preventDefault(); event.stopPropagation(); changePage('summary');
        (returnFocus.current?.isConnected ? returnFocus.current : tabRefs.current.summary)?.focus({ preventScroll: true });
      }
    }}>
    <nav className="site-intel__navigation" role="tablist" aria-label={t('intel_reading.views')}>
      {['summary', 'evidence'].map(name => <button key={name} ref={node => { tabRefs.current[name] = node; }}
        type="button" role="tab" id={id + '-' + name} aria-controls={id + '-reading'}
        aria-selected={page === name} tabIndex={page === name ? 0 : -1}
        onClick={() => { returnFocus.current = null; changePage(name); }} onKeyDown={event => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault(); const next = event.key === 'Home' ? 'summary' : event.key === 'End' ? 'evidence' : name === 'summary' ? 'evidence' : 'summary';
            returnFocus.current = null; changePage(next); tabRefs.current[next]?.focus();
          }
        }}>{t('intel_reading.view_' + name)}</button>)}
      <span className="site-intel__navigation-scope">{scope}</span>
    </nav>
    <section className="site-intel__focus">
      <div className="site-intel__reading" role="tabpanel" id={id + '-reading'} aria-labelledby={id + '-' + page}>
        <header className="site-intel__narrative">
          <div className="site-intel__scope">{model.periods.map((period, index) => <React.Fragment key={period.id}>{index > 0 && <span aria-hidden="true">·</span>}<Period period={period} /></React.Fragment>)}</div>
          <h3>{model.headline}</h3>
        </header>
        <div className="site-intel__evidence">
          {model.kind === 'state' ? <div className="site-intel__state-reading">
            <p className="site-intel__state-description">{t('intel_reading.state_' + model.state, { observed: model.observation.observedWeeklyDays, days: model.observation.windowDayCount })}</p>
          </div> : <dl className="site-intel__metrics" data-comparison={model.kind === 'comparison'}>
            {model.metrics.map((item, index) => <div key={index} className="site-intel__metric" data-metric-id={item.id}
              data-connected={page === 'evidence' && (activeSelection.metricId === item.id || (!activeSelection.metricId && index === 0))}>
              <dt className="site-intel__metric-label"><span>{item.name}</span>
                <button type="button" aria-label={t('intel_reading.inspect_metric', { label: item.name })}
                  aria-controls={id + '-explanation'} aria-pressed={page === 'evidence' && activeSelection.metricId === item.id}
                  onClick={event => showEvidence(event, item.id)}><span>{t('intel_reading.view_evidence')}</span><ChevronRight size={14} aria-hidden="true" /></button>
              </dt>
              <dd className="site-intel__metric-value"><span>{item.value}</span>{item.unit === 'count' && <span className="site-intel__metric-unit">{t('intel_reading.metric_count_unit')}</span>}</dd>
              <dd className="site-intel__metric-context">{page === 'evidence' ? item.title : item.periodLabel}{item.cohortLabel && ' · ' + item.cohortLabel}</dd>
              {model.kind === 'comparison' && <dd className="site-intel__comparison-track" aria-hidden="true">
                <span data-reference={index === 1} style={{ width: (model.ceiling === 0 ? 0 : item.numericValue / model.ceiling * 100) + '%' }} />
              </dd>}
            </div>)}
          </dl>}
          <div id={id + '-explanation'} className="site-intel__explanation" data-visible={page === 'evidence'}>
            {page === 'evidence' && <>
              {claim?.explanation && <p className="site-intel__explanation-main">{claim.explanation}</p>}
              <p>{referenceNote || claim?.limitations[0] || t('intel_reading.observation_basis')}</p>
            </>}
            {page === 'summary' && model.kind === 'comparison' && <p>{t('intel_reading.comparison_scope')}</p>}
          </div>
        </div>
      </div>
      <SiteIntelHourlyField context={context} domain={intel.domain} t={t} />
    </section>
  </div>;
}
