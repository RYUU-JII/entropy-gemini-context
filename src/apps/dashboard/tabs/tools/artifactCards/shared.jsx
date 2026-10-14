import React from 'react';
import { ArtifactControlRowInput } from '../components/ArtifactControlRowInput.jsx';
import ArtifactControlGroupDisclosure from '../components/ArtifactControlGroupDisclosure.jsx';
import CoolingCurveFamilyControl from '../components/CoolingCurveFamilyControl.jsx';
import { COOLING_CURVE_FAMILY_IDS } from '../../../../../domains/settings/config/coolingCurvePolicy.js';

import { getArtifactColorTokens } from '../../../../../themes/core/tools/artifactColorSystem.js';
import ArtifactInfoButton from '../components/ArtifactInfoButton.jsx';
import ArtifactToggleRow from '../components/ArtifactToggleRow.jsx';
import {
  resolveArtifactFamilyConfiguredEnabled as resolveActivationFamilyConfiguredEnabled,
  resolveConfiguredArtifactChildEnabled as resolveActivationChildConfiguredEnabled,
} from '../artifactActivationState.js';

const ARTIFACT_MASTER_CONTROL_VISIBLE = false;
const ARTIFACT_DOCK_BLOCK_KINDS = Object.freeze(['rows', 'actions', 'info', 'status', 'cooling-curve-mode']);

export function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function nearlyEqual(left, right, tolerance = 0.0001) {
  return Math.abs((Number(left) || 0) - (Number(right) || 0)) <= tolerance;
}

export function resolveArtifactControlAccentColor(themeId = '', artifactId = '') {
  return getArtifactColorTokens(themeId, artifactId).controls.accent;
}

export function resolveTranslationText(t, key, fallback = '') {
  const value = typeof t === 'function' ? t(key) : key;
  if (typeof value === 'string' && value !== key) {
    return value;
  }
  return fallback || '';
}

export function getArtifactFamilyState(state = {}, familyId) {
  return state.artifactFamilies?.[familyId] || {};
}

export function getArtifactFamilyChildren(state = {}, familyId) {
  return getArtifactFamilyState(state, familyId).children || {};
}

export function getArtifactFamilyHandlers(handlers = {}, familyId) {
  return handlers.artifactFamilies?.[familyId] || {};
}

export function getArtifactFamilyHandlerChildren(handlers = {}, familyId) {
  return getArtifactFamilyHandlers(handlers, familyId).children || {};
}

export function requireArtifactFamilyHandler(familyHandlers = {}, familyId, handlerName) {
  const handler = familyHandlers?.[handlerName];
  if (typeof handler !== 'function') {
    throw new Error(`[toolsArtifactCard] Missing handler "${familyId}.${handlerName}".`);
  }
  return handler;
}

export function requireArtifactChildHandler(childHandlers = {}, familyId, childId, handlerName) {
  const handler = childHandlers?.[childId]?.[handlerName];
  if (typeof handler !== 'function') {
    throw new Error(`[toolsArtifactCard] Missing handler "${familyId}.${childId}.${handlerName}".`);
  }
  return handler;
}

export function getArtifactActivationState(state = {}, familyId) {
  const currentActivation = state.artifactActivationState;
  if (currentActivation?.artifactId === familyId) {
    return currentActivation;
  }
  const activationStates = state.artifactActivationStates;
  if (activationStates && typeof activationStates === 'object') {
    return activationStates[familyId] || null;
  }
  return null;
}

export function getArtifactChildActivationState(state = {}, familyId, childId) {
  const childStates = getArtifactActivationState(state, familyId)?.children;
  if (!childStates || typeof childStates !== 'object') return null;
  return childStates[childId] || null;
}

export function isArtifactFamilyConfiguredEnabled(state = {}, familyId) {
  const activationState = getArtifactActivationState(state, familyId);
  if (activationState) {
    return activationState.configuredEnabled === true;
  }
  return resolveActivationFamilyConfiguredEnabled(getArtifactFamilyState(state, familyId));
}

export function resolveArtifactChildTitle(t, artifactId, childKey, fallback = '') {
  return resolveTranslationText(
    t,
    `artifacts.${artifactId}.children.${childKey}.title`,
    fallback || childKey,
  );
}

