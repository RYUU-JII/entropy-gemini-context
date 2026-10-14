import React from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Sparkles, Waves, Wand2 } from 'lucide-react';
import { FrictionIcon } from '@/ui-kit/Icons.jsx';
import {
  getDashboardStateTransitionStyle,
  getInteractionMotionStyle,
} from '@/themes/core/motion/index.js';

import ProtectionInsightCards from '../../components/ProtectionInsightCards.jsx';

const FILTER_CONTROL_INTERACTION_STYLE = getInteractionMotionStyle('stable');
const FILTER_CONTROL_BUTTON_STYLE = getDashboardStateTransitionStyle('dashboard.control.button');

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div>
      {eyebrow ? (
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-on-surface-muted/55">{eyebrow}</div>
      ) : null}
      <h2 className="mt-1 text-[16px] font-black tracking-tight text-on-surface">{title}</h2>
      {description ? (
        <p className="mt-1 text-[11px] leading-relaxed text-on-surface-muted/78">{description}</p>
      ) : null}
    </div>
  );
}

function ScenarioButton({ label, description, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-[8px] border px-3 py-3 text-left',
        active
          ? 'border-accent/25 bg-surface text-on-surface'
          : 'border-border/35 bg-surface text-on-surface-muted hover:border-accent/20 hover:text-on-surface',
      ].join(' ')}
      style={FILTER_CONTROL_BUTTON_STYLE}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.12em]">{label}</div>
      <div className="mt-1 text-[11px] leading-relaxed">{description}</div>
    </button>
  );
}

