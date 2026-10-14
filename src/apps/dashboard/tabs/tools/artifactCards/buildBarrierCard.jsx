import React from 'react';
import ArtifactApplicationFeedback from '../components/ArtifactApplicationFeedback.jsx';
import { ENSO_INTERVAL_PRESETS, resolveEnsoIntervalMs } from '../../../../../domains/settings/config/ensoIntervalPolicy.js';
import {
  GATE_PROTECTED_TAB_MAX,
  GATE_PROTECTED_TAB_MIN,
  normalizeGateMaxProtectedTabs,
} from '../../../../../domains/settings/config/gateConfig.js';
import {
  buildArtifactControlSurface,
  buildArtifactDockModel,
  buildArtifactBinaryControlRowModel,
  buildArtifactChoiceControlRowModel,
  resolveTranslationText,
  buildArtifactMasterControl,
  buildArtifactNumberControlRowModel,
  buildArtifactRowsBlockModel,
  getArtifactFamilyChildren,
  getArtifactFamilyHandlerChildren,
  getArtifactFamilyHandlers,
  getArtifactFamilyState,
  resolveArtifactChildDescription,
  resolveArtifactChildConfiguredEnabled,
  resolveArtifactChildTitle,
  resolveArtifactControlAccentColor,
  requireArtifactChildHandler,
} from './shared.jsx';