export function resolveArtifactChildDescription(t, artifactId, childKey, fallback = '') {
  return resolveTranslationText(
    t,
    `artifacts.${artifactId}.children.${childKey}.desc`,
    fallback,
  );
}

export function resolveConfiguredArtifactChildEnabled(childState = {}) {
  return resolveActivationChildConfiguredEnabled(childState);
}

export function resolveArtifactChildConfiguredEnabled(state = {}, familyId, childId) {
  const activationState = getArtifactChildActivationState(state, familyId, childId);
  if (activationState) {
    return activationState.configuredEnabled === true;
  }
  return resolveConfiguredArtifactChildEnabled(getArtifactFamilyChildren(state, familyId)[childId]);
}

export function resolveStatusPanelClasses(tone = 'muted') {
  if (tone === 'success') return 'border-success/25 bg-success/8 text-success';
  if (tone === 'error') return 'border-danger/25 bg-danger/8 text-danger';
  if (tone === 'warning') return 'border-warning/25 bg-warning/8 text-warning';
  return 'border-border/25 bg-surface-elevated/20 text-on-surface-muted';
}

export function buildArtifactDockModel({
  content = null,
  frontContent = null,
  backContent = null,
  blocks = null,
} = {}) {
  const resolvedBlocks = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  const resolvedContent = content
    || (frontContent || backContent ? (
      <div className="space-y-1">
        {frontContent}
        {backContent}
      </div>
    ) : null);

  if (!resolvedContent && !resolvedBlocks.length) {
    return null;
  }

  return Object.freeze({
    blocks: Object.freeze(resolvedBlocks),
    content: resolvedContent || null,
  });
}

export function buildArtifactControlSurface({
  dock = null,
  master = null,
} = {}) {
  // Keep the panel surface canonical: current UI renders a dock body and,
  // when visible, a single master control affordance.
  if (!dock && !master) {
    return null;
  }

  return Object.freeze({
    dock: dock || null,
    master: master || null,
  });
}

export function buildArtifactWorkflowReviewModel({
  key = '',
  content = null,
} = {}) {
  const normalizedKey = typeof key === 'string' ? key.trim() : '';
  if (!normalizedKey) {
    throw new Error('[toolsArtifactWorkflowReview] Review key is required.');
  }
  if (!React.isValidElement(content)) {
    throw new Error(`[toolsArtifactWorkflowReview] Review "${normalizedKey}" requires rendered content.`);
  }
  return Object.freeze({
    key: normalizedKey,
    content,
  });
}

export function buildArtifactMasterControl({
  t,
  familyState = {},
  familyHandlers = null,
  shell = null,
  accentColor = '#7dd3fc',
} = {}) {
  const configuredEnabled = resolveActivationFamilyConfiguredEnabled(familyState);
  const isGloballyPaused = familyState?.globallyPaused === true;
  const isSuspended = familyState?.suspended === true;
  const actionKind = !configuredEnabled
    ? 'apply_recommendation'
    : (isSuspended ? 'resume' : 'pause');
  const actionLabelByKind = {
    apply_recommendation: resolveTranslationText(
      t,
      'artifact_altar.apply_recommendation',
      'Apply recommended settings',
    ),
    pause: resolveTranslationText(t, 'artifact_altar.pause', 'Pause'),
    resume: resolveTranslationText(t, 'artifact_altar.resume', 'Resume'),
  };
  const action = actionKind === 'apply_recommendation'
    ? familyHandlers?.applyRecommendation
    : (typeof familyHandlers?.setSuspended === 'function'
      ? () => familyHandlers.setSuspended(actionKind === 'pause')
      : null);
  const toggleStateLabel = actionLabelByKind[actionKind];
  const stateLabel = isGloballyPaused
    ? resolveTranslationText(t, 'artifact_altar.system_pause', 'System Pause')
    : (isSuspended
      ? resolveTranslationText(t, 'artifact_altar.temporary_pause', 'Temporary Pause')
      : (configuredEnabled
        ? resolveTranslationText(t, 'artifact_altar.master_toggle_enabled', 'Configured')
        : resolveTranslationText(t, 'artifact_altar.master_toggle_disabled', 'Not configured')));
  const stateTone = isGloballyPaused || isSuspended
    ? 'warning'
    : (configuredEnabled ? 'success' : 'muted');
  const runtimeLabel = typeof shell?.runtimeStateLabel === 'string' ? shell.runtimeStateLabel : '';

  return Object.freeze({
    visible: ARTIFACT_MASTER_CONTROL_VISIBLE,
    label: toggleStateLabel,
    description: resolveTranslationText(
      t,
      actionKind === 'apply_recommendation'
        ? 'artifact_altar.apply_recommendation_desc'
        : 'artifact_altar.pause_resume_desc',
      actionKind === 'apply_recommendation'
        ? 'Apply a conservative starting configuration once.'
        : 'Pause or resume this artifact without changing its configured children.',
    ),
    actionKind,
    enabled: configuredEnabled && !isSuspended && !isGloballyPaused,
    onAction: typeof action === 'function' ? action : null,
    disabled: isGloballyPaused || typeof action !== 'function',
    accentColor,
    toggleStateLabel,
    stateLabel,
    stateTone,
    runtimeLabel: runtimeLabel && runtimeLabel !== stateLabel ? runtimeLabel : '',
    runtimeToneClass: typeof shell?.runtimeToneClass === 'string' ? shell.runtimeToneClass : '',
  });
}

