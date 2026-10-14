import {
  buildArtifactBinaryControlRowModel,
  buildArtifactChoiceControlRowModel,
  buildArtifactControlSurface,
  buildArtifactDockModel,
  buildArtifactMasterControl,
  buildArtifactRowsBlockModel,
  getArtifactFamilyChildren,
  getArtifactFamilyHandlerChildren,
  getArtifactFamilyHandlers,
  getArtifactFamilyState,
  resolveArtifactChildDescription,
  resolveArtifactChildTitle,
  resolveArtifactControlAccentColor,
  resolveConfiguredArtifactChildEnabled,
  resolveTranslationText,
  requireArtifactChildHandler,
} from './shared.jsx';

export function buildBrakeCard({ shell, t, state, handlers }) {
  const controlAccentColor = resolveArtifactControlAccentColor(state.themeId, shell.canonicalId);
  const brakeFamily = getArtifactFamilyState(state, 'brake');
  const brakeHandlers = getArtifactFamilyHandlers(handlers, 'brake');
  const brakeChildren = getArtifactFamilyChildren(state, 'brake');
  const brakeHandlerChildren = getArtifactFamilyHandlerChildren(handlers, 'brake');
  const clickPauseLabel = resolveArtifactChildTitle(t, 'brake', 'clickPause');
  const clickPauseDescription = resolveArtifactChildDescription(t, 'brake', 'clickPause');
  const scrollFrictionLabel = resolveArtifactChildTitle(t, 'brake', 'scrollFriction');
  const scrollFrictionDescription = resolveArtifactChildDescription(t, 'brake', 'scrollFriction');
  const inputVisualBrakeLabel = resolveArtifactChildTitle(t, 'brake', 'inputVisualBrake');
  const inputVisualBrakeDescription = resolveArtifactChildDescription(t, 'brake', 'inputVisualBrake');
  const toggleClickPause = requireArtifactChildHandler(
    brakeHandlerChildren,
    'brake',
    'clickPause',
    'toggle',
  );
  const toggleScrollFriction = requireArtifactChildHandler(
    brakeHandlerChildren,
    'brake',
    'scrollFriction',
    'toggle',
  );
  const toggleInputVisualBrake = requireArtifactChildHandler(
    brakeHandlerChildren,
    'brake',
    'inputVisualBrake',
    'toggle',
  );
  const rows = [
    buildArtifactBinaryControlRowModel({
      t,
      childKey: 'clickPause',
      label: clickPauseLabel,
      description: clickPauseDescription,
      enabled: resolveConfiguredArtifactChildEnabled(brakeChildren.clickPause),
      accentColor: controlAccentColor,
      onToggle: toggleClickPause,
    }),
    buildArtifactBinaryControlRowModel({
      t,
      childKey: 'scrollFriction',
      label: scrollFrictionLabel,
      description: scrollFrictionDescription,
      enabled: resolveConfiguredArtifactChildEnabled(brakeChildren.scrollFriction),
      accentColor: controlAccentColor,
      onToggle: toggleScrollFriction,
    }),
    buildArtifactBinaryControlRowModel({
      t, childKey: 'skipFriction',
      label: resolveArtifactChildTitle(t, 'brake', 'skipFriction'),
      description: resolveArtifactChildDescription(t, 'brake', 'skipFriction'),
      enabled: resolveConfiguredArtifactChildEnabled(brakeChildren.skipFriction),
      accentColor: controlAccentColor,
      onToggle: requireArtifactChildHandler(brakeHandlerChildren, 'brake', 'skipFriction', 'toggle'),
    }),
    buildArtifactBinaryControlRowModel({
      t,
      childKey: 'inputVisualBrake',
      label: inputVisualBrakeLabel,
      description: inputVisualBrakeDescription,
      enabled: resolveConfiguredArtifactChildEnabled(brakeChildren.inputVisualBrake),
      accentColor: controlAccentColor,
      onToggle: toggleInputVisualBrake,
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
        familyState: brakeFamily,
        familyHandlers: brakeHandlers,
        shell,
        accentColor: controlAccentColor,
      }),
    }),
  };
}
