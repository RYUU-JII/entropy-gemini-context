import React, { useCallback, useEffect, useState } from 'react';

import DashboardActionAsyncBoundary from '@/apps/dashboard/loading/DashboardActionAsyncBoundary.jsx';
import { withDynamicImportRecovery } from '@/platform/extension/dynamicImportRecovery.js';
import { THEME_IDS } from '@/themes/core/ids.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  DASHBOARD_TAB_ASYNC_BOUNDARY_IDS,
  isDashboardTabAsyncBoundaryAllowed,
} from '../../loadingPolicy.js';

const SESSION_SUMMARY_AI_ASYNC_BOUNDARY_ID =
  DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.MAIN_SESSION_SUMMARY_AI;
const SESSION_SUMMARY_AI_IDLE_TIMEOUT_MS = 1200;
const CANONICAL_THEME_IDS = new Set(Object.values(THEME_IDS));

if (!isDashboardTabAsyncBoundaryAllowed('main', SESSION_SUMMARY_AI_ASYNC_BOUNDARY_ID)) {
  throw new Error(
    `DASHBOARD_TAB_ASYNC_BOUNDARY_UNDECLARED:main:${SESSION_SUMMARY_AI_ASYNC_BOUNDARY_ID}`,
  );
}

const loadSessionSummaryAiPanel = withDynamicImportRecovery(
  () => import('@/apps/dashboard/ai/SessionSummaryAiPanel.jsx'),
  { boundaryId: 'dashboard-main-session-summary-ai' },
);

function useIdleEnrichmentAdmission(enabled) {
  const [admitted, setAdmitted] = useState(false);

  useEffect(() => {
    if (!enabled || admitted) return undefined;

    let cancelled = false;
    let idleCallbackId = 0;
    let fallbackTimerId = 0;
    const admit = () => {
      if (!cancelled) setAdmitted(true);
    };

    if (
      typeof window !== 'undefined'
      && typeof window.requestIdleCallback === 'function'
    ) {
      idleCallbackId = window.requestIdleCallback(admit, {
        timeout: SESSION_SUMMARY_AI_IDLE_TIMEOUT_MS,
      });
    } else {
      fallbackTimerId = globalThis.setTimeout(admit, 32);
    }

    return () => {
      cancelled = true;
      if (
        idleCallbackId
        && typeof window !== 'undefined'
        && typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (fallbackTimerId) globalThis.clearTimeout(fallbackTimerId);
    };
  }, [admitted, enabled]);

  return enabled && admitted;
}

export default function SessionSummaryAiEnrichment({
  summaryDraft,
  locale,
  mainWidgetThemeId,
  isRuntimeActive,
  postFirstFrameReady,
  interactionLocked,
  presentationSignature,
  onNarration,
}) {
  const themeIsCanonical = CANONICAL_THEME_IDS.has(mainWidgetThemeId);
  const { t } = useAppTranslation('main');
  const eligible = Boolean(
    themeIsCanonical
    && summaryDraft
    && mainWidgetThemeId !== THEME_IDS.ZEN
    && isRuntimeActive === true
    && postFirstFrameReady === true
    && interactionLocked !== true
  );
  const admitted = useIdleEnrichmentAdmission(eligible);
  const handleNarration = useCallback(({ narration }) => {
    onNarration?.({ narration, signature: presentationSignature });
  }, [onNarration, presentationSignature]);

  if (!themeIsCanonical) {
    throw new Error(`MAIN_SESSION_SUMMARY_AI_THEME_INVALID:${String(mainWidgetThemeId)}`);
  }
  if (!admitted) return null;

  return (
    <DashboardActionAsyncBoundary
      boundaryId={SESSION_SUMMARY_AI_ASYNC_BOUNDARY_ID}
      loadAction={loadSessionSummaryAiPanel}
      loadingFallback={null}
      renderError={(error, { retry }) => (
        <div
          role="alert"
          className="inline-flex min-w-0 items-center gap-2 text-[10px] font-medium text-danger"
          data-main-session-summary-ai-error="true"
          title={error?.message || String(error)}
        >
          <span className="truncate">{t('main.ai_narration_error')}</span>
          <button
            type="button"
            className="shrink-0 underline underline-offset-2"
            onClick={retry}
          >
            {t('common:dashboard.main_panel.retry')}
          </button>
        </div>
      )}
      renderAction={(LazySessionSummaryAiPanel) => (
        <LazySessionSummaryAiPanel
          summaryDraft={summaryDraft}
          locale={locale}
          enabled={true}
          onNarration={handleNarration}
        />
      )}
    />
  );
}