export function buildArtifactSegmentRow({
  label = '',
  description = '',
  control = null,
  controlRowIndex = null,
  controlChildKey = '',
  className = 'last:border-b-0',
  labelClassName = 'text-on-surface',
  descriptionClassName = 'text-on-surface-muted',
}) {
  return (
    <ArtifactToggleRow
      label={label}
      description={description}
      infoTitle={label}
      infoBody={description}
      controlRowIndex={controlRowIndex}
      controlChildKey={controlChildKey}
      className={className}
      labelClassName={labelClassName}
      descriptionClassName={descriptionClassName}
      showToggle={false}
      control={control}
    />
  );
}

export function buildArtifactControlRowModel({
  childKey = '',
  label = '',
  description = '',
  controlProps = {},
  className = 'last:border-b-0',
  labelClassName = 'text-on-surface',
  descriptionClassName = 'text-on-surface-muted',
}) {
  return Object.freeze({
    kind: 'control-row',
    Control: ArtifactControlRowInput,
    childKey: childKey || controlProps?.childKey || '',
    label,
    description,
    controlProps: Object.freeze({
      ...controlProps,
      childKey: childKey || controlProps?.childKey || '',
      label,
    }),
    className,
    labelClassName,
    descriptionClassName,
  });
}

export function buildArtifactBinaryControlRowModel({
  t,
  childKey = '',
  label = '',
  description = '',
  enabled = false,
  onToggle = null,
  accentColor = '#7dd3fc',
  feedback = '',
  feedbackState = '',
  feedbackContent = null,
  className = 'last:border-b-0',
  labelClassName = 'text-on-surface',
  descriptionClassName = 'text-on-surface-muted',
}) {
  const offLabel = resolveTranslationText(t, 'artifact_altar.off', 'Off');
  const onLabel = resolveTranslationText(t, 'artifact_altar.on', 'On');

  return buildArtifactControlRowModel({
    childKey,
    label,
    description,
    className,
    labelClassName,
    descriptionClassName,
    controlProps: {
      childKey,
      controlMode: 'binary',
      enabled: enabled === true,
      options: [
        { value: 0, label: offLabel },
        { value: 1, label: onLabel },
      ],
      accentColor,
      feedback,
      feedbackState,
      feedbackContent,
      onToggle,
    },
  });
}