export function buildBarrierCard({ shell, t, state, handlers }) {
  const controlAccentColor = resolveArtifactControlAccentColor(state.themeId, shell.canonicalId);
  const barrierFamily = getArtifactFamilyState(state, 'barrier');
  const barrierHandlers = getArtifactFamilyHandlers(handlers, 'barrier');
  const barrierChildren = getArtifactFamilyChildren(state, 'barrier');
  const barrierHandlerChildren = getArtifactFamilyHandlerChildren(handlers, 'barrier');
  const textRhythmLabel = resolveArtifactChildTitle(t, 'barrier', 'textRhythm');
  const textRhythmDescription = resolveArtifactChildDescription(t, 'barrier', 'textRhythm');
  const detourSpreadGuardLabel = resolveArtifactChildTitle(t, 'barrier', 'detourSpreadGuard');
  const detourSpreadGuardDescription = resolveArtifactChildDescription(t, 'barrier', 'detourSpreadGuard');
  const textRhythmEnabled = resolveArtifactChildConfiguredEnabled(state, 'barrier', 'textRhythm');
  const detourSpreadGuardEnabled = resolveArtifactChildConfiguredEnabled(
    state,
    'barrier',
    'detourSpreadGuard',
  );
  const maxProtectedTabs = normalizeGateMaxProtectedTabs(barrierChildren.detourSpreadGuard?.value);
  const tabManagement = barrierFamily.tabManagement;
  if (!tabManagement || typeof tabManagement.groupProtectedTabs !== 'boolean'
    || typeof barrierHandlers.tabManagement?.toggle !== 'function') {
    throw new Error('BARRIER_TAB_MANAGEMENT_CONTROL_REQUIRED');
  }
  const capability = shell.activationState?.capability;
  const groupingStatus = capability?.readError ? (shell.applicationStatus?.action === 'retry_permissions' ? null : {
    action: 'retry_permissions',
    detail: t('artifact_altar.application.detail_permission_snapshot_unavailable', { error: capability.readError }),
  }) : capability?.hasTabGroups === false ? {
    action: 'tab_groups', detail: t('artifacts.barrier.tab_management.permission_missing'),
  } : null;
  const toggleTextRhythm = requireArtifactChildHandler(
    barrierHandlerChildren,
    'barrier',
    'textRhythm',
    'toggle',
  );
  const toggleDetourSpreadGuard = requireArtifactChildHandler(
    barrierHandlerChildren,
    'barrier',
    'detourSpreadGuard',
    'toggle',
  );
  const setDetourSpreadGuardMaxProtectedTabs = requireArtifactChildHandler(
    barrierHandlerChildren,
    'barrier',
    'detourSpreadGuard',
    'setValue',
  );
  const barrierIntentThresholdLabel = resolveArtifactChildTitle(t, 'barrier', 'intentThreshold');
  const barrierIntentThresholdDescription = resolveArtifactChildDescription(t, 'barrier', 'intentThreshold');
  const barrierIntentThresholdEnabled = resolveArtifactChildConfiguredEnabled(state, 'barrier', 'intentThreshold');
  const ensoInterval = barrierChildren.intentThreshold?.value;
  resolveEnsoIntervalMs(ensoInterval);
  const toggleIntentThreshold = requireArtifactChildHandler(
    barrierHandlerChildren,
    'barrier',
    'intentThreshold',
    'toggle',
  );
  const setIntentInterval = requireArtifactChildHandler(barrierHandlerChildren, 'barrier', 'intentThreshold', 'setValue');
  const intervalOptions = Object.keys(ENSO_INTERVAL_PRESETS).map((value) => ({
    value,
    label: resolveTranslationText(t, `artifacts.barrier.children.intentThreshold.interval_options.${value}`),
    feedback: resolveTranslationText(t, 'artifacts.barrier.children.intentThreshold.interval_feedback'),
  }));
  const rows = [
    buildArtifactChoiceControlRowModel({
      t, childKey: 'intentThreshold',
      label: barrierIntentThresholdLabel,
      description: barrierIntentThresholdDescription,
      enabled: barrierIntentThresholdEnabled,
      value: ensoInterval,
      options: intervalOptions,
      accentColor: controlAccentColor,
      onToggle: toggleIntentThreshold,
      onValueChange: setIntentInterval,
    }),
    buildArtifactBinaryControlRowModel({
      t,
      childKey: 'textRhythm',
      label: textRhythmLabel,
      description: textRhythmDescription,
      enabled: textRhythmEnabled,
      accentColor: controlAccentColor,
      onToggle: toggleTextRhythm,
    }),
    buildArtifactBinaryControlRowModel({
      t,
      childKey: 'tabManagement',
      label: t('artifacts.barrier.tab_management.title'),
      description: t('artifacts.barrier.tab_management.desc'),
      enabled: tabManagement.groupProtectedTabs,
      feedbackContent: tabManagement.groupProtectedTabs && groupingStatus
        ? <ArtifactApplicationFeedback status={groupingStatus} handlers={{ ...handlers, tabManagement: barrierHandlers.tabManagement }} />
        : null,
      onToggle: barrierHandlers.tabManagement.toggle,
      accentColor: controlAccentColor,
    }),
    buildArtifactNumberControlRowModel({
      t,
      childKey: 'detourSpreadGuard',
      label: detourSpreadGuardLabel,
      description: detourSpreadGuardDescription,
      enabled: detourSpreadGuardEnabled,
      value: maxProtectedTabs,
      min: GATE_PROTECTED_TAB_MIN,
      max: GATE_PROTECTED_TAB_MAX,
      feedback: t('artifacts.barrier.children.detourSpreadGuard.budget_feedback', {
        count: maxProtectedTabs, threshold: maxProtectedTabs + 1,
      }),
      onToggle: toggleDetourSpreadGuard,
      onValueChange: setDetourSpreadGuardMaxProtectedTabs,
    }),
  ];

  return {
    controlSurface: buildArtifactControlSurface({
      dock: buildArtifactDockModel({
        blocks: [
          buildArtifactRowsBlockModel({ rows }),
        ],
      }),
      master: buildArtifactMasterControl({
        t,
        familyState: {
          ...barrierFamily,
          configuredEnabled: barrierFamily.configuredEnabled === true || barrierFamily.enabled === true || tabManagement.groupProtectedTabs,
        },
        familyHandlers: barrierHandlers,
        shell,
        accentColor: controlAccentColor,
      }),
    }),
  };
}
