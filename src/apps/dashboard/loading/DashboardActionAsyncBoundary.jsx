import React, { Suspense, useCallback, useMemo, useState } from 'react';

class DashboardActionAsyncErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return this.props.renderError(this.state.error);
    }
    return this.props.children;
  }
}

function DashboardActionLazyOutlet({ LazyAction, renderAction }) {
  return renderAction(LazyAction);
}

export default function DashboardActionAsyncBoundary({
  boundaryId,
  children,
  loadAction = null,
  loadingFallback,
  renderAction = null,
  renderError,
}) {
  if (typeof boundaryId !== 'string' || !boundaryId.trim()) {
    throw new Error('DASHBOARD_ACTION_ASYNC_BOUNDARY_ID_REQUIRED');
  }
  if (typeof renderError !== 'function') {
    throw new Error(`DASHBOARD_ACTION_ASYNC_ERROR_RENDERER_REQUIRED:${boundaryId}`);
  }
  const ownsLazyAction = loadAction !== null || renderAction !== null;
  if (ownsLazyAction && typeof loadAction !== 'function') {
    throw new Error(`DASHBOARD_ACTION_ASYNC_LOADER_REQUIRED:${boundaryId}`);
  }
  if (ownsLazyAction && typeof renderAction !== 'function') {
    throw new Error(`DASHBOARD_ACTION_ASYNC_RENDERER_REQUIRED:${boundaryId}`);
  }

  const [retryAttempt, setRetryAttempt] = useState(0);
  const retry = useCallback(() => {
    if (!ownsLazyAction) return;
    setRetryAttempt((attempt) => attempt + 1);
  }, [ownsLazyAction]);
  // This owner commits outside Suspense. An initial suspended action render
  // cannot discard its lazy identity and restart the same import on retry.
  const LazyAction = useMemo(
    () => ownsLazyAction ? React.lazy(loadAction) : null,
    [ownsLazyAction, loadAction, retryAttempt],
  );
  const actionContent = ownsLazyAction ? (
    <DashboardActionLazyOutlet
      LazyAction={LazyAction}
      renderAction={renderAction}
    />
  ) : children;

  return (
    <div
      data-dashboard-async-boundary={boundaryId}
      data-dashboard-async-attempt={retryAttempt}
    >
      <DashboardActionAsyncErrorBoundary
        key={`${boundaryId}:${retryAttempt}`}
        renderError={(error) => renderError(error, {
          retry: ownsLazyAction ? retry : null,
          retryAttempt,
        })}
      >
        <Suspense fallback={loadingFallback}>
          {actionContent}
        </Suspense>
      </DashboardActionAsyncErrorBoundary>
    </div>
  );
}