export function buildArtifactChoiceControlRowModel({
  t,
  childKey = '',
  label = '',
  description = '',
  enabled = false,
  value,
  options = [],
  onToggle = null,
  onValueChange = null,
  accentColor = '#7dd3fc',
  className = 'last:border-b-0',
  labelClassName = 'text-on-surface',
  descriptionClassName = 'text-on-surface-muted',
}) {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error('ARTIFACT_CHOICE_OPTIONS_REQUIRED');
  }
  const resolvedOptions = Object.freeze(options.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('ARTIFACT_CHOICE_OPTION_INVALID');
    }
    if (typeof entry.value !== 'string' && typeof entry.value !== 'number') {
      throw new Error('ARTIFACT_CHOICE_OPTION_VALUE_REQUIRED');
    }
    return Object.freeze({
      ...entry,
      label: String(entry.label || entry.value),
      feedback: typeof entry.feedback === 'string' ? entry.feedback : '',
    });
  }));

  return buildArtifactControlRowModel({
    childKey,
    label,
    description,
    className,
    labelClassName,
    descriptionClassName,
    controlProps: {
      childKey,
      controlMode: 'choice',
      enabled: enabled === true,
      value,
      options: resolvedOptions,
      offLabel: resolveTranslationText(t, 'artifact_altar.off', 'Off'),
      onLabel: resolveTranslationText(t, 'artifact_altar.on', 'On'),
      accentColor,
      onToggle,
      onValueChange,
    },
  });
}

export function buildArtifactNumberControlRowModel({ t, childKey, label, description, enabled, value, min, max, onToggle, onValueChange, feedback = '' }) {
  if (![value, min, max].every(Number.isInteger) || min > max || value < min || value > max) {
    throw new Error('ARTIFACT_NUMBER_RANGE_INVALID');
  }
  const controlProps = {
    controlMode: 'number', enabled, value, min, max, onToggle, onValueChange, feedback,
    offLabel: t('artifact_altar.off'), onLabel: t('artifact_altar.on'),
  };
  return buildArtifactControlRowModel({ childKey, label, description, controlProps });
}

export function buildArtifactRangeControlRowModel(props) {
  const { t, childKey, label, description, enabled, value, featureKey, accentColor, onToggle, onValueChange } = props;
  const controlProps = { controlMode: 'range', label, enabled, value, min: 0, max: 100, featureKey, accentColor, onToggle, onValueChange, offLabel: t('artifact_altar.off'), onLabel: t('artifact_altar.on') };
  return buildArtifactControlRowModel({ childKey, label, description, controlProps });
}

function renderArtifactControlRowModel(model, rowIndex) {
  if (!model || model.kind !== 'control-row') {
    return null;
  }

  return buildArtifactSegmentRow({
    label: model.label,
    description: model.description,
    controlRowIndex: rowIndex,
    controlChildKey: model.childKey,
    className: model.className,
    labelClassName: model.labelClassName,
    descriptionClassName: model.descriptionClassName,
    control: <model.Control {...model.controlProps} />,
  });
}

export function buildArtifactRowsBlockModel({
  rows = [],
  className = 'space-y-0',
  disclosure = null,
} = {}) {
  const resolvedRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!resolvedRows.length) {
    return null;
  }

  return Object.freeze({
    kind: 'rows',
    rows: Object.freeze(resolvedRows),
    className,
    ...(disclosure ? { disclosure: Object.freeze({ ...disclosure, Control: ArtifactControlGroupDisclosure }) } : {}),
  });
}

export function buildArtifactActionButtonModel({
  label = '',
  onClick = null,
  tone = 'accent',
  className = '',
}) {
  return Object.freeze({
    label,
    onClick,
    tone,
    className,
  });
}

export function buildArtifactActionButtonsBlockModel({
  actions = [],
  className = 'flex items-center gap-2 pt-3',
} = {}) {
  const resolvedActions = Array.isArray(actions) ? actions.filter(Boolean) : [];
  if (!resolvedActions.length) {
    return null;
  }

  return Object.freeze({
    kind: 'actions',
    actions: Object.freeze(resolvedActions),
    className,
  });
}

export function buildArtifactStatusBlockModel({
  status = null,
  className = '',
} = {}) {
  if (!status?.text) {
    return null;
  }

  return Object.freeze({
    kind: 'status',
    status: Object.freeze({
      tone: status.tone || 'muted',
      text: status.text,
      detail: status.detail || '',
    }),
    className,
  });
}

function resolveArtifactActionButtonToneClass(tone = 'accent') {
  if (tone === 'danger') {
    return 'border-danger/30 text-danger hover:border-danger/45 hover:bg-danger/5';
  }
  return 'border-accent/25 text-accent hover:border-accent/35 hover:bg-surface-elevated';
}

