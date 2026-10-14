import React, { useCallback, useId, useMemo, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import './ZenArtifactSwitchBand.css';

const CONTROL_MODES = Object.freeze(['binary', 'choice', 'level', 'number', 'range']);
const ACTION_WORLD = Object.freeze({
  grayscale: 'veil', blur: 'veil', brightness: 'veil', contrast: 'veil', saturation: 'veil',
  fullscreenVisualRelaxation: 'open', socialMetrics: 'empty', timeSignals: 'empty', shortformBlock: 'empty',
  clickPause: 'bind', scrollFriction: 'bind', inputVisualBrake: 'bind', skipFriction: 'bind',
  textRhythm: 'raise', intentThreshold: 'raise', detourSpreadGuard: 'raise', tabManagement: 'gather',
  entryCheckpoint: 'ring', returnGuard: 'ring', sentinelFlare: 'wind',
  historyCleanup: 'flow', bookmarkConceal: 'veil', tabEvaporation: 'flow',
});

function resolveZenArtifactActionLabels(t, world) {
  switch (world) {
    case 'veil':
      return { enableLabel: t('artifact_appearance.actions.veil.enable'), disableLabel: t('artifact_appearance.actions.veil.disable') };
    case 'open':
      return { enableLabel: t('artifact_appearance.actions.open.enable'), disableLabel: t('artifact_appearance.actions.open.disable') };
    case 'empty':
      return { enableLabel: t('artifact_appearance.actions.empty.enable'), disableLabel: t('artifact_appearance.actions.empty.disable') };
    case 'bind':
      return { enableLabel: t('artifact_appearance.actions.bind.enable'), disableLabel: t('artifact_appearance.actions.bind.disable') };
    case 'raise':
      return { enableLabel: t('artifact_appearance.actions.raise.enable'), disableLabel: t('artifact_appearance.actions.raise.disable') };
    case 'gather':
      return { enableLabel: t('artifact_appearance.actions.gather.enable'), disableLabel: t('artifact_appearance.actions.gather.disable') };
    case 'ring':
      return { enableLabel: t('artifact_appearance.actions.ring.enable'), disableLabel: t('artifact_appearance.actions.ring.disable') };
    case 'wind':
      return { enableLabel: t('artifact_appearance.actions.wind.enable'), disableLabel: t('artifact_appearance.actions.wind.disable') };
    case 'flow':
      return { enableLabel: t('artifact_appearance.actions.flow.enable'), disableLabel: t('artifact_appearance.actions.flow.disable') };
    default:
      throw new Error(`ZEN_ARTIFACT_CONTROL_ACTION_WORLD_INVALID:${world}`);
  }
}

export function normalizeControlOption(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)
    || !['string', 'number'].includes(typeof entry.value)) {
    throw new Error('ZEN_ARTIFACT_CONTROL_OPTION_INVALID');
  }
  const label = entry.label ? String(entry.label) : String(entry.value);
  return Object.freeze({ ...entry, label, shortLabel: entry.shortLabel ? String(entry.shortLabel) : label });
}

export function resolveZenArtifactDetailOptions(row) {
  const { controlMode, options, value } = row.controlProps;
  if (!['choice', 'level'].includes(controlMode)) return Object.freeze([]);
  if (!Array.isArray(options) || options.length < 2) throw new Error('ZEN_ARTIFACT_CONTROL_OPTIONS_REQUIRED');
  const normalized = options.map(normalizeControlOption);
  if (new Set(normalized.map(option => option.value)).size !== normalized.length
    || !normalized.some(option => Object.is(option.value, value))) {
    throw new Error('ZEN_ARTIFACT_CONTROL_OPTIONS_INVALID');
  }
  return Object.freeze(normalized);
}

