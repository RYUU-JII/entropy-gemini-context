import {
  buildArtifactBinaryControlRowModel,
  buildArtifactControlSurface,
  buildArtifactDockModel,
  buildArtifactMasterControl,
  buildArtifactRowsBlockModel,
  getArtifactFamilyChildren,
  getArtifactFamilyHandlerChildren,
  getArtifactFamilyHandlers,
  getArtifactFamilyState,
  resolveArtifactControlAccentColor,
  resolveArtifactChildDescription,
  resolveArtifactChildConfiguredEnabled,
  resolveArtifactChildTitle,
  requireArtifactChildHandler,
} from './shared.jsx';

export function buildGateCard({ shell, t, state, handlers }) {
  const gateFamily = getArtifactFamilyState(state, 'gate');
  const gateHandlers = getArtifactFamilyHandlers(handlers, 'gate');
  const gateChildren = getArtifactFamilyChildren(state, 'gate');
  const gateHandlerChildren = getArtifactFamilyHandlerChildren(handlers, 'gate');

  const entryCheckpointEnabled = resolveArtifactChildConfiguredEnabled(state, 'gate', 'entryCheckpoint');
  const returnGuardEnabled = resolveArtifactChildConfiguredEnabled(state, 'gate', 'returnGuard');

  const entryCheckpointLabel = resolveArtifactChildTitle(t, 'gate', 'entryCheckpoint');
  const entryCheckpointDescription = resolveArtifactChildDescription(t, 'gate', 'entryCheckpoint');
  const returnGuardLabel = resolveArtifactChildTitle(t, 'gate', 'returnGuard');
  const returnGuardDescription = resolveArtifactChildDescription(t, 'gate', 'returnGuard');
  const accentColor = resolveArtifactControlAccentColor(state.themeId, shell.canonicalId);
  const toggleEntryCheckpoint = requireArtifactChildHandler(
    gateHandlerChildren,
    'gate',
    'entryCheckpoint',
    'toggle',
  );
  const toggleReturnGuard = requireArtifactChildHandler(
    gateHandlerChildren,
    'gate',
    'returnGuard',
    'toggle',
  );
  const rows = [
    buildArtifactBinaryControlRowModel({
      t,
      childKey: 'entryCheckpoint',
      label: entryCheckpointLabel,
      description: entryCheckpointDescription,
      enabled: entryCheckpointEnabled,
      accentColor,
      onToggle: toggleEntryCheckpoint,
    }),
    buildArtifactBinaryControlRowModel({
      t,
      childKey: 'returnGuard',
      label: returnGuardLabel,
      description: returnGuardDescription,
      enabled: returnGuardEnabled,
      accentColor,
      onToggle: toggleReturnGuard,
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
        familyState: gateFamily,
        familyHandlers: gateHandlers,
        shell,
        accentColor,
      }),
    }),
  };
}