function LaneCard({ icon: Icon, title, count, tone = 'default' }) {
  const toneClass = tone === 'active'
    ? 'border-accent/20 bg-surface text-accent'
    : 'border-border/35 bg-surface text-on-surface-muted/80';

  return (
    <div className={`rounded-[8px] border px-3 py-3 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <div className="text-[10px] font-black uppercase tracking-[0.12em]">{title}</div>
      </div>
      <div className="mt-2 text-[20px] font-black leading-none">{count}</div>
    </div>
  );
}

export default function ProtectionControlSidebar({
  status,
  coolingPreset,
  onOpenProtectionSettings,
  scenarios,
  activeScenarioId,
  onScenarioChange,
  laneCards,
  insightCards = [],
  insightLabels = null,
  advancedOpen,
  onAdvancedToggle,
  onOpenLabs,
  children,
  workflowReview = null,
  labels,
  showAdvanced = true,
}) {
  const statusToneClass = {
    alert: 'border-danger/25 bg-surface text-danger',
    warn: 'border-warning/25 bg-surface text-warning',
    active: 'border-accent/20 bg-surface text-accent',
    ok: 'border-border/35 bg-surface text-on-surface',
    muted: 'border-border/35 bg-surface-elevated/35 text-on-surface-muted/75',
  }[status.tone] || 'border-border/35 bg-surface-elevated/35 text-on-surface-muted/75';

  if (workflowReview) {
    return (
      <aside
        data-filter-control-panel-mode="workflow-review"
        className="flex min-h-0 flex-col overflow-hidden border-l border-border/35 bg-surface-elevated/20"
        style={FILTER_CONTROL_INTERACTION_STYLE}
      >
        {workflowReview}
      </aside>
    );
  }

  return (
    <aside
      data-filter-control-panel-mode="controls"
      className="flex min-h-0 flex-col border-l border-border/35 bg-surface-elevated/20"
      style={FILTER_CONTROL_INTERACTION_STYLE}
    >
      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section className="rounded-[8px] border border-border/35 bg-surface px-4 py-4">
          <SectionHeader title={labels.nowTitle} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-[10px] border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusToneClass}`}>
              {status.label}
            </span>
          </div>
          {status.detail ? (
            <div className="mt-3 text-[12px] leading-relaxed text-on-surface-muted/82">{status.detail}</div>
          ) : null}
          {status.coolingCurveNote ? <p className="mt-3 text-[11px] leading-relaxed text-on-surface-muted" role="status">{status.coolingCurveNote}</p> : null}
          {status.goalEnds?.length ? (
            <div className="mt-3 space-y-2" role="status" aria-live="polite">
              {status.goalEnds.map(entry => (
                <div key={entry.scope}>
                  <div className="text-[11px] font-bold text-on-surface">{entry.title}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-on-surface-muted/82">{entry.detail}</p>
                </div>
              ))}
            </div>
          ) : null}
          {status.host ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[8px] border border-border/30 bg-surface-elevated/35 px-3 py-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted/60">{labels.followingLabel}</div>
                <div className="mt-1 text-[12px] font-black text-on-surface">{status.host}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted/60">{labels.filterCountLabel}</div>
                <div className="mt-1 text-[16px] font-black text-on-surface">{status.activeFilterCount}</div>
              </div>
            </div>
          ) : null}
          {(status.activeArtifacts?.length || status.standbyArtifacts?.length) ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-[8px] border border-border/30 bg-surface-elevated/20 px-3 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted/60">{labels.activeArtifactsLabel}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-on-surface">{status.activeArtifacts?.length ? status.activeArtifacts.join(', ') : labels.noneLabel}</div>
              </div>
              <div className="rounded-[8px] border border-border/30 bg-surface-elevated/20 px-3 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted/60">{labels.readyArtifactsLabel}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-on-surface">{status.standbyArtifacts?.length ? status.standbyArtifacts.join(', ') : labels.noneLabel}</div>
              </div>
            </div>
          ) : null}
        </section>

        {insightCards.length > 0 ? (
          <section className="rounded-[8px] border border-border/35 bg-surface px-4 py-4">
            <SectionHeader title={insightLabels?.title} />
            <div className="mt-3">
              <ProtectionInsightCards
                cards={insightCards}
                columns={1}
                labels={insightLabels?.cardLabels || {}}
                onAction={insightLabels?.onAction || null}
              />
            </div>
          </section>
        ) : null}

        <section className="rounded-[8px] border border-border/35 bg-surface px-4 py-4">
          <SectionHeader title={labels.autoTitle} />
          <div className="mt-3 rounded-[8px] border border-border/35 px-4 py-3">
            <p className="text-[11px] font-bold text-on-surface">{coolingPreset.title}</p>
            <p className="mt-1 text-[11px] text-on-surface-muted">{coolingPreset.description}</p>
          </div>
          <svg viewBox="0 0 180 36" role="img" aria-label={labels.coolingPreview} className="mt-4 h-10 w-full text-accent">
            <path d="M2 32 H178" fill="none" stroke="currentColor" opacity="0.15" />
            <path d={({ gentle: 'M2 32 H65 C110 32 130 12 165 4 H178', standard: 'M2 32 H40 C82 32 110 9 165 4 H178', steep: 'M2 32 H22 C48 32 80 7 165 4 H178' })[coolingPreset.id]} fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <p className="text-[11px] leading-relaxed text-on-surface-muted">{labels.coolingExplanation}</p>
          {labels.coolingCustom ? <p className="mt-2 text-[11px] text-on-surface-muted">{labels.coolingCustom}</p> : null}
          {typeof onOpenProtectionSettings === 'function' ? <button type="button" onClick={onOpenProtectionSettings}
            className="mt-3 text-[11px] text-accent underline underline-offset-4">{labels.coolingPolicyLink}</button> : null}
        </section>

        <section className="rounded-[8px] border border-border/35 bg-surface px-4 py-4">
          <SectionHeader title={labels.scenarioTitle} />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {scenarios.map((scenario) => (
              <ScenarioButton
                key={scenario.id}
                label={scenario.label}
                description={scenario.description}
                active={scenario.id === activeScenarioId}
                onClick={() => onScenarioChange?.(scenario.id)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-[8px] border border-border/35 bg-surface px-4 py-4">
          <SectionHeader title={labels.artifactHubTitle} />
          <div className="mt-3 rounded-[8px] border border-dashed border-border/35 bg-surface-elevated/25 px-4 py-4">
            <p className="text-[11px] leading-relaxed text-on-surface-muted/78">
              {labels.artifactHubBody}
            </p>
            {typeof onOpenLabs === 'function' ? (
              <button
                type="button"
                onClick={() => onOpenLabs?.()}
                className="mt-4 inline-flex items-center gap-2 rounded-[8px] border border-accent/20 bg-surface px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-accent hover:border-accent/35 hover:bg-surface-elevated"
                style={FILTER_CONTROL_BUTTON_STYLE}
              >
                {labels.artifactHubAction}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="mt-4 text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted/60">
                {labels.artifactHubUnavailable}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[8px] border border-border/35 bg-surface px-4 py-4">
          <SectionHeader title={labels.lanesTitle} />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LaneCard icon={Sparkles} {...laneCards.reward} />
            <LaneCard icon={Waves} {...laneCards.pace} />
            <LaneCard icon={FrictionIcon} {...laneCards.friction} />
            <LaneCard icon={Wand2} {...laneCards.advanced} />
          </div>
        </section>

        {showAdvanced ? (
          <section className="rounded-[8px] border border-border/35 bg-surface px-4 py-4">
            <button
              type="button"
              onClick={onAdvancedToggle}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <SectionHeader title={labels.advancedTitle} />
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border/35 bg-surface-elevated/35 text-accent">
                {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {advancedOpen ? (
              <div className="mt-4 h-[520px] overflow-hidden rounded-[8px] border border-border/35 bg-surface-elevated/20">
                {children}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </aside>
  );
}
