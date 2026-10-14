import React from 'react';

import {
  getDashboardTabLoadingFrameId,
  getDashboardTabLoadingTestId,
} from '../tabs/loadingPolicy.js';
import '../artifacts/artifactWorkspaceLayout.css';

function PulseLine({ className = '' }) {
  return <div className={`rounded-full bg-border/12 ${className}`} />;
}

function LoadingVariant({ variant = 'stack' }) {
  if (variant === 'artifact-workspace') {
    return (
      <div
        data-loading-frame="artifact-workspace"
        className="artifact-workspace h-full min-h-[460px] w-full overflow-hidden bg-background/55"
      >
        <div className="artifact-workspace__threshold" aria-hidden="true" />
        <div className="artifact-workspace__aperture relative min-h-0 overflow-hidden bg-background/45" />
        <aside className="artifact-workspace__control-rail min-h-0 bg-surface/72 px-8 py-7" />
      </div>
    );
  }

  if (variant === 'canvas') {
    return (
      <div className="animate-pulse space-y-6">
        <div className="space-y-3">
          <PulseLine className="h-3 w-24" />
          <PulseLine className="h-10 w-48" />
          <PulseLine className="h-3 w-40" />
        </div>
        <div className="rounded-[28px] border border-border/10 bg-surface/55 p-6">
          <div className="h-[360px] rounded-[22px] bg-border/10" />
        </div>
      </div>
    );
  }

  if (variant === 'split') {
    return (
      <div className="animate-pulse space-y-5">
        <div className="space-y-3">
          <PulseLine className="h-3 w-24" />
          <PulseLine className="h-10 w-40" />
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <div className="rounded-[22px] border border-border/10 bg-surface/55 p-5">
            <div className="space-y-3">
              <PulseLine className="h-3 w-24" />
              <PulseLine className="h-10 w-full" />
              <PulseLine className="h-10 w-full" />
              <PulseLine className="h-10 w-4/5" />
            </div>
          </div>
          <div className="rounded-[22px] border border-border/10 bg-surface/55 p-5">
            <div className="space-y-4">
              <PulseLine className="h-3 w-20" />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-24 rounded-[18px] bg-border/10" />
                <div className="h-24 rounded-[18px] bg-border/10" />
              </div>
              <div className="h-44 rounded-[20px] bg-border/10" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-pulse space-y-5">
      <div className="space-y-3">
        <PulseLine className="h-3 w-24" />
        <PulseLine className="h-10 w-40" />
      </div>
      <div className="grid gap-4">
        <div className="rounded-[22px] border border-border/10 bg-surface/55 p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="h-24 rounded-[18px] bg-border/10" />
            <div className="h-24 rounded-[18px] bg-border/10" />
            <div className="h-24 rounded-[18px] bg-border/10" />
          </div>
        </div>
        <div className="rounded-[22px] border border-border/10 bg-surface/55 p-5">
          <div className="space-y-3">
            <PulseLine className="h-3 w-20" />
            <PulseLine className="h-12 w-full" />
            <PulseLine className="h-12 w-full" />
            <PulseLine className="h-12 w-5/6" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardTabLoadingSurface({
  tabId,
  policyTabId = null,
  label,
  variant = null,
  testId = null,
  sectionClassName = '',
}) {
  const resolvedTabId = typeof tabId === 'string' && tabId ? tabId : 'dashboard-tab';
  const resolvedPolicyTabId = typeof policyTabId === 'string' && policyTabId
    ? policyTabId
    : resolvedTabId;
  const resolvedTestId = testId || getDashboardTabLoadingTestId(resolvedPolicyTabId);
  const resolvedVariant = variant || getDashboardTabLoadingFrameId(resolvedPolicyTabId);
  const isArtifactWorkspaceFrame = resolvedVariant === 'artifact-workspace';

  return (
    <section
      id={resolvedTabId}
      className={`flex h-full min-h-0 flex-col overflow-y-auto bg-transparent font-sans ${sectionClassName}`.trim()}
    >
      <div className={`mx-auto flex h-full min-h-0 w-full max-w-[1680px] flex-1 flex-col ${isArtifactWorkspaceFrame ? 'p-0' : 'px-6 py-6'}`}>
        <div
          data-testid={resolvedTestId}
          role="status"
          aria-label={label}
          className="flex h-full min-h-0 w-full flex-1 flex-col bg-transparent"
        >
          <span className="sr-only">{label}</span>
          <LoadingVariant variant={resolvedVariant} />
        </div>
      </div>
    </section>
  );
}

export function DashboardTabErrorSurface({
  tabId,
  title,
  detail,
  actions = null,
  testId = null,
  sectionClassName = '',
}) {
  const resolvedTabId = typeof tabId === 'string' && tabId ? tabId : 'dashboard-tab';
  const resolvedTestId = testId || `${resolvedTabId}-error`;
  const resolvedDetail = typeof detail === 'string' && detail.trim()
    ? detail.trim()
    : 'Failed to prepare this workspace.';

  return (
    <section
      id={resolvedTabId}
      className={`flex h-full min-h-0 flex-col overflow-y-auto bg-transparent font-sans ${sectionClassName}`.trim()}
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1680px] flex-1 flex-col px-6 py-6">
        <div
          data-testid={resolvedTestId}
          role="alert"
          className="rounded-[24px] border border-amber-400/35 bg-amber-50/85 px-6 py-5 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800/90">
            {title}
          </p>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-amber-950/88">
            {resolvedDetail}
          </p>
          {actions ? (
            <div className="mt-4">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function DashboardTabRetryAction({ label, onRetry }) {
  if (typeof onRetry !== 'function') return null;
  return (
    <button
      type="button"
      className="rounded-[8px] border border-amber-700/30 px-3 py-1.5 text-[11px] font-bold"
      onClick={onRetry}
    >
      {label}
    </button>
  );
}

export default DashboardTabLoadingSurface;
