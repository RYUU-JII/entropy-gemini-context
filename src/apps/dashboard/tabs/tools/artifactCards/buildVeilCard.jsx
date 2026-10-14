import {
  SOCIAL_METRIC_SCOPES,
  normalizeSocialMetricScope,
} from '../../../../../domains/settings/config/socialMetricScope.js';
import {
  buildArtifactControlSurface,
  buildArtifactDockModel,
  buildArtifactRowsBlockModel,
  buildArtifactMasterControl,
  buildArtifactBinaryControlRowModel,
  buildArtifactChoiceControlRowModel,
  getArtifactFamilyChildren,
  getArtifactFamilyHandlerChildren,
  getArtifactFamilyHandlers,
  getArtifactFamilyState,
  resolveArtifactControlAccentColor,
  resolveArtifactChildDescription,
  resolveArtifactChildConfiguredEnabled,
  resolveArtifactChildTitle,
  resolveTranslationText,
  requireArtifactChildHandler,
} from './shared.jsx';

export function buildVeilCard({ shell, t, state, handlers }) {
  const veilFamily = getArtifactFamilyState(state, 'veil');
  const veilHandlers = getArtifactFamilyHandlers(handlers, 'veil');
  const veilChildren = getArtifactFamilyChildren(state, 'veil');
  const veilHandlerChildren = getArtifactFamilyHandlerChildren(handlers, 'veil');
  const veilSocialMetricsEnabled = resolveArtifactChildConfiguredEnabled(state, 'veil', 'socialMetrics');
  const veilTimeSignalsEnabled = resolveArtifactChildConfiguredEnabled(state, 'veil', 'timeSignals');
  const veilSocialMetricsLabel = resolveArtifactChildTitle(t, 'veil', 'socialMetrics');
  const veilSocialMetricsDescription = resolveArtifactChildDescription(t, 'veil', 'socialMetrics');
  const veilTimeSignalsLabel = resolveArtifactChildTitle(t, 'veil', 'timeSignals');
  const veilTimeSignalsDescription = resolveArtifactChildDescription(t, 'veil', 'timeSignals');
  const veilSocialMetricsScope = normalizeSocialMetricScope(veilChildren.socialMetrics?.value);
  const toggleSocialMetrics = requireArtifactChildHandler(veilHandlerChildren, 'veil', 'socialMetrics', 'toggle');
  const toggleTimeSignals = requireArtifactChildHandler(veilHandlerChildren, 'veil', 'timeSignals', 'toggle');
  const setSocialMetricsScope = requireArtifactChildHandler(
    veilHandlerChildren,
    'veil',
    'socialMetrics',
    'setValue',
  );
  const accentColor = resolveArtifactControlAccentColor(state.themeId, shell.canonicalId);
  const socialMetricScopeOptions = [
    SOCIAL_METRIC_SCOPES.REACTIONS,
    SOCIAL_METRIC_SCOPES.REACTIONS_AND_VIEWS,
    SOCIAL_METRIC_SCOPES.ALL_COMPARISON,
  ].map((scope) => ({
    value: scope,
    label: resolveTranslationText(
      t,
      `artifacts.veil.children.socialMetrics.scope_options.${scope}`,
      scope,
    ),
    feedback: resolveTranslationText(
      t,
      `artifacts.veil.children.socialMetrics.scope_feedback.${scope}`,
      '',
    ),
  }));
  const rows = [
    buildArtifactChoiceControlRowModel({
      t,
      childKey: 'socialMetrics',
      label: veilSocialMetricsLabel,
      description: veilSocialMetricsDescription,
      enabled: veilSocialMetricsEnabled,
      value: veilSocialMetricsScope,
      options: socialMetricScopeOptions,
      accentColor,
      onToggle: toggleSocialMetrics,
      onValueChange: setSocialMetricsScope,
    }),
    buildArtifactBinaryControlRowModel({
      t,
      childKey: 'timeSignals',
      label: veilTimeSignalsLabel,
      description: veilTimeSignalsDescription,
      enabled: veilTimeSignalsEnabled,
      accentColor,
      onToggle: toggleTimeSignals,
    }),
    buildArtifactBinaryControlRowModel({
      t, childKey: 'shortformBlock',
      label: resolveArtifactChildTitle(t, 'veil', 'shortformBlock'),
      description: resolveArtifactChildDescription(t, 'veil', 'shortformBlock'),
      enabled: resolveArtifactChildConfiguredEnabled(state, 'veil', 'shortformBlock'),
      accentColor,
      onToggle: requireArtifactChildHandler(veilHandlerChildren, 'veil', 'shortformBlock', 'toggle'),
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
        familyState: veilFamily,
        familyHandlers: veilHandlers,
        shell,
        accentColor,
      }),
    }),
  };
}
