import {
  buildArtifactControlSurface,
  buildArtifactDockModel,
  buildArtifactBinaryControlRowModel,
  buildArtifactRangeControlRowModel,
  getArtifactFamilyChildren,
  buildArtifactRowsBlockModel,
  buildArtifactMasterControl,
  getArtifactFamilyHandlerChildren,
  getArtifactFamilyHandlers,
  getArtifactFamilyState,
  resolveArtifactControlAccentColor,
  resolveArtifactChildDescription,
  resolveArtifactChildConfiguredEnabled,
  resolveArtifactChildTitle,
  requireArtifactChildHandler,
} from './shared.jsx';
import { getCanonicalArtifactDefinition } from '../../../../../domains/protection/catalog/artifactFamilyCatalog.js';

export function buildLensCard({ shell, t, state, handlers }) {
  const lensFamily = getArtifactFamilyState(state, 'lens');
  const lensHandlers = getArtifactFamilyHandlers(handlers, 'lens');
  const lensChildren = getArtifactFamilyChildren(state, 'lens');
  const lensHandlerChildren = getArtifactFamilyHandlerChildren(handlers, 'lens');
  const fullscreenVisualRelaxation = lensFamily.fullscreenVisualRelaxation || {};
  const fullscreenVisualRelaxationHandlers = lensHandlers.fullscreenVisualRelaxation || {};
  const fullscreenVisualRelaxationLabel = resolveArtifactChildTitle(t, 'lens', 'fullscreenVisualRelaxation');
  const fullscreenVisualRelaxationDescription = resolveArtifactChildDescription(t, 'lens', 'fullscreenVisualRelaxation');
  if (typeof fullscreenVisualRelaxationHandlers.toggle !== 'function') {
    throw new Error('LENS_FULLSCREEN_VISUAL_RELAXATION_HANDLER_REQUIRED');
  }
  const accentColor = resolveArtifactControlAccentColor(state.themeId, shell.canonicalId);
  const definition = getCanonicalArtifactDefinition('lens');
  const rows = definition.releaseChildren.map((childKey) => buildArtifactRangeControlRowModel({
      t,
      childKey,
      label: resolveArtifactChildTitle(t, 'lens', childKey),
      description: resolveArtifactChildDescription(t, 'lens', childKey),
      enabled: resolveArtifactChildConfiguredEnabled(state, 'lens', childKey),
      value: lensChildren[childKey].value,
      featureKey: ({ grayscale: 'saturation', saturation: 'colorSaturation' })[childKey] || childKey,
      accentColor,
      onToggle: requireArtifactChildHandler(lensHandlerChildren, 'lens', childKey, 'toggle'),
      onValueChange: requireArtifactChildHandler(lensHandlerChildren, 'lens', childKey, 'setValue'),
    }));
  const fullscreenRow = buildArtifactBinaryControlRowModel({
      t,
      childKey: 'fullscreenVisualRelaxation',
      label: fullscreenVisualRelaxationLabel,
      description: fullscreenVisualRelaxation.eligible === true
        ? fullscreenVisualRelaxationDescription
        : t('artifacts.lens.children.fullscreenVisualRelaxation.inactiveDescription'),
      enabled: fullscreenVisualRelaxation.enabled === true,
      accentColor,
      onToggle: (nextEnabled) => fullscreenVisualRelaxationHandlers.toggle(nextEnabled),
      className: 'border-t border-dashed border-border/20 pt-2 last:border-b-0',
      labelClassName: 'text-on-surface-muted',
      descriptionClassName: 'text-on-surface-subtle',
    });
  const [primaryGroup, secondaryGroup] = definition.releaseChildGroups;
  if (primaryGroup?.id !== 'primary' || secondaryGroup?.id !== 'secondary' || definition.releaseChildGroups.length !== 2) {
    throw new Error('LENS_RELEASE_CONTROL_GROUPS_REQUIRED');
  }
  const rowsByChild = new Map(rows.map(row => [row.childKey, row]));
  const groupRows = group => group.children.map(child => {
    const row = rowsByChild.get(child);
    if (!row) throw new Error(`LENS_RELEASE_CONTROL_ROW_REQUIRED:${child}`);
    return row;
  });

  return {
    controlSurface: buildArtifactControlSurface({
      dock: buildArtifactDockModel({
        blocks: [
          buildArtifactRowsBlockModel({ rows: [...groupRows(primaryGroup), fullscreenRow] }),
          buildArtifactRowsBlockModel({ rows: groupRows(secondaryGroup),
            disclosure: { id: 'lens-secondary', label: t('artifact_controls.secondary_adjustments') } }),
        ],
      }),
      master: buildArtifactMasterControl({
        t,
        familyState: lensFamily,
        familyHandlers: lensHandlers,
        shell,
        accentColor,
      }),
    }),
  };
}