function assertRows(rows) {
  if (!Array.isArray(rows)) throw new Error('ZEN_ARTIFACT_CONTROL_ROWS_REQUIRED');
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row.childKey !== 'string' || !row.childKey.trim() || ids.has(row.childKey)) {
      throw new Error('ZEN_ARTIFACT_CONTROL_ID_REQUIRED_OR_DUPLICATED');
    }
    ids.add(row.childKey);
    const props = row.controlProps;
    if (typeof row.Control !== 'function' || !CONTROL_MODES.includes(props?.controlMode)
      || typeof props.enabled !== 'boolean' || typeof props.onToggle !== 'function'
      || (props.controlMode !== 'binary' && typeof props.onValueChange !== 'function')) {
      throw new Error(`ZEN_ARTIFACT_CONTROL_CONTRACT_INVALID:${row.childKey}`);
    }
    resolveZenArtifactDetailOptions(row);
    if (!Object.hasOwn(ACTION_WORLD, row.childKey)) throw new Error(`ZEN_ARTIFACT_CONTROL_ACTION_REQUIRED:${row.childKey}`);
  }
  return rows;
}

function readConfiguredControl(row) {
  const configured = row.controlProps;
  const { controlMode, min, max } = row.controlProps;
  if (['number', 'range'].includes(controlMode)
    && (!Number.isInteger(configured.value) || configured.value < min || configured.value > max)) {
    throw new Error(`ZEN_ARTIFACT_CONTROL_VALUE_INVALID:${row.childKey}`);
  }
  if (['choice', 'level'].includes(controlMode)
    && !resolveZenArtifactDetailOptions(row).some(option => Object.is(option.value, configured.value))) {
    throw new Error(`ZEN_ARTIFACT_CONTROL_VALUE_INVALID:${row.childKey}`);
  }
  return configured;
}

export function ZenArtifactControlBox({ row, rowIndex, expanded, onExpand }) {
  const { t } = useAppTranslation('tools');
  const domId = useId();
  const [commitState, setCommitState] = useState({ pending: false, error: '' });
  const reportFeedback = useCallback(next => {
    setCommitState(current => current.pending === next.pending && current.error === next.error ? current : next);
    if (next.error) onExpand(row.childKey, true);
  }, [onExpand, row.childKey]);
  const configured = readConfiguredControl(row);
  const enabled = configured.enabled;
  const mode = row.controlProps.controlMode;
  const options = resolveZenArtifactDetailOptions(row);
  const shownValue = configured.value;
  const shortValue = enabled && mode !== 'binary'
    ? mode === 'range' ? `${shownValue}%`
      : mode === 'number' ? String(shownValue)
        : options.find(option => Object.is(option.value, shownValue))?.shortLabel
    : '';
  const { enableLabel, disableLabel } = resolveZenArtifactActionLabels(t, ACTION_WORLD[row.childKey]);
  const Control = row.Control;
  return <section className="zen-artifact-row" data-artifact-control-row-index={rowIndex}
    data-artifact-control-child-key={row.childKey} data-zen-artifact-control-box="true"
    data-zen-artifact-box-state={enabled ? 'on' : 'off'} data-zen-artifact-detail-kind={mode}
    data-zen-artifact-box-pending={commitState.pending ? 'true' : 'false'} aria-busy={commitState.pending}>
    <h2 className="zen-artifact-row__heading">
      <button type="button" id={`${domId}-summary`} aria-expanded={expanded}
        aria-controls={`${domId}-detail`} className="zen-artifact-row__summary"
        onClick={() => onExpand(row.childKey)}>
        <span className="zen-artifact-row__name">{row.label}</span>
        <span className="sr-only">{t(enabled ? 'artifact_appearance.enabled' : 'artifact_appearance.disabled')}</span>
        {shortValue ? <span className="zen-artifact-row__value font-mono">{shortValue}</span> : null}
        <span className="zen-artifact-row__ink" aria-hidden="true" />
      </button>
    </h2>
    <div id={`${domId}-detail`} role="region" aria-labelledby={`${domId}-summary`} hidden={!expanded}
      className="zen-artifact-row__detail" onKeyDown={event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        onExpand(row.childKey, false);
        document.getElementById(`${domId}-summary`).focus();
      }}>
      {row.description ? <p className="zen-artifact-row__description">{row.description}</p> : null}
      <Control {...row.controlProps} presentation="disclosed" options={options}
        enableLabel={enableLabel}
        disableLabel={disableLabel}
        onFeedbackChange={reportFeedback} />
    </div>
  </section>;
}