function renderArtifactDockBlock(block, index) {
  if (!block || typeof block !== 'object') {
    return null;
  }

  if (block.kind === 'cooling-curve-mode') return <CoolingCurveFamilyControl key={`cooling-${block.familyId}`} familyId={block.familyId} />;

  if (block.kind === 'rows') {
    const content = (
      <div key={`artifact-dock-block-${index}`} className={block.className || 'space-y-0'}>
        {block.rows.map((row, rowIndex) => (
          <React.Fragment key={`artifact-control-row-${index}-${row.label || rowIndex}`}>
            {renderArtifactControlRowModel(row, rowIndex)}
          </React.Fragment>
        ))}
      </div>
    );
    if (!block.disclosure) return content;
    const Disclosure = block.disclosure.Control;
    return <Disclosure key={`artifact-dock-group-${block.disclosure.id}`} id={block.disclosure.id}
      label={block.disclosure.label} activeCount={block.rows.filter(row => row.controlProps.enabled).length}>
      {content}
    </Disclosure>;
  }

  if (block.kind === 'actions') {
    return (
      <div key={`artifact-dock-block-${index}`} className={block.className || 'flex items-center gap-2 pt-3'}>
        {block.actions.map((action, actionIndex) => (
          <button
            key={`artifact-action-${index}-${action.label || actionIndex}`}
            type="button"
            onClick={action.onClick}
            className={[
              'rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors',
              resolveArtifactActionButtonToneClass(action.tone),
              action.className || '',
            ].join(' ')}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  }

  if (block.kind === 'info') {
    return (
      <div key={`artifact-dock-block-${index}`} className={block.className || 'pt-2'}>
        <ArtifactInfoButton title={block.title} body={block.body} />
      </div>
    );
  }

  if (block.kind === 'status') {
    const status = block.status || {};
    return (
      <div
        key={`artifact-dock-block-${index}`}
        className={[
          'rounded-[8px] border px-3 py-2.5',
          resolveStatusPanelClasses(status.tone),
          block.className || '',
        ].join(' ')}
      >
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
          {status.text}
        </p>
        {status.detail ? (
          <div className="ui-text mt-1 text-[11px] leading-relaxed text-on-surface-subtle">
            {status.detail}
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertArtifactDockControlRow(row, path) {
  if (!isPlainObject(row) || row.kind !== 'control-row') {
    throw new Error(`[toolsArtifactControlSurface] Dock row at ${path} must be a control-row model.`);
  }
  if (!isPlainObject(row.controlProps)) {
    throw new Error(`[toolsArtifactControlSurface] Dock control row at ${path} is missing control props.`);
  }
  const { controlMode } = row.controlProps;
  if (!['binary', 'choice', 'level', 'number', 'range'].includes(controlMode)) {
    throw new Error(`[toolsArtifactControlSurface] Dock control row at ${path} has an unsupported control mode.`);
  }
  if (typeof row.controlProps.enabled !== 'boolean') {
    throw new Error(`[toolsArtifactControlSurface] Dock control row at ${path} is missing enabled state.`);
  }
  if (typeof row.controlProps.onToggle !== 'function') {
    throw new Error(`[toolsArtifactControlSurface] Dock control row at ${path} is missing onToggle handler.`);
  }
  if (controlMode !== 'binary' && typeof row.controlProps.onValueChange !== 'function') {
    throw new Error(`[toolsArtifactControlSurface] Dock control row at ${path} is missing onValueChange handler.`);
  }
  if (row.Control !== ArtifactControlRowInput) {
    throw new Error(`[toolsArtifactControlSurface] Dock control row at ${path} must declare its input owner.`);
  }
  if (['number', 'range'].includes(controlMode) && (![row.controlProps.value, row.controlProps.min, row.controlProps.max].every(Number.isInteger)
    || row.controlProps.min > row.controlProps.max
    || row.controlProps.value < row.controlProps.min || row.controlProps.value > row.controlProps.max)) {
    throw new Error(`[toolsArtifactControlSurface] Dock numeric row at ${path} requires its owned control and valid bounds.`);
  }
}

function assertArtifactDockBlock(block, path) {
  if (!isPlainObject(block)) {
    throw new Error(`[toolsArtifactControlSurface] Dock block at ${path} must be an object.`);
  }
  if (!ARTIFACT_DOCK_BLOCK_KINDS.includes(block.kind)) {
    throw new Error(`[toolsArtifactControlSurface] Unsupported dock block kind "${block.kind || 'missing'}" at ${path}.`);
  }
  if (block.kind === 'cooling-curve-mode' && !COOLING_CURVE_FAMILY_IDS.includes(block.familyId)) {
    throw new Error('[toolsArtifactControlSurface] Cooling mode requires a curve family.');
  }

  if (block.kind === 'rows') {
    if (!Array.isArray(block.rows) || block.rows.length === 0) {
      throw new Error(`[toolsArtifactControlSurface] Dock rows block at ${path} must include rows.`);
    }
    block.rows.forEach((row, rowIndex) => {
      assertArtifactDockControlRow(row, `${path}.rows[${rowIndex}]`);
    });
    if (block.disclosure && (!isPlainObject(block.disclosure)
      || typeof block.disclosure.id !== 'string' || !block.disclosure.id.trim()
      || typeof block.disclosure.label !== 'string' || !block.disclosure.label.trim()
      || block.disclosure.Control !== ArtifactControlGroupDisclosure)) {
      throw new Error(`[toolsArtifactControlSurface] Dock rows disclosure at ${path} requires its identity, label and input-group owner.`);
    }
  }

  if (block.kind === 'actions') {
    if (!Array.isArray(block.actions) || block.actions.length === 0) {
      throw new Error(`[toolsArtifactControlSurface] Dock actions block at ${path} must include actions.`);
    }
    block.actions.forEach((action, actionIndex) => {
      if (!isPlainObject(action) || typeof action.onClick !== 'function') {
        throw new Error(`[toolsArtifactControlSurface] Dock action at ${path}.actions[${actionIndex}] is missing onClick handler.`);
      }
    });
  }

  if (block.kind === 'info' && !block.title && !block.body) {
    throw new Error(`[toolsArtifactControlSurface] Dock info block at ${path} must include title or body.`);
  }

  if (block.kind === 'status' && !block.status?.text) {
    throw new Error(`[toolsArtifactControlSurface] Dock status block at ${path} must include status text.`);
  }
}

export function buildArtifactDockBlocksContent(blocks = []) {
  const resolvedBlocks = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  if (!resolvedBlocks.length) {
    return null;
  }
  resolvedBlocks.forEach((block, index) => {
    assertArtifactDockBlock(block, `dock.blocks[${index}]`);
  });

  return (
    <div className="space-y-0">
      {resolvedBlocks.map((block, index) => renderArtifactDockBlock(block, index))}
    </div>
  );
}

export function materializeArtifactDockModel(dock = null) {
  if (!dock) {
    return null;
  }
  if (!isPlainObject(dock)) {
    throw new Error('[toolsArtifactControlSurface] Expected dock to be an object.');
  }

  const content = dock.content || buildArtifactDockBlocksContent(dock.blocks);
  if (!content) {
    throw new Error('[toolsArtifactControlSurface] Dock model must expose rendered content or non-empty blocks.');
  }
  const blocks = Array.isArray(dock.blocks) ? dock.blocks : [];
  // Themes that lay the dock out themselves (zen) take the status block as
  // data so they can set it in their own hand; the default dock still renders
  // every block through `content`, so this split is invisible to them.
  const statusBlock = blocks.find((block) => block?.kind === 'status') || null;
  const supplementalBlocks = blocks.filter(
    (block) => block?.kind !== 'rows' && block?.kind !== 'status',
  );
  const supplementalContent = supplementalBlocks.length
    ? buildArtifactDockBlocksContent(supplementalBlocks)
    : null;

  return Object.freeze({
    ...dock,
    content,
    statusBlock,
    supplementalContent,
  });
}

export function materializeArtifactControlSurface(controlSurface = null) {
  if (!controlSurface) {
    return null;
  }
  if (!isPlainObject(controlSurface)) {
    throw new Error('[toolsArtifactControlSurface] Expected controlSurface to be an object.');
  }

  const dock = materializeArtifactDockModel(controlSurface.dock);
  const master = controlSurface.master || null;

  if (!dock && !master) {
    throw new Error('[toolsArtifactControlSurface] Control surface did not expose dock or master.');
  }

  return Object.freeze({
    dock,
    master,
  });
}
