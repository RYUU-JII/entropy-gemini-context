import React, { useMemo } from 'react';
import { GitBranch, Sigma } from 'lucide-react';

import {
  ARTIFACT_DISCLOSURE_LABEL_KEYS,
  buildArtifactDisclosureExperimentModel,
} from './artifactDisclosureExperimentModel.js';

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0.000';
  return numeric.toFixed(3);
}

function formatArtifactLabel(t, artifactId) {
  const labelKey = ARTIFACT_DISCLOSURE_LABEL_KEYS[artifactId] || artifactId;
  return t(labelKey);
}

function StatusPill({ children, tone = 'muted' }) {
  const toneClass = tone === 'accent'
    ? 'border-accent/25 bg-accent/10 text-accent'
    : 'border-on-surface/10 bg-surface-sunken/50 text-on-surface-muted';
  return (
    <span className={`inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-black uppercase tracking-[0.08em] ${toneClass}`}>
      {children}
    </span>
  );
}

function ContributionRow({ contribution }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(7rem,1fr)_auto] items-center gap-2 rounded-[8px] border border-on-surface/10 bg-surface-sunken/35 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate font-mono text-[11px] text-on-surface">
          {contribution.signalKey}
        </div>
        <div className="mt-0.5 text-[10px] text-on-surface-muted">
          {formatScore(contribution.value)} x {formatScore(contribution.weight)}
        </div>
      </div>
      <div className="text-right font-mono text-xs font-bold text-on-surface">
        {formatScore(contribution.contribution)}
      </div>
    </div>
  );
}

function SupportScoreCard({ row, t }) {
  return (
    <div className="min-w-0 rounded-[8px] border border-on-surface/10 bg-surface/85 p-3 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-on-surface">
            {t(row.labelKey)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-on-surface-muted">
            {row.artifactId} / #{row.orderPosition || '-'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-black uppercase tracking-[0.08em] text-on-surface-muted">
            {t('experiment.artifact_disclosure.score')}
          </div>
          <div className="font-mono text-sm font-bold text-on-surface">
            {formatScore(row.score)}
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {row.contributions.map((contribution) => (
          <ContributionRow key={contribution.signalKey} contribution={contribution} />
        ))}
      </div>
    </div>
  );
}

export default function ArtifactDisclosureExperimentPanel({
  t,
  filterSettings,
  gateConfig,
  nudgeConfig,
  historyCleanupForBlocked,
  concealBlockedBookmarks,
}) {
  const model = useMemo(() => buildArtifactDisclosureExperimentModel({
    filterSettings,
    gateConfig,
    nudgeConfig,
    historyCleanupForBlocked,
    concealBlockedBookmarks,
  }), [
    concealBlockedBookmarks,
    filterSettings,
    gateConfig,
    historyCleanupForBlocked,
    nudgeConfig,
  ]);

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto px-1 pb-1">
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <section className="min-w-0 rounded-[8px] border border-on-surface/10 bg-surface/85 p-4 shadow-sm">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-surface-sunken text-on-surface-muted">
              <GitBranch className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted">
                {t('experiment.artifact_disclosure.eyebrow')}
              </div>
              <h4 className="mt-1 text-sm font-bold text-on-surface">
                {t('experiment.artifact_disclosure.title')}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-muted">
                {t('experiment.artifact_disclosure.desc')}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[8px] border border-on-surface/10 bg-surface-sunken/35 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-[0.08em] text-on-surface-muted">
              {t('experiment.artifact_disclosure.source_label')}
            </div>
            <div className="mt-1 font-mono text-[11px] text-on-surface">
              {model.source}
            </div>
          </div>

          <ol className="mt-4 grid gap-2">
            {model.entries.map((entry) => (
              <li
                key={entry.artifactId}
                className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-on-surface/10 bg-surface-sunken/35 px-3 py-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-surface text-xs font-black text-on-surface">
                  {entry.position}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-on-surface">
                    {formatArtifactLabel(t, entry.artifactId)}
                  </div>
                  <div className="mt-1 flex min-w-0 flex-wrap gap-1">
                    <StatusPill>{entry.groupId}</StatusPill>
                    {entry.fixedFirst && <StatusPill tone="accent">{t('experiment.artifact_disclosure.fixed_first')}</StatusPill>}
                    {entry.fixedFinal && <StatusPill tone="accent">{t('experiment.artifact_disclosure.fixed_final')}</StatusPill>}
                    {entry.barrierEvidence && <StatusPill tone="accent">{t('experiment.artifact_disclosure.barrier_evidence')}</StatusPill>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="min-w-0 rounded-[8px] border border-on-surface/10 bg-surface/85 p-4 shadow-sm">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-surface-sunken text-on-surface-muted">
              <Sigma className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted">
                {t('experiment.artifact_disclosure.middle_eyebrow')}
              </div>
              <h4 className="mt-1 text-sm font-bold text-on-surface">
                {t('experiment.artifact_disclosure.middle_title')}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-muted">
                {t('experiment.artifact_disclosure.middle_desc')}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {model.support.rows.map((row) => (
              <SupportScoreCard key={row.artifactId} row={row} t={t} />
            ))}
          </div>
        </section>
      </div>

      <section className="mt-3 min-w-0 rounded-[8px] border border-on-surface/10 bg-surface/85 p-4 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-muted">
              {t('experiment.artifact_disclosure.causality_eyebrow')}
            </div>
            <h4 className="mt-1 text-sm font-bold text-on-surface">
              {t('experiment.artifact_disclosure.causality_title', {
                artifact: t(model.causality.labelKey),
              })}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-on-surface-muted">
              {t('experiment.artifact_disclosure.causality_desc')}
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-2 text-right">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.08em] text-on-surface-muted">
                {t('experiment.artifact_disclosure.base_priority')}
              </div>
              <div className="font-mono text-sm font-bold text-on-surface">
                {formatScore(model.causality.basePriority)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.08em] text-on-surface-muted">
                {t('experiment.artifact_disclosure.score')}
              </div>
              <div className="font-mono text-sm font-bold text-on-surface">
                {formatScore(model.causality.score)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.08em] text-on-surface-muted">
                {t('experiment.artifact_disclosure.evidence_band')}
              </div>
              <div className="font-mono text-sm font-bold text-on-surface">
                {model.causality.bandId || '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {model.causality.contributions.map((contribution) => (
            <ContributionRow key={contribution.signalKey} contribution={contribution} />
          ))}
        </div>
      </section>
    </div>
  );
}