const STATUS_TONES = Object.freeze(['muted', 'success', 'warning', 'error']);
export function ZenArtifactStatusNote({ status }) {
  const text = typeof status?.text === 'string' ? status.text.trim() : '';
  if (!text) return null;
  return <div data-zen-artifact-status-note="true"
    data-zen-artifact-status-tone={STATUS_TONES.includes(status.tone) ? status.tone : 'muted'}
    className="zen-artifact-note" role="status">
    <p className="zen-artifact-note__text">{text}</p>
    {status.detail ? <p className="zen-artifact-note__detail font-serif">{status.detail}</p> : null}
  </div>;
}

export function ZenArtifactControlGarden({ rows = [], rowGroups = null, statusBlock = null, supplementalContent = null }) {
  const groups = useMemo(() => {
    if (rowGroups !== null && (!Array.isArray(rowGroups) || rows.length)) {
      throw new Error('ZEN_ARTIFACT_CONTROL_GROUPS_INVALID');
    }
    const entries = rowGroups === null ? [{ rows }] : rowGroups;
    const disclosureIds = new Set();
    for (const entry of entries) {
      if (!entry || !Array.isArray(entry.rows)) throw new Error('ZEN_ARTIFACT_CONTROL_GROUP_ROWS_REQUIRED');
      if (entry.disclosure) {
        const { id, label, Control } = entry.disclosure;
        if (typeof id !== 'string' || !id.trim() || disclosureIds.has(id)
          || typeof label !== 'string' || !label.trim() || typeof Control !== 'function') {
          throw new Error('ZEN_ARTIFACT_CONTROL_GROUP_DISCLOSURE_INVALID');
        }
        disclosureIds.add(id);
      }
    }
    assertRows(entries.flatMap(entry => entry.rows));
    return entries;
  }, [rows, rowGroups]);
  const [openId, setOpenId] = useState(null);
  const onExpand = useCallback((controlId, force) => {
    setOpenId(current => force === true ? controlId : force === false ? null : current === controlId ? null : controlId);
  }, []);
  if (!groups.some(group => group.rows.length) && !statusBlock?.status && !supplementalContent) return null;
  let rowIndex = 0;
  return <div data-artifact-control-dock="accordion" className="zen-artifact-control-garden">
    {groups.map((group, groupIndex) => {
      const content = group.rows.map(row => <ZenArtifactControlBox key={row.childKey} row={row} rowIndex={rowIndex++}
        expanded={openId === row.childKey} onExpand={onExpand} />);
      if (!group.disclosure) return <React.Fragment key={`rows-${groupIndex}`}>{content}</React.Fragment>;
      const Disclosure = group.disclosure.Control;
      return <Disclosure key={group.disclosure.id} id={group.disclosure.id} label={group.disclosure.label}
        activeCount={group.rows.filter(row => row.controlProps.enabled).length}
        revealKey={group.rows.some(row => row.childKey === openId) ? openId : null}
        onCollapse={() => setOpenId(current => group.rows.some(row => row.childKey === current) ? null : current)}>
        {content}
      </Disclosure>;
    })}
    {statusBlock?.status ? <ZenArtifactStatusNote status={statusBlock.status} /> : null}
    {supplementalContent ? <div className="zen-artifact-row__supplemental">{supplementalContent}</div> : null}
  </div>;
}

export const ZenArtifactSwitchBand = ZenArtifactControlGarden;
